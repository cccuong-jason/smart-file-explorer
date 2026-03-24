'use client';

import { useState, useEffect } from 'react';
import { Keyboard, Check, X, AlertCircle, Database, Download, Trash2, ShieldCheck, Settings as SettingsIcon } from 'lucide-react';
import { unregister, register } from '@tauri-apps/plugin-global-shortcut';
import { WebviewWindow } from '@tauri-apps/api/webviewWindow';
import { exportIndexToJSON, clearDatabase, getAllFiles } from '@/lib/file-system/db';
import { useTranslation } from '@/lib/i18n';
import clsx from 'clsx';

const STORAGE_KEY = 'sfe_global_shortcut';
export const DEFAULT_SHORTCUT = 'CommandOrControl+Shift+Space';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onClearIndex: () => void; // callback so parent can reset React state
}

export function SettingsModal({ isOpen, onClose, onClearIndex }: Props) {
  const { t } = useTranslation();
  
  const [activeTab, setActiveTab] = useState<'general' | 'privacy'>('general');
  
  // --- Hotkey State ---
  const [recording, setRecording] = useState(false);
  const [keys, setKeys] = useState<string[]>([]);
  const [currentShortcut, setCurrentShortcut] = useState(DEFAULT_SHORTCUT);
  const [hkStatus, setHkStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [hkErrorMsg, setHkErrorMsg] = useState('');

  // --- Privacy / Data State ---
  const [fileCount, setFileCount] = useState<number | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [isClearing, setIsClearing] = useState(false);

  useEffect(() => {
    if (isOpen) {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) setCurrentShortcut(saved);
      
      getAllFiles().then(files => setFileCount(files.length));
    }
  }, [isOpen]);

  // --- Hotkey Logic ---
  useEffect(() => {
    if (!recording || activeTab !== 'general') return;

    const handleKeyDown = (e: KeyboardEvent) => {
      e.preventDefault();
      const parts: string[] = [];
      if (e.ctrlKey || e.metaKey) parts.push('CommandOrControl');
      if (e.altKey) parts.push('Alt');
      if (e.shiftKey) parts.push('Shift');
      const key = e.key.toUpperCase();
      if (!['CONTROL', 'META', 'ALT', 'SHIFT'].includes(key)) {
        parts.push(key === ' ' ? 'Space' : key);
      }
      setKeys(parts);
    };

    const handleKeyUp = async (e: KeyboardEvent) => {
      e.preventDefault();
      if (keys.length >= 2) {
        setRecording(false);
        await applyShortcut(keys.join('+'));
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [recording, keys, activeTab]);

  const applyShortcut = async (newShortcut: string) => {
    try {
      const oldShortcut = localStorage.getItem(STORAGE_KEY) || DEFAULT_SHORTCUT;
      try { await unregister(oldShortcut); } catch (_) {}

      await register(newShortcut, async (event) => {
        if (event.state !== 'Released') return;
        const spotlight = await WebviewWindow.getByLabel('spotlight');
        if (spotlight) { await spotlight.show(); await spotlight.setFocus(); }
      });

      localStorage.setItem(STORAGE_KEY, newShortcut);
      setCurrentShortcut(newShortcut);
      setHkStatus('success');
      setTimeout(() => setHkStatus('idle'), 2000);
    } catch (err: any) {
      setHkErrorMsg(err?.message || t('shortcut_register_failed'));
      setHkStatus('error');
      setTimeout(() => setHkStatus('idle'), 3000);
    }
  };

  // --- Privacy Logic ---
  const handleExport = async () => {
    try {
      setIsExporting(true);
      await exportIndexToJSON();
    } catch (e) {
      console.error(e);
    } finally {
      setIsExporting(false);
    }
  };

  const handleClear = async () => {
    if (confirm(t('confirm_clear_index'))) {
      setIsClearing(true);
      try {
        await clearDatabase();
        setFileCount(0);
        onClearIndex();
      } catch (e) {
        console.error(e);
      } finally {
        setIsClearing(false);
      }
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[150] flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={onClose}>
      <div
        className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-lg mx-4 flex flex-col border border-white/20 dark:border-gray-800 overflow-hidden animate-in fade-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-800/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-900/30 border border-indigo-100 dark:border-indigo-800 flex items-center justify-center shrink-0">
              <SettingsIcon className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100 leading-tight">{t('settings')}</h2>
              <p className="text-xs text-gray-500 dark:text-gray-400">{t('settings_subtitle')}</p>
            </div>
          </div>
          <button onClick={onClose} className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 p-2 rounded-lg transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-4 px-6 border-b border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 pt-2">
          <button
            onClick={() => setActiveTab('general')}
            className={clsx(
              'pb-3 pt-2 px-1 text-sm font-semibold border-b-2 transition-colors',
              activeTab === 'general' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
            )}
          >
            {t('general')}
          </button>
          <button
            onClick={() => setActiveTab('privacy')}
            className={clsx(
              'pb-3 pt-2 px-1 text-sm font-semibold border-b-2 transition-colors',
              activeTab === 'privacy' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
            )}
          >
            {t('privacy')}
          </button>
        </div>

        {/* Content Area */}
        <div className="p-6 bg-white dark:bg-gray-900 min-h-[300px]">
          {activeTab === 'general' && (
            <div className="space-y-6 animate-in slide-in-from-right-2 duration-300">
              <div>
                <h3 className="text-sm font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2 mb-2">
                  <Keyboard className="w-4 h-4 text-indigo-500" />
                  {t('shortcut_title')}
                </h3>
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                  {t('shortcut_description')}
                </p>

                <div
                  className={clsx(
                    'flex items-center justify-center gap-1.5 p-6 rounded-xl border-2 cursor-pointer transition-all select-none',
                    recording
                      ? 'border-indigo-400 bg-indigo-50 dark:bg-indigo-950/50 animate-pulse'
                      : 'border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 hover:border-indigo-300 dark:hover:border-indigo-700 hover:bg-indigo-50/50 dark:hover:bg-indigo-950/40'
                  )}
                  onClick={() => { setRecording(true); setKeys([]); setHkStatus('idle'); }}
                  title={t('shortcut_record_title')}
                >
                  {recording && keys.length === 0 ? (
                    <span className="text-sm text-indigo-500 font-medium">{t('shortcut_record')}</span>
                  ) : (
                    (recording && keys.length > 0 ? keys : currentShortcut.split('+')).map((k, i) => (
                      <span key={i} className="flex items-center gap-1">
                        {i > 0 && <span className="text-gray-400 text-xs font-bold">+</span>}
                        <kbd className={clsx(
                          'px-3 py-1.5 rounded-lg text-sm font-bold border shadow-sm min-w-[32px] text-center tracking-wider',
                          recording ? 'bg-indigo-100 dark:bg-indigo-900/60 border-indigo-300 dark:border-indigo-700 text-indigo-700 dark:text-indigo-200' : 'bg-white dark:bg-gray-900 border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-200'
                        )}>
                          {k === 'CommandOrControl' ? (navigator.platform.includes('Mac') ? '⌘' : 'Ctrl') : k}
                        </kbd>
                      </span>
                    ))
                  )}
                </div>

                {hkStatus === 'success' && (
                  <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-300 text-sm bg-emerald-50 dark:bg-emerald-950/40 rounded-lg px-3 py-2 mt-3">
                    <Check className="w-4 h-4 shrink-0" /> {t('shortcut_success')}
                  </div>
                )}
                {hkStatus === 'error' && (
                  <div className="flex items-start gap-2 text-red-600 dark:text-red-300 text-sm bg-red-50 dark:bg-red-950/40 rounded-lg px-3 py-2 mt-3">
                    <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" /> {hkErrorMsg}
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'privacy' && (
            <div className="space-y-6 animate-in slide-in-from-right-2 duration-300">
              
              <div className="bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-100 dark:border-emerald-900 rounded-xl p-4 flex items-start gap-3">
                <ShieldCheck className="w-5 h-5 text-emerald-600 mt-0.5 shrink-0" />
                <div>
                  <h4 className="text-sm font-bold text-emerald-900 dark:text-emerald-200 leading-tight">{t('privacy_local_title')}</h4>
                  <p className="text-xs text-emerald-700 dark:text-emerald-300 mt-1 leading-relaxed">
                    {t('privacy_local_description')}
                  </p>
                </div>
              </div>

              <div className="border border-gray-100 dark:border-gray-800 rounded-xl overflow-hidden shadow-sm">
                
                {/* Metrics */}
                <div className="bg-gray-50 dark:bg-gray-800 border-b border-gray-100 dark:border-gray-800 p-4 flex items-center justify-between">
                  <div className="flex items-center gap-2 text-gray-700 dark:text-gray-200 font-medium text-sm">
                    <Database className="w-4 h-4 text-indigo-500 shrink-0" />
                    {t('privacy_index_title')}
                  </div>
                  <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded px-2 py-1 text-xs font-bold text-indigo-600 dark:text-indigo-300 shadow-sm">
                    {fileCount === null ? '...' : fileCount.toLocaleString()} {t('privacy_items')}
                  </div>
                </div>

                <div className="p-4 bg-white dark:bg-gray-900 space-y-4">
                  
                  {/* Export */}
                  <div className="flex gap-4 items-start">
                    <div className="w-8 h-8 rounded-full bg-blue-50 dark:bg-blue-950/40 flex items-center justify-center shrink-0">
                      <Download className="w-4 h-4 text-blue-600" />
                    </div>
                    <div className="flex-1">
                      <h4 className="text-sm font-bold text-gray-900 dark:text-gray-100">{t('privacy_export_title')}</h4>
                      <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5">
                        {t('privacy_export_description')}
                      </p>
                      <button 
                        onClick={handleExport}
                        disabled={isExporting || fileCount === 0}
                        className="mt-3 text-xs font-bold px-4 py-2 rounded-lg bg-gradient-to-r from-blue-500 to-indigo-500 hover:from-blue-600 hover:to-indigo-600 text-white shadow-sm hover:shadow-md active:scale-[0.97] transition-all duration-200 disabled:opacity-50 disabled:grayscale flex items-center gap-2"
                      >
                        {isExporting ? t('privacy_exporting') : t('privacy_export_cta')}
                      </button>
                    </div>
                  </div>

                  <div className="h-px w-full bg-gray-100 dark:bg-gray-800 my-2" />

                  {/* Reset */}
                  <div className="flex gap-4 items-start">
                    <div className="w-8 h-8 rounded-full bg-red-50 dark:bg-red-950/40 flex items-center justify-center shrink-0">
                      <Trash2 className="w-4 h-4 text-red-600" />
                    </div>
                    <div className="flex-1">
                      <h4 className="text-sm font-bold text-red-600 dark:text-red-300 text-opacity-80">{t('privacy_reset_title')}</h4>
                      <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5">
                        {t('privacy_reset_description')} <strong className="text-gray-700 dark:text-gray-200">{t('privacy_reset_warning')}</strong>
                      </p>
                      <button 
                        onClick={handleClear}
                        disabled={isClearing || fileCount === 0}
                        className="mt-3 text-xs font-bold px-4 py-2 rounded-lg bg-white dark:bg-gray-900 border border-red-200 dark:border-red-900 text-red-600 dark:text-red-300 hover:bg-red-50 dark:hover:bg-red-950/40 hover:border-red-300 dark:hover:border-red-800 shadow-sm hover:shadow-md active:scale-[0.97] transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                      >
                        {isClearing ? t('privacy_resetting') : t('privacy_reset_cta')}
                      </button>
                    </div>
                  </div>

                </div>
              </div>

            </div>
          )}
        </div>

      </div>
    </div>
  );
}
