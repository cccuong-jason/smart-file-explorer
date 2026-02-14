
import { FileText, FileCode, FileJson, FileType, Star, Image as ImageIcon, Music, Video, Archive } from 'lucide-react';
import { clsx } from 'clsx';

interface FileListItemProps {
    file: any;
    score?: number;
    isSelected?: boolean;
    onClick: () => void;
    onToggleStar?: (e: React.MouseEvent) => void;
}

const FILE_TYPE_CONFIG: Record<string, { icon: any, color: string, label: string }> = {
    // Code
    ts: { icon: FileCode, color: 'blue', label: 'TS' },
    tsx: { icon: FileCode, color: 'blue', label: 'TSX' },
    js: { icon: FileCode, color: 'yellow', label: 'JS' },
    jsx: { icon: FileCode, color: 'yellow', label: 'JSX' },
    json: { icon: FileJson, color: 'orange', label: 'JSON' },
    css: { icon: FileType, color: 'pink', label: 'CSS' },
    html: { icon: FileCode, color: 'orange', label: 'HTML' },
    // Docs
    pdf: { icon: FileText, color: 'red', label: 'PDF' },
    doc: { icon: FileText, color: 'blue', label: 'DOC' },
    docx: { icon: FileText, color: 'blue', label: 'DOCX' },
    txt: { icon: FileText, color: 'gray', label: 'TXT' },
    md: { icon: FileText, color: 'gray', label: 'MD' },
    // Media
    jpg: { icon: ImageIcon, color: 'purple', label: 'JPG' },
    png: { icon: ImageIcon, color: 'purple', label: 'PNG' },
    svg: { icon: ImageIcon, color: 'purple', label: 'SVG' },
    mp3: { icon: Music, color: 'green', label: 'MP3' },
    mp4: { icon: Video, color: 'green', label: 'MP4' },
    zip: { icon: Archive, color: 'gray', label: 'ZIP' },
};

export function FileListItem({ file, score, isSelected, onClick, onToggleStar }: FileListItemProps) {
    const ext = file.name.split('.').pop()?.toLowerCase() || 'txt';
    const config = FILE_TYPE_CONFIG[ext] || { icon: FileText, color: 'gray', label: ext.toUpperCase() };
    const Icon = config.icon;

    // Tailwind Safelist workaround (if not using full JIT or safe-listing dynamic classes)
    // We'll use inline styles or specific class maps if needed. For now, assuming JIT works with dynamic template literals if they are simple,
    // BUT dynamic classes like `bg-${color}-100` often fail if purge doesn't see them.
    // Let's use a strict map for colors to be safe.
    const colorStyles: Record<string, string> = {
        blue: 'bg-blue-100 text-blue-600',
        yellow: 'bg-yellow-100 text-yellow-600',
        orange: 'bg-orange-100 text-orange-600',
        pink: 'bg-pink-100 text-pink-600',
        red: 'bg-red-100 text-red-600',
        gray: 'bg-gray-100 text-gray-600',
        purple: 'bg-purple-100 text-purple-600',
        green: 'bg-green-100 text-green-600',
    };

    const colorClass = colorStyles[config.color] || colorStyles['gray'];

    const formatSize = (bytes: number) => {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
    };

    const formatDate = (ms: number) => {
        return new Date(ms).toLocaleDateString(undefined, {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        });
    };

    return (
        <div
            onClick={onClick}
            className={clsx(
                "group relative flex items-start p-4 cursor-pointer transition-all border-b border-gray-50 hover:bg-gray-50",
                isSelected ? "bg-indigo-50/50 border-l-4 border-l-indigo-600" : "border-l-4 border-l-transparent pl-[calc(1rem+4px)]"
            )}
        >
            {/* File Icon Box */}
            <div className={clsx(
                "shrink-0 mr-4 h-12 w-12 rounded-xl flex items-center justify-center shadow-sm",
                colorClass
            )}>
                <Icon className="h-6 w-6" />
            </div>

            <div className="min-w-0 flex-1 space-y-1">
                {/* Header: Name & Score */}
                <div className="flex justify-between items-start">
                    <h4 className={clsx(
                        "text-base font-semibold truncate pr-8",
                        isSelected ? "text-indigo-700" : "text-gray-900"
                    )}>
                        {file.name}
                    </h4>
                    {score !== undefined && (
                        <span className="text-xs font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full shrink-0 border border-emerald-100 shadow-sm">
                            {Math.min(Math.round(score * 100), 100)}% Match
                        </span>
                    )}
                </div>

                {/* Path */}
                <p className="text-xs text-gray-400 truncate font-mono inline-block">
                    {file.path}
                </p>

                {/* Metadata Row */}
                <div className="flex items-center gap-3 text-xs text-gray-500 pt-1">
                    <span className={clsx("font-bold text-[10px] px-1.5 py-0.5 rounded uppercase", colorClass.replace('bg-', 'bg-opacity-20 bg-'))}>
                        {config.label}
                    </span>
                    <span className="w-1 h-1 rounded-full bg-gray-300" />
                    <span className="flex items-center gap-1">
                        Size: <span className="font-medium text-gray-700">{formatSize(file.size)}</span>
                    </span>
                    <span className="w-1 h-1 rounded-full bg-gray-300" />
                    <span className="flex items-center gap-1">
                        Modified: <span className="font-medium text-gray-700">{formatDate(file.lastModified)}</span>
                    </span>
                </div>

                {/* Snippet (Optional: if we had snippet data) */}
                {file.snippet && (
                    <p className="text-sm text-gray-600 mt-2 line-clamp-2 leading-relaxed border-l-2 border-gray-200 pl-3 italic">
                        "...{file.snippet}..."
                    </p>
                )}
            </div>

            {/* Actions: Star & Arrow */}
            <div className="flex flex-col items-end gap-2 ml-4">
                <button
                    onClick={(e) => {
                        e.stopPropagation();
                        onToggleStar?.(e);
                    }}
                    className={clsx(
                        "p-1.5 rounded-full transition-colors hover:bg-gray-200",
                        file.isStarred ? "text-amber-400 fill-amber-400" : "text-gray-300 hover:text-gray-400"
                    )}
                >
                    <Star className={clsx("h-5 w-5", file.isStarred && "fill-current")} />
                </button>
            </div>
        </div>
    );
}
