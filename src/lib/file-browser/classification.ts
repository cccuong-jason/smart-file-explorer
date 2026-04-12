export type FileTypeGroup =
  | 'documents'
  | 'code'
  | 'images'
  | 'media'
  | 'archives'
  | 'other';

export type FileTypeSubtype =
  | 'pdf'
  | 'word'
  | 'text'
  | 'spreadsheet'
  | 'presentation'
  | 'javascript'
  | 'json'
  | 'web'
  | 'python'
  | 'config'
  | 'raster'
  | 'vector'
  | 'gif'
  | 'audio'
  | 'video'
  | 'archive'
  | 'other';

export type FileTypeFilterId = FileTypeGroup | `${FileTypeGroup}:${FileTypeSubtype}`;

export interface FileClassification {
  group: FileTypeGroup;
  subtype: FileTypeSubtype;
}

type ClassificationDefinition = {
  group: FileTypeGroup;
  subtype: FileTypeSubtype;
};

const extensionMap: Record<string, ClassificationDefinition> = {
  pdf: { group: 'documents', subtype: 'pdf' },
  doc: { group: 'documents', subtype: 'word' },
  docx: { group: 'documents', subtype: 'word' },
  txt: { group: 'documents', subtype: 'text' },
  md: { group: 'documents', subtype: 'text' },
  rtf: { group: 'documents', subtype: 'text' },
  xls: { group: 'documents', subtype: 'spreadsheet' },
  xlsx: { group: 'documents', subtype: 'spreadsheet' },
  csv: { group: 'documents', subtype: 'spreadsheet' },
  tsv: { group: 'documents', subtype: 'spreadsheet' },
  ppt: { group: 'documents', subtype: 'presentation' },
  pptx: { group: 'documents', subtype: 'presentation' },
  key: { group: 'documents', subtype: 'presentation' },
  js: { group: 'code', subtype: 'javascript' },
  jsx: { group: 'code', subtype: 'javascript' },
  ts: { group: 'code', subtype: 'javascript' },
  tsx: { group: 'code', subtype: 'javascript' },
  json: { group: 'code', subtype: 'json' },
  html: { group: 'code', subtype: 'web' },
  css: { group: 'code', subtype: 'web' },
  scss: { group: 'code', subtype: 'web' },
  py: { group: 'code', subtype: 'python' },
  xml: { group: 'code', subtype: 'config' },
  yaml: { group: 'code', subtype: 'config' },
  yml: { group: 'code', subtype: 'config' },
  toml: { group: 'code', subtype: 'config' },
  ini: { group: 'code', subtype: 'config' },
  env: { group: 'code', subtype: 'config' },
  png: { group: 'images', subtype: 'raster' },
  jpg: { group: 'images', subtype: 'raster' },
  jpeg: { group: 'images', subtype: 'raster' },
  webp: { group: 'images', subtype: 'raster' },
  bmp: { group: 'images', subtype: 'raster' },
  svg: { group: 'images', subtype: 'vector' },
  gif: { group: 'images', subtype: 'gif' },
  mp3: { group: 'media', subtype: 'audio' },
  wav: { group: 'media', subtype: 'audio' },
  m4a: { group: 'media', subtype: 'audio' },
  mp4: { group: 'media', subtype: 'video' },
  mov: { group: 'media', subtype: 'video' },
  avi: { group: 'media', subtype: 'video' },
  mkv: { group: 'media', subtype: 'video' },
  zip: { group: 'archives', subtype: 'archive' },
  rar: { group: 'archives', subtype: 'archive' },
  '7z': { group: 'archives', subtype: 'archive' },
  tar: { group: 'archives', subtype: 'archive' },
  gz: { group: 'archives', subtype: 'archive' },
};

const defaultClassification: FileClassification = {
  group: 'other',
  subtype: 'other',
};

function getExtension(name: string) {
  return name.split('.').pop()?.toLowerCase() ?? '';
}

export function classifyFile(name: string): FileClassification {
  const ext = getExtension(name);
  return extensionMap[ext] ?? defaultClassification;
}

export function matchesFileTypeSelection(name: string, selectedIds: FileTypeFilterId[]) {
  if (selectedIds.length === 0) {
    return true;
  }

  const classification = classifyFile(name);

  return selectedIds.some((id) => {
    if (id.includes(':')) {
      return id === `${classification.group}:${classification.subtype}`;
    }

    return id === classification.group;
  });
}
