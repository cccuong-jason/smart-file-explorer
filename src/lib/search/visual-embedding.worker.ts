import { generateVisualImageEmbedding } from './visual-vector-engine';

self.onmessage = async (event: MessageEvent) => {
  const { type, payload, id } = event.data;

  if (type !== 'VISUAL_EMBED') {
    return;
  }

  try {
    const embedding = await generateVisualImageEmbedding(payload.imageDataUrl);
    self.postMessage({ type: 'VISUAL_EMBEDDING_RESULT', payload: embedding, id });
  } catch (error: any) {
    self.postMessage({
      type: 'ERROR',
      payload: error?.message ?? 'Visual embedding worker failed',
      id,
    });
  }
};
