import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  WORK_INBOX_ACTIVITY_KEY,
  getWorkInboxActivity,
  recordWorkInboxOpenFile,
  recordWorkInboxVisit,
} from '@/lib/work-inbox/activity';

describe('work inbox activity', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.useRealTimers();
  });

  it('returns an empty snapshot when nothing is stored', () => {
    expect(getWorkInboxActivity()).toEqual({
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
      lastInboxVisitAt: 500,
      recentFiles: [],
    });
    expect(localStorage.getItem(WORK_INBOX_ACTIVITY_KEY)).toContain('500');
  });
});
