'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import { countTotalFiles, createFileGenerator, processFile } from '@/lib/file-system/scanner';
import { searchFiles } from '@/lib/search/engine';
import { getAllFiles, clearDatabase, toggleFileStar } from '@/lib/file-system/db';
import { SearchInput } from '@/components/search/search-input';
import { ResizableLayout } from '@/components/layout/resizable-layout';
import { FileListItem } from '@/components/file-viewer/file-list-item';
import { ProgressBar } from '@/components/ui/progress-bar';
import { FilePreviewPanel } from '@/components/file-viewer/file-preview-panel';
import { Pagination } from '@/components/ui/pagination';
import { FilterSection } from '@/components/sidebar/filter-section';
import { FolderOpen, RefreshCw, FileText, FileCode, Image as ImageIcon, ArrowUpDown, Star } from 'lucide-react';

import { useToast } from '@/components/ui/toast';
import { HelperAlert } from '@/components/ui/helper-alert';

const ITEMS_PER_PAGE = 20;

export default function Home() {
  const { toast } = useToast();

  // --- State ---
  const [files, setFiles] = useState<any[]>([]);
  const [selectedFile, setSelectedFile] = useState<any | null>(null);

  // Scanning
  const [isScanning, setIsScanning] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [scanProgress, setScanProgress] = useState({ count: 0, total: 0, currentFile: '' });

  // Ref to track pause state immediately in loop without dependency closure issues
  const isPausedRef = useRef(false);

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

  // --- Effects ---
  useEffect(() => {
    refreshData();
  }, []);

  // Sync ref
  useEffect(() => {
    isPausedRef.current = isPaused;
  }, [isPaused]);

  // Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Focus search on '/' or 'Cmd+K' or 'Alt+K' or 'Ctrl+K'
      if ((e.key === '/' && !['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement).tagName)) ||
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

  const handleSelectFolder = async () => {
    try {
      const dirHandle = await window.showDirectoryPicker({ mode: 'read' });
      setIsScanning(true);
      setIsPaused(false);
      setScanProgress({ count: 0, total: 0, currentFile: 'Discovering files...' });

      // Phase 1: Count
      const total = await countTotalFiles(dirHandle);
      setScanProgress(prev => ({ ...prev, total, currentFile: 'Starting scan...' }));

      // Phase 2: Process with Generator
      let count = 0;
      const generator = createFileGenerator(dirHandle);

      for await (const { handle, path } of generator) {
        // Pause Loop logic
        while (isPausedRef.current) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }

        setScanProgress({ count, total, currentFile: path });
        await processFile(handle, path);
        count++;

        // Refresh list occasionally? Or just at end?
        // Let's refresh every 50 files so user sees progress
        if (count % 50 === 0) refreshData();
      }

      await refreshData();
      toast('Folder scan completed successfully', 'success');
    } catch (error: any) {
      if (error.name !== 'AbortError') {
        console.error(error);
        toast('Failed to scan folder', 'error');
      }
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

  const handleClearIndex = async () => {
    if (confirm('Are you sure you want to clear the entire search index?')) {
      await clearDatabase();
      setFiles([]);
      setSelectedFile(null);
      toast('Index cleared successfully', 'info');
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
      toast(isStarred ? 'Added to favorites' : 'Removed from favorites', 'success');
    } catch (error) {
      console.error("Failed to toggle star", error);
      toast('Failed to update favorite status', 'error');
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

  // --- Filtering & Sorting ---
  const filteredAndSortedFiles = useMemo(() => {
    let result = files.filter(f => {
      // Type Filter
      if (activeFilters.types.length > 0) {
        const ext = '.' + f.name.split('.').pop()?.toLowerCase();
        const isDoc = ['.pdf', '.docx', '.txt', '.md'].includes(ext);
        const isCode = ['.js', '.ts', '.tsx', '.py', '.json', '.html', '.css', '.xml', '.yaml', '.yml'].includes(ext);
        const isImage = ['.jpg', '.png', '.gif', '.svg'].includes(ext);

        const matchesType = activeFilters.types.some(t => {
          if (t === 'doc') return isDoc;
          if (t === 'code') return isCode;
          if (t === 'image') return isImage;
          return true;
        });
        if (!matchesType) return false;
      }

      // Date Filter
      if (activeFilters.date !== 'any') {
        const fileDate = new Date(f.lastModified);
        const now = new Date();
        const diffTime = Math.abs(now.getTime() - fileDate.getTime());
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

        if (activeFilters.date === 'today' && diffDays > 1) return false;
        if (activeFilters.date === 'week' && diffDays > 7) return false;
        if (activeFilters.date === 'month' && diffDays > 30) return false;
      }

      // Size Filter
      if (activeFilters.size.length > 0) {
        const sizeKB = f.size / 1024;
        const matchesSize = activeFilters.size.some(s => {
          if (s === 'small') return sizeKB < 100; // < 100KB
          if (s === 'medium') return sizeKB >= 100 && sizeKB < 1000; // 100KB - 1MB
          if (s === 'large') return sizeKB >= 1000 && sizeKB < 100000; // 1MB - 100MB
          if (s === 'huge') return sizeKB >= 100000; // > 100MB
          return true;
        });
        if (!matchesSize) return false;
      }

      // Tag Filter
      if (activeFilters.tags.length > 0) {
        if (!f.tags || f.tags.length === 0) return false;
        // Match ANY selected tag (OR logic)
        const matchesTag = activeFilters.tags.some(t => f.tags.includes(t));
        if (!matchesTag) return false;
      }

      // Favorites Filter
      if (activeFilters.favorites) {
        if (!f.isStarred) return false;
      }

      return true;
    });

    // Sorting
    return result.sort((a, b) => {
      let comparison = 0;
      switch (sortBy) {
        case 'relevance':
          comparison = (a.score || 0) - (b.score || 0);
          break;
        case 'date':
          comparison = (a.lastModified || 0) - (b.lastModified || 0);
          break;
        case 'size':
          comparison = (a.size || 0) - (b.size || 0);
          break;
        case 'name':
          comparison = a.name.localeCompare(b.name);
          break;
      }
      return sortOrder === 'asc' ? comparison : -comparison;
    });

  }, [files, activeFilters, sortBy, sortOrder]);

  // Pagination
  useEffect(() => setCurrentPage(1), [filteredAndSortedFiles]);

  const paginatedFiles = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredAndSortedFiles.slice(start, start + ITEMS_PER_PAGE);
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
    const tags = new Set<string>();
    files.forEach(f => {
      if (f.tags) f.tags.forEach((t: string) => tags.add(t));
    });
    return Array.from(tags).sort();
  }, [files]);

  // --- Sub-components ---
  const Sidebar = (
    <div className="flex flex-col h-full">
      <div className="p-5 border-b border-gray-100 bg-white">
        {/* Logo / Header */}
        <div className="flex items-center gap-3 text-indigo-700 font-bold mb-4">
          <img src="/logo.png" alt="Logo" className="w-8 h-8 rounded-lg shadow-sm" />
          <span className="text-lg">Smart File Explorer</span>
        </div>

        {/* Action Button */}
        {!isScanning && (
          <div className="mb-3">
            <HelperAlert
              title="Browser Restriction"
              message="Browsers prevent access to system folders (like C:\Windows or /usr). Please select a user folder (e.g., Documents or Projects)."
            />
          </div>
        )}

        {!isScanning ? (
          <button
            onClick={handleSelectFolder}
            className="w-full py-2.5 px-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg shadow-sm font-medium transition-all text-sm flex items-center justify-center gap-2"
          >
            <FolderOpen className="w-4 h-4" />
            Scan New Folder
          </button>
        ) : (
          <div className="text-sm text-gray-500 text-center py-2 animate-pulse">Scanning...</div>
        )}
      </div>

      {/* Progress Bar in Sidebar */}
      <div className="px-5 py-2 border-b border-gray-50">
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
        <div className="text-xs text-center text-gray-400 mt-2">
          {files.length} files indexed
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-5 pt-2 space-y-2">
        <div className="flex items-center justify-between text-xs font-bold text-gray-400 mb-2 uppercase tracking-wider">
          Filters
          {(activeFilters.types.length > 0 || activeFilters.date !== 'any' || activeFilters.size.length > 0 || activeFilters.tags.length > 0 || activeFilters.favorites) && (
            <button
              onClick={() => setActiveFilters({ types: [], date: 'any', size: [], tags: [], favorites: false })}
              className="text-indigo-600 hover:text-indigo-800 normal-case"
            >
              Clear All
            </button>
          )}
        </div>

        {/* Favorites Toggle */}
        <div className="mb-4">
          <button
            onClick={() => setActiveFilters(prev => ({ ...prev, favorites: !prev.favorites }))}
            className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${activeFilters.favorites
              ? 'bg-yellow-50 text-yellow-700 border border-yellow-200'
              : 'text-gray-600 hover:bg-gray-50 border border-transparent'
              }`}
          >
            <Star className={`w-4 h-4 ${activeFilters.favorites ? 'fill-yellow-500 text-yellow-500' : 'text-gray-400'}`} />
            Show Favorites Only
          </button>
        </div>

        <FilterSection
          title="File Type"
          selectedIds={activeFilters.types}
          onChange={toggleTypeFilter}
          options={[
            { id: 'doc', label: 'Documents', icon: <FileText className="w-3.5 h-3.5" />, count: files.filter(f => ['.pdf', '.docx', '.txt', '.md'].includes('.' + f.name.split('.').pop())).length },
            { id: 'code', label: 'Code Files', icon: <FileCode className="w-3.5 h-3.5" />, count: files.filter(f => ['.js', '.ts', '.tsx', '.py', '.json', '.html', '.css', '.xml', '.yaml', '.yml'].includes('.' + f.name.split('.').pop())).length },
            { id: 'image', label: 'Images', icon: <ImageIcon className="w-3.5 h-3.5" />, count: 0 },
          ]}
        />

        {uniqueTags.length > 0 && (
          <FilterSection
            title="Tags"
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
          title="Date Modified"
          type="radio"
          selectedIds={[activeFilters.date]}
          onChange={(id) => setActiveFilters(prev => ({ ...prev, date: id }))}
          options={[
            { id: 'any', label: 'Any time' },
            { id: 'today', label: 'Today' },
            { id: 'week', label: 'Last 7 days' },
            { id: 'month', label: 'Last 30 days' },
          ]}
        />

        <FilterSection
          title="File Size"
          selectedIds={activeFilters.size}
          onChange={toggleSizeFilter}
          options={[
            { id: 'small', label: 'Tiny (< 100 KB)' },
            { id: 'medium', label: 'Small (100 KB - 1 MB)' },
            { id: 'large', label: 'Medium (1 MB - 100 MB)' },
            { id: 'huge', label: 'Huge (> 100 MB)' },
          ]}
        />
      </div>

      <div className="p-4 border-t border-gray-100">
        <button onClick={handleClearIndex} className="w-full flex items-center justify-center gap-2 text-xs text-gray-400 hover:text-red-500 py-2 transition-colors">
          <RefreshCw className="w-3 h-3" /> Reset Index
        </button>
      </div>
    </div>
  );

  return (
    <ResizableLayout
      sidebar={Sidebar}
      content={
        <div className="flex flex-col h-full cursor-default">
          {/* Search Header */}
          <div className="p-6 border-b border-gray-100 bg-white sticky top-0 z-10">
            <SearchInput onSearch={handleSearch} isSearching={isSearching} />

            <div className="mt-4 flex items-center justify-between">
              <div className="text-xs text-gray-400">
                Showing {paginatedFiles.length} of {filteredAndSortedFiles.length} files
                {searchQuery && <span className="ml-1">for "{searchQuery}"</span>}
              </div>

              <div className="flex items-center gap-2">
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as any)}
                  className="text-xs border-none bg-gray-50 rounded px-2 py-1 text-gray-600 focus:ring-0 cursor-pointer"
                >
                  <option value="date">Date Modified</option>
                  <option value="size">File Size</option>
                  <option value="name">Name</option>
                </select>
                <button
                  onClick={handleToggleSort}
                  className="p-1 hover:bg-gray-100 rounded text-gray-400 hover:text-gray-600 transition-colors"
                  title={sortOrder === 'asc' ? "Ascending" : "Descending"}
                >
                  <ArrowUpDown className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>

          {/* File List */}
          <div className="flex-1 overflow-y-auto bg-white scroll-smooth relative">
            {paginatedFiles.length > 0 ? (
              <div
                key={currentPage}
                className="divide-y divide-gray-50 animate-fade-in-slide-up"
              >
                {paginatedFiles.map((file, idx) => (
                  <FileListItem
                    key={file.path || idx}
                    file={file}
                    score={file.score}
                    isSelected={selectedFile?.path === file.path}
                    onClick={() => setSelectedFile(file)}
                    onToggleStar={(e) => handleToggleStar(e, file.path)}
                  />
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-64 text-gray-400">
                <FolderOpen className="w-12 h-12 text-gray-200 mb-3" />
                <p>No files match your filters</p>
              </div>
            )}
          </div>

          {/* Footer Pagination */}
          <div className="p-4 border-t border-gray-100 bg-gray-50/50">
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
  );
}
