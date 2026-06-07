
import { useState, useCallback } from 'react';
import { FileText, FileCode, FileJson, FileType, Star, Image as ImageIcon, Music, Video, Archive } from 'lucide-react';
import { clsx } from 'clsx';
import { invoke, Channel } from '@tauri-apps/api/core';
import { writeFile, BaseDirectory } from '@tauri-apps/plugin-fs';
import { appCacheDir, join } from '@tauri-apps/api/path';
import { useTranslation } from '@/lib/i18n';
import {
    getReasonPresentation,
    getMatchPercentage,
    getToneClasses,
} from '@/lib/search/presentation';

interface FileListItemProps {
    file: any;
    score?: number;
    isSelected?: boolean;
    onClick: () => void;
    onToggleStar?: (e: React.MouseEvent) => void;
}

const FILE_TYPE_CONFIG: Record<string, { icon: any, color: string, label: string }> = {
    ts: { icon: FileCode, color: 'blue', label: 'TS' },
    tsx: { icon: FileCode, color: 'blue', label: 'TSX' },
    js: { icon: FileCode, color: 'yellow', label: 'JS' },
    jsx: { icon: FileCode, color: 'yellow', label: 'JSX' },
    json: { icon: FileJson, color: 'orange', label: 'JSON' },
    css: { icon: FileType, color: 'pink', label: 'CSS' },
    html: { icon: FileCode, color: 'orange', label: 'HTML' },
    pdf: { icon: FileText, color: 'red', label: 'PDF' },
    doc: { icon: FileText, color: 'blue', label: 'DOC' },
    docx: { icon: FileText, color: 'blue', label: 'DOCX' },
    txt: { icon: FileText, color: 'gray', label: 'TXT' },
    md: { icon: FileText, color: 'gray', label: 'MD' },
    jpg: { icon: ImageIcon, color: 'purple', label: 'JPG' },
    png: { icon: ImageIcon, color: 'purple', label: 'PNG' },
    svg: { icon: ImageIcon, color: 'purple', label: 'SVG' },
    mp3: { icon: Music, color: 'green', label: 'MP3' },
    mp4: { icon: Video, color: 'green', label: 'MP4' },
    zip: { icon: Archive, color: 'gray', label: 'ZIP' },
};

const COLOR_HEX: Record<string, { bg: string; fg: string }> = {
    blue:   { bg: '#dbeafe', fg: '#2563eb' },
    yellow: { bg: '#fef9c3', fg: '#ca8a04' },
    orange: { bg: '#ffedd5', fg: '#ea580c' },
    pink:   { bg: '#fce7f3', fg: '#db2777' },
    red:    { bg: '#fee2e2', fg: '#dc2626' },
    gray:   { bg: '#f3f4f6', fg: '#4b5563' },
    purple: { bg: '#f3e8ff', fg: '#9333ea' },
    green:  { bg: '#dcfce7', fg: '#16a34a' },
};

/** Render a drag-ghost on a canvas and return its data-URL */
function createDragImage(fileName: string, color: string): string {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d')!;
    const dpr = window.devicePixelRatio || 1;
    const w = 240, h = 48;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    ctx.scale(dpr, dpr);

    // Rounded-rect background
    const r = 10;
    ctx.beginPath();
    ctx.moveTo(r, 0); ctx.lineTo(w - r, 0); ctx.quadraticCurveTo(w, 0, w, r);
    ctx.lineTo(w, h - r); ctx.quadraticCurveTo(w, h, w - r, h);
    ctx.lineTo(r, h); ctx.quadraticCurveTo(0, h, 0, h - r);
    ctx.lineTo(0, r); ctx.quadraticCurveTo(0, 0, r, 0);
    ctx.closePath();
    ctx.fillStyle = 'rgba(255,255,255,0.92)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(99,102,241,0.3)';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Icon circle
    const c = COLOR_HEX[color] || COLOR_HEX.gray;
    ctx.beginPath(); ctx.arc(28, h / 2, 14, 0, Math.PI * 2);
    ctx.fillStyle = c.bg; ctx.fill();

    // Simple file-document icon
    ctx.fillStyle = c.fg;
    ctx.beginPath();
    ctx.moveTo(22, 16); ctx.lineTo(30, 16); ctx.lineTo(34, 20);
    ctx.lineTo(34, 32); ctx.lineTo(22, 32); ctx.closePath(); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.6)';
    ctx.beginPath();
    ctx.moveTo(30, 16); ctx.lineTo(34, 20); ctx.lineTo(30, 20); ctx.closePath(); ctx.fill();

    // Filename
    ctx.fillStyle = '#1f2937';
    ctx.font = '600 13px Inter, system-ui, sans-serif';
    const label = fileName.length > 22 ? fileName.slice(0, 20) + '\u2026' : fileName;
    ctx.fillText(label, 50, h / 2 + 5);

    return canvas.toDataURL('image/png');
}

export function FileListItem({ file, score, isSelected, onClick, onToggleStar }: FileListItemProps) {
    const { t } = useTranslation();
    const ext = file.name.split('.').pop()?.toLowerCase() || 'txt';
    const config = FILE_TYPE_CONFIG[ext] || { icon: FileText, color: 'gray', label: ext.toUpperCase() };
    const Icon = config.icon;
    const [isDragging, setIsDragging] = useState(false);
    const visibleFactors = Array.isArray(file.factors)
        ? file.factors.slice(0, 3)
        : (Array.isArray(file.reasons) ? file.reasons.slice(0, 3).map((reason: string) => ({ code: reason })) : []);
    const remainingFactorCount = Array.isArray(file.factors)
        ? Math.max(0, file.factors.length - visibleFactors.length)
        : (Array.isArray(file.reasons) ? Math.max(0, file.reasons.length - visibleFactors.length) : 0);

    const colorStyles: Record<string, string> = {
        blue: 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400',
        yellow: 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-600 dark:text-yellow-400',
        orange: 'bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400',
        pink: 'bg-pink-100 dark:bg-pink-900/30 text-pink-600 dark:text-pink-400',
        red: 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400',
        gray: 'bg-secondary text-muted-foreground',
        purple: 'bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400',
        green: 'bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400',
    };
    const colorClass = colorStyles[config.color] || colorStyles.gray;

    const ghostColorStyles: Record<string, string> = {
        blue: 'rgba(37, 99, 235, 0.15)',
        yellow: 'rgba(202, 138, 4, 0.15)',
        orange: 'rgba(234, 88, 12, 0.15)',
        pink: 'rgba(219, 39, 119, 0.15)',
        red: 'rgba(220, 38, 38, 0.15)',
        gray: 'rgba(75, 85, 99, 0.15)',
        purple: 'rgba(147, 51, 234, 0.15)',
        green: 'rgba(22, 163, 74, 0.15)',
    };
    const ghostOverlayColor = ghostColorStyles[config.color] || ghostColorStyles.gray;

    const handleDragStart = useCallback(async (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(true);

        const dragImgUrl = createDragImage(file.name, config.color);
        
        try {
            // More robust base64 conversion
            const res = await fetch(dragImgUrl);
            const blob = await res.blob();
            const bytes = new Uint8Array(await blob.arrayBuffer());
            
            // Save to cache file
            const safeName = file.name.replace(/[^a-zA-Z0-9.\-_]/g, '_');
            const tmpFileName = `drag_ghost_${Date.now()}_${safeName}.png`;
            await writeFile(tmpFileName, bytes, { baseDir: BaseDirectory.Cache });
            
            const cacheDirStr = await join(await invoke('plugin:path|get_app_cache_dir'), ''); 
            // Better way to get path in v2 if path plugin is available, otherwise join works with strings
            // Let's try to get the full path reliably
            const fullPath = await join(await invoke('plugin:path|get_app_cache_dir') as string, tmpFileName);

            const channel = new Channel();
            channel.onmessage = () => {
                setIsDragging(false);
            };

            await invoke('plugin:drag|start_drag', {
                item: [file.path],
                image: fullPath,
                onEvent: channel,
            });
        } catch (err) {
            console.error('Failed to start native drag:', err);
            setIsDragging(false);
        }
    }, [file.path, file.name, config.color]);

    const formatSize = (bytes: number) => {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
    };

    const formatDate = (ms: number) =>
        new Date(ms).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });

    return (
        <div
            draggable
            onDragStart={handleDragStart}
            onClick={onClick}
            className={clsx(
                'group relative flex items-start p-4 cursor-pointer transition-all border-b-2 border-border hover:bg-muted',
                isSelected
                    ? 'bg-secondary border-l-4 border-l-border shadow-inner'
                    : 'bg-card border-l-4 border-l-transparent pl-[calc(1rem+4px)]',
            )}
        >
            {/* Tinted overlay on source row while dragging, matching icon color accurately */}
            {isDragging && (
                <div 
                    className="absolute inset-0 z-20 pointer-events-none rounded-sm border-2 border-dashed border-white/20" 
                    style={{ backgroundColor: ghostOverlayColor }}
                />
            )}

            {/* File Icon Box */}
            <div className={clsx('shrink-0 mr-4 h-12 w-12 rounded-xl flex items-center justify-center shadow-sm', colorClass)}>
                <Icon className="h-6 w-6" />
            </div>

            <div className="min-w-0 flex-1 space-y-1">
                <div className="flex justify-between items-start">
                    <h4 className={clsx('text-base font-semibold truncate pr-8', isSelected ? 'font-head text-foreground' : 'text-foreground')}>
                        {file.name}
                    </h4>
                    <div className="flex items-center gap-2 shrink-0">
                        {score !== undefined && (
                            <span className="text-xs font-semibold text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/30 px-2 py-0.5 rounded-full border border-emerald-100 dark:border-emerald-800 shadow-sm">
                                {getMatchPercentage(score)}%
                            </span>
                        )}
                    </div>
                </div>

                <p className="text-xs text-muted-foreground truncate font-mono inline-block">{file.path}</p>

                <div className="flex items-center gap-3 text-xs text-muted-foreground pt-1">
                    <span className={clsx('font-bold text-[10px] px-1.5 py-0.5 rounded uppercase', colorClass.replace('bg-', 'bg-opacity-20 bg-'))}>
                        {config.label}
                    </span>
                    <span className="w-1 h-1 rounded-full bg-border" />
                    <span className="flex items-center gap-1">
                        {t('size')}: <span className="font-medium text-foreground">{formatSize(file.size)}</span>
                    </span>
                    <span className="w-1 h-1 rounded-full bg-border" />
                    <span className="flex items-center gap-1">
                        {t('modified')}: <span className="font-medium text-foreground">{formatDate(file.lastModified)}</span>
                    </span>
                </div>

                {(file.isLikelyLatest || visibleFactors.length > 0) && (
                    <div className="flex flex-wrap items-center gap-2 pt-2">
                        {file.isLikelyLatest && (
                            <span className="text-[11px] font-medium text-foreground bg-secondary px-2 py-1 rounded border-2 border-border">
                                {t('likely_latest_version')}
                            </span>
                        )}
                        {visibleFactors.map((factor: any) => {
                            const presentation = getReasonPresentation(factor.code as any);
                            const tone = getToneClasses(presentation.tone);
                            const tooltip = Array.isArray(factor.evidence) && factor.evidence.length > 0
                                ? factor.evidence.join('\n')
                                : t(presentation.descriptionKey);

                            return (
                                <span
                                    key={factor.code}
                                    title={tooltip}
                                    className={`text-[11px] font-medium px-2 py-1 rounded-full border ${tone.badge}`}
                                >
                                    {t(presentation.labelKey)}
                                </span>
                            );
                        })}
                        {remainingFactorCount > 0 && (
                            <span className="text-[11px] font-medium px-2 py-1 rounded border-2 border-border bg-muted text-foreground">
                                {t('match_more_factors', { count: remainingFactorCount })}
                            </span>
                        )}
                    </div>
                )}

                {file.snippet && (
                    <div className="mt-2 border-l-2 border-border pl-3">
                        {file.locationLabel && (
                            <p className="text-[11px] font-semibold uppercase tracking-wide text-primary mb-1">
                                {file.locationLabel}
                            </p>
                        )}
                        <p className="text-sm text-gray-600 dark:text-gray-400 line-clamp-2 leading-relaxed italic">
                            &quot;...{file.snippet}...&quot;
                        </p>
                    </div>
                )}
            </div>

            <div className="flex flex-col items-end gap-2 ml-4">
                <button
                    onClick={(e) => { e.stopPropagation(); onToggleStar?.(e); }}
                    className={clsx(
                        'p-1.5 rounded border-2 border-transparent transition-colors hover:border-border hover:bg-muted',
                        file.isStarred ? 'text-secondary-foreground fill-secondary-foreground bg-secondary border-border' : 'text-muted-foreground hover:text-foreground',
                    )}
                >
                    <Star className={clsx('h-5 w-5', file.isStarred && 'fill-current')} />
                </button>
            </div>
        </div>
    );
}
