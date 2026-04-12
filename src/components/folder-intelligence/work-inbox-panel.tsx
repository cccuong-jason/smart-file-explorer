'use client';

import { useMemo, useState } from 'react';
import { ArrowRight, BellDot, Clock3, FileStack, Pin, ScanSearch, X } from 'lucide-react';
import { useTranslation } from '@/lib/i18n';
import type { WorkInboxItem } from '@/lib/work-inbox/items';

interface WorkInboxPanelProps {
  items: WorkInboxItem[];
  onOpenFile: (file: any) => void;
  onOpenWorkspace: (workspaceId: string) => void;
  onDismissItem: (itemKey: string) => void;
  onToggleWorkspacePin: (workspaceId: string) => void;
  hiddenItemCount?: number;
  onResetDismissedItems?: () => void;
}

function getItemIcon(type: WorkInboxItem['type']) {
  switch (type) {
    case 'continue_now':
      return ArrowRight;
    case 'needs_review':
      return Clock3;
    case 'version_conflict':
      return FileStack;
    case 'ocr_attention':
      return ScanSearch;
    case 'recent_change':
      return Clock3;
    default:
      return BellDot;
  }
}

export function WorkInboxPanel({
  items,
  onOpenFile,
  onOpenWorkspace,
  onDismissItem,
  onToggleWorkspacePin,
  hiddenItemCount = 0,
  onResetDismissedItems,
}: WorkInboxPanelProps) {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState(false);

  const visibleItems = useMemo(() => (
    expanded ? items : items.slice(0, 3)
  ), [expanded, items]);

  if (items.length === 0) {
    return null;
  }

  const handlePrimaryAction = (item: WorkInboxItem) => {
    if (item.actionMode === 'open_workspace') {
      onOpenWorkspace(item.workspaceId);
      return;
    }

    onOpenFile(item.primaryFile);
  };

  return (
    <section className="border-b border-[var(--ui-border)] bg-[var(--ui-surface)] px-6 py-4">
      <div className="flex items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-[var(--ui-primary)]">
            <BellDot className="h-4 w-4" />
            <h2 className="text-sm font-bold uppercase tracking-wider">{t('work_inbox_title')}</h2>
          </div>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{t('work_inbox_description')}</p>
        </div>
        <div className="flex items-center gap-2">
          {hiddenItemCount > 0 && onResetDismissedItems && (
            <button
              type="button"
              onClick={onResetDismissedItems}
              className="rounded-full border border-[var(--ui-border)] bg-[var(--ui-surface-muted)] px-3 py-1.5 text-xs font-semibold text-gray-600 transition-colors hover:bg-[var(--ui-primary-soft)] dark:text-gray-300"
            >
              {t('work_inbox_restore_hidden', { count: hiddenItemCount })}
            </button>
          )}
          {items.length > 3 && (
            <button
              type="button"
              onClick={() => setExpanded((value) => !value)}
              className="rounded-full border border-[var(--ui-border)] bg-[var(--ui-surface-muted)] px-3 py-1.5 text-xs font-semibold text-[var(--ui-primary)] transition-colors hover:bg-[var(--ui-primary-soft)]"
            >
              {expanded ? t('folder_intelligence_show_less') : t('folder_intelligence_show_more')}
            </button>
          )}
        </div>
      </div>

      <div className="mt-4 space-y-3">
        {visibleItems.map((item) => {
          const ItemIcon = getItemIcon(item.type);

          return (
            <div
              key={item.id}
              className="rounded-2xl border border-[var(--ui-border)] bg-[var(--ui-surface)] p-4 shadow-sm"
            >
              <div className="mb-3 flex items-center justify-end gap-2">
                <button
                  type="button"
                  aria-label={item.isPinnedWorkspace ? t('work_inbox_unpin_workspace') : t('work_inbox_pin_workspace')}
                  onClick={() => onToggleWorkspacePin(item.workspaceId)}
                  className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold transition-colors ${
                    item.isPinnedWorkspace
                      ? 'border-[var(--ui-primary-border)] bg-[var(--ui-primary-soft)] text-[var(--ui-primary)]'
                      : 'border-[var(--ui-border)] bg-[var(--ui-surface-muted)] text-gray-600 dark:text-gray-300'
                  }`}
                >
                  <span className="inline-flex items-center gap-1.5">
                    <Pin className="h-3.5 w-3.5" />
                    {item.isPinnedWorkspace ? t('work_inbox_pinned_workspace') : t('work_inbox_pin_label')}
                  </span>
                </button>
                <button
                  type="button"
                  aria-label={t('work_inbox_dismiss')}
                  onClick={() => onDismissItem(item.stateKey)}
                  className="rounded-full border border-[var(--ui-border)] bg-[var(--ui-surface-muted)] p-1.5 text-gray-500 transition-colors hover:bg-[var(--ui-surface)] hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>

              <div className="flex items-start justify-between gap-4">
                <div className="flex min-w-0 items-start gap-3">
                  <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-[var(--ui-border)] bg-[var(--ui-surface-muted)]">
                    <ItemIcon className="h-4 w-4 text-[var(--ui-primary)]" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-full border border-[var(--ui-border)] bg-[var(--ui-surface-muted)] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                        {item.kindLabel}
                      </span>
                      <h3 className="truncate text-sm font-semibold text-gray-900 dark:text-gray-100">{item.title}</h3>
                      <span className="rounded-full border border-[var(--ui-border)] bg-[var(--ui-primary-soft)] px-2 py-0.5 text-[10px] font-semibold text-[var(--ui-primary)]">
                        {item.workspaceTitle}
                      </span>
                      {item.isPinnedWorkspace && (
                        <span className="rounded-full border border-[var(--ui-primary-border)] bg-[var(--ui-primary-soft)] px-2 py-0.5 text-[10px] font-semibold text-[var(--ui-primary)]">
                          {t('work_inbox_pinned_workspace')}
                        </span>
                      )}
                    </div>
                    <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">{item.reason}</p>
                    {item.evidence.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-2">
                        {item.evidence.slice(0, 2).map((entry) => (
                          <span
                            key={entry}
                            className="rounded-full border border-[var(--ui-border)] bg-[var(--ui-surface-muted)] px-2.5 py-1 text-[11px] font-medium text-gray-600 dark:text-gray-300"
                          >
                            {entry}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => handlePrimaryAction(item)}
                  className="shrink-0 rounded-lg border border-[var(--ui-border)] bg-[var(--ui-surface-muted)] px-3 py-2 text-xs font-semibold text-[var(--ui-primary)] transition-colors hover:bg-[var(--ui-primary-soft)]"
                >
                  <span className="inline-flex items-center gap-2">
                    {item.actionLabel}
                    <ArrowRight className="h-3.5 w-3.5" />
                  </span>
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
