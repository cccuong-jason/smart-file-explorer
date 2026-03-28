import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
import { stopManagedFrontendIfPresent } from './managed-frontend.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const mode = process.argv[2];
const dryRun = process.argv.includes('--dry-run');

const OS_LABELS = {
  win32: 'Windows',
  darwin: 'macOS',
  linux: 'Linux',
};

function usage() {
  console.log('Usage: node scripts/workflow.mjs <dev|build|production> [--dry-run]');
}

function localPath(...segments) {
  return path.join(ROOT, ...segments);
}

function commandExists(command) {
  const paths = (process.env.PATH || '').split(path.delimiter).filter(Boolean);
  const extensions = process.platform === 'win32'
    ? ['.exe', '.cmd', '.bat', '']
    : [''];

  return paths.some((dir) =>
    extensions.some((ext) => fs.existsSync(path.join(dir, `${command}${ext}`))),
  );
}

function hasInstalledDependencies() {
  return fs.existsSync(localPath('node_modules', 'vite', 'package.json'));
}

function hasDownloadedModel() {
  return fs.existsSync(
    localPath('public', 'models', 'Xenova', 'all-MiniLM-L6-v2', 'onnx', 'model_quantized.onnx'),
  );
}

function desktopPrereqMessage() {
  switch (process.platform) {
    case 'win32':
      return [
        'Desktop prerequisites are incomplete for Windows.',
        'Install Rust stable with rustup, Visual Studio Build Tools with the C++ workload, and the Microsoft Edge WebView2 Runtime.',
      ].join(' ');
    case 'darwin':
      return [
        'Desktop prerequisites are incomplete for macOS.',
        'Install Rust stable with rustup and Xcode Command Line Tools.',
      ].join(' ');
    case 'linux':
      return [
        'Desktop prerequisites are incomplete for Linux.',
        'Install Rust stable with rustup and the Tauri native WebKitGTK dependencies required by your distribution.',
      ].join(' ');
    default:
      return 'Desktop prerequisites are incomplete for this operating system.';
  }
}

function desktopPrereqsAvailable() {
  if (process.platform === 'win32') {
    const userProfile = process.env.USERPROFILE || '';
    const rustupExe = path.join(userProfile, '.cargo', 'bin', 'rustup.exe');
    return fs.existsSync(rustupExe) || commandExists('rustup');
  }

  return commandExists('cargo') && commandExists('rustup');
}

function spawnCommand(command, args, options = {}) {
  const child = spawn(command, args, {
    cwd: ROOT,
    stdio: 'inherit',
    env: process.env,
    ...options,
  });

  return new Promise((resolve, reject) => {
    child.on('exit', (code, signal) => {
      if (signal) {
        process.kill(process.pid, signal);
        return;
      }

      if (code === 0) {
        resolve();
        return;
      }

      reject(new Error(`${command} exited with code ${code ?? 1}`));
    });

    child.on('error', reject);
  });
}

async function runNodeScript(scriptPath, args = []) {
  const resolvedPath = path.resolve(ROOT, scriptPath);
  if (dryRun) {
    console.log(`[dry-run] node ${path.relative(ROOT, resolvedPath)} ${args.join(' ')}`.trim());
    return;
  }

  await spawnCommand(process.execPath, [resolvedPath, ...args]);
}

async function runNpmCiIfNeeded() {
  if (hasInstalledDependencies()) {
    return;
  }

  console.log('Installing dependencies with npm ci...');
  if (dryRun) {
    console.log('[dry-run] npm ci');
    return;
  }

  const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm';
  await spawnCommand(npmCommand, ['ci']);
}

async function ensureModelAssets() {
  if (hasDownloadedModel()) {
    return;
  }

  console.log('Downloading local model assets...');
  await runNodeScript('scripts/download-model.mjs');
}

async function runDev() {
  await runNpmCiIfNeeded();
  await ensureModelAssets();

  if (!desktopPrereqsAvailable()) {
    throw new Error(desktopPrereqMessage());
  }

  console.log(`Starting desktop development on ${OS_LABELS[process.platform] || process.platform}...`);
  await runNodeScript('scripts/desktop-dev.mjs');
}

async function runBuild() {
  await runNpmCiIfNeeded();
  await ensureModelAssets();
  await stopManagedFrontendIfPresent(ROOT);

  if (!desktopPrereqsAvailable()) {
    throw new Error(desktopPrereqMessage());
  }

  console.log('Building the desktop frontend...');
  await runNodeScript('scripts/frontend-build.mjs');
  console.log('Building the desktop release binary...');
  await runNodeScript('scripts/desktop-build.mjs');
}

async function runProduction() {
  await runNpmCiIfNeeded();
  await ensureModelAssets();
  await stopManagedFrontendIfPresent(ROOT);

  if (!desktopPrereqsAvailable()) {
    throw new Error(desktopPrereqMessage());
  }

  console.log('Building the production desktop bundle...');
  await runNodeScript('scripts/desktop-bundle.mjs');
}

async function main() {
  if (!mode || !['dev', 'build', 'production'].includes(mode)) {
    usage();
    process.exit(1);
  }

  if (dryRun) {
    console.log(`Workflow mode: ${mode}`);
    console.log(`Detected OS: ${OS_LABELS[process.platform] || process.platform}`);
  }

  if (mode === 'dev') {
    await runDev();
    return;
  }

  if (mode === 'build') {
    await runBuild();
    return;
  }

  await runProduction();
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
