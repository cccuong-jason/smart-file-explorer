'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { invoke } from '@tauri-apps/api/core';
import { Search, FileText, FileCode, X, Loader2, ArrowUpDown } from 'lucide-react';
import { searchFiles } from '@/lib/search/engine';
import clsx from 'clsx';
import { useTranslation } from '@/lib/i18n';
import { getMatchPercentage } from '@/lib/search/presentation';

function FileIcon({ name }: { name: string }) {
  const ext = name.split('.').pop()?.toLowerCase() || '';
  if (['js', 'ts', 'jsx', 'tsx', 'py', 'json', 'css', 'html', 'rs', 'go', 'rb', 'php'].includes(ext)) {
    return <FileCode className="w-4 h-4 text-indigo-500 shrink-0" />;
  }
  return <FileText className="w-4 h-4 text-gray-400 shrink-0" />;
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
    const appWindow = getCurrentWindow();
    const unlistenPromise = appWindow.onFocusChanged(({ payload: focused }) => {
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
    setTimeout(() => inputRef.current?.focus(), 100);
    return () => { unlistenPromise.then((fn) => fn()); };
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
      <div className="w-full shadow-2xl overflow-hidden bg-white dark:bg-gray-900 border border-white/70 dark:border-gray-800">

        {/* ─── Search Bar ─── */}
        <div className="flex items-center px-4 py-3.5 gap-3 border-b border-gray-100 dark:border-gray-800">
          {isLoading
            ? <Loader2 className="w-5 h-5 text-indigo-500 shrink-0 animate-spin" />
            : <Search className="w-5 h-5 text-indigo-400 shrink-0" />
          }
          <input
            ref={inputRef}
            type="text"
            className="flex-1 bg-transparent text-[17px] text-gray-800 dark:text-gray-100 placeholder-gray-400 dark:placeholder:text-gray-500 focus:outline-none font-medium"
            placeholder={t('spotlight_placeholder')}
            value={query}
            onChange={(e) => handleQueryChange(e.target.value)}
            autoComplete="off"
            autoFocus
          />
          {query && (
            <button
              onClick={() => handleQueryChange('')}
              className="text-gray-300 dark:text-gray-600 hover:text-gray-500 dark:hover:text-gray-300 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* ─── Results ─── */}
        {hasResults && (
          <>
            {/* Section header */}
            <div className="px-4 py-1.5 flex items-center justify-between bg-gray-50 dark:bg-gray-800 border-b border-gray-100 dark:border-gray-800">
              <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400 dark:text-gray-500">{t('spotlight_best_matches')}</span>
              <span className="text-[10px] text-gray-400 dark:text-gray-500 flex items-center gap-1">
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
                    'px-4 py-2.5 flex items-center gap-3 cursor-pointer border-l-[3px] transition-colors duration-75',
                    isSelected
                      ? 'bg-indigo-50 dark:bg-indigo-950/50 border-indigo-500'
                      : 'border-transparent hover:bg-gray-50 dark:hover:bg-gray-800'
                  )}
                  onMouseEnter={() => setSelectedIndex(idx)}
                  onClick={async () => {
                    try { await openFilePath(res.file.path); hideSpotlight(); } catch (e) { console.error(e); }
                  }}
                >
                  {/* Icon: always solid white bg so row colour doesn't bleed through */}
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 bg-white dark:bg-gray-950 border border-gray-200 dark:border-gray-700 shadow-sm">
                    <FileIcon name={res.file.name} />
                  </div>

                  <div className="flex-1 min-w-0">
                    <p className={clsx('text-sm font-semibold truncate', isSelected ? 'text-indigo-700 dark:text-indigo-300' : 'text-gray-900 dark:text-gray-100')}>
                      {res.file.name}
                    </p>
                    <p className="text-xs text-gray-400 dark:text-gray-500 truncate mt-0.5">
                      {res.locationLabel ? `${res.locationLabel} · ${dir}` : dir}
                    </p>
                  </div>

                  {(res.isLikelyLatest || typeof res.score === 'number') && (
                    <span className="text-[10px] font-semibold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/40 px-1.5 py-0.5 rounded-full shrink-0 border border-emerald-100 dark:border-emerald-900">
                      {res.isLikelyLatest ? t('likely_latest_version') : `${getMatchPercentage(res.score)}%`}
                    </span>
                  )}

                  {isSelected && (
                    <kbd className="text-[10px] text-indigo-400 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 bg-indigo-50 dark:bg-indigo-950/40 rounded px-1.5 py-0.5 shrink-0">↵</kbd>
                  )}
                </div>
              );
            })}

            {/* Footer hints */}
            <div className="px-4 py-2 border-t border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-800 flex gap-3 text-[10px] text-gray-400 dark:text-gray-500">
              <span><kbd className="font-mono bg-white dark:bg-gray-950 border border-gray-200 dark:border-gray-700 rounded px-1">↵</kbd> {t('spotlight_open')}</span>
              <span><kbd className="font-mono bg-white dark:bg-gray-950 border border-gray-200 dark:border-gray-700 rounded px-1">↑↓</kbd> {t('spotlight_navigate')}</span>
              <span><kbd className="font-mono bg-white dark:bg-gray-950 border border-gray-200 dark:border-gray-700 rounded px-1">Esc</kbd> {t('spotlight_close')}</span>
            </div>
          </>
        )}

        {/* ─── No Results ─── */}
        {showNoResults && (
          <div className="px-4 py-5 text-center text-sm text-gray-400 dark:text-gray-500">
            {t('spotlight_no_results')} <span className="font-medium text-gray-600 dark:text-gray-300">"{query}"</span>
          </div>
        )}
      </div>
    </div>
  );
}
