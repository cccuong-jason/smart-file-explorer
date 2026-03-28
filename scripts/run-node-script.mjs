import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const [scriptPath, ...args] = process.argv.slice(2);

if (!scriptPath) {
  console.error('Usage: node scripts/run-node-script.mjs <script-path> [args...]');
  process.exit(1);
}

const resolvedScriptPath = path.resolve(ROOT, scriptPath);
const child = spawn(process.execPath, [resolvedScriptPath, ...args], {
  cwd: ROOT,
  stdio: 'inherit',
  env: process.env,
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
