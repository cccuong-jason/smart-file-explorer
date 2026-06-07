import React from 'react';
import { FileText, Pause, Play } from '@/components/icons';

import { Button } from '@/components/retroui/Button';
import { Loader } from '@/components/retroui/Loader';
import { Progress } from '@/components/retroui/Progress';
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
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <div className="flex items-center gap-2">
          <span className="flex items-center gap-1 font-semibold text-primary">
            {isPaused ? 'Paused' : <Loader size="sm" aria-label="Scanning" className="scale-75" />}
            {isPaused ? '' : title}
          </span>
        </div>
        <div className="flex items-center gap-3">
          <span className="font-medium">{detailCount}</span>
          {showIndexedProgress ? (
            <span className="font-bold text-primary">{percentage.toFixed(0)}%</span>
          ) : null}
        </div>
      </div>

      <div className="relative flex h-3 w-full items-center overflow-hidden rounded border-2 border-border bg-muted">
        {showIndexedProgress ? (
          <Progress value={percentage} className={`h-full border-0 bg-transparent ${isPaused ? 'opacity-50' : ''}`} />
        ) : (
          <div className="absolute inset-0 w-full animate-pulse bg-primary/25" />
        )}
      </div>

      <div className="flex items-start justify-between">
        <div className="flex max-w-[70%] items-center gap-2 truncate font-mono text-xs text-muted-foreground">
          <FileText className="h-3 w-3 shrink-0" />
          <span className="truncate" title={currentPath}>
            {currentPath || 'Waiting for files...'}
          </span>
        </div>

        {onTogglePause ? (
          <Button
            variant="outline"
            size="sm"
            onClick={onTogglePause}
            className="gap-1 px-2 py-0.5 text-[10px] uppercase"
          >
            {isPaused ? <Play className="h-3 w-3" /> : <Pause className="h-3 w-3" />}
            {isPaused ? 'Resume' : 'Pause'}
          </Button>
        ) : null}
      </div>
    </div>
  );
}
