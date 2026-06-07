import {
  AutoProcessor,
  AutoTokenizer,
  CLIPTextModelWithProjection,
  CLIPVisionModelWithProjection,
  RawImage,
  env,
} from '@xenova/transformers';

const allowRemoteModels = import.meta.env.VITE_ALLOW_REMOTE_MODELS === 'true';
const localModelPath = import.meta.env.VITE_MODEL_PATH ?? '/models/';
const visualModel = import.meta.env.VITE_VISUAL_MODEL ?? 'Xenova/clip-vit-base-patch32';

env.allowLocalModels = true;
env.allowRemoteModels = allowRemoteModels;
env.localModelPath = localModelPath;

let tokenizerPromise: Promise<any> | null = null;
let processorPromise: Promise<any> | null = null;
let textModelPromise: Promise<any> | null = null;
let visionModelPromise: Promise<any> | null = null;

function normalizeVector(values: number[]) {
  const magnitude = Math.sqrt(values.reduce((sum, value) => sum + value * value, 0));
  if (magnitude === 0) {
    return values;
  }
  return values.map((value) => value / magnitude);
}

function tensorToVector(output: any, keys: string[]) {
  const tensor = keys.map((key) => output?.[key]).find(Boolean) ?? output;
  const values = Array.from(tensor?.data ?? tensor ?? []) as number[];
  return normalizeVector(values);
}

async function getTokenizer() {
  tokenizerPromise ??= AutoTokenizer.from_pretrained(visualModel, {
    local_files_only: !env.allowRemoteModels,
  });
  return tokenizerPromise;
}

async function getProcessor() {
  processorPromise ??= AutoProcessor.from_pretrained(visualModel, {
    local_files_only: !env.allowRemoteModels,
  });
  return processorPromise;
}

async function getTextModel() {
  textModelPromise ??= CLIPTextModelWithProjection.from_pretrained(visualModel, {
    local_files_only: !env.allowRemoteModels,
  });
  return textModelPromise;
}

async function getVisionModel() {
  visionModelPromise ??= CLIPVisionModelWithProjection.from_pretrained(visualModel, {
    local_files_only: !env.allowRemoteModels,
  });
  return visionModelPromise;
}

export async function generateVisualTextEmbedding(text: string): Promise<number[]> {
  const [tokenizer, model] = await Promise.all([getTokenizer(), getTextModel()]);
  const inputs = tokenizer(text, { padding: true, truncation: true });
  const output = await model(inputs);
  return tensorToVector(output, ['text_embeds', 'pooler_output']);
}

export async function generateVisualImageEmbedding(imageDataUrl: string): Promise<number[]> {
  const [processor, model] = await Promise.all([getProcessor(), getVisionModel()]);
  const image = await RawImage.read(imageDataUrl);
  const inputs = await processor(image);
  const output = await model(inputs);
  return tensorToVector(output, ['image_embeds', 'pooler_output']);
}
