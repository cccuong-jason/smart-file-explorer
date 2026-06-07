import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
import { getCargoCommand, getRustToolEnv, getTrustedWorkspaceRoot } from './rust-toolchain.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const TRUSTED_WORKSPACE_ROOT = getTrustedWorkspaceRoot(ROOT);
const RUN_ID = `${Date.now()}-${process.pid}`;
const TEMP_ROOT = path.join(TRUSTED_WORKSPACE_ROOT, `tauri-bundle-${RUN_ID}`, 'project');
const TEMP_TARGET_DIR = path.join(TEMP_ROOT, 'src-tauri', 'target');
const DEFAULT_BUNDLE_ARTIFACT_DIR = path.join(ROOT, 'artifacts', 'desktop', process.platform);
const BUNDLE_ARTIFACT_DIR = process.env.SMART_FILE_EXPLORER_BUNDLE_ARTIFACT_DIR
  ? path.resolve(process.env.SMART_FILE_EXPLORER_BUNDLE_ARTIFACT_DIR)
  : DEFAULT_BUNDLE_ARTIFACT_DIR;
const tauriCommand = process.platform === 'win32'
  ? path.join(ROOT, 'node_modules', '.bin', 'tauri.cmd')
  : path.join(ROOT, 'node_modules', '.bin', 'tauri');

async function resetDir(dir) {
  await fs.rm(dir, { recursive: true, force: true });
  await fs.mkdir(dir, { recursive: true });
}

async function copyProject(source, target) {
  await fs.mkdir(target, { recursive: true });

  const entries = await fs.readdir(source, { withFileTypes: true });
  for (const entry of entries) {
    if (
      [
        '.git',
        '.smart-file-explorer-build-workspaces',
        '.smart-file-explorer-workspaces',
        'coverage',
        'dist',
        'node_modules',
        'playwright-report',
        'src-tauri/target',
        'test-results',
      ].includes(entry.name)
    ) {
      continue;
    }

    const sourcePath = path.join(source, entry.name);
    const targetPath = path.join(target, entry.name);
    await fs.cp(sourcePath, targetPath, {
      recursive: true,
      force: true,
      filter: (src) => {
        const relative = path.relative(sourcePath, src).replaceAll('\\', '/');
        return !(relative === 'target' || relative.startsWith('target/'));
      },
    });
  }
}

async function copyNodeModules(target) {
  await fs.cp(path.join(ROOT, 'node_modules'), target, {
    recursive: true,
    force: true,
  });
}

async function copyBundleArtifacts(source, target) {
  await fs.rm(target, { recursive: true, force: true });
  await fs.mkdir(target, { recursive: true });
  await fs.cp(source, target, {
    recursive: true,
    force: true,
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
  console.log(`Preparing trusted Tauri bundle workspace at ${TEMP_ROOT}`);
  await resetDir(TEMP_ROOT);
  await copyProject(ROOT, TEMP_ROOT);
  await copyNodeModules(path.join(TEMP_ROOT, 'node_modules'));

  const child = spawnLogged(tauriCommand, ['build'], {
    cwd: TEMP_ROOT,
    env: {
      ...process.env,
      ...getRustToolEnv(),
      ...(process.platform === 'win32' ? { CARGO: getCargoCommand() } : {}),
      CARGO_TARGET_DIR: TEMP_TARGET_DIR,
    },
  });

  await waitForExit(child);
  const bundleDir = path.join(TEMP_TARGET_DIR, 'release', 'bundle');
  await copyBundleArtifacts(bundleDir, BUNDLE_ARTIFACT_DIR);
  console.log(`Bundle artifacts are available under ${BUNDLE_ARTIFACT_DIR}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
