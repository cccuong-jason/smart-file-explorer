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

export function getWorkInboxActivity(): WorkInboxActivitySnapshot {
  const storage = getStorage();
  if (!storage) {
    return { recentFiles: [] };
  }

  try {
    const raw = storage.getItem(WORK_INBOX_ACTIVITY_KEY);
    if (!raw) {
      return { recentFiles: [] };
    }

    const parsed = JSON.parse(raw) as Partial<WorkInboxActivitySnapshot>;
    return {
      lastInboxVisitAt: typeof parsed.lastInboxVisitAt === 'number' ? parsed.lastInboxVisitAt : undefined,
      recentFiles: sanitizeRecentFiles(parsed.recentFiles),
    };
  } catch {
    return { recentFiles: [] };
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
