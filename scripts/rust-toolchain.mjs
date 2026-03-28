import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

export function getTrustedWorkspaceRoot(projectRoot) {
  if (process.env.SMART_FILE_EXPLORER_TAURI_TMP) {
    return path.resolve(process.env.SMART_FILE_EXPLORER_TAURI_TMP);
  }

  if (process.platform === 'win32' && projectRoot) {
    const normalizedRoot = path.resolve(projectRoot);
    const projectDrive = path.parse(normalizedRoot).root.toLowerCase();
    const systemDrive = path.parse(process.env.SystemRoot ?? 'C:\\Windows').root.toLowerCase();

    if (projectDrive && projectDrive !== systemDrive) {
      return path.join(normalizedRoot, '.smart-file-explorer-workspaces');
    }
  }

  return process.platform === 'win32'
    ? path.join(process.env.LOCALAPPDATA ?? path.join(os.homedir(), 'AppData', 'Local'), 'smart-file-explorer-workspaces')
    : os.tmpdir();
}

export function getRustupCommand() {
  return process.platform === 'win32'
    ? path.join(process.env.USERPROFILE ?? os.homedir(), '.cargo', 'bin', 'rustup.exe')
    : 'rustup';
}

export function getCargoCommand() {
  return process.platform === 'win32'
    ? resolveRustupToolPath('cargo')
    : 'cargo';
}

export function getRustToolEnv() {
  if (process.platform !== 'win32') {
    return {};
  }

  const cargoPath = resolveRustupToolPath('cargo');
  const toolchainBin = path.dirname(cargoPath);

  return {
    CARGO: cargoPath,
    PATH: [toolchainBin, process.env.PATH ?? ''].filter(Boolean).join(path.delimiter),
    RUSTC: resolveRustupToolPath('rustc'),
    RUSTDOC: resolveRustupToolPath('rustdoc'),
  };
}

function resolveRustupToolPath(tool) {
  const result = spawnSync(getRustupCommand(), ['which', tool, '--toolchain', 'stable'], {
    encoding: 'utf8',
    env: process.env,
    windowsHide: true,
  });

  const resolvedPath = result.stdout?.trim() ?? '';
  if (result.status === 0 && resolvedPath) {
    return resolvedPath;
  }

  const fallbackPath = resolveRustupToolPathFromFilesystem(tool);
  if (fallbackPath) {
    return fallbackPath;
  }

  const detail = [result.stderr, result.stdout].filter(Boolean).join('\n').trim();
  throw new Error(
    `Failed to resolve the stable Rust toolchain ${tool} binary.${detail ? `\n${detail}` : ''}`,
  );
}

function resolveRustupToolPathFromFilesystem(tool) {
  const rustupHome = process.env.RUSTUP_HOME ?? path.join(os.homedir(), '.rustup');
  const toolchainsDir = path.join(rustupHome, 'toolchains');
  if (!fs.existsSync(toolchainsDir)) {
    return null;
  }

  const executable = process.platform === 'win32' ? `${tool}.exe` : tool;
  const candidates = fs
    .readdirSync(toolchainsDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && entry.name.startsWith('stable'))
    .map((entry) => path.join(toolchainsDir, entry.name, 'bin', executable))
    .filter((candidate) => fs.existsSync(candidate))
    .sort((left, right) => right.localeCompare(left));

  return candidates[0] ?? null;
}
