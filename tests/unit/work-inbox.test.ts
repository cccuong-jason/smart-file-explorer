import { describe, expect, it } from 'vitest';
import { buildWorkInboxItems } from '@/lib/work-inbox/items';
import type { FolderInsight } from '@/lib/folder-intelligence/workspaces';

const now = Date.now();

function createInsight(overrides: Partial<FolderInsight> = {}): FolderInsight {
  return {
    id: 'workspace-1',
    path: 'C:/Users/jason/Documents/Acme/Q2',
    title: 'Q2',
    fileCount: 4,
    ocrCount: 1,
    recentCount: 2,
    primaryTypeLabel: 'Documents',
    topFile: {
      path: 'C:/Users/jason/Documents/Acme/Q2/proposal-final.docx',
      name: 'proposal-final.docx',
      size: 100,
      type: 'application/docx',
      lastModified: now,
      isLikelyLatest: true,
      isStarred: true,
    },
    topFiles: [],
    importantFiles: [
      {
        path: 'C:/Users/jason/Documents/Acme/Q2/proposal-final.docx',
        name: 'proposal-final.docx',
        size: 100,
        type: 'application/docx',
        lastModified: now,
        isLikelyLatest: true,
        isStarred: true,
      },
    ],
    recentFiles: [
      {
        path: 'C:/Users/jason/Documents/Acme/Q2/pricing.xlsx',
        name: 'pricing.xlsx',
        size: 100,
        type: 'application/xlsx',
        lastModified: now - 1_000,
      },
    ],
    versionGroups: [
      {
        id: 'vg-1',
        title: 'proposal',
        variantCount: 3,
        latestFile: {
          path: 'C:/Users/jason/Documents/Acme/Q2/proposal-final.docx',
          name: 'proposal-final.docx',
          size: 100,
          type: 'application/docx',
          lastModified: now,
        },
        files: [],
      },
    ],
    projectKeywords: ['acme', 'renewal'],
    summary: 'proposal-final.docx is the best document to open first in Q2.',
    highlights: ['Likely latest version', '1 version group', '1 needs OCR'],
    rationale: ['The latest proposal is starred and recently updated.'],
    summarySource: 'heuristic',
    summaryState: 'local',
    workspaceScore: 12,
    ...overrides,
  };
}

describe('buildWorkInboxItems', () => {
  it('builds action-oriented inbox items from folder insights', () => {
    const items = buildWorkInboxItems(
      [createInsight()],
      {
        dismissedItemKeys: [],
        lastInboxVisitAt: now - 60_000,
        pinnedItemIds: [],
        recentFiles: [
          {
            path: 'C:/Users/jason/Documents/Acme/Q2/proposal-final.docx',
            name: 'proposal-final.docx',
            workspaceId: 'workspace-1',
            workspaceTitle: 'Q2',
            lastOpenedAt: now - 5_000,
          },
        ],
      }
    );

    expect(items.map((item) => item.type)).toEqual([
      'continue_now',
      'needs_review',
      'open_now',
      'version_conflict',
      'ocr_attention',
      'recent_change',
    ]);
    expect(items[0].title).toMatch(/continue/i);
    expect(items[1].reason).toMatch(/changed since your last visit/i);
    expect(items[2].title).toMatch(/proposal-final\.docx/i);
    expect(items[3].reason).toMatch(/3 alternates/i);
    expect(items[4].reason).toMatch(/OCR/i);
    expect(items[5].workspaceId).toBe('workspace-1');
    expect(items[0].evidence).toEqual(expect.arrayContaining(['Opened recently']));
  });

  it('limits duplicate open-now items and sorts by priority', () => {
    const items = buildWorkInboxItems([
      createInsight(),
      createInsight({
        id: 'workspace-2',
        path: 'C:/Users/jason/Documents/Beta',
        title: 'Beta',
        ocrCount: 0,
        recentCount: 0,
        versionGroups: [],
        topFile: {
          path: 'C:/Users/jason/Documents/Beta/brief.docx',
          name: 'brief.docx',
          size: 100,
          type: 'application/docx',
          lastModified: now - 10_000,
        },
        importantFiles: [
          {
            path: 'C:/Users/jason/Documents/Beta/brief.docx',
            name: 'brief.docx',
            size: 100,
            type: 'application/docx',
            lastModified: now - 10_000,
          },
        ],
        summary: 'brief.docx is the best document to open first in Beta.',
        highlights: ['Likely latest version'],
        rationale: [],
        workspaceScore: 4,
      }),
    ]);

    expect(items[0].workspaceId).toBe('workspace-1');
    expect(items.filter((item) => item.type === 'open_now')).toHaveLength(2);
  });

  it('prioritizes pinned workspaces and filters dismissed items', () => {
    const items = buildWorkInboxItems([
      createInsight(),
      createInsight({
        id: 'workspace-2',
        path: 'C:/Users/jason/Documents/Beta',
        title: 'Beta',
        ocrCount: 0,
        recentCount: 0,
        versionGroups: [],
        topFile: {
          path: 'C:/Users/jason/Documents/Beta/brief.docx',
          name: 'brief.docx',
          size: 100,
          type: 'application/docx',
          lastModified: now - 10_000,
        },
        importantFiles: [
          {
            path: 'C:/Users/jason/Documents/Beta/brief.docx',
            name: 'brief.docx',
            size: 100,
            type: 'application/docx',
            lastModified: now - 10_000,
          },
        ],
        summary: 'brief.docx is the best document to open first in Beta.',
        highlights: ['Likely latest version'],
        rationale: [],
        workspaceScore: 4,
      }),
    ], {
      pinnedItemIds: ['workspace-2:open-now'],
      dismissedItemKeys: ['workspace-1:open-now'],
      recentFiles: [],
    });

    expect(items[0].workspaceId).toBe('workspace-2');
    expect(items.some((item) => item.id === 'workspace-1:open-now')).toBe(false);
    expect(items.find((item) => item.workspaceId === 'workspace-2' && item.type === 'open_now')?.isPinned).toBe(true);
  });

  it('surfaces changed important files after the previous inbox visit', () => {
    const items = buildWorkInboxItems(
      [
        createInsight({
          recentFiles: [],
          recentCount: 0,
          topFile: {
            path: 'C:/Users/jason/Documents/Acme/Q2/proposal-final.docx',
            name: 'proposal-final.docx',
            size: 100,
            type: 'application/docx',
            lastModified: now,
            isLikelyLatest: true,
            isStarred: true,
          },
          importantFiles: [
            {
              path: 'C:/Users/jason/Documents/Acme/Q2/proposal-final.docx',
              name: 'proposal-final.docx',
              size: 100,
              type: 'application/docx',
              lastModified: now,
              isLikelyLatest: true,
              isStarred: true,
            },
          ],
        }),
      ],
      {
        lastInboxVisitAt: now - 86_400_000,
        dismissedItemKeys: [],
        pinnedItemIds: [],
        recentFiles: [],
      }
    );

    const needsReviewItem = items.find((item) => item.type === 'needs_review');
    expect(needsReviewItem).toBeDefined();
    expect(needsReviewItem?.title).toMatch(/review/i);
    expect(needsReviewItem?.primaryFile.name).toBe('proposal-final.docx');
    expect(needsReviewItem?.evidence).toEqual(
      expect.arrayContaining(['Changed after your last inbox visit', 'Likely latest version'])
    );
  });

  it('prefers the last workspace visit over the global inbox visit for needs-review signals', () => {
    const items = buildWorkInboxItems(
      [
        createInsight({
          topFile: {
            path: 'C:/Users/jason/Documents/Acme/Q2/proposal-final.docx',
            name: 'proposal-final.docx',
            size: 100,
            type: 'application/docx',
            lastModified: 950,
            isLikelyLatest: true,
          },
          importantFiles: [
            {
              path: 'C:/Users/jason/Documents/Acme/Q2/proposal-final.docx',
              name: 'proposal-final.docx',
              size: 100,
              type: 'application/docx',
              lastModified: 950,
              isLikelyLatest: true,
            },
          ],
          recentFiles: [],
          recentCount: 0,
          ocrCount: 0,
          versionGroups: [],
        }),
      ],
      {
        lastInboxVisitAt: 700,
        workspaceVisits: {
          'workspace-1': 900,
        },
        dismissedItemKeys: [],
        pinnedItemIds: [],
        recentFiles: [],
      }
    );

    const needsReviewItem = items.find((item) => item.type === 'needs_review');
    expect(needsReviewItem).toBeDefined();
    expect(needsReviewItem?.evidence).toEqual(
      expect.arrayContaining(['Changed since you last opened this workspace'])
    );
  });

  it('does not surface needs-review when the workspace was visited after the file changed', () => {
    const items = buildWorkInboxItems(
      [
        createInsight({
          topFile: {
            path: 'C:/Users/jason/Documents/Acme/Q2/proposal-final.docx',
            name: 'proposal-final.docx',
            size: 100,
            type: 'application/docx',
            lastModified: 950,
            isLikelyLatest: true,
          },
          importantFiles: [
            {
              path: 'C:/Users/jason/Documents/Acme/Q2/proposal-final.docx',
              name: 'proposal-final.docx',
              size: 100,
              type: 'application/docx',
              lastModified: 950,
              isLikelyLatest: true,
            },
          ],
          recentFiles: [],
          recentCount: 0,
          ocrCount: 0,
          versionGroups: [],
        }),
      ],
      {
        lastInboxVisitAt: 700,
        workspaceVisits: {
          'workspace-1': 980,
        },
        dismissedItemKeys: [],
        pinnedItemIds: [],
        recentFiles: [],
      }
    );

    expect(items.find((item) => item.type === 'needs_review')).toBeUndefined();
  });
});
