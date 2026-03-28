import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const DIST_INDEX = path.join(ROOT, 'dist', 'index.html');

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
  if (!fs.existsSync(DIST_INDEX)) {
    await waitForExit(
      spawn(process.execPath, [path.join(ROOT, 'scripts', 'frontend-build.mjs')], {
        cwd: ROOT,
        stdio: 'inherit',
        env: process.env,
      }),
    );
  }

  const child = spawn(process.execPath, [path.join(ROOT, 'scripts', 'preview-static.mjs')], {
    cwd: ROOT,
    stdio: 'inherit',
    env: {
      ...process.env,
      PORT: '3001',
    },
  });

  child.on('exit', (code, signal) => {
    if (signal) {
      process.kill(process.pid, signal);
      return;
    }

    process.exit(code ?? 1);
  });

  child.on('error', (error) => {
    console.error(error);
    process.exit(1);
  });
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
