import { invoke } from '@tauri-apps/api/core';

import type { TauriFileMetadata } from './scanner';
import type { WatchedFolderRecord } from './db';

type ResolveWatchedFileMetadataOptions = {
  invokeMetadata?: () => Promise<TauriFileMetadata>;
  sleep?: (ms: number) => Promise<void>;
  retryDelaysMs?: number[];
};

const DEFAULT_RETRY_DELAYS_MS = [150, 350, 750, 1500];

function normalizePathForComparison(path: string) {
  return normalizeWatchedEventPath(path).replace(/\\/g, '/').toLowerCase();
}

export function normalizeWatchedEventPath(path: string) {
  return path.replace(/^\\\\\?\\/, '').replace(/^\\\?\\/, '').trim();
}

export function findWatchedFolderForPath(
  path: string,
  watchedFolders: WatchedFolderRecord[]
) {
  const normalizedPath = normalizePathForComparison(path);

  return watchedFolders
    .slice()
    .sort((a, b) => b.path.length - a.path.length)
    .find((folder) => {
      const normalizedFolderPath = normalizePathForComparison(folder.path);
      return (
        normalizedPath === normalizedFolderPath
        || normalizedPath.startsWith(`${normalizedFolderPath}/`)
      );
    });
}

export function shouldResetPageForWatchedAddition(
  existingFile: { path: string } | null | undefined
) {
  return !existingFile;
}

function defaultSleep(ms: number) {
  return new Promise<void>((resolve) => {
    setTimeout(resolve, ms);
  });
}

function isTransientMetadataFailure(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  const normalized = message.toLowerCase();

  return (
    normalized.includes('not a file') ||
    normalized.includes('cannot access the file') ||
    normalized.includes('being used by another process') ||
    normalized.includes('os error 32') ||
    normalized.includes('os error 2') ||
    normalized.includes('could not find') ||
    normalized.includes('the system cannot find the file')
  );
}

export async function resolveWatchedFileMetadata(
  path: string,
  options: ResolveWatchedFileMetadataOptions = {}
) {
  const invokeMetadata =
    options.invokeMetadata ??
    (() => invoke<TauriFileMetadata>('get_file_metadata', { path }));
  const sleep = options.sleep ?? defaultSleep;
  const retryDelaysMs = options.retryDelaysMs ?? DEFAULT_RETRY_DELAYS_MS;

  let lastError: unknown;

  for (let attempt = 0; attempt <= retryDelaysMs.length; attempt += 1) {
    try {
      return await invokeMetadata();
    } catch (error) {
      lastError = error;
      const shouldRetry =
        attempt < retryDelaysMs.length && isTransientMetadataFailure(error);
      if (!shouldRetry) {
        throw error;
      }
      await sleep(retryDelaysMs[attempt]!);
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error(`Failed to read watched file metadata for ${path}`);
}
