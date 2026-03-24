import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const SRC_TAURI_DIR = path.join(ROOT, 'src-tauri');
const TEMP_ROOT = path.join(os.tmpdir(), 'smart-file-explorer-tauri-dev');
const TEMP_TAURI_DIR = path.join(TEMP_ROOT, 'src-tauri');
const DEV_SERVER_URL = 'http://127.0.0.1:3000';

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
      return !normalized.includes('/target/');
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

function singleQuotePowerShell(value) {
  return value.replace(/'/g, "''");
}

async function waitForDevServer(url, timeoutMs = 120000) {
  const started = Date.now();

  while (Date.now() - started < timeoutMs) {
    try {
      const response = await fetch(url, { method: 'GET' });
      if (response.ok) {
        return;
      }
    } catch {
      // Keep polling until the dev server is available.
    }

    await new Promise((resolve) => setTimeout(resolve, 1000));
  }

  throw new Error(`Timed out waiting for dev server at ${url}`);
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

async function main() {
  console.log(`Preparing trusted Tauri workspace at ${TEMP_TAURI_DIR}`);
  await resetDir(TEMP_ROOT);
  await copyDir(SRC_TAURI_DIR, TEMP_TAURI_DIR);

  const nodeCommand = process.execPath;
  const cargoCommand = process.platform === 'win32'
    ? path.join(process.env.USERPROFILE ?? os.homedir(), '.cargo', 'bin', 'cargo.exe')
    : 'cargo';
  const rustupCommand = process.platform === 'win32'
    ? path.join(process.env.USERPROFILE ?? os.homedir(), '.cargo', 'bin', 'rustup.exe')
    : 'rustup';
  const downloadModelScript = path.join(ROOT, 'scripts', 'download-model.mjs');
  const nextCliScript = path.join(ROOT, 'node_modules', 'next', 'dist', 'bin', 'next');

  await waitForExit(
    spawnLogged(nodeCommand, [downloadModelScript], {
      cwd: ROOT,
      env: process.env,
    }),
  );

  const frontend = spawnLogged(nodeCommand, [nextCliScript, 'dev', '--webpack'], {
    cwd: ROOT,
    env: process.env,
  });

  let cargoProcess;
  let shuttingDown = false;

  const shutdown = () => {
    if (shuttingDown) {
      return;
    }

    shuttingDown = true;
    if (cargoProcess && !cargoProcess.killed) {
      cargoProcess.kill();
    }
    if (!frontend.killed) {
      frontend.kill();
    }
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);

  try {
    await waitForDevServer(DEV_SERVER_URL);
    console.log(`Frontend ready at ${DEV_SERVER_URL}`);
    cargoProcess = process.platform === 'win32'
      ? spawnLogged(
          'powershell.exe',
          [
            '-NoProfile',
            '-ExecutionPolicy',
            'Bypass',
            '-Command',
            `Set-Location -LiteralPath '${singleQuotePowerShell(TEMP_TAURI_DIR)}'; & '${singleQuotePowerShell(rustupCommand)}' run stable cargo run`,
          ],
          {
            cwd: ROOT,
            env: process.env,
          },
        )
      : spawnLogged(cargoCommand, ['run'], {
          cwd: TEMP_TAURI_DIR,
          env: process.env,
        });
  } catch (error) {
    shutdown();
    throw error;
  }

  cargoProcess.on('exit', (code) => {
    shutdown();
    process.exit(code ?? 0);
  });

  frontend.on('exit', (code) => {
    if (!shuttingDown) {
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
