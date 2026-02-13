import React from 'react';
import { Loader2, Pause, Play, FileText } from 'lucide-react';

interface ProgressBarProps {
    isScanning: boolean;
    processedCount: number;
    totalCount?: number;
    currentFile: string;
    isPaused?: boolean;
    onTogglePause?: () => void;
}

export function ProgressBar({ isScanning, processedCount, totalCount, currentFile, isPaused, onTogglePause }: ProgressBarProps) {
    if (!isScanning) return null;

    const percentage = totalCount && totalCount > 0
        ? Math.min(100, (processedCount / totalCount) * 100)
        : 0;

    return (
        <div className="w-full space-y-2">
            <div className="flex justify-between items-center text-xs text-gray-500">
                <div className="flex items-center gap-2">
                    <span className="font-semibold text-indigo-600 flex items-center gap-1">
                        {isPaused ? 'Paused' : <Loader2 className="w-3 h-3 animate-spin" />}
                        {isPaused ? '' : 'Indexing...'}
                    </span>
                </div>
                <div className="flex items-center gap-3">
                    <span className="font-medium">
                        {processedCount} {totalCount ? `/ ${totalCount}` : ''}
                    </span>
                    {totalCount && (
                        <span className="text-indigo-600 font-bold">
                            {percentage.toFixed(0)}%
                        </span>
                    )}
                </div>
            </div>

            <div className="h-2 w-full bg-gray-100 rounded-full overflow-hidden flex items-center relative">
                <div
                    className={`h-full bg-indigo-500 transition-all duration-300 ${isPaused ? 'opacity-50' : ''}`}
                    style={{ width: `${totalCount ? percentage : '0'}%` }}
                />
                {!totalCount && !isPaused && (
                    <div className="absolute inset-0 bg-indigo-500/20 animate-pulse w-full" />
                )}
            </div>

            <div className="flex justify-between items-start">
                <div className="flex items-center gap-2 text-xs text-gray-400 font-mono truncate max-w-[70%]">
                    <FileText className="h-3 w-3 shrink-0" />
                    <span className="truncate" title={currentFile}>{currentFile || 'Initializing...'}</span>
                </div>

                {onTogglePause && (
                    <button
                        onClick={onTogglePause}
                        className="flex items-center gap-1 text-[10px] uppercase font-bold tracking-wider text-gray-400 hover:text-indigo-600 transition-colors"
                    >
                        {isPaused ? <Play className="w-3 h-3" /> : <Pause className="w-3 h-3" />}
                        {isPaused ? 'Resume' : 'Pause'}
                    </button>
                )}
            </div>
        </div>
    );
}
