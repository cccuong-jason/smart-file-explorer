import fs from 'node:fs/promises';
import net from 'node:net';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
import { getCargoCommand, getRustToolEnv, getTrustedWorkspaceRoot } from './rust-toolchain.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const SRC_TAURI_DIR = path.join(ROOT, 'src-tauri');
const TRUSTED_WORKSPACE_ROOT = getTrustedWorkspaceRoot(ROOT);
const RUN_ID = `${Date.now()}-${process.pid}`;
const TEMP_ROOT = path.join(TRUSTED_WORKSPACE_ROOT, `tauri-dev-${RUN_ID}`);
const TEMP_TAURI_DIR = path.join(TEMP_ROOT, 'src-tauri');
const TEMP_TARGET_DIR = path.join(TEMP_ROOT, 'target');
const DEV_SERVER_URL = 'http://127.0.0.1:3000';
const DEV_SERVER_PORT = 3000;
const DEV_SERVER_READY_TIMEOUT_MS = 180000;
const DEV_SERVER_REQUEST_TIMEOUT_MS = 30000;
const MANAGED_FRONTEND_PID_PATH = path.join(TRUSTED_WORKSPACE_ROOT, 'frontend-dev.pid');

async function resetDir(dir) {
  await fs.rm(dir, { recursive: true, force: true });
  await fs.mkdir(dir, { recursive: true });
}

async function copyDir(source, target) {
  await fs.cp(source, target, {
    recursive: true,
    force: true,
    filter: (src) => {
      const normalized = src.replaceAll('\\', '/');
      return !(normalized.endsWith('/target') || normalized.includes('/target/'));
    },
  });
}

function spawnLogged(command, args, options) {
  const useShell =
    process.platform === 'win32' && (/\.(cmd|bat)$/i.test(command) || options?.shell === true);

  const child = useShell
    ? spawn(
        `"${command}" ${args.map((arg) => (arg.includes(' ') ? `"${arg}"` : arg)).join(' ')}`,
        [],
        {
          stdio: 'inherit',
          shell: true,
          ...options,
        },
      )
    : spawn(command, args, {
        stdio: 'inherit',
        ...options,
      });

  child.on('error', (error) => {
    console.error(error);
  });

  return child;
}

async function waitForDevServer(url, timeoutMs = DEV_SERVER_READY_TIMEOUT_MS) {
  const started = Date.now();

  while (Date.now() - started < timeoutMs) {
    if (await devServerIsReady(url)) {
      return;
    }

    await new Promise((resolve) => setTimeout(resolve, 1000));
  }

  throw new Error(`Timed out waiting for dev server at ${url}`);
}

async function devServerIsReady(url) {
  try {
    const response = await fetch(url, {
      method: 'GET',
      signal: AbortSignal.timeout(DEV_SERVER_REQUEST_TIMEOUT_MS),
    });
    return response.ok;
  } catch {
    return false;
  }
}

async function removeFileIfPresent(filePath) {
  try {
    await fs.rm(filePath, { force: true });
  } catch {
    // Ignore cleanup errors for optional local state.
  }
}

async function recordManagedFrontendPid(pid) {
  await fs.mkdir(path.dirname(MANAGED_FRONTEND_PID_PATH), { recursive: true });
  await fs.writeFile(MANAGED_FRONTEND_PID_PATH, `${pid}\n`, 'utf8');
}

async function readManagedFrontendPid() {
  try {
    const raw = await fs.readFile(MANAGED_FRONTEND_PID_PATH, 'utf8');
    const parsed = Number.parseInt(raw.trim(), 10);
    return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
  } catch {
    return null;
  }
}

function processIsRunning(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

function waitForExit(child) {
  return new Promise((resolve, reject) => {
    child.on('exit', (code) => {
      if (code === 0) {
        resolve();
        return;
      }

      reject(new Error(`Process exited with code ${code ?? 1}`));
    });
    child.on('error', reject);
  });
}

async function terminateProcessTree(pid) {
  if (!processIsRunning(pid)) {
    return;
  }

  if (process.platform === 'win32') {
    await waitForExit(
      spawnLogged('taskkill.exe', ['/PID', String(pid), '/T', '/F'], {
        cwd: ROOT,
        env: process.env,
      }),
    );
    return;
  }

  process.kill(pid, 'SIGTERM');
}

async function portIsOccupied(port) {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.once('error', (error) => {
      if (error.code === 'EADDRINUSE') {
        resolve(true);
        return;
      }

      reject(error);
    });
    server.once('listening', () => {
      server.close(() => resolve(false));
    });
    server.listen(port, '127.0.0.1');
  });
}

async function ensureFrontend(nodeCommand, nextCliScript) {
  const frontendReady = await devServerIsReady(DEV_SERVER_URL);
  if (frontendReady) {
    console.log(`Reusing existing frontend at ${DEV_SERVER_URL}`);
    return {
      frontend: undefined,
      ownsFrontend: false,
    };
  }

  const managedPid = await readManagedFrontendPid();
  if (managedPid) {
    await terminateProcessTree(managedPid);
    await removeFileIfPresent(MANAGED_FRONTEND_PID_PATH);
  }

  if (await portIsOccupied(DEV_SERVER_PORT)) {
    throw new Error(
      `Port ${DEV_SERVER_PORT} is already in use by another process and did not answer as the local frontend. Stop that process and rerun make dev.`,
    );
  }

  const frontend = spawnLogged(nodeCommand, [nextCliScript, '--host', '127.0.0.1', '--port', String(DEV_SERVER_PORT), '--strictPort'], {
    cwd: ROOT,
    env: process.env,
  });

  await recordManagedFrontendPid(frontend.pid);

  return {
    frontend,
    ownsFrontend: true,
  };
}

async function cleanupManagedFrontendPid(frontend, ownsFrontend) {
  if (!ownsFrontend || !frontend?.pid) {
    return;
  }

  const managedPid = await readManagedFrontendPid();
  if (managedPid === frontend.pid) {
    await removeFileIfPresent(MANAGED_FRONTEND_PID_PATH);
  }
}

async function main() {
  console.log(`Preparing trusted Tauri workspace at ${TEMP_TAURI_DIR}`);
  await resetDir(TEMP_TAURI_DIR);
  await copyDir(SRC_TAURI_DIR, TEMP_TAURI_DIR);

  const nodeCommand = process.execPath;
  const cargoCommand = getCargoCommand();
  const rustToolEnv = getRustToolEnv();
  const downloadModelScript = path.join(ROOT, 'scripts', 'download-model.mjs');
  const viteCliScript = path.join(ROOT, 'node_modules', 'vite', 'bin', 'vite.js');

  await waitForExit(
    spawnLogged(nodeCommand, [downloadModelScript], {
      cwd: ROOT,
      env: process.env,
    }),
  );

  let cargoProcess;
  let frontend;
  let ownsFrontend = false;
  let shuttingDown = false;

  const shutdown = () => {
    if (shuttingDown) {
      return;
    }

    shuttingDown = true;
    if (cargoProcess && !cargoProcess.killed) {
      cargoProcess.kill();
    }
    if (ownsFrontend && frontend && !frontend.killed) {
      void cleanupManagedFrontendPid(frontend, ownsFrontend);
      frontend.kill();
    }
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);

  try {
    ({ frontend, ownsFrontend } = await ensureFrontend(nodeCommand, viteCliScript));

    await waitForDevServer(DEV_SERVER_URL);
    console.log(`Frontend ready at ${DEV_SERVER_URL}`);
    cargoProcess = spawnLogged(cargoCommand, ['run'], {
      cwd: TEMP_TAURI_DIR,
      env: {
        ...process.env,
        ...rustToolEnv,
        CARGO_TARGET_DIR: TEMP_TARGET_DIR,
      },
    });
  } catch (error) {
    shutdown();
    throw error;
  }

  cargoProcess.on('exit', (code) => {
    void cleanupManagedFrontendPid(frontend, ownsFrontend);
    shutdown();
    process.exit(code ?? 0);
  });

  frontend?.on('exit', (code) => {
    if (!shuttingDown) {
      void cleanupManagedFrontendPid(frontend, ownsFrontend);
      console.error(`Frontend process exited early with code ${code ?? 1}`);
      shutdown();
      process.exit(code ?? 1);
    }
  });
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
