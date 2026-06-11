import { describe, expect, it } from 'vitest';

import {
  createTrayActivityComplete,
  createTrayActivityIndexing,
  createTrayActivityDetected,
  getTrayActivityWindowPosition,
  getTrayActivityVisibility,
  isDuplicateTrayActivityUpdate,
  shouldShowTrayActivityForWatchEvent,
} from '@/lib/tray-activity/state';

describe('tray activity state', () => {
  it('stays hidden for passive watcher idle state', () => {
    expect(getTrayActivityVisibility(null, 1_000)).toBe('hidden');
  });

  it('shows indexing state for a brand-new watched file addition', () => {
    expect(
      shouldShowTrayActivityForWatchEvent({
        isNewWatchedAddition: true,
        isMainWindowVisible: false,
      })
    ).toBe(true);
  });

  it('shows new watched additions even while the main window is visible', () => {
    expect(
      shouldShowTrayActivityForWatchEvent({
        isNewWatchedAddition: true,
        isMainWindowVisible: true,
      })
    ).toBe(true);
  });

  it('ignores existing file updates', () => {
    expect(
      shouldShowTrayActivityForWatchEvent({
        isNewWatchedAddition: false,
        isMainWindowVisible: false,
      })
    ).toBe(false);

    expect(
      shouldShowTrayActivityForWatchEvent({
        isNewWatchedAddition: false,
        isMainWindowVisible: true,
      })
    ).toBe(false);
  });

  it('builds indexing progress with a friendly fallback label', () => {
    expect(
      createTrayActivityIndexing({
        path: 'C:/Users/jason/Downloads/proposal-final.docx',
        processedCount: 1,
        totalKnownCount: 4,
        watchLabel: 'Downloads',
        detectedAt: 1_000,
      })
    ).toEqual(
      expect.objectContaining({
        kind: 'indexing',
        fileName: 'proposal-final.docx',
        watchLabel: 'Downloads',
        progressPercent: 25,
      })
    );
  });

  it('builds a lightweight detected state from a native watch event path', () => {
    expect(
      createTrayActivityDetected({
        path: '\\\\?\\C:\\Users\\jason\\Downloads\\1mb (1).docx',
        detectedAt: 1_000,
      })
    ).toEqual(
      expect.objectContaining({
        kind: 'indexing',
        filePath: 'C:\\Users\\jason\\Downloads\\1mb (1).docx',
        fileName: '1mb (1).docx',
        progressPercent: 5,
      })
    );
  });

  it('emits a completion state that stays visible until its expiry time', () => {
    const completion = createTrayActivityComplete({
      path: 'C:/Users/jason/Downloads/proposal-final.docx',
      completedAt: 5_000,
      hideDelayMs: 3_000,
    });

    expect(getTrayActivityVisibility(completion, 7_500)).toBe('visible');
    expect(getTrayActivityVisibility(completion, 8_001)).toBe('hidden');
  });

  it('anchors the tray window to the bottom-right of the monitor work area', () => {
    expect(
      getTrayActivityWindowPosition({
        position: { x: 0, y: 0 },
        size: { width: 1920, height: 1080 },
        workArea: {
          position: { x: 0, y: 0 },
          size: { width: 1920, height: 1040 },
        },
      })
    ).toEqual({ x: 1584, y: 918 });
  });

  it('ignores duplicate tray activity updates for the same file and progress', () => {
    const first = createTrayActivityDetected({
      path: 'C:/Users/jason/Downloads/proposal-final.docx',
      detectedAt: 1_000,
    });
    const duplicate = createTrayActivityDetected({
      path: 'C:/Users/jason/Downloads/proposal-final.docx',
      detectedAt: 2_000,
    });
    const progress = createTrayActivityIndexing({
      path: 'C:/Users/jason/Downloads/proposal-final.docx',
      processedCount: 2,
      totalKnownCount: 4,
      detectedAt: 3_000,
    });

    expect(isDuplicateTrayActivityUpdate(first, duplicate)).toBe(true);
    expect(isDuplicateTrayActivityUpdate(first, progress)).toBe(false);
  });
});
