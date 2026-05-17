import type { Worker as TesseractJsWorker } from 'tesseract.js';
import workerUrl from 'tesseract.js/dist/worker.min.js?url';
import pdfWorkerUrl from 'pdfjs-dist/legacy/build/pdf.worker.min.mjs?url';
import {
  readLocalFileAsDataUrl,
  readLocalFileBytes,
} from '../file-system/local-file-data';

export interface OcrSegment {
  text: string;
  sourceLabel?: string;
  pageNumber?: number;
  confidence?: number;
}

const OCR_IMAGE_EXTENSIONS = new Set(['png', 'jpg', 'jpeg', 'gif', 'bmp', 'webp']);
const OCR_PDF_EXTENSIONS = new Set(['pdf']);
const PDF_RENDER_SCALE = 1.5;
const MAX_OCR_PAGES = 8;
const OCR_CANVAS_BORDER = 24;
const TESSERACT_CORE_PATH = 'https://cdn.jsdelivr.net/npm/tesseract.js-core@7.0.0';
const TESSERACT_LANG_PATH = 'https://tessdata.projectnaptha.com/4.0.0';

let workerPromise: Promise<TesseractJsWorker> | null = null;

function getExtension(name: string) {
  return name.split('.').pop()?.toLowerCase() ?? '';
}

function normalizeOcrText(text: string | undefined) {
  return (text ?? '').replace(/\s+/g, ' ').trim();
}

async function getWorker(): Promise<TesseractJsWorker> {
  if (!workerPromise) {
    workerPromise = import('tesseract.js').then(async ({ createWorker }) => {
      const worker = await createWorker('eng+vie', 1, {
        workerPath: workerUrl,
        corePath: TESSERACT_CORE_PATH,
        langPath: TESSERACT_LANG_PATH,
      });

      await worker.setParameters({
        preserve_interword_spaces: '1',
        user_defined_dpi: '300',
      });

      return worker;
    });
  }

  return workerPromise;
}

async function loadPdfJs() {
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  pdfjs.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;
  return pdfjs;
}

async function recognizeImageAsset(assetUrl: string) {
  const worker = await getWorker();
  const result = await worker.recognize(await preprocessImageForOcr(assetUrl));
  return {
    text: normalizeOcrText(result?.data?.text),
    confidence: result?.data?.confidence,
  };
}

function enhanceImageDataForOcr(imageData: ImageData) {
  const data = imageData.data;

  for (let index = 0; index < data.length; index += 4) {
    const luminance = (data[index] * 0.299) + (data[index + 1] * 0.587) + (data[index + 2] * 0.114);
    const contrasted = Math.min(255, Math.max(0, (luminance - 128) * 1.35 + 128));
    const thresholded = contrasted > 178 ? 255 : contrasted < 92 ? 0 : contrasted;

    data[index] = thresholded;
    data[index + 1] = thresholded;
    data[index + 2] = thresholded;
    data[index + 3] = 255;
  }

  return imageData;
}

async function preprocessImageForOcr(assetUrl: string) {
  if (typeof fetch !== 'function' || typeof createImageBitmap !== 'function') {
    return assetUrl;
  }

  try {
    const response = await fetch(assetUrl);
    const bitmap = await createImageBitmap(await response.blob());
    const scale = Math.min(2, Math.max(1, 1200 / Math.max(bitmap.width, bitmap.height)));
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');

    if (!context) {
      return assetUrl;
    }

    canvas.width = Math.ceil(bitmap.width * scale) + OCR_CANVAS_BORDER * 2;
    canvas.height = Math.ceil(bitmap.height * scale) + OCR_CANVAS_BORDER * 2;

    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.filter = 'grayscale(1) contrast(1.35)';
    context.drawImage(
      bitmap,
      OCR_CANVAS_BORDER,
      OCR_CANVAS_BORDER,
      canvas.width - OCR_CANVAS_BORDER * 2,
      canvas.height - OCR_CANVAS_BORDER * 2
    );

    const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
    context.putImageData(enhanceImageDataForOcr(imageData), 0, 0);
    bitmap.close?.();

    return canvas.toDataURL('image/png');
  } catch {
    return assetUrl;
  }
}

async function renderPdfPageToDataUrl(page: any) {
  const viewport = page.getViewport({ scale: PDF_RENDER_SCALE });
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d');

  if (!context) {
    throw new Error('Unable to create OCR canvas context');
  }

  canvas.width = Math.max(1, Math.ceil(viewport.width));
  canvas.height = Math.max(1, Math.ceil(viewport.height));

  await page.render({
    canvasContext: context,
    viewport,
  }).promise;

  return canvas.toDataURL('image/png');
}

async function runImageOcr(path: string) {
  const { text, confidence } = await recognizeImageAsset(await readLocalFileAsDataUrl(path, path));
  if (!text) {
    return [];
  }

  return [{
    text,
    sourceLabel: 'OCR Image',
    confidence,
  }] satisfies OcrSegment[];
}

async function runPdfOcr(path: string) {
  const pdfjs = await loadPdfJs();
  const loadingTask = pdfjs.getDocument({ data: await readLocalFileBytes(path) });
  const pdf = await loadingTask.promise;
  const pageCount = Math.min(pdf.numPages, MAX_OCR_PAGES);
  const segments: OcrSegment[] = [];

  for (let pageNumber = 1; pageNumber <= pageCount; pageNumber += 1) {
    const page = await pdf.getPage(pageNumber);
    const image = await renderPdfPageToDataUrl(page);
    const { text, confidence } = await recognizeImageAsset(image);

    if (text) {
      segments.push({
        text,
        sourceLabel: `OCR Page ${pageNumber}`,
        pageNumber,
        confidence,
      });
    }
  }

  await loadingTask.destroy();
  return segments;
}

export async function runLocalOcr(path: string, name: string): Promise<OcrSegment[]> {
  const ext = getExtension(name);

  if (OCR_IMAGE_EXTENSIONS.has(ext)) {
    return runImageOcr(path);
  }

  if (OCR_PDF_EXTENSIONS.has(ext)) {
    return runPdfOcr(path);
  }

  return [];
}

export async function disposeLocalOcrWorker() {
  if (!workerPromise) {
    return;
  }

  const worker = await workerPromise;
  workerPromise = null;
  await worker.terminate();
}
