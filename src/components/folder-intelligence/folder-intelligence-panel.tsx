'use client';

import { useState } from 'react';
import { ArrowRight, Clock3, FolderKanban, ScanSearch, Star, Files } from '@/components/icons';
import { useTranslation } from '@/lib/i18n';
import type { FolderInsight } from '@/lib/folder-intelligence/workspaces';
import { Button } from '@/components/retroui/Button';

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
    <section className="border-b-2 border-border bg-card px-6 py-4 text-card-foreground">
      <div className="flex items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-primary">
            <FolderKanban className="h-4 w-4" />
            <h2 className="font-head text-sm font-bold uppercase">{t('folder_intelligence_title')}</h2>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">{t('folder_intelligence_description')}</p>
        </div>
        {insights.length > 1 && (
          <Button
            type="button"
            onClick={() => setExpanded((value) => !value)}
            variant="outline"
            size="sm"
            className="bg-card text-xs"
          >
            {expanded ? t('folder_intelligence_show_less') : t('folder_intelligence_show_more')}
          </Button>
        )}
      </div>

      <div className={`mt-4 grid gap-3 ${expanded ? 'lg:grid-cols-2' : ''}`}>
        {visibleInsights.map((insight) => (
          <div
            key={insight.id}
            className="rounded border-2 border-border bg-card p-4 shadow-sm"
          >
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="truncate font-head text-base font-semibold text-foreground">{insight.title}</h3>
                  <span className={`rounded border-2 px-2 py-0.5 font-head text-[10px] font-bold uppercase ${
                    insight.summaryState === 'failed'
                      ? 'border-[color:var(--ui-danger)]/30 bg-[var(--ui-danger-soft)] text-[var(--ui-danger)]'
                      : insight.summaryState === 'generating'
                        ? 'border-[color:var(--ui-warning)]/30 bg-[var(--ui-warning-soft)] text-[var(--ui-warning)]'
                        : insight.summarySource === 'ai'
                          ? 'border-[color:var(--ui-success)]/30 bg-[var(--ui-success-soft)] text-[var(--ui-success)]'
                          : 'border-border bg-secondary text-foreground'
                  }`}>
                    {getSummaryBadgeLabel(insight)}
                  </span>
                </div>
                <p className="mt-1 truncate text-xs text-muted-foreground">{insight.path}</p>
              </div>
              <span className="shrink-0 rounded border-2 border-border bg-primary px-2.5 py-1 font-head text-[11px] font-semibold text-primary-foreground">
                {getTypeLabel(insight.primaryTypeLabel)}
              </span>
            </div>

            <p className="mt-3 line-clamp-2 text-sm leading-relaxed text-muted-foreground">
              {insight.summary}
            </p>

            <div className="mt-3 flex flex-wrap items-center gap-2">
              {insight.summarySource === 'ai' && insight.summaryModel && (
                <span className="rounded border-2 border-border bg-secondary px-2 py-0.5 font-mono text-[10px] text-foreground">
                  {insight.summaryModel}
                </span>
              )}
              {insight.summaryUpdatedAt && (
                <span className="rounded border-2 border-border bg-secondary px-2 py-0.5 text-[10px] text-foreground">
                  {new Date(insight.summaryUpdatedAt).toLocaleDateString()}
                </span>
              )}
              {onRefreshSummary && (
                <Button
                  type="button"
                  onClick={() => onRefreshSummary(insight.id)}
                  variant="outline"
                  size="sm"
                  className="bg-card py-0.5 text-[10px]"
                  aria-label={t('folder_intelligence_refresh_ai_summary')}
                >
                  {t('folder_intelligence_refresh_ai_summary')}
                </Button>
              )}
            </div>

            {showExpandedDetails && insight.highlights.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-2">
                {insight.highlights.slice(0, 2).map((highlight) => (
                  <span
                    key={highlight}
                    className="rounded border-2 border-border bg-secondary px-2.5 py-1 text-[11px] font-medium text-foreground"
                  >
                    {highlight}
                  </span>
                ))}
              </div>
            )}

            {showExpandedDetails && insight.rationale && insight.rationale.length > 0 && (
              <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
                {insight.rationale[0]}
              </p>
            )}

            <div className="mt-3 rounded border-2 border-border bg-secondary p-3">
              <div className="flex items-center justify-between gap-2">
                <p className="font-head text-xs font-bold uppercase text-muted-foreground">
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
                  <p className="truncate text-sm font-semibold text-foreground">{insight.topFile.name}</p>
                  <div className="mt-1 flex items-center gap-3 text-xs text-muted-foreground">
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
                <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground" />
              </button>
            </div>

            {showExpandedDetails && insight.versionGroups.length > 0 && (
              <div className="mt-3 rounded border-2 border-border bg-secondary p-3">
                <div className="flex items-center gap-2 font-head text-xs font-bold uppercase text-[var(--ui-warning)]">
                  <Files className="h-3.5 w-3.5" />
                  {t('folder_intelligence_latest_group')}
                </div>
                <button
                  type="button"
                  onClick={() => onOpenFile(insight.versionGroups[0].latestFile)}
                  className="mt-2 flex w-full items-center justify-between gap-3 text-left"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-foreground">
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
