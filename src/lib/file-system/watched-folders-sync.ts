import { invoke } from '@tauri-apps/api/core';

import type { WatchedFolderRecord } from './db';

type SyncWatchedFoldersOptions = {
  saveNativeFolder?: (folder: WatchedFolderRecord) => Promise<unknown>;
  startNativeWatchers?: () => Promise<unknown>;
};

type NativeWatchStateSnapshot = {
  watchedFolders: Array<{ path: string; enabled: boolean; status: string }>;
  activeRoots: string[];
};

type NativeWatchSyncSnapshot = {
  watchedFolders: Array<{ path: string; enabled: boolean; status: string }>;
  activeRoots: string[];
};

type InspectNativeWatchedFoldersOptions = {
  inspectNativeState?: () => Promise<NativeWatchStateSnapshot>;
};

export async function syncNativeWatchedFolders(
  folders: WatchedFolderRecord[],
  options: SyncWatchedFoldersOptions = {}
) {
  const saveNativeFolder =
    options.saveNativeFolder ??
    ((folder: WatchedFolderRecord) => invoke('save_watched_folder', { folder }));
  const startNativeWatchers =
    options.startNativeWatchers ??
    (() => invoke('start_native_watchers'));

  for (const folder of folders) {
    await saveNativeFolder(folder);
  }

  await startNativeWatchers();
}

function normalizePath(path: string) {
  return path.replace(/\\/g, '/');
}

function comparePaths(a: string, b: string) {
  return normalizePath(a).localeCompare(normalizePath(b));
}

function buildEffectiveWatchRoots(folders: Array<{ path: string; enabled: boolean }>) {
  const enabledPaths = folders
    .filter((folder) => folder.enabled)
    .map((folder) => normalizePath(folder.path))
    .sort(comparePaths);

  const roots: string[] = [];

  for (const path of enabledPaths) {
    if (roots.some((root) => path === root || path.startsWith(`${root}/`))) {
      continue;
    }

    for (let index = roots.length - 1; index >= 0; index -= 1) {
      if (roots[index]!.startsWith(`${path}/`)) {
        roots.splice(index, 1);
      }
    }

    roots.push(path);
  }

  return roots;
}

export function buildNativeWatchSyncSnapshot(
  folders: WatchedFolderRecord[]
): NativeWatchSyncSnapshot {
  const watchedFolders = folders
    .map((folder) => ({
      path: normalizePath(folder.path),
      enabled: folder.enabled,
      status: folder.status,
    }))
    .sort((a, b) => comparePaths(a.path, b.path));

  return {
    watchedFolders,
    activeRoots: buildEffectiveWatchRoots(watchedFolders),
  };
}

export function shouldSyncNativeWatchedFolders(
  folders: WatchedFolderRecord[],
  snapshot: NativeWatchStateSnapshot | null
) {
  if (!snapshot) {
    return true;
  }

  const localSnapshot = buildNativeWatchSyncSnapshot(folders);
  const nativeSnapshot = {
    watchedFolders: snapshot.watchedFolders
      .map((folder) => ({
        path: normalizePath(folder.path),
        enabled: folder.enabled,
        status: folder.status,
      }))
      .sort((a, b) => comparePaths(a.path, b.path)),
    activeRoots: [...snapshot.activeRoots].map(normalizePath).sort(comparePaths),
  };

  return JSON.stringify(localSnapshot) !== JSON.stringify(nativeSnapshot);
}

function isCommandNotFoundError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  return message.includes('Command inspect_native_watch_state not found');
}

export async function inspectNativeWatchedFolders(
  options: InspectNativeWatchedFoldersOptions = {}
) {
  const inspectNativeState =
    options.inspectNativeState ??
    (() => invoke<NativeWatchStateSnapshot>('inspect_native_watch_state'));

  try {
    return await inspectNativeState();
  } catch (error) {
    if (isCommandNotFoundError(error)) {
      return null;
    }
    throw error;
  }
}
