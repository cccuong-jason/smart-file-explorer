import { FileText, Calendar, HardDrive, ExternalLink, Tag, Link2, Copy, FileCode, FileJson, FileType, Image as ImageIcon, Music, Video, Archive } from 'lucide-react';
import { useToast } from '@/components/ui/toast';
import { TagInput } from '@/components/ui/tag-input';
import { addFileTag, removeFileTag } from '@/lib/file-system/db';
import { findRelatedFiles } from '@/lib/search/engine';
import { useState, useEffect } from 'react';
import { CopyPathInstructionModal } from '@/components/ui/copy-path-modal';
import { useTranslation } from '@/lib/i18n';

interface FilePreviewPanelProps {
    file: any | null;
    onTagsChange?: (path: string, newTags: string[]) => void;
    onSelectFile?: (file: any) => void;
}

const FILE_TYPE_CONFIG: Record<string, { icon: any, color: string, label: string }> = {
    // Code
    ts: { icon: FileCode, color: 'text-blue-600 bg-blue-50', label: 'TS' },
    tsx: { icon: FileCode, color: 'text-blue-600 bg-blue-50', label: 'TSX' },
    js: { icon: FileCode, color: 'text-yellow-600 bg-yellow-50', label: 'JS' },
    jsx: { icon: FileCode, color: 'text-yellow-600 bg-yellow-50', label: 'JSX' },
    json: { icon: FileJson, color: 'text-orange-600 bg-orange-50', label: 'JSON' },
    css: { icon: FileType, color: 'text-pink-600 bg-pink-50', label: 'CSS' },
    html: { icon: FileCode, color: 'text-orange-600 bg-orange-50', label: 'HTML' },
    // Docs
    pdf: { icon: FileText, color: 'text-red-600 bg-red-50', label: 'PDF' },
    doc: { icon: FileText, color: 'text-blue-600 bg-blue-50', label: 'DOC' },
    docx: { icon: FileText, color: 'text-blue-600 bg-blue-50', label: 'DOCX' },
    txt: { icon: FileText, color: 'text-gray-600 bg-gray-50', label: 'TXT' },
    md: { icon: FileText, color: 'text-gray-600 bg-gray-50', label: 'MD' },
    // Media
    jpg: { icon: ImageIcon, color: 'text-purple-600 bg-purple-50', label: 'JPG' },
    png: { icon: ImageIcon, color: 'text-purple-600 bg-purple-50', label: 'PNG' },
    // Default
    unknown: { icon: FileText, color: 'text-gray-400 bg-gray-50', label: 'FILE' }
};

export function FilePreviewPanel({ file, onTagsChange, onSelectFile }: FilePreviewPanelProps) {
    const { toast } = useToast();
    const { t, language } = useTranslation();
    const [relatedFiles, setRelatedFiles] = useState<{ file: any; score: number }[]>([]);
    const [isCopyModalOpen, setIsCopyModalOpen] = useState(false);

    useEffect(() => {
        if (file?.embedding) {
            findRelatedFiles(file).then(setRelatedFiles);
        } else {
            setRelatedFiles([]);
        }
    }, [file]);

    if (!file) {
        return (
            <div className="h-full flex flex-col items-center justify-center text-gray-400 dark:text-gray-500 p-8 text-center">
                <div className="h-16 w-16 bg-gray-100 dark:bg-gray-800 rounded-2xl flex items-center justify-center mb-4">
                    <FileText className="h-8 w-8 text-gray-300 dark:text-gray-600" />
                </div>
                <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">{t('preview_empty_title')}</h3>
                <p className="text-sm mt-1">{t('preview_empty_description')}</p>
            </div>
        );
    }

    const handleCopyPath = () => {
        navigator.clipboard.writeText(file.path);
        toast(t('path_copied'), 'success');
        setIsCopyModalOpen(true); // Show instruction modal
    };

    const handleAddTag = async (tag: string) => {
        try {
            const newTags = await addFileTag(file.path, tag);
            onTagsChange?.(file.path, newTags);
            toast(t('tag_added', { tag }), 'success');
        } catch (error) {
            console.error(error);
            toast(t('tag_add_failed'), 'error');
        }
    };

    const handleRemoveTag = async (tag: string) => {
        try {
            const newTags = await removeFileTag(file.path, tag);
            onTagsChange?.(file.path, newTags);
            toast(t('tag_removed', { tag }), 'info');
        } catch (error) {
            console.error(error);
            toast(t('tag_remove_failed'), 'error');
        }
    };

    // Resolve Icon
    const ext = file.name.split('.').pop()?.toLowerCase() || 'unknown';
    const config = FILE_TYPE_CONFIG[ext] || FILE_TYPE_CONFIG['unknown'];
    const HeaderIcon = config.icon;
    const locale = language === 'vi' ? 'vi-VN' : 'en-US';

    return (
        <div className="h-full flex flex-col bg-white dark:bg-gray-950">
            <CopyPathInstructionModal
                isOpen={isCopyModalOpen}
                onClose={() => setIsCopyModalOpen(false)}
                path={file.path}
            />

            {/* Header */}
            <div className="p-6 border-b border-gray-100 dark:border-gray-800">
                <div className={`h-12 w-12 rounded-xl flex items-center justify-center mb-4 ${config.color}`}>
                    <HeaderIcon className="h-6 w-6" />
                </div>
                <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 break-words">{file.name}</h2>
                <div className="flex items-center gap-2 mt-1">
                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded uppercase ${config.color.replace('text-', 'text-opacity-80 text-').replace('bg-', 'bg-opacity-50 bg-')}`}>
                        {config.label}
                    </span>
                    <p className="text-sm text-gray-500 dark:text-gray-400 font-mono break-all line-clamp-1">{file.path}</p>
                </div>
            </div>

            {/* actions */}
            <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-800 flex gap-2">
                <button
                    onClick={handleCopyPath}
                    className="flex-1 flex items-center justify-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 transition-colors font-medium text-sm shadow-sm hover:shadow active:scale-[0.98]"
                >
                    <Copy className="h-4 w-4" />
                    {t('copy_path')}
                </button>
                <button
                    onClick={async () => {
                        try {
                            const { invoke } = await import('@tauri-apps/api/core');
                            await invoke('open_file_native', { path: file.path });
                        } catch (e) {
                            console.error("Failed to open file", e);
                            toast(t('open_file_failed'), 'error');
                        }
                    }}
                    className="flex-1 flex items-center justify-center gap-2 bg-emerald-600 text-white px-4 py-2 rounded-lg hover:bg-emerald-700 transition-colors font-medium text-sm shadow-sm hover:shadow active:scale-[0.98]"
                >
                    <ExternalLink className="h-4 w-4" />
                    {t('open_natively')}
                </button>
            </div>

            {/* Metadata */}
            <div className="p-6 space-y-4 border-b border-gray-100 dark:border-gray-800">
                <h3 className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider">{t('file_information')}</h3>

                <div className="flex items-center gap-3 text-sm">
                    <HardDrive className="h-4 w-4 text-gray-400 dark:text-gray-500" />
                    <span className="text-gray-600 dark:text-gray-300">{t('size')}:</span>
                    <span className="font-medium text-gray-900 dark:text-gray-100">{(file.size / 1024).toFixed(2)} KB</span>
                </div>

                <div className="flex items-center gap-3 text-sm">
                    <Calendar className="h-4 w-4 text-gray-400 dark:text-gray-500" />
                    <span className="text-gray-600 dark:text-gray-300">{t('modified')}:</span>
                    <span className="font-medium text-gray-900 dark:text-gray-100">{new Date(file.lastModified).toLocaleDateString(locale)}</span>
                </div>

                {/* Inline Tags */}
                <div className="flex items-start gap-3 text-sm">
                    <Tag className="h-4 w-4 text-gray-400 dark:text-gray-500 mt-1.5 shrink-0" />
                    <div className="flex-1 flex flex-wrap items-center gap-2 mt-0.5">
                        <span className="text-gray-600 dark:text-gray-300 mr-1">{t('tags')}:</span>
                        <TagInput
                            tags={file.tags || []}
                            onAddTag={handleAddTag}
                            onRemoveTag={handleRemoveTag}
                        />
                    </div>
                </div>
            </div>

            {/* Content Preview */}
            <div className="flex-1 overflow-auto p-6 bg-gray-50/50 dark:bg-gray-900/40">
                <h3 className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-3">{t('preview')}</h3>
                {file.content ? (
                    <pre className="text-xs font-mono text-gray-700 dark:text-gray-200 whitespace-pre-wrap break-words bg-white dark:bg-gray-950 p-4 rounded-lg border border-gray-200 dark:border-gray-800 shadow-sm transition-all hover:border-indigo-200 dark:hover:border-indigo-800">
                        {file.content.slice(0, 2000)}
                        {file.content.length > 2000 && <span className="text-gray-400 dark:text-gray-500 italic block mt-2">{t('preview_truncated')}</span>}
                    </pre>
                ) : (
                    <div className="flex flex-col items-center justify-center h-32 text-gray-400 dark:text-gray-500 text-sm italic">
                        {t('preview_not_available')}
                    </div>
                )}

                {/* Related Files */}
                {relatedFiles.length > 0 && (
                    <div className="mt-8 pt-6 border-t border-gray-200 dark:border-gray-800">
                        <div className="flex items-center gap-2 mb-4 text-indigo-700 dark:text-indigo-300">
                            <Link2 className="w-4 h-4" />
                            <h3 className="text-xs font-bold uppercase tracking-wider">{t('related_files')}</h3>
                        </div>
                        <div className="space-y-2">
                            {relatedFiles.map(({ file: related, score }) => (
                                <div
                                    key={related.path}
                                    onClick={() => onSelectFile?.(related)}
                                    className="flex items-start gap-3 p-3 bg-white dark:bg-gray-950 rounded-lg border border-gray-100 dark:border-gray-800 hover:border-indigo-200 dark:hover:border-indigo-800 hover:shadow-sm cursor-pointer transition-all group active:scale-[0.99]"
                                >
                                    <div className="p-1.5 bg-indigo-50 dark:bg-indigo-950/50 rounded-md text-indigo-600 dark:text-indigo-300 group-hover:bg-indigo-100 dark:group-hover:bg-indigo-900/60 transition-colors">
                                        <FileText className="w-4 h-4" />
                                    </div>
                                    <div className="min-w-0 flex-1">
                                        <div className="flex items-center justify-between gap-2">
                                            <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate group-hover:text-indigo-700 dark:group-hover:text-indigo-300 transition-colors">{related.name}</p>
                                            <span className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/50 px-1.5 py-0.5 rounded-full shrink-0">
                                                {(score * 100).toFixed(0)}%
                                            </span>
                                        </div>
                                        <p className="text-xs text-gray-500 dark:text-gray-400 truncate mt-0.5">{related.path}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
