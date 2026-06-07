import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { QuickLookModal } from '@/components/file-viewer/quick-look-modal';
import { StarterScanModal } from '@/components/onboarding/starter-scan-modal';
import { SettingsModal } from '@/components/settings/settings-modal';
import { Toaster } from '@/components/retroui/Sonner';
import { CopyPathInstructionModal } from '@/components/ui/copy-path-modal';
import { I18nProvider } from '@/lib/i18n';
import { toast } from 'sonner';

describe('light mode surfaces', () => {
  it('renders settings, onboarding, and preview overlays with tokenized light-mode surfaces', async () => {
    const { container } = render(
      <>
        <I18nProvider>
          <SettingsModal
            isOpen
            onClose={() => undefined}
            onClearIndex={() => undefined}
            cloudIntelligenceEnabled
            onCloudIntelligenceEnabledChange={() => undefined}
            cloudStatus={{
              configured: false,
              source: 'none',
              model: 'qwen/qwen3.6-plus',
            }}
            watchedFolders={[]}
            onToggleWatchedFolder={() => undefined}
            onRemoveWatchedFolder={() => undefined}
            onSaveCloudConfig={async () => ({
              configured: false,
              source: 'none',
              model: 'qwen/qwen3.6-plus',
            })}
            onTestCloudConnection={async () => ({
              configured: false,
              source: 'none',
              model: 'qwen/qwen3.6-plus',
            })}
            onClearCloudConfig={async () => ({
              configured: false,
              source: 'none',
              model: 'qwen/qwen3.6-plus',
            })}
          />
          <StarterScanModal
            isOpen
            suggestions={[
              {
                path: 'C:/Users/jason/Documents',
                label: 'Documents',
                description: 'Recommended docs',
              },
            ]}
            onStart={() => undefined}
            onDismiss={() => undefined}
            onBrowse={() => undefined}
          />
          <QuickLookModal
            isOpen
            onClose={() => undefined}
            file={{
              path: 'C:/Users/jason/Documents/proposal.doc',
              name: 'proposal.doc',
              size: 1200,
              lastModified: 123456,
              content: 'draft',
            }}
          />
          <CopyPathInstructionModal
            isOpen
            onClose={() => undefined}
            path="C:/Users/jason/Documents/proposal.doc"
          />
        </I18nProvider>
        <Toaster />
      </>
    );

    const markup = container.innerHTML;
    expect(markup).toContain('bg-card');
    expect(markup).toContain('bg-secondary');
    expect(markup).toContain('border-border');
  });

  it('renders toast cards with tokenized light-mode surfaces', async () => {
    const user = userEvent.setup();
    const { container } = render(
      <>
        <button type="button" onClick={() => toast.success('Saved')}>Trigger toast</button>
        <Toaster />
      </>
    );

    await user.click(screen.getByRole('button', { name: 'Trigger toast' }));

    await waitFor(() => {
      expect(container.innerHTML).toContain('bg-background');
      expect(container.innerHTML).toContain('border-border');
    });
  });
});
