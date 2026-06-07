import { describe, expect, it, vi } from 'vitest';

import {
  findWatchedFolderForPath,
  normalizeWatchedEventPath,
  resolveWatchedFileMetadata,
  shouldResetPageForWatchedAddition,
} from '@/lib/file-system/watch-events';
import type { TauriFileMetadata } from '@/lib/file-system/scanner';
import type { WatchedFolderRecord } from '@/lib/file-system/db';

const sampleMetadata: TauriFileMetadata = {
  path: 'C:/Users/jason/Downloads/proposal.pdf',
  name: 'proposal.pdf',
  size: 1024,
  type: 'application/pdf',
  lastModified: 123,
};

describe('watched file events', () => {
  it('normalizes Windows device-prefixed event paths before matching watched folders', () => {
    const watchedFolders: WatchedFolderRecord[] = [
      {
        path: 'C:\\Users\\jason\\Downloads',
        enabled: true,
        status: 'watching',
      },
    ];

    expect(normalizeWatchedEventPath('\\\\?\\C:\\Users\\jason\\Downloads\\proposal.doc')).toBe(
      'C:\\Users\\jason\\Downloads\\proposal.doc'
    );
    expect(
      findWatchedFolderForPath(
        '\\\\?\\C:\\Users\\jason\\Downloads\\proposal.doc',
        watchedFolders
      )?.path
    ).toBe('C:\\Users\\jason\\Downloads');
  });

  it('resets pagination only for brand-new watched file additions', () => {
    expect(shouldResetPageForWatchedAddition(undefined)).toBe(true);
    expect(shouldResetPageForWatchedAddition(null)).toBe(true);
    expect(
      shouldResetPageForWatchedAddition({
        path: 'C:/Users/jason/Downloads/proposal.doc',
      })
    ).toBe(false);
  });

  it('retries transient metadata failures before succeeding', async () => {
    const invokeMetadata = vi
      .fn<() => Promise<TauriFileMetadata>>()
      .mockRejectedValueOnce(new Error('Not a file'))
      .mockRejectedValueOnce(new Error('The process cannot access the file'))
      .mockResolvedValue(sampleMetadata);
    const sleep = vi.fn(async () => undefined);

    await expect(
      resolveWatchedFileMetadata('C:/Users/jason/Downloads/proposal.pdf', {
        invokeMetadata,
        sleep,
        retryDelaysMs: [1, 1, 1],
      })
    ).resolves.toEqual(sampleMetadata);

    expect(invokeMetadata).toHaveBeenCalledTimes(3);
    expect(sleep).toHaveBeenCalledTimes(2);
  });

  it('does not retry unsupported permanent metadata failures', async () => {
    const invokeMetadata = vi
      .fn<() => Promise<TauriFileMetadata>>()
      .mockRejectedValue(new Error('Unsupported file type'));
    const sleep = vi.fn(async () => undefined);

    await expect(
      resolveWatchedFileMetadata('C:/Users/jason/Downloads/proposal.pdf', {
        invokeMetadata,
        sleep,
        retryDelaysMs: [1, 1, 1],
      })
    ).rejects.toThrow('Unsupported file type');

    expect(invokeMetadata).toHaveBeenCalledTimes(1);
    expect(sleep).not.toHaveBeenCalled();
  });
});
