'use client';

import { useState } from 'react';
import { ArrowRight, Clock3, FolderKanban, ScanSearch, Star, Files } from 'lucide-react';
import { useTranslation } from '@/lib/i18n';
import type { FolderInsight } from '@/lib/folder-intelligence/workspaces';

interface FolderIntelligencePanelProps {
  insights: FolderInsight[];
  onOpenFile: (file: any) => void;
  onRefreshSummary?: (workspaceId: string) => void;
}

export function FolderIntelligencePanel({ insights, onOpenFile, onRefreshSummary }: FolderIntelligencePanelProps) {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState(false);

  const getSummaryStateLabel = (state: FolderInsight['summaryState']) => {
    switch (state) {
      case 'generating':
        return t('privacy_cloud_status_generating');
      case 'failed':
        return t('privacy_cloud_status_failed');
      case 'not_connected':
        return t('privacy_cloud_status_not_connected');
      case 'ready':
        return t('privacy_cloud_status_ready');
      default:
        return t('folder_intelligence_ai_badge');
    }
  };

  const getTypeLabel = (label: string) => {
    switch (label) {
      case 'Documents':
        return t('file_type_documents');
      case 'Code':
        return t('file_type_code');
      case 'Images':
        return t('file_type_images');
      case 'Media':
        return t('file_type_media');
      case 'Archives':
        return t('file_type_archives');
      default:
        return t('file_type_other');
    }
  };

  const getSummaryBadgeLabel = (insight: FolderInsight) => {
    if (insight.summaryState === 'generating' || insight.summaryState === 'failed' || insight.summaryState === 'not_connected') {
      return getSummaryStateLabel(insight.summaryState);
    }

    return insight.summarySource === 'ai'
      ? t('folder_intelligence_ai_badge')
      : getSummaryStateLabel(insight.summaryState);
  };

  if (insights.length === 0) {
    return null;
  }

  const visibleInsights = expanded ? insights.slice(0, 2) : insights.slice(0, 1);
  const showExpandedDetails = expanded || insights.length === 1;

  return (
    <section className="border-b border-[var(--ui-border)] bg-[var(--ui-surface)] px-6 py-4">
      <div className="flex items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-[var(--ui-primary)]">
            <FolderKanban className="h-4 w-4" />
            <h2 className="text-sm font-bold uppercase tracking-wider">{t('folder_intelligence_title')}</h2>
          </div>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{t('folder_intelligence_description')}</p>
        </div>
        {insights.length > 1 && (
          <button
            type="button"
            onClick={() => setExpanded((value) => !value)}
            className="rounded-full border border-[var(--ui-border)] bg-[var(--ui-surface-muted)] px-3 py-1.5 text-xs font-semibold text-[var(--ui-primary)] transition-colors hover:bg-[var(--ui-primary-soft)]"
          >
            {expanded ? t('folder_intelligence_show_less') : t('folder_intelligence_show_more')}
          </button>
        )}
      </div>

      <div className={`mt-4 grid gap-3 ${expanded ? 'lg:grid-cols-2' : ''}`}>
        {visibleInsights.map((insight) => (
          <div
            key={insight.id}
            className="rounded-2xl border border-[var(--ui-border)] bg-[var(--ui-surface)] p-4 shadow-sm"
          >
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="truncate text-base font-semibold text-gray-900 dark:text-gray-100">{insight.title}</h3>
                  <span className={`rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                    insight.summaryState === 'failed'
                      ? 'border-[color:var(--ui-danger)]/30 bg-[var(--ui-danger-soft)] text-[var(--ui-danger)]'
                      : insight.summaryState === 'generating'
                        ? 'border-[color:var(--ui-warning)]/30 bg-[var(--ui-warning-soft)] text-[var(--ui-warning)]'
                        : insight.summarySource === 'ai'
                          ? 'border-[color:var(--ui-success)]/30 bg-[var(--ui-success-soft)] text-[var(--ui-success)]'
                          : 'border-[var(--ui-border)] bg-[var(--ui-surface-muted)] text-gray-600 dark:text-gray-300'
                  }`}>
                    {getSummaryBadgeLabel(insight)}
                  </span>
                </div>
                <p className="mt-1 truncate text-xs text-gray-400 dark:text-gray-500">{insight.path}</p>
              </div>
              <span className="shrink-0 rounded-full border border-[var(--ui-border)] bg-[var(--ui-primary-soft)] px-2.5 py-1 text-[11px] font-semibold text-[var(--ui-primary)]">
                {getTypeLabel(insight.primaryTypeLabel)}
              </span>
            </div>

            <p className="mt-3 line-clamp-2 text-sm leading-relaxed text-gray-600 dark:text-gray-300">
              {insight.summary}
            </p>

            <div className="mt-3 flex flex-wrap items-center gap-2">
              {insight.summarySource === 'ai' && insight.summaryModel && (
                <span className="rounded-full border border-[var(--ui-border)] bg-[var(--ui-surface-muted)] px-2 py-0.5 font-mono text-[10px] text-gray-700 dark:text-gray-200">
                  {insight.summaryModel}
                </span>
              )}
              {insight.summaryUpdatedAt && (
                <span className="rounded-full border border-[var(--ui-border)] bg-[var(--ui-surface-muted)] px-2 py-0.5 text-[10px] text-gray-600 dark:text-gray-300">
                  {new Date(insight.summaryUpdatedAt).toLocaleDateString()}
                </span>
              )}
              {onRefreshSummary && (
                <button
                  type="button"
                  onClick={() => onRefreshSummary(insight.id)}
                  className="rounded-full border border-[var(--ui-border)] bg-[var(--ui-surface-muted)] px-2 py-0.5 text-[10px] font-semibold text-gray-700 transition-colors hover:bg-[var(--ui-primary-soft)] dark:text-gray-200"
                  aria-label={t('folder_intelligence_refresh_ai_summary')}
                >
                  {t('folder_intelligence_refresh_ai_summary')}
                </button>
              )}
            </div>

            {showExpandedDetails && insight.highlights.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-2">
                {insight.highlights.slice(0, 2).map((highlight) => (
                  <span
                    key={highlight}
                    className="rounded-full border border-[var(--ui-border)] bg-[var(--ui-surface-muted)] px-2.5 py-1 text-[11px] font-medium text-gray-600 dark:text-gray-300"
                  >
                    {highlight}
                  </span>
                ))}
              </div>
            )}

            {showExpandedDetails && insight.rationale && insight.rationale.length > 0 && (
              <p className="mt-3 text-xs leading-relaxed text-gray-500 dark:text-gray-400">
                {insight.rationale[0]}
              </p>
            )}

            <div className="mt-3 rounded-xl border border-[var(--ui-border)] bg-[var(--ui-surface-muted)] p-3">
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                  {t('folder_intelligence_top_file')}
                </p>
                {insight.topFile.isStarred && (
                  <span className="text-amber-500">
                    <Star className="h-4 w-4 fill-current" />
                  </span>
                )}
              </div>
              <button
                type="button"
                onClick={() => onOpenFile(insight.topFile)}
                className="mt-2 flex w-full items-center justify-between gap-3 text-left"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-gray-900 dark:text-gray-100">{insight.topFile.name}</p>
                  <div className="mt-1 flex items-center gap-3 text-xs text-gray-500 dark:text-gray-400">
                    <span className="inline-flex items-center gap-1">
                      <Clock3 className="h-3.5 w-3.5" />
                      {t('folder_intelligence_files', { count: insight.fileCount })}
                    </span>
                    {insight.ocrCount > 0 && (
                      <span className="inline-flex items-center gap-1 text-[var(--ui-warning)]">
                        <ScanSearch className="h-3.5 w-3.5" />
                        {t('folder_intelligence_ocr', { count: insight.ocrCount })}
                      </span>
                    )}
                  </div>
                </div>
                <ArrowRight className="h-4 w-4 shrink-0 text-gray-400" />
              </button>
            </div>

            {showExpandedDetails && insight.versionGroups.length > 0 && (
              <div className="mt-3 rounded-xl border border-[var(--ui-border)] bg-[var(--ui-surface-muted)] p-3">
                <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[var(--ui-warning)]">
                  <Files className="h-3.5 w-3.5" />
                  {t('folder_intelligence_latest_group')}
                </div>
                <button
                  type="button"
                  onClick={() => onOpenFile(insight.versionGroups[0].latestFile)}
                  className="mt-2 flex w-full items-center justify-between gap-3 text-left"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-gray-900 dark:text-gray-100">
                      {insight.versionGroups[0].latestFile.name}
                    </p>
                    <p className="mt-1 text-xs text-[var(--ui-warning)]">
                      {t('folder_intelligence_alternates', { count: insight.versionGroups[0].variantCount })}
                    </p>
                  </div>
                  <ArrowRight className="h-4 w-4 shrink-0 text-[var(--ui-warning)]" />
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}
