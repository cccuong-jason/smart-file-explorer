import { readFile } from '@tauri-apps/plugin-fs';
import { convertFileSrc } from '@tauri-apps/api/core';

const MIME_TYPES: Record<string, string> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  webp: 'image/webp',
  bmp: 'image/bmp',
  svg: 'image/svg+xml',
  pdf: 'application/pdf',
};

function getExtension(name?: string) {
  return name?.split('.').pop()?.toLowerCase() ?? '';
}

export function getMimeTypeForFileName(name?: string) {
  return MIME_TYPES[getExtension(name)] ?? 'application/octet-stream';
}

export async function readLocalFileBytes(path: string) {
  return readFile(path);
}

function toBase64(bytes: Uint8Array) {
  let binary = '';
  const chunkSize = 0x8000;

  for (let index = 0; index < bytes.length; index += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(index, index + chunkSize));
  }

  return btoa(binary);
}

export async function readLocalFileAsDataUrl(path: string, name?: string) {
  const bytes = await readLocalFileBytes(path);
  return `data:${getMimeTypeForFileName(name)};base64,${toBase64(bytes)}`;
}

export async function readLocalFileAsObjectUrl(path: string, name?: string) {
  const bytes = await readLocalFileBytes(path);
  return URL.createObjectURL(new Blob([bytes], { type: getMimeTypeForFileName(name) }));
}

export function getLocalFileFallbackUrl(path?: string) {
  if (!path) {
    return '';
  }

  try {
    return convertFileSrc(path);
  } catch {
    return path;
  }
}

export function revokeLocalFileUrl(url?: string) {
  if (url?.startsWith('blob:')) {
    URL.revokeObjectURL(url);
  }
}
