import { invoke } from '@tauri-apps/api/core';

import { getRecentLogEvents, type LogEvent } from './logger';

export interface DiagnosticSnapshot {
  source: 'native' | 'frontend-fallback';
  appVersion?: string;
  generatedAt: string;
  logFilePath?: string;
  nativeLogFiles?: Array<{ path: string; truncated: boolean; content: string }>;
  watchedFolders: Array<{ path: string; enabled: boolean; status: string }>;
  activeWatchRoots: string[];
  recentFrontendEvents: LogEvent[];
}

function isTauriRuntime() {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
}

function createFallbackSnapshot(): DiagnosticSnapshot {
  return {
    source: 'frontend-fallback',
    generatedAt: new Date().toISOString(),
    nativeLogFiles: [],
    watchedFolders: [],
    activeWatchRoots: [],
    recentFrontendEvents: getRecentLogEvents(),
  };
}

export async function getDiagnosticSnapshot(): Promise<DiagnosticSnapshot> {
  if (!isTauriRuntime()) {
    return createFallbackSnapshot();
  }

  try {
    return await invoke<DiagnosticSnapshot>('get_diagnostic_snapshot');
  } catch {
    return createFallbackSnapshot();
  }
}

export async function exportDiagnosticBundle(): Promise<string | null> {
  if (!isTauriRuntime()) {
    return null;
  }

  return invoke<string>('export_diagnostic_bundle');
}
