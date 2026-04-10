import { describe, expect, it, vi } from 'vitest';

vi.mock('@tauri-apps/api/core', () => ({
  convertFileSrc: vi.fn((path: string) => `asset://${path}`),
}));

import { getPreviewAssetUrl, getPreviewMode, isImageFile } from '@/components/file-viewer/preview-utils';

describe('preview utils', () => {
  it('detects image files and selects image preview mode', () => {
    expect(isImageFile('hero.png')).toBe(true);
    expect(getPreviewMode({ name: 'hero.png' })).toBe('image');
  });

  it('falls back to text preview for text-bearing documents', () => {
    expect(getPreviewMode({ name: 'notes.md', content: '# Notes' })).toBe('text');
  });

  it('builds tauri asset urls for previewable local files', () => {
    expect(getPreviewAssetUrl('/images/hero.png')).toBe('asset:///images/hero.png');
  });
});
