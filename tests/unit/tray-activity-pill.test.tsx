import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { TrayActivityPill } from '@/components/tray-activity/tray-activity-pill';
import { I18nProvider } from '@/lib/i18n';
import {
  createTrayActivityComplete,
  createTrayActivityIndexing,
} from '@/lib/tray-activity/state';

describe('tray activity pill', () => {
  it('renders indexing progress and opens the app on click', async () => {
    const onOpenApp = vi.fn();
    const user = userEvent.setup();

    render(
      <I18nProvider>
        <TrayActivityPill
          activity={createTrayActivityIndexing({
            path: 'C:/Users/jason/Downloads/proposal-final.docx',
            processedCount: 1,
            totalKnownCount: 4,
            watchLabel: 'Downloads',
            detectedAt: 1_000,
          })}
          onOpenApp={onOpenApp}
        />
      </I18nProvider>
    );

    expect(screen.getByText(/Indexing new file|Đang lập chỉ mục tệp mới/)).toBeInTheDocument();
    expect(screen.getByText('proposal-final.docx')).toBeInTheDocument();
    expect(screen.getByText('25%')).toBeInTheDocument();
    await user.click(screen.getByRole('button'));
    expect(onOpenApp).toHaveBeenCalledOnce();
  });

  it('renders the completion state', () => {
    render(
      <I18nProvider>
        <TrayActivityPill
          activity={createTrayActivityComplete({
            path: 'C:/Users/jason/Downloads/proposal-final.docx',
            completedAt: 5_000,
            hideDelayMs: 2_200,
          })}
          onOpenApp={() => undefined}
        />
      </I18nProvider>
    );

    expect(screen.getByText(/New file is ready|Tệp mới đã sẵn sàng/)).toBeInTheDocument();
    expect(screen.getByText(/Open app|Mở ứng dụng/)).toBeInTheDocument();
  });
});
