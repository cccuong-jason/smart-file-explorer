import { beforeEach, describe, expect, it, vi } from 'vitest';
import { invoke } from '@tauri-apps/api/core';

import {
  exportDiagnosticBundle,
  getDiagnosticSnapshot,
} from '@/lib/telemetry/diagnostics';
import {
  clearRecentLogEvents,
  logEvent,
} from '@/lib/telemetry/logger';

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(),
}));

const invokeMock = vi.mocked(invoke);

describe('diagnostics API', () => {
  beforeEach(() => {
    invokeMock.mockReset();
    clearRecentLogEvents();
    Reflect.deleteProperty(window, '__TAURI_INTERNALS__');
  });

  it('returns a frontend fallback snapshot outside Tauri', async () => {
    await logEvent({
      level: 'warn',
      area: 'watch',
      event: 'event.received',
      message: 'Received event',
      correlationId: 'watch-1',
    });

    await expect(getDiagnosticSnapshot()).resolves.toEqual(
      expect.objectContaining({
        source: 'frontend-fallback',
        recentFrontendEvents: [
          expect.objectContaining({
            area: 'watch',
            event: 'event.received',
          }),
        ],
      })
    );
    expect(invokeMock).not.toHaveBeenCalled();
  });

  it('loads a native diagnostic snapshot inside Tauri', async () => {
    Object.defineProperty(window, '__TAURI_INTERNALS__', {
      value: {},
      configurable: true,
    });
    invokeMock.mockResolvedValueOnce({
      source: 'native',
      appVersion: '0.1.0',
        generatedAt: '2026-05-26T00:00:00.000Z',
        logFilePath: 'C:/logs/app.log',
        nativeLogFiles: [
          {
            path: 'C:/logs/app.log',
            truncated: false,
            content: '[INFO] ready',
          },
        ],
        watchedFolders: [],
        activeWatchRoots: [],
        recentFrontendEvents: [],
    });

    await expect(getDiagnosticSnapshot()).resolves.toEqual(
      expect.objectContaining({
        source: 'native',
        logFilePath: 'C:/logs/app.log',
        nativeLogFiles: [
          expect.objectContaining({
            path: 'C:/logs/app.log',
            content: '[INFO] ready',
          }),
        ],
      })
    );
    expect(invokeMock).toHaveBeenCalledWith('get_diagnostic_snapshot');
  });

  it('exports the native diagnostic bundle path', async () => {
    Object.defineProperty(window, '__TAURI_INTERNALS__', {
      value: {},
      configurable: true,
    });
    invokeMock.mockResolvedValueOnce('C:/tmp/sfe-diagnostics.json');

    await expect(exportDiagnosticBundle()).resolves.toBe('C:/tmp/sfe-diagnostics.json');
    expect(invokeMock).toHaveBeenCalledWith('export_diagnostic_bundle');
  });
});
