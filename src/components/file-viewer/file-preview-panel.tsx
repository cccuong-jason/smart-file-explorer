import { FileText, Calendar, HardDrive, ExternalLink, Tag, Link2, Copy, FileCode, FileJson, FileType, Image as ImageIcon } from '@/components/icons';
import { TagInput } from '@/components/ui/tag-input';
import { Button } from '@/components/retroui/Button';
import { toast as sonnerToast } from 'sonner';
import { addFileTag, removeFileTag } from '@/lib/file-system/db';
import { findRelatedFiles } from '@/lib/search/engine';
import { useState, useEffect } from 'react';
import { CopyPathInstructionModal } from '@/components/ui/copy-path-modal';
import { useTranslation } from '@/lib/i18n';
import { getPreviewAssetUrl, getPreviewMode } from './preview-utils';
import { readLocalFileAsObjectUrl, revokeLocalFileUrl } from '@/lib/file-system/local-file-data';
import {
    getConfidencePresentation,
    getMatchPercentage,
    getReasonPresentation,
    getToneClasses,
} from '@/lib/search/presentation';

interface FilePreviewPanelProps {
    file: any | null;
    onTagsChange?: (path: string, newTags: string[]) => void;
    onSelectFile?: (file: any) => void;
    isScanning?: boolean;
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
    txt: { icon: FileText, color: 'text-foreground bg-secondary', label: 'TXT' },
    md: { icon: FileText, color: 'text-foreground bg-secondary', label: 'MD' },
    // Media
    jpg: { icon: ImageIcon, color: 'text-purple-600 bg-purple-50', label: 'JPG' },
    png: { icon: ImageIcon, color: 'text-purple-600 bg-purple-50', label: 'PNG' },
    // Default
    unknown: { icon: FileText, color: 'text-muted-foreground bg-secondary', label: 'FILE' }
};

export function FilePreviewPanel({ file, onTagsChange, onSelectFile, isScanning = false }: FilePreviewPanelProps) {
    const toast = (
        message: string,
        type: 'success' | 'error' | 'info' | 'warning' = 'info',
    ) => {
        if (type === 'success') sonnerToast.success(message);
        else if (type === 'error') sonnerToast.error(message);
        else if (type === 'warning') sonnerToast.warning(message);
        else sonnerToast.info(message);
    };
    const { t, language } = useTranslation();
    const [relatedFiles, setRelatedFiles] = useState<{ file: any; score: number }[]>([]);
    const [isCopyModalOpen, setIsCopyModalOpen] = useState(false);
    const [previewUrl, setPreviewUrl] = useState('');

    useEffect(() => {
        if ((file?.indexingStage === 'semantic' || file?.embedding) && file?.embedding) {
            findRelatedFiles(file).then(setRelatedFiles);
        } else {
            setRelatedFiles([]);
        }
    }, [file]);

    useEffect(() => {
        const previewMode = getPreviewMode(file);
        const fallbackUrl = previewMode === 'image' ? getPreviewAssetUrl(file?.path) : '';

        if (previewMode !== 'image' || !file?.path) {
            setPreviewUrl('');
            return;
        }

        let active = true;
        let objectUrl = '';
        setPreviewUrl(fallbackUrl);

        readLocalFileAsObjectUrl(file.path, file.name)
            .then((url) => {
                objectUrl = url;
                if (active) {
                    setPreviewUrl(url);
                }
            })
            .catch(() => {
                if (active) {
                    setPreviewUrl(fallbackUrl);
                }
            });

        return () => {
            active = false;
            revokeLocalFileUrl(objectUrl);
        };
    }, [file]);

    if (!file) {
        return (
            <div className="h-full flex flex-col items-center justify-center text-muted-foreground bg-card p-8 text-center">
                <div className="h-16 w-16 bg-muted rounded border-2 border-border flex items-center justify-center mb-4 shadow">
                    <FileText className="h-8 w-8 text-muted-foreground" />
                </div>
                <h3 className="font-head text-lg text-foreground">{t('preview_empty_title')}</h3>
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
    const factors = Array.isArray(file.factors)
        ? file.factors
        : (Array.isArray(file.reasons) ? file.reasons.map((reason: string) => ({ code: reason, evidence: [] })) : []);
    const previewMode = getPreviewMode(file);
    const previewAssetUrl = previewMode === 'image' ? getPreviewAssetUrl(file.path) : '';
    const semanticReady = file.indexingStage === 'semantic' || Boolean(file.embedding);
    const contentReady = semanticReady || file.indexingStage === 'content' || Boolean(file.content);
    const visibleFactors = factors.filter((factor: any) => {
        if (!semanticReady && factor.code === 'semantic') {
            return false;
        }
        if (!contentReady && factor.code === 'content_terms') {
            return false;
        }
        return true;
    });
    const confidencePresentation = getConfidencePresentation(file.confidence);
    const confidenceTone = getToneClasses(confidencePresentation.tone);
    const readinessTone = file.indexingStage === 'failed'
        ? 'border-[color:var(--ui-danger)]/30 bg-[var(--ui-danger-soft)] text-[var(--ui-danger)]'
        : semanticReady
            ? 'border-[color:var(--ui-success)]/30 bg-[var(--ui-success-soft)] text-[var(--ui-success)]'
            : 'border-[var(--ui-border)] bg-[var(--ui-surface-muted)] text-[var(--ui-primary)]';
    const readinessLabel = file.indexingStage === 'failed'
        ? t('indexing_status_failed')
        : semanticReady
            ? t('indexing_status_semantic')
            : contentReady
                ? t('indexing_status_content')
                : t('indexing_status_metadata');
    const remainingFactorCount = Math.max(0, factors.length - 3);

    return (
        <div className="h-full min-h-0 flex flex-col bg-card text-card-foreground">
            <CopyPathInstructionModal
                isOpen={isCopyModalOpen}
                onClose={() => setIsCopyModalOpen(false)}
                path={file.path}
            />

            {/* Header */}
            <div className="shrink-0 p-6 border-b-2 border-border">
                <div className={`h-12 w-12 rounded-xl flex items-center justify-center mb-4 ${config.color}`}>
                    <HeaderIcon className="h-6 w-6" />
                </div>
                <div className="flex items-start justify-between gap-3">
                    <h2 className="font-head text-xl text-foreground break-words">{file.name}</h2>
                    {file.isLikelyLatest && (
                        <span className="shrink-0 rounded border-2 border-border bg-primary px-2 py-1 font-head text-[11px] font-semibold text-primary-foreground">
                            {t('likely_latest_version')}
                        </span>
                    )}
                </div>
                <div className="flex items-center gap-2 mt-1">
                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded uppercase ${config.color.replace('text-', 'text-opacity-80 text-').replace('bg-', 'bg-opacity-50 bg-')}`}>
                        {config.label}
                    </span>
                    <p className="line-clamp-1 break-all font-mono text-sm text-muted-foreground">{file.path}</p>
                </div>
            </div>

            {/* actions */}
            <div className="shrink-0 px-6 py-4 border-b-2 border-border flex flex-wrap gap-2">
                <Button
                    onClick={handleCopyPath}
                    className="min-w-[150px] flex-1 gap-2 px-4 py-2 text-sm"
                >
                    <Copy className="h-4 w-4" />
                    {t('copy_path')}
                </Button>
                <Button
                    variant="secondary"
                    onClick={async () => {
                        try {
                            const { invoke } = await import('@tauri-apps/api/core');
                            await invoke('open_file_native', { path: file.path });
                        } catch (e) {
                            console.error("Failed to open file", e);
                            toast(t('open_file_failed'), 'error');
                        }
                    }}
                    className="min-w-[150px] flex-1 gap-2 px-4 py-2 text-sm"
                >
                    <ExternalLink className="h-4 w-4" />
                    {t('open_natively')}
                </Button>
            </div>

            <div className="flex-1 min-h-0 overflow-y-auto">
                {/* Metadata */}
                <div className="space-y-4 border-b-2 border-border p-6">
                <h3 className="font-head text-xs font-semibold uppercase text-muted-foreground">{t('file_information')}</h3>

                <div className="flex flex-wrap items-center gap-2">
                    <span className={`inline-flex items-center rounded border-2 px-2.5 py-1 font-head text-[11px] font-semibold ${readinessTone}`}>
                        {readinessLabel}
                    </span>
                    <span className="inline-flex items-center rounded border-2 border-border bg-secondary px-2.5 py-1 text-[11px] font-medium text-foreground">
                        {t('indexing_stage_metadata')}
                    </span>
                    <span className={`inline-flex items-center rounded border-2 px-2.5 py-1 text-[11px] font-medium ${contentReady ? 'border-border bg-secondary text-primary' : 'border-border bg-card text-muted-foreground'}`}>
                        {t('indexing_stage_content')}
                    </span>
                    <span className={`inline-flex items-center rounded border-2 px-2.5 py-1 text-[11px] font-medium ${semanticReady ? 'border-[var(--ui-success)] bg-[var(--ui-success-soft)] text-[var(--ui-success)]' : 'border-border bg-card text-muted-foreground'}`}>
                        {t('indexing_stage_semantic')}
                    </span>
                </div>

                {(file.confidence || factors.length > 0 || file.score) && (
                    <div className={`space-y-3 rounded border-2 p-4 ${confidenceTone.section}`}>
                        <div className="flex items-center justify-between gap-2">
                            <h4 className="font-head text-xs font-bold uppercase text-foreground">{t('why_this_matched')}</h4>
                            {typeof file.score === 'number' && (
                                <span className={`rounded border-2 px-2 py-1 font-head text-[11px] font-semibold ${confidenceTone.badge}`}>
                                    {getMatchPercentage(file.score)}%
                                </span>
                            )}
                        </div>
                        {file.confidence && (
                            <div className="space-y-1">
                                <p className="text-sm font-semibold text-foreground">{t(confidencePresentation.labelKey)}</p>
                                <p className="text-sm text-muted-foreground">
                                    {t(confidencePresentation.legendKey)}
                                </p>
                            </div>
                        )}
                        {file.indexingStage && file.indexingStage !== 'semantic' && (
                            <div className="rounded border-2 border-border bg-secondary px-3 py-2 text-xs text-foreground">
                                {t('search_explanation_partial')}
                            </div>
                        )}
                        {visibleFactors.length > 0 && (
                            <div className="space-y-2">
                                {visibleFactors.map((factor: any) => {
                                    const presentation = getReasonPresentation(factor.code as any);
                                    const tone = getToneClasses(presentation.tone);

                                    return (
                                        <div
                                            key={factor.code}
                                            className={`rounded border-2 px-3 py-2 ${tone.row}`}
                                        >
                                            <div className="flex items-start gap-3">
                                                <span className={`mt-1 h-2.5 w-2.5 shrink-0 rounded-full ${tone.dot}`}></span>
                                                <div className="space-y-1">
                                                    <p className="text-sm font-semibold text-foreground">
                                                        {t(presentation.labelKey)}
                                                    </p>
                                                    {Array.isArray(factor.evidence) && factor.evidence.length > 0 ? (
                                                        <div className="space-y-1">
                                                            {factor.evidence.slice(0, 2).map((line: string) => (
                                                                <p key={line} className="text-xs leading-relaxed text-muted-foreground">
                                                                    {line}
                                                                </p>
                                                            ))}
                                                            {factor.locationLabel && (
                                                                <p className="text-xs leading-relaxed text-primary">
                                                                    {t('best_match_location')}: {factor.locationLabel}
                                                                </p>
                                                            )}
                                                        </div>
                                                    ) : (
                                                        <p className="text-xs leading-relaxed text-muted-foreground">
                                                            {t(presentation.descriptionKey)}
                                                        </p>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                                {remainingFactorCount > 0 && (
                                    <p className="text-xs text-muted-foreground">
                                        {t('match_more_factors', { count: remainingFactorCount })}
                                    </p>
                                )}
                            </div>
                        )}
                        {file.locationLabel && (
                            <div className="text-sm text-foreground">
                                <span className="font-semibold">{t('best_match_location')}:</span> {file.locationLabel}
                            </div>
                        )}
                    </div>
                )}

                {file.ocrStatus === 'recommended' && (
                    <div className="rounded border-2 border-border bg-secondary p-4">
                        <h4 className="font-head text-xs font-bold uppercase text-primary">{t('ocr_recommended_title')}</h4>
                        <p className="mt-2 text-sm text-foreground">
                            {t('ocr_recommended_description')}
                        </p>
                    </div>
                )}
                {file.ocrStatus === 'processing' && (
                    <div className="rounded border-2 border-border bg-secondary p-4">
                        <h4 className="font-head text-xs font-bold uppercase text-primary">{t('ocr_processing_title')}</h4>
                        <p className="mt-2 text-sm text-foreground">
                            {t('ocr_processing_description')}
                        </p>
                    </div>
                )}
                {file.ocrStatus === 'failed' && (
                    <div className="rounded border-2 border-[var(--ui-danger)] bg-[var(--ui-danger-soft)] p-4">
                        <h4 className="font-head text-xs font-bold uppercase text-[var(--ui-danger)]">{t('ocr_failed_title')}</h4>
                        <p className="mt-2 text-sm text-[var(--ui-danger)]">
                            {t('ocr_failed_description')}
                        </p>
                    </div>
                )}

                <div className="flex items-center gap-3 text-sm">
                    <HardDrive className="h-4 w-4 text-muted-foreground" />
                    <span className="text-muted-foreground">{t('size')}:</span>
                    <span className="font-medium text-foreground">{(file.size / 1024).toFixed(2)} KB</span>
                </div>

                <div className="flex items-center gap-3 text-sm">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    <span className="text-muted-foreground">{t('modified')}:</span>
                    <span className="font-medium text-foreground">{new Date(file.lastModified).toLocaleDateString(locale)}</span>
                </div>

                {/* Inline Tags */}
                <div className="flex items-start gap-3 text-sm">
                    <Tag className="mt-1.5 h-4 w-4 shrink-0 text-muted-foreground" />
                    <div className="flex-1 flex flex-wrap items-center gap-2 mt-0.5">
                        <span className="mr-1 text-muted-foreground">{t('tags')}:</span>
                        <TagInput
                            tags={file.tags || []}
                            onAddTag={handleAddTag}
                            onRemoveTag={handleRemoveTag}
                        />
                    </div>
                </div>
                </div>

                {/* Content Preview */}
                <div className="space-y-6 bg-secondary p-6">
                    <div>
                        <h3 className="mb-3 font-head text-xs font-semibold uppercase text-muted-foreground">{t('preview')}</h3>
                        {previewMode === 'image' ? (
                            <div className="overflow-hidden rounded border-2 border-border bg-card shadow-sm">
                                <div className="flex min-h-[240px] items-center justify-center bg-background p-4">
                                    <img
                                        src={previewUrl || previewAssetUrl}
                                        alt={file.name}
                                        className="max-h-[420px] max-w-full rounded object-contain"
                                    />
                                </div>
                            </div>
                        ) : file.content ? (
                            <pre className="whitespace-pre-wrap break-words rounded border-2 border-border bg-card p-4 font-mono text-xs text-foreground shadow-sm transition-all hover:border-primary">
                                {file.content.slice(0, 2000)}
                                {file.content.length > 2000 && <span className="mt-2 block text-muted-foreground italic">{t('preview_truncated')}</span>}
                            </pre>
                        ) : file.indexingStage && file.indexingStage !== 'failed' && isScanning ? (
                            <div className="flex min-h-[180px] flex-col items-center justify-center rounded border-2 border-dashed border-border bg-card px-4 text-center text-sm text-foreground">
                                <p className="font-medium">{t('preview_still_analyzing_title')}</p>
                                <p className="mt-2 max-w-xs text-xs leading-relaxed">{t('preview_still_analyzing_description')}</p>
                            </div>
                        ) : file.indexingStage && file.indexingStage !== 'failed' ? (
                            <div className="flex min-h-[180px] flex-col items-center justify-center rounded border-2 border-dashed border-border bg-card px-4 text-center text-sm text-foreground">
                                <p className="font-medium">{t('preview_not_ready_title')}</p>
                                <p className="mt-2 max-w-xs text-xs leading-relaxed">{t('preview_not_ready_description')}</p>
                            </div>
                        ) : (
                            <div className="flex h-32 flex-col items-center justify-center text-sm text-muted-foreground italic">
                                {t('preview_not_available')}
                            </div>
                        )}
                    </div>

                    {/* Related Files */}
                    {relatedFiles.length > 0 && (
                        <div className="border-t-2 border-border pt-6">
                            <div className="mb-4 flex items-center gap-2 text-primary">
                                <Link2 className="w-4 h-4" />
                                <h3 className="font-head text-xs font-bold uppercase">{t('related_files')}</h3>
                            </div>
                            <div className="space-y-2">
                                {relatedFiles.map(({ file: related, score }) => (
                                    <div
                                        key={related.path}
                                        onClick={() => onSelectFile?.(related)}
                                        className="group flex cursor-pointer items-start gap-3 rounded border-2 border-border bg-card p-3 transition-all hover:border-primary hover:shadow-sm active:scale-[0.99]"
                                    >
                                        <div className="rounded border-2 border-border bg-secondary p-1.5 text-primary transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
                                            <FileText className="w-4 h-4" />
                                        </div>
                                        <div className="min-w-0 flex-1">
                                            <div className="flex items-center justify-between gap-2">
                                                <p className="truncate text-sm font-medium text-foreground transition-colors group-hover:text-primary">{related.name}</p>
                                                <span className="shrink-0 rounded border-2 border-border bg-[var(--ui-success-soft)] px-1.5 py-0.5 font-head text-[10px] font-semibold text-[var(--ui-success)]">
                                                    {(score * 100).toFixed(0)}%
                                                </span>
                                            </div>
                                            <p className="mt-0.5 truncate text-xs text-muted-foreground">{related.path}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
