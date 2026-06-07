'use client';

import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import {
  findWatchedFolderForPath,
  normalizeWatchedEventPath,
  resolveWatchedFileMetadata,
  shouldResetPageForWatchedAddition,
} from '@/lib/file-system/watch-events';
import {
  buildNativeWatchSyncSnapshot,
  inspectNativeWatchedFolders,
  mergeWatchedFolderSnapshots,
  shouldSyncNativeWatchedFolders,
  syncNativeWatchedFolders,
} from '@/lib/file-system/watched-folders-sync';
import { searchFiles } from '@/lib/search/engine';
import { invoke } from '@tauri-apps/api/core';
import { emitTo, listen } from '@tauri-apps/api/event';
import { open } from '@tauri-apps/plugin-dialog';
import { getCurrentWebviewWindow, WebviewWindow } from '@tauri-apps/api/webviewWindow';
import {
  deleteFile,
  deleteWorkspaceAiSummary,
  getAllFiles,
  getFile,
  getWatchedFolders,
  getWorkspaceAiSummary,
  removeWatchedFolder,
  saveWatchedFolder,
  setWatchedFolderEnabled,
  setWatchedFolderStatus,
  storeWorkspaceAiSummary,
  toggleFileStar,
} from '@/lib/file-system/db';
import { SearchInput, type SearchRequest } from '@/components/search/search-input';
import { Button } from '@/components/retroui/Button';
import { ResizableLayout } from '@/components/layout/resizable-layout';
import { FileListItem } from '@/components/file-viewer/file-list-item';
import { ProgressBar } from '@/components/ui/progress-bar';
import { FilePreviewPanel } from '@/components/file-viewer/file-preview-panel';
import { Pagination } from '@/components/ui/pagination';
import { FilterSection } from '@/components/sidebar/filter-section';
import { FolderOpen, FileText, FileCode, Image as ImageIcon, ArrowUpDown, Star, HelpCircle, Globe2, Moon, Sun, Archive, Video } from 'lucide-react';

import { useToast } from '@/components/ui/toast';
import { SettingsModal } from '@/components/settings/settings-modal';
import { QuickLookModal } from '@/components/file-viewer/quick-look-modal';
import { Settings, LayoutGrid, List, FolderTree as FolderTreeIcon } from 'lucide-react';
import { FirstVisitTour } from '@/components/onboarding/first-visit-tour';
import { StarterScanModal } from '@/components/onboarding/starter-scan-modal';
import { WorkInboxPanel } from '@/components/folder-intelligence/work-inbox-panel';
import { WorkspaceDrillInModal } from '@/components/folder-intelligence/workspace-drill-in-modal';
import { useTranslation } from '@/lib/i18n';
import { useTheme } from '@/lib/theme-provider';
import { FileGridItem } from '@/components/file-viewer/file-grid-item';
import { extractUniqueTags, filterFiles, paginateFiles, sortFiles } from '@/lib/file-browser/utils';
import { buildTreeView, getTreeAutoExpandedPaths } from '@/lib/file-browser/tree-view';
import { TreeView } from '@/components/file-viewer/tree-view';
import { logEvent, logFrontendMessage } from '@/lib/telemetry/logger';
import { createAsyncUnlistenGuard } from '@/lib/tauri/async-unlisten-guard';
import { getIndexingCoordinator } from '@/lib/file-system/indexing-coordinator';
import {
  createEmptyScanSessionProgress,
  isScanSessionActive,
  type NativeScanSessionEvent,
} from '@/lib/file-system/scan-session';
import {
  createTrayActivityComplete,
  createTrayActivityDetected,
  createTrayActivityIndexing,
  shouldShowTrayActivityForWatchEvent,
  TRAY_ACTIVITY_EVENT,
  type TrayActivityEventPayload,
} from '@/lib/tray-activity/state';
import { classifyFile, type FileTypeFilterId } from '@/lib/file-browser/classification';
import {
  normalizeStarterScanSuggestions,
  shouldPromptForStarterScan,
  STARTER_SCAN_COMPLETED_KEY,
  type StarterScanSuggestion,
} from '@/lib/onboarding/starter-scan';
import { buildFolderInsights } from '@/lib/folder-intelligence/workspaces';
import { buildWorkInboxItems, getWorkspaceOpenNowItemId } from '@/lib/work-inbox/items';
import {
  dismissWorkInboxItem,
  getWorkInboxActivity,
  recordWorkInboxOpenFile,
  recordWorkInboxVisit,
  recordWorkInboxWorkspaceVisit,
  resetDismissedWorkInboxItems,
  togglePinnedInboxItem,
  type WorkInboxActivitySnapshot,
} from '@/lib/work-inbox/activity';
import {
  applyFolderInsightAiSummary,
  buildFolderInsightSummaryFingerprint,
  requestFolderInsightAiSummary,
  type FolderInsightAiSummary,
} from '@/lib/folder-intelligence/ai';
import {
  clearCloudIntelligenceConfig,
  DEFAULT_CLOUD_INTELLIGENCE_MODEL,
  getCloudIntelligenceStatus,
  getCloudIntelligenceEnabled,
  isCloudIntelligenceReady,
  saveCloudIntelligenceConfig,
  setCloudIntelligenceEnabled,
  testCloudIntelligenceConnection,
  type CloudIntelligenceStatus,
  type SaveCloudIntelligenceConfigInput,
  type TestCloudIntelligenceConnectionInput,
} from '@/lib/settings/cloud-intelligence';

const ITEMS_PER_PAGE = 20;

const FILE_TYPE_GROUP_ORDER = [
  'documents',
  'code',
  'images',
  'media',
  'archives',
  'other',
] as const;

const FILE_TYPE_GROUP_CONFIG = {
  documents: { labelKey: 'file_type_documents', icon: FileText },
  code: { labelKey: 'file_type_code', icon: FileCode },
  images: { labelKey: 'file_type_images', icon: ImageIcon },
  media: { labelKey: 'file_type_media', icon: Video },
  archives: { labelKey: 'file_type_archives', icon: Archive },
  other: { labelKey: 'file_type_other', icon: FolderOpen },
} as const;

const FILE_TYPE_SUBTYPE_LABELS: Record<string, string> = {
  pdf: 'file_subtype_pdf',
  word: 'file_subtype_word',
  text: 'file_subtype_text',
  spreadsheet: 'file_subtype_spreadsheet',
  presentation: 'file_subtype_presentation',
  javascript: 'file_subtype_javascript',
  json: 'file_subtype_json',
  web: 'file_subtype_web',
  python: 'file_subtype_python',
  config: 'file_subtype_config',
  raster: 'file_subtype_raster',
  vector: 'file_subtype_vector',
  gif: 'file_subtype_gif',
  audio: 'file_subtype_audio',
  video: 'file_subtype_video',
  archive: 'file_subtype_archive',
  other: 'file_subtype_other',
};

interface FolderInsightAiCacheEntry {
  fingerprint: string;
  status: 'generating' | 'ready' | 'failed';
  summary?: FolderInsightAiSummary;
  updatedAt?: number;
  error?: string;
}

function normalizeWorkspacePath(path: string) {
  return path.replace(/\\/g, '/').toLowerCase();
}

function isFileInWorkspace(filePath: string, workspacePath: string) {
  const normalizedFilePath = normalizeWorkspacePath(filePath);
  const normalizedWorkspacePath = normalizeWorkspacePath(workspacePath);
  return normalizedFilePath.startsWith(`${normalizedWorkspacePath}/`);
}

export default function Home() {
  const { toast } = useToast();
  const { t, language, setLanguage } = useTranslation();
  const { theme, setTheme } = useTheme();
  const indexingCoordinator = useMemo(() => getIndexingCoordinator(), []);

  // --- State ---
  const [viewMode, setViewMode] = useState<'list'|'grid'|'tree'>('list');
  const [files, setFiles] = useState<any[]>([]);
  const [selectedFile, setSelectedFile] = useState<any | null>(null);
  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState<string | null>(null);
  const [isQuickLookOpen, setIsQuickLookOpen] = useState(false);

  // Scanning
  const [isScanning, setIsScanning] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [scanProgress, setScanProgress] = useState(() => createEmptyScanSessionProgress());

  // Ref to track pause state immediately in loop without dependency closure issues
  const isPausedRef = useRef(false);
  const activeForegroundScanIdRef = useRef<string | null>(null);
  const pendingStarterCompletionRef = useRef(false);

  // Drop zone
  const [isDragOver, setIsDragOver] = useState(false);

  // Search
  const [isSearching, setIsSearching] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const searchQueryRef = useRef('');
  const searchRequestIdRef = useRef(0);
  const pendingFileUpdatesRef = useRef(new Map<string, any>());
  const flushFileUpdatesTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Filters
  const [activeFilters, setActiveFilters] = useState<{
    types: FileTypeFilterId[];
    date: string;
    size: string[];
    tags: string[];
    favorites: boolean;
  }>({
    types: [],
    date: 'any',
    size: [],
    tags: [],
    favorites: false
  });

  // Sorting
  const [sortBy, setSortBy] = useState<'date' | 'size' | 'name' | 'relevance'>('date');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Settings
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isTourOpen, setIsTourOpen] = useState(false);
  const [starterSuggestions, setStarterSuggestions] = useState<StarterScanSuggestion[]>([]);
  const [isStarterScanOpen, setIsStarterScanOpen] = useState(false);
  const [isStarterScanning, setIsStarterScanning] = useState(false);
  const [tourCompletionTick, setTourCompletionTick] = useState(0);
  const [cloudIntelligenceEnabled, setCloudIntelligenceEnabledState] = useState(true);
  const [cloudStatus, setCloudStatus] = useState<CloudIntelligenceStatus>({
    configured: false,
    source: 'none',
    model: DEFAULT_CLOUD_INTELLIGENCE_MODEL,
  });
  const [folderInsightAiCache, setFolderInsightAiCache] = useState<Record<string, FolderInsightAiCacheEntry>>({});
  const [watchedFolders, setWatchedFolders] = useState<any[]>([]);
  const [workInboxActivity, setWorkInboxActivity] = useState<WorkInboxActivitySnapshot>({
    recentFiles: [],
    pinnedItemIds: [],
    dismissedItemKeys: [],
  });
  const pendingFolderInsightAiRef = useRef(new Set<string>());
  const failedFolderInsightAiRef = useRef(new Set<string>());
  const lastRecordedOpenPathRef = useRef<string | null>(null);
  const hasRecordedInboxVisitRef = useRef(false);
  const lastWatchSyncSignatureRef = useRef<string | null>(null);
  const trayActivityCandidatesRef = useRef(new Map<string, { watchLabel?: string }>());

  // --- Effects ---
  // Scroll to top on page change
  useEffect(() => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, [currentPage]);

  useEffect(() => {
    void refreshData();
  }, []);

  useEffect(() => {
    setCloudIntelligenceEnabledState(getCloudIntelligenceEnabled());
    void getCloudIntelligenceStatus()
      .then(setCloudStatus)
      .catch((error) => {
        console.error('Failed to load cloud intelligence status', error);
      });
    setWorkInboxActivity(getWorkInboxActivity());
  }, []);

  useEffect(() => {
    searchQueryRef.current = searchQuery;
  }, [searchQuery]);

  useEffect(() => {
    isPausedRef.current = isPaused;
  }, [isPaused]);

  const refreshData = useCallback(async () => {
    pendingFileUpdatesRef.current.clear();
    if (flushFileUpdatesTimerRef.current) {
      clearTimeout(flushFileUpdatesTimerRef.current);
      flushFileUpdatesTimerRef.current = null;
    }
    const all = await getAllFiles();
    setFiles(all);
  }, []);

  const refreshWatchedFolders = useCallback(async () => {
    const localFolders = await getWatchedFolders();
    const nativeSnapshot = await inspectNativeWatchedFolders().catch(() => null);
    setWatchedFolders(mergeWatchedFolderSnapshots(localFolders, nativeSnapshot));
  }, []);

  const flushBufferedFileUpdates = useCallback(() => {
    if (flushFileUpdatesTimerRef.current) {
      clearTimeout(flushFileUpdatesTimerRef.current);
      flushFileUpdatesTimerRef.current = null;
    }

    const updates = Array.from(pendingFileUpdatesRef.current.values());
    if (updates.length === 0) {
      return;
    }

    pendingFileUpdatesRef.current.clear();
    setFiles((prev) => {
      const nextByPath = new Map(prev.map((file) => [file.path, file]));
      for (const update of updates) {
        const existing = nextByPath.get(update.path);
        nextByPath.set(update.path, existing ? { ...existing, ...update } : update);
      }
      return Array.from(nextByPath.values());
    });
  }, []);

  const enqueueFileUpdate = useCallback((file: any) => {
    const existing = pendingFileUpdatesRef.current.get(file.path) ?? {};
    pendingFileUpdatesRef.current.set(file.path, { ...existing, ...file });

    if (!flushFileUpdatesTimerRef.current) {
      flushFileUpdatesTimerRef.current = setTimeout(() => {
        flushBufferedFileUpdates();
      }, 48);
    }
  }, [flushBufferedFileUpdates]);

  const getWatchFolderLabel = useCallback((path?: string) => {
    if (!path) {
      return undefined;
    }

    const segments = path.split(/[\\/]/).filter(Boolean);
    return segments.at(-1) || path;
  }, []);

  const isMainWindowVisible = useCallback(async () => {
    try {
      return await getCurrentWebviewWindow().isVisible();
    } catch {
      return true;
    }
  }, []);

  const emitTrayActivity = useCallback(async (activity: TrayActivityEventPayload['activity']) => {
    try {
      await emitTo('tray-activity', TRAY_ACTIVITY_EVENT, { activity });

      if (!activity) {
        const trayWindow = await WebviewWindow.getByLabel('tray-activity');
        await trayWindow?.hide().catch(() => undefined);
      }
    } catch (error) {
      console.warn('Failed to update tray activity window', error);
    }
  }, []);

  useEffect(() => {
    const unlistenGuard = createAsyncUnlistenGuard();

    const setup = async () => {
      try {
        const appWindow = getCurrentWebviewWindow();
        unlistenGuard.add(
          await appWindow.onFocusChanged(({ payload: focused }) => {
            if (focused) {
              void emitTrayActivity(null);
            }
          })
        );
      } catch (error) {
        console.warn('Failed to subscribe to main-window focus changes', error);
      }
    };

    void setup();

    return () => {
      unlistenGuard.cleanup();
    };
  }, [emitTrayActivity]);

  useEffect(() => {
    return () => {
      if (flushFileUpdatesTimerRef.current) {
        clearTimeout(flushFileUpdatesTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    const unsubscribe = indexingCoordinator.subscribe((event) => {
      if (event.type === 'file-updated') {
        setSelectedFile((prev: any) => prev?.path === event.file.path ? { ...prev, ...event.file } : prev);
        if (!searchQuery.trim()) {
          enqueueFileUpdate(event.file);
        }

        const trayCandidate = trayActivityCandidatesRef.current.get(event.file.path);
        if (trayCandidate && event.file.processingStatus === 'completed') {
          trayActivityCandidatesRef.current.delete(event.file.path);
          void emitTrayActivity(
            createTrayActivityComplete({
              path: event.file.path,
              completedAt: Date.now(),
              hideDelayMs: 2200,
            })
          );
        }

        if (trayCandidate && event.file.processingStatus === 'failed') {
          trayActivityCandidatesRef.current.delete(event.file.path);
          void emitTrayActivity(null);
        }
      }

      if (event.type === 'scan-progress') {
        const { progress } = event;
        if (progress.scope === 'background') {
          const trayCandidate = progress.currentPath
            ? trayActivityCandidatesRef.current.get(progress.currentPath)
            : undefined;

          if (trayCandidate && progress.currentPath) {
            void emitTrayActivity(
              createTrayActivityIndexing({
                path: progress.currentPath,
                processedCount: progress.processedCount,
                totalKnownCount: progress.totalKnownCount,
                watchLabel: trayCandidate.watchLabel,
                detectedAt: Date.now(),
              })
            );
          }
          return;
        }

        if (progress.scope !== 'foreground') {
          return;
        }

        if (activeForegroundScanIdRef.current && progress.sessionId !== activeForegroundScanIdRef.current) {
          return;
        }

        setIsScanning(isScanSessionActive(progress));
        setIsPaused(progress.isPaused);
        setScanProgress(progress);
      }

      if (event.type === 'scan-complete') {
        const { progress } = event;
        if (progress.scope !== 'foreground') {
          return;
        }

        if (activeForegroundScanIdRef.current && progress.sessionId !== activeForegroundScanIdRef.current) {
          return;
        }

        activeForegroundScanIdRef.current = null;
        setIsScanning(false);
        setIsPaused(false);
        setIsStarterScanning(false);
        setScanProgress(progress);
        void refreshWatchedFolders();
        if (pendingStarterCompletionRef.current) {
          localStorage.setItem(STARTER_SCAN_COMPLETED_KEY, 'true');
          pendingStarterCompletionRef.current = false;
        }
        toast(t('scan_completed'), 'success');
      }
    });

    return unsubscribe;
  }, [emitTrayActivity, enqueueFileUpdate, indexingCoordinator, isMainWindowVisible, refreshWatchedFolders, searchQuery, t, toast]);

  useEffect(() => {
    const unlistenGuard = createAsyncUnlistenGuard();

    const setupListener = async () => {
      try {
        unlistenGuard.add(
          await listen<NativeScanSessionEvent>('scan-session-event', async (event) => {
            const payload = event.payload;
            if (payload.scope !== 'foreground') {
              return;
            }

            if (payload.eventType === 'started') {
              activeForegroundScanIdRef.current = payload.sessionId;
              indexingCoordinator.startSession(payload.sessionId, {
                scope: 'foreground',
                watchPath: payload.watchPath,
              });
              setIsScanning(true);
              setIsPaused(false);
              setScanProgress({
                ...createEmptyScanSessionProgress(payload.sessionId, 'foreground'),
                currentPath: payload.currentPath ?? '',
                watchPath: payload.watchPath,
              });
              return;
            }

            if (payload.eventType === 'batch') {
              await indexingCoordinator.appendDiscoveredFiles(payload.sessionId, payload.batch ?? [], {
                scope: 'foreground',
                watchPath: payload.watchPath,
              });
              return;
            }

            if (payload.eventType === 'completed') {
              indexingCoordinator.completeDiscovery(payload.sessionId);
              await refreshWatchedFolders();
              return;
            }

            if (payload.eventType === 'error' || payload.eventType === 'cancelled') {
              activeForegroundScanIdRef.current = null;
              indexingCoordinator.failSession(payload.sessionId, payload.currentPath ?? '', payload.error);
              setIsScanning(false);
              setIsPaused(false);
              setIsStarterScanning(false);
              pendingStarterCompletionRef.current = false;
              await refreshWatchedFolders();
              toast(t('scan_failed'), 'error');
            }
          })
        );
      } catch (error) {
        console.warn('Failed to subscribe to native scan-session events', error);
      }
    };

    void setupListener();

    return () => {
      unlistenGuard.cleanup();
    };
  }, [indexingCoordinator, refreshWatchedFolders, t, toast]);

  // Background File Watcher Listener
  useEffect(() => {
    const unlistenGuard = createAsyncUnlistenGuard();
    
    const setupListener = async () => {
      try {
        unlistenGuard.add(
          await listen<{ kind: string; path: string }>('sys-file-event', async (event) => {
            const { kind, path } = event.payload;
            const normalizedPath = normalizeWatchedEventPath(path);
            const mainVisible = await isMainWindowVisible();
            const correlationId = `watch:${normalizedPath}:${Date.now()}`;
            console.info('[watch] received native file event', {
              kind,
              path,
              normalizedPath,
              mainVisible,
            });
            void logEvent({
              level: 'info',
              area: 'watch',
              event: 'native-event.received',
              message: `Received ${kind} event from native watcher`,
              correlationId,
              path: normalizedPath,
              data: { kind, mainVisible, rawPath: path },
            });

            if (kind === 'remove') {
              trayActivityCandidatesRef.current.delete(normalizedPath);
              await deleteFile(normalizedPath);
              setFiles(prev => prev.filter(f => f.path !== normalizedPath));
              // if it was the selected file, deselect it
              setSelectedFile((prev: any) => prev?.path === normalizedPath ? null : prev);
            } else {
              // create, modify, rename
              try {
                const existingFile = await getFile(normalizedPath);
                const meta = await resolveWatchedFileMetadata(normalizedPath);
                const watchedFolder = findWatchedFolderForPath(normalizedPath, watchedFolders);
                const isNewWatchedAddition = shouldResetPageForWatchedAddition(existingFile);
                const shouldShowTrayActivity = shouldShowTrayActivityForWatchEvent({
                  isNewWatchedAddition,
                  isMainWindowVisible: mainVisible,
                });
                console.info('[watch] resolved file metadata for indexing', {
                  path: normalizedPath,
                  watchedFolder: watchedFolder?.path,
                  size: meta.size,
                  lastModified: meta.lastModified,
                });
                void logEvent({
                  level: 'info',
                  area: 'watch',
                  event: 'metadata.resolved',
                  message: 'Resolved watched file metadata',
                  correlationId,
                  path: normalizedPath,
                  data: {
                    watchedFolder: watchedFolder?.path,
                    size: meta.size,
                    lastModified: meta.lastModified,
                    isNewWatchedAddition,
                  },
                });
                if (shouldShowTrayActivity) {
                  const watchLabel = getWatchFolderLabel(watchedFolder?.path);
                  trayActivityCandidatesRef.current.set(normalizedPath, { watchLabel });
                  void emitTrayActivity(
                    createTrayActivityDetected({
                      path: normalizedPath,
                      watchLabel,
                      detectedAt: Date.now(),
                    })
                  );
                }
                await indexingCoordinator.enqueue([meta], {
                  scope: 'background',
                  watchPath: watchedFolder?.path,
                });
                console.info('[watch] enqueued file for background indexing', {
                  path: normalizedPath,
                  watchedFolder: watchedFolder?.path,
                });
                void logEvent({
                  level: 'info',
                  area: 'watch',
                  event: 'indexing.enqueued',
                  message: 'Enqueued watched file for background indexing',
                  correlationId,
                  path: normalizedPath,
                  data: { watchedFolder: watchedFolder?.path },
                });
                if (isNewWatchedAddition) {
                  setCurrentPage(1);
                }
              } catch (e) {
                trayActivityCandidatesRef.current.delete(normalizedPath);
                console.error('[watch] failed to process background file change', {
                  path: normalizedPath,
                  kind,
                  error: e,
                });
                void logEvent({
                  level: 'error',
                  area: 'watch',
                  event: 'event.failed',
                  message: 'Failed to process background file change',
                  correlationId,
                  path: normalizedPath,
                  error: e instanceof Error ? e.message : String(e),
                  data: { kind },
                });
              }
            }
          })
        );
      } catch (error) {
        console.warn('Failed to subscribe to native file events', error);
      }
    };

    void setupListener();

    return () => {
      unlistenGuard.cleanup();
    };
  }, [getWatchFolderLabel, indexingCoordinator, isMainWindowVisible, watchedFolders]);

  // Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const activeTag = (e.target as HTMLElement).tagName;
      const isInputFocused = ['INPUT', 'TEXTAREA'].includes(activeTag);
      
      // Spacebar for Quick Look
      if (e.key === ' ' && !isInputFocused) {
        e.preventDefault();
        setIsQuickLookOpen(prev => !prev);
      }
      
      // Focus search on '/' or 'Cmd+K' or 'Alt+K' or 'Ctrl+K'
      if ((e.key === '/' && !isInputFocused) ||
        ((e.metaKey || e.altKey || e.ctrlKey) && e.key === 'k')) {
        e.preventDefault();
        document.querySelector<HTMLInputElement>('input[type="search"]')?.focus();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // --- Logic ---
  useEffect(() => {
    void refreshWatchedFolders();
  }, [refreshWatchedFolders]);

  useEffect(() => {
    if (watchedFolders.length === 0) {
      lastWatchSyncSignatureRef.current = null;
      return;
    }

    const syncWatchers = async () => {
      const desiredSnapshot = buildNativeWatchSyncSnapshot(watchedFolders);
      const desiredSignature = JSON.stringify(desiredSnapshot);

      try {
        const snapshot = await inspectNativeWatchedFolders();

        if (snapshot && !shouldSyncNativeWatchedFolders(watchedFolders, snapshot)) {
          lastWatchSyncSignatureRef.current = desiredSignature;
          if (snapshot.activeRoots.length === 0 && watchedFolders.some((folder) => folder.enabled)) {
            toast('Watched folders are saved, but no native watch roots are active yet.', 'warning');
          }
          return;
        }

        if (!snapshot && lastWatchSyncSignatureRef.current === desiredSignature) {
          return;
        }

        await syncNativeWatchedFolders(watchedFolders);
        lastWatchSyncSignatureRef.current = desiredSignature;
        const syncedSnapshot = await inspectNativeWatchedFolders();
        if (!syncedSnapshot) {
          void logFrontendMessage(
            'warn',
            'native watch-state inspection is unavailable in the running desktop binary',
            'watch-sync'
          );
          return;
        }
        void logFrontendMessage(
          'info',
          `synced watched folders to native registry: local=${watchedFolders.length} native=${syncedSnapshot.watchedFolders.length} activeRoots=${syncedSnapshot.activeRoots.length}`,
          'watch-sync'
        );
        if (syncedSnapshot.activeRoots.length === 0 && watchedFolders.some((folder) => folder.enabled)) {
          toast('Watched folders are saved, but no native watch roots are active yet.', 'warning');
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.error('Failed to sync watched folders to native registry', error);
        void logFrontendMessage('error', message, 'watch-sync');
        toast('Failed to sync watched folders to the native watcher.', 'error');
      }
    };

    void syncWatchers();
  }, [toast, watchedFolders]);

  const loadStarterSuggestions = useCallback(async () => {
    try {
      const suggestions = normalizeStarterScanSuggestions(
        await invoke<StarterScanSuggestion[]>('get_recommended_scan_directories')
      );
      setStarterSuggestions(suggestions);
      return suggestions;
    } catch (error) {
      console.error('Failed to load starter scan suggestions', error);
      toast(t('starter_scan_recommendations_failed'), 'error');
      return [];
    }
  }, [t, toast]);

  useEffect(() => {
    const hasCompletedStarterScan = localStorage.getItem(STARTER_SCAN_COMPLETED_KEY) === 'true';
    const hasCompletedOnboarding = localStorage.getItem('sfe_onboarded') === 'true';

    if (hasCompletedStarterScan || !hasCompletedOnboarding) {
      return;
    }

    void loadStarterSuggestions().then((suggestions) => {
      if (
        shouldPromptForStarterScan({
          hasCompletedStarterScan,
          indexedFileCount: files.length,
          suggestions,
        })
      ) {
        setIsStarterScanOpen(true);
      }
    });
  }, [files.length, loadStarterSuggestions, tourCompletionTick]);

  const startScanForDirectories = useCallback(async (dirPaths: string[], options?: { markStarterComplete?: boolean }) => {
    const uniqueDirectories = Array.from(new Set(dirPaths.map((path) => path.trim()).filter(Boolean)));
    if (uniqueDirectories.length === 0) {
      return;
    }

    const markStarterComplete = options?.markStarterComplete ?? true;

    try {
      const scanStartedAt = Date.now();
      await Promise.all(
        uniqueDirectories.map((path) =>
          saveWatchedFolder({
            path,
            enabled: true,
            status: 'indexing',
            lastScanStartedAt: scanStartedAt,
          })
        )
      );
      await refreshWatchedFolders();
      setIsScanning(true);
      setIsPaused(false);
      setIsStarterScanning(markStarterComplete);
      setIsStarterScanOpen(false);
      pendingStarterCompletionRef.current = markStarterComplete;
      setScanProgress({
        ...createEmptyScanSessionProgress('', 'foreground'),
        currentPath: t('scan_discovering'),
      });

      const sessionId = await invoke<string>('start_scan_session', { dirPaths: uniqueDirectories });
      activeForegroundScanIdRef.current = sessionId;
      setScanProgress((prev) => ({
        ...prev,
        sessionId,
      }));
    } catch (error: any) {
      console.error('Tauri scan error:', error);
      await Promise.all(
        uniqueDirectories.map((path) =>
          setWatchedFolderStatus(path, {
            status: 'error',
            lastError: error instanceof Error ? error.message : String(error),
          })
        )
      );
      await refreshWatchedFolders();
      pendingStarterCompletionRef.current = false;
      activeForegroundScanIdRef.current = null;
      setIsScanning(false);
      setIsPaused(false);
      setIsStarterScanning(false);
      toast(t('scan_failed'), 'error');
    }
  }, [refreshWatchedFolders, t, toast]);

  const handleToggleWatchedFolder = useCallback(async (path: string, enabled: boolean) => {
    await setWatchedFolderEnabled(path, enabled);
    await invoke('set_watched_folder_enabled', { path, enabled }).catch((error) => {
      console.error('Failed to update native watched folder', error);
    });
    await setWatchedFolderStatus(path, {
      status: enabled ? 'watching' : 'paused',
      lastError: undefined,
    });
    await refreshWatchedFolders();
  }, [refreshWatchedFolders]);

  const handleRemoveWatchedFolder = useCallback(async (path: string) => {
    await removeWatchedFolder(path);
    await invoke('remove_watched_folder_native', { path }).catch((error) => {
      console.error('Failed to remove native watched folder', error);
    });
    await refreshWatchedFolders();
  }, [refreshWatchedFolders]);

  // Scan a directory by path directly (used by drag-drop)
  const handleScanDirectory = async (dirPath: string) => {
    await startScanForDirectories([dirPath]);
  };

  // Track when we're doing an internal file drag-out
  const isInternalDragRef = useRef(false);

  // Listen for Tauri native drag-drop events (only for external folder drops)
  useEffect(() => {
    let unlisten: (() => void) | undefined;

    // Listen for our own internal drags to ignore them on drop-back
    const handleInternalDragStart = () => { isInternalDragRef.current = true; };
    const handleInternalDragEnd = () => { 
      // Small delay to ensure the drop event fires first
      setTimeout(() => { isInternalDragRef.current = false; }, 200);
    };
    window.addEventListener('dragstart', handleInternalDragStart);
    window.addEventListener('dragend', handleInternalDragEnd);

    const setup = async () => {
      try {
        const appWindow = getCurrentWebviewWindow();
        unlisten = await appWindow.onDragDropEvent(async (event) => {
          // Skip if this is our own file being dragged back in
          if (isInternalDragRef.current) {
            setIsDragOver(false);
            return;
          }

          if (event.payload.type === 'enter' || event.payload.type === 'over') {
            setIsDragOver(true);
          } else if (event.payload.type === 'leave') {
            setIsDragOver(false);
          } else if (event.payload.type === 'drop') {
            setIsDragOver(false);
            const paths = event.payload.paths;
            if (paths && paths.length > 0) {
              void startScanForDirectories(paths);
            }
          }
        });
      } catch (err) {
        console.warn('Drag-drop listener setup failed:', err);
      }
    };
    setup();
    return () => { 
      if (unlisten) unlisten();
      window.removeEventListener('dragstart', handleInternalDragStart);
      window.removeEventListener('dragend', handleInternalDragEnd);
    };
  }, [startScanForDirectories]);

  const handleSelectFolder = async () => {
    try {
      const selected = await open({
        directory: true,
        multiple: true,
      });
      if (!selected) return;

      const paths = Array.isArray(selected) ? selected : [selected];
      await startScanForDirectories(paths);
    } catch (error: any) {
      console.error('Tauri scan error:', error);
      toast(t('scan_failed'), 'error');
    }
  };

  const handleTogglePause = () => {
    const sessionId = activeForegroundScanIdRef.current;
    const nextPaused = !isPausedRef.current;
    if (nextPaused) {
      indexingCoordinator.pause(sessionId ?? undefined);
    } else {
      indexingCoordinator.resume(sessionId ?? undefined);
    }

    if (sessionId) {
      void invoke('set_scan_session_paused', { sessionId, paused: nextPaused }).catch((error) => {
        console.error('Failed to update native scan session pause state', error);
      });
    }
  };

  const handleSearch = useCallback(async (query: string, request: SearchRequest = { mode: 'semantic', trigger: 'submit' }) => {
    const trimmed = query.trim();
    setSearchQuery(trimmed);

    if (!trimmed) {
      const requestId = ++searchRequestIdRef.current;
      setIsSearching(false);
      await refreshData();
      if (requestId !== searchRequestIdRef.current) {
        return;
      }
      return;
    }

    if (request.mode === 'semantic' && request.trigger === 'change' && isScanning) {
      return;
    }

    const requestId = ++searchRequestIdRef.current;
    setIsSearching(request.mode === 'semantic');
    setSortBy('relevance');
    setSortOrder('desc');

    try {
      const results = await searchFiles(trimmed, {
        useSemantic: request.mode !== 'lexical',
      });
      if (requestId !== searchRequestIdRef.current) {
        return;
      }

      const mapped = results.map(r => ({
        ...r.file,
        score: r.score,
        confidence: r.confidence,
        reasons: r.reasons,
        factors: r.factors,
        snippet: r.snippet,
        locationLabel: r.locationLabel,
        isLikelyLatest: r.isLikelyLatest,
      }));
      setFiles(mapped);
    } catch (error) {
      if (requestId !== searchRequestIdRef.current) {
        return;
      }

      const message = error instanceof Error ? error.message : String(error);
      console.error('Search failed', error);
      void logFrontendMessage('error', message, 'main-search');
      toast(`${t('search_failed')} ${message}`, 'error');
    } finally {
      if (requestId === searchRequestIdRef.current && request.mode === 'semantic') {
        setIsSearching(false);
      }
    }
  }, [isScanning, refreshData, t, toast]);

  const handleIndexCleared = () => {
    setFiles([]);
    setSelectedFile(null);
    setFolderInsightAiCache({});
    toast(t('index_cleared'), 'info');
  };

  const handleCloudIntelligenceEnabledChange = (enabled: boolean) => {
    setCloudIntelligenceEnabled(enabled);
    setCloudIntelligenceEnabledState(enabled);
  };

  const handleSaveCloudConfig = async (input: SaveCloudIntelligenceConfigInput) => {
    try {
      const nextStatus = await saveCloudIntelligenceConfig(input);
      setCloudStatus(nextStatus);
      return nextStatus;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      void logFrontendMessage('error', message, 'page-cloud-save');
      throw error;
    }
  };

  const handleTestCloudConnection = async (input: TestCloudIntelligenceConnectionInput) => {
    try {
      const nextStatus = await testCloudIntelligenceConnection(input);
      setCloudStatus(nextStatus);
      return nextStatus;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      void logFrontendMessage('error', message, 'page-cloud-test');
      throw error;
    }
  };

  const handleClearCloudConfig = async () => {
    try {
      const nextStatus = await clearCloudIntelligenceConfig();
      setCloudStatus(nextStatus);
      setFolderInsightAiCache((prev) => {
        const next = { ...prev };
        for (const key of Object.keys(next)) {
          if (next[key]?.status !== 'ready') {
            delete next[key];
          }
        }
        return next;
      });
      return nextStatus;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      void logFrontendMessage('error', message, 'page-cloud-clear');
      throw error;
    }
  };

  const handleRefreshFolderInsightSummary = async (workspaceId: string) => {
    const insight = folderInsights.find((candidate) => candidate.id === workspaceId);
    if (!insight) {
      return;
    }

    const fingerprint = buildFolderInsightSummaryFingerprint(insight);
    failedFolderInsightAiRef.current.delete(fingerprint);
    pendingFolderInsightAiRef.current.delete(workspaceId);
    await deleteWorkspaceAiSummary(workspaceId);
    setFolderInsightAiCache((prev) => {
      const next = { ...prev };
      delete next[workspaceId];
      return next;
    });

    if (!cloudIntelligenceEnabled) {
      toast(t('privacy_cloud_intelligence_disabled_hint'), 'info');
      return;
    }

    if (!isCloudIntelligenceReady(cloudIntelligenceEnabled, cloudStatus)) {
      setFolderInsightAiCache((prev) => ({
        ...prev,
        [workspaceId]: {
          fingerprint,
          status: 'failed',
          error: cloudStatus.lastError || t('privacy_cloud_status_not_connected'),
        },
      }));
      toast(cloudStatus.lastError || t('privacy_cloud_status_not_connected'), 'info');
      return;
    }

    try {
      setFolderInsightAiCache((prev) => ({
        ...prev,
        [workspaceId]: {
          fingerprint,
          status: 'generating',
        },
      }));
      const summary = await requestFolderInsightAiSummary(insight);
      setFolderInsightAiCache((prev) => ({
        ...prev,
        [workspaceId]: {
          fingerprint,
          status: 'ready',
          summary,
          updatedAt: Date.now(),
        },
      }));
      await storeWorkspaceAiSummary({
        workspaceId,
        fingerprint,
        title: summary.title,
        summary: summary.summary,
        highlights: summary.highlights,
        rationale: summary.rationale,
        model: summary.model,
        updatedAt: Date.now(),
      });
      toast(t('folder_intelligence_refresh_ai_summary'), 'success');
    } catch (error) {
      failedFolderInsightAiRef.current.add(fingerprint);
      console.error('Failed to refresh folder insight with AI', error);
      setFolderInsightAiCache((prev) => ({
        ...prev,
        [workspaceId]: {
          fingerprint,
          status: 'failed',
          error: error instanceof Error ? error.message : String(error),
        },
      }));
      toast(t('search_failed'), 'error');
    }
  };

  const handleToggleStar = async (e: React.MouseEvent, path: string) => {
    e.stopPropagation();
    try {
      const isStarred = await toggleFileStar(path);
      setFiles((prev: any[]) => prev.map(f => f.path === path ? { ...f, isStarred } : f));
      if (selectedFile?.path === path) {
        setSelectedFile((prev: any) => prev ? { ...prev, isStarred } : null);
      }
      toast(isStarred ? t('favorite_added') : t('favorite_removed'), 'success');
    } catch (error) {
      console.error("Failed to toggle star", error);
      toast(t('favorite_failed'), 'error');
    }
  };

  const handleTagsChange = (path: string, newTags: string[]) => {
    setFiles(prev => prev.map(f => f.path === path ? { ...f, tags: newTags } : f));
    if (selectedFile?.path === path) {
      setSelectedFile((prev: any) => prev ? { ...prev, tags: newTags } : null);
    }
  };

  const handleToggleSort = () => {
    setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
  };

  const handleToggleTheme = () => {
    setTheme(theme === 'dark' ? 'light' : 'dark');
  };

  const handleToggleLanguage = () => {
    setLanguage(language === 'vi' ? 'en' : 'vi');
  };

  const folderInsights = useMemo(() => {
    if (searchQuery.trim()) {
      return [];
    }
    return buildFolderInsights(files);
  }, [files, searchQuery]);

  useEffect(() => {
    if (searchQuery.trim() || isScanning || folderInsights.length === 0) {
      return;
    }

    let cancelled = false;

    const enrichTopInsights = async () => {
      for (const insight of folderInsights.slice(0, 3)) {
        const fingerprint = buildFolderInsightSummaryFingerprint(insight);
        const cached = folderInsightAiCache[insight.id];

        if (cached?.fingerprint === fingerprint && cached.status === 'ready') {
          continue;
        }

        const persisted = await getWorkspaceAiSummary(insight.id);
        if (persisted?.fingerprint === fingerprint) {
          if (cancelled) {
            return;
          }

          setFolderInsightAiCache((prev) => ({
            ...prev,
            [insight.id]: {
              fingerprint,
              status: 'ready',
              summary: {
                workspaceId: persisted.workspaceId,
                title: persisted.title,
                summary: persisted.summary,
                highlights: persisted.highlights,
                rationale: persisted.rationale,
                model: persisted.model,
              },
              updatedAt: persisted.updatedAt,
            },
          }));
          continue;
        }

        if (!isCloudIntelligenceReady(cloudIntelligenceEnabled, cloudStatus)) {
          setFolderInsightAiCache((prev) => ({
            ...prev,
            [insight.id]: {
              fingerprint,
              status: 'failed',
              error: !cloudIntelligenceEnabled
                ? t('privacy_cloud_intelligence_disabled_hint')
                : cloudStatus.lastError || t('privacy_cloud_status_not_connected'),
            },
          }));
          continue;
        }

        if (
          pendingFolderInsightAiRef.current.has(insight.id)
          || failedFolderInsightAiRef.current.has(fingerprint)
        ) {
          continue;
        }

        pendingFolderInsightAiRef.current.add(insight.id);

        try {
          setFolderInsightAiCache((prev) => ({
            ...prev,
            [insight.id]: {
              fingerprint,
              status: 'generating',
            },
          }));
          const summary = await requestFolderInsightAiSummary(insight);
          if (cancelled) {
            return;
          }

          setFolderInsightAiCache((prev) => ({
            ...prev,
            [insight.id]: {
              fingerprint,
              status: 'ready',
              summary,
              updatedAt: Date.now(),
            },
          }));
          await storeWorkspaceAiSummary({
            workspaceId: insight.id,
            fingerprint,
            title: summary.title,
            summary: summary.summary,
            highlights: summary.highlights,
            rationale: summary.rationale,
            model: summary.model,
            updatedAt: Date.now(),
          });
        } catch (error) {
          failedFolderInsightAiRef.current.add(fingerprint);
          console.error('Failed to enrich folder insight with AI', error);
          setFolderInsightAiCache((prev) => ({
            ...prev,
            [insight.id]: {
              fingerprint,
              status: 'failed',
              error: error instanceof Error ? error.message : String(error),
            },
          }));
        } finally {
          pendingFolderInsightAiRef.current.delete(insight.id);
        }
      }
    };

    void enrichTopInsights();

    return () => {
      cancelled = true;
    };
  }, [cloudIntelligenceEnabled, cloudStatus, folderInsightAiCache, folderInsights, isScanning, searchQuery, t]);

  const visibleFolderInsights = useMemo(() => (
    folderInsights.map((insight) => {
      const cacheEntry = folderInsightAiCache[insight.id];
      const enriched = applyFolderInsightAiSummary(insight, cacheEntry?.summary);
      return {
        ...enriched,
        summaryState: cacheEntry?.status ?? (!cloudIntelligenceEnabled || isCloudIntelligenceReady(cloudIntelligenceEnabled, cloudStatus) ? 'local' : 'not_connected'),
        summaryUpdatedAt: cacheEntry?.updatedAt,
        summaryError: cacheEntry?.error,
      };
    })
  ), [cloudIntelligenceEnabled, cloudStatus, folderInsightAiCache, folderInsights]);

  const selectedWorkspaceInsight = useMemo(() => (
    selectedWorkspaceId
      ? visibleFolderInsights.find((insight) => insight.id === selectedWorkspaceId) ?? null
      : null
  ), [selectedWorkspaceId, visibleFolderInsights]);

  const selectedWorkspaceTreeNodes = useMemo(() => {
    if (!selectedWorkspaceInsight) {
      return [];
    }

    const workspaceFiles = files.filter((file) => (
      typeof file.path === 'string'
      && isFileInWorkspace(file.path, selectedWorkspaceInsight.path)
    ));

    return buildTreeView(
      workspaceFiles,
      [{ path: selectedWorkspaceInsight.path, enabled: true, status: 'watching' as const }],
      { sortBy, sortOrder },
    );
  }, [files, selectedWorkspaceInsight, sortBy, sortOrder]);

  const workInboxItems = useMemo(() => (
    buildWorkInboxItems(visibleFolderInsights, workInboxActivity)
  ), [visibleFolderInsights, workInboxActivity]);
  const hiddenWorkInboxItemCount = workInboxActivity.dismissedItemKeys.length;

  useEffect(() => {
    if (searchQuery.trim() || workInboxItems.length === 0 || hasRecordedInboxVisitRef.current) {
      return;
    }

    recordWorkInboxVisit();
    hasRecordedInboxVisitRef.current = true;
  }, [searchQuery, workInboxItems.length]);

  useEffect(() => {
    if (!selectedWorkspaceInsight?.id) {
      return;
    }

    const updated = recordWorkInboxWorkspaceVisit(selectedWorkspaceInsight.id);
    setWorkInboxActivity(updated);
  }, [selectedWorkspaceInsight?.id]);

  useEffect(() => {
    if (!selectedFile?.path || lastRecordedOpenPathRef.current === selectedFile.path) {
      return;
    }

    const workspaceMatch = visibleFolderInsights.find((insight) => insight.path === selectedFile.path.replace(/[/\\][^/\\]+$/, ''));
    const updated = recordWorkInboxOpenFile({
      path: selectedFile.path,
      name: selectedFile.name,
      workspaceId: workspaceMatch?.id,
      workspaceTitle: workspaceMatch?.title,
    });
    lastRecordedOpenPathRef.current = selectedFile.path;
    setWorkInboxActivity(updated);
  }, [selectedFile, visibleFolderInsights]);

  const handleDismissWorkInboxItem = (itemKey: string) => {
    const updated = dismissWorkInboxItem(itemKey);
    setWorkInboxActivity(updated);
    toast(t('work_inbox_dismissed'), 'info');
  };

  const handleResetDismissedWorkInboxItems = () => {
    const updated = resetDismissedWorkInboxItems();
    setWorkInboxActivity(updated);
    toast(t('work_inbox_hidden_restored'), 'success');
  };

  const handleTogglePinnedInboxItem = (itemId: string) => {
    const updated = togglePinnedInboxItem(itemId);
    setWorkInboxActivity(updated);
    const isPinned = updated.pinnedItemIds.includes(itemId);
    toast(
      isPinned ? t('work_inbox_pin_success') : t('work_inbox_unpin_success'),
      'success',
      isPinned ? {
        actionLabel: t('undo'),
        onAction: () => {
          const reverted = togglePinnedInboxItem(itemId);
          setWorkInboxActivity(reverted);
        },
      } : undefined,
    );
  };

  // --- Filtering & Sorting ---
  const filteredAndSortedFiles = useMemo(() => {
    return sortFiles(filterFiles(files, activeFilters), sortBy, sortOrder);
  }, [files, activeFilters, sortBy, sortOrder]);

  const isTreeMode = viewMode === 'tree';

  const treeViewNodes = useMemo(() => {
    return buildTreeView(filteredAndSortedFiles, watchedFolders, {
      sortBy,
      sortOrder,
    });
  }, [filteredAndSortedFiles, watchedFolders, sortBy, sortOrder]);

  useEffect(() => {
    if (!isTreeMode) {
      return;
    }

    void logEvent({
      level: 'debug',
      area: 'tree',
      event: 'tree.built',
      message: 'Built tree view nodes',
      data: {
        rootCount: treeViewNodes.length,
        visibleFileCount: filteredAndSortedFiles.length,
        watchedFolderCount: watchedFolders.length,
      },
    });
  }, [filteredAndSortedFiles.length, isTreeMode, treeViewNodes.length, watchedFolders.length]);
  const treeAutoExpandedPaths = useMemo(() => {
    if (!searchQuery.trim()) {
      return [];
    }

    return getTreeAutoExpandedPaths(filteredAndSortedFiles, watchedFolders);
  }, [filteredAndSortedFiles, searchQuery, watchedFolders]);

  // Pagination
  useEffect(() => {
    setCurrentPage(1);
  }, [activeFilters, searchQuery, sortBy, sortOrder]);

  useEffect(() => {
    const nextTotalPages = Math.max(1, Math.ceil(filteredAndSortedFiles.length / ITEMS_PER_PAGE));
    setCurrentPage((prev) => Math.min(prev, nextTotalPages));
  }, [filteredAndSortedFiles.length]);

  const paginatedFiles = useMemo(() => {
    return paginateFiles(filteredAndSortedFiles, currentPage, ITEMS_PER_PAGE);
  }, [filteredAndSortedFiles, currentPage]);

  const totalPages = Math.ceil(filteredAndSortedFiles.length / ITEMS_PER_PAGE);
  const visibleFileCount = isTreeMode ? filteredAndSortedFiles.length : paginatedFiles.length;

  // --- Handlers for Filters ---
  const toggleTypeFilter = (id: string) => {
    setActiveFilters(prev => ({
      ...prev,
      types: prev.types.includes(id as FileTypeFilterId)
        ? prev.types.filter(t => t !== id)
        : [...prev.types, id as FileTypeFilterId]
    }));
  };

  const toggleSizeFilter = (id: string) => {
    setActiveFilters(prev => ({
      ...prev,
      size: prev.size.includes(id) ? prev.size.filter(s => s !== id) : [...prev.size, id]
    }));
  };

  const toggleTagFilter = (id: string) => {
    setActiveFilters(prev => ({
      ...prev,
      tags: prev.tags.includes(id) ? prev.tags.filter(t => t !== id) : [...prev.tags, id]
    }));
  };

  // Extract unique tags
  const uniqueTags = useMemo(() => {
    return extractUniqueTags(files);
  }, [files]);

  const fileTypeOptions = useMemo(() => {
    return FILE_TYPE_GROUP_ORDER.map((groupId) => {
      const groupConfig = FILE_TYPE_GROUP_CONFIG[groupId];
      const GroupIcon = groupConfig.icon;
      const groupFiles = files.filter((file) => (file.group ?? classifyFile(file.name).group) === groupId);
      const subtypeCounts = new Map<string, number>();

      for (const file of groupFiles) {
        const subtype = file.subtype ?? classifyFile(file.name).subtype;
        subtypeCounts.set(subtype, (subtypeCounts.get(subtype) ?? 0) + 1);
      }

      return {
        id: groupId,
        label: t(groupConfig.labelKey),
        icon: <GroupIcon className="w-3.5 h-3.5" />,
        count: groupFiles.length,
        children: Array.from(subtypeCounts.entries())
          .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
          .map(([subtype, count]) => ({
            id: `${groupId}:${subtype}`,
            label: t(FILE_TYPE_SUBTYPE_LABELS[subtype] ?? 'file_subtype_other'),
            count,
          })),
      };
    }).filter((option) => option.count > 0);
  }, [files, t]);

  // --- Sub-components ---
  const Sidebar = (
    <div className="flex flex-col h-full bg-card text-card-foreground border-r-2 border-border">
      <div className="p-5 border-b-2 border-border bg-card">
        {/* Logo / Header */}
        <div className="flex items-center gap-3 text-primary font-bold mb-4">
          <img src="/logo.png" alt="Logo" className="w-8 h-8 rounded border-2 border-border shadow" />
          <span className="font-head text-lg text-foreground">{t('app_title')}</span>
        </div>

        {/* Action Button */}

        {!isScanning ? (
          <div
            data-tour="scan-btn"
            onClick={handleSelectFolder}
            className={`w-full py-5 px-4 border-2 border-dashed rounded-md cursor-pointer transition-all duration-300 flex flex-col items-center justify-center gap-2 group shadow-md ${
              isDragOver
                ? 'border-border bg-secondary translate-x-0.5 translate-y-0.5'
                : 'border-border bg-muted hover:bg-secondary hover:translate-x-0.5 hover:translate-y-0.5'
            }`}
          >
            {/* Animated Indigo Folder SVG */}
            <svg width="48" height="48" viewBox="0 0 64 64" fill="none" className="transition-transform duration-300 drop-zone-folder">
              {/* Folder back */}
              <path d="M8 20C8 17 10 15 13 15H24L29 20H51C54 20 56 22 56 25V50C56 53 54 55 51 55H13C10 55 8 53 8 50V20Z" fill="#818cf8" stroke="#6366f1" strokeWidth="1.5"/>
              {/* Paper inside */}
              <rect x="16" y="28" width="22" height="4" rx="1" fill="white" opacity="0.7"/>
              <rect x="16" y="34" width="16" height="3" rx="1" fill="white" opacity="0.5"/>
              {/* Folder lid (animates open on hover & drag) */}
              <path
                className="folder-lid transition-all duration-300"
                d="M8 20C8 17 10 15 13 15H24L29 20H51C54 20 56 22 56 25H8Z"
                fill="#a5b4fc"
                stroke="#6366f1"
                strokeWidth="1.5"
              />
              {/* Tab */}
              <path d="M13 15H24L29 20H13C10 20 8 18 8 15C8 15 10 15 13 15Z" fill="#7c7ff7" />
            </svg>
            <span className={`text-sm font-semibold transition-colors ${
              isDragOver ? 'text-foreground' : 'text-foreground/80 group-hover:text-foreground'
            }`}>
              {isDragOver ? t('release_scan') : t('drop_scan')}
            </span>
            <span className="text-[10px] text-muted-foreground">{t('drag_hint')}</span>
          </div>
        ) : (
          <div className="text-sm text-muted-foreground text-center py-2 animate-pulse">{t('scanning')}</div>
        )}
      </div>

      {/* Progress Bar in Sidebar */}
      <div className="px-5 py-2 border-b-2 border-border bg-card">
        {isScanning && (
          <ProgressBar
            isScanning={isScanning}
            phase={scanProgress.phase}
            discoveredCount={scanProgress.discoveredCount}
            processedCount={scanProgress.processedCount}
            totalKnownCount={scanProgress.totalKnownCount}
            currentPath={scanProgress.currentPath}
            isPaused={isPaused}
            onTogglePause={handleTogglePause}
          />
        )}
        <div className="text-xs text-center text-muted-foreground mt-2">
          {t('files_indexed', { count: files.length })}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-5 pt-2 space-y-2 bg-card">
        <div className="flex items-center justify-between text-xs font-bold text-muted-foreground mb-2 uppercase tracking-wider">
          {t('filters')}
          {(activeFilters.types.length > 0 || activeFilters.date !== 'any' || activeFilters.size.length > 0 || activeFilters.tags.length > 0 || activeFilters.favorites) && (
            <Button
              variant="link"
              size="sm"
              onClick={() => setActiveFilters({ types: [], date: 'any', size: [], tags: [], favorites: false })}
              className="px-0 py-0 text-xs normal-case text-primary"
            >
              {t('clear_all')}
            </Button>
          )}
        </div>

        {/* Favorites Toggle */}
        <div className="mb-4">
          <Button
            variant={activeFilters.favorites ? 'secondary' : 'outline'}
            onClick={() => setActiveFilters(prev => ({ ...prev, favorites: !prev.favorites }))}
            className="w-full justify-start gap-3 px-3 py-2 text-sm"
          >
            <Star className={`w-4 h-4 ${activeFilters.favorites ? 'fill-foreground text-foreground' : 'text-foreground'}`} />
            {t('show_favorites_only')}
          </Button>
        </div>

        <FilterSection
          title={t('file_type')}
          selectedIds={activeFilters.types}
          onChange={toggleTypeFilter}
          options={fileTypeOptions}
        />

        {uniqueTags.length > 0 && (
          <FilterSection
            title={t('tags')}
            selectedIds={activeFilters.tags}
            onChange={toggleTagFilter}
            options={uniqueTags.map(tag => ({
              id: tag,
              label: tag,
              count: files.filter(f => f.tags?.includes(tag)).length
            }))}
          />
        )}

        <FilterSection
          title={t('date_modified')}
          type="radio"
          selectedIds={[activeFilters.date]}
          onChange={(id) => setActiveFilters(prev => ({ ...prev, date: id }))}
          options={[
            { id: 'any', label: t('any_time') },
            { id: 'today', label: t('today') },
            { id: 'week', label: t('last_7_days') },
            { id: 'month', label: t('last_30_days') },
          ]}
        />

        <FilterSection
          title={t('file_size')}
          selectedIds={activeFilters.size}
          onChange={toggleSizeFilter}
          options={[
            { id: 'small', label: t('tiny') },
            { id: 'medium', label: t('small') },
            { id: 'large', label: t('medium') },
            { id: 'huge', label: t('huge') },
          ]}
        />
      </div>
      <div className="p-4 border-t-2 border-border bg-card">
        <Button
          variant="outline"
          data-tour="settings-btn"
          onClick={() => setIsSettingsOpen(true)}
          className="w-full gap-2 py-2.5 text-sm"
        >
          <Settings className="w-4 h-4" /> {t('open_settings')}
        </Button>
      </div>
    </div>
  );

  return (
    <>
      <FirstVisitTour
        isOpen={isTourOpen}
        onClose={() => {
          setIsTourOpen(false);
          setTourCompletionTick((value) => value + 1);
        }}
      />
      <StarterScanModal
        isOpen={isStarterScanOpen}
        suggestions={starterSuggestions}
        isStarting={isStarterScanning}
        onDismiss={() => {
          localStorage.setItem(STARTER_SCAN_COMPLETED_KEY, 'true');
          setIsStarterScanOpen(false);
        }}
        onBrowse={handleSelectFolder}
        onStart={(paths) => {
          void startScanForDirectories(paths, { markStarterComplete: true });
        }}
      />
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        onClearIndex={handleIndexCleared}
        cloudIntelligenceEnabled={cloudIntelligenceEnabled}
        onCloudIntelligenceEnabledChange={handleCloudIntelligenceEnabledChange}
        cloudStatus={cloudStatus}
        watchedFolders={watchedFolders}
        onToggleWatchedFolder={handleToggleWatchedFolder}
        onRemoveWatchedFolder={handleRemoveWatchedFolder}
        onSaveCloudConfig={handleSaveCloudConfig}
        onTestCloudConnection={handleTestCloudConnection}
        onClearCloudConfig={handleClearCloudConfig}
      />
      <QuickLookModal isOpen={isQuickLookOpen} onClose={() => setIsQuickLookOpen(false)} file={selectedFile} />
      <WorkspaceDrillInModal
        isOpen={Boolean(selectedWorkspaceInsight)}
        insight={selectedWorkspaceInsight}
        workspaceTreeNodes={selectedWorkspaceTreeNodes}
        selectedPath={selectedWorkspaceInsight?.topFile.path ?? null}
        onClose={() => setSelectedWorkspaceId(null)}
        onOpenFile={(file) => {
          const matched = files.find((item) => item.path === file.path) ?? file;
          setSelectedWorkspaceId(null);
          setSelectedFile(matched);
        }}
        isPinned={selectedWorkspaceInsight ? workInboxActivity.pinnedItemIds.includes(getWorkspaceOpenNowItemId(selectedWorkspaceInsight.id)) : false}
        onTogglePin={handleTogglePinnedInboxItem}
      />
      <ResizableLayout
      sidebar={Sidebar}
      content={
        <div className="flex flex-col h-full cursor-default bg-background text-foreground">
          <div className="p-6 border-b-2 border-border bg-card sticky top-0 z-10">
            <div className="flex items-center gap-4">
              <Button
                variant="outline"
                size="icon"
                onClick={() => setIsTourOpen(true)}
                title={t('tutorial')}
                className="h-10 w-10 shrink-0"
              >
                <HelpCircle className="w-5 h-5" />
              </Button>
              <div className="flex-1">
                <SearchInput onSearch={handleSearch} isSearching={isSearching} />
              </div>
              <Button
                variant="secondary"
                onClick={handleToggleLanguage}
                title={t('toggle_language')}
                className="gap-2 px-3 py-2 text-sm shrink-0"
              >
                <Globe2 className="w-4 h-4" />
                <span>{language === 'vi' ? t('language_vi') : t('language_en')}</span>
              </Button>
              <Button
                variant="outline"
                size="icon"
                onClick={handleToggleTheme}
                title={t('toggle_theme')}
                className="h-10 w-10 shrink-0"
              >
                {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
              </Button>
            </div>

            <div className="mt-4 flex items-center justify-between">
              <div className="text-xs text-muted-foreground">
                {t('showing_files', { count: visibleFileCount, total: filteredAndSortedFiles.length })}
                {searchQuery && <span className="ml-1">{t('for_query', { query: searchQuery })}</span>}
              </div>

              <div className="flex items-center gap-3">
                <div className="flex items-center rounded-md border-2 border-border bg-muted p-0.5 shadow">
                  <Button
                    variant={viewMode === 'tree' ? 'default' : 'ghost'}
                    size="icon"
                    onClick={() => setViewMode('tree')}
                    className="h-8 w-8 border-0 shadow-none hover:translate-y-0 active:translate-x-0 active:translate-y-0"
                    title={t('tree_view')}
                  >
                    <FolderTreeIcon className="w-3.5 h-3.5" />
                  </Button>
                  <Button
                    variant={viewMode === 'grid' ? 'default' : 'ghost'}
                    size="icon"
                    onClick={() => setViewMode('grid')}
                    className="h-8 w-8 border-0 shadow-none hover:translate-y-0 active:translate-x-0 active:translate-y-0"
                    title={t('grid_view')}
                  >
                    <LayoutGrid className="w-3.5 h-3.5" />
                  </Button>
                  <Button
                    variant={viewMode === 'list' ? 'default' : 'ghost'}
                    size="icon"
                    onClick={() => setViewMode('list')}
                    className="h-8 w-8 border-0 shadow-none hover:translate-y-0 active:translate-x-0 active:translate-y-0"
                    title={t('list_view')}
                  >
                    <List className="w-3.5 h-3.5" />
                  </Button>
                </div>
                <div className="h-5 w-0.5 bg-border"></div>
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as any)}
                  className="cursor-pointer rounded border-2 border-border bg-card px-2 py-1.5 text-xs font-semibold text-foreground shadow focus:outline-none focus:ring-2 focus:ring-ring/40"
                >
                  <option value="date">{t('sort_date')}</option>
                  <option value="size">{t('sort_size')}</option>
                  <option value="name">{t('sort_name')}</option>
                  <option value="relevance">{t('sort_relevance')}</option>
                </select>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={handleToggleSort}
                  className="h-8 w-8"
                  title={sortOrder === 'asc' ? t('sort_ascending') : t('sort_descending')}
                >
                  <ArrowUpDown className="w-3.5 h-3.5" />
                </Button>
              </div>
            </div>
          </div>

          {!searchQuery.trim() && workInboxItems.length > 0 && (
            <WorkInboxPanel
              items={workInboxItems}
              onOpenFile={(file) => {
                const matched = files.find((item) => item.path === file.path) ?? file;
                setSelectedFile(matched);
              }}
              onOpenWorkspace={(workspaceId) => setSelectedWorkspaceId(workspaceId)}
              onDismissItem={handleDismissWorkInboxItem}
              onToggleItemPin={handleTogglePinnedInboxItem}
              hiddenItemCount={hiddenWorkInboxItemCount}
              onResetDismissedItems={hiddenWorkInboxItemCount > 0 ? handleResetDismissedWorkInboxItems : undefined}
            />
          )}

          {/* File List */}
          <div ref={scrollContainerRef} className="relative flex-1 overflow-y-auto bg-card scroll-smooth">
            {isTreeMode ? (
              <TreeView
                nodes={treeViewNodes}
                selectedPath={selectedFile?.path ?? null}
                autoExpandPaths={treeAutoExpandedPaths}
                expandAll
                onSelectFile={(file) => setSelectedFile(file)}
              />
            ) : paginatedFiles.length > 0 ? (
              <div
                key={currentPage}
                className={viewMode === 'grid' 
                  ? "grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 p-4 animate-fade-in-slide-up"
                  : "divide-y divide-border animate-fade-in-slide-up"}
              >
                {paginatedFiles.map((file, idx) => (
                  viewMode === 'grid' ? (
                    <FileGridItem
                      key={file.path || idx}
                      file={file}
                      score={file.score}
                      isSelected={selectedFile?.path === file.path}
                      onClick={() => setSelectedFile(file)}
                      onToggleStar={(e) => handleToggleStar(e, file.path)}
                    />
                  ) : (
                    <FileListItem
                      key={file.path || idx}
                      file={file}
                      score={file.score}
                      isSelected={selectedFile?.path === file.path}
                      onClick={() => setSelectedFile(file)}
                      onToggleStar={(e) => handleToggleStar(e, file.path)}
                    />
                  )
                ))}
              </div>
            ) : (
              <div className="flex h-64 flex-col items-center justify-center text-muted-foreground">
                <FolderOpen className="mb-3 h-12 w-12 text-muted-foreground" />
                <p>{t('no_files_match')}</p>
              </div>
            )}
          </div>

          {/* Footer Pagination */}
          {!isTreeMode ? (
            <div className="border-t-2 border-border bg-secondary p-4">
              <Pagination
                currentPage={currentPage}
                totalPages={totalPages}
                onPageChange={setCurrentPage}
              />
            </div>
          ) : null}
        </div>
      }
      preview={<FilePreviewPanel file={selectedFile} onTagsChange={handleTagsChange} onSelectFile={setSelectedFile} />}
    />
    </>
  );
}
