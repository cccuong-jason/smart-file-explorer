import { useEffect, useState } from 'react';
import { FileText, FileCode, FileJson, FileType, Image as ImageIcon, ExternalLink, X, HardDrive, Calendar } from '@/components/icons';
import { invoke } from '@tauri-apps/api/core';
import { Button } from '@/components/retroui/Button';
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
    txt: { icon: FileText, color: 'text-foreground bg-secondary', label: 'TXT' },
    md: { icon: FileText, color: 'text-foreground bg-secondary', label: 'MD' },
    jpg: { icon: ImageIcon, color: 'text-purple-600 bg-purple-50', label: 'JPG' },
    png: { icon: ImageIcon, color: 'text-purple-600 bg-purple-50', label: 'PNG' },
    unknown: { icon: FileText, color: 'text-muted-foreground bg-secondary', label: 'FILE' }
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
                className="w-full max-w-5xl h-[85vh] overflow-hidden rounded-md border-2 border-border bg-card text-card-foreground shadow-md scale-in duration-200 flex flex-col"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="flex items-center justify-between border-b-2 border-border bg-secondary p-4">
                    <div className="flex items-center gap-4 min-w-0">
                        <div className={`h-10 w-10 rounded border-2 border-border flex items-center justify-center shrink-0 ${config.color}`}>
                            <HeaderIcon className="h-5 w-5" />
                        </div>
                        <div className="min-w-0 flex-1">
                            <h2 className="font-head text-lg text-foreground truncate">{file.name}</h2>
                            <p className="text-xs text-foreground/70 font-mono truncate">{file.path}</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-3 shrink-0 ml-4">
                        <Button
                            variant="default"
                            onClick={handleOpenNatively}
                            className="gap-2 px-4 py-2 text-sm"
                        >
                            <ExternalLink className="h-4 w-4" />
                            {t('open_natively')}
                        </Button>
                        <Button
                            variant="outline"
                            size="icon"
                            onClick={onClose}
                            className="h-9 w-9"
                        >
                            <X className="h-5 w-5" />
                        </Button>
                    </div>
                </div>

                {/* Content Area */}
                <div className="flex flex-1 min-h-0 flex-col overflow-auto bg-muted p-6">
                    {previewMode === 'image' ? (
                        <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-md border-2 border-border bg-card shadow">
                            <div className="flex shrink-0 items-center justify-between border-b-2 border-border bg-muted p-2 px-4">
                                <span className="font-head text-xs text-muted-foreground uppercase tracking-widest">{t('preview')}</span>
                                <div className="flex items-center gap-4 text-xs text-muted-foreground">
                                    <span className="flex items-center gap-1.5"><HardDrive className="w-3 h-3" /> {(file.size / 1024).toFixed(1)} KB</span>
                                    <span className="flex items-center gap-1.5"><Calendar className="w-3 h-3" /> {new Date(file.lastModified).toLocaleDateString(locale)}</span>
                                </div>
                            </div>
                            <div className="flex min-h-0 flex-1 items-center justify-center overflow-auto bg-muted p-6">
                                <img
                                    src={previewUrl || previewAssetUrl}
                                    alt={file.name}
                                        className="max-h-full max-w-full rounded border-2 border-border object-contain shadow"
                                />
                            </div>
                        </div>
                    ) : previewMode === 'text' ? (
                        <div className="flex flex-1 flex-col overflow-hidden rounded-md border-2 border-border bg-card shadow">
                            <div className="flex shrink-0 items-center justify-between border-b-2 border-border bg-muted p-2 px-4">
                                <span className="font-head text-xs text-muted-foreground uppercase tracking-widest">{t('document_content')}</span>
                                <div className="flex items-center gap-4 text-xs text-muted-foreground">
                                    <span className="flex items-center gap-1.5"><HardDrive className="w-3 h-3" /> {(file.size / 1024).toFixed(1)} KB</span>
                                    <span className="flex items-center gap-1.5"><Calendar className="w-3 h-3" /> {new Date(file.lastModified).toLocaleDateString(locale)}</span>
                                </div>
                            </div>
                            <div className="p-6 overflow-auto flex-1">
                                <pre className="text-sm font-mono text-foreground whitespace-pre-wrap break-words">
                                    {file.content.length > 20000 
                                        ? file.content.slice(0, 20000) + `\n\n${t('preview_truncated_quick_look')}` 
                                        : file.content}
                                </pre>
                            </div>
                        </div>
                    ) : (
                        <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground">
                            <FileType className="w-16 h-16 text-muted-foreground mb-4" />
                            <h3 className="font-head text-lg text-foreground">{t('quick_look_preview_unavailable')}</h3>
                            <p className="text-sm mt-1">{t('quick_look_preview_unavailable_description')}</p>
                        </div>
                    )}
                </div>
                
                {/* Footer hints */}
                <div className="flex items-center justify-center gap-4 border-t-2 border-border bg-card p-3 text-center text-[10px] text-muted-foreground">
                    <span><kbd className="rounded border-2 border-border bg-muted px-1.5 py-0.5 font-mono">Esc</kbd> {t('spotlight_close')}</span>
                </div>
            </div>
        </div>
    );
}
