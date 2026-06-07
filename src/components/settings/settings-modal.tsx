'use client';

import { useState, useEffect } from 'react';
import { Keyboard, Check, X, AlertCircle, Database, Download, Trash2, ShieldCheck, Settings as SettingsIcon, Cloud, Shield, KeyRound, Activity, RefreshCw, ClipboardList } from 'lucide-react';
import { unregister, register } from '@tauri-apps/plugin-global-shortcut';
import { WebviewWindow } from '@tauri-apps/api/webviewWindow';
import { exportIndexToJSON, clearDatabase, getAllFiles, getOcrCandidateCount } from '@/lib/file-system/db';
import type { WatchedFolderRecord } from '@/lib/file-system/db';
import { useTranslation } from '@/lib/i18n';
import clsx from 'clsx';
import { useToast } from '@/components/ui/toast';
import { Button } from '@/components/retroui/Button';
import { clearRecentLogEvents, logFrontendMessage } from '@/lib/telemetry/logger';
import {
  exportDiagnosticBundle,
  getDiagnosticSnapshot,
  type DiagnosticSnapshot,
} from '@/lib/telemetry/diagnostics';
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
  watchedFolders: WatchedFolderRecord[];
  onToggleWatchedFolder: (path: string, enabled: boolean) => void | Promise<void>;
  onRemoveWatchedFolder: (path: string) => void | Promise<void>;
  onSaveCloudConfig: (input: SaveCloudIntelligenceConfigInput) => Promise<CloudIntelligenceStatus>;
  onTestCloudConnection: (input: TestCloudIntelligenceConnectionInput) => Promise<CloudIntelligenceStatus>;
  onClearCloudConfig: () => Promise<CloudIntelligenceStatus>;
}

export function SettingsModal({
  isOpen,
  onClose,
  onClearIndex,
  cloudIntelligenceEnabled,
  onCloudIntelligenceEnabledChange,
  cloudStatus,
  watchedFolders,
  onToggleWatchedFolder,
  onRemoveWatchedFolder,
  onSaveCloudConfig,
  onTestCloudConnection,
  onClearCloudConfig,
}: Props) {
  const { t } = useTranslation();
  const { toast } = useToast();
  
  const [activeTab, setActiveTab] = useState<'general' | 'privacy' | 'cloud' | 'diagnostics'>('general');
  
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
  const [diagnosticSnapshot, setDiagnosticSnapshot] = useState<DiagnosticSnapshot | null>(null);
  const [diagnosticLevelFilter, setDiagnosticLevelFilter] = useState('all');
  const [diagnosticAreaFilter, setDiagnosticAreaFilter] = useState('all');
  const [diagnosticActionState, setDiagnosticActionState] = useState<'idle' | 'loading' | 'exporting'>('idle');

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
      void refreshDiagnostics();
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
    if (!cloudApiKey.trim() && !cloudStatus.configured) {
      const message = t('privacy_cloud_status_not_connected');
      setCloudFeedback({ tone: 'info', message });
      toast(message, 'info');
      return;
    }

    try {
      setCloudActionState('testing');
      setCloudFeedback(null);
      const nextStatus = await onTestCloudConnection({
        apiKey: cloudApiKey.trim() || undefined,
        model: cloudModel.trim() || undefined,
      });
      const message = nextStatus.lastError || t('privacy_cloud_test_success');
      setCloudFeedback({ tone: nextStatus.lastError ? 'error' : 'success', message });
      toast(message, nextStatus.lastError ? 'error' : 'success');
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
      const nextStatus = await onSaveCloudConfig({
        apiKey: cloudApiKey.trim(),
        model: cloudModel.trim() || DEFAULT_CLOUD_INTELLIGENCE_MODEL,
      });
      setCloudApiKey('');
      const message = nextStatus.lastError || t('privacy_cloud_save_success');
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

  const refreshDiagnostics = async () => {
    setDiagnosticActionState('loading');
    try {
      setDiagnosticSnapshot(await getDiagnosticSnapshot());
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      void logFrontendMessage('error', message, 'settings-diagnostics-refresh');
      toast(message, 'error');
    } finally {
      setDiagnosticActionState('idle');
    }
  };

  const handleExportDiagnostics = async () => {
    setDiagnosticActionState('exporting');
    try {
      const path = await exportDiagnosticBundle();
      toast(path ? `${t('diagnostics_exported')} ${path}` : t('diagnostics_export_unavailable'), path ? 'success' : 'warning');
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      void logFrontendMessage('error', message, 'settings-diagnostics-export');
      toast(message, 'error');
    } finally {
      setDiagnosticActionState('idle');
    }
  };

  const handleCopyDiagnosticSummary = async () => {
    if (!diagnosticSnapshot) {
      return;
    }

    const summary = [
      `source=${diagnosticSnapshot.source}`,
      `generatedAt=${diagnosticSnapshot.generatedAt}`,
      `logFilePath=${diagnosticSnapshot.logFilePath ?? 'n/a'}`,
      `watchedFolders=${diagnosticSnapshot.watchedFolders.length}`,
      `activeWatchRoots=${diagnosticSnapshot.activeWatchRoots.length}`,
      `recentEvents=${diagnosticSnapshot.recentFrontendEvents.length}`,
    ].join('\n');

    await navigator.clipboard?.writeText(summary).catch(() => undefined);
    toast(t('diagnostics_summary_copied'), 'success');
  };

  const handleClearDiagnosticEvents = async () => {
    clearRecentLogEvents();
    await refreshDiagnostics();
    toast(t('diagnostics_cleared'), 'success');
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
    <div className="fixed inset-0 z-[150] flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm" onClick={onClose}>
      <div
        className="mx-4 flex w-full max-w-2xl flex-col overflow-hidden rounded border-2 border-border bg-card text-card-foreground shadow-md animate-in fade-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b-2 border-border bg-secondary p-5">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded border-2 border-border bg-primary">
              <SettingsIcon className="h-5 w-5 text-primary-foreground" />
            </div>
            <div>
              <h2 className="font-head text-lg font-bold leading-tight text-foreground">{t('settings')}</h2>
              <p className="text-xs text-muted-foreground">{t('settings_subtitle')}</p>
            </div>
          </div>
          <Button type="button" onClick={onClose} variant="outline" size="icon" className="bg-card text-foreground">
            <X className="w-5 h-5" />
          </Button>
        </div>

        {/* Tabs */}
        <div className="flex flex-wrap items-center gap-2 border-b-2 border-border bg-card px-6 py-3">
          <button
            onClick={() => setActiveTab('general')}
            className={clsx(
              'rounded border-2 px-3 py-1.5 font-head text-xs font-semibold uppercase transition-colors',
              activeTab === 'general'
                ? 'border-border bg-primary text-primary-foreground shadow-sm'
                : 'border-border bg-background text-foreground hover:bg-secondary'
            )}
          >
            {t('general')}
          </button>
          <button
            onClick={() => setActiveTab('privacy')}
            className={clsx(
              'rounded border-2 px-3 py-1.5 font-head text-xs font-semibold uppercase transition-colors',
              activeTab === 'privacy'
                ? 'border-border bg-primary text-primary-foreground shadow-sm'
                : 'border-border bg-background text-foreground hover:bg-secondary'
            )}
          >
            {t('privacy')}
          </button>
          <button
            onClick={() => setActiveTab('cloud')}
            className={clsx(
              'rounded border-2 px-3 py-1.5 font-head text-xs font-semibold uppercase transition-colors',
              activeTab === 'cloud'
                ? 'border-border bg-primary text-primary-foreground shadow-sm'
                : 'border-border bg-background text-foreground hover:bg-secondary'
            )}
          >
            {t('privacy_cloud_intelligence_title')}
          </button>
          <button
            onClick={() => setActiveTab('diagnostics')}
            className={clsx(
              'rounded border-2 px-3 py-1.5 font-head text-xs font-semibold uppercase transition-colors',
              activeTab === 'diagnostics'
                ? 'border-border bg-primary text-primary-foreground shadow-sm'
                : 'border-border bg-background text-foreground hover:bg-secondary'
            )}
          >
            {t('diagnostics')}
          </button>
        </div>

        {/* Content Area */}
        <div className="min-h-[320px] bg-card p-6">
          {activeTab === 'general' && (
            <div className="space-y-6 animate-in slide-in-from-right-2 duration-300">
              <div>
                <h3 className="mb-2 flex items-center gap-2 font-head text-sm font-bold text-foreground">
                  <Keyboard className="w-4 h-4 text-primary" />
                  {t('shortcut_title')}
                </h3>
                <p className="mb-4 text-sm text-muted-foreground">
                  {t('shortcut_description')}
                </p>

                <div
                  className={clsx(
                    'flex cursor-pointer select-none items-center justify-center gap-1.5 rounded border-2 p-6 transition-all',
                    recording
                      ? 'animate-pulse border-border bg-primary text-primary-foreground'
                      : 'border-border bg-background hover:bg-secondary'
                  )}
                  onClick={() => { setRecording(true); setKeys([]); setHkStatus('idle'); }}
                  title={t('shortcut_record_title')}
                >
                  {recording && keys.length === 0 ? (
                    <span className="font-head text-sm font-medium text-primary-foreground">{t('shortcut_record')}</span>
                  ) : (
                    (recording && keys.length > 0 ? keys : currentShortcut.split('+')).map((k, i) => (
                      <span key={i} className="flex items-center gap-1">
                        {i > 0 && <span className="text-xs font-bold text-muted-foreground">+</span>}
                        <kbd className={clsx(
                          'min-w-[32px] rounded border-2 px-3 py-1.5 text-center font-head text-sm font-bold',
                          recording ? 'border-border bg-secondary text-secondary-foreground' : 'border-border bg-card text-foreground'
                        )}>
                          {k === 'CommandOrControl' ? (navigator.platform.includes('Mac') ? '⌘' : 'Ctrl') : k}
                        </kbd>
                      </span>
                    ))
                  )}
                </div>

                {hkStatus === 'success' && (
                  <div className="mt-3 flex items-center gap-2 rounded border-2 border-border bg-[var(--ui-success-soft)] px-3 py-2 text-sm text-[var(--ui-success)]">
                    <Check className="w-4 h-4 shrink-0" /> {t('shortcut_success')}
                  </div>
                )}
                {hkStatus === 'error' && (
                  <div className="mt-3 flex items-start gap-2 rounded border-2 border-border bg-[var(--ui-danger-soft)] px-3 py-2 text-sm text-[var(--ui-danger)]">
                    <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" /> {hkErrorMsg}
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'privacy' && (
            <div className="space-y-6 animate-in slide-in-from-right-2 duration-300">
              
              <div className="flex items-start gap-3 rounded border-2 border-border bg-secondary p-4">
                <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-[var(--ui-primary)]" />
                <div>
                  <h4 className="font-head text-sm font-bold leading-tight text-foreground">{t('privacy_local_title')}</h4>
                  <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                    {t('privacy_local_description')}
                  </p>
                </div>
              </div>

              <div className="overflow-hidden rounded border-2 border-border bg-card shadow-sm">
                
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
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded border-2 border-border bg-[var(--ui-warning-soft)]">
                          <AlertCircle className="h-4 w-4 text-[var(--ui-warning)]" />
                        </div>
                        <div className="flex-1">
                          <h4 className="font-head text-sm font-bold text-foreground">{t('privacy_ocr_candidates_title')}</h4>
                          <p className="mt-0.5 text-[11px] text-muted-foreground">
                            {t('privacy_ocr_candidates_description', { count: ocrCandidateCount ?? 0 })}
                          </p>
                        </div>
                      </div>

                      <div className="my-2 h-0.5 w-full bg-border" />
                    </>
                  )}
                  
                  {/* Export */}
                  <div className="flex gap-4 items-start">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded border-2 border-border bg-primary">
                      <Download className="h-4 w-4 text-primary-foreground" />
                    </div>
                    <div className="flex-1">
                      <h4 className="font-head text-sm font-bold text-foreground">{t('privacy_export_title')}</h4>
                      <p className="mt-0.5 text-[11px] text-muted-foreground">
                        {t('privacy_export_description')}
                      </p>
                      <Button
                        type="button"
                        onClick={handleExport}
                        disabled={isExporting || fileCount === 0}
                        size="sm"
                        className="mt-3"
                      >
                        {isExporting ? t('privacy_exporting') : t('privacy_export_cta')}
                      </Button>
                    </div>
                  </div>

                  <div className="my-2 h-0.5 w-full bg-border" />

                  {/* Reset */}
                  <div className="flex gap-4 items-start">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded border-2 border-border bg-[var(--ui-danger-soft)]">
                      <Trash2 className="h-4 w-4 text-[var(--ui-danger)]" />
                    </div>
                    <div className="flex-1">
                      <h4 className="text-sm font-bold text-[var(--ui-danger)]">{t('privacy_reset_title')}</h4>
                      <p className="mt-0.5 text-[11px] text-muted-foreground">
                        {t('privacy_reset_description')} <strong className="text-foreground">{t('privacy_reset_warning')}</strong>
                      </p>
                      <Button
                        type="button"
                        onClick={handleClear}
                        disabled={isClearing || fileCount === 0}
                        variant="outline"
                        size="sm"
                        className="mt-3 border-[var(--ui-danger)] bg-card text-[var(--ui-danger)] hover:bg-[var(--ui-danger-soft)]"
                      >
                        {isClearing ? t('privacy_resetting') : t('privacy_reset_cta')}
                      </Button>
                    </div>
                  </div>

                </div>
              </div>

              <div className="overflow-hidden rounded border-2 border-border bg-card shadow-sm">
                <div className="flex items-center justify-between border-b-2 border-border bg-secondary p-4">
                  <div className="flex items-center gap-2 font-head text-sm font-medium text-foreground">
                    <Shield className="h-4 w-4 shrink-0 text-[var(--ui-primary)]" />
                    {t('watched_folders_title')}
                  </div>
                  <div className="rounded border-2 border-border bg-card px-2 py-1 font-head text-xs font-bold text-primary shadow-sm">
                    {watchedFolders.length.toLocaleString()} {t('privacy_items')}
                  </div>
                </div>

                <div className="space-y-4 bg-card p-4">
                  <p className="text-[11px] leading-relaxed text-muted-foreground">
                    {t('watched_folders_description')}
                  </p>

                  {watchedFolders.length === 0 ? (
                    <p className="rounded border-2 border-dashed border-border px-3 py-4 text-xs text-muted-foreground">
                      {t('watched_folders_empty')}
                    </p>
                  ) : (
                    <div className="space-y-3">
                      {watchedFolders.map((folder) => (
                        <div
                          key={folder.path}
                          className="rounded border-2 border-border bg-secondary px-3 py-3"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <div className="truncate text-sm font-semibold text-foreground">
                                {folder.path}
                              </div>
                              <div className="mt-1 text-[11px] text-muted-foreground">
                                {folder.enabled ? t('watched_folder_state_on') : t('watched_folder_state_off')}
                                {' · '}
                                {t(`watched_folder_status_${folder.status}`)}
                              </div>
                            </div>
                            <div className="flex shrink-0 items-center gap-2">
                              <Button
                                type="button"
                                onClick={() => void onToggleWatchedFolder(folder.path, !folder.enabled)}
                                variant="outline"
                                size="sm"
                                className="bg-card text-[11px]"
                                aria-label={folder.enabled ? t('watched_folder_disable_action') : t('watched_folder_enable_action')}
                              >
                                {folder.enabled ? t('watched_folder_disable_action') : t('watched_folder_enable_action')}
                              </Button>
                              <Button
                                type="button"
                                onClick={() => void onRemoveWatchedFolder(folder.path)}
                                variant="outline"
                                size="sm"
                                className="border-[var(--ui-danger)] bg-card text-[11px] text-[var(--ui-danger)] hover:bg-[var(--ui-danger-soft)]"
                                aria-label={t('watched_folder_remove_action')}
                              >
                                {t('watched_folder_remove_short')}
                              </Button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

            </div>
          )}

          {activeTab === 'cloud' && (
            <div className="space-y-5 animate-in slide-in-from-right-2 duration-300">
              <div className="rounded-xl border border-[var(--ui-border)] bg-[var(--ui-surface-muted)] p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded border-2 border-border bg-primary">
                      <Cloud className="h-4 w-4 text-primary-foreground" />
                    </div>
                    <div>
                      <h3 className="font-head text-sm font-bold text-foreground">{t('privacy_cloud_intelligence_title')}</h3>
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
                      'relative inline-flex h-7 w-12 shrink-0 items-center rounded border-2 transition-colors',
                      cloudIntelligenceEnabled
                        ? 'border-border bg-primary'
                        : 'border-border bg-card'
                    )}
                  >
                    <span
                      className={clsx(
                        'inline-block h-5 w-5 rounded bg-background shadow transition-transform',
                        cloudIntelligenceEnabled ? 'translate-x-6' : 'translate-x-1'
                      )}
                    />
                  </button>
                </div>
                <p className="mt-3 text-[11px] leading-relaxed text-muted-foreground">
                  {cloudIntelligenceEnabled
                    ? t('privacy_cloud_intelligence_enabled_hint')
                    : t('privacy_cloud_intelligence_disabled_hint')}
                </p>
              </div>

              <div className="rounded border-2 border-border bg-card p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="inline-flex items-center gap-2 font-head text-xs font-semibold text-foreground">
                    <Shield className="h-3.5 w-3.5 text-[var(--ui-primary)]" />
                    {t('privacy_cloud_intelligence_status')}
                  </span>
                  <span className="rounded border-2 border-border bg-secondary px-2.5 py-1 font-head text-[10px] font-semibold text-foreground">
                    {cloudStatusLabel}
                  </span>
                  <span className="rounded border-2 border-border bg-secondary px-2.5 py-1 font-mono text-[10px] text-foreground">
                    {cloudStatus.model || DEFAULT_CLOUD_INTELLIGENCE_MODEL}
                  </span>
                </div>

                {cloudStatus.lastTestedAt && (
                  <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">
                    {t('privacy_cloud_last_tested')}: {new Date(cloudStatus.lastTestedAt).toLocaleString()}
                  </p>
                )}

                <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">
                  {cloudApiKey.trim()
                    ? t('privacy_cloud_testing_typed_key')
                    : cloudStatus.configured
                      ? t('privacy_cloud_testing_saved_key')
                      : t('privacy_cloud_testing_no_key')}
                </p>

                {cloudFeedback && (
                  <div
                    role={cloudFeedback.tone === 'error' ? 'alert' : 'status'}
                    className={clsx(
                      'mt-3 rounded border-2 px-3 py-2 text-xs leading-relaxed',
                      cloudFeedback.tone === 'success'
                        ? 'border-[color:var(--ui-success)]/30 bg-[var(--ui-success-soft)] text-[var(--ui-success)]'
                        : cloudFeedback.tone === 'error'
                          ? 'border-[color:var(--ui-danger)]/30 bg-[var(--ui-danger-soft)] text-[var(--ui-danger)]'
                          : 'border-border bg-secondary text-foreground'
                    )}
                  >
                    {cloudFeedback.message}
                  </div>
                )}

                {!cloudFeedback && cloudStatus.lastError && (
                  <div className="mt-3 rounded border-2 border-[var(--ui-danger)] bg-[var(--ui-danger-soft)] px-3 py-2 text-xs leading-relaxed text-[var(--ui-danger)]">
                    {cloudStatus.lastError}
                  </div>
                )}

                <div className="mt-4 grid gap-4 md:grid-cols-[minmax(0,1fr)_220px]">
                  <div className="space-y-3">
                    <label className="block">
                      <span className="mb-1 block font-head text-[11px] font-semibold text-foreground">
                        {t('privacy_cloud_api_key_label')}
                      </span>
                      <input
                        type="password"
                        value={cloudApiKey}
                        onChange={(event) => setCloudApiKey(event.target.value)}
                        placeholder={t('privacy_cloud_api_key_placeholder')}
                        aria-label={t('privacy_cloud_api_key_label')}
                        className="w-full rounded border-2 border-border bg-background px-3 py-2 text-sm text-foreground outline-none transition-colors focus:border-primary"
                      />
                    </label>
                    <label className="block">
                      <span className="mb-1 block font-head text-[11px] font-semibold text-foreground">
                        {t('privacy_cloud_model_label')}
                      </span>
                      <input
                        type="text"
                        value={cloudModel}
                        onChange={(event) => setCloudModel(event.target.value)}
                        aria-label={t('privacy_cloud_model_label')}
                        className="w-full rounded border-2 border-border bg-background px-3 py-2 text-sm text-foreground outline-none transition-colors focus:border-primary"
                      />
                    </label>
                    <p className="text-[11px] leading-relaxed text-muted-foreground">
                      {t('privacy_cloud_storage_note')}
                    </p>
                  </div>

                  <div className="rounded border-2 border-border bg-secondary p-3">
                    <h4 className="flex items-center gap-2 font-head text-xs font-bold uppercase text-foreground">
                      <KeyRound className="h-3.5 w-3.5 text-[var(--ui-primary)]" />
                      {t('privacy_cloud_connection_actions')}
                    </h4>
                    <div className="mt-3 flex flex-col gap-2">
                      <Button
                        type="button"
                        onClick={handleTestCloudConnection}
                        disabled={cloudActionState !== 'idle'}
                        variant="outline"
                        size="sm"
                        className="w-full bg-card text-xs"
                      >
                        {cloudActionState === 'testing' ? t('privacy_cloud_testing') : t('privacy_cloud_test_cta')}
                      </Button>
                      <Button
                        type="button"
                        onClick={handleSaveCloudConfig}
                        disabled={cloudActionState !== 'idle' || !cloudApiKey.trim()}
                        size="sm"
                        className="w-full text-xs"
                      >
                        {cloudActionState === 'saving' ? t('privacy_cloud_saving') : t('privacy_cloud_save_cta')}
                      </Button>
                      {cloudStatus.configured && (
                        <Button
                          type="button"
                          onClick={handleClearCloudConfig}
                          disabled={cloudActionState !== 'idle'}
                          variant="outline"
                          size="sm"
                          className="w-full border-[var(--ui-danger)] bg-card text-xs text-[var(--ui-danger)] hover:bg-[var(--ui-danger-soft)]"
                        >
                          {cloudActionState === 'clearing' ? t('privacy_cloud_clearing') : t('privacy_cloud_clear_cta')}
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'diagnostics' && (
            <div className="space-y-5 animate-in slide-in-from-right-2 duration-300">
              <div className="rounded border-2 border-border bg-secondary p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded border-2 border-border bg-primary">
                      <Activity className="h-4 w-4 text-primary-foreground" />
                    </div>
                    <div>
                      <h3 className="font-head text-sm font-bold text-foreground">{t('diagnostics_title')}</h3>
                      <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                        {t('diagnostics_description')}
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      onClick={() => void refreshDiagnostics()}
                      disabled={diagnosticActionState === 'loading'}
                      variant="outline"
                      size="sm"
                      className="gap-2 bg-card text-xs"
                    >
                      <RefreshCw className="h-3.5 w-3.5" />
                      {t('diagnostics_refresh')}
                    </Button>
                    <Button
                      type="button"
                      onClick={() => void handleCopyDiagnosticSummary()}
                      disabled={!diagnosticSnapshot}
                      variant="outline"
                      size="sm"
                      className="gap-2 bg-card text-xs"
                    >
                      <ClipboardList className="h-3.5 w-3.5" />
                      {t('diagnostics_copy_summary')}
                    </Button>
                    <Button
                      type="button"
                      onClick={() => void handleClearDiagnosticEvents()}
                      disabled={!diagnosticSnapshot}
                      variant="outline"
                      size="sm"
                      className="gap-2 bg-card text-xs"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      {t('diagnostics_clear_events')}
                    </Button>
                    <Button
                      type="button"
                      onClick={() => void handleExportDiagnostics()}
                      disabled={diagnosticActionState === 'exporting'}
                      size="sm"
                      className="gap-2 text-xs"
                    >
                      <Download className="h-3.5 w-3.5" />
                      {diagnosticActionState === 'exporting' ? t('diagnostics_exporting') : t('diagnostics_export_bundle')}
                    </Button>
                  </div>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-4">
                <div className="rounded-xl border border-[var(--ui-border)] bg-[var(--ui-surface-muted)] p-3">
                  <div className="text-[11px] font-semibold uppercase text-gray-500 dark:text-gray-400">{t('diagnostics_events')}</div>
                  <div className="mt-1 text-lg font-bold text-gray-900 dark:text-gray-100">
                    {(diagnosticSnapshot?.recentFrontendEvents.length ?? 0).toLocaleString()}
                  </div>
                </div>
                <div className="rounded-xl border border-[var(--ui-border)] bg-[var(--ui-surface-muted)] p-3">
                  <div className="text-[11px] font-semibold uppercase text-gray-500 dark:text-gray-400">{t('diagnostics_watch_roots')}</div>
                  <div className="mt-1 text-lg font-bold text-gray-900 dark:text-gray-100">
                    {(diagnosticSnapshot?.activeWatchRoots.length ?? 0).toLocaleString()}
                  </div>
                </div>
                <div className="rounded-xl border border-[var(--ui-border)] bg-[var(--ui-surface-muted)] p-3">
                  <div className="text-[11px] font-semibold uppercase text-gray-500 dark:text-gray-400">{t('diagnostics_native_logs')}</div>
                  <div className="mt-1 text-lg font-bold text-gray-900 dark:text-gray-100">
                    {(diagnosticSnapshot?.nativeLogFiles?.length ?? 0).toLocaleString()}
                  </div>
                </div>
                <div className="rounded-xl border border-[var(--ui-border)] bg-[var(--ui-surface-muted)] p-3">
                  <div className="text-[11px] font-semibold uppercase text-gray-500 dark:text-gray-400">{t('diagnostics_log_path')}</div>
                  <div className="mt-1 truncate text-xs font-semibold text-gray-900 dark:text-gray-100">
                    {diagnosticSnapshot?.logFilePath ?? t('diagnostics_not_available')}
                  </div>
                </div>
              </div>

              <div className="rounded-xl border border-[var(--ui-border)] bg-[var(--ui-surface)]">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--ui-border)] p-3">
                  <div className="text-sm font-bold text-gray-900 dark:text-gray-100">{t('diagnostics_recent_events')}</div>
                  <div className="flex gap-2">
                    <select
                      value={diagnosticLevelFilter}
                      onChange={(event) => setDiagnosticLevelFilter(event.target.value)}
                      className="rounded-lg border border-[var(--ui-border)] bg-[var(--ui-surface)] px-2 py-1.5 text-xs text-gray-700 dark:text-gray-200"
                      aria-label={t('diagnostics_filter_level')}
                    >
                      {['all', 'debug', 'info', 'warn', 'error'].map((level) => (
                        <option key={level} value={level}>{level}</option>
                      ))}
                    </select>
                    <select
                      value={diagnosticAreaFilter}
                      onChange={(event) => setDiagnosticAreaFilter(event.target.value)}
                      className="rounded-lg border border-[var(--ui-border)] bg-[var(--ui-surface)] px-2 py-1.5 text-xs text-gray-700 dark:text-gray-200"
                      aria-label={t('diagnostics_filter_area')}
                    >
                      {['all', 'app', 'watch', 'scan', 'indexing', 'search', 'tray', 'tree', 'settings', 'cloud', 'ui'].map((area) => (
                        <option key={area} value={area}>{area}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="max-h-64 overflow-y-auto">
                  {(diagnosticSnapshot?.recentFrontendEvents ?? [])
                    .filter((event) => diagnosticLevelFilter === 'all' || event.level === diagnosticLevelFilter)
                    .filter((event) => diagnosticAreaFilter === 'all' || event.area === diagnosticAreaFilter)
                    .slice()
                    .reverse()
                    .map((event) => (
                      <div key={event.id} className="border-b border-[var(--ui-border)] px-3 py-2 last:border-b-0">
                        <div className="flex flex-wrap items-center gap-2 text-[11px]">
                          <span className="rounded border border-[var(--ui-border)] px-1.5 py-0.5 font-bold uppercase text-gray-600 dark:text-gray-300">{event.level}</span>
                          <span className="rounded border border-[var(--ui-border)] px-1.5 py-0.5 font-bold text-[var(--ui-primary)]">{event.area}</span>
                          <span className="font-mono text-gray-500 dark:text-gray-400">{event.event}</span>
                        </div>
                        <div className="mt-1 text-xs font-medium text-gray-900 dark:text-gray-100">{event.message}</div>
                        {(event.path || event.correlationId) && (
                          <div className="mt-1 truncate font-mono text-[11px] text-gray-500 dark:text-gray-400">
                            {event.correlationId ? `${event.correlationId} · ` : ''}{event.path}
                          </div>
                        )}
                      </div>
                    ))}
                  {(diagnosticSnapshot?.recentFrontendEvents.length ?? 0) === 0 && (
                    <div className="px-3 py-8 text-center text-xs text-gray-500 dark:text-gray-400">
                      {t('diagnostics_empty')}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
