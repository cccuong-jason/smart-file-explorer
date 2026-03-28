import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
import { getCargoCommand, getRustToolEnv, getTrustedWorkspaceRoot } from './rust-toolchain.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const SRC_TAURI_DIR = path.join(ROOT, 'src-tauri');
const TRUSTED_WORKSPACE_ROOT = getTrustedWorkspaceRoot(ROOT);
const RUN_ID = `${Date.now()}-${process.pid}`;
const TEMP_ROOT = path.join(TRUSTED_WORKSPACE_ROOT, `tauri-build-${RUN_ID}`);
const TEMP_TAURI_DIR = path.join(TEMP_ROOT, 'src-tauri');
const TEMP_TARGET_DIR = path.join(TEMP_ROOT, 'target');

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
  console.log(`Preparing trusted Tauri build workspace at ${TEMP_TAURI_DIR}`);
  await resetDir(TEMP_TAURI_DIR);
  await copyDir(SRC_TAURI_DIR, TEMP_TAURI_DIR);

  const cargoCommand = getCargoCommand();
  const rustToolEnv = getRustToolEnv();

  const child = spawnLogged(cargoCommand, ['build', '--release'], {
    cwd: TEMP_TAURI_DIR,
    env: {
      ...process.env,
      ...rustToolEnv,
      CARGO_TARGET_DIR: TEMP_TARGET_DIR,
    },
  });

  await waitForExit(child);
  console.log(`Release artifacts are available under ${path.join(TEMP_TARGET_DIR, 'release')}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
