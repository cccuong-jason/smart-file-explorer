import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { Pagination } from '@/components/ui/pagination';
import { ProgressBar } from '@/components/ui/progress-bar';
import { HelperAlert } from '@/components/ui/helper-alert';
import { TagInput } from '@/components/ui/tag-input';
import { I18nProvider } from '@/lib/i18n';

describe('shared UI components', () => {
  it('returns null pagination when only one page exists', () => {
    const { container } = render(<Pagination currentPage={1} totalPages={1} onPageChange={() => undefined} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('renders pagination controls and changes page', async () => {
    const onPageChange = vi.fn();
    const user = userEvent.setup();

    render(<Pagination currentPage={5} totalPages={10} onPageChange={onPageChange} />);

    expect(screen.getAllByText('...')).toHaveLength(2);
    await user.click(screen.getByRole('button', { name: 'Next Page' }));
    await user.click(screen.getByRole('button', { name: 'Previous Page' }));
    await user.click(screen.getByRole('button', { name: '10' }));

    expect(onPageChange).toHaveBeenNthCalledWith(1, 6);
    expect(onPageChange).toHaveBeenNthCalledWith(2, 4);
    expect(onPageChange).toHaveBeenNthCalledWith(3, 10);
  });

  it('renders progress details and pause action', async () => {
    const onTogglePause = vi.fn();
    const user = userEvent.setup();

    render(
      <ProgressBar
        isScanning
        processedCount={5}
        totalCount={10}
        currentFile="spec.md"
        isPaused={false}
        onTogglePause={onTogglePause}
      />
    );

    expect(screen.getByText('50%')).toBeInTheDocument();
    expect(screen.getByText('spec.md')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /pause/i }));
    expect(onTogglePause).toHaveBeenCalledOnce();
  });

  it('renders paused and indeterminate progress states', () => {
    render(
      <ProgressBar
        isScanning
        processedCount={2}
        currentFile=""
        isPaused
      />
    );

    expect(screen.getByText('Paused')).toBeInTheDocument();
    expect(screen.getByText('Initializing...')).toBeInTheDocument();
    expect(screen.queryByText(/Indexing/i)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /resume/i })).not.toBeInTheDocument();
  });

  it('treats zero totals as indeterminate progress', () => {
    render(
      <ProgressBar
        isScanning
        processedCount={0}
        totalCount={0}
        currentFile="zero.md"
        isPaused={false}
      />
    );

    expect(screen.queryByText('0%')).not.toBeInTheDocument();
    expect(screen.getByText('zero.md')).toBeInTheDocument();
  });

  it('returns null when scanning is inactive', () => {
    const { container } = render(
      <ProgressBar
        isScanning={false}
        processedCount={0}
        currentFile="spec.md"
      />
    );

    expect(container).toBeEmptyDOMElement();
  });

  it('dismisses helper alerts', async () => {
    const onDismiss = vi.fn();
    const user = userEvent.setup();

    render(<HelperAlert title="Heads up" message="Local only" onDismiss={onDismiss} />);

    await user.click(screen.getByRole('button'));
    expect(onDismiss).toHaveBeenCalledOnce();
    expect(screen.queryByText('Heads up')).not.toBeInTheDocument();
  });

  it('adds and removes tags through the tag input', async () => {
    const onAddTag = vi.fn();
    const onRemoveTag = vi.fn();
    const user = userEvent.setup();

    render(
      <I18nProvider>
        <TagInput tags={['work']} onAddTag={onAddTag} onRemoveTag={onRemoveTag} />
      </I18nProvider>
    );

    await user.click(screen.getByRole('button', { name: /thêm thẻ/i }));
    await user.type(screen.getByPlaceholderText('Thêm thẻ...'), 'urgent{Enter}');
    await user.click(screen.getAllByRole('button')[0]);

    expect(onAddTag).toHaveBeenCalledWith('urgent');
    expect(onRemoveTag).toHaveBeenCalledWith('work');
  });

  it('prevents duplicate tag additions and keeps typed values visible on blur', async () => {
    const onAddTag = vi.fn();
    const user = userEvent.setup();

    render(
      <I18nProvider>
        <TagInput tags={['work']} onAddTag={onAddTag} onRemoveTag={() => undefined} />
      </I18nProvider>
    );

    await user.click(screen.getByRole('button', { name: /thêm thẻ/i }));
    const input = screen.getByPlaceholderText('Thêm thẻ...');
    await user.type(input, 'work{Enter}');
    await user.click(document.body);

    expect(onAddTag).not.toHaveBeenCalled();
    expect(screen.getByDisplayValue('work')).toBeInTheDocument();
  });

  it('hides the tag input again on blur when no value was entered', async () => {
    const user = userEvent.setup();

    render(
      <I18nProvider>
        <TagInput tags={[]} onAddTag={() => undefined} onRemoveTag={() => undefined} />
      </I18nProvider>
    );

    await user.click(screen.getByRole('button', { name: /thêm thẻ/i }));
    await user.click(document.body);

    expect(screen.queryByPlaceholderText('Thêm thẻ...')).not.toBeInTheDocument();
  });
});
