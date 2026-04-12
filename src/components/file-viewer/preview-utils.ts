import { getLocalFileFallbackUrl } from '@/lib/file-system/local-file-data';

const IMAGE_EXTENSIONS = new Set(['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp', 'bmp']);

export type PreviewMode = 'image' | 'text' | 'empty';

export function isImageFile(name?: string) {
  const ext = name?.split('.').pop()?.toLowerCase() ?? '';
  return IMAGE_EXTENSIONS.has(ext);
}

export function getPreviewMode(file: { name?: string; content?: string } | null | undefined): PreviewMode {
  if (!file) {
    return 'empty';
  }

  if (isImageFile(file.name)) {
    return 'image';
  }

  if (file.content) {
    return 'text';
  }

  return 'empty';
}

export function getPreviewAssetUrl(path?: string) {
  return getLocalFileFallbackUrl(path);
}
