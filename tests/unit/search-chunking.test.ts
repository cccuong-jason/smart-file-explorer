import { describe, expect, it } from 'vitest';
import { averageEmbeddings, splitTextIntoChunks } from '@/lib/search/chunking';

describe('search chunking helpers', () => {
  it('splits long text into ordered overlapping chunks', () => {
    const text = [
      'Acme renewal proposal',
      'This document contains pricing, timeline, deliverables, and scope.',
      'The approved pricing section should remain searchable in its own chunk.',
      'Final notes and next steps for the client are included at the end.',
    ].join('\n\n');

    const chunks = splitTextIntoChunks(text, {
      maxChars: 90,
      overlapChars: 20,
      maxChunks: 6,
    });

    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks[0]?.text).toContain('Acme renewal proposal');
    expect(chunks[1]?.text).toContain('pricing');
    expect(chunks[1]?.index).toBe(1);
  });

  it('averages chunk embeddings into a single file embedding', () => {
    const embedding = averageEmbeddings([
      [1, 0, 0],
      [0.5, 0.5, 0],
    ]);

    expect(embedding).toHaveLength(3);
    expect(embedding?.[0]).toBeGreaterThan(embedding?.[1] ?? 0);
    expect(embedding?.[2]).toBe(0);
  });
});
