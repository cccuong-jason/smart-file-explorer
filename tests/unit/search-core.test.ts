import { describe, expect, it } from 'vitest';
import {
  cosineSimilarity,
  rankSearchResults,
  findRelatedFileMatches,
  type SearchableFile,
} from '@/lib/search/core';

const files: SearchableFile[] = [
  {
    path: '/docs/budget.md',
    name: 'budget.md',
    content: 'quarterly finance plan',
    embedding: [1, 0, 0],
  },
  {
    path: '/docs/notes.md',
    name: 'notes.md',
    content: 'meeting notes',
    embedding: [0.8, 0.2, 0],
  },
  {
    path: '/code/search.ts',
    name: 'search.ts',
    content: 'search implementation',
    embedding: [0, 1, 0],
  },
  {
    path: '/docs/blank.md',
    name: 'blank.md',
  },
];

describe('search core ranking', () => {
  it('returns zero cosine score when either vector has no magnitude', () => {
    expect(cosineSimilarity([0, 0], [1, 1])).toBe(0);
    expect(cosineSimilarity([1, 1], [0, 0])).toBe(0);
  });

  it('ranks exact and semantic matches ahead of weaker results', () => {
    const results = rankSearchResults({
      query: 'budget',
      files,
      queryEmbedding: [1, 0, 0],
      semanticEnabled: true,
    });

    expect(results[0]?.file.path).toBe('/docs/budget.md');
    expect(results.every((result) => result.score > 0.1)).toBe(true);
  });

  it('falls back to keyword-only ranking when semantic search is disabled', () => {
    const results = rankSearchResults({
      query: 'search',
      files,
      semanticEnabled: false,
    });

    expect(results).toHaveLength(1);
    expect(results[0]?.file.path).toBe('/code/search.ts');
  });

  it('skips semantic similarity when no query embedding is available', () => {
    const results = rankSearchResults({
      query: 'budget',
      files,
      semanticEnabled: true,
    });

    expect(results).toHaveLength(1);
    expect(results[0]?.file.path).toBe('/docs/budget.md');
  });

  it('drops weak results below the score threshold', () => {
    const results = rankSearchResults({
      query: 'zebra',
      files,
      queryEmbedding: [0, 0, 1],
      semanticEnabled: true,
    });

    expect(results).toEqual([]);
  });
});

describe('related files matching', () => {
  it('excludes the source file and returns top related matches above threshold', () => {
    const results = findRelatedFileMatches(files[0], files);

    expect(results.some((result) => result.file.path === files[0].path)).toBe(false);
    expect(results[0]?.score).toBeGreaterThan(0.6);
  });

  it('returns no related matches when the source file has no embedding', () => {
    expect(findRelatedFileMatches(files[3], files)).toEqual([]);
  });
});
