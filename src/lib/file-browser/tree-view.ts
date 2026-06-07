import type { WatchedFolderRecord } from '@/lib/file-system/db';

import type { BrowserFileRecord, SortBy, SortOrder } from './utils';
import { sortFiles } from './utils';

export interface TreeFolderNode {
  kind: 'folder';
  id: string;
  name: string;
  path: string;
  children: TreeNode[];
  isRoot: boolean;
}

export interface TreeFileNode {
  kind: 'file';
  id: string;
  name: string;
  path: string;
  file: BrowserFileRecord;
}

export type TreeNode = TreeFolderNode | TreeFileNode;

interface BuildTreeViewOptions {
  sortBy: SortBy;
  sortOrder: SortOrder;
}

function normalizePath(path: string) {
  return path
    .replace(/^\\\\\?\\/, '')
    .replace(/^\\\?\\/, '')
    .replace(/\\/g, '/');
}

function comparePath(a: string, b: string) {
  return normalizePath(a).localeCompare(normalizePath(b));
}

function findNearestWatchedRoot(
  filePath: string,
  watchedFolders: WatchedFolderRecord[]
) {
  const normalizedFilePath = normalizePath(filePath).toLowerCase();

  return watchedFolders
    .filter((folder) => folder.enabled)
    .sort((a, b) => b.path.length - a.path.length)
    .find((folder) => {
      const normalizedRoot = normalizePath(folder.path).toLowerCase();
      return (
        normalizedFilePath === normalizedRoot
        || normalizedFilePath.startsWith(`${normalizedRoot}/`)
      );
    });
}

function getRelativeSegments(filePath: string, rootPath: string) {
  const normalizedFilePath = normalizePath(filePath);
  const normalizedRootPath = normalizePath(rootPath);
  const relativePath = normalizedFilePath.slice(normalizedRootPath.length).replace(/^\/+/, '');
  return relativePath.split('/').filter(Boolean);
}

function getPathSegments(path: string) {
  return normalizePath(path).split('/').filter(Boolean);
}

function getDirectoryPath(filePath: string) {
  const segments = getPathSegments(filePath);
  if (segments.length <= 1) {
    return normalizePath(filePath);
  }

  return segments.slice(0, -1).join('/');
}

function getCommonDirectory(paths: string[]) {
  const segmentGroups = paths
    .map((path) => getPathSegments(path))
    .filter((segments) => segments.length > 0);

  if (segmentGroups.length === 0) {
    return null;
  }

  const [firstGroup, ...remainingGroups] = segmentGroups;
  const commonSegments: string[] = [];

  for (let index = 0; index < firstGroup.length; index += 1) {
    const segment = firstGroup[index];
    if (remainingGroups.every((segments) => segments[index] === segment)) {
      commonSegments.push(segment);
      continue;
    }

    break;
  }

  return commonSegments.length > 0 ? commonSegments.join('/') : null;
}

function getPathAnchor(path: string) {
  const segments = getPathSegments(path);
  return segments[0]?.toLowerCase() ?? '';
}

function inferWatchedRootsFromFiles(files: BrowserFileRecord[]): WatchedFolderRecord[] {
  const directoryPathsByAnchor = new Map<string, string[]>();

  for (const file of files) {
    const directoryPath = getDirectoryPath(file.path);
    const anchor = getPathAnchor(directoryPath);
    const paths = directoryPathsByAnchor.get(anchor) ?? [];
    paths.push(directoryPath);
    directoryPathsByAnchor.set(anchor, paths);
  }

  return Array.from(directoryPathsByAnchor.values())
    .map((directoryPaths) => getCommonDirectory(directoryPaths))
    .filter((path): path is string => Boolean(path))
    .sort(comparePath)
    .map((path) => ({
      path,
      enabled: true,
      status: 'watching',
    }));
}

function sortTreeNodes(nodes: TreeNode[], sortBy: SortBy, sortOrder: SortOrder): TreeNode[] {
  const folders = nodes
    .filter((node): node is TreeFolderNode => node.kind === 'folder')
    .sort((a, b) => a.name.localeCompare(b.name));
  const files = sortFiles(
    nodes
      .filter((node): node is TreeFileNode => node.kind === 'file')
      .map((node) => node.file),
    sortBy,
    sortOrder
  ).map<TreeFileNode>((file) => ({
    kind: 'file',
    id: file.path,
    name: file.name,
    path: file.path,
    file,
  }));

  return [
    ...folders.map((folder) => ({
      ...folder,
      children: sortTreeNodes(folder.children, sortBy, sortOrder),
    })),
    ...files,
  ];
}

export function buildTreeView(
  files: BrowserFileRecord[],
  watchedFolders: WatchedFolderRecord[],
  options: BuildTreeViewOptions
): TreeFolderNode[] {
  const rootMap = new Map<string, TreeFolderNode>();
  const enabledWatchedFolders = watchedFolders.filter((entry) => entry.enabled);
  const effectiveWatchedFolders = enabledWatchedFolders.length > 0
    ? enabledWatchedFolders
    : inferWatchedRootsFromFiles(files);

  for (const folder of [...effectiveWatchedFolders].sort((a, b) => comparePath(a.path, b.path))) {
    const rootPath = normalizePath(folder.path);
    rootMap.set(rootPath, {
      kind: 'folder',
      id: rootPath,
      name: getLastSegment(rootPath),
      path: rootPath,
      children: [],
      isRoot: true,
    });
  }

  for (const file of files) {
    const root = findNearestWatchedRoot(file.path, effectiveWatchedFolders);
    if (!root) {
      continue;
    }

    const rootNode = rootMap.get(normalizePath(root.path));
    if (!rootNode) {
      continue;
    }

    const segments = getRelativeSegments(file.path, root.path);
    if (segments.length === 0) {
      continue;
    }

    let currentFolder = rootNode;
    let currentPath = normalizePath(root.path);
    const folderSegments = segments.slice(0, -1);

    for (const segment of folderSegments) {
      currentPath = `${currentPath}/${segment}`;
      let nextFolder = currentFolder.children.find(
        (node): node is TreeFolderNode => node.kind === 'folder' && node.name === segment
      );

      if (!nextFolder) {
        nextFolder = {
          kind: 'folder',
          id: currentPath,
          name: segment,
          path: currentPath,
          children: [],
          isRoot: false,
        };
        currentFolder.children.push(nextFolder);
      }

      currentFolder = nextFolder;
    }

    currentFolder.children.push({
      kind: 'file',
      id: file.path,
      name: file.name,
      path: file.path,
      file,
    });
  }

  return [...rootMap.values()]
    .filter((root) => root.children.length > 0)
    .map((root) => ({
      ...root,
      children: sortTreeNodes(root.children, options.sortBy, options.sortOrder),
    }));
}

export function flattenVisibleTreePaths(nodes: TreeNode[]) {
  const paths: string[] = [];

  for (const node of nodes) {
    paths.push(node.path);
    if (node.kind === 'folder') {
      paths.push(...flattenVisibleTreePaths(node.children));
    }
  }

  return paths;
}

export function getTreeAutoExpandedPaths(
  files: BrowserFileRecord[],
  watchedFolders: WatchedFolderRecord[]
) {
  const firstFile = files[0];
  if (!firstFile) {
    return [];
  }

  const root = findNearestWatchedRoot(firstFile.path, watchedFolders);
  if (!root) {
    return [];
  }

  const normalizedRootPath = normalizePath(root.path);
  const segments = getRelativeSegments(firstFile.path, root.path).slice(0, -1);
  const expandedPaths = [normalizedRootPath];
  let currentPath = normalizedRootPath;

  for (const segment of segments) {
    currentPath = `${currentPath}/${segment}`;
    expandedPaths.push(currentPath);
  }

  return expandedPaths;
}

function getLastSegment(path: string) {
  const segments = normalizePath(path).split('/').filter(Boolean);
  return segments.at(-1) || path;
}
