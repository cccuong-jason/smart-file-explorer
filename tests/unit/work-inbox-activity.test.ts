import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  WORK_INBOX_ACTIVITY_KEY,
  dismissWorkInboxItem,
  getWorkInboxActivity,
  recordWorkInboxOpenFile,
  recordWorkInboxVisit,
  resetDismissedWorkInboxItems,
  togglePinnedWorkspace,
} from '@/lib/work-inbox/activity';

describe('work inbox activity', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.useRealTimers();
  });

  it('returns an empty snapshot when nothing is stored', () => {
    expect(getWorkInboxActivity()).toEqual({
      dismissedItemKeys: [],
      pinnedWorkspaceIds: [],
      recentFiles: [],
    });
  });

  it('persists recent opens without duplicating the same file', () => {
    recordWorkInboxOpenFile({
      path: 'C:/Docs/proposal.docx',
      name: 'proposal.docx',
      workspaceId: 'workspace-1',
      workspaceTitle: 'Q2',
    }, 100);

    recordWorkInboxOpenFile({
      path: 'C:/Docs/proposal.docx',
      name: 'proposal.docx',
      workspaceId: 'workspace-1',
      workspaceTitle: 'Q2',
    }, 200);

    const snapshot = getWorkInboxActivity();
    expect(snapshot.recentFiles).toHaveLength(1);
    expect(snapshot.recentFiles[0]).toMatchObject({
      path: 'C:/Docs/proposal.docx',
      lastOpenedAt: 200,
    });
  });

  it('stores the last inbox visit timestamp alongside recent activity', () => {
    recordWorkInboxVisit(500);

    expect(getWorkInboxActivity()).toEqual({
      dismissedItemKeys: [],
      lastInboxVisitAt: 500,
      pinnedWorkspaceIds: [],
      recentFiles: [],
    });
    expect(localStorage.getItem(WORK_INBOX_ACTIVITY_KEY)).toContain('500');
  });

  it('persists pinned workspaces without duplicating the same workspace id', () => {
    togglePinnedWorkspace('workspace-2');
    togglePinnedWorkspace('workspace-1');
    togglePinnedWorkspace('workspace-2');

    expect(getWorkInboxActivity().pinnedWorkspaceIds).toEqual(['workspace-1']);
  });

  it('stores dismissed inbox items and can clear them later', () => {
    dismissWorkInboxItem('workspace-1:open-now:123');
    dismissWorkInboxItem('workspace-2:recent-change:999');

    expect(getWorkInboxActivity().dismissedItemKeys).toEqual([
      'workspace-2:recent-change:999',
      'workspace-1:open-now:123',
    ]);

    resetDismissedWorkInboxItems();

    expect(getWorkInboxActivity().dismissedItemKeys).toEqual([]);
  });
});
