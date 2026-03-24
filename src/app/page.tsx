'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import { processFile, TauriFileMetadata } from '@/lib/file-system/scanner';
import { searchFiles } from '@/lib/search/engine';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { open } from '@tauri-apps/plugin-dialog';
import { getCurrentWebviewWindow } from '@tauri-apps/api/webviewWindow';
import { getAllFiles, toggleFileStar, deleteFile } from '@/lib/file-system/db';
import { SearchInput } from '@/components/search/search-input';
import { ResizableLayout } from '@/components/layout/resizable-layout';
import { FileListItem } from '@/components/file-viewer/file-list-item';
import { ProgressBar } from '@/components/ui/progress-bar';
import { FilePreviewPanel } from '@/components/file-viewer/file-preview-panel';
import { Pagination } from '@/components/ui/pagination';
import { FilterSection } from '@/components/sidebar/filter-section';
import { FolderOpen, FileText, FileCode, Image as ImageIcon, ArrowUpDown, Star, HelpCircle, Globe2, Moon, Sun } from 'lucide-react';

import { useToast } from '@/components/ui/toast';
import { SettingsModal } from '@/components/settings/settings-modal';
import { QuickLookModal } from '@/components/file-viewer/quick-look-modal';
import { Settings, LayoutGrid, List } from 'lucide-react';
import { FirstVisitTour } from '@/components/onboarding/first-visit-tour';
import { useTranslation } from '@/lib/i18n';
import { useTheme } from '@/lib/theme-provider';
import { FileGridItem } from '@/components/file-viewer/file-grid-item';
import { extractUniqueTags, filterFiles, paginateFiles, sortFiles } from '@/lib/file-browser/utils';

const ITEMS_PER_PAGE = 20;

export default function Home() {
  const { toast } = useToast();
  const { t, language, setLanguage } = useTranslation();
  const { theme, setTheme } = useTheme();

  // --- State ---
  const [viewMode, setViewMode] = useState<'list'|'grid'>('list');
  const [files, setFiles] = useState<any[]>([]);
  const [selectedFile, setSelectedFile] = useState<any | null>(null);
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

  // Filters
  const [activeFilters, setActiveFilters] = useState<{
    types: string[];
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
    isPausedRef.current = isPaused;
  }, [isPaused]);

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
            await processFile(meta);
            // Refresh from DB or update inline
            // To ensure we get the full indexedDB record including search terms and extracted text,
            // we can just re-fetch the specific file from DB if needed, or just refresh all if we want simplicity.
            // But a fast inline update is better:
            const updatedAll = await getAllFiles();
            setFiles(updatedAll);
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
  }, []);

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
  const refreshData = async () => {
    const all = await getAllFiles();
    setFiles(all);
  };

  // Scan a directory by path directly (used by drag-drop)
  const handleScanDirectory = async (dirPath: string) => {
    try {
      setIsScanning(true);
      setIsPaused(false);
      setScanProgress({ count: 0, total: 0, currentFile: t('scan_discovering') });

      const scannedFiles = await invoke<TauriFileMetadata[]>('scan_directory', { dirPath });
      const total = scannedFiles.length;
      setScanProgress(prev => ({ ...prev, total, currentFile: t('scan_starting') }));

      let count = 0;
      let lastUpdateTime = Date.now();

      for (const fileMeta of scannedFiles) {
        while (isPausedRef.current) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
        const now = Date.now();
        if (now - lastUpdateTime > 100 || count === total - 1) {
          setScanProgress({ count, total, currentFile: fileMeta.name });
          lastUpdateTime = now;
          await new Promise(resolve => setTimeout(resolve, 0));
        }
        await processFile(fileMeta);
        count++;
        if (count % 200 === 0) await refreshData();
      }

      await refreshData();
      toast(t('scan_completed'), 'success');
    } catch (error: any) {
      console.error('Tauri scan error:', error);
      toast(t('scan_failed'), 'error');
    } finally {
      setIsScanning(false);
      setIsPaused(false);
    }
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
              handleScanDirectory(paths[0]);
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
  }, []);

  const handleSelectFolder = async () => {
    try {
      const selected = await open({
        directory: true,
        multiple: false,
      });
      if (!selected) return;

      const dirPath = selected as string;

      setIsScanning(true);
      setIsPaused(false);
      setScanProgress({ count: 0, total: 0, currentFile: t('scan_discovering') });

      // Fast scanning via Tauri Rust engine
      const scannedFiles = await invoke<TauriFileMetadata[]>('scan_directory', { dirPath });
      const total = scannedFiles.length;

      setScanProgress(prev => ({ ...prev, total, currentFile: t('scan_starting') }));

      let count = 0;
      let lastUpdateTime = Date.now();
      
      for (const fileMeta of scannedFiles) {
        while (isPausedRef.current) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }

        const now = Date.now();
        // Update UI progress every 100ms instead of every file
        if (now - lastUpdateTime > 100 || count === total - 1) {
          setScanProgress({ count, total, currentFile: fileMeta.name });
          lastUpdateTime = now;
          
          // Yield to main thread to prevent "Not Responding"
          await new Promise(resolve => setTimeout(resolve, 0));
        }

        await processFile(fileMeta);
        count++;

        // Only refresh data every 200 files instead of 50
        if (count % 200 === 0) {
          await refreshData();
        }
      }

      await refreshData();
      toast(t('scan_completed'), 'success');
    } catch (error: any) {
      console.error('Tauri scan error:', error);
      toast(t('scan_failed'), 'error');
    } finally {
      setIsScanning(false);
      setIsPaused(false);
    }
  };

  const handleTogglePause = () => {
    setIsPaused(prev => !prev);
  };

  const handleSearch = async (query: string) => {
    setSearchQuery(query);
    if (!query) {
      refreshData();
      return;
    }
    setIsSearching(true);
    setSortBy('relevance');  // Auto-switch sort to relevance
    setSortOrder('desc');
    try {
      const results = await searchFiles(query);
      const mapped = results.map(r => ({ ...r.file, score: r.score }));
      setFiles(mapped);
    } finally {
      setIsSearching(false);
    }
  };

  const handleIndexCleared = () => {
    setFiles([]);
    setSelectedFile(null);
    toast(t('index_cleared'), 'info');
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
      types: prev.types.includes(id) ? prev.types.filter(t => t !== id) : [...prev.types, id]
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
          options={[
            { id: 'doc', label: t('documents'), icon: <FileText className="w-3.5 h-3.5" />, count: files.filter(f => ['.pdf', '.docx', '.txt', '.md'].includes('.' + f.name.split('.').pop())).length },
            { id: 'code', label: t('code_files'), icon: <FileCode className="w-3.5 h-3.5" />, count: files.filter(f => ['.js', '.ts', '.tsx', '.py', '.json', '.html', '.css', '.xml', '.yaml', '.yml'].includes('.' + f.name.split('.').pop())).length },
            { id: 'image', label: t('images'), icon: <ImageIcon className="w-3.5 h-3.5" />, count: 0 },
          ]}
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
      <FirstVisitTour isOpen={isTourOpen} onClose={() => setIsTourOpen(false)} />
      <SettingsModal isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} onClearIndex={handleIndexCleared} />
      <QuickLookModal isOpen={isQuickLookOpen} onClose={() => setIsQuickLookOpen(false)} file={selectedFile} />
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
