'use client';

import { useEffect, useMemo, useState } from 'react';
import { CheckSquare, FolderOpen, Sparkles } from 'lucide-react';
import { useTranslation } from '@/lib/i18n';
import type { StarterScanSuggestion } from '@/lib/onboarding/starter-scan';

interface StarterScanModalProps {
  isOpen: boolean;
  suggestions: StarterScanSuggestion[];
  isStarting?: boolean;
  onStart: (paths: string[]) => void;
  onDismiss: () => void;
  onBrowse: () => void;
}

function getStarterLabelKey(label: string) {
  switch (label.toLowerCase()) {
    case 'documents':
      return 'starter_scan_folder_documents';
    case 'desktop':
      return 'starter_scan_folder_desktop';
    case 'downloads':
      return 'starter_scan_folder_downloads';
    default:
      return '';
  }
}

function getStarterDescriptionKey(label: string) {
  switch (label.toLowerCase()) {
    case 'documents':
      return 'starter_scan_folder_documents_description';
    case 'desktop':
      return 'starter_scan_folder_desktop_description';
    case 'downloads':
      return 'starter_scan_folder_downloads_description';
    default:
      return '';
  }
}

export function StarterScanModal({
  isOpen,
  suggestions,
  isStarting = false,
  onStart,
  onDismiss,
  onBrowse,
}: StarterScanModalProps) {
  const { t } = useTranslation();
  const [selectedPaths, setSelectedPaths] = useState<string[]>([]);

  useEffect(() => {
    if (isOpen) {
      setSelectedPaths(suggestions.map((item) => item.path));
    }
  }, [isOpen, suggestions]);

  const selectedCount = selectedPaths.length;
  const hasSelection = selectedCount > 0;
  const selectedSuggestions = useMemo(
    () => suggestions.filter((item) => selectedPaths.includes(item.path)),
    [selectedPaths, suggestions]
  );

  if (!isOpen) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-[180] flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={onDismiss}>
      <div
        className="w-full max-w-2xl overflow-hidden rounded-3xl border border-[var(--ui-border)] bg-[var(--ui-surface)] shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="border-b border-[var(--ui-border)] bg-[var(--ui-surface-muted)] p-6">
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-600 text-white shadow-lg">
              <Sparkles className="h-6 w-6" />
            </div>
            <div className="space-y-2">
              <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">{t('starter_scan_title')}</h2>
              <p className="max-w-xl text-sm leading-relaxed text-gray-600 dark:text-gray-300">
                {t('starter_scan_description')}
              </p>
            </div>
          </div>
        </div>

        <div className="space-y-5 p-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                {t('starter_scan_recommended')}
              </h3>
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                {t('starter_scan_recommended_description')}
              </p>
            </div>
            <span className="rounded-full border border-[var(--ui-border)] bg-[var(--ui-primary-soft)] px-3 py-1 text-xs font-semibold text-[var(--ui-primary)]">
              {t('starter_scan_selected_count', { count: selectedCount })}
            </span>
          </div>

          <div className="grid gap-3 md:grid-cols-3">
            {suggestions.map((suggestion) => {
              const isSelected = selectedPaths.includes(suggestion.path);
              const labelKey = getStarterLabelKey(suggestion.label);
              const descriptionKey = getStarterDescriptionKey(suggestion.label);

              return (
                <button
                  key={suggestion.path}
                  type="button"
                  onClick={() => {
                    setSelectedPaths((prev) =>
                      prev.includes(suggestion.path)
                        ? prev.filter((path) => path !== suggestion.path)
                        : [...prev, suggestion.path]
                    );
                  }}
                  className={`rounded-2xl border p-4 text-left transition-all ${
                    isSelected
                      ? 'border-[var(--ui-primary)] bg-[var(--ui-primary-soft)] shadow-sm'
                      : 'border-[var(--ui-border)] bg-[var(--ui-surface)] hover:border-[var(--ui-primary)] hover:bg-[var(--ui-surface-muted)]'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--ui-surface-muted)] text-gray-700 dark:text-gray-200">
                      <FolderOpen className="h-5 w-5" />
                    </div>
                    {isSelected && (
                      <span className="rounded-full bg-indigo-600 p-1 text-white shadow">
                        <CheckSquare className="h-3.5 w-3.5" />
                      </span>
                    )}
                  </div>
                  <h4 className="mt-4 text-base font-semibold text-gray-900 dark:text-gray-100">
                    {labelKey ? t(labelKey) : suggestion.label}
                  </h4>
                  <p className="mt-2 text-sm leading-relaxed text-gray-500 dark:text-gray-400">
                    {descriptionKey ? t(descriptionKey) : suggestion.description}
                  </p>
                  <p className="mt-3 truncate text-xs text-gray-400 dark:text-gray-500">{suggestion.path}</p>
                </button>
              );
            })}
          </div>

          {selectedSuggestions.length > 0 && (
            <div className="rounded-2xl border border-[color:var(--ui-success)]/25 bg-[var(--ui-success-soft)] p-4">
              <p className="text-sm font-medium text-[var(--ui-success)]">
                {t('starter_scan_background_note')}
              </p>
            </div>
          )}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--ui-border)] bg-[var(--ui-surface-muted)] px-6 py-4">
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onDismiss}
              className="rounded-xl border border-[var(--ui-border)] px-4 py-2 text-sm font-medium text-gray-600 transition-colors hover:bg-[var(--ui-surface)] dark:text-gray-300"
            >
              {t('starter_scan_not_now')}
            </button>
            <button
              type="button"
              onClick={onBrowse}
              className="rounded-xl border border-[var(--ui-border)] px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-[var(--ui-surface)] dark:text-gray-200"
            >
              {t('starter_scan_choose_manually')}
            </button>
          </div>
          <button
            type="button"
            disabled={!hasSelection || isStarting}
            onClick={() => onStart(selectedPaths)}
            className="rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isStarting ? t('starter_scan_starting') : t('starter_scan_start')}
          </button>
        </div>
      </div>
    </div>
  );
}
