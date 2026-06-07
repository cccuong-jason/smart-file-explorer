export type ScanSessionPhase = 'discovering' | 'indexing' | 'finalizing';
export type ScanSessionScope = 'foreground' | 'background';

export interface ScanSessionProgress {
  sessionId: string;
  scope: ScanSessionScope;
  phase: ScanSessionPhase;
  discoveredCount: number;
  queuedCount: number;
  processedCount: number;
  failedCount: number;
  totalKnownCount: number;
  currentPath: string;
  isPaused: boolean;
  watchPath?: string;
}

export interface NativeScanSessionEvent {
  eventType: 'started' | 'batch' | 'completed' | 'error' | 'cancelled';
  sessionId: string;
  scope: ScanSessionScope;
  phase: ScanSessionPhase;
  discoveredCount: number;
  totalKnownCount: number;
  currentPath?: string;
  watchPath?: string;
  batch?: Array<{
    path: string;
    name: string;
    size: number;
    type: string;
    lastModified: number;
  }>;
  error?: string;
}

export function createEmptyScanSessionProgress(
  sessionId = '',
  scope: ScanSessionScope = 'foreground'
): ScanSessionProgress {
  return {
    sessionId,
    scope,
    phase: 'discovering',
    discoveredCount: 0,
    queuedCount: 0,
    processedCount: 0,
    failedCount: 0,
    totalKnownCount: 0,
    currentPath: '',
    isPaused: false,
  };
}

export function isScanSessionActive(progress: ScanSessionProgress | null) {
  if (!progress || !progress.sessionId) {
    return false;
  }

  return progress.phase !== 'finalizing' || progress.queuedCount > 0;
}
