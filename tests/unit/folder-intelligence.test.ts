import { describe, expect, it } from 'vitest';
import { buildFolderInsights } from '@/lib/folder-intelligence/workspaces';

const now = new Date('2026-04-05T00:00:00Z').getTime();

describe('folder intelligence workspaces', () => {
  it('groups files by workspace path and highlights important files plus OCR backlog', () => {
    const insights = buildFolderInsights([
      {
        path: 'C:/Users/jason/Documents/Acme/Q2/proposal-final.docx',
        name: 'proposal-final.docx',
        size: 120000,
        type: 'application/docx',
        lastModified: now,
        group: 'documents',
        subtype: 'word',
        tags: ['proposal'],
        isStarred: true,
        indexingStage: 'semantic',
      },
      {
        path: 'C:/Users/jason/Documents/Acme/Q2/budget.xlsx',
        name: 'budget.xlsx',
        size: 98000,
        type: 'application/xlsx',
        lastModified: now - 1000 * 60 * 60 * 24,
        group: 'documents',
        subtype: 'spreadsheet',
        indexingStage: 'content',
      },
      {
        path: 'C:/Users/jason/Documents/Acme/Q2/scan.png',
        name: 'scan.png',
        size: 44000,
        type: 'application/png',
        lastModified: now - 1000 * 60 * 60 * 24 * 2,
        group: 'images',
        subtype: 'raster',
        ocrStatus: 'recommended',
        indexingStage: 'metadata',
      },
      {
        path: 'C:/Users/jason/Documents/Internal/HR/handbook.pdf',
        name: 'handbook.pdf',
        size: 56000,
        type: 'application/pdf',
        lastModified: now - 1000 * 60 * 60 * 24 * 10,
        group: 'documents',
        subtype: 'pdf',
        indexingStage: 'semantic',
      },
    ]);

    expect(insights[0]).toMatchObject({
      title: 'Q2',
      fileCount: 3,
      ocrCount: 1,
      primaryTypeLabel: 'Documents',
      topFile: expect.objectContaining({ name: 'proposal-final.docx' }),
      importantFiles: expect.arrayContaining([
        expect.objectContaining({ name: 'proposal-final.docx' }),
      ]),
      summary: expect.stringContaining('proposal-final.docx'),
    });
    expect(insights[0].highlights).toEqual(
      expect.arrayContaining(['1 needs OCR', '3 recently updated'])
    );
    expect(insights[1]).toMatchObject({
      title: 'HR',
      fileCount: 1,
    });
  });

  it('groups document variants and picks a likely latest version', () => {
    const insights = buildFolderInsights([
      {
        path: 'C:/Users/jason/Documents/Acme/Renewal/proposal-v1.docx',
        name: 'proposal-v1.docx',
        size: 118000,
        type: 'application/docx',
        lastModified: now - 1000 * 60 * 60 * 24 * 5,
        group: 'documents',
        subtype: 'word',
        indexingStage: 'semantic',
      },
      {
        path: 'C:/Users/jason/Documents/Acme/Renewal/proposal-v2.docx',
        name: 'proposal-v2.docx',
        size: 121000,
        type: 'application/docx',
        lastModified: now - 1000 * 60 * 60 * 24 * 2,
        group: 'documents',
        subtype: 'word',
        indexingStage: 'semantic',
      },
      {
        path: 'C:/Users/jason/Documents/Acme/Renewal/proposal-final.docx',
        name: 'proposal-final.docx',
        size: 123000,
        type: 'application/docx',
        lastModified: now,
        group: 'documents',
        subtype: 'word',
        indexingStage: 'semantic',
      },
      {
        path: 'C:/Users/jason/Documents/Acme/Renewal/pricing.xlsx',
        name: 'pricing.xlsx',
        size: 89000,
        type: 'application/xlsx',
        lastModified: now - 1000 * 60 * 60 * 24,
        group: 'documents',
        subtype: 'spreadsheet',
        indexingStage: 'semantic',
      },
    ]);

    expect(insights[0].versionGroups).toEqual([
      expect.objectContaining({
        title: 'proposal',
        variantCount: 3,
        latestFile: expect.objectContaining({ name: 'proposal-final.docx' }),
      }),
    ]);
    expect(insights[0].topFile).toMatchObject({ name: 'proposal-final.docx' });
    expect(insights[0].highlights).toEqual(
      expect.arrayContaining(['1 version group'])
    );
  });

  it('surfaces project keywords and recent files in the workspace summary', () => {
    const insights = buildFolderInsights([
      {
        path: 'C:/Users/jason/Documents/Clients/Beacon/Q3/client-renewal-plan.docx',
        name: 'client-renewal-plan.docx',
        size: 120000,
        type: 'application/docx',
        lastModified: now,
        group: 'documents',
        subtype: 'word',
        indexingStage: 'semantic',
        content: 'Beacon renewal pricing plan for Q3 enterprise contract.',
      },
      {
        path: 'C:/Users/jason/Documents/Clients/Beacon/Q3/renewal-pricing.xlsx',
        name: 'renewal-pricing.xlsx',
        size: 90000,
        type: 'application/xlsx',
        lastModified: now - 1000 * 60 * 60 * 12,
        group: 'documents',
        subtype: 'spreadsheet',
        indexingStage: 'semantic',
        content: 'Q3 pricing assumptions and contract renewal numbers for Beacon.',
      },
      {
        path: 'C:/Users/jason/Documents/Clients/Beacon/Q3/kickoff-notes.md',
        name: 'kickoff-notes.md',
        size: 5000,
        type: 'text/markdown',
        lastModified: now - 1000 * 60 * 60 * 24 * 4,
        group: 'documents',
        subtype: 'text',
        indexingStage: 'content',
        content: 'Beacon contract kickoff notes and renewal risks.',
      },
    ]);

    expect(insights[0]).toMatchObject({
      title: 'Q3',
      projectKeywords: expect.arrayContaining(['beacon', 'renewal', 'q3']),
      recentFiles: expect.arrayContaining([
        expect.objectContaining({ name: 'client-renewal-plan.docx' }),
        expect.objectContaining({ name: 'renewal-pricing.xlsx' }),
      ]),
    });
    expect(insights[0].summary).toContain('renewal');
  });
});
