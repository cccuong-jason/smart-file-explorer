'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowRight, BellDot, ChevronLeft, ChevronRight, Clock3, FileStack, Pin, ScanSearch, X } from 'lucide-react';
import { useTranslation } from '@/lib/i18n';
import type { WorkInboxItem } from '@/lib/work-inbox/items';

interface WorkInboxPanelProps {
  items: WorkInboxItem[];
  onOpenFile: (file: any) => void;
  onOpenWorkspace: (workspaceId: string) => void;
  onDismissItem: (itemKey: string) => void;
  onToggleItemPin: (itemId: string) => void;
  hiddenItemCount?: number;
  onResetDismissedItems?: () => void;
}

const VISIBLE_ITEM_COUNT = 2;

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
  onToggleItemPin,
  hiddenItemCount = 0,
  onResetDismissedItems,
}: WorkInboxPanelProps) {
  const { t } = useTranslation();
  const [startIndex, setStartIndex] = useState(0);
  const leadingItemIdRef = useRef<string | null>(items[0]?.id ?? null);

  const maxStartIndex = Math.max(0, items.length - VISIBLE_ITEM_COUNT);
  const visibleItems = useMemo(
    () => items.slice(startIndex, startIndex + VISIBLE_ITEM_COUNT),
    [items, startIndex],
  );

  useEffect(() => {
    const previousLeadingId = leadingItemIdRef.current;
    if (!previousLeadingId) {
      setStartIndex(0);
      return;
    }

    const nextIndex = items.findIndex((item) => item.id === previousLeadingId);
    if (nextIndex >= 0) {
      setStartIndex(Math.min(nextIndex, maxStartIndex));
      return;
    }

    setStartIndex((current) => Math.min(current, maxStartIndex));
  }, [items, maxStartIndex]);

  useEffect(() => {
    leadingItemIdRef.current = visibleItems[0]?.id ?? null;
  }, [visibleItems]);

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

  const canNavigateBackward = startIndex > 0;
  const canNavigateForward = startIndex < maxStartIndex;
  const rangeEnd = Math.min(items.length, startIndex + VISIBLE_ITEM_COUNT);

  return (
    <section className="border-b border-[var(--ui-border)] bg-[var(--ui-surface)] px-6 py-4">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-[var(--ui-primary)]">
            <BellDot className="h-4 w-4" />
            <h2 className="text-sm font-bold uppercase tracking-wider">{t('work_inbox_title')}</h2>
          </div>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{t('work_inbox_description')}</p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {hiddenItemCount > 0 && onResetDismissedItems && (
            <button
              type="button"
              onClick={onResetDismissedItems}
              className="rounded-full border border-[var(--ui-border)] bg-[var(--ui-surface-muted)] px-3 py-1.5 text-xs font-semibold text-gray-600 transition-colors hover:bg-[var(--ui-primary-soft)] dark:text-gray-300"
            >
              {t('work_inbox_restore_hidden', { count: hiddenItemCount })}
            </button>
          )}

          {items.length > VISIBLE_ITEM_COUNT && (
            <>
              <span className="text-xs font-medium text-gray-500 dark:text-gray-400">
                {t('work_inbox_range', { start: startIndex + 1, end: rangeEnd, total: items.length })}
              </span>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  aria-label={t('work_inbox_previous')}
                  onClick={() => setStartIndex((current) => Math.max(0, current - VISIBLE_ITEM_COUNT))}
                  disabled={!canNavigateBackward}
                  className="rounded-full border border-[var(--ui-border)] bg-[var(--ui-surface-muted)] p-2 text-gray-600 transition-colors hover:bg-[var(--ui-primary-soft)] disabled:cursor-not-allowed disabled:opacity-50 dark:text-gray-300"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  aria-label={t('work_inbox_next')}
                  onClick={() => setStartIndex((current) => Math.min(maxStartIndex, current + VISIBLE_ITEM_COUNT))}
                  disabled={!canNavigateForward}
                  className="rounded-full border border-[var(--ui-border)] bg-[var(--ui-surface-muted)] p-2 text-gray-600 transition-colors hover:bg-[var(--ui-primary-soft)] disabled:cursor-not-allowed disabled:opacity-50 dark:text-gray-300"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      <div className="mt-4 grid gap-3 xl:grid-cols-2">
        {visibleItems.map((item) => {
          const ItemIcon = getItemIcon(item.type);

          return (
            <article
              key={item.id}
              className={`rounded-2xl border bg-[var(--ui-surface)] shadow-sm transition-colors ${
                item.isPinned
                  ? 'border-[var(--ui-primary-border)] ring-1 ring-[var(--ui-primary-border)]/70'
                  : 'border-[var(--ui-border)]'
              }`}
            >
              <div className="flex items-center justify-between gap-2 border-b border-[var(--ui-border)] px-4 py-3">
                <div className="flex min-w-0 items-center gap-2">
                  <span className="rounded-full border border-[var(--ui-border)] bg-[var(--ui-surface-muted)] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                    {item.kindLabel}
                  </span>
                  <span className="truncate text-xs font-medium text-gray-500 dark:text-gray-400">
                    {item.workspaceTitle}
                  </span>
                  {item.isPinned && (
                    <span className="rounded-full bg-[var(--ui-primary-soft)] px-2 py-0.5 text-[10px] font-semibold text-[var(--ui-primary)]">
                      {t('work_inbox_pinned_item')}
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    aria-label={item.isPinned ? t('work_inbox_unpin_item') : t('work_inbox_pin_item')}
                    onClick={() => onToggleItemPin(item.id)}
                    className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold transition-colors ${
                      item.isPinned
                        ? 'border-[var(--ui-primary-border)] bg-[var(--ui-primary-soft)] text-[var(--ui-primary)]'
                        : 'border-[var(--ui-border)] bg-[var(--ui-surface-muted)] text-gray-600 dark:text-gray-300'
                    }`}
                  >
                    <span className="inline-flex items-center gap-1.5">
                      <Pin className="h-3.5 w-3.5" />
                      {item.isPinned ? t('work_inbox_unpin_label') : t('work_inbox_pin_label')}
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
              </div>

              <button
                type="button"
                onClick={() => handlePrimaryAction(item)}
                className="flex w-full items-start justify-between gap-4 px-4 py-4 text-left"
              >
                <div className="flex min-w-0 items-start gap-3">
                  <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[var(--ui-border)] bg-[var(--ui-surface-muted)]">
                    <ItemIcon className="h-4 w-4 text-[var(--ui-primary)]" />
                  </div>
                  <div className="min-w-0">
                    <h3 className="truncate text-sm font-semibold text-gray-900 dark:text-gray-100">
                      {item.title}
                    </h3>
                    <p className="mt-1 line-clamp-2 text-sm text-gray-600 dark:text-gray-300">{item.reason}</p>
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

                <span className="inline-flex shrink-0 items-center gap-2 rounded-lg border border-[var(--ui-border)] bg-[var(--ui-surface-muted)] px-3 py-2 text-xs font-semibold text-[var(--ui-primary)] transition-colors hover:bg-[var(--ui-primary-soft)]">
                  {item.actionLabel}
                  <ArrowRight className="h-3.5 w-3.5" />
                </span>
              </button>
            </article>
          );
        })}
      </div>
    </section>
  );
}
