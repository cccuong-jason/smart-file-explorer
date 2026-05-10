import { useEffect, useState } from 'react';
import { FileText, FileCode, FileJson, FileType, Image as ImageIcon, ExternalLink, X, HardDrive, Calendar } from 'lucide-react';
import { invoke } from '@tauri-apps/api/core';
import { useTranslation } from '@/lib/i18n';
import { getPreviewAssetUrl, getPreviewMode } from './preview-utils';
import { readLocalFileAsObjectUrl, revokeLocalFileUrl } from '@/lib/file-system/local-file-data';

interface QuickLookModalProps {
    isOpen: boolean;
    onClose: () => void;
    file: any | null;
}

const FILE_TYPE_CONFIG: Record<string, { icon: any, color: string, label: string }> = {
    ts: { icon: FileCode, color: 'text-blue-600 bg-blue-50', label: 'TS' },
    tsx: { icon: FileCode, color: 'text-blue-600 bg-blue-50', label: 'TSX' },
    js: { icon: FileCode, color: 'text-yellow-600 bg-yellow-50', label: 'JS' },
    jsx: { icon: FileCode, color: 'text-yellow-600 bg-yellow-50', label: 'JSX' },
    json: { icon: FileJson, color: 'text-orange-600 bg-orange-50', label: 'JSON' },
    css: { icon: FileType, color: 'text-pink-600 bg-pink-50', label: 'CSS' },
    html: { icon: FileCode, color: 'text-orange-600 bg-orange-50', label: 'HTML' },
    pdf: { icon: FileText, color: 'text-red-600 bg-red-50', label: 'PDF' },
    doc: { icon: FileText, color: 'text-blue-600 bg-blue-50', label: 'DOC' },
    docx: { icon: FileText, color: 'text-blue-600 bg-blue-50', label: 'DOCX' },
    txt: { icon: FileText, color: 'text-gray-600 bg-gray-50', label: 'TXT' },
    md: { icon: FileText, color: 'text-gray-600 bg-gray-50', label: 'MD' },
    jpg: { icon: ImageIcon, color: 'text-purple-600 bg-purple-50', label: 'JPG' },
    png: { icon: ImageIcon, color: 'text-purple-600 bg-purple-50', label: 'PNG' },
    unknown: { icon: FileText, color: 'text-gray-400 bg-gray-50', label: 'FILE' }
};

export function QuickLookModal({ isOpen, onClose, file }: QuickLookModalProps) {
    const { t, language } = useTranslation();
    const [previewUrl, setPreviewUrl] = useState('');
    const previewMode = getPreviewMode(file);
    const previewAssetUrl = previewMode === 'image' ? getPreviewAssetUrl(file?.path) : '';

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (isOpen && e.key === 'Escape') {
                e.preventDefault();
                onClose();
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isOpen, onClose]);

    useEffect(() => {
        if (!isOpen || previewMode !== 'image' || !file?.path) {
            setPreviewUrl('');
            return;
        }

        let active = true;
        let objectUrl = '';
        setPreviewUrl(previewAssetUrl);

        readLocalFileAsObjectUrl(file.path, file.name)
            .then((url) => {
                objectUrl = url;
                if (active) {
                    setPreviewUrl(url);
                }
            })
            .catch(() => {
                if (active) {
                    setPreviewUrl(previewAssetUrl);
                }
            });

        return () => {
            active = false;
            revokeLocalFileUrl(objectUrl);
        };
    }, [file?.name, file?.path, isOpen, previewAssetUrl, previewMode]);

    if (!isOpen || !file) return null;

    const ext = file.name.split('.').pop()?.toLowerCase() || 'unknown';
    const config = FILE_TYPE_CONFIG[ext] || FILE_TYPE_CONFIG['unknown'];
    const HeaderIcon = config.icon;
    const locale = language === 'vi' ? 'vi-VN' : 'en-US';

    const handleOpenNatively = async () => {
        try {
            await invoke('open_file_native', { path: file.path });
            onClose(); // Optional: close quick look after opening natively
        } catch (e) {
            console.error("Failed to open file", e);
        }
    };

    return (
        <div 
            className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-md flex items-center justify-center p-6 lg:p-12 animate-in fade-in duration-200"
            onClick={onClose}
        >
            <div 
                className="w-full max-w-5xl h-[85vh] overflow-hidden rounded-2xl border border-[var(--ui-border)] bg-[var(--ui-surface)] shadow-2xl scale-in duration-200 flex flex-col"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="flex items-center justify-between border-b border-[var(--ui-border)] bg-[var(--ui-surface-muted)] p-4">
                    <div className="flex items-center gap-4 min-w-0">
                        <div className={`h-10 w-10 rounded-lg flex items-center justify-center shrink-0 ${config.color}`}>
                            <HeaderIcon className="h-5 w-5" />
                        </div>
                        <div className="min-w-0 flex-1">
                            <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100 truncate">{file.name}</h2>
                            <p className="text-xs text-gray-500 dark:text-gray-400 font-mono truncate">{file.path}</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-3 shrink-0 ml-4">
                        <button
                            onClick={handleOpenNatively}
                            className="flex items-center justify-center gap-2 rounded-lg bg-[var(--ui-success)] px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:brightness-95"
                        >
                            <ExternalLink className="h-4 w-4" />
                            {t('open_natively')}
                        </button>
                        <button 
                            onClick={onClose}
                            className="rounded-lg p-2 text-gray-400 transition-colors hover:bg-[var(--ui-surface)] hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300"
                        >
                            <X className="h-5 w-5" />
                        </button>
                    </div>
                </div>

                {/* Content Area */}
                <div className="flex flex-1 min-h-0 flex-col overflow-auto bg-[var(--ui-surface-muted)] p-6">
                    {previewMode === 'image' ? (
                        <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-[var(--ui-border)] bg-[var(--ui-surface)] shadow-sm">
                            <div className="flex shrink-0 items-center justify-between border-b border-[var(--ui-border)] bg-[var(--ui-surface-muted)] p-2 px-4">
                                <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-widest">{t('preview')}</span>
                                <div className="flex items-center gap-4 text-xs text-gray-400 dark:text-gray-500">
                                    <span className="flex items-center gap-1.5"><HardDrive className="w-3 h-3" /> {(file.size / 1024).toFixed(1)} KB</span>
                                    <span className="flex items-center gap-1.5"><Calendar className="w-3 h-3" /> {new Date(file.lastModified).toLocaleDateString(locale)}</span>
                                </div>
                            </div>
                            <div className="flex min-h-0 flex-1 items-center justify-center overflow-auto bg-[var(--ui-surface-muted)] p-6">
                                <img
                                    src={previewUrl || previewAssetUrl}
                                    alt={file.name}
                                    className="max-h-full max-w-full rounded-lg object-contain shadow-lg"
                                />
                            </div>
                        </div>
                    ) : previewMode === 'text' ? (
                        <div className="flex flex-1 flex-col overflow-hidden rounded-xl border border-[var(--ui-border)] bg-[var(--ui-surface)] shadow-sm">
                            <div className="flex shrink-0 items-center justify-between border-b border-[var(--ui-border)] bg-[var(--ui-surface-muted)] p-2 px-4">
                                <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-widest">{t('document_content')}</span>
                                <div className="flex items-center gap-4 text-xs text-gray-400 dark:text-gray-500">
                                    <span className="flex items-center gap-1.5"><HardDrive className="w-3 h-3" /> {(file.size / 1024).toFixed(1)} KB</span>
                                    <span className="flex items-center gap-1.5"><Calendar className="w-3 h-3" /> {new Date(file.lastModified).toLocaleDateString(locale)}</span>
                                </div>
                            </div>
                            <div className="p-6 overflow-auto flex-1">
                                <pre className="text-sm font-mono text-gray-800 dark:text-gray-100 whitespace-pre-wrap break-words">
                                    {file.content.length > 20000 
                                        ? file.content.slice(0, 20000) + `\n\n${t('preview_truncated_quick_look')}` 
                                        : file.content}
                                </pre>
                            </div>
                        </div>
                    ) : (
                        <div className="flex-1 flex flex-col items-center justify-center text-gray-400 dark:text-gray-500">
                            <FileType className="w-16 h-16 text-gray-200 dark:text-gray-700 mb-4" />
                            <h3 className="text-lg font-medium text-gray-700 dark:text-gray-100">{t('quick_look_preview_unavailable')}</h3>
                            <p className="text-sm mt-1">{t('quick_look_preview_unavailable_description')}</p>
                        </div>
                    )}
                </div>
                
                {/* Footer hints */}
                <div className="flex items-center justify-center gap-4 border-t border-[var(--ui-border)] bg-[var(--ui-surface)] p-3 text-center text-[10px] text-gray-400 dark:text-gray-500">
                    <span><kbd className="rounded border border-[var(--ui-border)] bg-[var(--ui-surface-muted)] px-1.5 py-0.5 font-mono">Esc</kbd> {t('spotlight_close')}</span>
                </div>
            </div>
        </div>
    );
}
