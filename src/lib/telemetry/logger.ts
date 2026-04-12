import { invoke } from '@tauri-apps/api/core';

type FrontendLogLevel = 'info' | 'warn' | 'error';

export async function logFrontendMessage(level: FrontendLogLevel, message: string, context?: string) {
  if (typeof window !== 'undefined' && !('__TAURI_INTERNALS__' in window)) {
    return;
  }

  try {
    await invoke('log_frontend_message', { level, message, context });
  } catch (error) {
    console.error('Failed to forward frontend log', error);
  }
}
