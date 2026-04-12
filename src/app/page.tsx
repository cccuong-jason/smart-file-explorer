'use client';

import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { processFile, TauriFileMetadata } from '@/lib/file-system/scanner';
import { searchFiles } from '@/lib/search/engine';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { open } from '@tauri-apps/plugin-dialog';
import { getCurrentWebviewWindow } from '@tauri-apps/api/webviewWindow';
import {
  deleteFile,
  deleteWorkspaceAiSummary,
  getAllFiles,
  getWorkspaceAiSummary,
  storeWorkspaceAiSummary,
  toggleFileStar,
} from '@/lib/file-system/db';
import { SearchInput, type SearchRequest } from '@/components/search/search-input';
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
import { Settings, LayoutGrid, List } from 'lucide-react';
import { FirstVisitTour } from '@/components/onboarding/first-visit-tour';
import { StarterScanModal } from '@/components/onboarding/starter-scan-modal';
import { WorkInboxPanel } from '@/components/folder-intelligence/work-inbox-panel';
import { WorkspaceDrillInModal } from '@/components/folder-intelligence/workspace-drill-in-modal';
import { useTranslation } from '@/lib/i18n';
import { useTheme } from '@/lib/theme-provider';
import { FileGridItem } from '@/components/file-viewer/file-grid-item';
import { extractUniqueTags, filterFiles, paginateFiles, sortFiles } from '@/lib/file-browser/utils';
import { logFrontendMessage } from '@/lib/telemetry/logger';
import { getIndexingCoordinator } from '@/lib/file-system/indexing-coordinator';
import { classifyFile, type FileTypeFilterId } from '@/lib/file-browser/classification';
import {
  normalizeStarterScanSuggestions,
  shouldPromptForStarterScan,
  STARTER_SCAN_COMPLETED_KEY,
  type StarterScanSuggestion,
} from '@/lib/onboarding/starter-scan';
import { buildFolderInsights } from '@/lib/folder-intelligence/workspaces';
import { buildWorkInboxItems } from '@/lib/work-inbox/items';
import {
  getWorkInboxActivity,
  recordWorkInboxOpenFile,
  recordWorkInboxVisit,
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

export default function Home() {
  const { toast } = useToast();
  const { t, language, setLanguage } = useTranslation();
  const { theme, setTheme } = useTheme();
  const indexingCoordinator = useMemo(() => getIndexingCoordinator(), []);

  // --- State ---
  const [viewMode, setViewMode] = useState<'list'|'grid'>('list');
  const [files, setFiles] = useState<any[]>([]);
  const [selectedFile, setSelectedFile] = useState<any | null>(null);
  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState<string | null>(null);
  const [isQuickLookOpen, setIsQuickLookOpen] = useState(false);

  // Scanning
  const [isScanning, setIsScanning] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [scanProgress, setScanProgress] = useState({ count: 0, total: 0, currentFile: '' });

  // Ref to track pause state immediately in loop without dependency closure issues
  const isPausedRef = useRef(false);

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
  const [workInboxActivity, setWorkInboxActivity] = useState<WorkInboxActivitySnapshot>({ recentFiles: [] });
  const pendingFolderInsightAiRef = useRef(new Set<string>());
  const failedFolderInsightAiRef = useRef(new Set<string>());
  const lastRecordedOpenPathRef = useRef<string | null>(null);
  const hasRecordedInboxVisitRef = useRef(false);

  // --- Effects ---
  // Scroll to top on page change
  useEffect(() => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, [currentPage]);

  useEffect(() => {
    refreshData();
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
      }

      if (event.type === 'scan-progress') {
        setIsScanning(event.completed < event.total);
        setIsPaused(event.isPaused);
        setScanProgress({
          count: event.completed,
          total: event.total,
          currentFile: event.currentFile ?? '',
        });
      }

      if (event.type === 'scan-complete') {
        setIsScanning(false);
        setIsPaused(false);
        setScanProgress((prev) => ({
          ...prev,
          count: event.completed,
          total: event.total,
          currentFile: '',
        }));
        toast(t('scan_completed'), 'success');
      }
    });

    return unsubscribe;
  }, [enqueueFileUpdate, indexingCoordinator, searchQuery, t, toast]);

  // Background File Watcher Listener
  useEffect(() => {
    let unlisten: () => void;
    
    const setupListener = async () => {
      unlisten = await listen<{ kind: string; path: string }>('sys-file-event', async (event) => {
        const { kind, path } = event.payload;
        
        if (kind === 'remove') {
          await deleteFile(path);
          setFiles(prev => prev.filter(f => f.path !== path));
          // if it was the selected file, deselect it
          setSelectedFile((prev: any) => prev?.path === path ? null : prev);
        } else {
          // create, modify, rename
          try {
            const meta = await invoke<TauriFileMetadata>('get_file_metadata', { path });
            await processFile(meta, {
              onFileUpdated: (updatedFile) => {
                setSelectedFile((prev: any) => prev?.path === updatedFile.path ? { ...prev, ...updatedFile } : prev);
                if (!searchQueryRef.current.trim()) {
                  enqueueFileUpdate(updatedFile);
                }
              },
            });
          } catch (e) {
            console.error("Failed to process background file change", e);
          }
        }
      });
    };

    setupListener();

    return () => {
      if (unlisten) unlisten();
    };
  }, [enqueueFileUpdate]);

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
  const refreshData = useCallback(async () => {
    pendingFileUpdatesRef.current.clear();
    if (flushFileUpdatesTimerRef.current) {
      clearTimeout(flushFileUpdatesTimerRef.current);
      flushFileUpdatesTimerRef.current = null;
    }
    const all = await getAllFiles();
    setFiles(all);
  }, []);

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
      setIsScanning(true);
      setIsPaused(false);
      setIsStarterScanning(markStarterComplete);
      setIsStarterScanOpen(false);
      setScanProgress({ count: 0, total: 0, currentFile: t('scan_discovering') });

      const metadataBatches = await Promise.all(
        uniqueDirectories.map((dirPath) => invoke<TauriFileMetadata[]>('scan_directory', { dirPath }))
      );
      const uniqueFiles = Array.from(
        metadataBatches
          .flat()
          .reduce((acc, file) => acc.set(file.path, file), new Map<string, TauriFileMetadata>())
          .values()
      );

      setScanProgress((prev) => ({ ...prev, total: uniqueFiles.length, currentFile: t('scan_starting') }));
      await indexingCoordinator.start(uniqueFiles);

      if (markStarterComplete) {
        localStorage.setItem(STARTER_SCAN_COMPLETED_KEY, 'true');
      }
    } catch (error: any) {
      console.error('Tauri scan error:', error);
      toast(t('scan_failed'), 'error');
    } finally {
      setIsScanning(false);
      setIsPaused(false);
      setIsStarterScanning(false);
    }
  }, [indexingCoordinator, t, toast]);

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
    if (isPausedRef.current) {
      indexingCoordinator.resume();
    } else {
      indexingCoordinator.pause();
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
      toast(t('privacy_cloud_save_success'), 'success');
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      void logFrontendMessage('error', message, 'page-cloud-save');
      toast(message, 'error');
      throw error;
    }
  };

  const handleTestCloudConnection = async (input: TestCloudIntelligenceConnectionInput) => {
    try {
      const nextStatus = await testCloudIntelligenceConnection(input);
      setCloudStatus(nextStatus);
      if (nextStatus.lastError) {
        toast(nextStatus.lastError, 'error');
      } else {
        toast(t('privacy_cloud_test_success'), 'success');
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      void logFrontendMessage('error', message, 'page-cloud-test');
      toast(message, 'error');
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
      toast(t('privacy_cloud_clear_success'), 'info');
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      void logFrontendMessage('error', message, 'page-cloud-clear');
      toast(message, 'error');
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

    if (!cloudStatus.configured) {
      setFolderInsightAiCache((prev) => ({
        ...prev,
        [workspaceId]: {
          fingerprint,
          status: 'failed',
          error: t('privacy_cloud_status_not_connected'),
        },
      }));
      toast(t('privacy_cloud_status_not_connected'), 'info');
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

        if (!cloudIntelligenceEnabled || !cloudStatus.configured) {
          setFolderInsightAiCache((prev) => ({
            ...prev,
            [insight.id]: {
              fingerprint,
              status: 'failed',
              error: !cloudIntelligenceEnabled ? t('privacy_cloud_intelligence_disabled_hint') : t('privacy_cloud_status_not_connected'),
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
  }, [cloudIntelligenceEnabled, cloudStatus.configured, folderInsightAiCache, folderInsights, isScanning, searchQuery, t]);

  const visibleFolderInsights = useMemo(() => (
    folderInsights.map((insight) => {
      const cacheEntry = folderInsightAiCache[insight.id];
      const enriched = applyFolderInsightAiSummary(insight, cacheEntry?.summary);
      return {
        ...enriched,
        summaryState: cacheEntry?.status ?? (!cloudIntelligenceEnabled ? 'local' : cloudStatus.configured ? 'local' : 'not_connected'),
        summaryUpdatedAt: cacheEntry?.updatedAt,
        summaryError: cacheEntry?.error,
      };
    })
  ), [cloudIntelligenceEnabled, cloudStatus.configured, folderInsightAiCache, folderInsights]);

  const selectedWorkspaceInsight = useMemo(() => (
    selectedWorkspaceId
      ? visibleFolderInsights.find((insight) => insight.id === selectedWorkspaceId) ?? null
      : null
  ), [selectedWorkspaceId, visibleFolderInsights]);

  const workInboxItems = useMemo(() => (
    buildWorkInboxItems(visibleFolderInsights, workInboxActivity)
  ), [visibleFolderInsights, workInboxActivity]);

  useEffect(() => {
    if (searchQuery.trim() || workInboxItems.length === 0 || hasRecordedInboxVisitRef.current) {
      return;
    }

    recordWorkInboxVisit();
    hasRecordedInboxVisitRef.current = true;
  }, [searchQuery, workInboxItems.length]);

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

  // --- Filtering & Sorting ---
  const filteredAndSortedFiles = useMemo(() => {
    return sortFiles(filterFiles(files, activeFilters), sortBy, sortOrder);
  }, [files, activeFilters, sortBy, sortOrder]);

  // Pagination
  useEffect(() => setCurrentPage(1), [filteredAndSortedFiles]);

  const paginatedFiles = useMemo(() => {
    return paginateFiles(filteredAndSortedFiles, currentPage, ITEMS_PER_PAGE);
  }, [filteredAndSortedFiles, currentPage]);

  const totalPages = Math.ceil(filteredAndSortedFiles.length / ITEMS_PER_PAGE);

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
    <div className="flex flex-col h-full bg-white dark:bg-gray-900 border-r border-gray-100 dark:border-gray-800">
      <div className="p-5 border-b border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900">
        {/* Logo / Header */}
        <div className="flex items-center gap-3 text-indigo-700 dark:text-indigo-400 font-bold mb-4">
          <img src="/logo.png" alt="Logo" className="w-8 h-8 rounded-lg shadow-sm" />
          <span className="text-lg">{t('app_title')}</span>
        </div>

        {/* Action Button */}

        {!isScanning ? (
          <div
            data-tour="scan-btn"
            onClick={handleSelectFolder}
            className={`w-full py-5 px-4 border-2 border-dashed rounded-xl cursor-pointer transition-all duration-300 flex flex-col items-center justify-center gap-2 group active:scale-[0.98] ${
              isDragOver
                ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20 scale-[1.02]'
                : 'border-gray-300 dark:border-gray-700 hover:border-indigo-400 dark:hover:border-indigo-500 bg-gray-50/50 dark:bg-gray-800/50 hover:bg-indigo-50/40 dark:hover:bg-indigo-900/10'
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
              isDragOver ? 'text-indigo-700 dark:text-indigo-400' : 'text-gray-600 dark:text-gray-300 group-hover:text-indigo-700 dark:group-hover:text-indigo-400'
            }`}>
              {isDragOver ? t('release_scan') : t('drop_scan')}
            </span>
            <span className="text-[10px] text-gray-400 dark:text-gray-500">{t('drag_hint')}</span>
          </div>
        ) : (
          <div className="text-sm text-gray-500 dark:text-gray-400 text-center py-2 animate-pulse">{t('scanning')}</div>
        )}
      </div>

      {/* Progress Bar in Sidebar */}
      <div className="px-5 py-2 border-b border-gray-50 dark:border-gray-800 bg-white dark:bg-gray-900">
        {isScanning && (
          <ProgressBar
            isScanning={isScanning}
            processedCount={scanProgress.count}
            totalCount={scanProgress.total}
            currentFile={scanProgress.currentFile}
            isPaused={isPaused}
            onTogglePause={handleTogglePause}
          />
        )}
        <div className="text-xs text-center text-gray-400 dark:text-gray-500 mt-2">
          {t('files_indexed', { count: files.length })}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-5 pt-2 space-y-2 bg-white dark:bg-gray-900">
        <div className="flex items-center justify-between text-xs font-bold text-gray-400 dark:text-gray-500 mb-2 uppercase tracking-wider">
          {t('filters')}
          {(activeFilters.types.length > 0 || activeFilters.date !== 'any' || activeFilters.size.length > 0 || activeFilters.tags.length > 0 || activeFilters.favorites) && (
            <button
              onClick={() => setActiveFilters({ types: [], date: 'any', size: [], tags: [], favorites: false })}
              className="text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-300 normal-case"
            >
              {t('clear_all')}
            </button>
          )}
        </div>

        {/* Favorites Toggle */}
        <div className="mb-4">
          <button
            onClick={() => setActiveFilters(prev => ({ ...prev, favorites: !prev.favorites }))}
            className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${activeFilters.favorites
              ? 'bg-yellow-50 dark:bg-yellow-900/20 text-yellow-700 dark:text-yellow-500 border border-yellow-200 dark:border-yellow-800/50'
              : 'text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 border border-transparent'
              }`}
          >
            <Star className={`w-4 h-4 ${activeFilters.favorites ? 'fill-yellow-500 text-yellow-500' : 'text-gray-400 dark:text-gray-500'}`} />
            {t('show_favorites_only')}
          </button>
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
      <div className="p-4 border-t border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900">
        <button
          data-tour="settings-btn"
          onClick={() => setIsSettingsOpen(true)}
          className="w-full flex items-center justify-center gap-2 text-sm text-gray-700 dark:text-gray-300 font-semibold hover:bg-gray-50 dark:hover:bg-gray-800 active:scale-[0.98] py-2.5 rounded-xl transition-all duration-200 border border-gray-200/80 dark:border-gray-700 shadow-sm hover:shadow-md hover:border-gray-300 dark:hover:border-gray-600"
        >
          <Settings className="w-4 h-4" /> {t('open_settings')}
        </button>
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
        onSaveCloudConfig={handleSaveCloudConfig}
        onTestCloudConnection={handleTestCloudConnection}
        onClearCloudConfig={handleClearCloudConfig}
      />
      <QuickLookModal isOpen={isQuickLookOpen} onClose={() => setIsQuickLookOpen(false)} file={selectedFile} />
      <WorkspaceDrillInModal
        isOpen={Boolean(selectedWorkspaceInsight)}
        insight={selectedWorkspaceInsight}
        onClose={() => setSelectedWorkspaceId(null)}
        onOpenFile={(file) => {
          const matched = files.find((item) => item.path === file.path) ?? file;
          setSelectedWorkspaceId(null);
          setSelectedFile(matched);
        }}
      />
      <ResizableLayout
      sidebar={Sidebar}
      content={
        <div className="flex flex-col h-full cursor-default">
          <div className="p-6 border-b border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 sticky top-0 z-10">
            <div className="flex items-center gap-4">
              <button
                onClick={() => setIsTourOpen(true)}
                title={t('tutorial')}
                className="p-2 text-gray-400 dark:text-gray-500 hover:text-indigo-600 dark:hover:text-indigo-300 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 rounded-lg transition-colors shrink-0"
              >
                <HelpCircle className="w-5 h-5" />
              </button>
              <div className="flex-1">
                <SearchInput onSearch={handleSearch} isSearching={isSearching} />
              </div>
              <button
                onClick={handleToggleLanguage}
                title={t('toggle_language')}
                className="inline-flex items-center gap-2 rounded-full border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm font-semibold text-gray-600 dark:text-gray-200 hover:border-indigo-300 dark:hover:border-indigo-700 hover:text-indigo-600 dark:hover:text-indigo-300 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 transition-colors shrink-0"
              >
                <Globe2 className="w-4 h-4" />
                <span>{language === 'vi' ? t('language_vi') : t('language_en')}</span>
              </button>
              <button
                onClick={handleToggleTheme}
                title={t('toggle_theme')}
                className="inline-flex items-center justify-center rounded-full border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-2.5 text-gray-600 dark:text-gray-200 hover:border-indigo-300 dark:hover:border-indigo-700 hover:text-indigo-600 dark:hover:text-indigo-300 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 transition-colors shrink-0"
              >
                {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
              </button>
            </div>

            <div className="mt-4 flex items-center justify-between">
              <div className="text-xs text-gray-400 dark:text-gray-500">
                {t('showing_files', { count: paginatedFiles.length, total: filteredAndSortedFiles.length })}
                {searchQuery && <span className="ml-1">{t('for_query', { query: searchQuery })}</span>}
              </div>

              <div className="flex items-center gap-3">
                <div className="flex items-center bg-gray-50 dark:bg-gray-800 rounded-lg p-0.5 border border-gray-100 dark:border-gray-700">
                  <button
                    onClick={() => setViewMode('grid')}
                    className={`p-1.5 rounded-md transition-colors ${viewMode === 'grid' ? 'bg-white dark:bg-gray-700 text-indigo-600 dark:text-indigo-400 shadow-sm' : 'text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300'}`}
                    title={t('grid_view')}
                  >
                    <LayoutGrid className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => setViewMode('list')}
                    className={`p-1.5 rounded-md transition-colors ${viewMode === 'list' ? 'bg-white dark:bg-gray-700 text-indigo-600 dark:text-indigo-400 shadow-sm' : 'text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300'}`}
                    title={t('list_view')}
                  >
                    <List className="w-3.5 h-3.5" />
                  </button>
                </div>
                <div className="h-4 w-px bg-gray-200 dark:bg-gray-700"></div>
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as any)}
                  className="text-xs border border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 rounded px-2 py-1.5 text-gray-600 dark:text-gray-300 focus:ring-0 cursor-pointer"
                >
                  <option value="date">{t('sort_date')}</option>
                  <option value="size">{t('sort_size')}</option>
                  <option value="name">{t('sort_name')}</option>
                  <option value="relevance">{t('sort_relevance')}</option>
                </select>
                <button
                  onClick={handleToggleSort}
                  className="p-1 hover:bg-gray-100 dark:hover:bg-gray-800 rounded text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                  title={sortOrder === 'asc' ? t('sort_ascending') : t('sort_descending')}
                >
                  <ArrowUpDown className="w-3.5 h-3.5" />
                </button>
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
            />
          )}

          {/* File List */}
          <div ref={scrollContainerRef} className="flex-1 overflow-y-auto bg-white dark:bg-gray-900 scroll-smooth relative">
            {paginatedFiles.length > 0 ? (
              <div
                key={currentPage}
                className={viewMode === 'grid' 
                  ? "grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 p-4 animate-fade-in-slide-up"
                  : "divide-y divide-gray-50 dark:divide-gray-800 animate-fade-in-slide-up"}
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
              <div className="flex flex-col items-center justify-center h-64 text-gray-400 dark:text-gray-500">
                <FolderOpen className="w-12 h-12 text-gray-200 dark:text-gray-700 mb-3" />
                <p>{t('no_files_match')}</p>
              </div>
            )}
          </div>

          {/* Footer Pagination */}
          <div className="p-4 border-t border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-900">
            <Pagination
              currentPage={currentPage}
              totalPages={totalPages}
              onPageChange={setCurrentPage}
            />
          </div>
        </div>
      }
      preview={<FilePreviewPanel file={selectedFile} onTagsChange={handleTagsChange} onSelectFile={setSelectedFile} />}
    />
    </>
  );
}
