import { beforeEach, describe, expect, it, vi } from 'vitest';
import { readFile } from '@tauri-apps/plugin-fs';
import {
  getMimeTypeForFileName,
  readLocalFileAsDataUrl,
  readLocalFileAsObjectUrl,
  revokeLocalFileUrl,
} from '@/lib/file-system/local-file-data';

vi.mock('@tauri-apps/plugin-fs', () => ({
  readFile: vi.fn(),
}));

const readFileMock = vi.mocked(readFile);

describe('local file data helpers', () => {
  beforeEach(() => {
    readFileMock.mockReset();
    vi.stubGlobal('URL', {
      createObjectURL: vi.fn(() => 'blob:preview-url'),
      revokeObjectURL: vi.fn(),
    });
  });

  it('reads image files into a blob preview url', async () => {
    readFileMock.mockResolvedValue(new Uint8Array([1, 2, 3, 4]));

    await expect(readLocalFileAsObjectUrl('/images/hero.png', 'hero.png')).resolves.toBe('blob:preview-url');
    expect(readFileMock).toHaveBeenCalledWith('/images/hero.png');
    expect(URL.createObjectURL).toHaveBeenCalled();
  });

  it('reads image files into a data url for OCR', async () => {
    readFileMock.mockResolvedValue(new Uint8Array([65, 66, 67]));

    await expect(readLocalFileAsDataUrl('/images/hero.png', 'hero.png')).resolves.toBe('data:image/png;base64,QUJD');
  });

  it('derives mime types and only revokes blob urls', () => {
    expect(getMimeTypeForFileName('hero.svg')).toBe('image/svg+xml');
    expect(getMimeTypeForFileName('scan.pdf')).toBe('application/pdf');

    revokeLocalFileUrl('blob:preview-url');
    revokeLocalFileUrl('asset:///images/hero.png');

    expect(URL.revokeObjectURL).toHaveBeenCalledTimes(1);
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:preview-url');
  });
});
