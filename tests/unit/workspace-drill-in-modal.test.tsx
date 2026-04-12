import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { I18nProvider } from '@/lib/i18n';
import { WorkspaceDrillInModal } from '@/components/folder-intelligence/workspace-drill-in-modal';

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

describe('WorkspaceDrillInModal', () => {
  it('renders a workspace drill-in with important documents, versions, and recent changes', async () => {
    localStorage.setItem('i18n_lang', 'en');
    const onOpenFile = vi.fn();
    const user = userEvent.setup();

    render(
      <I18nProvider>
        <WorkspaceDrillInModal
          isOpen
          insight={insight}
          isPinned={false}
          onClose={vi.fn()}
          onOpenFile={onOpenFile}
          onTogglePin={vi.fn()}
        />
      </I18nProvider>
    );

    expect(screen.getByText(/proposal-final\.docx looks like the primary document/i)).toBeInTheDocument();
    expect(screen.getByText(/important documents/i)).toBeInTheDocument();
    expect(screen.getByText(/version groups/i)).toBeInTheDocument();
    expect(screen.getByText(/recent changes/i)).toBeInTheDocument();
    expect(screen.getByText(/OCR attention/i)).toBeInTheDocument();

    await user.click(screen.getAllByRole('button', { name: /proposal-final\.docx/i })[0]);
    expect(onOpenFile).toHaveBeenCalledWith(expect.objectContaining({ name: 'proposal-final.docx' }));
  });

  it('closes from escape or backdrop interactions', () => {
    localStorage.setItem('i18n_lang', 'en');
    const onClose = vi.fn();

    render(
      <I18nProvider>
        <WorkspaceDrillInModal
          isOpen
          insight={insight}
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
});
