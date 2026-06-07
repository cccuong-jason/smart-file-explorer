'use client';

import { useMemo } from 'react';
import { ArrowRight, BellDot, Clock3, FileStack, Pin, ScanSearch, X } from '@/components/icons';
import { useTranslation } from '@/lib/i18n';
import type { WorkInboxItem } from '@/lib/work-inbox/items';
import { Button } from '@/components/retroui/Button';
import { Card } from '@/components/retroui/Card';
import { Carousel } from '@/components/retroui/Carousel';
import { Chart } from '@/components/retroui/Chart';

interface WorkInboxPanelProps {
  items: WorkInboxItem[];
  onOpenFile: (file: any) => void;
  onOpenWorkspace: (workspaceId: string) => void;
  onDismissItem: (itemKey: string) => void;
  onToggleItemPin: (itemId: string) => void;
  hiddenItemCount?: number;
  onResetDismissedItems?: () => void;
}

type Translate = (key: string, variables?: Record<string, string | number>) => string;
type AttentionAction = 'open_continue' | 'review' | 'resolve' | 'extract';

const itemToneClasses: Record<WorkInboxItem['type'], {
  iconWrap: string;
  icon: string;
  chip: string;
  evidenceChip: string;
}> = {
  continue_now: {
    iconWrap: 'border-border bg-primary text-primary-foreground',
    icon: 'text-primary-foreground',
    chip: 'border-border bg-card text-foreground',
    evidenceChip: 'border-border bg-secondary text-foreground',
  },
  needs_review: {
    iconWrap: 'border-border bg-secondary text-secondary-foreground',
    icon: 'text-secondary-foreground',
    chip: 'border-border bg-card text-foreground',
    evidenceChip: 'border-border bg-secondary text-foreground',
  },
  open_now: {
    iconWrap: 'border-border bg-primary text-primary-foreground',
    icon: 'text-primary-foreground',
    chip: 'border-border bg-card text-foreground',
    evidenceChip: 'border-border bg-secondary text-foreground',
  },
  version_conflict: {
    iconWrap: 'border-border bg-secondary text-secondary-foreground',
    icon: 'text-secondary-foreground',
    chip: 'border-border bg-card text-foreground',
    evidenceChip: 'border-border bg-secondary text-foreground',
  },
  ocr_attention: {
    iconWrap: 'border-border bg-secondary text-secondary-foreground',
    icon: 'text-secondary-foreground',
    chip: 'border-border bg-card text-foreground',
    evidenceChip: 'border-border bg-secondary text-foreground',
  },
  recent_change: {
    iconWrap: 'border-border bg-secondary text-secondary-foreground',
    icon: 'text-secondary-foreground',
    chip: 'border-border bg-card text-foreground',
    evidenceChip: 'border-border bg-secondary text-foreground',
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

function getItemTypeLabel(type: WorkInboxItem['type'], t: Translate) {
  switch (type) {
    case 'continue_now':
      return t('work_inbox_kind_continue_now');
    case 'needs_review':
      return t('work_inbox_kind_needs_review');
    case 'open_now':
      return t('work_inbox_kind_open_now');
    case 'version_conflict':
      return t('work_inbox_kind_version_conflict');
    case 'ocr_attention':
      return t('work_inbox_kind_ocr_attention');
    case 'recent_change':
      return t('work_inbox_kind_recent_change');
    default:
      return type;
  }
}

function getAttentionAction(type: WorkInboxItem['type']): AttentionAction {
  switch (type) {
    case 'continue_now':
    case 'open_now':
      return 'open_continue';
    case 'needs_review':
    case 'recent_change':
      return 'review';
    case 'version_conflict':
      return 'resolve';
    case 'ocr_attention':
      return 'extract';
    default:
      return 'review';
  }
}

function getAttentionActionLabel(action: AttentionAction, t: Translate) {
  switch (action) {
    case 'open_continue':
      return t('work_inbox_chart_open_continue');
    case 'review':
      return t('work_inbox_chart_review');
    case 'resolve':
      return t('work_inbox_chart_resolve');
    case 'extract':
      return t('work_inbox_chart_extract');
    default:
      return action;
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

  const handlePrimaryAction = (item: WorkInboxItem) => {
    if (item.actionMode === 'open_workspace') {
      onOpenWorkspace(item.workspaceId);
      return;
    }

    onOpenFile(item.primaryFile);
  };

  const chartData = useMemo(() => {
    const counts = items.reduce<Record<AttentionAction, number>>((acc, item) => {
      const action = getAttentionAction(item.type);
      acc[action] += 1;
      return acc;
    }, {
      open_continue: 0,
      review: 0,
      resolve: 0,
      extract: 0,
    });

    return (Object.entries(counts) as Array<[AttentionAction, number]>).map(([action, count]) => ({
      action: getAttentionActionLabel(action, t),
      count,
    }));
  }, [items, t]);
  const dashboardMetrics = useMemo(() => {
    const counts = chartData.reduce<Record<string, number>>((acc, item) => {
      acc[item.action] = item.count;
      return acc;
    }, {});
    const topItem = items[0];
    const blockedCount = items.filter((item) => item.type === 'version_conflict' || item.type === 'ocr_attention').length;

    return [
      {
        label: t('work_inbox_metric_next_action'),
        value: topItem ? getLocalizedItemCopy(topItem, t).kindLabel : t('work_inbox_metric_clear'),
        description: topItem?.workspaceTitle ?? t('work_inbox_metric_clear_description'),
      },
      {
        label: t('work_inbox_metric_review_load'),
        value: counts[t('work_inbox_chart_review')] ?? 0,
        description: t('work_inbox_chart_review'),
      },
      {
        label: t('work_inbox_metric_blocked_work'),
        value: blockedCount,
        description: t('work_inbox_metric_blocked_description'),
      },
      {
        label: t('work_inbox_metric_recent_movement'),
        value: items.filter((item) => item.type === 'recent_change' || item.type === 'continue_now').length,
        description: t('work_inbox_metric_recent_description'),
      },
    ];
  }, [chartData, items, t]);
  const actionTotal = chartData.reduce((sum, item) => sum + item.count, 0);
  const topAction = [...chartData].sort((a, b) => b.count - a.count)[0];
  const blockerCount = items.filter((item) => item.type === 'version_conflict' || item.type === 'ocr_attention').length;

  if (items.length === 0) {
    return null;
  }

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
        </div>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {dashboardMetrics.map((metric) => (
          <Card key={metric.label} className="block w-full p-3">
            <p className="font-head text-[10px] font-bold uppercase text-muted-foreground">{metric.label}</p>
            <p className="mt-1 truncate text-lg font-semibold text-foreground">{metric.value}</p>
            <p className="mt-1 truncate text-xs text-muted-foreground">{metric.description}</p>
          </Card>
        ))}
      </div>

      {chartData.length > 0 && (
        <div className="mt-4 grid gap-3 md:grid-cols-3">
          <Card className="block bg-secondary p-3">
            <div className="mb-2 flex items-center gap-2">
              <ScanSearch className="h-4 w-4 text-primary" />
              <h3 className="font-head text-xs font-bold uppercase text-foreground">{t('work_inbox_chart_title')}</h3>
            </div>
            <Chart
              data={chartData}
              index="action"
              categories={['count']}
              className="h-32"
              alignment="horizontal"
              showGrid={false}
              showTooltip
              valueFormatter={(value) => value.toLocaleString()}
            />
          </Card>
          <Card className="block p-3">
            <p className="font-head text-[10px] font-bold uppercase text-muted-foreground">{t('work_inbox_chart_focus_title')}</p>
            <p className="mt-2 text-xl font-semibold text-foreground">{topAction?.action ?? t('work_inbox_metric_clear')}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              {t('work_inbox_chart_focus_description', { count: topAction?.count ?? 0, total: actionTotal })}
            </p>
          </Card>
          <Card className="block p-3">
            <p className="font-head text-[10px] font-bold uppercase text-muted-foreground">{t('work_inbox_chart_breakdown_title')}</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {chartData.map((item) => (
                <span key={item.action} className="rounded border-2 border-border bg-secondary px-2 py-1 font-head text-[10px] font-semibold text-foreground">
                  {item.action}: {item.count}
                </span>
              ))}
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              {t('work_inbox_chart_blockers_description', { count: blockerCount })}
            </p>
          </Card>
        </div>
      )}

      <Carousel className="mt-4 px-8" opts={{ align: 'start' }}>
        <Carousel.Content>
        {items.map((item) => {
          const ItemIcon = getItemIcon(item.type);
          const tone = itemToneClasses[item.type];
          const copy = getLocalizedItemCopy(item, t);
          const localizedEvidence = item.evidence.slice(0, 2).map((entry) => getLocalizedEvidence(entry, t));

          return (
            <Carousel.Item key={item.id} className="md:basis-1/2">
              <Card
                as="article"
                className={`block h-full w-full transition-all duration-300 ${
                  item.isPinned ? 'animate-pin-confirm ring-2 ring-primary' : ''
                }`}
              >
                <div className="flex items-center justify-between gap-2 border-b-2 border-border bg-secondary px-4 py-3">
                  <div className="flex min-w-0 items-center gap-2">
                    <span className={`rounded border-2 px-2 py-0.5 font-head text-[10px] font-bold uppercase ${tone.chip}`}>
                      {copy.kindLabel}
                    </span>
                    <span className="truncate text-xs font-medium text-muted-foreground">
                      {item.workspaceTitle}
                    </span>
                    {item.isPinned && (
                      <span className="rounded border-2 border-border bg-primary px-2 py-0.5 font-head text-[10px] font-bold text-primary-foreground">
                        {t('work_inbox_pinned_item')}
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      aria-label={item.isPinned ? t('work_inbox_unpin_item') : t('work_inbox_pin_item')}
                      aria-pressed={item.isPinned}
                      onClick={() => onToggleItemPin(item.id)}
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
                              className={`rounded border-2 px-2.5 py-1 font-head text-[10px] font-semibold ${tone.evidenceChip}`}
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
              </Card>
            </Carousel.Item>
          );
        })}
        </Carousel.Content>
        {items.length > 2 && (
          <>
            <Carousel.Previous aria-label={t('work_inbox_previous')} className="-left-1 bg-card text-foreground" />
            <Carousel.Next aria-label={t('work_inbox_next')} className="-right-1 bg-card text-foreground" />
          </>
        )}
      </Carousel>
    </section>
  );
}
