import fs from 'node:fs/promises';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { getTrustedWorkspaceRoot } from './rust-toolchain.mjs';

function getManagedFrontendPidPath(projectRoot) {
  return path.join(getTrustedWorkspaceRoot(projectRoot), 'frontend-dev.pid');
}

async function readManagedFrontendPid(pidPath) {
  try {
    const raw = await fs.readFile(pidPath, 'utf8');
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

async function removeFileIfPresent(filePath) {
  await fs.rm(filePath, { force: true }).catch(() => {});
}

export async function stopManagedFrontendIfPresent(projectRoot) {
  const pidPath = getManagedFrontendPidPath(projectRoot);
  const managedPid = await readManagedFrontendPid(pidPath);

  if (managedPid && processIsRunning(managedPid)) {
    if (process.platform === 'win32') {
      await waitForExit(
        spawn('taskkill.exe', ['/PID', String(managedPid), '/T', '/F'], {
          stdio: 'inherit',
        }),
      );
    } else {
      process.kill(managedPid, 'SIGTERM');
    }
  }

  await removeFileIfPresent(pidPath);
}
