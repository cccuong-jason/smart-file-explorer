import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  collectChunkSignals,
  collectVisualSignals,
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
    lastModified: new Date('2026-01-02').getTime(),
  },
  {
    path: '/docs/notes.md',
    name: 'notes.md',
    content: 'meeting notes',
    embedding: [0.8, 0.2, 0],
    lastModified: new Date('2026-01-01').getTime(),
  },
  {
    path: '/code/search.ts',
    name: 'search.ts',
    content: 'search implementation',
    embedding: [0, 1, 0],
    lastModified: new Date('2025-12-10').getTime(),
  },
  {
    path: '/docs/blank.md',
    name: 'blank.md',
    lastModified: new Date('2025-10-02').getTime(),
  },
];

const contextFiles: SearchableFile[] = [
  {
    path: '/clients/acme/proposals/Acme Proposal v3 final.docx',
    name: 'Acme Proposal v3 final.docx',
    content: 'Acme renewal proposal with final pricing and approved scope',
    embedding: [1, 0, 0],
    lastModified: new Date('2026-03-28').getTime(),
    tags: ['proposal', 'acme'],
    isStarred: true,
  },
  {
    path: '/clients/acme/proposals/Acme Proposal draft.docx',
    name: 'Acme Proposal draft.docx',
    content: 'Early draft for Acme proposal',
    embedding: [0.92, 0.08, 0],
    lastModified: new Date('2026-02-10').getTime(),
    tags: ['proposal'],
  },
  {
    path: '/clients/acme/notes/kickoff-notes.md',
    name: 'kickoff-notes.md',
    content: 'Acme kickoff meeting notes and project details',
    embedding: [0.65, 0.35, 0],
    lastModified: new Date('2026-03-15').getTime(),
  },
];

const chunks = [
  {
    id: '/clients/acme/proposals/Acme Proposal v3 final.docx::0',
    filePath: '/clients/acme/proposals/Acme Proposal v3 final.docx',
    index: 0,
    text: 'Approved pricing and renewal terms for Acme',
    embedding: [1, 0, 0],
    sourceLabel: 'Page 2',
    pageNumber: 2,
  },
  {
    id: '/clients/acme/proposals/Acme Proposal draft.docx::0',
    filePath: '/clients/acme/proposals/Acme Proposal draft.docx',
    index: 0,
    text: 'Early draft language without final pricing',
    embedding: [0.6, 0.4, 0],
    sourceLabel: 'Page 1',
    pageNumber: 1,
  },
];

const visualChunks = [
  {
    id: '/images/dashboard.png::visual::0',
    filePath: '/images/dashboard.png',
    kind: 'image' as const,
    sourceLabel: 'Image content',
    embedding: [0, 1, 0],
    ocrText: 'Q4 revenue dashboard',
    ocrConfidence: 91,
    createdAt: new Date('2026-03-30').getTime(),
  },
];

describe('search core ranking', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-04-10T12:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

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
    expect(results[0]?.reasons).toContain('exact_name');
    expect(results[0]?.confidence).toBe('high');
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

  it('boosts the likely latest deliverable using context and version cues', () => {
    const results = rankSearchResults({
      query: 'latest acme proposal',
      files: contextFiles,
      queryEmbedding: [1, 0, 0],
      semanticEnabled: true,
    });

    expect(results[0]?.file.path).toBe('/clients/acme/proposals/Acme Proposal v3 final.docx');
    expect(results[0]?.isLikelyLatest).toBe(true);
    expect(results[0]?.reasons).toEqual(
      expect.arrayContaining(['semantic', 'project_context', 'recent_update', 'latest_signal'])
    );
  });

  it('returns a snippet and contextual reasons for work-document matches', () => {
    const results = rankSearchResults({
      query: 'acme proposal pricing',
      files: contextFiles,
      queryEmbedding: [1, 0, 0],
      semanticEnabled: true,
    });

    expect(results[0]?.snippet).toContain('final pricing');
    expect(results[0]?.reasons).toEqual(
      expect.arrayContaining(['semantic', 'project_context', 'content_terms', 'starred'])
    );
    expect(results[0]?.factors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: 'semantic',
          evidence: expect.arrayContaining([expect.stringContaining('final pricing')]),
        }),
        expect.objectContaining({
          code: 'project_context',
          evidence: expect.arrayContaining([expect.stringContaining('/clients/acme/proposals')]),
        }),
      ])
    );
    expect(results[0]?.confidence).toBe('high');
  });

  it('collects chunk-level signals and propagates the best snippet', () => {
    const chunkSignals = collectChunkSignals({
      query: 'acme pricing',
      chunks,
      queryEmbedding: [1, 0, 0],
      semanticEnabled: true,
    });

    expect(chunkSignals.get('/clients/acme/proposals/Acme Proposal v3 final.docx')?.snippet).toContain('pricing');
    expect(
      chunkSignals.get('/clients/acme/proposals/Acme Proposal v3 final.docx')?.reasons
    ).toEqual(expect.arrayContaining(['semantic', 'content_terms']));
    expect(chunkSignals.get('/clients/acme/proposals/Acme Proposal v3 final.docx')?.locationLabel).toBe('Page 2');
  });

  it('uses chunk signals to rank the correct file even when file content is thin', () => {
    const chunkSignals = collectChunkSignals({
      query: 'acme pricing',
      chunks,
      queryEmbedding: [1, 0, 0],
      semanticEnabled: true,
    });

    const results = rankSearchResults({
      query: 'acme pricing',
      files: contextFiles.map((file) => ({ ...file, content: file.name.includes('draft') ? file.content : undefined })),
      queryEmbedding: [1, 0, 0],
      semanticEnabled: true,
      chunkSignals,
    });

    expect(results[0]?.file.path).toBe('/clients/acme/proposals/Acme Proposal v3 final.docx');
    expect(results[0]?.snippet).toContain('pricing');
    expect(results[0]?.locationLabel).toBe('Page 2');
  });

  it('uses visual embeddings to rank image-only files from natural language queries', () => {
    const visualSignals = collectVisualSignals({
      query: 'dashboard chart',
      visualChunks,
      queryEmbedding: [0, 1, 0],
      semanticEnabled: true,
    });

    const results = rankSearchResults({
      query: 'dashboard chart',
      files: [
        {
          path: '/images/dashboard.png',
          name: 'dashboard.png',
          lastModified: new Date('2026-03-30').getTime(),
        },
      ],
      semanticEnabled: true,
      visualSignals,
    });

    expect(results[0]?.file.path).toBe('/images/dashboard.png');
    expect(results[0]?.reasons).toEqual(expect.arrayContaining(['visual_semantic', 'ocr_text']));
    expect(results[0]?.locationLabel).toBe('Image content');
    expect(results[0]?.factors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: 'visual_semantic',
          evidence: expect.arrayContaining([expect.stringContaining('visual meaning')]),
        }),
        expect.objectContaining({
          code: 'ocr_text',
          evidence: expect.arrayContaining([expect.stringContaining('Q4 revenue dashboard')]),
        }),
      ])
    );
  });

  it('collects OCR-only visual signals without semantic embeddings', () => {
    const visualSignals = collectVisualSignals({
      query: 'invoice total',
      visualChunks: [
        {
          id: '/images/invoice.png::visual::0',
          filePath: '/images/invoice.png',
          kind: 'image',
          sourceLabel: 'Image content',
          ocrText: 'Invoice total due Friday',
          ocrConfidence: 72,
        },
      ],
    });

    const signal = visualSignals.get('/images/invoice.png');

    expect(signal?.reasons).toEqual(['ocr_text']);
    expect(signal?.snippet).toContain('Invoice total');
    expect(signal?.evidence.ocr_text).toEqual(
      expect.arrayContaining([
        expect.stringContaining('Invoice total due Friday'),
        expect.stringContaining('invoice, total'),
      ])
    );
  });

  it('skips weak visual chunks and keeps the strongest visual signal per file', () => {
    const visualSignals = collectVisualSignals({
      query: 'sunset',
      visualChunks: [
        {
          id: '/images/scene.png::visual::0',
          filePath: '/images/scene.png',
          kind: 'image',
          sourceLabel: 'Hero image',
          embedding: [1, 0],
        },
        {
          id: '/images/scene.png::visual::1',
          filePath: '/images/scene.png',
          kind: 'image',
          sourceLabel: 'Thumbnail',
          embedding: [0.9, 0.2],
        },
        {
          id: '/images/noise.png::visual::0',
          filePath: '/images/noise.png',
          kind: 'image',
          sourceLabel: 'Image content',
          embedding: [0, 1],
        },
      ],
      queryEmbedding: [1, 0],
      semanticEnabled: true,
    });

    expect(visualSignals.get('/images/scene.png')?.locationLabel).toBe('Hero image');
    expect(visualSignals.get('/images/scene.png')?.snippet).toBeUndefined();
    expect(visualSignals.has('/images/noise.png')).toBe(false);
  });

  it('ignores OCR text that does not overlap the query when visual semantics cannot help', () => {
    const visualSignals = collectVisualSignals({
      query: 'roadmap',
      visualChunks: [
        {
          id: '/images/receipt.png::visual::0',
          filePath: '/images/receipt.png',
          kind: 'image',
          sourceLabel: 'Image content',
          ocrText: 'parking receipt paid in cash',
        },
      ],
      queryEmbedding: [1, 0],
      semanticEnabled: true,
    });

    expect(visualSignals.size).toBe(0);
  });

  it('uses visual snippets and fallback evidence when ranking visual-only matches', () => {
    const results = rankSearchResults({
      query: 'wireframe',
      files: [
        {
          path: '/images/mockup.png',
          name: 'mockup.png',
        },
      ],
      semanticEnabled: false,
      visualSignals: new Map([
        [
          '/images/mockup.png',
          {
            score: 0.5,
            reasons: ['visual_semantic'],
            snippet: 'Landing page wireframe',
            locationLabel: 'Image content',
            evidence: {},
          },
        ],
      ]),
    });

    expect(results[0]?.snippet).toBe('Landing page wireframe');
    expect(results[0]?.factors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: 'visual_semantic',
          evidence: [],
        }),
      ])
    );
  });

  it('drops visual-only rank candidates below the result threshold', () => {
    const results = rankSearchResults({
      query: 'thumbnail',
      files: [
        {
          path: '/images/tiny.png',
          name: 'tiny.png',
        },
      ],
      semanticEnabled: false,
      visualSignals: new Map([
        [
          '/images/tiny.png',
          {
            score: 0.05,
            reasons: ['visual_semantic'],
            locationLabel: 'Image content',
            evidence: {},
          },
        ],
      ]),
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
