'use client';

import { useEffect } from 'react';
import { ArrowRight, Clock3, FileStack, FolderKanban, Pin, ScanSearch, Star, X } from 'lucide-react';
import { useTranslation } from '@/lib/i18n';
import type { FolderInsight } from '@/lib/folder-intelligence/workspaces';

interface WorkspaceDrillInModalProps {
  isOpen: boolean;
  insight: FolderInsight | null;
  isPinned: boolean;
  onClose: () => void;
  onOpenFile: (file: any) => void;
  onTogglePin: (workspaceId: string) => void;
}

export function WorkspaceDrillInModal({
  isOpen,
  insight,
  isPinned,
  onClose,
  onOpenFile,
  onTogglePin,
}: WorkspaceDrillInModalProps) {
  const { t } = useTranslation();

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

  if (!isOpen || !insight) {
    return null;
  }

  const versionGroup = insight.versionGroups[0];

  return (
    <div
      className="fixed inset-0 z-[160] flex items-center justify-center bg-black/45 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        className="flex h-[82vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl border border-[var(--ui-border)] bg-[var(--ui-surface)] shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4 border-b border-[var(--ui-border)] bg-[var(--ui-surface-muted)] px-6 py-5">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-[var(--ui-primary)]">
              <FolderKanban className="h-4 w-4" />
              <span className="text-xs font-bold uppercase tracking-wider">
                {t('workspace_drill_in_label')}
              </span>
            </div>
            <h2 className="mt-2 truncate text-xl font-semibold text-gray-900 dark:text-gray-100">
              {insight.title}
            </h2>
            <p className="mt-1 text-sm leading-relaxed text-gray-600 dark:text-gray-300">
              {insight.summary}
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <span className="rounded-full border border-[var(--ui-border)] bg-[var(--ui-surface)] px-2.5 py-1 text-[11px] font-medium text-gray-600 dark:text-gray-300">
                {t('folder_intelligence_files', { count: insight.fileCount })}
              </span>
              {insight.ocrCount > 0 && (
                <span className="rounded-full border border-[var(--ui-border)] bg-[var(--ui-warning-soft)] px-2.5 py-1 text-[11px] font-medium text-[var(--ui-warning)]">
                  {t('folder_intelligence_ocr', { count: insight.ocrCount })}
                </span>
              )}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-[var(--ui-border)] bg-[var(--ui-surface)] p-2 text-gray-500 transition-colors hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="px-6 pb-4">
          <button
            type="button"
            onClick={() => onTogglePin(insight.id)}
            className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors ${
              isPinned
                ? 'border-[var(--ui-primary-border)] bg-[var(--ui-primary-soft)] text-[var(--ui-primary)]'
                : 'border-[var(--ui-border)] bg-[var(--ui-surface)] text-gray-600 dark:text-gray-300'
            }`}
          >
            <Pin className="h-3.5 w-3.5" />
            {isPinned ? t('work_inbox_unpin_workspace') : t('work_inbox_pin_workspace')}
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5">
          <div className="grid gap-4 lg:grid-cols-[1.35fr_1fr]">
            <section className="rounded-2xl border border-[var(--ui-border)] bg-[var(--ui-surface)] p-4 shadow-sm">
              <div className="flex items-center justify-between gap-3">
                <h3 className="text-sm font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                  {t('folder_intelligence_top_file')}
                </h3>
                {insight.topFile.isStarred && (
                  <span className="text-amber-500">
                    <Star className="h-4 w-4 fill-current" />
                  </span>
                )}
              </div>
              <button
                type="button"
                onClick={() => onOpenFile(insight.topFile)}
                className="mt-3 flex w-full items-center justify-between gap-3 rounded-xl border border-[var(--ui-border)] bg-[var(--ui-surface-muted)] p-3 text-left"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-gray-900 dark:text-gray-100">
                    {insight.topFile.name}
                  </p>
                  {insight.rationale?.[0] && (
                    <p className="mt-1 text-xs leading-relaxed text-gray-500 dark:text-gray-400">
                      {insight.rationale[0]}
                    </p>
                  )}
                </div>
                <ArrowRight className="h-4 w-4 shrink-0 text-[var(--ui-primary)]" />
              </button>

              {insight.importantFiles.length > 0 && (
                <div className="mt-4">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                    {t('workspace_drill_in_important_documents')}
                  </h4>
                  <div className="mt-2 space-y-2">
                    {insight.importantFiles.slice(0, 4).map((file) => (
                      <button
                        key={file.path}
                        type="button"
                        onClick={() => onOpenFile(file)}
                        className="flex w-full items-center justify-between gap-3 rounded-xl border border-[var(--ui-border)] bg-[var(--ui-surface-muted)] px-3 py-2.5 text-left"
                      >
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-gray-900 dark:text-gray-100">
                            {file.name}
                          </p>
                        </div>
                        <ArrowRight className="h-4 w-4 shrink-0 text-gray-400" />
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </section>

            <div className="space-y-4">
              {versionGroup && (
                <section className="rounded-2xl border border-[var(--ui-border)] bg-[var(--ui-surface)] p-4 shadow-sm">
                  <div className="flex items-center gap-2 text-[var(--ui-warning)]">
                    <FileStack className="h-4 w-4" />
                    <h3 className="text-sm font-bold uppercase tracking-wider">
                      {t('workspace_drill_in_version_groups')}
                    </h3>
                  </div>
                  <button
                    type="button"
                    onClick={() => onOpenFile(versionGroup.latestFile)}
                    className="mt-3 flex w-full items-center justify-between gap-3 rounded-xl border border-[var(--ui-border)] bg-[var(--ui-surface-muted)] px-3 py-2.5 text-left"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-gray-900 dark:text-gray-100">
                        {versionGroup.latestFile.name}
                      </p>
                      <p className="mt-1 text-xs text-[var(--ui-warning)]">
                        {t('folder_intelligence_alternates', { count: versionGroup.variantCount })}
                      </p>
                    </div>
                    <ArrowRight className="h-4 w-4 shrink-0 text-[var(--ui-warning)]" />
                  </button>
                </section>
              )}

              <section className="rounded-2xl border border-[var(--ui-border)] bg-[var(--ui-surface)] p-4 shadow-sm">
                <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400">
                  <Clock3 className="h-4 w-4" />
                  <h3 className="text-sm font-bold uppercase tracking-wider">
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
                        className="flex w-full items-center justify-between gap-3 rounded-xl border border-[var(--ui-border)] bg-[var(--ui-surface-muted)] px-3 py-2.5 text-left"
                      >
                        <p className="truncate text-sm font-medium text-gray-900 dark:text-gray-100">
                          {file.name}
                        </p>
                        <ArrowRight className="h-4 w-4 shrink-0 text-gray-400" />
                      </button>
                    ))
                  ) : (
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      {t('workspace_drill_in_no_recent_changes')}
                    </p>
                  )}
                </div>
              </section>

              {insight.ocrCount > 0 && (
                <section className="rounded-2xl border border-[var(--ui-border)] bg-[var(--ui-surface)] p-4 shadow-sm">
                  <div className="flex items-center gap-2 text-[var(--ui-warning)]">
                    <ScanSearch className="h-4 w-4" />
                    <h3 className="text-sm font-bold uppercase tracking-wider">
                      {t('workspace_drill_in_ocr_attention')}
                    </h3>
                  </div>
                  <p className="mt-3 text-sm leading-relaxed text-gray-600 dark:text-gray-300">
                    {t('workspace_drill_in_ocr_summary', { count: insight.ocrCount })}
                  </p>
                </section>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
