let worker: Worker | null = null;
const requestMap = new Map<string, { resolve: (embedding: number[]) => void; reject: (error: Error) => void }>();

function getWorker() {
  if (!worker) {
    worker = new Worker(new URL('./embedding.worker', import.meta.url), { type: 'module' });
    worker.onmessage = (event) => {
      const { type, payload, id } = event.data;
      const handlers = requestMap.get(id);

      if (!handlers) {
        return;
      }

      if (type === 'EMBEDDING_RESULT') {
        handlers.resolve(payload);
        requestMap.delete(id);
        return;
      }

      if (type === 'ERROR') {
        handlers.reject(new Error(payload || 'Embedding worker failed'));
        requestMap.delete(id);
      }
    };
    worker.onerror = (event) => {
      const error = event instanceof ErrorEvent
        ? new Error(event.message || 'Embedding worker crashed')
        : new Error('Embedding worker crashed');

      for (const [, handlers] of requestMap) {
        handlers.reject(error);
      }
      requestMap.clear();
    };
  }

  return worker;
}

export async function generateEmbeddingInBackground(text: string): Promise<number[]> {
  return new Promise((resolve, reject) => {
    const id = crypto.randomUUID();
    requestMap.set(id, { resolve, reject });
    getWorker().postMessage({ type: 'EMBED', payload: { text }, id });
  });
}
