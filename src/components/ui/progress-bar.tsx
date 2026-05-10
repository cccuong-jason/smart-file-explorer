import React from 'react';
import { FileText, Loader2, Pause, Play } from 'lucide-react';

import type { ScanSessionPhase } from '@/lib/file-system/scan-session';

interface ProgressBarProps {
  isScanning: boolean;
  phase: ScanSessionPhase;
  discoveredCount: number;
  processedCount: number;
  totalKnownCount: number;
  currentPath: string;
  isPaused?: boolean;
  onTogglePause?: () => void;
}

function getTitle(phase: ScanSessionPhase, isPaused?: boolean) {
  if (isPaused) {
    return 'Paused';
  }

  switch (phase) {
    case 'discovering':
      return 'Discovering files...';
    case 'indexing':
      return 'Indexing files...';
    case 'finalizing':
      return 'Finalizing scan...';
    default:
      return 'Scanning...';
  }
}

export function ProgressBar({
  isScanning,
  phase,
  discoveredCount,
  processedCount,
  totalKnownCount,
  currentPath,
  isPaused,
  onTogglePause,
}: ProgressBarProps) {
  if (!isScanning) {
    return null;
  }

  const showIndexedProgress = phase !== 'discovering' && totalKnownCount > 0;
  const percentage = showIndexedProgress
    ? Math.min(100, (processedCount / totalKnownCount) * 100)
    : 0;
  const title = getTitle(phase, isPaused);
  const detailCount = phase === 'discovering'
    ? `${discoveredCount.toLocaleString()} found`
    : `${processedCount.toLocaleString()} / ${totalKnownCount.toLocaleString()}`;

  return (
    <div className="w-full space-y-2">
      <div className="flex items-center justify-between text-xs text-gray-500">
        <div className="flex items-center gap-2">
          <span className="flex items-center gap-1 font-semibold text-indigo-600">
            {isPaused ? 'Paused' : <Loader2 className="h-3 w-3 animate-spin" />}
            {isPaused ? '' : title}
          </span>
        </div>
        <div className="flex items-center gap-3">
          <span className="font-medium">{detailCount}</span>
          {showIndexedProgress ? (
            <span className="font-bold text-indigo-600">{percentage.toFixed(0)}%</span>
          ) : null}
        </div>
      </div>

      <div className="relative flex h-2 w-full items-center overflow-hidden rounded-full bg-gray-100">
        {showIndexedProgress ? (
          <div
            className={`h-full bg-indigo-500 transition-all duration-300 ${isPaused ? 'opacity-50' : ''}`}
            style={{ width: `${percentage}%` }}
          />
        ) : (
          <div className="absolute inset-0 w-full animate-pulse bg-indigo-500/20" />
        )}
      </div>

      <div className="flex items-start justify-between">
        <div className="flex max-w-[70%] items-center gap-2 truncate font-mono text-xs text-gray-400">
          <FileText className="h-3 w-3 shrink-0" />
          <span className="truncate" title={currentPath}>
            {currentPath || 'Waiting for files...'}
          </span>
        </div>

        {onTogglePause ? (
          <button
            onClick={onTogglePause}
            className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-gray-400 transition-colors hover:text-indigo-600"
          >
            {isPaused ? <Play className="h-3 w-3" /> : <Pause className="h-3 w-3" />}
            {isPaused ? 'Resume' : 'Pause'}
          </button>
        ) : null}
      </div>
    </div>
  );
}
