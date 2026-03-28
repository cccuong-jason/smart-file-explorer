import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { stopManagedFrontendIfPresent } from './managed-frontend.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const viteCliScript = path.join(ROOT, 'node_modules', 'vite', 'bin', 'vite.js');

function waitForExit(child) {
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

      reject(new Error(`Process exited with code ${code ?? 1}`));
    });

    child.on('error', reject);
  });
}

async function main() {
  await stopManagedFrontendIfPresent(ROOT);

  const child = spawn(process.execPath, [viteCliScript, 'build'], {
    cwd: ROOT,
    stdio: 'inherit',
    env: process.env,
  });

  await waitForExit(child);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
