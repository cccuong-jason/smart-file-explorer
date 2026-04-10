import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { convertFileSrc, invoke } from '@tauri-apps/api/core';
import { QuickLookModal } from '@/components/file-viewer/quick-look-modal';
import { I18nProvider } from '@/lib/i18n';

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(),
  convertFileSrc: vi.fn((path: string) => `asset://${path}`),
}));

const invokeMock = vi.mocked(invoke);
const convertFileSrcMock = vi.mocked(convertFileSrc);

const file = {
  path: '/docs/spec.md',
  name: 'spec.md',
  size: 2048,
  lastModified: new Date('2026-03-24T00:00:00Z').getTime(),
  content: '# Smart File Explorer',
};

describe('QuickLookModal', () => {
  beforeEach(() => {
    invokeMock.mockReset();
    convertFileSrcMock.mockClear();
    localStorage.clear();
  });

  it('returns null when closed or when no file is provided', () => {
    const { container, rerender } = render(
      <I18nProvider>
        <QuickLookModal isOpen={false} onClose={() => undefined} file={file} />
      </I18nProvider>
    );

    expect(container).toBeEmptyDOMElement();

    rerender(
      <I18nProvider>
        <QuickLookModal isOpen onClose={() => undefined} file={null} />
      </I18nProvider>
    );

    expect(container).toBeEmptyDOMElement();
  });

  it('renders localized content preview and opens files natively', async () => {
    const onClose = vi.fn();
    const user = userEvent.setup();

    render(
      <I18nProvider>
        <QuickLookModal isOpen onClose={onClose} file={file} />
      </I18nProvider>
    );

    expect(screen.getByText('Nội dung tài liệu')).toBeInTheDocument();
    expect(screen.getByText('# Smart File Explorer')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /mở bằng ứng dụng gốc/i }));

    expect(invokeMock).toHaveBeenCalledWith('open_file_native', { path: file.path });
    expect(onClose).toHaveBeenCalled();
  });

  it('truncates long previews and closes from escape or backdrop interactions', async () => {
    localStorage.setItem('i18n_lang', 'en');
    const onClose = vi.fn();
    const user = userEvent.setup();
    const longFile = {
      ...file,
      content: 'a'.repeat(20005),
    };

    render(
      <I18nProvider>
        <QuickLookModal isOpen onClose={onClose} file={longFile} />
      </I18nProvider>
    );

    expect(screen.getByText(/Content truncated for preview/i)).toBeInTheDocument();

    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);

    const backdrop = document.querySelector('.fixed.inset-0');
    expect(backdrop).not.toBeNull();
    if (backdrop instanceof HTMLElement) {
      await user.click(backdrop);
    }
    expect(onClose).toHaveBeenCalledTimes(2);
  });

  it('renders the unavailable preview state for non-text files', () => {
    render(
      <I18nProvider>
        <QuickLookModal isOpen onClose={() => undefined} file={{ ...file, content: '' }} />
      </I18nProvider>
    );

    expect(screen.getByText('Không thể xem trước')).toBeInTheDocument();
  });

  it('renders an image preview for image files', () => {
    render(
      <I18nProvider>
        <QuickLookModal
          isOpen
          onClose={() => undefined}
          file={{ ...file, name: 'hero.png', path: '/images/hero.png', content: '' }}
        />
      </I18nProvider>
    );

    const image = screen.getByRole('img', { name: /hero\.png/i });
    expect(image).toHaveAttribute('src', 'asset:///images/hero.png');
    expect(convertFileSrcMock).toHaveBeenCalledWith('/images/hero.png');
  });

  it('keeps the modal open when native open fails', async () => {
    const onClose = vi.fn();
    const user = userEvent.setup();
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    invokeMock.mockRejectedValue(new Error('boom'));

    render(
      <I18nProvider>
        <QuickLookModal isOpen onClose={onClose} file={file} />
      </I18nProvider>
    );

    await user.click(screen.getByRole('button', { name: /mở bằng ứng dụng gốc/i }));

    expect(onClose).not.toHaveBeenCalled();
    expect(errorSpy).toHaveBeenCalled();
    errorSpy.mockRestore();
  });
});
