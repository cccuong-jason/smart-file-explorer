import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
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
    isPinnedWorkspace: false,
    workspaceId: 'workspace-1',
    workspaceTitle: 'Q2',
    title: 'Open proposal-final.docx',
    reason: 'Likely latest version in an active workspace.',
    actionLabel: 'Open document',
    primaryFile: { path: 'a', name: 'proposal-final.docx' },
    evidence: ['Opened recently', 'Likely latest version'],
    priority: 100,
  },
  {
    id: '2',
    kindLabel: 'Version conflict',
    type: 'version_conflict' as const,
    actionMode: 'open_workspace' as const,
    stateKey: '2:state',
    isPinnedWorkspace: false,
    workspaceId: 'workspace-1',
    workspaceTitle: 'Q2',
    title: 'Resolve proposal versions',
    reason: '3 alternates are competing here.',
    actionLabel: 'Open latest file',
    primaryFile: { path: 'a', name: 'proposal-final.docx' },
    evidence: ['3 alternates detected'],
    priority: 80,
  },
  {
    id: '3',
    kindLabel: 'OCR attention',
    type: 'ocr_attention' as const,
    actionMode: 'open_workspace' as const,
    stateKey: '3:state',
    isPinnedWorkspace: false,
    workspaceId: 'workspace-1',
    workspaceTitle: 'Q2',
    title: 'Review OCR candidates',
    reason: '1 scanned file still needs readable text.',
    actionLabel: 'Open workspace file',
    primaryFile: { path: 'a', name: 'proposal-final.docx' },
    evidence: ['1 scanned file is still incomplete'],
    priority: 60,
  },
  {
    id: '4',
    kindLabel: 'Recent change',
    type: 'recent_change' as const,
    actionMode: 'open_workspace' as const,
    stateKey: '4:state',
    isPinnedWorkspace: false,
    workspaceId: 'workspace-1',
    workspaceTitle: 'Q2',
    title: 'Check recent updates',
    reason: '2 files changed recently.',
    actionLabel: 'Open changed file',
    primaryFile: { path: 'b', name: 'pricing.xlsx' },
    evidence: ['Changed in the last 7 days'],
    priority: 40,
  },
];

describe('WorkInboxPanel', () => {
  it('stays compact by default and expands on demand', async () => {
    localStorage.setItem('i18n_lang', 'en');
    const user = userEvent.setup();

    render(
      <I18nProvider>
        <WorkInboxPanel
          items={items}
          onOpenFile={vi.fn()}
          onOpenWorkspace={vi.fn()}
          onDismissItem={vi.fn()}
          onToggleWorkspacePin={vi.fn()}
        />
      </I18nProvider>
    );

    expect(screen.getByText(/Open proposal-final\.docx/i)).toBeInTheDocument();
    expect(screen.queryByText(/Check recent updates/i)).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /show more/i }));

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
          onToggleWorkspacePin={vi.fn()}
        />
      </I18nProvider>
    );

    expect(screen.getByText('Continue now')).toBeInTheDocument();
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
          onToggleWorkspacePin={vi.fn()}
        />
      </I18nProvider>
    );

    await user.click(screen.getByRole('button', { name: /open latest file/i }));

    expect(onOpenWorkspace).toHaveBeenCalledWith('workspace-1');
    expect(onOpenFile).not.toHaveBeenCalled();
  });

  it('lets users pin a workspace and dismiss an inbox item', async () => {
    localStorage.setItem('i18n_lang', 'en');
    const user = userEvent.setup();
    const onDismissItem = vi.fn();
    const onToggleWorkspacePin = vi.fn();

    render(
      <I18nProvider>
        <WorkInboxPanel
          items={items}
          onOpenFile={vi.fn()}
          onOpenWorkspace={vi.fn()}
          onDismissItem={onDismissItem}
          onToggleWorkspacePin={onToggleWorkspacePin}
        />
      </I18nProvider>
    );

    await user.click(screen.getAllByRole('button', { name: /pin workspace/i })[0]);
    await user.click(screen.getAllByRole('button', { name: /dismiss recommendation/i })[0]);

    expect(onToggleWorkspacePin).toHaveBeenCalledWith('workspace-1');
    expect(onDismissItem).toHaveBeenCalledWith('1:state');
  });
});
