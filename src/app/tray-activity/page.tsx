'use client';

import { useEffect, useRef, useState } from 'react';
import { listen } from '@tauri-apps/api/event';
import { WebviewWindow } from '@tauri-apps/api/webviewWindow';
import {
  PhysicalPosition,
  PhysicalSize,
  currentMonitor,
  getCurrentWindow,
} from '@tauri-apps/api/window';

import { TrayActivityPill } from '@/components/tray-activity/tray-activity-pill';
import {
  createTrayActivityDetected,
  TRAY_ACTIVITY_EVENT,
  type TrayActivityEventPayload,
  type TrayActivityState,
  shouldTrayActivityOwnWatchEvent,
} from '@/lib/tray-activity/state';
import { logEvent } from '@/lib/telemetry/logger';
import { createAsyncUnlistenGuard } from '@/lib/tauri/async-unlisten-guard';

const PILL_WIDTH = 320;
const PILL_HEIGHT = 106;
const PILL_MARGIN = 28;

export default function TrayActivityPage() {
  const [activity, setActivity] = useState<TrayActivityState | null>(null);
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const trayWindow = getCurrentWindow();

    const isMainWindowVisible = async () => {
      const mainWindow = await WebviewWindow.getByLabel('main');
      return await mainWindow?.isVisible().catch(() => false) ?? false;
    };

    const clearHideTimer = () => {
      if (hideTimerRef.current) {
        clearTimeout(hideTimerRef.current);
        hideTimerRef.current = null;
      }
    };

    const positionWindow = async () => {
      const monitor = await currentMonitor();
      if (!monitor) {
        return;
      }

      const x = monitor.position.x + monitor.size.width - PILL_WIDTH - PILL_MARGIN;
      const y = monitor.position.y + monitor.size.height - PILL_HEIGHT - PILL_MARGIN;

      await trayWindow.setSize(new PhysicalSize(PILL_WIDTH, PILL_HEIGHT));
      await trayWindow.setPosition(new PhysicalPosition(x, y));
    };

    const hideWindow = async () => {
      clearHideTimer();
      setActivity(null);
      void logEvent({
        level: 'debug',
        area: 'tray',
        event: 'activity.hide',
        message: 'Hiding tray activity window',
      });
      await trayWindow.hide().catch(() => undefined);
    };

    const showWindow = async (nextActivity: TrayActivityState) => {
      clearHideTimer();
      setActivity(nextActivity);
      void logEvent({
        level: 'info',
        area: 'tray',
        event: 'activity.show',
        message: `Showing tray activity for ${nextActivity.fileName}`,
        path: nextActivity.filePath,
        data: { kind: nextActivity.kind, progressPercent: nextActivity.kind === 'indexing' ? nextActivity.progressPercent : 100 },
      });
      await positionWindow().catch(() => undefined);
      await trayWindow.show().catch(() => undefined);
    };

    const scheduleHideForCompletion = (nextActivity: TrayActivityState) => {
      if (nextActivity.kind !== 'complete') {
        return;
      }

      const delay = Math.max(0, nextActivity.hideAt - Date.now());
      hideTimerRef.current = setTimeout(() => {
        void hideWindow();
      }, delay);
    };

    const unlistenGuard = createAsyncUnlistenGuard();

    const setup = async () => {
      try {
        await positionWindow().catch(() => undefined);

        unlistenGuard.add(
          await listen<TrayActivityEventPayload>(TRAY_ACTIVITY_EVENT, async (event) => {
            const nextActivity = event.payload.activity;

            if (!nextActivity) {
              await hideWindow();
              return;
            }

            await showWindow(nextActivity);
            scheduleHideForCompletion(nextActivity);
          })
        );

        unlistenGuard.add(
          await listen<{ kind: string; path: string }>('sys-file-event', async (event) => {
            const mainVisible = await isMainWindowVisible();
            if (!shouldTrayActivityOwnWatchEvent({ isMainWindowVisible: mainVisible })) {
              return;
            }

            const { kind, path } = event.payload;
            if (kind === 'remove') {
              void logEvent({
                level: 'info',
                area: 'tray',
                event: 'watch.remove',
                message: 'Received hidden-window remove event',
                path,
              });
              await hideWindow();
              return;
            }

            void logEvent({
              level: 'info',
              area: 'tray',
              event: 'watch.detected',
              message: 'Received hidden-window watched file event',
              path,
              data: { kind },
            });
            await showWindow(createTrayActivityDetected({ path, detectedAt: Date.now() }));
          })
        );

        unlistenGuard.add(
          await trayWindow.onFocusChanged(async ({ payload: focused }) => {
            if (!focused) {
              return;
            }

            await openMainWindow();
          })
        );

        unlistenGuard.add(
          await trayWindow.onScaleChanged(async () => {
            await positionWindow().catch(() => undefined);
          })
        );
      } catch (error) {
        void logEvent({
          level: 'error',
          area: 'tray',
          event: 'activity.listen_failed',
          message: 'Failed to subscribe tray activity listeners',
          error: error instanceof Error ? error.message : String(error),
        });
      }
    };

    const openMainWindow = async () => {
      const mainWindow = await WebviewWindow.getByLabel('main');
      if (mainWindow) {
        await mainWindow.show().catch(() => undefined);
        await mainWindow.setFocus().catch(() => undefined);
      }

      await hideWindow();
    };

    void setup();

    return () => {
      clearHideTimer();
      unlistenGuard.cleanup();
    };
  }, []);

  return (
    <main className="flex min-h-screen items-end justify-end bg-transparent p-4">
      <TrayActivityPill
        activity={activity}
        onOpenApp={async () => {
          const mainWindow = await WebviewWindow.getByLabel('main');
          if (mainWindow) {
            await mainWindow.show().catch(() => undefined);
            await mainWindow.setFocus().catch(() => undefined);
          }

          const trayWindow = getCurrentWindow();
          setActivity(null);
          await trayWindow.hide().catch(() => undefined);
        }}
      />
    </main>
  );
}
