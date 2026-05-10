import { describe, expect, it } from 'vitest';

import {
  buildTreeView,
  flattenVisibleTreePaths,
  getTreeAutoExpandedPaths,
  type TreeFolderNode,
  type TreeNode,
} from '@/lib/file-browser/tree-view';
import type { BrowserFileRecord } from '@/lib/file-browser/utils';
import type { WatchedFolderRecord } from '@/lib/file-system/db';

const watchedFolders: WatchedFolderRecord[] = [
  {
    path: 'C:/Users/jason/Downloads',
    enabled: true,
    status: 'watching',
  },
  {
    path: 'C:/Users/jason/Documents/Acme',
    enabled: true,
    status: 'watching',
  },
];

const files: BrowserFileRecord[] = [
  {
    path: 'C:/Users/jason/Downloads/proposals/2026/proposal-final.docx',
    name: 'proposal-final.docx',
    size: 1,
    lastModified: 30,
  },
  {
    path: 'C:/Users/jason/Downloads/proposals/2026/brief.pdf',
    name: 'brief.pdf',
    size: 1,
    lastModified: 20,
  },
  {
    path: 'C:/Users/jason/Documents/Acme/notes/meeting.txt',
    name: 'meeting.txt',
    size: 1,
    lastModified: 10,
  },
  {
    path: 'D:/Elsewhere/random.txt',
    name: 'random.txt',
    size: 1,
    lastModified: 5,
  },
];

function folder(node: TreeNode): TreeFolderNode {
  expect(node.kind).toBe('folder');
  return node as TreeFolderNode;
}

describe('tree view model', () => {
  it('groups files beneath watched roots and nested folders', () => {
    const tree = buildTreeView(files, watchedFolders, {
      sortBy: 'name',
      sortOrder: 'asc',
    });

    expect(tree).toHaveLength(2);
    expect(tree.map((node) => node.name)).toEqual(['Acme', 'Downloads']);

    const downloads = folder(tree[1]);
    expect(downloads.path).toBe('C:/Users/jason/Downloads');
    expect(downloads.children).toHaveLength(1);
    expect(downloads.children[0]).toMatchObject({
      kind: 'folder',
      name: 'proposals',
    });

    const proposals = folder(downloads.children[0]);
    const year = folder(proposals.children[0]);
    expect(year.name).toBe('2026');
    expect(year.children).toEqual([
      expect.objectContaining({
        kind: 'file',
        path: 'C:/Users/jason/Downloads/proposals/2026/brief.pdf',
      }),
      expect.objectContaining({
        kind: 'file',
        path: 'C:/Users/jason/Downloads/proposals/2026/proposal-final.docx',
      }),
    ]);
  });

  it('excludes files outside watched roots', () => {
    const tree = buildTreeView(files, watchedFolders, {
      sortBy: 'date',
      sortOrder: 'desc',
    });

    expect(flattenVisibleTreePaths(tree)).not.toContain('D:/Elsewhere/random.txt');
  });

  it('preserves ancestors for matching descendants when filtering a tree result set', () => {
    const matchingTree = buildTreeView(
      files.filter((file) => file.name.includes('proposal')),
      watchedFolders,
      {
        sortBy: 'date',
        sortOrder: 'desc',
      }
    );

    expect(flattenVisibleTreePaths(matchingTree)).toEqual([
      'C:/Users/jason/Downloads',
      'C:/Users/jason/Downloads/proposals',
      'C:/Users/jason/Downloads/proposals/2026',
      'C:/Users/jason/Downloads/proposals/2026/proposal-final.docx',
    ]);
  });

  it('sorts sibling files within each folder branch', () => {
    const tree = buildTreeView(files, watchedFolders, {
      sortBy: 'date',
      sortOrder: 'desc',
    });

    const downloads = folder(tree[1]);
    const proposals = folder(downloads.children[0]);
    const year = folder(proposals.children[0]);

    expect(year.children.map((node: TreeNode) => node.name)).toEqual([
      'proposal-final.docx',
      'brief.pdf',
    ]);
  });

  it('returns ancestor paths for the first visible match so tree mode can auto-expand it', () => {
    expect(
      getTreeAutoExpandedPaths(
        [
          {
            path: 'C:/Users/jason/Downloads/proposals/2026/proposal-final.docx',
            name: 'proposal-final.docx',
            size: 1,
            lastModified: 30,
          },
        ],
        watchedFolders
      )
    ).toEqual([
      'C:/Users/jason/Downloads',
      'C:/Users/jason/Downloads/proposals',
      'C:/Users/jason/Downloads/proposals/2026',
    ]);
  });
});
