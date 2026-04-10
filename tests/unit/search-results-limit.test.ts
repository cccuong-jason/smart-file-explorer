import { describe, expect, it } from 'vitest';

import { rankSearchResults, type SearchableFile } from '@/lib/search/core';
import { DEFAULT_MAX_SEARCH_RESULTS } from '@/lib/search/presentation';

const largeResultSet: SearchableFile[] = Array.from({ length: 30 }, (_, index) => ({
  path: `/docs/proposal-${index}.md`,
  name: `proposal-${index}.md`,
  content: `proposal details ${index}`,
  embedding: [1, 0, 0],
  lastModified: new Date('2026-03-01').getTime() - index * 1000,
}));

describe('search result limits', () => {
  it('returns more than the old 20-result cap when many files match', () => {
    const results = rankSearchResults({
      query: 'proposal',
      files: largeResultSet,
      queryEmbedding: [1, 0, 0],
      semanticEnabled: true,
    });

    expect(results.length).toBe(30);
    expect(results.length).toBeLessThanOrEqual(DEFAULT_MAX_SEARCH_RESULTS);
  });
});
