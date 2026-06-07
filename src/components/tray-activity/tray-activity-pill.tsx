'use client';

import { ArrowUpRight, CheckCircle2, Loader2, Radar } from 'lucide-react';

import { useTranslation } from '@/lib/i18n';
import type { TrayActivityState } from '@/lib/tray-activity/state';

interface TrayActivityPillProps {
  activity: TrayActivityState | null;
  onOpenApp: () => void;
}

export function TrayActivityPill({ activity, onOpenApp }: TrayActivityPillProps) {
  const { t } = useTranslation();

  if (!activity) {
    return null;
  }

  const isComplete = activity.kind === 'complete';

  return (
    <button
      type="button"
      onClick={onOpenApp}
      className="group flex w-[320px] flex-col gap-3 rounded border-2 border-border bg-card px-4 py-3 text-left text-card-foreground shadow-md transition-transform duration-200 hover:-translate-y-0.5 focus:outline-none focus:ring-2 focus:ring-primary"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="mt-0.5 flex h-9 w-9 items-center justify-center rounded border-2 border-border bg-secondary text-primary">
            {isComplete ? (
              <CheckCircle2 className="h-4 w-4 text-[var(--ui-success)]" />
            ) : (
              <Loader2 className="h-4 w-4 animate-spin text-[var(--ui-primary)]" />
            )}
          </div>
          <div className="min-w-0">
            <div className="font-head text-[13px] font-semibold leading-5">
              {isComplete ? t('tray_activity_complete_title') : t('tray_activity_indexing_title')}
            </div>
            <div className="mt-0.5 flex items-center gap-1 text-[11px] text-muted-foreground">
              <Radar className="h-3 w-3" />
              <span className="truncate">
                {activity.kind === 'indexing' && activity.watchLabel
                  ? activity.watchLabel
                  : t('tray_activity_new_file')}
              </span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-1 font-head text-[11px] font-semibold text-primary">
          <span>{isComplete ? t('tray_activity_open_app') : `${activity.progressPercent}%`}</span>
          <ArrowUpRight className="h-3.5 w-3.5 transition-transform duration-200 group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
        </div>
      </div>

      <div className="min-w-0">
        <div
          className="truncate text-[12px] font-medium text-foreground"
          title={activity.fileName}
        >
          {activity.fileName}
        </div>
        <div className="mt-2 h-2 overflow-hidden rounded border-2 border-border bg-secondary">
          <div
            className={`h-full rounded transition-all duration-300 ${
              isComplete
                ? 'bg-[var(--ui-success)]'
                : 'bg-[linear-gradient(90deg,var(--ui-primary)_0%,var(--ui-success)_100%)]'
            }`}
            style={{ width: `${isComplete ? 100 : activity.progressPercent}%` }}
          />
        </div>
      </div>
    </button>
  );
}
