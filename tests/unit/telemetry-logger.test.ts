import { beforeEach, describe, expect, it, vi } from 'vitest';
import { invoke } from '@tauri-apps/api/core';

import {
  clearRecentLogEvents,
  createLogEvent,
  getRecentLogEvents,
  logEvent,
  logFrontendMessage,
  subscribeToLogEvents,
} from '@/lib/telemetry/logger';

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(),
}));

const invokeMock = vi.mocked(invoke);

describe('telemetry logger', () => {
  beforeEach(() => {
    clearRecentLogEvents();
    invokeMock.mockReset();
    Reflect.deleteProperty(window, '__TAURI_INTERNALS__');
  });

  it('creates structured events with redacted sensitive data', () => {
    const event = createLogEvent({
      level: 'info',
      area: 'cloud',
      event: 'settings.save',
      message: 'Saving key',
      data: {
        apiKey: 'sk-secret',
        nested: {
          token: 'secret-token',
          visible: 'ok',
        },
      },
    });

    expect(event).toEqual(
      expect.objectContaining({
        level: 'info',
        area: 'cloud',
        event: 'settings.save',
        message: 'Saving key',
      })
    );
    expect(event.timestamp).toEqual(expect.any(String));
    expect(event.data).toEqual({
      apiKey: '[redacted]',
      nested: {
        token: '[redacted]',
        visible: 'ok',
      },
    });
  });

  it('stores recent events, notifies subscribers, and caps the buffer', async () => {
    const seen: string[] = [];
    const unsubscribe = subscribeToLogEvents((event) => seen.push(event.event));

    for (let index = 0; index < 260; index += 1) {
      await logEvent({
        level: 'info',
        area: 'app',
        event: `event.${index}`,
        message: `Event ${index}`,
      });
    }

    unsubscribe();

    expect(seen).toContain('event.259');
    expect(getRecentLogEvents()).toHaveLength(250);
    expect(getRecentLogEvents()[0]?.event).toBe('event.10');
  });

  it('forwards events to Tauri when available and never throws on invoke failure', async () => {
    Object.defineProperty(window, '__TAURI_INTERNALS__', {
      value: {},
      configurable: true,
    });
    invokeMock.mockRejectedValueOnce(new Error('native log unavailable'));

    await expect(
      logEvent({
        level: 'error',
        area: 'watch',
        event: 'metadata.failed',
        message: 'Metadata failed',
        path: 'C:/Users/jason/Downloads/file.docx',
      })
    ).resolves.toBeDefined();

    expect(invokeMock).toHaveBeenCalledWith(
      'log_frontend_event',
      expect.objectContaining({
        event: expect.objectContaining({
          level: 'error',
          area: 'watch',
          event: 'metadata.failed',
        }),
      })
    );
  });

  it('keeps legacy logFrontendMessage compatible with structured events', async () => {
    await logFrontendMessage('warn', 'Legacy warning', 'settings-cloud-save');

    expect(getRecentLogEvents()[0]).toEqual(
      expect.objectContaining({
        level: 'warn',
        area: 'settings',
        event: 'settings-cloud-save',
        message: 'Legacy warning',
      })
    );
  });
});
