import { render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { AppMonitoring } from '@/components/telemetry/app-monitoring';
import { logEvent } from '@/lib/telemetry/logger';

vi.mock('@/lib/telemetry/logger', () => ({
  logEvent: vi.fn(),
}));

const logEventMock = vi.mocked(logEvent);

describe('AppMonitoring', () => {
  it('logs global browser errors and unhandled rejections', () => {
    render(<AppMonitoring />);

    window.dispatchEvent(new ErrorEvent('error', {
      message: 'boom',
      filename: 'app.tsx',
      lineno: 12,
      colno: 4,
    }));
    window.dispatchEvent(new PromiseRejectionEvent('unhandledrejection', {
      promise: Promise.reject(new Error('ignored')).catch(() => undefined),
      reason: new Error('async boom'),
    }));

    expect(logEventMock).toHaveBeenCalledWith(
      expect.objectContaining({
        level: 'error',
        area: 'app',
        event: 'runtime.error',
        message: 'Unhandled frontend error',
        error: 'boom',
      })
    );
    expect(logEventMock).toHaveBeenCalledWith(
      expect.objectContaining({
        level: 'error',
        area: 'app',
        event: 'runtime.unhandled_rejection',
        message: 'Unhandled promise rejection',
        error: 'async boom',
      })
    );
  });
});
