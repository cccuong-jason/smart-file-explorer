import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SearchInput } from '@/components/search/search-input';
import { I18nProvider } from '@/lib/i18n';

describe('SearchInput', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('submits a query and stores recent history', async () => {
    const onSearch = vi.fn();
    const user = userEvent.setup();

    render(
      <I18nProvider>
        <SearchInput onSearch={onSearch} isSearching={false} />
      </I18nProvider>
    );

    const input = screen.getByPlaceholderText('Tìm kiếm tệp theo tên hoặc nội dung...');
    await user.type(input, 'budget');
    await user.keyboard('{Enter}');

    expect(onSearch).toHaveBeenCalledWith('budget');
    expect(localStorage.getItem('search_history')).toContain('budget');
  });

  it('does not persist blank queries and shows the loading state', () => {
    const onSearch = vi.fn();

    render(
      <I18nProvider>
        <SearchInput onSearch={onSearch} isSearching />
      </I18nProvider>
    );

    const input = screen.getByPlaceholderText('Tìm kiếm tệp theo tên hoặc nội dung...');
    expect(input).toBeDisabled();
    expect(screen.queryByText('Enter')).not.toBeInTheDocument();

    const form = input.closest('form');
    expect(form).not.toBeNull();
    if (form) {
      form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    }

    expect(onSearch).toHaveBeenCalledWith('');
    expect(localStorage.getItem('search_history')).toBeNull();
  });

  it('shows recent history, replays a previous search, and de-duplicates repeats', async () => {
    localStorage.setItem('search_history', JSON.stringify(['budget', 'notes']));
    const onSearch = vi.fn();
    const user = userEvent.setup();

    render(
      <I18nProvider>
        <SearchInput onSearch={onSearch} isSearching={false} />
      </I18nProvider>
    );

    const input = screen.getByPlaceholderText('Tìm kiếm tệp theo tên hoặc nội dung...');
    await user.click(input);

    expect(screen.getByText('Tìm kiếm gần đây')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /budget/i }));

    expect(onSearch).toHaveBeenCalledWith('budget');
    await waitFor(() => expect(screen.queryByText('Tìm kiếm gần đây')).not.toBeInTheDocument());

    await user.clear(input);
    await user.type(input, 'notes');
    await user.keyboard('{Enter}');

    expect(JSON.parse(localStorage.getItem('search_history') || '[]')).toEqual(['notes', 'budget']);
  });
});
