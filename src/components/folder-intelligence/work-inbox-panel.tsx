'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowRight, BellDot, ChevronLeft, ChevronRight, Clock3, FileStack, Pin, ScanSearch, X } from 'lucide-react';
import { useTranslation } from '@/lib/i18n';
import type { WorkInboxItem } from '@/lib/work-inbox/items';
import { Button } from '@/components/retroui/Button';

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
type Translate = (key: string, variables?: Record<string, string | number>) => string;

const itemToneClasses: Record<WorkInboxItem['type'], {
  iconWrap: string;
  icon: string;
  chip: string;
  evidenceChip: string;
}> = {
  continue_now: {
    iconWrap: 'border-emerald-200 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-950/40',
    icon: 'text-emerald-600 dark:text-emerald-300',
    chip: 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200',
    evidenceChip: 'border-emerald-200/80 bg-emerald-50/80 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-200',
  },
  needs_review: {
    iconWrap: 'border-violet-200 bg-violet-50 dark:border-violet-800 dark:bg-violet-950/40',
    icon: 'text-violet-600 dark:text-violet-300',
    chip: 'border-violet-200 bg-violet-50 text-violet-700 dark:border-violet-800 dark:bg-violet-950/40 dark:text-violet-200',
    evidenceChip: 'border-violet-200/80 bg-violet-50/80 text-violet-700 dark:border-violet-800 dark:bg-violet-950/30 dark:text-violet-200',
  },
  open_now: {
    iconWrap: 'border-cyan-200 bg-cyan-50 dark:border-cyan-800 dark:bg-cyan-950/40',
    icon: 'text-cyan-600 dark:text-cyan-300',
    chip: 'border-cyan-200 bg-cyan-50 text-cyan-700 dark:border-cyan-800 dark:bg-cyan-950/40 dark:text-cyan-200',
    evidenceChip: 'border-cyan-200/80 bg-cyan-50/80 text-cyan-700 dark:border-cyan-800 dark:bg-cyan-950/30 dark:text-cyan-200',
  },
  version_conflict: {
    iconWrap: 'border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/40',
    icon: 'text-amber-600 dark:text-amber-300',
    chip: 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200',
    evidenceChip: 'border-amber-200/80 bg-amber-50/80 text-amber-700 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-200',
  },
  ocr_attention: {
    iconWrap: 'border-rose-200 bg-rose-50 dark:border-rose-800 dark:bg-rose-950/40',
    icon: 'text-rose-600 dark:text-rose-300',
    chip: 'border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-800 dark:bg-rose-950/40 dark:text-rose-200',
    evidenceChip: 'border-rose-200/80 bg-rose-50/80 text-rose-700 dark:border-rose-800 dark:bg-rose-950/30 dark:text-rose-200',
  },
  recent_change: {
    iconWrap: 'border-sky-200 bg-sky-50 dark:border-sky-800 dark:bg-sky-950/40',
    icon: 'text-sky-600 dark:text-sky-300',
    chip: 'border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-800 dark:bg-sky-950/40 dark:text-sky-200',
    evidenceChip: 'border-sky-200/80 bg-sky-50/80 text-sky-700 dark:border-sky-800 dark:bg-sky-950/30 dark:text-sky-200',
  },
};

function extractFirstNumber(...values: Array<string | undefined>) {
  for (const value of values) {
    const match = value?.match(/\d+/);
    if (match) {
      return Number(match[0]);
    }
  }

  return 0;
}

function getVersionSubject(item: WorkInboxItem) {
  const match = item.title.match(/^Resolve\s+(.+)\s+versions$/i);
  return match?.[1] ?? item.primaryFile?.name ?? item.workspaceTitle;
}

function getLocalizedEvidence(entry: string, t: Translate) {
  if (/opened recently/i.test(entry)) {
    return t('work_inbox_evidence_opened_recently');
  }

  if (/likely latest/i.test(entry)) {
    return t('likely_latest_version');
  }

  if (/starred/i.test(entry)) {
    return t('work_inbox_evidence_starred');
  }

  if (/recently updated/i.test(entry)) {
    return t('match_reason_recent_update');
  }

  if (/alternates detected/i.test(entry)) {
    return t('work_inbox_evidence_alternates_detected', { count: extractFirstNumber(entry) });
  }

  if (/changed in the last 7 days/i.test(entry)) {
    return t('work_inbox_evidence_changed_last_7_days');
  }

  if (/scanned .* incomplete/i.test(entry)) {
    return t('work_inbox_evidence_scanned_incomplete', { count: extractFirstNumber(entry) || 1 });
  }

  if (/changed since you last opened this workspace/i.test(entry)) {
    return t('work_inbox_evidence_changed_since_workspace');
  }

  if (/changed after your last inbox visit/i.test(entry)) {
    return t('work_inbox_evidence_changed_since_inbox');
  }

  return entry;
}

function getLocalizedItemCopy(item: WorkInboxItem, t: Translate) {
  const fileName = item.primaryFile?.name ?? item.title;
  const workspace = item.workspaceTitle;
  const count = extractFirstNumber(item.reason, ...item.evidence);

  switch (item.type) {
    case 'continue_now':
      return {
        kindLabel: t('work_inbox_kind_continue_now'),
        title: t('work_inbox_title_continue_now', { name: fileName }),
        reason: t('work_inbox_reason_continue_now', { name: fileName, workspace }),
        actionLabel: t('work_inbox_action_open_again'),
      };
    case 'needs_review':
      return {
        kindLabel: t('work_inbox_kind_needs_review'),
        title: t('work_inbox_title_needs_review', { name: fileName }),
        reason: t('work_inbox_reason_needs_review', { name: fileName, workspace }),
        actionLabel: t('work_inbox_action_review_file'),
      };
    case 'open_now':
      return {
        kindLabel: t('work_inbox_kind_open_now'),
        title: t('work_inbox_title_open_now', { name: fileName }),
        reason: t('work_inbox_reason_open_now', { name: fileName, workspace }),
        actionLabel: t('work_inbox_action_open_document'),
      };
    case 'version_conflict':
      return {
        kindLabel: t('work_inbox_kind_version_conflict'),
        title: t('work_inbox_title_version_conflict', { subject: getVersionSubject(item) }),
        reason: t('work_inbox_reason_version_conflict', { count, workspace }),
        actionLabel: t('work_inbox_action_open_latest_file'),
      };
    case 'ocr_attention':
      return {
        kindLabel: t('work_inbox_kind_ocr_attention'),
        title: t('work_inbox_title_ocr_attention'),
        reason: t('work_inbox_reason_ocr_attention', { count, workspace }),
        actionLabel: t('work_inbox_action_open_workspace_file'),
      };
    case 'recent_change':
      return {
        kindLabel: t('work_inbox_kind_recent_change'),
        title: t('work_inbox_title_recent_change'),
        reason: t('work_inbox_reason_recent_change', { count, workspace }),
        actionLabel: t('work_inbox_action_open_changed_file'),
      };
    default:
      return {
        kindLabel: item.kindLabel,
        title: item.title,
        reason: item.reason,
        actionLabel: item.actionLabel,
      };
  }
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
    <section className="border-b-2 border-border bg-card px-6 py-4 text-card-foreground">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-primary">
            <BellDot className="h-4 w-4" />
            <h2 className="font-head text-sm font-bold uppercase">{t('work_inbox_title')}</h2>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">{t('work_inbox_description')}</p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {hiddenItemCount > 0 && onResetDismissedItems && (
            <Button
              type="button"
              onClick={onResetDismissedItems}
              variant="outline"
              size="sm"
              className="bg-card text-xs"
            >
              {t('work_inbox_restore_hidden', { count: hiddenItemCount })}
            </Button>
          )}

          {items.length > VISIBLE_ITEM_COUNT && (
            <>
              <span className="text-xs font-medium text-muted-foreground">
                {t('work_inbox_range', { start: startIndex + 1, end: rangeEnd, total: items.length })}
              </span>
              <div className="flex items-center gap-1">
                <Button
                  type="button"
                  aria-label={t('work_inbox_previous')}
                  onClick={() => setStartIndex((current) => Math.max(0, current - VISIBLE_ITEM_COUNT))}
                  disabled={!canNavigateBackward}
                  variant="outline"
                  size="icon"
                  className="bg-card text-foreground"
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button
                  type="button"
                  aria-label={t('work_inbox_next')}
                  onClick={() => setStartIndex((current) => Math.min(maxStartIndex, current + VISIBLE_ITEM_COUNT))}
                  disabled={!canNavigateForward}
                  variant="outline"
                  size="icon"
                  className="bg-card text-foreground"
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </>
          )}
        </div>
      </div>

      <div className="mt-4 grid gap-3 xl:grid-cols-2">
        {visibleItems.map((item) => {
          const ItemIcon = getItemIcon(item.type);
          const tone = itemToneClasses[item.type];
          const copy = getLocalizedItemCopy(item, t);
          const localizedEvidence = item.evidence.slice(0, 2).map((entry) => getLocalizedEvidence(entry, t));

          return (
            <article
              key={item.id}
              className={`rounded border-2 bg-card shadow-sm transition-all duration-300 ${
                item.isPinned
                  ? 'animate-pin-confirm border-border ring-2 ring-primary'
                  : 'border-border'
              }`}
            >
              <div className="flex items-center justify-between gap-2 border-b-2 border-border bg-secondary px-4 py-3">
                <div className="flex min-w-0 items-center gap-2">
                  <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${tone.chip}`}>
                    {copy.kindLabel}
                  </span>
                  <span className="truncate text-xs font-medium text-gray-500 dark:text-gray-400">
                    {item.workspaceTitle}
                  </span>
                  {item.isPinned && (
                    <span className="rounded border-2 border-border bg-primary px-2 py-0.5 font-head text-[10px] font-semibold text-primary-foreground">
                      {t('work_inbox_pinned_item')}
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    aria-label={item.isPinned ? t('work_inbox_unpin_item') : t('work_inbox_pin_item')}
                    aria-pressed={item.isPinned}
                    onClick={() => {
                      leadingItemIdRef.current = item.id;
                      onToggleItemPin(item.id);
                    }}
                    className={`rounded border-2 px-2.5 py-1 font-head text-[11px] font-semibold transition-all duration-200 ${
                      item.isPinned
                        ? 'border-border bg-primary text-primary-foreground shadow-sm'
                        : 'border-border bg-card text-foreground hover:bg-secondary'
                    }`}
                  >
                    <span className="inline-flex items-center gap-1.5">
                      <Pin className={`h-3.5 w-3.5 transition-transform duration-200 ${item.isPinned ? 'fill-current rotate-12' : ''}`} />
                      {item.isPinned ? t('work_inbox_unpin_label') : t('work_inbox_pin_label')}
                    </span>
                  </button>
                  <button
                    type="button"
                    aria-label={t('work_inbox_dismiss')}
                    onClick={() => onDismissItem(item.stateKey)}
                    className="rounded border-2 border-border bg-card p-1.5 text-foreground transition-colors hover:bg-secondary"
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
                  <div className={`mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border ${tone.iconWrap}`}>
                    <ItemIcon className={`h-4 w-4 ${tone.icon}`} />
                  </div>
                  <div className="min-w-0">
                    <h3 className="truncate text-sm font-semibold text-foreground">
                      {copy.title}
                    </h3>
                    <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{copy.reason}</p>
                    {localizedEvidence.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-2">
                        {localizedEvidence.map((entry) => (
                          <span
                            key={entry}
                            className={`rounded-full border px-2.5 py-1 text-[11px] font-medium ${tone.evidenceChip}`}
                          >
                            {entry}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                <span className="inline-flex shrink-0 items-center gap-2 rounded border-2 border-border bg-primary px-3 py-2 font-head text-xs font-semibold text-primary-foreground transition-colors">
                  {copy.actionLabel}
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
