import { describe, expect, it } from 'vitest';
import {
  filterFiles,
  sortFiles,
  paginateFiles,
  extractUniqueTags,
  type BrowserFileRecord,
  type BrowserFilters,
} from '@/lib/file-browser/utils';

const now = new Date('2026-03-24T00:00:00Z').getTime();

const files: BrowserFileRecord[] = [
  {
    path: '/docs/spec.md',
    name: 'spec.md',
    size: 80 * 1024,
    lastModified: now,
    tags: ['work'],
    isStarred: true,
    score: 0.9,
  },
  {
    path: '/code/app.ts',
    name: 'app.ts',
    size: 250 * 1024,
    lastModified: now - 2 * 24 * 60 * 60 * 1000,
    tags: ['dev'],
    isStarred: false,
    score: 0.7,
  },
  {
    path: '/assets/mockup.png',
    name: 'mockup.png',
    size: 4 * 1024 * 1024,
    lastModified: now - 40 * 24 * 60 * 60 * 1000,
    tags: ['design'],
    isStarred: false,
    score: 0.4,
  },
  {
    path: '/misc/data.bin',
    name: 'data.bin',
    size: 200 * 1024 * 1024,
    lastModified: now - 10 * 24 * 60 * 60 * 1000,
    isStarred: false,
    score: 0.1,
  },
];

const defaultFilters: BrowserFilters = {
  types: [],
  date: 'any',
  size: [],
  tags: [],
  favorites: false,
};

describe('file browser utils', () => {
  it('filters by combined favorites, type, date, size, and tag rules', () => {
    const filtered = filterFiles(files, {
      ...defaultFilters,
      favorites: true,
      types: ['documents'],
      date: 'today',
      size: ['small'],
      tags: ['work'],
    }, new Date(now));

    expect(filtered).toHaveLength(1);
    expect(filtered[0]?.path).toBe('/docs/spec.md');
  });

  it('supports image, code, nested subtype, week, month, medium, large, huge, and unknown type branches', () => {
    expect(filterFiles(files, { ...defaultFilters, types: ['images'] }, new Date(now))).toEqual([files[2]]);
    expect(filterFiles(files, { ...defaultFilters, types: ['code'] }, new Date(now))).toEqual([files[1]]);
    expect(filterFiles(files, { ...defaultFilters, types: ['documents:text'] }, new Date(now))).toEqual([files[0]]);
    expect(filterFiles(files, { ...defaultFilters, types: ['other'] }, new Date(now))).toEqual([files[3]]);
    expect(filterFiles(files, { ...defaultFilters, date: 'week' }, new Date(now))).toEqual([files[0], files[1]]);
    expect(filterFiles(files, { ...defaultFilters, date: 'month' }, new Date(now))).toEqual([files[0], files[1], files[3]]);
    expect(filterFiles(files, { ...defaultFilters, size: ['medium'] }, new Date(now))).toEqual([files[1]]);
    expect(filterFiles(files, { ...defaultFilters, size: ['large'] }, new Date(now))).toEqual([files[2]]);
    expect(filterFiles(files, { ...defaultFilters, size: ['huge'] }, new Date(now))).toEqual([files[3]]);
  });

  it('rejects missing tags and non-favorite files when those filters are active', () => {
    expect(filterFiles(files, { ...defaultFilters, tags: ['missing'] }, new Date(now))).toEqual([]);
    expect(filterFiles(files, { ...defaultFilters, favorites: true }, new Date(now))).toEqual([files[0]]);
  });

  it('ignores unsupported size filters instead of dropping valid files', () => {
    expect(filterFiles(files, { ...defaultFilters, size: ['custom'] }, new Date(now))).toEqual(files);
  });

  it('sorts files by relevance, date, size, and name', () => {
    expect(sortFiles(files, 'relevance', 'desc')[0]?.path).toBe('/docs/spec.md');
    expect(sortFiles(files, 'name', 'asc')[0]?.path).toBe('/code/app.ts');
    expect(sortFiles(files, 'size', 'desc')[0]?.path).toBe('/misc/data.bin');
    expect(sortFiles(files, 'date', 'asc')[0]?.path).toBe('/assets/mockup.png');
  });

  it('paginates and extracts unique tags', () => {
    expect(paginateFiles(files, 2, 2)).toEqual([files[2], files[3]]);
    expect(extractUniqueTags(files)).toEqual(['design', 'dev', 'work']);
  });
});
