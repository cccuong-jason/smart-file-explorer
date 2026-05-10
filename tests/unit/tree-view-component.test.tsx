import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { TreeView } from '@/components/file-viewer/tree-view';
import type { TreeFolderNode } from '@/lib/file-browser/tree-view';
import { I18nProvider } from '@/lib/i18n';

const tree: TreeFolderNode[] = [
  {
    kind: 'folder',
    id: 'downloads',
    name: 'Downloads',
    path: 'C:/Users/jason/Downloads',
    isRoot: true,
    children: [
      {
        kind: 'folder',
        id: 'proposals',
        name: 'proposals',
        path: 'C:/Users/jason/Downloads/proposals',
        isRoot: false,
        children: [
          {
            kind: 'file',
            id: 'proposal',
            name: 'proposal-final.docx',
            path: 'C:/Users/jason/Downloads/proposals/proposal-final.docx',
            file: {
              path: 'C:/Users/jason/Downloads/proposals/proposal-final.docx',
              name: 'proposal-final.docx',
              size: 1,
              lastModified: 10,
            },
          },
        ],
      },
    ],
  },
];

describe('tree view component', () => {
  it('renders watched roots and selects a file from a nested branch', async () => {
    const onSelectFile = vi.fn();
    const user = userEvent.setup();

    render(
      <I18nProvider>
        <TreeView nodes={tree} selectedPath={null} onSelectFile={onSelectFile} />
      </I18nProvider>
    );

    expect(screen.getByText('Downloads')).toBeInTheDocument();
    expect(screen.getByText('proposals')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /toggle folder proposals|Bật tắt thư mục proposals/i }));
    await user.click(screen.getByRole('button', { name: /proposal-final\.docx/i }));
    expect(onSelectFile).toHaveBeenCalledWith(
      expect.objectContaining({
        path: 'C:/Users/jason/Downloads/proposals/proposal-final.docx',
      })
    );
  });

  it('collapses and expands nested folders', async () => {
    const user = userEvent.setup();

    render(
      <I18nProvider>
        <TreeView nodes={tree} selectedPath={null} onSelectFile={() => undefined} />
      </I18nProvider>
    );

    const toggle = screen.getByRole('button', { name: /toggle folder proposals|Bật tắt thư mục proposals/i });
    await user.click(toggle);
    expect(screen.getByRole('button', { name: /proposal-final\.docx/i })).toBeInTheDocument();
    await user.click(toggle);
    expect(screen.queryByRole('button', { name: /proposal-final\.docx/i })).not.toBeInTheDocument();
  });

  it('shows an empty state when no watched-root matches are visible', () => {
    render(
      <I18nProvider>
        <TreeView nodes={[]} selectedPath={null} onSelectFile={() => undefined} />
      </I18nProvider>
    );

    expect(
      screen.getByText(/No watched folders are visible|Không có thư mục theo dõi nào đang hiển thị/)
    ).toBeInTheDocument();
  });

  it('reveals the first matching branch when auto-expanded paths are provided', () => {
    render(
      <I18nProvider>
        <TreeView
          nodes={tree}
          selectedPath={null}
          autoExpandPaths={['C:/Users/jason/Downloads/proposals']}
          onSelectFile={() => undefined}
        />
      </I18nProvider>
    );

    expect(screen.getByRole('button', { name: /proposal-final\.docx/i })).toBeInTheDocument();
  });
});
