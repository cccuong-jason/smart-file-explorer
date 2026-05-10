import { describe, expect, it, vi } from 'vitest';

import {
  buildNativeWatchSyncSnapshot,
  inspectNativeWatchedFolders,
  shouldSyncNativeWatchedFolders,
  syncNativeWatchedFolders,
} from '@/lib/file-system/watched-folders-sync';

describe('watched folder sync', () => {
  it('pushes local watched folders into the native registry before starting watchers', async () => {
    const saveNativeFolder = vi.fn(async () => undefined);
    const startNativeWatchers = vi.fn(async () => undefined);

    await syncNativeWatchedFolders(
      [
        {
          path: 'C:/Users/jason/Documents/Acme',
          enabled: true,
          status: 'watching',
          lastScanStartedAt: 1,
        },
        {
          path: 'C:/Users/jason/Documents/Acme/Subfolder',
          enabled: false,
          status: 'paused',
        },
      ],
      { saveNativeFolder, startNativeWatchers }
    );

    expect(saveNativeFolder).toHaveBeenCalledTimes(2);
    expect(saveNativeFolder).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        path: 'C:/Users/jason/Documents/Acme',
        enabled: true,
      })
    );
    expect(startNativeWatchers).toHaveBeenCalledOnce();
  });

  it('treats missing native inspect support as a non-fatal compatibility gap', async () => {
    const inspectNativeState = vi
      .fn()
      .mockRejectedValue(new Error('Command inspect_native_watch_state not found'));

    await expect(
      inspectNativeWatchedFolders({ inspectNativeState })
    ).resolves.toBeNull();
  });

  it('skips native resync when the effective local and native watch snapshots already match', () => {
    const localFolders = [
      {
        path: 'C:/Users/jason/Documents/Acme',
        enabled: true,
        status: 'watching' as const,
      },
      {
        path: 'C:/Users/jason/Documents/Acme/Subfolder',
        enabled: true,
        status: 'watching' as const,
      },
    ];
    const nativeSnapshot = {
      watchedFolders: [
        {
          path: 'C:/Users/jason/Documents/Acme',
          enabled: true,
          status: 'watching',
        },
        {
          path: 'C:/Users/jason/Documents/Acme/Subfolder',
          enabled: true,
          status: 'watching',
        },
      ],
      activeRoots: ['C:/Users/jason/Documents/Acme'],
    };

    expect(buildNativeWatchSyncSnapshot(localFolders)).toEqual({
      watchedFolders: [
        { path: 'C:/Users/jason/Documents/Acme', enabled: true, status: 'watching' },
        { path: 'C:/Users/jason/Documents/Acme/Subfolder', enabled: true, status: 'watching' },
      ],
      activeRoots: ['C:/Users/jason/Documents/Acme'],
    });
    expect(shouldSyncNativeWatchedFolders(localFolders, nativeSnapshot)).toBe(false);
  });

  it('requires native resync when local watched folders materially differ from native state', () => {
    const localFolders = [
      {
        path: 'C:/Users/jason/Documents/Acme',
        enabled: false,
        status: 'paused' as const,
      },
    ];
    const nativeSnapshot = {
      watchedFolders: [
        {
          path: 'C:/Users/jason/Documents/Acme',
          enabled: true,
          status: 'watching',
        },
      ],
      activeRoots: ['C:/Users/jason/Documents/Acme'],
    };

    expect(shouldSyncNativeWatchedFolders(localFolders, nativeSnapshot)).toBe(true);
  });
});
