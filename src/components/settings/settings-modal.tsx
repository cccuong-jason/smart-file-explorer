'use client';

import { useState, useEffect } from 'react';
import { Keyboard, Check, X, AlertCircle, Database, Download, Trash2, ShieldCheck, Settings as SettingsIcon, Cloud, Shield, KeyRound } from 'lucide-react';
import { unregister, register } from '@tauri-apps/plugin-global-shortcut';
import { WebviewWindow } from '@tauri-apps/api/webviewWindow';
import { exportIndexToJSON, clearDatabase, getAllFiles, getOcrCandidateCount } from '@/lib/file-system/db';
import { useTranslation } from '@/lib/i18n';
import clsx from 'clsx';
import { useToast } from '@/components/ui/toast';
import { logFrontendMessage } from '@/lib/telemetry/logger';
import {
  DEFAULT_CLOUD_INTELLIGENCE_MODEL,
  type CloudIntelligenceStatus,
  type SaveCloudIntelligenceConfigInput,
  type TestCloudIntelligenceConnectionInput,
} from '@/lib/settings/cloud-intelligence';

const STORAGE_KEY = 'sfe_global_shortcut';
export const DEFAULT_SHORTCUT = 'CommandOrControl+Shift+Space';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onClearIndex: () => void; // callback so parent can reset React state
  cloudIntelligenceEnabled: boolean;
  onCloudIntelligenceEnabledChange: (enabled: boolean) => void;
  cloudStatus: CloudIntelligenceStatus;
  onSaveCloudConfig: (input: SaveCloudIntelligenceConfigInput) => Promise<void>;
  onTestCloudConnection: (input: TestCloudIntelligenceConnectionInput) => Promise<void>;
  onClearCloudConfig: () => Promise<void>;
}

export function SettingsModal({
  isOpen,
  onClose,
  onClearIndex,
  cloudIntelligenceEnabled,
  onCloudIntelligenceEnabledChange,
  cloudStatus,
  onSaveCloudConfig,
  onTestCloudConnection,
  onClearCloudConfig,
}: Props) {
  const { t } = useTranslation();
  const { toast } = useToast();
  
  const [activeTab, setActiveTab] = useState<'general' | 'privacy' | 'cloud'>('general');
  
  // --- Hotkey State ---
  const [recording, setRecording] = useState(false);
  const [keys, setKeys] = useState<string[]>([]);
  const [currentShortcut, setCurrentShortcut] = useState(DEFAULT_SHORTCUT);
  const [hkStatus, setHkStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [hkErrorMsg, setHkErrorMsg] = useState('');

  // --- Privacy / Data State ---
  const [fileCount, setFileCount] = useState<number | null>(null);
  const [ocrCandidateCount, setOcrCandidateCount] = useState<number | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [isClearing, setIsClearing] = useState(false);
  const [cloudApiKey, setCloudApiKey] = useState('');
  const [cloudModel, setCloudModel] = useState(DEFAULT_CLOUD_INTELLIGENCE_MODEL);
  const [cloudActionState, setCloudActionState] = useState<'idle' | 'testing' | 'saving' | 'clearing'>('idle');
  const [cloudFeedback, setCloudFeedback] = useState<{ tone: 'success' | 'error' | 'info'; message: string } | null>(null);

  useEffect(() => {
    if (isOpen) {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) setCurrentShortcut(saved);
      
      getAllFiles().then(files => setFileCount(files.length));
      getOcrCandidateCount().then(setOcrCandidateCount);
      setCloudApiKey('');
      setCloudModel(cloudStatus.model || DEFAULT_CLOUD_INTELLIGENCE_MODEL);
      setCloudFeedback(
        cloudStatus.lastError
          ? { tone: 'error', message: cloudStatus.lastError }
          : null
      );
    }
  }, [cloudStatus.lastError, cloudStatus.model, isOpen]);

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
        setOcrCandidateCount(0);
        onClearIndex();
      } catch (e) {
        console.error(e);
      } finally {
        setIsClearing(false);
      }
    }
  };

  const handleTestCloudConnection = async () => {
    try {
      setCloudActionState('testing');
      setCloudFeedback(null);
      await onTestCloudConnection({
        apiKey: cloudApiKey.trim() || undefined,
        model: cloudModel.trim() || undefined,
      });
      const message = t('privacy_cloud_test_success');
      setCloudFeedback({ tone: 'success', message });
      toast(message, 'success');
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setCloudFeedback({ tone: 'error', message });
      toast(message, 'error');
      void logFrontendMessage('error', message, 'settings-cloud-test');
    } finally {
      setCloudActionState('idle');
    }
  };

  const handleSaveCloudConfig = async () => {
    if (!cloudApiKey.trim()) {
      return;
    }

    try {
      setCloudActionState('saving');
      setCloudFeedback(null);
      await onSaveCloudConfig({
        apiKey: cloudApiKey.trim(),
        model: cloudModel.trim() || DEFAULT_CLOUD_INTELLIGENCE_MODEL,
      });
      setCloudApiKey('');
      const message = t('privacy_cloud_save_success');
      setCloudFeedback({ tone: 'success', message });
      toast(message, 'success');
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setCloudFeedback({ tone: 'error', message });
      toast(message, 'error');
      void logFrontendMessage('error', message, 'settings-cloud-save');
    } finally {
      setCloudActionState('idle');
    }
  };

  const handleClearCloudConfig = async () => {
    try {
      setCloudActionState('clearing');
      await onClearCloudConfig();
      setCloudApiKey('');
      const message = t('privacy_cloud_clear_success');
      setCloudFeedback({ tone: 'info', message });
      toast(message, 'info');
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setCloudFeedback({ tone: 'error', message });
      toast(message, 'error');
      void logFrontendMessage('error', message, 'settings-cloud-clear');
    } finally {
      setCloudActionState('idle');
    }
  };

  const cloudStatusLabel = cloudStatus.source === 'none'
    ? t('privacy_cloud_status_not_connected')
    : cloudStatus.lastError
      ? t('privacy_cloud_status_failed')
      : cloudStatus.lastTestedAt
        ? t('privacy_cloud_status_ready')
        : t('privacy_cloud_status_saved');

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[150] flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={onClose}>
      <div
        className="w-full max-w-2xl mx-4 flex flex-col overflow-hidden rounded-2xl border border-[var(--ui-border)] bg-[var(--ui-surface)] shadow-2xl animate-in fade-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[var(--ui-border)] bg-[var(--ui-surface-muted)] p-5">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[var(--ui-border)] bg-[var(--ui-primary-soft)]">
              <SettingsIcon className="h-5 w-5 text-[var(--ui-primary)]" />
            </div>
            <div>
              <h2 className="text-lg font-bold leading-tight text-gray-900 dark:text-gray-100">{t('settings')}</h2>
              <p className="text-xs text-gray-500 dark:text-gray-400">{t('settings_subtitle')}</p>
            </div>
          </div>
          <button onClick={onClose} className="rounded-lg p-2 text-gray-400 transition-colors hover:bg-black/5 hover:text-gray-600 dark:hover:bg-white/5 dark:hover:text-gray-300">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-5 border-b border-[var(--ui-border)] bg-[var(--ui-surface)] px-6 pt-2">
          <button
            onClick={() => setActiveTab('general')}
            className={clsx(
              'pb-3 pt-2 px-1 text-sm font-semibold border-b-2 transition-colors',
              activeTab === 'general'
                ? 'border-[var(--ui-primary)] text-[var(--ui-primary)]'
                : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
            )}
          >
            {t('general')}
          </button>
          <button
            onClick={() => setActiveTab('privacy')}
            className={clsx(
              'pb-3 pt-2 px-1 text-sm font-semibold border-b-2 transition-colors',
              activeTab === 'privacy'
                ? 'border-[var(--ui-primary)] text-[var(--ui-primary)]'
                : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
            )}
          >
            {t('privacy')}
          </button>
          <button
            onClick={() => setActiveTab('cloud')}
            className={clsx(
              'pb-3 pt-2 px-1 text-sm font-semibold border-b-2 transition-colors',
              activeTab === 'cloud'
                ? 'border-[var(--ui-primary)] text-[var(--ui-primary)]'
                : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
            )}
          >
            {t('privacy_cloud_intelligence_title')}
          </button>
        </div>

        {/* Content Area */}
        <div className="min-h-[320px] bg-[var(--ui-surface)] p-6">
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
              
              <div className="flex items-start gap-3 rounded-xl border border-[var(--ui-border)] bg-[var(--ui-surface-muted)] p-4">
                <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-[var(--ui-primary)]" />
                <div>
                  <h4 className="text-sm font-bold leading-tight text-gray-900 dark:text-gray-100">{t('privacy_local_title')}</h4>
                  <p className="mt-1 text-xs leading-relaxed text-gray-600 dark:text-gray-300">
                    {t('privacy_local_description')}
                  </p>
                </div>
              </div>

              <div className="overflow-hidden rounded-xl border border-[var(--ui-border)] shadow-sm">
                
                {/* Metrics */}
                <div className="flex items-center justify-between border-b border-[var(--ui-border)] bg-[var(--ui-surface-muted)] p-4">
                  <div className="flex items-center gap-2 text-gray-700 dark:text-gray-200 font-medium text-sm">
                    <Database className="h-4 w-4 shrink-0 text-[var(--ui-primary)]" />
                    {t('privacy_index_title')}
                  </div>
                  <div className="rounded px-2 py-1 text-xs font-bold text-[var(--ui-primary)] shadow-sm border border-[var(--ui-border)] bg-[var(--ui-surface)]">
                    {fileCount === null ? '...' : fileCount.toLocaleString()} {t('privacy_items')}
                  </div>
                </div>

                <div className="space-y-4 bg-[var(--ui-surface)] p-4">
                  {(ocrCandidateCount ?? 0) > 0 && (
                    <>
                      <div className="flex gap-4 items-start">
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--ui-warning-soft)]">
                          <AlertCircle className="h-4 w-4 text-[var(--ui-warning)]" />
                        </div>
                        <div className="flex-1">
                          <h4 className="text-sm font-bold text-gray-900 dark:text-gray-100">{t('privacy_ocr_candidates_title')}</h4>
                          <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5">
                            {t('privacy_ocr_candidates_description', { count: ocrCandidateCount ?? 0 })}
                          </p>
                        </div>
                      </div>

                      <div className="h-px w-full bg-gray-100 dark:bg-gray-800 my-2" />
                    </>
                  )}
                  
                  {/* Export */}
                  <div className="flex gap-4 items-start">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--ui-primary-soft)]">
                      <Download className="h-4 w-4 text-[var(--ui-primary)]" />
                    </div>
                    <div className="flex-1">
                      <h4 className="text-sm font-bold text-gray-900 dark:text-gray-100">{t('privacy_export_title')}</h4>
                      <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5">
                        {t('privacy_export_description')}
                      </p>
                      <button 
                        onClick={handleExport}
                        disabled={isExporting || fileCount === 0}
                        className="mt-3 flex items-center gap-2 rounded-lg bg-[var(--ui-primary)] px-4 py-2 text-xs font-bold text-white transition-colors hover:bg-[var(--ui-primary-strong)] disabled:grayscale disabled:opacity-50"
                      >
                        {isExporting ? t('privacy_exporting') : t('privacy_export_cta')}
                      </button>
                    </div>
                  </div>

                  <div className="h-px w-full bg-gray-100 dark:bg-gray-800 my-2" />

                  {/* Reset */}
                  <div className="flex gap-4 items-start">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--ui-danger-soft)]">
                      <Trash2 className="h-4 w-4 text-[var(--ui-danger)]" />
                    </div>
                    <div className="flex-1">
                      <h4 className="text-sm font-bold text-[var(--ui-danger)]">{t('privacy_reset_title')}</h4>
                      <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5">
                        {t('privacy_reset_description')} <strong className="text-gray-700 dark:text-gray-200">{t('privacy_reset_warning')}</strong>
                      </p>
                      <button 
                        onClick={handleClear}
                        disabled={isClearing || fileCount === 0}
                        className="mt-3 flex items-center gap-2 rounded-lg border border-[color:var(--ui-danger)]/30 bg-[var(--ui-surface)] px-4 py-2 text-xs font-bold text-[var(--ui-danger)] transition-colors hover:bg-[var(--ui-danger-soft)] disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {isClearing ? t('privacy_resetting') : t('privacy_reset_cta')}
                      </button>
                    </div>
                  </div>

                </div>
              </div>

            </div>
          )}

          {activeTab === 'cloud' && (
            <div className="space-y-5 animate-in slide-in-from-right-2 duration-300">
              <div className="rounded-xl border border-[var(--ui-border)] bg-[var(--ui-surface-muted)] p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-[var(--ui-border)] bg-[var(--ui-primary-soft)]">
                      <Cloud className="h-4 w-4 text-[var(--ui-primary)]" />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-gray-900 dark:text-gray-100">{t('privacy_cloud_intelligence_title')}</h3>
                      <p className="mt-1 text-xs leading-relaxed text-gray-500 dark:text-gray-400">
                        {t('privacy_cloud_intelligence_description')}
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    aria-pressed={cloudIntelligenceEnabled}
                    onClick={() => onCloudIntelligenceEnabledChange(!cloudIntelligenceEnabled)}
                    className={clsx(
                      'relative inline-flex h-7 w-12 shrink-0 items-center rounded-full border transition-colors',
                      cloudIntelligenceEnabled
                        ? 'border-[var(--ui-primary)] bg-[var(--ui-primary)]'
                        : 'border-gray-300 bg-gray-200 dark:border-gray-700 dark:bg-gray-800'
                    )}
                  >
                    <span
                      className={clsx(
                        'inline-block h-5 w-5 rounded-full bg-white shadow transition-transform',
                        cloudIntelligenceEnabled ? 'translate-x-6' : 'translate-x-1'
                      )}
                    />
                  </button>
                </div>
                <p className="mt-3 text-[11px] leading-relaxed text-gray-500 dark:text-gray-400">
                  {cloudIntelligenceEnabled
                    ? t('privacy_cloud_intelligence_enabled_hint')
                    : t('privacy_cloud_intelligence_disabled_hint')}
                </p>
              </div>

              <div className="rounded-xl border border-[var(--ui-border)] bg-[var(--ui-surface)] p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="inline-flex items-center gap-2 text-xs font-semibold text-gray-700 dark:text-gray-200">
                    <Shield className="h-3.5 w-3.5 text-[var(--ui-primary)]" />
                    {t('privacy_cloud_intelligence_status')}
                  </span>
                  <span className="rounded-full border border-[var(--ui-border)] bg-[var(--ui-surface-muted)] px-2.5 py-1 text-[10px] font-semibold text-gray-700 dark:text-gray-200">
                    {cloudStatusLabel}
                  </span>
                  <span className="rounded-full border border-[var(--ui-border)] bg-[var(--ui-surface-muted)] px-2.5 py-1 font-mono text-[10px] text-gray-600 dark:text-gray-300">
                    {cloudStatus.model || DEFAULT_CLOUD_INTELLIGENCE_MODEL}
                  </span>
                </div>

                {cloudStatus.lastTestedAt && (
                  <p className="mt-2 text-[11px] leading-relaxed text-gray-500 dark:text-gray-400">
                    {t('privacy_cloud_last_tested')}: {new Date(cloudStatus.lastTestedAt).toLocaleString()}
                  </p>
                )}

                {cloudFeedback && (
                  <div
                    role={cloudFeedback.tone === 'error' ? 'alert' : 'status'}
                    className={clsx(
                      'mt-3 rounded-lg border px-3 py-2 text-xs leading-relaxed',
                      cloudFeedback.tone === 'success'
                        ? 'border-[color:var(--ui-success)]/30 bg-[var(--ui-success-soft)] text-[var(--ui-success)]'
                        : cloudFeedback.tone === 'error'
                          ? 'border-[color:var(--ui-danger)]/30 bg-[var(--ui-danger-soft)] text-[var(--ui-danger)]'
                          : 'border-[var(--ui-border)] bg-[var(--ui-surface-muted)] text-gray-700 dark:text-gray-200'
                    )}
                  >
                    {cloudFeedback.message}
                  </div>
                )}

                {!cloudFeedback && cloudStatus.lastError && (
                  <div className="mt-3 rounded-lg border border-[color:var(--ui-danger)]/30 bg-[var(--ui-danger-soft)] px-3 py-2 text-xs leading-relaxed text-[var(--ui-danger)]">
                    {cloudStatus.lastError}
                  </div>
                )}

                <div className="mt-4 grid gap-4 md:grid-cols-[minmax(0,1fr)_220px]">
                  <div className="space-y-3">
                    <label className="block">
                      <span className="mb-1 block text-[11px] font-semibold text-gray-700 dark:text-gray-200">
                        {t('privacy_cloud_api_key_label')}
                      </span>
                      <input
                        type="password"
                        value={cloudApiKey}
                        onChange={(event) => setCloudApiKey(event.target.value)}
                        placeholder={t('privacy_cloud_api_key_placeholder')}
                        aria-label={t('privacy_cloud_api_key_label')}
                        className="w-full rounded-lg border border-[var(--ui-border)] bg-[var(--ui-surface)] px-3 py-2 text-sm text-gray-900 outline-none transition-colors focus:border-[var(--ui-primary)] dark:text-gray-100"
                      />
                    </label>
                    <label className="block">
                      <span className="mb-1 block text-[11px] font-semibold text-gray-700 dark:text-gray-200">
                        {t('privacy_cloud_model_label')}
                      </span>
                      <input
                        type="text"
                        value={cloudModel}
                        onChange={(event) => setCloudModel(event.target.value)}
                        aria-label={t('privacy_cloud_model_label')}
                        className="w-full rounded-lg border border-[var(--ui-border)] bg-[var(--ui-surface)] px-3 py-2 text-sm text-gray-900 outline-none transition-colors focus:border-[var(--ui-primary)] dark:text-gray-100"
                      />
                    </label>
                    <p className="text-[11px] leading-relaxed text-gray-500 dark:text-gray-400">
                      {t('privacy_cloud_storage_note')}
                    </p>
                  </div>

                  <div className="rounded-xl border border-[var(--ui-border)] bg-[var(--ui-surface-muted)] p-3">
                    <h4 className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-gray-700 dark:text-gray-200">
                      <KeyRound className="h-3.5 w-3.5 text-[var(--ui-primary)]" />
                      {t('privacy_cloud_connection_actions')}
                    </h4>
                    <div className="mt-3 flex flex-col gap-2">
                      <button
                        type="button"
                        onClick={handleTestCloudConnection}
                        disabled={cloudActionState !== 'idle'}
                        className="rounded-lg border border-[var(--ui-border)] bg-[var(--ui-surface)] px-3 py-2 text-xs font-semibold text-gray-700 transition-colors hover:bg-[var(--ui-surface-muted)] disabled:opacity-50 dark:text-gray-200"
                      >
                        {cloudActionState === 'testing' ? t('privacy_cloud_testing') : t('privacy_cloud_test_cta')}
                      </button>
                      <button
                        type="button"
                        onClick={handleSaveCloudConfig}
                        disabled={cloudActionState !== 'idle' || !cloudApiKey.trim()}
                        className="rounded-lg bg-[var(--ui-primary)] px-3 py-2 text-xs font-semibold text-white transition-colors hover:bg-[var(--ui-primary-strong)] disabled:opacity-50"
                      >
                        {cloudActionState === 'saving' ? t('privacy_cloud_saving') : t('privacy_cloud_save_cta')}
                      </button>
                      {cloudStatus.configured && (
                        <button
                          type="button"
                          onClick={handleClearCloudConfig}
                          disabled={cloudActionState !== 'idle'}
                          className="rounded-lg border border-[color:var(--ui-danger)]/30 bg-[var(--ui-surface)] px-3 py-2 text-xs font-semibold text-[var(--ui-danger)] transition-colors hover:bg-[var(--ui-danger-soft)] disabled:opacity-50"
                        >
                          {cloudActionState === 'clearing' ? t('privacy_cloud_clearing') : t('privacy_cloud_clear_cta')}
                        </button>
                      )}
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
