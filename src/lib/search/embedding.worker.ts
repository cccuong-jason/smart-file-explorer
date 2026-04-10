import { generateEmbedding } from './vector-engine';

self.onmessage = async (event: MessageEvent) => {
  const { type, payload, id } = event.data;

  if (type !== 'EMBED') {
    return;
  }

  try {
    const embedding = await generateEmbedding(payload.text);
    self.postMessage({ type: 'EMBEDDING_RESULT', payload: embedding, id });
  } catch (error: any) {
    self.postMessage({
      type: 'ERROR',
      payload: error?.message ?? 'Embedding worker failed',
      id,
    });
  }
};
