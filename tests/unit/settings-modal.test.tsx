import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { SettingsModal } from '@/components/settings/settings-modal';
import { I18nProvider } from '@/lib/i18n';
import { ToastProvider } from '@/components/ui/toast';

describe('SettingsModal cloud intelligence', () => {
  const watchedFolders = [
    {
      path: 'C:/Users/jason/Documents/Acme',
      enabled: true,
      status: 'watching' as const,
      lastScanCompletedAt: 123456,
    },
  ];

  it('renders bring-your-own-key controls in a dedicated cloud tab', async () => {
    localStorage.setItem('i18n_lang', 'en');
    const user = userEvent.setup();
    const onCloudIntelligenceEnabledChange = vi.fn();

    render(
      <ToastProvider>
        <I18nProvider>
          <SettingsModal
            isOpen
            onClose={vi.fn()}
            onClearIndex={vi.fn()}
            cloudIntelligenceEnabled
            onCloudIntelligenceEnabledChange={onCloudIntelligenceEnabledChange}
            cloudStatus={{
              configured: false,
              source: 'user',
              model: 'qwen/qwen3.6-plus',
            }}
            watchedFolders={watchedFolders}
            onToggleWatchedFolder={vi.fn()}
            onRemoveWatchedFolder={vi.fn()}
            onSaveCloudConfig={vi.fn()}
            onTestCloudConnection={vi.fn()}
            onClearCloudConfig={vi.fn()}
          />
        </I18nProvider>
      </ToastProvider>
    );

    await user.click(screen.getByRole('button', { name: /cloud intelligence/i }));

    expect(screen.getByRole('heading', { name: /Cloud intelligence/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/OpenRouter API key/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Model/i)).toHaveValue('qwen/qwen3.6-plus');
    expect(screen.getByRole('button', { name: /Test connection/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Save key/i })).toBeInTheDocument();
  });

  it('shows an inline error when cloud connection testing fails', async () => {
    localStorage.setItem('i18n_lang', 'en');
    const user = userEvent.setup();
    const onTestCloudConnection = vi.fn().mockRejectedValueOnce(new Error('Connection failed'));

    render(
      <ToastProvider>
        <I18nProvider>
          <SettingsModal
            isOpen
            onClose={vi.fn()}
            onClearIndex={vi.fn()}
            cloudIntelligenceEnabled
            onCloudIntelligenceEnabledChange={vi.fn()}
            cloudStatus={{
              configured: false,
              source: 'none',
              model: 'qwen/qwen3.6-plus',
            }}
            watchedFolders={watchedFolders}
            onToggleWatchedFolder={vi.fn()}
            onRemoveWatchedFolder={vi.fn()}
            onSaveCloudConfig={vi.fn()}
            onTestCloudConnection={onTestCloudConnection}
            onClearCloudConfig={vi.fn()}
          />
        </I18nProvider>
      </ToastProvider>
    );

    await user.click(screen.getByRole('button', { name: /cloud intelligence/i }));
    await user.type(screen.getByLabelText(/OpenRouter API key/i), 'sk-or-test-key');
    await user.click(screen.getByRole('button', { name: /test connection/i }));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(/Connection failed/i);
    });
  });

  it('passes the typed key through as entered so backend normalization can handle it', async () => {
    localStorage.setItem('i18n_lang', 'en');
    const user = userEvent.setup();
    const onTestCloudConnection = vi.fn().mockResolvedValue({
      configured: true,
      source: 'user',
      model: 'qwen/qwen3.6-plus',
    });

    render(
      <ToastProvider>
        <I18nProvider>
          <SettingsModal
            isOpen
            onClose={vi.fn()}
            onClearIndex={vi.fn()}
            cloudIntelligenceEnabled
            onCloudIntelligenceEnabledChange={vi.fn()}
            cloudStatus={{
              configured: false,
              source: 'none',
              model: 'qwen/qwen3.6-plus',
            }}
            watchedFolders={watchedFolders}
            onToggleWatchedFolder={vi.fn()}
            onRemoveWatchedFolder={vi.fn()}
            onSaveCloudConfig={vi.fn()}
            onTestCloudConnection={onTestCloudConnection}
            onClearCloudConfig={vi.fn()}
          />
        </I18nProvider>
      </ToastProvider>
    );

    await user.click(screen.getByRole('button', { name: /cloud intelligence/i }));
    await user.type(screen.getByLabelText(/OpenRouter API key/i), 'Bearer sk-or-test-key');
    await user.click(screen.getByRole('button', { name: /test connection/i }));

    await waitFor(() => {
      expect(onTestCloudConnection).toHaveBeenCalledWith({
        apiKey: 'Bearer sk-or-test-key',
        model: 'qwen/qwen3.6-plus',
      });
    });
  });

  it('lists watched folders and lets the user disable or remove them', async () => {
    localStorage.setItem('i18n_lang', 'en');
    const user = userEvent.setup();
    const onToggleWatchedFolder = vi.fn();
    const onRemoveWatchedFolder = vi.fn();

    render(
      <ToastProvider>
        <I18nProvider>
          <SettingsModal
            isOpen
            onClose={vi.fn()}
            onClearIndex={vi.fn()}
            cloudIntelligenceEnabled
            onCloudIntelligenceEnabledChange={vi.fn()}
            cloudStatus={{
              configured: false,
              source: 'none',
              model: 'qwen/qwen3.6-plus',
            }}
            watchedFolders={watchedFolders}
            onToggleWatchedFolder={onToggleWatchedFolder}
            onRemoveWatchedFolder={onRemoveWatchedFolder}
            onSaveCloudConfig={vi.fn()}
            onTestCloudConnection={vi.fn()}
            onClearCloudConfig={vi.fn()}
          />
        </I18nProvider>
      </ToastProvider>
    );

    await user.click(screen.getByRole('button', { name: /privacy/i }));

    expect(screen.getByText(/Scanned folders stay watched for new files while the app is running/i)).toBeInTheDocument();
    expect(screen.getByText('C:/Users/jason/Documents/Acme')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /turn off watching/i }));
    await user.click(screen.getByRole('button', { name: /remove watched folder/i }));

    expect(onToggleWatchedFolder).toHaveBeenCalledWith('C:/Users/jason/Documents/Acme', false);
    expect(onRemoveWatchedFolder).toHaveBeenCalledWith('C:/Users/jason/Documents/Acme');
  });
});
