import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { FilePreviewPanel } from '@/components/file-viewer/file-preview-panel';
import { I18nProvider } from '@/lib/i18n';

vi.mock('@tauri-apps/api/core', () => ({
  convertFileSrc: vi.fn((path: string) => `asset://${path}`),
}));

const metadataOnlyFile = {
  path: '/docs/stuck.pdf',
  name: 'stuck.pdf',
  size: 2048,
  lastModified: new Date('2026-03-24T00:00:00Z').getTime(),
  indexingStage: 'metadata',
  content: '',
};

describe('FilePreviewPanel', () => {
  it('shows an idle fallback instead of infinite analyzing copy when scanning is not running', () => {
    localStorage.setItem('i18n_lang', 'en');

    render(
      <I18nProvider>
        <FilePreviewPanel file={metadataOnlyFile} isScanning={false} />
      </I18nProvider>
    );

    expect(screen.getByText(/Preview is not ready yet/i)).toBeInTheDocument();
    expect(screen.queryByText(/Still analyzing this file/i)).not.toBeInTheDocument();
  });

  it('keeps the active analyzing copy while scanning is running', () => {
    localStorage.setItem('i18n_lang', 'en');

    render(
      <I18nProvider>
        <FilePreviewPanel file={metadataOnlyFile} isScanning />
      </I18nProvider>
    );

    expect(screen.getByText(/Still analyzing this file/i)).toBeInTheDocument();
  });
});
