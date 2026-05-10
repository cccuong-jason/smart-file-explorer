'use client';

import { useEffect, useMemo, useState } from 'react';
import { ChevronDown, ChevronRight, FileText, FolderOpen, FolderTree } from 'lucide-react';

import type { BrowserFileRecord } from '@/lib/file-browser/utils';
import type { TreeFolderNode, TreeNode } from '@/lib/file-browser/tree-view';
import { useTranslation } from '@/lib/i18n';

interface TreeViewProps {
  nodes: TreeFolderNode[];
  selectedPath: string | null;
  autoExpandPaths?: string[];
  onSelectFile: (file: BrowserFileRecord) => void;
}

export function TreeView({ nodes, selectedPath, autoExpandPaths = [], onSelectFile }: TreeViewProps) {
  const { t } = useTranslation();
  const defaultExpanded = useMemo(() => {
    const expanded = new Set<string>();

    const visit = (node: TreeNode) => {
      if (node.kind === 'folder') {
        if (node.isRoot) {
          expanded.add(node.path);
        }
        node.children.forEach(visit);
      }
    };

    nodes.forEach(visit);
    return expanded;
  }, [nodes]);

  const [expandedPaths, setExpandedPaths] = useState<Set<string>>(defaultExpanded);

  useEffect(() => {
    if (autoExpandPaths.length === 0) {
      return;
    }

    setExpandedPaths((current) => {
      const next = new Set(current);
      autoExpandPaths.forEach((path) => next.add(path));
      return next;
    });
  }, [autoExpandPaths]);

  if (nodes.length === 0) {
    return (
      <div className="m-4 rounded-2xl border border-[var(--ui-border)] bg-[var(--ui-surface)] p-8 text-center">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-[var(--ui-primary-soft)] text-[var(--ui-primary)]">
          <FolderTree className="h-6 w-6" />
        </div>
        <h3 className="mt-4 text-base font-semibold text-[var(--foreground)]">
          {t('tree_view_empty_title')}
        </h3>
        <p className="mt-2 text-sm text-[var(--ui-secondary)]">
          {t('tree_view_empty_description')}
        </p>
      </div>
    );
  }

  const toggleFolder = (path: string) => {
    setExpandedPaths((current) => {
      const next = new Set(current);
      if (next.has(path)) {
        next.delete(path);
      } else {
        next.add(path);
      }
      return next;
    });
  };

  return (
    <div className="flex flex-col gap-2 p-4">
      {nodes.map((node) => (
        <TreeNodeRow
          key={node.path}
          node={node}
          depth={0}
          expandedPaths={expandedPaths}
          selectedPath={selectedPath}
          onToggleFolder={toggleFolder}
          onSelectFile={onSelectFile}
        />
      ))}
    </div>
  );
}

interface TreeNodeRowProps {
  node: TreeNode;
  depth: number;
  expandedPaths: Set<string>;
  selectedPath: string | null;
  onToggleFolder: (path: string) => void;
  onSelectFile: (file: BrowserFileRecord) => void;
}

function TreeNodeRow({
  node,
  depth,
  expandedPaths,
  selectedPath,
  onToggleFolder,
  onSelectFile,
}: TreeNodeRowProps) {
  const { t } = useTranslation();
  const indentStyle = { paddingLeft: `${depth * 18}px` };

  if (node.kind === 'folder') {
    const isExpanded = expandedPaths.has(node.path);

    return (
      <div>
        <button
          type="button"
          onClick={() => onToggleFolder(node.path)}
          aria-label={t('tree_view_toggle_folder', { name: node.name })}
          className="flex w-full items-center gap-2 rounded-xl border border-transparent px-3 py-2 text-left text-sm text-[var(--foreground)] transition-colors hover:border-[var(--ui-border)] hover:bg-[var(--ui-surface)]"
          style={indentStyle}
        >
          {isExpanded ? (
            <ChevronDown className="h-4 w-4 text-[var(--ui-secondary)]" />
          ) : (
            <ChevronRight className="h-4 w-4 text-[var(--ui-secondary)]" />
          )}
          <FolderOpen className="h-4 w-4 text-[var(--ui-primary)]" />
          <span className="font-medium">{node.name}</span>
          {node.isRoot ? (
            <span className="ml-2 rounded-full bg-[var(--ui-primary-soft)] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[var(--ui-primary)]">
              {t('tree_view_root_label')}
            </span>
          ) : null}
        </button>

        {isExpanded ? (
          <div className="mt-1 flex flex-col gap-1">
            {node.children.map((child) => (
              <TreeNodeRow
                key={child.path}
                node={child}
                depth={depth + 1}
                expandedPaths={expandedPaths}
                selectedPath={selectedPath}
                onToggleFolder={onToggleFolder}
                onSelectFile={onSelectFile}
              />
            ))}
          </div>
        ) : null}
      </div>
    );
  }

  const isSelected = selectedPath === node.path;

  return (
    <button
      type="button"
      onClick={() => onSelectFile(node.file)}
      className={`flex w-full items-center gap-2 rounded-xl border px-3 py-2 text-left text-sm transition-colors ${
        isSelected
          ? 'border-[var(--ui-primary-border)] bg-[var(--ui-primary-soft)] text-[var(--ui-primary-strong)]'
          : 'border-transparent text-[var(--foreground)] hover:border-[var(--ui-border)] hover:bg-[var(--ui-surface)]'
      }`}
      style={indentStyle}
    >
      <div className="w-4" />
      <FileText className="h-4 w-4 text-[var(--ui-secondary)]" />
      <span className="truncate">{node.name}</span>
    </button>
  );
}
