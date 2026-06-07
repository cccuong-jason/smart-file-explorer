import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { I18nProvider } from '@/lib/i18n';
import { WorkInboxPanel } from '@/components/folder-intelligence/work-inbox-panel';

const items = [
  {
    id: '1',
    kindLabel: 'Continue now',
    type: 'open_now' as const,
    actionMode: 'open_file' as const,
    stateKey: '1:state',
    workspaceId: 'workspace-1',
    workspaceTitle: 'Q2',
    title: 'Open proposal-final.docx',
    reason: 'Likely latest version in an active workspace.',
    actionLabel: 'Open document',
    primaryFile: { path: 'a', name: 'proposal-final.docx' },
    evidence: ['Opened recently', 'Likely latest version'],
    priority: 100,
    isPinned: false,
  },
  {
    id: '2',
    kindLabel: 'Version conflict',
    type: 'version_conflict' as const,
    actionMode: 'open_workspace' as const,
    stateKey: '2:state',
    workspaceId: 'workspace-1',
    workspaceTitle: 'Q2',
    title: 'Resolve proposal versions',
    reason: '3 alternates are competing here.',
    actionLabel: 'Open latest file',
    primaryFile: { path: 'a', name: 'proposal-final.docx' },
    evidence: ['3 alternates detected'],
    priority: 80,
    isPinned: false,
  },
  {
    id: '3',
    kindLabel: 'OCR attention',
    type: 'ocr_attention' as const,
    actionMode: 'open_workspace' as const,
    stateKey: '3:state',
    workspaceId: 'workspace-1',
    workspaceTitle: 'Q2',
    title: 'Review OCR candidates',
    reason: '1 scanned file still needs readable text.',
    actionLabel: 'Open workspace file',
    primaryFile: { path: 'a', name: 'proposal-final.docx' },
    evidence: ['1 scanned file is still incomplete'],
    priority: 60,
    isPinned: false,
  },
  {
    id: '4',
    kindLabel: 'Recent change',
    type: 'recent_change' as const,
    actionMode: 'open_workspace' as const,
    stateKey: '4:state',
    workspaceId: 'workspace-1',
    workspaceTitle: 'Q2',
    title: 'Check recent updates',
    reason: '2 files changed recently.',
    actionLabel: 'Open changed file',
    primaryFile: { path: 'b', name: 'pricing.xlsx' },
    evidence: ['Changed in the last 7 days'],
    priority: 40,
    isPinned: false,
  },
];

function PinnedCarouselHarness() {
  const [pinnedId, setPinnedId] = useState<string | null>(null);
  const sortedItems = items
    .map((item) => ({
      ...item,
      isPinned: item.id === pinnedId,
      priority: item.priority + (item.id === pinnedId ? 200 : 0),
    }))
    .sort((a, b) => b.priority - a.priority || a.title.localeCompare(b.title));

  return (
    <I18nProvider>
      <WorkInboxPanel
        items={sortedItems}
        onOpenFile={vi.fn()}
        onOpenWorkspace={vi.fn()}
        onDismissItem={vi.fn()}
        onToggleItemPin={(itemId) => setPinnedId(itemId)}
      />
    </I18nProvider>
  );
}

describe('WorkInboxPanel', () => {
  it('uses carousel navigation to keep the inbox compact', async () => {
    localStorage.setItem('i18n_lang', 'en');
    const user = userEvent.setup();

    render(
      <I18nProvider>
        <WorkInboxPanel
          items={items}
          onOpenFile={vi.fn()}
          onOpenWorkspace={vi.fn()}
          onDismissItem={vi.fn()}
          onToggleItemPin={vi.fn()}
        />
      </I18nProvider>
    );

    expect(screen.getByText(/Open proposal-final\.docx/i)).toBeInTheDocument();
    expect(screen.queryByText(/Check recent updates/i)).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /next inbox items/i }));

    expect(screen.getByText(/Check recent updates/i)).toBeInTheDocument();
  });

  it('shows a compact kind label and supporting evidence for each item', () => {
    localStorage.setItem('i18n_lang', 'en');

    render(
      <I18nProvider>
        <WorkInboxPanel
          items={items}
          onOpenFile={vi.fn()}
          onOpenWorkspace={vi.fn()}
          onDismissItem={vi.fn()}
          onToggleItemPin={vi.fn()}
        />
      </I18nProvider>
    );

    expect(screen.getByText('Open now')).toBeInTheDocument();
    expect(screen.getByText('Opened recently')).toBeInTheDocument();
    expect(screen.getByText('Likely latest version')).toBeInTheDocument();
  });

  it('routes workspace-oriented inbox items into the workspace drill-in instead of opening a file directly', async () => {
    localStorage.setItem('i18n_lang', 'en');
    const user = userEvent.setup();
    const onOpenFile = vi.fn();
    const onOpenWorkspace = vi.fn();

    render(
      <I18nProvider>
        <WorkInboxPanel
          items={items}
          onOpenFile={onOpenFile}
          onOpenWorkspace={onOpenWorkspace}
          onDismissItem={vi.fn()}
          onToggleItemPin={vi.fn()}
        />
      </I18nProvider>
    );

    await user.click(screen.getByRole('button', { name: /open latest file/i }));

    expect(onOpenWorkspace).toHaveBeenCalledWith('workspace-1');
    expect(onOpenFile).not.toHaveBeenCalled();
  });

  it('lets users pin only the clicked inbox item and dismiss it', async () => {
    localStorage.setItem('i18n_lang', 'en');
    const user = userEvent.setup();
    const onDismissItem = vi.fn();
    const onToggleItemPin = vi.fn();

    render(
      <I18nProvider>
        <WorkInboxPanel
          items={items}
          onOpenFile={vi.fn()}
          onOpenWorkspace={vi.fn()}
          onDismissItem={onDismissItem}
          onToggleItemPin={onToggleItemPin}
        />
      </I18nProvider>
    );

    await user.click(screen.getAllByRole('button', { name: /pin item/i })[0]);
    await user.click(screen.getAllByRole('button', { name: /dismiss recommendation/i })[0]);

    expect(onToggleItemPin).toHaveBeenCalledWith('1');
    expect(onDismissItem).toHaveBeenCalledWith('1:state');
  });

  it('uses a visible transition and keeps the clicked card in view after pinning', async () => {
    localStorage.setItem('i18n_lang', 'en');
    const user = userEvent.setup();

    render(<PinnedCarouselHarness />);

    await user.click(screen.getByRole('button', { name: /next inbox items/i }));
    await user.click(screen.getAllByRole('button', { name: /pin item/i })[1]);

    const pinnedCard = screen.getByText(/Check recent updates/i).closest('article');
    expect(pinnedCard).toHaveClass('animate-pin-confirm');
    expect(screen.getByRole('button', { name: /unpin item/i })).toHaveAttribute('aria-pressed', 'true');
  });

  it('localizes inbox card labels, actions, and evidence in Vietnamese', () => {
    localStorage.setItem('i18n_lang', 'vi');

    render(
      <I18nProvider>
        <WorkInboxPanel
          items={items}
          onOpenFile={vi.fn()}
          onOpenWorkspace={vi.fn()}
          onDismissItem={vi.fn()}
          onToggleItemPin={vi.fn()}
        />
      </I18nProvider>
    );

    expect(screen.getByText('Mở ngay')).toBeInTheDocument();
    expect(screen.getByText('Xung đột phiên bản')).toBeInTheDocument();
    expect(screen.getByText(/Mở proposal-final\.docx/i)).toBeInTheDocument();
    expect(screen.getByText('Mở bản mới nhất')).toBeInTheDocument();
    expect(screen.getByText('Có thể là phiên bản mới nhất')).toBeInTheDocument();
    expect(screen.queryByText('Version conflict')).not.toBeInTheDocument();
    expect(screen.queryByText('Open proposal-final.docx')).not.toBeInTheDocument();
  });

  it('adds contrast color only to the inbox icons and chips', () => {
    localStorage.setItem('i18n_lang', 'en');

    const { container } = render(
      <I18nProvider>
        <WorkInboxPanel
          items={items}
          onOpenFile={vi.fn()}
          onOpenWorkspace={vi.fn()}
          onDismissItem={vi.fn()}
          onToggleItemPin={vi.fn()}
        />
      </I18nProvider>
    );

    expect(container.innerHTML).toMatch(/(?:text|bg)-cyan-/);
    expect(container.innerHTML).toMatch(/(?:text|bg)-amber-/);
    expect(container.querySelector('article')?.className).toContain('bg-card');
  });

  it('uses tokenized card surfaces so inbox recommendations stay consistent in dark mode', () => {
    localStorage.setItem('i18n_lang', 'en');

    const { container } = render(
      <I18nProvider>
        <WorkInboxPanel
          items={items}
          onOpenFile={vi.fn()}
          onOpenWorkspace={vi.fn()}
          onDismissItem={vi.fn()}
          onToggleItemPin={vi.fn()}
        />
      </I18nProvider>
    );

    expect(container.innerHTML).toContain('bg-card');
    expect(container.innerHTML).toContain('bg-secondary');
    expect(container.innerHTML).toContain('border-border');
  });
});
