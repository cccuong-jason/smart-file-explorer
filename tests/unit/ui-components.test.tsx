import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { Pagination } from '@/components/ui/pagination';
import { ProgressBar } from '@/components/ui/progress-bar';
import { HelperAlert } from '@/components/ui/helper-alert';
import { TagInput } from '@/components/ui/tag-input';
import { I18nProvider } from '@/lib/i18n';
import { FilterSection } from '@/components/sidebar/filter-section';

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

  it('uses tokenized surfaces for pagination so dark mode does not keep a white pill', () => {
    const { container } = render(
      <Pagination currentPage={2} totalPages={4} onPageChange={() => undefined} />
    );

    expect(container.innerHTML).toContain('bg-[var(--ui-surface-muted)]');
    expect(container.innerHTML).toContain('border-[var(--ui-border)]');
  });

  it('renders progress details and pause action', async () => {
    const onTogglePause = vi.fn();
    const user = userEvent.setup();

    render(
      <ProgressBar
        isScanning
        phase="indexing"
        discoveredCount={10}
        processedCount={5}
        totalKnownCount={10}
        currentPath="spec.md"
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
        phase="discovering"
        discoveredCount={2}
        processedCount={0}
        totalKnownCount={0}
        currentPath=""
        isPaused
      />
    );

    expect(screen.getByText('Paused')).toBeInTheDocument();
    expect(screen.getByText('Waiting for files...')).toBeInTheDocument();
    expect(screen.queryByText(/Indexing/i)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /resume/i })).not.toBeInTheDocument();
  });

  it('renders finalizing progress with a capped paused resume action', async () => {
    const onTogglePause = vi.fn();
    const user = userEvent.setup();

    render(
      <ProgressBar
        isScanning
        phase="finalizing"
        discoveredCount={20}
        processedCount={25}
        totalKnownCount={20}
        currentPath="handoff.pdf"
        isPaused
        onTogglePause={onTogglePause}
      />
    );

    expect(screen.getByText('25 / 20')).toBeInTheDocument();
    expect(screen.getByText('100%')).toBeInTheDocument();
    expect(screen.getByText('handoff.pdf')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /resume/i }));
    expect(onTogglePause).toHaveBeenCalledOnce();
  });

  it('treats discovery progress as indeterminate and avoids 0 of n messaging', () => {
    render(
      <ProgressBar
        isScanning
        phase="discovering"
        discoveredCount={12}
        processedCount={0}
        totalKnownCount={99}
        currentPath="zero.md"
        isPaused={false}
      />
    );

    expect(screen.queryByText('0%')).not.toBeInTheDocument();
    expect(screen.queryByText('0 / 99')).not.toBeInTheDocument();
    expect(screen.getByText('12 found')).toBeInTheDocument();
    expect(screen.getByText('zero.md')).toBeInTheDocument();
  });

  it('returns null when scanning is inactive', () => {
    const { container } = render(
      <ProgressBar
        isScanning={false}
        phase="discovering"
        discoveredCount={0}
        processedCount={0}
        totalKnownCount={0}
        currentPath="spec.md"
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

  it('uses tokenized selected states for sidebar filters', () => {
    const { container } = render(
      <FilterSection
        title="Date modified"
        type="radio"
        selectedIds={['any']}
        onChange={() => undefined}
        options={[
          { id: 'any', label: 'Any time' },
          { id: 'today', label: 'Today' },
        ]}
      />
    );

    expect(container.innerHTML).toContain('bg-[var(--ui-primary-soft)]');
    expect(container.innerHTML).toContain('border-[var(--ui-border)]');
  });
});
