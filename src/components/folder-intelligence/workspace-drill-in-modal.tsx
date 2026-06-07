'use client';

import { useEffect, useState } from 'react';
import { ArrowRight, ChevronDown, ChevronUp, Clock3, FileStack, FolderKanban, FolderTree, Pin, ScanSearch, X } from 'lucide-react';
import { useTranslation } from '@/lib/i18n';
import type { FolderInsight } from '@/lib/folder-intelligence/workspaces';
import { getWorkspaceOpenNowItemId } from '@/lib/work-inbox/items';
import type { TreeFolderNode } from '@/lib/file-browser/tree-view';
import { TreeView } from '@/components/file-viewer/tree-view';
import { Button } from '@/components/retroui/Button';

type Translate = (key: string, variables?: Record<string, string | number>) => string;

interface WorkspaceDrillInModalProps {
  isOpen: boolean;
  insight: FolderInsight | null;
  workspaceTreeNodes?: TreeFolderNode[];
  selectedPath?: string | null;
  isPinned: boolean;
  onClose: () => void;
  onOpenFile: (file: any) => void;
  onTogglePin: (itemId: string) => void;
}

function getLocalizedWorkspaceSummary(insight: FolderInsight, t: Translate, language: string) {
  if (language === 'en') {
    return insight.summary;
  }

  const segments = [
    t('workspace_drill_in_summary_top_file', {
      name: insight.topFile.name,
      workspace: insight.title,
    }),
  ];

  if (insight.versionGroups.length > 0) {
    segments.push(t('workspace_drill_in_summary_version_groups', { count: insight.versionGroups.length }));
  }

  if (insight.ocrCount > 0) {
    segments.push(t('workspace_drill_in_summary_ocr', { count: insight.ocrCount }));
  }

  return segments.join(' ');
}

export function WorkspaceDrillInModal({
  isOpen,
  insight,
  workspaceTreeNodes = [],
  selectedPath = null,
  isPinned,
  onClose,
  onOpenFile,
  onTogglePin,
}: WorkspaceDrillInModalProps) {
  const { t, language } = useTranslation();
  const [showAllVersions, setShowAllVersions] = useState(false);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (isOpen && event.key === 'Escape') {
        event.preventDefault();
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  useEffect(() => {
    if (!isOpen) {
      setShowAllVersions(false);
    }
  }, [isOpen, insight?.id]);

  if (!isOpen || !insight) {
    return null;
  }

  const versionGroup = insight.versionGroups[0];
  const pinnedItemId = getWorkspaceOpenNowItemId(insight.id);
  const alternateFiles = versionGroup?.files.slice(1) ?? [];
  const summary = getLocalizedWorkspaceSummary(insight, t, language);

  return (
    <div
      className="fixed inset-0 z-[160] flex items-center justify-center bg-black/45 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        className="flex h-[82vh] w-full max-w-5xl flex-col overflow-hidden rounded border-2 border-border bg-card text-card-foreground shadow-md"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4 border-b-2 border-border bg-secondary px-6 py-5">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-[var(--ui-primary)]">
              <FolderKanban className="h-4 w-4" />
              <span className="font-head text-xs font-bold uppercase">
                {t('workspace_drill_in_label')}
              </span>
            </div>
            <h2 className="mt-2 truncate font-head text-xl font-semibold text-foreground">
              {insight.title}
            </h2>
            <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
              {summary}
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <span className="rounded border-2 border-border bg-card px-2.5 py-1 text-[11px] font-medium text-foreground">
                {t('folder_intelligence_files', { count: insight.fileCount })}
              </span>
              {insight.ocrCount > 0 && (
                <span className="rounded border-2 border-border bg-[var(--ui-warning-soft)] px-2.5 py-1 text-[11px] font-medium text-[var(--ui-warning)]">
                  {t('folder_intelligence_ocr', { count: insight.ocrCount })}
                </span>
              )}
            </div>
          </div>
          <Button
            type="button"
            onClick={onClose}
            variant="outline"
            size="icon"
            className="bg-card text-foreground"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
        <div className="flex-1 overflow-y-auto px-6 py-5">
          <div className="grid gap-4 lg:grid-cols-[1.35fr_1fr]">
            <section className="overflow-hidden rounded border-2 border-border bg-card shadow-sm">
              <div className="flex items-center gap-2 border-b-2 border-border bg-secondary px-4 py-3 text-primary">
                <FolderTree className="h-4 w-4" />
                <h3 className="font-head text-sm font-bold uppercase">
                  {t('workspace_drill_in_file_tree')}
                </h3>
              </div>
              <TreeView
                nodes={workspaceTreeNodes}
                selectedPath={selectedPath ?? insight.topFile.path}
                expandAll
                onSelectFile={onOpenFile}
              />
            </section>

            <div className="space-y-4">
              {versionGroup && (
                <section className="rounded border-2 border-border bg-card p-4 shadow-sm">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-2 text-[var(--ui-warning)]">
                      <FileStack className="h-4 w-4" />
                      <h3 className="font-head text-sm font-bold uppercase">
                        {t('workspace_drill_in_version_groups')}
                      </h3>
                    </div>
                    {alternateFiles.length > 0 && (
                      <button
                        type="button"
                        onClick={() => setShowAllVersions((value) => !value)}
                        className="inline-flex items-center gap-1 rounded border-2 border-border bg-secondary px-2.5 py-1 font-head text-[11px] font-semibold text-foreground transition-colors hover:bg-card"
                      >
                        {showAllVersions ? t('workspace_drill_in_hide_alternates') : t('workspace_drill_in_show_alternates')}
                        {showAllVersions ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                      </button>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => onOpenFile(versionGroup.latestFile)}
                    className="mt-3 flex w-full items-center justify-between gap-3 rounded border-2 border-border bg-secondary px-3 py-2.5 text-left hover:bg-card"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-foreground">
                        {versionGroup.latestFile.name}
                      </p>
                      <div className="mt-2 flex flex-wrap gap-2">
                        <span className="rounded border-2 border-border bg-[var(--ui-warning-soft)] px-2 py-0.5 font-head text-[10px] font-semibold text-[var(--ui-warning)]">
                          {t('workspace_drill_in_likely_current')}
                        </span>
                        <span className="rounded border-2 border-border bg-card px-2 py-0.5 text-[10px] font-medium text-foreground">
                          {t('workspace_drill_in_latest_modified')}
                        </span>
                        {versionGroup.latestFile.isLikelyLatest && (
                          <span className="rounded border-2 border-border bg-card px-2 py-0.5 text-[10px] font-medium text-foreground">
                            {t('workspace_drill_in_latest_version_signal')}
                          </span>
                        )}
                      </div>
                      <p className="mt-2 text-xs text-[var(--ui-warning)]">
                        {t('folder_intelligence_alternates', { count: versionGroup.variantCount })}
                      </p>
                    </div>
                    <ArrowRight className="h-4 w-4 shrink-0 text-[var(--ui-warning)]" />
                  </button>

                  {showAllVersions && alternateFiles.length > 0 && (
                    <div className="mt-3 space-y-2">
                      <p className="font-head text-[11px] font-semibold uppercase text-muted-foreground">
                        {t('workspace_drill_in_alternate_versions')}
                      </p>
                      {alternateFiles.map((file) => (
                        <button
                          key={file.path}
                          type="button"
                          onClick={() => onOpenFile(file)}
                          className="flex w-full items-center justify-between gap-3 rounded border-2 border-border bg-secondary px-3 py-2.5 text-left hover:bg-card"
                        >
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium text-foreground">
                              {file.name}
                            </p>
                            <p className="mt-1 text-xs text-muted-foreground">
                              {new Date(file.lastModified).toLocaleDateString()}
                            </p>
                          </div>
                          <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                        </button>
                      ))}
                    </div>
                  )}
                </section>
              )}

              <section className="rounded border-2 border-border bg-card p-4 shadow-sm">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Clock3 className="h-4 w-4" />
                  <h3 className="font-head text-sm font-bold uppercase">
                    {t('workspace_drill_in_recent_changes')}
                  </h3>
                </div>
                <div className="mt-3 space-y-2">
                  {insight.recentFiles.length > 0 ? (
                    insight.recentFiles.slice(0, 4).map((file) => (
                      <button
                        key={file.path}
                        type="button"
                        onClick={() => onOpenFile(file)}
                        className="flex w-full items-center justify-between gap-3 rounded border-2 border-border bg-secondary px-3 py-2.5 text-left hover:bg-card"
                      >
                        <p className="truncate text-sm font-medium text-foreground">
                          {file.name}
                        </p>
                        <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                      </button>
                    ))
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      {t('workspace_drill_in_no_recent_changes')}
                    </p>
                  )}
                </div>
              </section>

              {insight.ocrCount > 0 && (
                <section className="rounded border-2 border-border bg-card p-4 shadow-sm">
                  <div className="flex items-center gap-2 text-[var(--ui-warning)]">
                    <ScanSearch className="h-4 w-4" />
                    <h3 className="font-head text-sm font-bold uppercase">
                      {t('workspace_drill_in_ocr_attention')}
                    </h3>
                  </div>
                  <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                    {t('workspace_drill_in_ocr_summary', { count: insight.ocrCount })}
                  </p>
                </section>
              )}
            </div>
          </div>
        </div>
        <div
          data-testid="workspace-pin-footer"
          className="flex justify-end border-t-2 border-border bg-secondary px-6 py-4"
        >
          <Button
            type="button"
            aria-pressed={isPinned}
            onClick={() => onTogglePin(pinnedItemId)}
            variant={isPinned ? 'default' : 'outline'}
            size="sm"
            className={`gap-2 text-xs ${
              isPinned
                ? ''
                : 'bg-card text-foreground'
            }`}
          >
            <Pin className={`h-3.5 w-3.5 transition-transform duration-200 ${isPinned ? 'fill-current rotate-12' : ''}`} />
            {isPinned ? t('work_inbox_unpin_item') : t('work_inbox_pin_item')}
          </Button>
        </div>
      </div>
    </div>
  );
}
