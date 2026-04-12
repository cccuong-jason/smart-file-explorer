import type { FolderInsight } from '@/lib/folder-intelligence/workspaces';
import type { WorkInboxActivitySnapshot, WorkInboxRecentFile } from './activity';

export type WorkInboxItemType =
  | 'continue_now'
  | 'needs_review'
  | 'open_now'
  | 'version_conflict'
  | 'ocr_attention'
  | 'recent_change';

export interface WorkInboxItem {
  id: string;
  stateKey: string;
  type: WorkInboxItemType;
  actionMode: 'open_file' | 'open_workspace';
  isPinnedWorkspace: boolean;
  workspaceId: string;
  workspaceTitle: string;
  kindLabel: string;
  title: string;
  reason: string;
  actionLabel: string;
  evidence: string[];
  primaryFile: any;
  priority: number;
}

function createStateKey(id: string, primaryFile: any, extras: Array<string | number> = []) {
  const segments = [
    id,
    primaryFile?.path ?? 'unknown',
    primaryFile?.lastModified ?? 0,
    ...extras,
  ];

  return segments.join('::');
}

function buildEvidence(file: any, extras: string[] = []) {
  const evidence = [...extras];

  if (file?.isLikelyLatest) {
    evidence.push('Likely latest version');
  }

  if (file?.isStarred) {
    evidence.push('Starred by you');
  }

  if (typeof file?.lastModified === 'number') {
    evidence.push('Recently updated');
  }

  return Array.from(new Set(evidence)).slice(0, 3);
}

function createContinueNowItem(
  recentFile: WorkInboxRecentFile,
  matchedFile: any,
  insight: FolderInsight,
  isPinnedWorkspace: boolean,
): WorkInboxItem {
  const id = `${insight.id}:continue:${matchedFile.path}`;
  return {
    id,
    stateKey: createStateKey(id, matchedFile, [recentFile.lastOpenedAt]),
    type: 'continue_now',
    actionMode: 'open_file',
    isPinnedWorkspace,
    workspaceId: insight.id,
    workspaceTitle: insight.title,
    kindLabel: 'Continue now',
    title: `Continue with ${matchedFile.name}`,
    reason: `${matchedFile.name} was one of your recent document picks in ${insight.title}.`,
    actionLabel: 'Open again',
    evidence: buildEvidence(matchedFile, ['Opened recently']),
    primaryFile: matchedFile,
    priority: 150 + Math.min(12, Math.round((Date.now() - recentFile.lastOpenedAt) / 3_600_000) * -1 + 12),
  };
}

function createNeedsReviewItem(insight: FolderInsight, file: any): WorkInboxItem {
  const id = `${insight.id}:needs-review:${file.path}`;
  return {
    id,
    stateKey: createStateKey(id, file),
    type: 'needs_review',
    actionMode: 'open_file',
    isPinnedWorkspace: false,
    workspaceId: insight.id,
    workspaceTitle: insight.title,
    kindLabel: 'Needs review',
    title: `Review ${file.name}`,
    reason: `${file.name} changed since your last visit to ${insight.title}.`,
    actionLabel: 'Review file',
    evidence: buildEvidence(file, ['Changed after your last inbox visit']),
    primaryFile: file,
    priority: 130,
  };
}

function createOpenNowItem(insight: FolderInsight, isPinnedWorkspace: boolean): WorkInboxItem {
  const id = `${insight.id}:open-now`;
  return {
    id,
    stateKey: createStateKey(id, insight.topFile),
    type: 'open_now',
    actionMode: 'open_file',
    isPinnedWorkspace,
    workspaceId: insight.id,
    workspaceTitle: insight.title,
    kindLabel: 'Open now',
    title: `Open ${insight.topFile.name}`,
    reason: insight.summary,
    actionLabel: 'Open document',
    evidence: buildEvidence(insight.topFile, insight.rationale?.slice(0, 1) ?? []),
    primaryFile: insight.topFile,
    priority: 100 + Math.round(insight.workspaceScore) + (isPinnedWorkspace ? 40 : 0),
  };
}

function createVersionConflictItem(insight: FolderInsight, isPinnedWorkspace: boolean): WorkInboxItem | null {
  const group = insight.versionGroups[0];
  if (!group) {
    return null;
  }

  const id = `${insight.id}:version-conflict`;
  return {
    id,
    stateKey: createStateKey(id, group.latestFile, [group.variantCount]),
    type: 'version_conflict',
    actionMode: 'open_workspace',
    isPinnedWorkspace,
    workspaceId: insight.id,
    workspaceTitle: insight.title,
    kindLabel: 'Version conflict',
    title: `Resolve ${group.title} versions`,
    reason: `${group.variantCount} alternates are competing in ${insight.title}.`,
    actionLabel: 'Open latest file',
    evidence: buildEvidence(group.latestFile, [`${group.variantCount} alternates detected`]),
    primaryFile: group.latestFile,
    priority: 80 + group.variantCount * 2 + (isPinnedWorkspace ? 20 : 0),
  };
}

function createOcrAttentionItem(insight: FolderInsight, isPinnedWorkspace: boolean): WorkInboxItem | null {
  if (insight.ocrCount <= 0) {
    return null;
  }

  const id = `${insight.id}:ocr-attention`;
  return {
    id,
    stateKey: createStateKey(id, insight.topFile, [insight.ocrCount]),
    type: 'ocr_attention',
    actionMode: 'open_workspace',
    isPinnedWorkspace,
    workspaceId: insight.id,
    workspaceTitle: insight.title,
    kindLabel: 'OCR attention',
    title: `Review OCR candidates`,
    reason: `${insight.ocrCount} scanned ${insight.ocrCount === 1 ? 'file still needs OCR-ready text' : 'files still need OCR-ready text'} in ${insight.title}.`,
    actionLabel: 'Open workspace file',
    evidence: [`${insight.ocrCount} scanned ${insight.ocrCount === 1 ? 'file is' : 'files are'} still incomplete`],
    primaryFile: insight.topFile,
    priority: 60 + insight.ocrCount + (isPinnedWorkspace ? 16 : 0),
  };
}

function createRecentChangeItem(insight: FolderInsight, isPinnedWorkspace: boolean): WorkInboxItem | null {
  const recentFile = insight.recentFiles[0];
  if (!recentFile || insight.recentCount <= 0) {
    return null;
  }

  const id = `${insight.id}:recent-change`;
  return {
    id,
    stateKey: createStateKey(id, recentFile, [insight.recentCount]),
    type: 'recent_change',
    actionMode: 'open_workspace',
    isPinnedWorkspace,
    workspaceId: insight.id,
    workspaceTitle: insight.title,
    kindLabel: 'Recent change',
    title: `Check recent updates`,
    reason: `${insight.recentCount} ${insight.recentCount === 1 ? 'file changed' : 'files changed'} recently in ${insight.title}.`,
    actionLabel: 'Open changed file',
    evidence: buildEvidence(recentFile, ['Changed in the last 7 days']),
    primaryFile: recentFile,
    priority: 40 + insight.recentCount + (isPinnedWorkspace ? 14 : 0),
  };
}

function findInsightForFile(insights: FolderInsight[], path: string) {
  return insights.find((insight) => insight.path === path.replace(/[/\\][^/\\]+$/, ''));
}

function findFileInInsight(insight: FolderInsight | undefined, path: string) {
  if (!insight) {
    return null;
  }

  return insight.importantFiles.find((file) => file.path === path)
    ?? insight.recentFiles.find((file) => file.path === path)
    ?? (insight.topFile.path === path ? insight.topFile : null);
}

function createContinueNowItems(insights: FolderInsight[], activity?: WorkInboxActivitySnapshot) {
  if (!activity?.recentFiles?.length) {
    return [];
  }

  return activity.recentFiles
    .map((recentFile) => {
      const insight = findInsightForFile(insights, recentFile.path);
      const matchedFile = findFileInInsight(insight, recentFile.path);
      if (!insight || !matchedFile) {
        return null;
      }

      return createContinueNowItem(
        recentFile,
        matchedFile,
        insight,
        activity?.pinnedWorkspaceIds?.includes(insight.id) ?? false,
      );
    })
    .filter((item): item is WorkInboxItem => Boolean(item))
    .slice(0, 2);
}

function createNeedsReviewItems(insights: FolderInsight[], activity?: WorkInboxActivitySnapshot) {
  const lastInboxVisitAt = activity?.lastInboxVisitAt;
  if (!lastInboxVisitAt) {
    return [];
  }

  return insights
    .map((insight) => {
      const changedImportantFile = insight.importantFiles.find((file) => file.lastModified > lastInboxVisitAt)
        ?? (insight.topFile.lastModified > lastInboxVisitAt ? insight.topFile : null);

      if (!changedImportantFile) {
        return null;
      }

      const item = createNeedsReviewItem(insight, changedImportantFile);
      if (activity?.pinnedWorkspaceIds?.includes(insight.id)) {
        item.priority += 24;
        item.isPinnedWorkspace = true;
      }
      return item;
    })
    .filter((item): item is WorkInboxItem => Boolean(item))
    .slice(0, 2);
}

export function buildWorkInboxItems(insights: FolderInsight[], activity?: WorkInboxActivitySnapshot) {
  const items: WorkInboxItem[] = [];
  const dismissedItemKeys = new Set(activity?.dismissedItemKeys ?? []);
  const pinnedWorkspaceIds = new Set(activity?.pinnedWorkspaceIds ?? []);

  items.push(...createContinueNowItems(insights, activity));
  items.push(...createNeedsReviewItems(insights, activity));

  for (const insight of insights) {
    const isPinnedWorkspace = pinnedWorkspaceIds.has(insight.id);
    items.push(createOpenNowItem(insight, isPinnedWorkspace));

    const versionConflictItem = createVersionConflictItem(insight, isPinnedWorkspace);
    if (versionConflictItem) {
      items.push(versionConflictItem);
    }

    const ocrAttentionItem = createOcrAttentionItem(insight, isPinnedWorkspace);
    if (ocrAttentionItem) {
      items.push(ocrAttentionItem);
    }

    const recentChangeItem = createRecentChangeItem(insight, isPinnedWorkspace);
    if (recentChangeItem) {
      items.push(recentChangeItem);
    }
  }

  return items
    .filter((item) => !dismissedItemKeys.has(item.stateKey) && !dismissedItemKeys.has(item.id))
    .filter((item, index, collection) => (
      collection.findIndex((candidate) => candidate.id === item.id) === index
    ))
    .sort((a, b) => b.priority - a.priority || a.title.localeCompare(b.title))
    .slice(0, 6);
}
