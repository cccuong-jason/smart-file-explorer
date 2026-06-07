'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { invoke } from '@tauri-apps/api/core';
import { Search, FileText, FileCode, X, ArrowUpDown } from '@/components/icons';
import { Empty } from '@/components/retroui/Empty';
import { Input } from '@/components/retroui/Input';
import { Loader } from '@/components/retroui/Loader';
import { searchFiles } from '@/lib/search/engine';
import clsx from 'clsx';
import { useTranslation } from '@/lib/i18n';
import { getMatchPercentage } from '@/lib/search/presentation';

function FileIcon({ name }: { name: string }) {
  const ext = name.split('.').pop()?.toLowerCase() || '';
  if (['js', 'ts', 'jsx', 'tsx', 'py', 'json', 'css', 'html', 'rs', 'go', 'rb', 'php'].includes(ext)) {
    return <FileCode className="h-4 w-4 shrink-0 text-primary" />;
  }
  return <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />;
}

async function hideSpotlight() {
  try { await getCurrentWindow().hide(); } catch (e) { console.error(e); }
}

async function openFilePath(path: string) {
  await invoke('open_file_native', { path });
}

export default function SpotlightPage() {
  const { t } = useTranslation();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<any[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Reset & focus when the window gains focus
  useEffect(() => {
    let unlistenPromise: ReturnType<ReturnType<typeof getCurrentWindow>['onFocusChanged']> | null = null;

    try {
      const appWindow = getCurrentWindow();
      unlistenPromise = appWindow.onFocusChanged(({ payload: focused }) => {
        if (focused) {
          setQuery('');
          setResults([]);
          setSelectedIndex(0);
          setIsLoading(false);
          setTimeout(() => inputRef.current?.focus(), 50);
        } else {
          hideSpotlight();
        }
      });
    } catch (error) {
      console.warn('Spotlight focus bridge unavailable outside Tauri', error);
    }

    setTimeout(() => inputRef.current?.focus(), 100);
    return () => {
      unlistenPromise?.then((fn) => fn()).catch(() => undefined);
    };
  }, []);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = async (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.preventDefault(); hideSpotlight(); return; }
      if (e.key === 'ArrowDown') { e.preventDefault(); setSelectedIndex((p) => Math.min(p + 1, results.length - 1)); return; }
      if (e.key === 'ArrowUp') { e.preventDefault(); setSelectedIndex((p) => Math.max(p - 1, 0)); return; }
      if (e.key === 'Enter') {
        e.preventDefault();
        const target = results[selectedIndex];
        if (target) {
          try { await openFilePath(target.file.path); hideSpotlight(); } catch (e) { console.error(e); }
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [results, selectedIndex]);

  // Debounced search
  const handleQueryChange = useCallback((value: string) => {
    setQuery(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!value.trim()) { setResults([]); setIsLoading(false); return; }
    setIsLoading(true);
    debounceRef.current = setTimeout(async () => {
      try {
        const top = await searchFiles(value);
        setResults(top.slice(0, 6));
        setSelectedIndex(0);
      } catch (err) {
        setResults([]);
      } finally {
        setIsLoading(false);
      }
    }, 200);
  }, []);

  const hasResults = results.length > 0;
  const showNoResults = !isLoading && query.trim() && !hasResults;

  return (
    // No padding, no min-height — card is the only visual element in the transparent window
    <div className="w-full bg-transparent">
      <div className="w-full overflow-hidden border-2 border-border bg-card text-card-foreground shadow-md">

        {/* ─── Search Bar ─── */}
        <div className="flex items-center gap-3 border-b-2 border-border bg-card px-4 py-3.5">
          {isLoading
            ? <Loader size="sm" aria-label="Searching" />
            : <Search className="h-5 w-5 shrink-0 text-primary" />
          }
          <Input
            ref={inputRef}
            type="text"
            className="flex-1 border-0 bg-transparent px-0 py-0 text-[17px] font-medium text-foreground shadow-none placeholder:text-muted-foreground focus:outline-none"
            placeholder={t('spotlight_placeholder')}
            value={query}
            onChange={(e) => handleQueryChange(e.target.value)}
            autoComplete="off"
            autoFocus
          />
          {query && (
            <button
              onClick={() => handleQueryChange('')}
              className="text-muted-foreground transition-colors hover:text-foreground"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* ─── Results ─── */}
        {hasResults && (
          <>
            {/* Section header */}
            <div className="flex items-center justify-between border-b-2 border-border bg-secondary px-4 py-1.5">
              <span className="font-head text-[10px] font-bold uppercase text-muted-foreground">{t('spotlight_best_matches')}</span>
              <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
                <ArrowUpDown className="w-2.5 h-2.5" /> {t('spotlight_navigate')}
              </span>
            </div>

            {results.map((res, idx) => {
              const parts = res.file.path.split(/[/\\]/);
              const dir = parts.slice(0, -1).join('/');
              const isSelected = idx === selectedIndex;
              return (
                <div
                  key={res.file.path}
                  className={clsx(
                    'flex cursor-pointer items-center gap-3 border-l-4 px-4 py-2.5 transition-colors duration-75',
                    isSelected
                      ? 'border-primary bg-secondary'
                      : 'border-transparent hover:bg-secondary'
                  )}
                  onMouseEnter={() => setSelectedIndex(idx)}
                  onClick={async () => {
                    try { await openFilePath(res.file.path); hideSpotlight(); } catch (e) { console.error(e); }
                  }}
                >
                  {/* Icon: always solid white bg so row colour doesn't bleed through */}
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded border-2 border-border bg-card shadow-sm">
                    <FileIcon name={res.file.name} />
                  </div>

                  <div className="flex-1 min-w-0">
                    <p className={clsx('truncate text-sm font-semibold', isSelected ? 'text-primary' : 'text-foreground')}>
                      {res.file.name}
                    </p>
                    <p className="mt-0.5 truncate text-xs text-muted-foreground">
                      {res.locationLabel ? `${res.locationLabel} · ${dir}` : dir}
                    </p>
                  </div>

                  {(res.isLikelyLatest || typeof res.score === 'number') && (
                    <span className="shrink-0 rounded border-2 border-border bg-[var(--ui-success-soft)] px-1.5 py-0.5 font-head text-[10px] font-semibold text-[var(--ui-success)]">
                      {res.isLikelyLatest ? t('likely_latest_version') : `${getMatchPercentage(res.score)}%`}
                    </span>
                  )}

                  {isSelected && (
                    <kbd className="shrink-0 rounded border-2 border-border bg-card px-1.5 py-0.5 font-mono text-[10px] text-primary">↵</kbd>
                  )}
                </div>
              );
            })}

            {/* Footer hints */}
            <div className="flex gap-3 border-t-2 border-border bg-secondary px-4 py-2 text-[10px] text-muted-foreground">
              <span><kbd className="rounded border-2 border-border bg-card px-1 font-mono">↵</kbd> {t('spotlight_open')}</span>
              <span><kbd className="rounded border-2 border-border bg-card px-1 font-mono">↑↓</kbd> {t('spotlight_navigate')}</span>
              <span><kbd className="rounded border-2 border-border bg-card px-1 font-mono">Esc</kbd> {t('spotlight_close')}</span>
            </div>
          </>
        )}

        {/* ─── No Results ─── */}
        {showNoResults && (
          <Empty className="m-3 px-4 py-5 text-sm text-muted-foreground">
            <Empty.Content>
              <Empty.Title className="text-base">{t('spotlight_no_results')}</Empty.Title>
              <Empty.Description>
                <span className="font-medium text-foreground">"{query}"</span>
              </Empty.Description>
            </Empty.Content>
          </Empty>
        )}
      </div>
    </div>
  );
}
