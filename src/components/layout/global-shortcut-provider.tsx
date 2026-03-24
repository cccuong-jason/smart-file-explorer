'use client';

import { useEffect } from 'react';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { register, isRegistered } from '@tauri-apps/plugin-global-shortcut';

export function GlobalShortcutProvider() {
  useEffect(() => {
    const initShortcut = async () => {
      try {
        // Guard: only run inside Tauri and only from the main window
        if (typeof window === 'undefined' || !('__TAURI_INTERNALS__' in window)) return;

        const appWindow = getCurrentWindow();
        if (appWindow.label !== 'main') return;

        const shortcut = 'CommandOrControl+Shift+Space';
        const alreadyRegistered = await isRegistered(shortcut);

        if (!alreadyRegistered) {
          await register(shortcut, async (event) => {
            if (event.state !== 'Released') return;

            // Dynamically import to avoid SSR issues
            const { WebviewWindow } = await import('@tauri-apps/api/webviewWindow');
            const spotlight = await WebviewWindow.getByLabel('spotlight');
            if (spotlight) {
              await spotlight.show();
              await spotlight.setFocus();
            }
          });
          console.log('[ShortcutProvider] Registered:', shortcut);
        }
      } catch (err) {
        console.error('[ShortcutProvider] Failed to register global shortcut:', err);
      }
    };

    initShortcut();
  }, []);

  return null;
}
