import { readLocalFileAsDataUrl } from '../file-system/local-file-data';

let worker: Worker | null = null;
const requestMap = new Map<string, { resolve: (embedding: number[]) => void; reject: (error: Error) => void }>();

function getWorker() {
  if (!worker) {
    worker = new Worker(new URL('./visual-embedding.worker', import.meta.url), { type: 'module' });
    worker.onmessage = (event) => {
      const { type, payload, id } = event.data;
      const handlers = requestMap.get(id);

      if (!handlers) {
        return;
      }

      if (type === 'VISUAL_EMBEDDING_RESULT') {
        handlers.resolve(payload);
        requestMap.delete(id);
        return;
      }

      if (type === 'ERROR') {
        handlers.reject(new Error(payload || 'Visual embedding worker failed'));
        requestMap.delete(id);
      }
    };
    worker.onerror = (event) => {
      const error = event instanceof ErrorEvent
        ? new Error(event.message || 'Visual embedding worker crashed')
        : new Error('Visual embedding worker crashed');

      for (const [, handlers] of requestMap) {
        handlers.reject(error);
      }
      requestMap.clear();
    };
  }

  return worker;
}

export async function generateVisualEmbeddingInBackground(path: string, name?: string): Promise<number[]> {
  const imageDataUrl = await readLocalFileAsDataUrl(path, name);

  return new Promise((resolve, reject) => {
    const id = crypto.randomUUID();
    requestMap.set(id, { resolve, reject });
    getWorker().postMessage({ type: 'VISUAL_EMBED', payload: { imageDataUrl }, id });
  });
}
