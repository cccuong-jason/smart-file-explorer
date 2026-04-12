import { beforeEach, describe, expect, it, vi } from 'vitest';
import { invoke } from '@tauri-apps/api/core';
import {
  applyFolderInsightAiSummary,
  buildFolderInsightSummaryFingerprint,
  requestFolderInsightAiSummary,
  type FolderInsightAiSummary,
} from '@/lib/folder-intelligence/ai';
import type { FolderInsight } from '@/lib/folder-intelligence/workspaces';

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(),
}));

const invokeMock = vi.mocked(invoke);

const baseInsight: FolderInsight = {
  id: 'workspace-1',
  path: 'C:/Users/jason/Documents/Clients/Acme/Renewal',
  title: 'Renewal',
  fileCount: 4,
  ocrCount: 1,
  recentCount: 2,
  primaryTypeLabel: 'Documents',
  topFile: {
    path: 'C:/Users/jason/Documents/Clients/Acme/Renewal/proposal-final.docx',
    name: 'proposal-final.docx',
    size: 120000,
    type: 'application/docx',
    lastModified: 1712400000000,
    content: 'Acme renewal proposal with pricing and approved scope.',
  },
  topFiles: [],
  importantFiles: [
    {
      path: 'C:/Users/jason/Documents/Clients/Acme/Renewal/proposal-final.docx',
      name: 'proposal-final.docx',
      size: 120000,
      type: 'application/docx',
      lastModified: 1712400000000,
      content: 'Acme renewal proposal with pricing and approved scope.',
    },
    {
      path: 'C:/Users/jason/Documents/Clients/Acme/Renewal/pricing.xlsx',
      name: 'pricing.xlsx',
      size: 98000,
      type: 'application/xlsx',
      lastModified: 1712390000000,
      content: 'Pricing model for Acme renewal.',
    },
  ],
  recentFiles: [
    {
      path: 'C:/Users/jason/Documents/Clients/Acme/Renewal/pricing.xlsx',
      name: 'pricing.xlsx',
      size: 98000,
      type: 'application/xlsx',
      lastModified: 1712390000000,
      content: 'Pricing model for Acme renewal.',
    },
  ],
  versionGroups: [],
  projectKeywords: ['acme', 'renewal', 'pricing'],
  summary: 'proposal-final.docx looks like the primary document for Renewal.',
  highlights: ['2 recently updated', '1 needs OCR'],
  workspaceScore: 12,
};

describe('folder intelligence AI integration', () => {
  beforeEach(() => {
    invokeMock.mockReset();
  });

  it('requests an AI summary from the native OpenRouter command', async () => {
    invokeMock.mockResolvedValue({
      workspaceId: 'workspace-1',
      title: 'Acme Renewal Workspace',
      summary: 'Acme renewal work is centered on the latest proposal and pricing workbook.',
      highlights: ['Proposal-final.docx is the decision-driving document.', 'Pricing.xlsx supports the active renewal work.'],
      rationale: ['The latest proposal is starred and recently updated.', 'Pricing and proposal terms repeat across the folder context.'],
      model: 'qwen/qwen3.6-plus:free',
    } satisfies FolderInsightAiSummary);

    const result = await requestFolderInsightAiSummary(baseInsight);

    expect(invokeMock).toHaveBeenCalledWith('generate_folder_intelligence_summary', {
      request: expect.objectContaining({
        workspaceId: 'workspace-1',
        title: 'Renewal',
        path: 'C:/Users/jason/Documents/Clients/Acme/Renewal',
        projectKeywords: ['acme', 'renewal', 'pricing'],
        topFiles: expect.arrayContaining([
          expect.objectContaining({
            name: 'proposal-final.docx',
            snippet: expect.stringContaining('Acme renewal proposal'),
          }),
        ]),
      }),
    });
    expect(result).toMatchObject({
      title: 'Acme Renewal Workspace',
      model: 'qwen/qwen3.6-plus:free',
    });
  });

  it('applies AI summary fields on top of heuristic insights', () => {
    const aiSummary: FolderInsightAiSummary = {
      workspaceId: 'workspace-1',
      title: 'Acme Renewal Workspace',
      summary: 'Acme renewal work is centered on the latest proposal and pricing workbook.',
      highlights: ['Proposal-final.docx is the decision-driving document.', 'Pricing.xlsx supports the active renewal work.'],
      rationale: ['The latest proposal is starred and recently updated.'],
      model: 'qwen/qwen3.6-plus:free',
    };

    const enriched = applyFolderInsightAiSummary(baseInsight, aiSummary);

    expect(enriched).toMatchObject({
      title: 'Acme Renewal Workspace',
      summary: 'Acme renewal work is centered on the latest proposal and pricing workbook.',
      highlights: ['Proposal-final.docx is the decision-driving document.', 'Pricing.xlsx supports the active renewal work.'],
      rationale: ['The latest proposal is starred and recently updated.'],
      summarySource: 'ai',
      summaryModel: 'qwen/qwen3.6-plus:free',
    });
  });

  it('creates a stable fingerprint so AI summaries can be cached until workspace evidence changes', () => {
    const first = buildFolderInsightSummaryFingerprint(baseInsight);
    const second = buildFolderInsightSummaryFingerprint(baseInsight);
    const changed = buildFolderInsightSummaryFingerprint({
      ...baseInsight,
      importantFiles: [
        ...baseInsight.importantFiles,
        {
          path: 'C:/Users/jason/Documents/Clients/Acme/Renewal/decision-notes.md',
          name: 'decision-notes.md',
          size: 4000,
          type: 'text/markdown',
          lastModified: 1712410000000,
        },
      ],
    });

    expect(first).toBe(second);
    expect(changed).not.toBe(first);
  });
});
