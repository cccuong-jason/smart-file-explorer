import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { FolderIntelligencePanel } from '@/components/folder-intelligence/folder-intelligence-panel';
import { I18nProvider } from '@/lib/i18n';

describe('FolderIntelligencePanel', () => {
  it('renders workspace summary, version groups, and opens important files', async () => {
    localStorage.setItem('i18n_lang', 'en');
    const onOpenFile = vi.fn();
    const user = userEvent.setup();

    render(
      <I18nProvider>
        <FolderIntelligencePanel
          onOpenFile={onOpenFile}
          insights={[
            {
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
              },
              topFiles: [],
              importantFiles: [
                {
                  path: 'C:/Users/jason/Documents/Acme/Q2/proposal-final.docx',
                  name: 'proposal-final.docx',
                  size: 100,
                  type: 'application/docx',
                  lastModified: Date.now(),
                },
                {
                  path: 'C:/Users/jason/Documents/Acme/Q2/pricing.xlsx',
                  name: 'pricing.xlsx',
                  size: 100,
                  type: 'application/xlsx',
                  lastModified: Date.now() - 1,
                },
              ],
              recentFiles: [
                {
                  path: 'C:/Users/jason/Documents/Acme/Q2/pricing.xlsx',
                  name: 'pricing.xlsx',
                  size: 100,
                  type: 'application/xlsx',
                  lastModified: Date.now() - 1,
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
                  files: [],
                },
              ],
              projectKeywords: ['acme', 'renewal', 'q2'],
              summary: 'proposal-final.docx looks like the primary document for Q2.',
              highlights: ['1 version group', '1 needs OCR'],
              rationale: ['The latest proposal is starred and recently updated.'],
              summarySource: 'ai',
              summaryModel: 'qwen/qwen3.6-plus:free',
              workspaceScore: 12,
            },
          ]}
        />
      </I18nProvider>
    );

    expect(screen.getByText(/proposal-final\.docx looks like the primary document/i)).toBeInTheDocument();
    expect(screen.getByText(/AI summary/i)).toBeInTheDocument();
    expect(screen.getByText(/qwen\/qwen3\.6-plus:free/i)).toBeInTheDocument();
    expect(screen.getByText(/Latest version group/i)).toBeInTheDocument();
    expect(screen.getByText(/3 alternates/i)).toBeInTheDocument();
    expect(screen.getByText(/The latest proposal is starred and recently updated/i)).toBeInTheDocument();

    await user.click(screen.getAllByRole('button', { name: /proposal-final\.docx/i })[0]);

    expect(onOpenFile).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'proposal-final.docx' })
    );
  });

  it('lets users refresh an AI workspace summary on demand', async () => {
    localStorage.setItem('i18n_lang', 'en');
    const onRefreshSummary = vi.fn();
    const user = userEvent.setup();

    render(
      <I18nProvider>
        <FolderIntelligencePanel
          onOpenFile={vi.fn()}
          onRefreshSummary={onRefreshSummary}
          insights={[
            {
              id: 'workspace-1',
              path: 'C:/Users/jason/Documents/Acme/Q2',
              title: 'Q2',
              fileCount: 4,
              ocrCount: 0,
              recentCount: 2,
              primaryTypeLabel: 'Documents',
              topFile: {
                path: 'C:/Users/jason/Documents/Acme/Q2/proposal-final.docx',
                name: 'proposal-final.docx',
                size: 100,
                type: 'application/docx',
                lastModified: Date.now(),
              },
              topFiles: [],
              importantFiles: [],
              recentFiles: [],
              versionGroups: [],
              projectKeywords: ['acme'],
              summary: 'AI summary text',
              highlights: [],
              rationale: [],
              summarySource: 'ai',
              summaryModel: 'qwen/qwen3.6-plus:free',
              workspaceScore: 12,
            },
          ]}
        />
      </I18nProvider>
    );

    await user.click(screen.getByRole('button', { name: /refresh ai summary/i }));
    expect(onRefreshSummary).toHaveBeenCalledWith('workspace-1');
  });

  it('shows compact cloud activity states for workspace intelligence', () => {
    localStorage.setItem('i18n_lang', 'en');

    render(
      <I18nProvider>
        <FolderIntelligencePanel
          onOpenFile={vi.fn()}
          insights={[
            {
              id: 'workspace-1',
              path: 'C:/Users/jason/Documents/Acme/Q2',
              title: 'Q2',
              fileCount: 4,
              ocrCount: 0,
              recentCount: 2,
              primaryTypeLabel: 'Documents',
              topFile: {
                path: 'C:/Users/jason/Documents/Acme/Q2/proposal-final.docx',
                name: 'proposal-final.docx',
                size: 100,
                type: 'application/docx',
                lastModified: Date.now(),
              },
              topFiles: [],
              importantFiles: [],
              recentFiles: [],
              versionGroups: [],
              projectKeywords: [],
              summary: 'Waiting for summary',
              highlights: ['Main document: proposal-final.docx'],
              summarySource: 'heuristic',
              summaryState: 'generating',
              workspaceScore: 12,
            },
          ]}
        />
      </I18nProvider>
    );

    expect(screen.getByText(/Generating/i)).toBeInTheDocument();
  });

  it('stays compact by default and expands when requested', async () => {
    localStorage.setItem('i18n_lang', 'en');
    const user = userEvent.setup();

    render(
      <I18nProvider>
        <FolderIntelligencePanel
          onOpenFile={vi.fn()}
          insights={[
            {
              id: 'workspace-1',
              path: 'C:/Users/jason/Documents/Acme/Q2',
              title: 'Q2',
              fileCount: 4,
              ocrCount: 0,
              recentCount: 2,
              primaryTypeLabel: 'Documents',
              topFile: {
                path: 'C:/Users/jason/Documents/Acme/Q2/proposal-final.docx',
                name: 'proposal-final.docx',
                size: 100,
                type: 'application/docx',
                lastModified: Date.now(),
              },
              topFiles: [],
              importantFiles: [],
              recentFiles: [],
              versionGroups: [],
              projectKeywords: [],
              summary: 'Primary workspace summary',
              highlights: ['Main document: proposal-final.docx'],
              summarySource: 'heuristic',
              workspaceScore: 12,
            },
            {
              id: 'workspace-2',
              path: 'C:/Users/jason/Documents/Beta',
              title: 'Beta',
              fileCount: 3,
              ocrCount: 0,
              recentCount: 1,
              primaryTypeLabel: 'Documents',
              topFile: {
                path: 'C:/Users/jason/Documents/Beta/brief.docx',
                name: 'brief.docx',
                size: 100,
                type: 'application/docx',
                lastModified: Date.now(),
              },
              topFiles: [],
              importantFiles: [],
              recentFiles: [],
              versionGroups: [],
              projectKeywords: [],
              summary: 'Secondary workspace summary',
              highlights: ['Main document: brief.docx'],
              summarySource: 'heuristic',
              workspaceScore: 8,
            },
          ]}
        />
      </I18nProvider>
    );

    expect(screen.getByText(/Primary workspace summary/i)).toBeInTheDocument();
    expect(screen.queryByText(/Secondary workspace summary/i)).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /show more/i }));

    expect(screen.getByText(/Secondary workspace summary/i)).toBeInTheDocument();
  });
});
