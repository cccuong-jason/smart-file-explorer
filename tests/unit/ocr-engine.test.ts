import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { disposeLocalOcrWorker, runLocalOcr } from '@/lib/ocr/ocr-engine';
import { readLocalFileAsDataUrl } from '@/lib/file-system/local-file-data';
import { createWorker } from 'tesseract.js';

vi.mock('@/lib/file-system/local-file-data', () => ({
  readLocalFileAsDataUrl: vi.fn(),
  readLocalFileBytes: vi.fn(),
}));

const recognizeMock = vi.fn();
const setParametersMock = vi.fn();
const terminateMock = vi.fn();

vi.mock('tesseract.js', () => ({
  createWorker: vi.fn(async () => ({
    recognize: recognizeMock,
    setParameters: setParametersMock,
    terminate: terminateMock,
  })),
}));

const createWorkerMock = vi.mocked(createWorker);
const readLocalFileAsDataUrlMock = vi.mocked(readLocalFileAsDataUrl);

describe('local OCR engine', () => {
  const originalFetch = globalThis.fetch;
  const originalCreateImageBitmap = globalThis.createImageBitmap;
  let createElementSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    recognizeMock.mockReset();
    setParametersMock.mockReset();
    terminateMock.mockReset();
    createWorkerMock.mockClear();
    readLocalFileAsDataUrlMock.mockReset();

    readLocalFileAsDataUrlMock.mockResolvedValue('data:image/png;base64,raw');
    recognizeMock.mockResolvedValue({
      data: {
        text: '  Xin chao\ninvoice  ',
        confidence: 87,
      },
    });

    globalThis.fetch = vi.fn(async () => ({
      blob: async () => new Blob(['image']),
    })) as any;
    globalThis.createImageBitmap = vi.fn(async () => ({
      width: 320,
      height: 160,
      close: vi.fn(),
    })) as any;

    const context = {
      fillStyle: '',
      filter: '',
      fillRect: vi.fn(),
      drawImage: vi.fn(),
      getImageData: vi.fn(() => ({
        width: 2,
        height: 1,
        data: new Uint8ClampedArray([30, 40, 50, 255, 240, 240, 240, 255]),
      })),
      putImageData: vi.fn(),
    };
    const canvas = {
      width: 0,
      height: 0,
      getContext: vi.fn(() => context),
      toDataURL: vi.fn(() => 'data:image/png;base64,processed'),
    };

    createElementSpy = vi.spyOn(document, 'createElement').mockImplementation((tagName: string) => {
      if (tagName === 'canvas') {
        return canvas as any;
      }
      return document.createElement(tagName);
    });
  });

  afterEach(async () => {
    createElementSpy.mockRestore();
    globalThis.fetch = originalFetch;
    globalThis.createImageBitmap = originalCreateImageBitmap;
    await disposeLocalOcrWorker();
  });

  it('configures bilingual OCR parameters and recognizes preprocessed image data', async () => {
    const segments = await runLocalOcr('/images/invoice.png', 'invoice.png');

    expect(createWorkerMock).toHaveBeenCalledWith(
      'eng+vie',
      1,
      expect.objectContaining({
        workerPath: expect.any(String),
        corePath: expect.any(String),
        langPath: expect.any(String),
      })
    );
    expect(setParametersMock).toHaveBeenCalledWith(expect.objectContaining({
      preserve_interword_spaces: '1',
      user_defined_dpi: '300',
    }));
    expect(recognizeMock).toHaveBeenCalledWith('data:image/png;base64,processed');
    expect(segments).toEqual([
      {
        text: 'Xin chao invoice',
        sourceLabel: 'OCR Image',
        confidence: 87,
      },
    ]);
  });
});
