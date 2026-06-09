'use client';

import { useEffect, useMemo, useState } from 'react';
import { CheckSquare, FolderOpen, Sparkles } from '@/components/icons';
import { Button } from '@/components/retroui/Button';
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
        className="w-full max-w-2xl overflow-hidden rounded-md border-2 border-border bg-card text-card-foreground shadow-md"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="border-b-2 border-border bg-secondary p-6">
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded border-2 border-border bg-primary text-primary-foreground shadow-md">
              <Sparkles className="h-6 w-6" />
            </div>
            <div className="space-y-2">
              <h2 className="font-head text-2xl text-foreground">{t('starter_scan_title')}</h2>
              <p className="max-w-xl text-sm leading-relaxed text-foreground/80">
                {t('starter_scan_description')}
              </p>
            </div>
          </div>
        </div>

        <div className="space-y-5 p-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">
                {t('starter_scan_recommended')}
              </h3>
              <p className="mt-1 text-sm text-muted-foreground">
                {t('starter_scan_recommended_description')}
              </p>
            </div>
            <span className="rounded border-2 border-border bg-primary px-3 py-1 font-head text-xs text-primary-foreground shadow">
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
                  className={`rounded-md border-2 p-4 text-left transition-all ${
                    isSelected
                      ? 'border-border bg-secondary shadow-md translate-x-0.5 translate-y-0.5'
                      : 'border-border bg-card shadow-md hover:translate-x-0.5 hover:translate-y-0.5 hover:bg-muted'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded border-2 border-border bg-muted text-foreground">
                      <FolderOpen className="h-5 w-5" />
                    </div>
                    {isSelected && (
                      <span className="rounded border-2 border-border bg-primary p-1 text-primary-foreground shadow">
                        <CheckSquare className="h-3.5 w-3.5" />
                      </span>
                    )}
                  </div>
                  <h4 className="mt-4 font-head text-base text-foreground">
                    {labelKey ? t(labelKey) : suggestion.label}
                  </h4>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                    {descriptionKey ? t(descriptionKey) : suggestion.description}
                  </p>
                  <p className="mt-3 truncate font-mono text-xs text-muted-foreground">{suggestion.path}</p>
                </button>
              );
            })}
          </div>

          {selectedSuggestions.length > 0 && (
            <div className="rounded-md border-2 border-border bg-[var(--ui-success-soft)] p-4 shadow">
              <p className="text-sm font-medium text-[var(--ui-success)]">
                {t('starter_scan_background_note')}
              </p>
            </div>
          )}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t-2 border-border bg-muted px-6 py-4">
          <div className="flex gap-2">
            <Button
              variant="outline"
              type="button"
              onClick={onDismiss}
            >
              {t('starter_scan_not_now')}
            </Button>
            <Button
              variant="secondary"
              type="button"
              onClick={onBrowse}
            >
              {t('starter_scan_choose_manually')}
            </Button>
          </div>
          <Button
            type="button"
            disabled={!hasSelection || isStarting}
            onClick={() => onStart(selectedPaths)}
            className="px-5 py-2.5"
          >
            {isStarting ? t('starter_scan_starting') : t('starter_scan_start')}
          </Button>
        </div>
      </div>
    </div>
  );
}
