import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const getAllFilesMock = vi.fn();
const getAllChunksMock = vi.fn();
const getAllVisualChunksMock = vi.fn();
const generateEmbeddingMock = vi.fn();
const generateVisualTextEmbeddingMock = vi.fn();

vi.mock('@/lib/file-system/db', () => ({
  getAllFiles: getAllFilesMock,
  getAllChunks: getAllChunksMock,
  getAllVisualChunks: getAllVisualChunksMock,
}));

vi.mock('@/lib/search/vector-engine', () => ({
  generateEmbedding: generateEmbeddingMock,
}));

vi.mock('@/lib/search/visual-vector-engine', () => ({
  generateVisualTextEmbedding: generateVisualTextEmbeddingMock,
}));

describe('search worker multimodal ranking', () => {
  const postMessageMock = vi.fn();

  beforeEach(() => {
    vi.resetModules();
    getAllFilesMock.mockResolvedValue([
      {
        path: '/images/dashboard.png',
        name: 'dashboard.png',
        size: 1024,
        type: 'image/png',
        lastModified: new Date('2026-03-30').getTime(),
      },
    ]);
    getAllChunksMock.mockResolvedValue([]);
    getAllVisualChunksMock.mockResolvedValue([
      {
        id: '/images/dashboard.png::visual::0',
        filePath: '/images/dashboard.png',
        kind: 'image',
        sourceLabel: 'Image content',
        embedding: [0, 1, 0],
        ocrText: 'Q4 revenue dashboard',
        ocrConfidence: 91,
        createdAt: 123456,
      },
    ]);
    generateEmbeddingMock.mockResolvedValue([1, 0, 0]);
    generateVisualTextEmbeddingMock.mockResolvedValue([0, 1, 0]);
    postMessageMock.mockReset();
    (self as any).postMessage = postMessageMock;
  });

  afterEach(() => {
    vi.resetModules();
  });

  it('merges visual semantic signals into worker search results', async () => {
    await import('@/lib/search/search.worker');

    await (self.onmessage as EventListener)({
      data: {
        type: 'SEARCH',
        payload: {
          query: 'dashboard chart',
          useSemantic: true,
        },
        id: 'search-1',
      },
    } as MessageEvent);

    expect(generateVisualTextEmbeddingMock).toHaveBeenCalledWith('dashboard chart');
    expect(postMessageMock).toHaveBeenCalledWith({
      type: 'SEARCH_RESULT',
      id: 'search-1',
      payload: [
        expect.objectContaining({
          file: expect.objectContaining({ path: '/images/dashboard.png' }),
          reasons: expect.arrayContaining(['visual_semantic', 'ocr_text']),
        }),
      ],
    });
  });
});
