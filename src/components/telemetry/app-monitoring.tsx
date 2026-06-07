'use client';

import { useEffect } from 'react';

import { logEvent } from '@/lib/telemetry/logger';

function stringifyReason(reason: unknown) {
  if (reason instanceof Error) {
    return reason.message;
  }

  return typeof reason === 'string' ? reason : JSON.stringify(reason);
}

export function AppMonitoring() {
  useEffect(() => {
    const handleError = (event: ErrorEvent) => {
      void logEvent({
        level: 'error',
        area: 'app',
        event: 'runtime.error',
        message: 'Unhandled frontend error',
        error: event.message,
        data: {
          filename: event.filename,
          lineno: event.lineno,
          colno: event.colno,
        },
      });
    };

    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      void logEvent({
        level: 'error',
        area: 'app',
        event: 'runtime.unhandled_rejection',
        message: 'Unhandled promise rejection',
        error: stringifyReason(event.reason),
      });
    };

    window.addEventListener('error', handleError);
    window.addEventListener('unhandledrejection', handleUnhandledRejection);

    return () => {
      window.removeEventListener('error', handleError);
      window.removeEventListener('unhandledrejection', handleUnhandledRejection);
    };
  }, []);

  return null;
}
