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
  TRAY_ACTIVITY_EVENT,
  type TrayActivityEventPayload,
  type TrayActivityState,
} from '@/lib/tray-activity/state';

const PILL_WIDTH = 320;
const PILL_HEIGHT = 106;
const PILL_MARGIN = 28;

export default function TrayActivityPage() {
  const [activity, setActivity] = useState<TrayActivityState | null>(null);
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
      await trayWindow.hide().catch(() => undefined);
    };

    const showWindow = async (nextActivity: TrayActivityState) => {
      clearHideTimer();
      setActivity(nextActivity);
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

    let unlistenEvent: (() => void) | undefined;
    let unlistenFocus: (() => void) | undefined;
    let unlistenScale: (() => void) | undefined;

    const setup = async () => {
      await positionWindow().catch(() => undefined);

      unlistenEvent = await listen<TrayActivityEventPayload>(TRAY_ACTIVITY_EVENT, async (event) => {
        const nextActivity = event.payload.activity;

        if (!nextActivity) {
          await hideWindow();
          return;
        }

        await showWindow(nextActivity);
        scheduleHideForCompletion(nextActivity);
      });

      unlistenFocus = await trayWindow.onFocusChanged(async ({ payload: focused }) => {
        if (!focused) {
          return;
        }

        await openMainWindow();
      });

      unlistenScale = await trayWindow.onScaleChanged(async () => {
        await positionWindow().catch(() => undefined);
      });
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
      unlistenEvent?.();
      unlistenFocus?.();
      unlistenScale?.();
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
