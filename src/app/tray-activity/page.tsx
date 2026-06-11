'use client';

import { useEffect, useRef, useState } from 'react';
import { listen } from '@tauri-apps/api/event';
import { WebviewWindow } from '@tauri-apps/api/webviewWindow';
import {
  PhysicalPosition,
  PhysicalSize,
  currentMonitor,
  getCurrentWindow,
  primaryMonitor,
} from '@tauri-apps/api/window';

import { TrayActivityPill } from '@/components/tray-activity/tray-activity-pill';
import {
  getTrayActivityWindowPosition,
  isDuplicateTrayActivityUpdate,
  TRAY_ACTIVITY_EVENT,
  TRAY_ACTIVITY_WINDOW_HEIGHT,
  TRAY_ACTIVITY_WINDOW_WIDTH,
  type TrayActivityEventPayload,
  type TrayActivityState,
} from '@/lib/tray-activity/state';
import { logEvent } from '@/lib/telemetry/logger';
import { createAsyncUnlistenGuard } from '@/lib/tauri/async-unlisten-guard';

export default function TrayActivityPage() {
  const [activity, setActivity] = useState<TrayActivityState | null>(null);
  const activityRef = useRef<TrayActivityState | null>(null);
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const trayWindow = getCurrentWindow();

    const clearHideTimer = () => {
      if (hideTimerRef.current) {
        clearTimeout(hideTimerRef.current);
        hideTimerRef.current = null;
      }
    };

    const positionWindow = async () => {
      const monitor = await primaryMonitor() ?? await currentMonitor();
      if (!monitor) {
        return;
      }

      const position = getTrayActivityWindowPosition(monitor);

      await trayWindow.setSize(new PhysicalSize(TRAY_ACTIVITY_WINDOW_WIDTH, TRAY_ACTIVITY_WINDOW_HEIGHT));
      await trayWindow.setPosition(new PhysicalPosition(position.x, position.y));
    };

    const hideWindow = async () => {
      clearHideTimer();
      if (!activityRef.current) {
        await trayWindow.hide().catch(() => undefined);
        return;
      }

      activityRef.current = null;
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
      if (isDuplicateTrayActivityUpdate(activityRef.current, nextActivity)) {
        await positionWindow().catch(() => undefined);
        return;
      }

      clearHideTimer();
      activityRef.current = nextActivity;
      setActivity(nextActivity);
      void logEvent({
        level: 'info',
        area: 'tray',
        event: 'activity.show',
        message: `Showing tray activity for ${nextActivity.fileName}`,
        path: nextActivity.filePath,
        data: { kind: nextActivity.kind, progressPercent: nextActivity.kind === 'indexing' ? nextActivity.progressPercent : 100 },
      });
      await trayWindow.setFocusable(false).catch(() => undefined);
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

    void setup();

    return () => {
      clearHideTimer();
      unlistenGuard.cleanup();
    };
  }, []);

  return (
    <main className="flex h-screen w-screen bg-card">
      <TrayActivityPill
        activity={activity}
        onOpenApp={async () => {
          const mainWindow = await WebviewWindow.getByLabel('main');
          if (mainWindow) {
            await mainWindow.show().catch(() => undefined);
            await mainWindow.setFocus().catch(() => undefined);
          }

          const trayWindow = getCurrentWindow();
          activityRef.current = null;
          setActivity(null);
          await trayWindow.hide().catch(() => undefined);
        }}
      />
    </main>
  );
}
