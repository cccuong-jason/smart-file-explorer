import { beforeEach, describe, expect, it, vi } from 'vitest';
import { save } from '@tauri-apps/plugin-dialog';
import { writeTextFile } from '@tauri-apps/plugin-fs';
import {
  clearDatabase,
  exportIndexToJSON,
  getAllFiles,
  getFile,
  removeFileTag,
  storeFile,
  toggleFileStar,
  addFileTag,
  deleteFile,
} from '@/lib/file-system/db';

const saveMock = vi.mocked(save);
const writeTextFileMock = vi.mocked(writeTextFile);

const sampleFile = {
  processingStatus: 'completed' as const,
  path: '/docs/spec.md',
  name: 'spec.md',
  size: 1024,
  type: 'text/markdown',
  lastModified: 123456,
  content: '# spec',
  embedding: [1, 0, 0],
  tags: [],
  isStarred: false,
};

describe('file database operations', () => {
  beforeEach(async () => {
    indexedDB.deleteDatabase('smart-file-explorer-db');
    localStorage.clear();
    saveMock.mockReset();
    writeTextFileMock.mockReset();
    await clearDatabase().catch(() => undefined);
  });

  it('stores and fetches files by path', async () => {
    await storeFile(sampleFile);

    await expect(getFile(sampleFile.path)).resolves.toMatchObject(sampleFile);
    await expect(getAllFiles()).resolves.toHaveLength(1);
  });

  it('toggles favorites and manages tags', async () => {
    await storeFile(sampleFile);

    await expect(toggleFileStar(sampleFile.path)).resolves.toBe(true);
    await expect(addFileTag(sampleFile.path, 'work')).resolves.toEqual(['work']);
    await expect(addFileTag(sampleFile.path, 'work')).resolves.toEqual(['work']);
    await expect(removeFileTag(sampleFile.path, 'work')).resolves.toEqual([]);
  });

  it('returns safe defaults for missing files and missing tag collections', async () => {
    await storeFile({ ...sampleFile, path: '/docs/no-tags.md', tags: undefined });

    await expect(toggleFileStar('/missing')).resolves.toBe(false);
    await expect(addFileTag('/missing', 'tag')).resolves.toEqual([]);
    await expect(removeFileTag('/missing', 'tag')).resolves.toEqual([]);
    await expect(removeFileTag('/docs/no-tags.md', 'tag')).resolves.toEqual([]);
  });

  it('exports the current index to JSON when a save path is chosen', async () => {
    await storeFile(sampleFile);
    saveMock.mockResolvedValue('C:/tmp/export.json');

    await expect(exportIndexToJSON()).resolves.toBe(1);
    expect(writeTextFileMock).toHaveBeenCalledOnce();
  });

  it('skips file writing when export is cancelled', async () => {
    await storeFile(sampleFile);
    saveMock.mockResolvedValue(null);

    await expect(exportIndexToJSON()).resolves.toBe(1);
    expect(writeTextFileMock).not.toHaveBeenCalled();
  });

  it('clears and deletes files safely', async () => {
    await storeFile(sampleFile);
    await deleteFile(sampleFile.path);
    await expect(getAllFiles()).resolves.toEqual([]);

    await storeFile(sampleFile);
    await clearDatabase();
    await expect(getAllFiles()).resolves.toEqual([]);
  });
});
