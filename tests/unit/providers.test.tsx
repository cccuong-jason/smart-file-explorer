import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { I18nProvider, useTranslation } from '@/lib/i18n';
import { ThemeProvider, useTheme } from '@/lib/theme-provider';

function I18nProbe() {
  const { language, setLanguage, t } = useTranslation();

  return (
    <div>
      <span>{language}</span>
      <span>{t('open_settings')}</span>
      <span>{t('showing_files', { count: 2, total: 5 })}</span>
      <span>{t('missing_key')}</span>
      <button onClick={() => setLanguage('en')}>toggle</button>
    </div>
  );
}

function ThemeProbe() {
  const { theme, setTheme } = useTheme();

  return (
    <div>
      <span>{theme}</span>
      <button onClick={() => setTheme('dark')}>dark</button>
      <button onClick={() => setTheme('light')}>light</button>
      <button onClick={() => setTheme('system')}>system</button>
    </div>
  );
}

function TranslationHookGuard() {
  useTranslation();
  return null;
}

function ThemeHookGuard() {
  useTheme();
  return null;
}

describe('providers', () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.classList.remove('dark');
  });

  it('uses Vietnamese by default and persists language changes', async () => {
    const user = userEvent.setup();
    render(
      <I18nProvider>
        <I18nProbe />
      </I18nProvider>
    );

    expect(screen.getByText('vi')).toBeInTheDocument();
    expect(screen.getByText('Mở Cài đặt')).toBeInTheDocument();
    expect(screen.getByText('Đang hiển thị 2 trong số 5 tệp')).toBeInTheDocument();
    expect(screen.getByText('missing_key')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'toggle' }));

    expect(screen.getByText('en')).toBeInTheDocument();
    expect(localStorage.getItem('i18n_lang')).toBe('en');
    expect(document.documentElement.lang).toBe('en');
  });

  it('restores persisted language on mount and ignores invalid values', () => {
    localStorage.setItem('i18n_lang', 'en');

    const { rerender } = render(
      <I18nProvider>
        <I18nProbe />
      </I18nProvider>
    );

    expect(screen.getByText('en')).toBeInTheDocument();
    expect(screen.getByText('Open Settings')).toBeInTheDocument();

    localStorage.setItem('i18n_lang', 'fr');
    rerender(
      <I18nProvider>
        <I18nProbe />
      </I18nProvider>
    );

    expect(screen.getByText('en')).toBeInTheDocument();
  });

  it('applies and persists theme changes', async () => {
    const user = userEvent.setup();
    render(
      <ThemeProvider>
        <ThemeProbe />
      </ThemeProvider>
    );

    expect(screen.getAllByText('system')[0]).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'dark' }));

    expect(screen.getAllByText('dark')[0]).toBeInTheDocument();
    expect(localStorage.getItem('theme_mode')).toBe('dark');
    expect(document.documentElement.classList.contains('dark')).toBe(true);
  });

  it('restores persisted theme, supports transitions, and reacts to system changes', async () => {
    let changeListener: (() => void) | undefined;
    let matches = false;
    const addEventListener = vi.fn((event: string, listener: () => void) => {
      if (event === 'change') {
        changeListener = listener;
      }
    });
    const removeEventListener = vi.fn();

    window.matchMedia = vi.fn().mockImplementation(() => ({
      get matches() {
        return matches;
      },
      media: '(prefers-color-scheme: dark)',
      onchange: null,
      addEventListener,
      removeEventListener,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }));

    localStorage.setItem('theme_mode', 'light');
    const user = userEvent.setup();

    const { unmount } = render(
      <ThemeProvider>
        <ThemeProbe />
      </ThemeProvider>
    );

    expect(screen.getAllByText('light')[0]).toBeInTheDocument();
    expect(document.documentElement.classList.contains('dark')).toBe(false);

    await user.click(screen.getByRole('button', { name: 'system' }));
    expect(localStorage.getItem('theme_mode')).toBe('system');
    expect(addEventListener).toHaveBeenCalled();

    matches = true;
    changeListener?.();
    expect(document.documentElement.classList.contains('dark')).toBe(true);

    unmount();
    expect(removeEventListener).toHaveBeenCalled();
  });

  it('ignores invalid persisted theme values', () => {
    localStorage.setItem('theme_mode', 'sepia');

    render(
      <ThemeProvider>
        <ThemeProbe />
      </ThemeProvider>
    );

    expect(screen.getAllByText('system')[0]).toBeInTheDocument();
  });

  it('throws when hooks are used outside their providers', () => {
    expect(() => render(<TranslationHookGuard />)).toThrow('useTranslation must be used within an I18nProvider');
    expect(() => render(<ThemeHookGuard />)).toThrow('useTheme must be used within a ThemeProvider');
  });
});
