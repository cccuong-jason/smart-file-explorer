export const WORK_INBOX_ACTIVITY_KEY = 'sfe_work_inbox_activity';

export interface WorkInboxRecentFile {
  path: string;
  name: string;
  workspaceId?: string;
  workspaceTitle?: string;
  lastOpenedAt: number;
}

export interface WorkInboxActivitySnapshot {
  lastInboxVisitAt?: number;
  recentFiles: WorkInboxRecentFile[];
  pinnedWorkspaceIds: string[];
  dismissedItemKeys: string[];
}

function getStorage() {
  if (typeof window === 'undefined') {
    return null;
  }

  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

function sanitizeRecentFiles(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter((item): item is WorkInboxRecentFile => {
      if (!item || typeof item !== 'object') {
        return false;
      }

      const candidate = item as Partial<WorkInboxRecentFile>;
      return typeof candidate.path === 'string'
        && typeof candidate.name === 'string'
        && typeof candidate.lastOpenedAt === 'number';
    })
    .sort((a, b) => b.lastOpenedAt - a.lastOpenedAt)
    .slice(0, 8);
}

function sanitizeStringList(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }

  return Array.from(new Set(
    value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0),
  )).slice(0, 64);
}

export function getWorkInboxActivity(): WorkInboxActivitySnapshot {
  const storage = getStorage();
  if (!storage) {
    return { recentFiles: [], pinnedWorkspaceIds: [], dismissedItemKeys: [] };
  }

  try {
    const raw = storage.getItem(WORK_INBOX_ACTIVITY_KEY);
    if (!raw) {
      return { recentFiles: [], pinnedWorkspaceIds: [], dismissedItemKeys: [] };
    }

    const parsed = JSON.parse(raw) as Partial<WorkInboxActivitySnapshot>;
    return {
      lastInboxVisitAt: typeof parsed.lastInboxVisitAt === 'number' ? parsed.lastInboxVisitAt : undefined,
      recentFiles: sanitizeRecentFiles(parsed.recentFiles),
      pinnedWorkspaceIds: sanitizeStringList(parsed.pinnedWorkspaceIds),
      dismissedItemKeys: sanitizeStringList(parsed.dismissedItemKeys),
    };
  } catch {
    return { recentFiles: [], pinnedWorkspaceIds: [], dismissedItemKeys: [] };
  }
}

function saveWorkInboxActivity(snapshot: WorkInboxActivitySnapshot) {
  const storage = getStorage();
  if (!storage) {
    return snapshot;
  }

  storage.setItem(WORK_INBOX_ACTIVITY_KEY, JSON.stringify(snapshot));
  return snapshot;
}

export function recordWorkInboxVisit(now = Date.now()) {
  const snapshot = getWorkInboxActivity();
  return saveWorkInboxActivity({
    ...snapshot,
    lastInboxVisitAt: now,
  });
}

export function recordWorkInboxOpenFile(
  file: Omit<WorkInboxRecentFile, 'lastOpenedAt'>,
  now = Date.now(),
) {
  const snapshot = getWorkInboxActivity();
  const recentFiles = [
    {
      ...file,
      lastOpenedAt: now,
    },
    ...snapshot.recentFiles.filter((entry) => entry.path !== file.path),
  ].slice(0, 8);

  return saveWorkInboxActivity({
    ...snapshot,
    recentFiles,
  });
}

export function togglePinnedWorkspace(workspaceId: string) {
  const snapshot = getWorkInboxActivity();
  const pinnedWorkspaceIds = snapshot.pinnedWorkspaceIds.includes(workspaceId)
    ? snapshot.pinnedWorkspaceIds.filter((entry) => entry !== workspaceId)
    : [workspaceId, ...snapshot.pinnedWorkspaceIds];

  return saveWorkInboxActivity({
    ...snapshot,
    pinnedWorkspaceIds,
  });
}

export function dismissWorkInboxItem(itemKey: string) {
  const snapshot = getWorkInboxActivity();

  return saveWorkInboxActivity({
    ...snapshot,
    dismissedItemKeys: [itemKey, ...snapshot.dismissedItemKeys.filter((entry) => entry !== itemKey)].slice(0, 64),
  });
}

export function resetDismissedWorkInboxItems() {
  const snapshot = getWorkInboxActivity();

  return saveWorkInboxActivity({
    ...snapshot,
    dismissedItemKeys: [],
  });
}
