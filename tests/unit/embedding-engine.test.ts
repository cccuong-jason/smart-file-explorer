import { afterEach, describe, expect, it, vi } from 'vitest';

class MockEmbeddingWorker {
  static instances: MockEmbeddingWorker[] = [];
  onmessage: ((event: MessageEvent) => void) | null = null;
  onerror: ((event: ErrorEvent) => void) | null = null;
  options?: WorkerOptions;

  constructor(_url?: string | URL, options?: WorkerOptions) {
    this.options = options;
    MockEmbeddingWorker.instances.push(this);
  }

  postMessage(message: { type: string; payload: { text: string }; id: string }) {
    if (message.type === 'EMBED') {
      queueMicrotask(() => {
        this.onmessage?.({
          data: {
            type: 'EMBEDDING_RESULT',
            payload: [message.payload.text.length / 10],
            id: message.id,
          },
        } as MessageEvent);
      });
    }
  }
}

describe('embedding engine worker bridge', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.resetModules();
    MockEmbeddingWorker.instances = [];
  });

  it('runs background embeddings through a module worker', async () => {
    vi.stubGlobal('Worker', MockEmbeddingWorker as unknown as typeof Worker);

    const { generateEmbeddingInBackground } = await import('@/lib/search/embedding-engine');

    await expect(generateEmbeddingInBackground('cpu')).resolves.toEqual([0.3]);
    expect(MockEmbeddingWorker.instances[0]?.options).toMatchObject({ type: 'module' });
  });
});
