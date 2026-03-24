import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const SRC_TAURI_DIR = path.join(ROOT, 'src-tauri');
const TEMP_ROOT = path.join(os.tmpdir(), 'smart-file-explorer-tauri-smoke');
const TEMP_TAURI_DIR = path.join(TEMP_ROOT, 'src-tauri');

async function resetDir(dir) {
  await fs.rm(dir, { recursive: true, force: true });
  await fs.mkdir(dir, { recursive: true });
}

async function copyDir(source, target) {
  await fs.cp(source, target, {
    recursive: true,
    force: true,
    filter: (src) => !src.replaceAll('\\', '/').includes('/target/'),
  });
}

function spawnLogged(command, args, options) {
  const useShell = process.platform === 'win32' && (/(\.cmd|\.bat)$/i.test(command) || options?.shell === true);

  return useShell
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
}

function singleQuotePowerShell(value) {
  return value.replace(/'/g, "''");
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
  console.log(`Preparing trusted Tauri smoke workspace at ${TEMP_TAURI_DIR}`);
  await resetDir(TEMP_ROOT);
  await copyDir(SRC_TAURI_DIR, TEMP_TAURI_DIR);

  const cargoCommand = process.platform === 'win32'
    ? path.join(process.env.USERPROFILE ?? os.homedir(), '.cargo', 'bin', 'cargo.exe')
    : 'cargo';
  const rustupCommand = process.platform === 'win32'
    ? path.join(process.env.USERPROFILE ?? os.homedir(), '.cargo', 'bin', 'rustup.exe')
    : 'rustup';

  const child = process.platform === 'win32'
    ? spawnLogged(
        'powershell.exe',
        [
          '-NoProfile',
          '-ExecutionPolicy',
          'Bypass',
          '-Command',
          `Set-Location -LiteralPath '${singleQuotePowerShell(TEMP_TAURI_DIR)}'; & '${singleQuotePowerShell(rustupCommand)}' run stable cargo test`,
        ],
        {
          cwd: ROOT,
          env: process.env,
        },
      )
    : spawnLogged(cargoCommand, ['test'], {
        cwd: TEMP_TAURI_DIR,
        env: process.env,
      });

  await waitForExit(child);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
