import { describe, expect, it } from 'vitest';

import {
  createTrayActivityComplete,
  createTrayActivityIndexing,
  getTrayActivityVisibility,
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

  it('ignores existing file updates and visible main-window activity', () => {
    expect(
      shouldShowTrayActivityForWatchEvent({
        isNewWatchedAddition: false,
        isMainWindowVisible: false,
      })
    ).toBe(false);

    expect(
      shouldShowTrayActivityForWatchEvent({
        isNewWatchedAddition: true,
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

  it('emits a completion state that stays visible until its expiry time', () => {
    const completion = createTrayActivityComplete({
      path: 'C:/Users/jason/Downloads/proposal-final.docx',
      completedAt: 5_000,
      hideDelayMs: 3_000,
    });

    expect(getTrayActivityVisibility(completion, 7_500)).toBe('visible');
    expect(getTrayActivityVisibility(completion, 8_001)).toBe('hidden');
  });
});
