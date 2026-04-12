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
}

const OCR_IMAGE_EXTENSIONS = new Set(['png', 'jpg', 'jpeg', 'gif', 'bmp', 'webp']);
const OCR_PDF_EXTENSIONS = new Set(['pdf']);
const PDF_RENDER_SCALE = 1.5;
const MAX_OCR_PAGES = 4;
const TESSERACT_CORE_PATH = 'https://cdn.jsdelivr.net/npm/tesseract.js-core@7.0.0';
const TESSERACT_LANG_PATH = 'https://cdn.jsdelivr.net/npm/@tesseract.js-data/eng/4.0.0_best_int';

let workerPromise: Promise<TesseractJsWorker> | null = null;

function getExtension(name: string) {
  return name.split('.').pop()?.toLowerCase() ?? '';
}

function normalizeOcrText(text: string | undefined) {
  return (text ?? '').replace(/\s+/g, ' ').trim();
}

async function getWorker(): Promise<TesseractJsWorker> {
  if (!workerPromise) {
    workerPromise = import('tesseract.js').then(({ createWorker }) => (
      createWorker('eng', 1, {
        workerPath: workerUrl,
        corePath: TESSERACT_CORE_PATH,
        langPath: TESSERACT_LANG_PATH,
      })
    ));
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
  const result = await worker.recognize(assetUrl);
  return normalizeOcrText(result?.data?.text);
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
  const text = await recognizeImageAsset(await readLocalFileAsDataUrl(path, path));
  if (!text) {
    return [];
  }

  return [{
    text,
    sourceLabel: 'OCR Image',
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
    const text = await recognizeImageAsset(image);

    if (text) {
      segments.push({
        text,
        sourceLabel: `OCR Page ${pageNumber}`,
        pageNumber,
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
