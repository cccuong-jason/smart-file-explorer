export type TrayActivityState =
  | {
      kind: 'indexing';
      filePath: string;
      fileName: string;
      watchLabel?: string;
      progressPercent: number;
      detectedAt: number;
    }
  | {
      kind: 'complete';
      filePath: string;
      fileName: string;
      hideAt: number;
    };

export const TRAY_ACTIVITY_EVENT = 'tray-activity:update';

export interface TrayActivityEventPayload {
  activity: TrayActivityState | null;
}

export function shouldShowTrayActivityForWatchEvent(options: {
  isNewWatchedAddition: boolean;
  isMainWindowVisible: boolean;
}) {
  return options.isNewWatchedAddition;
}

export function shouldTrayActivityOwnWatchEvent(options: {
  isMainWindowVisible: boolean;
}) {
  return !options.isMainWindowVisible;
}

export function createTrayActivityIndexing(options: {
  path: string;
  processedCount: number;
  totalKnownCount: number;
  watchLabel?: string;
  detectedAt: number;
}): TrayActivityState {
  const denominator = Math.max(1, options.totalKnownCount);
  const numerator = Math.max(0, Math.min(options.processedCount, denominator));

  return {
    kind: 'indexing',
    filePath: options.path,
    fileName: getFileName(options.path),
    watchLabel: options.watchLabel,
    progressPercent: Math.round((numerator / denominator) * 100),
    detectedAt: options.detectedAt,
  };
}

export function createTrayActivityDetected(options: {
  path: string;
  detectedAt: number;
  watchLabel?: string;
}): TrayActivityState {
  const normalizedPath = options.path
    .replace(/^\\\\\?\\/, '')
    .replace(/^\\\?\\/, '');

  return {
    kind: 'indexing',
    filePath: normalizedPath,
    fileName: getFileName(normalizedPath),
    watchLabel: options.watchLabel,
    progressPercent: 5,
    detectedAt: options.detectedAt,
  };
}

export function createTrayActivityComplete(options: {
  path: string;
  completedAt: number;
  hideDelayMs: number;
}): TrayActivityState {
  return {
    kind: 'complete',
    filePath: options.path,
    fileName: getFileName(options.path),
    hideAt: options.completedAt + options.hideDelayMs,
  };
}

export function getTrayActivityVisibility(
  activity: TrayActivityState | null,
  now = Date.now()
): 'visible' | 'hidden' {
  if (!activity) {
    return 'hidden';
  }

  if (activity.kind === 'complete') {
    return now <= activity.hideAt ? 'visible' : 'hidden';
  }

  return 'visible';
}

function getFileName(path: string) {
  const parts = path.split(/[\\/]/);
  return parts.at(-1) || path;
}
