import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/telemetry/logger', () => ({
  logFrontendMessage: vi.fn(),
}));

class MockWorker {
  static instances: MockWorker[] = [];
  messages: Array<{ type: string; payload?: unknown; id: string }> = [];
  onmessage: ((event: MessageEvent) => void) | null = null;
  onerror: ((event: ErrorEvent) => void) | null = null;
  options?: WorkerOptions;

  constructor(_url?: string | URL, options?: WorkerOptions) {
    this.options = options;
    MockWorker.instances.push(this);
  }

  postMessage(message: { type: string; id: string }) {
    this.messages.push(message);
    if (message.type === 'SEARCH') {
      queueMicrotask(() => {
        this.onmessage?.({
          data: {
            type: 'ERROR',
            payload: 'Search worker failed',
            id: message.id,
          },
        } as MessageEvent);
      });
    }
  }
}

describe('search engine worker bridge', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.resetModules();
    MockWorker.instances = [];
  });

  it('rejects pending searches when the worker reports an error', async () => {
    vi.stubGlobal('Worker', MockWorker as unknown as typeof Worker);

    const { searchFiles } = await import('@/lib/search/engine');
    const { logFrontendMessage } = await import('@/lib/telemetry/logger');

    await expect(searchFiles('proposal')).rejects.toThrow('Search worker failed');
    expect(logFrontendMessage).toHaveBeenCalledWith('error', 'Search worker failed', 'search-engine');
  });

  it('creates the search worker as a module worker', async () => {
    vi.stubGlobal('Worker', MockWorker as unknown as typeof Worker);

    const { searchFiles } = await import('@/lib/search/engine');

    await searchFiles('proposal').catch(() => undefined);

    expect(MockWorker.instances[0]?.options).toMatchObject({ type: 'module' });
  });

  it('passes the semantic toggle through to the worker payload', async () => {
    vi.stubGlobal('Worker', MockWorker as unknown as typeof Worker);

    const { searchFiles } = await import('@/lib/search/engine');

    await searchFiles('proposal', { useSemantic: false }).catch(() => undefined);

    expect(MockWorker.instances[0]?.messages[0]?.payload).toMatchObject({
      query: 'proposal',
      useSemantic: false,
    });
  });
});
