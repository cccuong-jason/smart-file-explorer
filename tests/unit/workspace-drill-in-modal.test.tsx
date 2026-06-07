import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { I18nProvider } from '@/lib/i18n';
import { WorkspaceDrillInModal } from '@/components/folder-intelligence/workspace-drill-in-modal';
import type { TreeFolderNode } from '@/lib/file-browser/tree-view';

const insight = {
  id: 'workspace-1',
  path: 'C:/Users/jason/Documents/Acme/Q2',
  title: 'Q2',
  fileCount: 4,
  ocrCount: 1,
  recentCount: 2,
  primaryTypeLabel: 'Documents',
  topFile: {
    path: 'C:/Users/jason/Documents/Acme/Q2/proposal-final.docx',
    name: 'proposal-final.docx',
    size: 100,
    type: 'application/docx',
    lastModified: Date.now(),
    isLikelyLatest: true,
    isStarred: true,
  },
  topFiles: [],
  importantFiles: [
    {
      path: 'C:/Users/jason/Documents/Acme/Q2/proposal-final.docx',
      name: 'proposal-final.docx',
      size: 100,
      type: 'application/docx',
      lastModified: Date.now(),
      isLikelyLatest: true,
      isStarred: true,
    },
    {
      path: 'C:/Users/jason/Documents/Acme/Q2/pricing.xlsx',
      name: 'pricing.xlsx',
      size: 100,
      type: 'application/xlsx',
      lastModified: Date.now() - 5_000,
    },
  ],
  recentFiles: [
    {
      path: 'C:/Users/jason/Documents/Acme/Q2/pricing.xlsx',
      name: 'pricing.xlsx',
      size: 100,
      type: 'application/xlsx',
      lastModified: Date.now() - 5_000,
    },
  ],
  versionGroups: [
    {
      id: 'vg-1',
      title: 'proposal',
      variantCount: 3,
      latestFile: {
        path: 'C:/Users/jason/Documents/Acme/Q2/proposal-final.docx',
        name: 'proposal-final.docx',
        size: 100,
        type: 'application/docx',
        lastModified: Date.now(),
      },
      files: [
        {
          path: 'C:/Users/jason/Documents/Acme/Q2/proposal-final.docx',
          name: 'proposal-final.docx',
          size: 100,
          type: 'application/docx',
          lastModified: Date.now(),
          isLikelyLatest: true,
        },
        {
          path: 'C:/Users/jason/Documents/Acme/Q2/proposal-v2.docx',
          name: 'proposal-v2.docx',
          size: 100,
          type: 'application/docx',
          lastModified: Date.now() - 10_000,
        },
        {
          path: 'C:/Users/jason/Documents/Acme/Q2/proposal-draft.docx',
          name: 'proposal-draft.docx',
          size: 100,
          type: 'application/docx',
          lastModified: Date.now() - 20_000,
        },
      ],
    },
  ],
  projectKeywords: ['acme', 'renewal'],
  summary: 'proposal-final.docx looks like the primary document for Q2.',
  highlights: ['1 version group', '1 needs OCR'],
  rationale: ['The latest proposal is starred and recently updated.'],
  summarySource: 'ai' as const,
  summaryModel: 'qwen/qwen3.6-plus:free',
  workspaceScore: 12,
};

const workspaceTree: TreeFolderNode[] = [
  {
    kind: 'folder',
    id: 'workspace-root',
    name: 'Q2',
    path: 'C:/Users/jason/Documents/Acme/Q2',
    isRoot: true,
    children: [
      {
        kind: 'folder',
        id: 'workspace-root/contracts',
        name: 'contracts',
        path: 'C:/Users/jason/Documents/Acme/Q2/contracts',
        isRoot: false,
        children: [
          {
            kind: 'file',
            id: 'contract-draft',
            name: 'contract-draft.docx',
            path: 'C:/Users/jason/Documents/Acme/Q2/contracts/contract-draft.docx',
            file: {
              path: 'C:/Users/jason/Documents/Acme/Q2/contracts/contract-draft.docx',
              name: 'contract-draft.docx',
              size: 100,
              lastModified: Date.now() - 30_000,
            },
          },
        ],
      },
      {
        kind: 'file',
        id: 'proposal-final',
        name: 'proposal-final.docx',
        path: 'C:/Users/jason/Documents/Acme/Q2/proposal-final.docx',
        file: {
          path: 'C:/Users/jason/Documents/Acme/Q2/proposal-final.docx',
          name: 'proposal-final.docx',
          size: 100,
          lastModified: Date.now(),
        },
      },
    ],
  },
];

describe('WorkspaceDrillInModal', () => {
  it('renders a workspace drill-in with the full file tree, versions, and recent changes', async () => {
    localStorage.setItem('i18n_lang', 'en');
    const onOpenFile = vi.fn();
    const user = userEvent.setup();

    render(
      <I18nProvider>
        <WorkspaceDrillInModal
          isOpen
          insight={insight}
          workspaceTreeNodes={workspaceTree}
          isPinned={false}
          onClose={vi.fn()}
          onOpenFile={onOpenFile}
          onTogglePin={vi.fn()}
        />
      </I18nProvider>
    );

    expect(screen.getByText(/proposal-final\.docx looks like the primary document/i)).toBeInTheDocument();
    expect(screen.getByText(/file tree/i)).toBeInTheDocument();
    expect(screen.getByText(/contracts/i)).toBeInTheDocument();
    expect(screen.getByText(/contract-draft\.docx/i)).toBeInTheDocument();
    expect(screen.getByText(/version groups/i)).toBeInTheDocument();
    expect(screen.getByText(/recent changes/i)).toBeInTheDocument();
    expect(screen.getByText(/OCR attention/i)).toBeInTheDocument();

    await user.click(screen.getAllByRole('button', { name: /proposal-final\.docx/i })[0]);
    expect(onOpenFile).toHaveBeenCalledWith(expect.objectContaining({ name: 'proposal-final.docx' }));
  });

  it('lets users expand version alternates and open a specific alternate file', async () => {
    localStorage.setItem('i18n_lang', 'en');
    const onOpenFile = vi.fn();
    const user = userEvent.setup();

    render(
      <I18nProvider>
        <WorkspaceDrillInModal
          isOpen
          insight={insight}
          workspaceTreeNodes={workspaceTree}
          selectedPath="C:/Users/jason/Documents/Acme/Q2/proposal-final.docx"
          isPinned={false}
          onClose={vi.fn()}
          onOpenFile={onOpenFile}
          onTogglePin={vi.fn()}
        />
      </I18nProvider>
    );

    await user.click(screen.getByRole('button', { name: /show alternates/i }));

    expect(screen.getByText(/likely current/i)).toBeInTheDocument();
    expect(screen.getByText(/proposal-v2\.docx/i)).toBeInTheDocument();
    expect(screen.getByText(/proposal-draft\.docx/i)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /proposal-v2\.docx/i }));

    expect(onOpenFile).toHaveBeenCalledWith(expect.objectContaining({ name: 'proposal-v2.docx' }));
  });

  it('closes from escape or backdrop interactions', () => {
    localStorage.setItem('i18n_lang', 'en');
    const onClose = vi.fn();

    render(
      <I18nProvider>
        <WorkspaceDrillInModal
          isOpen
          insight={insight}
          workspaceTreeNodes={workspaceTree}
          isPinned={false}
          onClose={onClose}
          onOpenFile={vi.fn()}
          onTogglePin={vi.fn()}
        />
      </I18nProvider>
    );

    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);

    const backdrop = document.querySelector('.fixed.inset-0');
    expect(backdrop).not.toBeNull();
    if (backdrop instanceof HTMLElement) {
      fireEvent.click(backdrop);
    }

    expect(onClose).toHaveBeenCalledTimes(2);
  });

  it('keeps the pin action in the bottom-right footer with a pressed state', () => {
    localStorage.setItem('i18n_lang', 'en');

    render(
      <I18nProvider>
        <WorkspaceDrillInModal
          isOpen
          insight={insight}
          workspaceTreeNodes={workspaceTree}
          isPinned
          onClose={vi.fn()}
          onOpenFile={vi.fn()}
          onTogglePin={vi.fn()}
        />
      </I18nProvider>
    );

    const footer = screen.getByTestId('workspace-pin-footer');
    expect(footer).toHaveClass('justify-end');
    expect(screen.getByRole('button', { name: /unpin item/i })).toHaveAttribute('aria-pressed', 'true');
  });

  it('localizes the workspace summary in Vietnamese', () => {
    localStorage.setItem('i18n_lang', 'vi');

    render(
      <I18nProvider>
        <WorkspaceDrillInModal
          isOpen
          insight={insight}
          workspaceTreeNodes={workspaceTree}
          isPinned={false}
          onClose={vi.fn()}
          onOpenFile={vi.fn()}
          onTogglePin={vi.fn()}
        />
      </I18nProvider>
    );

    expect(screen.getByText(/proposal-final\.docx là tài liệu nên mở đầu tiên trong Q2/i)).toBeInTheDocument();
    expect(screen.queryByText(/looks like the primary document/i)).not.toBeInTheDocument();
  });
});
