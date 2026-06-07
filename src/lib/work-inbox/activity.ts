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
  workspaceVisits?: Record<string, number>;
  pinnedItemIds: string[];
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

function sanitizeWorkspaceVisits(value: unknown) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(value)
      .filter(([workspaceId, timestamp]) => (
        typeof workspaceId === 'string'
        && workspaceId.trim().length > 0
        && typeof timestamp === 'number'
        && Number.isFinite(timestamp)
      ))
      .slice(0, 128),
  ) as Record<string, number>;
}

export function getWorkInboxActivity(): WorkInboxActivitySnapshot {
  const storage = getStorage();
  if (!storage) {
    return { recentFiles: [], workspaceVisits: {}, pinnedItemIds: [], dismissedItemKeys: [] };
  }

  try {
    const raw = storage.getItem(WORK_INBOX_ACTIVITY_KEY);
    if (!raw) {
      return { recentFiles: [], workspaceVisits: {}, pinnedItemIds: [], dismissedItemKeys: [] };
    }

    const parsed = JSON.parse(raw) as Partial<WorkInboxActivitySnapshot> & { pinnedWorkspaceIds?: string[] };
    const pinnedItemIds = sanitizeStringList(parsed.pinnedItemIds);
    const legacyPinnedWorkspaceIds = sanitizeStringList(parsed.pinnedWorkspaceIds).map((workspaceId) => `${workspaceId}:open-now`);

    return {
      lastInboxVisitAt: typeof parsed.lastInboxVisitAt === 'number' ? parsed.lastInboxVisitAt : undefined,
      recentFiles: sanitizeRecentFiles(parsed.recentFiles),
      workspaceVisits: sanitizeWorkspaceVisits(parsed.workspaceVisits),
      pinnedItemIds: pinnedItemIds.length > 0 ? pinnedItemIds : legacyPinnedWorkspaceIds,
      dismissedItemKeys: sanitizeStringList(parsed.dismissedItemKeys),
    };
  } catch {
    return { recentFiles: [], workspaceVisits: {}, pinnedItemIds: [], dismissedItemKeys: [] };
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
  const workspaceVisits = file.workspaceId
    ? {
      ...(snapshot.workspaceVisits ?? {}),
      [file.workspaceId]: now,
    }
    : (snapshot.workspaceVisits ?? {});
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
    workspaceVisits,
  });
}

export function recordWorkInboxWorkspaceVisit(workspaceId: string, now = Date.now()) {
  const snapshot = getWorkInboxActivity();

  return saveWorkInboxActivity({
    ...snapshot,
    workspaceVisits: {
      ...(snapshot.workspaceVisits ?? {}),
      [workspaceId]: now,
    },
  });
}

export function togglePinnedInboxItem(itemId: string) {
  const snapshot = getWorkInboxActivity();
  const pinnedItemIds = snapshot.pinnedItemIds.includes(itemId)
    ? snapshot.pinnedItemIds.filter((entry) => entry !== itemId)
    : [itemId, ...snapshot.pinnedItemIds];

  return saveWorkInboxActivity({
    ...snapshot,
    pinnedItemIds,
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
