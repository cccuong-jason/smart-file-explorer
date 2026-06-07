import { beforeEach, describe, expect, it, vi } from 'vitest';
import { processFile, type TauriFileMetadata } from '@/lib/file-system/scanner';
import { getFile, storeFile, storeFileChunks, storeVisualChunks } from '@/lib/file-system/db';
import { generateEmbeddingInBackground } from '@/lib/search/embedding-engine';
import { generateVisualEmbeddingInBackground } from '@/lib/search/visual-embedding-engine';
import { runLocalOcr } from '@/lib/ocr/ocr-engine';
import { invoke } from '@tauri-apps/api/core';

vi.mock('@/lib/file-system/db', () => ({
  getFile: vi.fn(),
  storeFile: vi.fn(),
  storeFileChunks: vi.fn(),
  storeVisualChunks: vi.fn(),
}));

vi.mock('@/lib/search/embedding-engine', () => ({
  generateEmbeddingInBackground: vi.fn(),
}));

vi.mock('@/lib/search/visual-embedding-engine', () => ({
  generateVisualEmbeddingInBackground: vi.fn(),
}));

vi.mock('@/lib/ocr/ocr-engine', () => ({
  runLocalOcr: vi.fn(),
}));

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(),
}));

const getFileMock = vi.mocked(getFile);
const storeFileMock = vi.mocked(storeFile);
const storeFileChunksMock = vi.mocked(storeFileChunks);
const storeVisualChunksMock = vi.mocked(storeVisualChunks);
const generateEmbeddingMock = vi.mocked(generateEmbeddingInBackground);
const generateVisualEmbeddingMock = vi.mocked(generateVisualEmbeddingInBackground);
const runLocalOcrMock = vi.mocked(runLocalOcr);
const invokeMock = vi.mocked(invoke);

const metadata: TauriFileMetadata = {
  path: '/docs/proposal.docx',
  name: 'proposal.docx',
  size: 4096,
  type: 'application/docx',
  lastModified: 123456,
};

describe('scanner native extraction', () => {
  beforeEach(() => {
    getFileMock.mockReset();
    storeFileMock.mockReset();
    storeFileChunksMock.mockReset();
    storeVisualChunksMock.mockReset();
    generateEmbeddingMock.mockReset();
    generateVisualEmbeddingMock.mockReset();
    runLocalOcrMock.mockReset();
    invokeMock.mockReset();

    getFileMock.mockResolvedValue(undefined);
    generateEmbeddingMock.mockResolvedValue([1, 0, 0]);
    generateVisualEmbeddingMock.mockResolvedValue([0, 1, 0]);
    runLocalOcrMock.mockResolvedValue([]);
    invokeMock.mockImplementation(async (command: string) => {
      if (command === 'extract_document_segments') {
        return [
          {
            text: 'Acme proposal final pricing',
            sourceLabel: 'Paragraph 1',
          },
          {
            text: 'Approved scope and delivery plan.',
            sourceLabel: 'Paragraph 2',
          },
        ];
      }
      return 'Acme proposal final pricing and approved scope.';
    });
  });

  it('uses the native extractor and stores chunked embeddings', async () => {
    await processFile(metadata);

    expect(invokeMock).toHaveBeenCalledWith('extract_document_segments', { path: metadata.path });
    expect(storeFileChunksMock).toHaveBeenCalledTimes(2);
    expect(storeFileChunksMock).toHaveBeenNthCalledWith(
      2,
      metadata.path,
      expect.arrayContaining([
        expect.objectContaining({
          filePath: metadata.path,
          sourceLabel: 'Paragraph 1',
          embedding: [1, 0, 0],
        }),
      ])
    );
    expect(generateEmbeddingMock).toHaveBeenCalled();
    expect(storeFileMock).toHaveBeenLastCalledWith(
      expect.objectContaining({
        path: metadata.path,
        content: 'Acme proposal final pricing\n\nApproved scope and delivery plan.',
        processingStatus: 'completed',
      })
    );
  });

  it('marks scanned files as ocr candidates when extraction returns no text', async () => {
    invokeMock.mockResolvedValueOnce([]);

    await processFile({
      ...metadata,
      path: '/docs/scanned-invoice.pdf',
      name: 'scanned-invoice.pdf',
      type: 'application/pdf',
    });

    expect(storeFileChunksMock).toHaveBeenCalledWith('/docs/scanned-invoice.pdf', []);
    expect(storeFileMock).toHaveBeenLastCalledWith(
      expect.objectContaining({
        path: '/docs/scanned-invoice.pdf',
        processingStatus: 'completed',
        ocrStatus: 'recommended',
      })
    );
  });

  it('runs OCR for scanned files and stores OCR text when available', async () => {
    invokeMock.mockResolvedValueOnce([]);
    runLocalOcrMock.mockResolvedValueOnce([
      {
        text: 'Scanned invoice total due',
        sourceLabel: 'OCR Page 1',
        pageNumber: 1,
      },
    ]);

    await processFile({
      ...metadata,
      path: '/docs/scanned-invoice.pdf',
      name: 'scanned-invoice.pdf',
      type: 'application/pdf',
    });

    expect(runLocalOcrMock).toHaveBeenCalledWith('/docs/scanned-invoice.pdf', 'scanned-invoice.pdf');
    expect(storeFileChunksMock).toHaveBeenLastCalledWith(
      '/docs/scanned-invoice.pdf',
      expect.arrayContaining([
        expect.objectContaining({
          filePath: '/docs/scanned-invoice.pdf',
          sourceLabel: 'OCR Page 1',
          embedding: [1, 0, 0],
        }),
      ])
    );
    expect(storeFileMock).toHaveBeenLastCalledWith(
      expect.objectContaining({
        path: '/docs/scanned-invoice.pdf',
        content: 'Scanned invoice total due',
        ocrStatus: 'completed',
        indexingStage: 'semantic',
      })
    );
  });

  it('stores OCR text chunks and a visual embedding for image files', async () => {
    invokeMock.mockResolvedValueOnce([]);
    runLocalOcrMock.mockResolvedValueOnce([
      {
        text: 'Q4 revenue dashboard',
        sourceLabel: 'OCR Image',
        confidence: 91,
      },
    ]);

    await processFile({
      ...metadata,
      path: '/images/dashboard.png',
      name: 'dashboard.png',
      type: 'image/png',
    });

    expect(generateVisualEmbeddingMock).toHaveBeenCalledWith('/images/dashboard.png', 'dashboard.png');
    expect(storeVisualChunksMock).toHaveBeenCalledWith(
      '/images/dashboard.png',
      expect.arrayContaining([
        expect.objectContaining({
          filePath: '/images/dashboard.png',
          kind: 'image',
          sourceLabel: 'Image content',
          embedding: [0, 1, 0],
          ocrText: 'Q4 revenue dashboard',
          ocrConfidence: 91,
        }),
      ])
    );
    expect(storeFileMock).toHaveBeenLastCalledWith(
      expect.objectContaining({
        path: '/images/dashboard.png',
        ocrStatus: 'completed',
        visualIndexingStage: 'completed',
      })
    );
  });

  it('stores a visual embedding for image files even when OCR finds no text', async () => {
    invokeMock.mockResolvedValueOnce([]);
    runLocalOcrMock.mockResolvedValueOnce([]);

    await processFile({
      ...metadata,
      path: '/images/photo.jpg',
      name: 'photo.jpg',
      type: 'image/jpeg',
    });

    expect(storeVisualChunksMock).toHaveBeenCalledWith(
      '/images/photo.jpg',
      expect.arrayContaining([
        expect.objectContaining({
          filePath: '/images/photo.jpg',
          kind: 'image',
          embedding: [0, 1, 0],
          ocrText: undefined,
        }),
      ])
    );
    expect(storeFileMock).toHaveBeenLastCalledWith(
      expect.objectContaining({
        path: '/images/photo.jpg',
        ocrStatus: 'recommended',
        visualIndexingStage: 'completed',
        indexingStage: 'metadata',
      })
    );
  });
});
