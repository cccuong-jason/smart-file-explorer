import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const args = process.argv.slice(2);

if (args.length === 0) {
  console.error('Usage: node scripts/tauri-cli.mjs <tauri-args...>');
  process.exit(1);
}

const env = {
  ...process.env,
  TAURI_FRONTEND_PATH: ROOT,
  TAURI_APP_PATH: path.join(ROOT, 'src-tauri'),
};

const child = process.platform === 'win32'
  ? spawn(
      `"${path.join(ROOT, 'node_modules', '.bin', 'tauri.cmd')}" ${args
        .map((arg) => (arg.includes(' ') ? `"${arg}"` : arg))
        .join(' ')}`,
      [],
      {
        cwd: ROOT,
        stdio: 'inherit',
        env,
        shell: true,
      },
    )
  : spawn(path.join(ROOT, 'node_modules', '.bin', 'tauri'), args, {
      cwd: ROOT,
      stdio: 'inherit',
      env,
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
