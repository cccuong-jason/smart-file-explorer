import { beforeEach, describe, expect, it, vi } from 'vitest';
import { save } from '@tauri-apps/plugin-dialog';
import { writeTextFile } from '@tauri-apps/plugin-fs';
import {
  clearDatabase,
  exportIndexToJSON,
  getAllFiles,
  getAllChunks,
  getOcrCandidateCount,
  getWatchedFolders,
  getWorkspaceAiSummary,
  getFileChunks,
  getFile,
  removeWatchedFolder,
  removeFileTag,
  saveWatchedFolder,
  setWatchedFolderEnabled,
  setWatchedFolderStatus,
  storeWorkspaceAiSummary,
  storeFile,
  storeFileChunks,
  toggleFileStar,
  addFileTag,
  deleteFile,
  deleteWorkspaceAiSummary,
} from '@/lib/file-system/db';

const saveMock = vi.mocked(save);
const writeTextFileMock = vi.mocked(writeTextFile);

const sampleFile = {
  processingStatus: 'completed' as const,
  indexingStage: 'semantic' as const,
  path: '/docs/spec.md',
  name: 'spec.md',
  size: 1024,
  type: 'text/markdown',
  lastModified: 123456,
  group: 'documents' as const,
  subtype: 'text' as const,
  content: '# spec',
  embedding: [1, 0, 0],
  tags: [],
  isStarred: false,
};

const sampleChunks = [
  {
    id: `${sampleFile.path}::0`,
    filePath: sampleFile.path,
    index: 0,
    text: 'Acme proposal with pricing',
    embedding: [1, 0, 0],
  },
  {
    id: `${sampleFile.path}::1`,
    filePath: sampleFile.path,
    index: 1,
    text: 'Final scope and timeline',
    embedding: [0.7, 0.3, 0],
  },
];

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
    await storeFileChunks(sampleFile.path, sampleChunks);
    await deleteFile(sampleFile.path);
    await expect(getAllFiles()).resolves.toEqual([]);
    await expect(getFileChunks(sampleFile.path)).resolves.toEqual([]);

    await storeFile(sampleFile);
    await storeFileChunks(sampleFile.path, sampleChunks);
    await clearDatabase();
    await expect(getAllFiles()).resolves.toEqual([]);
    await expect(getAllChunks()).resolves.toEqual([]);
  });

  it('stores and replaces chunks for a file', async () => {
    await storeFileChunks(sampleFile.path, sampleChunks);
    await expect(getFileChunks(sampleFile.path)).resolves.toHaveLength(2);

    await storeFileChunks(sampleFile.path, [sampleChunks[0]]);

    await expect(getFileChunks(sampleFile.path)).resolves.toEqual([sampleChunks[0]]);
  });

  it('counts files that are waiting on OCR', async () => {
    await storeFile({ ...sampleFile, path: '/docs/scan1.pdf', ocrStatus: 'recommended' });
    await storeFile({ ...sampleFile, path: '/docs/scan2.png', ocrStatus: 'recommended' });
    await storeFile({ ...sampleFile, path: '/docs/scan3.pdf', ocrStatus: 'processing' as any });
    await storeFile({ ...sampleFile, path: '/docs/scan4.pdf', ocrStatus: 'completed' as any });
    await storeFile({ ...sampleFile, path: '/docs/notes.md' });

    await expect(getOcrCandidateCount()).resolves.toBe(3);
  });

  it('stores and clears cached workspace AI summaries', async () => {
    await storeWorkspaceAiSummary({
      workspaceId: 'workspace-1',
      fingerprint: 'fp-1',
      title: 'Acme Renewal Workspace',
      summary: 'The proposal and pricing workbook are driving this renewal.',
      highlights: ['Proposal-final.docx is the decision-driving document.'],
      rationale: ['Latest proposal is starred and recently updated.'],
      model: 'qwen/qwen3.6-plus:free',
      updatedAt: 123456,
    });

    await expect(getWorkspaceAiSummary('workspace-1')).resolves.toMatchObject({
      workspaceId: 'workspace-1',
      fingerprint: 'fp-1',
      model: 'qwen/qwen3.6-plus:free',
    });

    await deleteWorkspaceAiSummary('workspace-1');
    await expect(getWorkspaceAiSummary('workspace-1')).resolves.toBeUndefined();

    await storeWorkspaceAiSummary({
      workspaceId: 'workspace-1',
      fingerprint: 'fp-1',
      title: 'Acme Renewal Workspace',
      summary: 'The proposal and pricing workbook are driving this renewal.',
      highlights: ['Proposal-final.docx is the decision-driving document.'],
      rationale: ['Latest proposal is starred and recently updated.'],
      model: 'qwen/qwen3.6-plus:free',
      updatedAt: 123456,
    });

    await clearDatabase();

    await expect(getWorkspaceAiSummary('workspace-1')).resolves.toBeUndefined();
  });

  it('stores, updates, and removes watched folders', async () => {
    await saveWatchedFolder({
      path: 'C:/Users/jason/Documents/Acme',
      enabled: true,
      status: 'watching',
      lastScanStartedAt: 100,
      lastScanCompletedAt: 200,
    });

    await saveWatchedFolder({
      path: 'C:/Users/jason/Documents/Acme/Subfolder',
      enabled: false,
      status: 'idle',
    });

    await expect(getWatchedFolders()).resolves.toEqual([
      expect.objectContaining({
        path: 'C:/Users/jason/Documents/Acme',
        enabled: true,
        status: 'watching',
        lastScanStartedAt: 100,
        lastScanCompletedAt: 200,
      }),
      expect.objectContaining({
        path: 'C:/Users/jason/Documents/Acme/Subfolder',
        enabled: false,
        status: 'idle',
      }),
    ]);

    await setWatchedFolderEnabled('C:/Users/jason/Documents/Acme/Subfolder', true);
    await setWatchedFolderStatus('C:/Users/jason/Documents/Acme/Subfolder', {
      status: 'indexing',
      lastScanStartedAt: 300,
    });

    await expect(getWatchedFolders()).resolves.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          path: 'C:/Users/jason/Documents/Acme/Subfolder',
          enabled: true,
          status: 'indexing',
          lastScanStartedAt: 300,
        }),
      ])
    );

    await removeWatchedFolder('C:/Users/jason/Documents/Acme');
    await expect(getWatchedFolders()).resolves.toEqual([
      expect.objectContaining({
        path: 'C:/Users/jason/Documents/Acme/Subfolder',
      }),
    ]);
  });
});
