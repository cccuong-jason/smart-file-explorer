import { FileText, Calendar, HardDrive, ExternalLink, Tag, Link2, Copy, FileCode, FileJson, FileType, Image as ImageIcon } from 'lucide-react';
import { useToast } from '@/components/ui/toast';
import { TagInput } from '@/components/ui/tag-input';
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
        <div className="h-full min-h-0 flex flex-col bg-white dark:bg-gray-950">
            <CopyPathInstructionModal
                isOpen={isCopyModalOpen}
                onClose={() => setIsCopyModalOpen(false)}
                path={file.path}
            />

            {/* Header */}
            <div className="shrink-0 p-6 border-b border-gray-100 dark:border-gray-800">
                <div className={`h-12 w-12 rounded-xl flex items-center justify-center mb-4 ${config.color}`}>
                    <HeaderIcon className="h-6 w-6" />
                </div>
                <div className="flex items-start justify-between gap-3">
                    <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 break-words">{file.name}</h2>
                    {file.isLikelyLatest && (
                        <span className="shrink-0 text-[11px] font-semibold text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-950/40 px-2 py-1 rounded-full border border-indigo-100 dark:border-indigo-900">
                            {t('likely_latest_version')}
                        </span>
                    )}
                </div>
                <div className="flex items-center gap-2 mt-1">
                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded uppercase ${config.color.replace('text-', 'text-opacity-80 text-').replace('bg-', 'bg-opacity-50 bg-')}`}>
                        {config.label}
                    </span>
                    <p className="text-sm text-gray-500 dark:text-gray-400 font-mono break-all line-clamp-1">{file.path}</p>
                </div>
            </div>

            {/* actions */}
            <div className="shrink-0 px-6 py-4 border-b border-gray-100 dark:border-gray-800 flex flex-wrap gap-2">
                <button
                    onClick={handleCopyPath}
                    className="min-w-[150px] flex-1 flex items-center justify-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 transition-colors font-medium text-sm shadow-sm hover:shadow active:scale-[0.98]"
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
                    className="min-w-[150px] flex-1 flex items-center justify-center gap-2 bg-emerald-600 text-white px-4 py-2 rounded-lg hover:bg-emerald-700 transition-colors font-medium text-sm shadow-sm hover:shadow active:scale-[0.98]"
                >
                    <ExternalLink className="h-4 w-4" />
                    {t('open_natively')}
                </button>
            </div>

            <div className="flex-1 min-h-0 overflow-y-auto">
                {/* Metadata */}
                <div className="p-6 space-y-4 border-b border-gray-100 dark:border-gray-800">
                <h3 className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider">{t('file_information')}</h3>

                <div className="flex flex-wrap items-center gap-2">
                    <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-semibold ${readinessTone}`}>
                        {readinessLabel}
                    </span>
                    <span className="inline-flex items-center rounded-full border border-gray-200 bg-gray-50 px-2.5 py-1 text-[11px] font-medium text-gray-600 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-300">
                        {t('indexing_stage_metadata')}
                    </span>
                    <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-medium ${contentReady ? 'border-[var(--ui-border)] bg-[var(--ui-surface-muted)] text-[var(--ui-primary)]' : 'border-gray-200 bg-gray-50 text-gray-500 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-400'}`}>
                        {t('indexing_stage_content')}
                    </span>
                    <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-medium ${semanticReady ? 'border-[color:var(--ui-success)]/30 bg-[var(--ui-success-soft)] text-[var(--ui-success)]' : 'border-gray-200 bg-gray-50 text-gray-500 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-400'}`}>
                        {t('indexing_stage_semantic')}
                    </span>
                </div>

                {(file.confidence || factors.length > 0 || file.score) && (
                    <div className={`rounded-xl border p-4 space-y-3 ${confidenceTone.section}`}>
                        <div className="flex items-center justify-between gap-2">
                            <h4 className="text-xs font-bold uppercase tracking-wider text-gray-900 dark:text-gray-100">{t('why_this_matched')}</h4>
                            {typeof file.score === 'number' && (
                                <span className={`text-[11px] font-semibold px-2 py-1 rounded-full border ${confidenceTone.badge}`}>
                                    {getMatchPercentage(file.score)}%
                                </span>
                            )}
                        </div>
                        {file.confidence && (
                            <div className="space-y-1">
                                <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">{t(confidencePresentation.labelKey)}</p>
                                <p className="text-sm text-gray-700 dark:text-gray-200">
                                    {t(confidencePresentation.legendKey)}
                                </p>
                            </div>
                        )}
                        {file.indexingStage && file.indexingStage !== 'semantic' && (
                            <div className="rounded-lg border border-[var(--ui-border)] bg-[var(--ui-surface-muted)] px-3 py-2 text-xs text-gray-700 dark:text-gray-200">
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
                                            className={`rounded-lg border px-3 py-2 ${tone.row}`}
                                        >
                                            <div className="flex items-start gap-3">
                                                <span className={`mt-1 h-2.5 w-2.5 shrink-0 rounded-full ${tone.dot}`}></span>
                                                <div className="space-y-1">
                                                    <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                                                        {t(presentation.labelKey)}
                                                    </p>
                                                    {Array.isArray(factor.evidence) && factor.evidence.length > 0 ? (
                                                        <div className="space-y-1">
                                                            {factor.evidence.slice(0, 2).map((line: string) => (
                                                                <p key={line} className="text-xs leading-relaxed text-gray-600 dark:text-gray-300">
                                                                    {line}
                                                                </p>
                                                            ))}
                                                            {factor.locationLabel && (
                                                                <p className="text-xs leading-relaxed text-indigo-700 dark:text-indigo-300">
                                                                    {t('best_match_location')}: {factor.locationLabel}
                                                                </p>
                                                            )}
                                                        </div>
                                                    ) : (
                                                        <p className="text-xs leading-relaxed text-gray-600 dark:text-gray-300">
                                                            {t(presentation.descriptionKey)}
                                                        </p>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                                {remainingFactorCount > 0 && (
                                    <p className="text-xs text-gray-500 dark:text-gray-400">
                                        {t('match_more_factors', { count: remainingFactorCount })}
                                    </p>
                                )}
                            </div>
                        )}
                        {file.locationLabel && (
                            <div className="text-sm text-gray-700 dark:text-gray-200">
                                <span className="font-semibold">{t('best_match_location')}:</span> {file.locationLabel}
                            </div>
                        )}
                    </div>
                )}

                {file.ocrStatus === 'recommended' && (
                    <div className="rounded-xl border border-[var(--ui-border)] bg-[var(--ui-surface-muted)] p-4">
                        <h4 className="text-xs font-bold uppercase tracking-wider text-[var(--ui-primary)]">{t('ocr_recommended_title')}</h4>
                        <p className="mt-2 text-sm text-gray-700 dark:text-gray-200">
                            {t('ocr_recommended_description')}
                        </p>
                    </div>
                )}
                {file.ocrStatus === 'processing' && (
                    <div className="rounded-xl border border-[var(--ui-border)] bg-[var(--ui-surface-muted)] p-4">
                        <h4 className="text-xs font-bold uppercase tracking-wider text-[var(--ui-primary)]">{t('ocr_processing_title')}</h4>
                        <p className="mt-2 text-sm text-gray-700 dark:text-gray-200">
                            {t('ocr_processing_description')}
                        </p>
                    </div>
                )}
                {file.ocrStatus === 'failed' && (
                    <div className="rounded-xl border border-rose-200 dark:border-rose-900 bg-rose-50/80 dark:bg-rose-950/30 p-4">
                        <h4 className="text-xs font-bold uppercase tracking-wider text-rose-700 dark:text-rose-300">{t('ocr_failed_title')}</h4>
                        <p className="text-sm text-rose-900 dark:text-rose-100 mt-2">
                            {t('ocr_failed_description')}
                        </p>
                    </div>
                )}

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
                <div className="p-6 bg-gray-50/50 dark:bg-gray-900/40 space-y-6">
                    <div>
                        <h3 className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-3">{t('preview')}</h3>
                        {previewMode === 'image' ? (
                            <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-950">
                                <div className="flex items-center justify-center bg-gray-100/70 p-4 dark:bg-gray-950 min-h-[240px]">
                                    <img
                                        src={previewUrl || previewAssetUrl}
                                        alt={file.name}
                                        className="max-h-[420px] max-w-full rounded-lg object-contain"
                                    />
                                </div>
                            </div>
                        ) : file.content ? (
                            <pre className="text-xs font-mono text-gray-700 dark:text-gray-200 whitespace-pre-wrap break-words bg-white dark:bg-gray-950 p-4 rounded-lg border border-gray-200 dark:border-gray-800 shadow-sm transition-all hover:border-indigo-200 dark:hover:border-indigo-800">
                                {file.content.slice(0, 2000)}
                                {file.content.length > 2000 && <span className="text-gray-400 dark:text-gray-500 italic block mt-2">{t('preview_truncated')}</span>}
                            </pre>
                        ) : file.indexingStage && file.indexingStage !== 'failed' ? (
                            <div className="flex flex-col items-center justify-center min-h-[180px] rounded-xl border border-dashed border-[var(--ui-border)] bg-[var(--ui-surface-muted)] px-4 text-center text-sm text-gray-700 dark:text-gray-200">
                                <p className="font-medium">{t('preview_still_analyzing_title')}</p>
                                <p className="mt-2 max-w-xs text-xs leading-relaxed">{t('preview_still_analyzing_description')}</p>
                            </div>
                        ) : (
                            <div className="flex flex-col items-center justify-center h-32 text-gray-400 dark:text-gray-500 text-sm italic">
                                {t('preview_not_available')}
                            </div>
                        )}
                    </div>

                    {/* Related Files */}
                    {relatedFiles.length > 0 && (
                        <div className="pt-6 border-t border-gray-200 dark:border-gray-800">
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
        </div>
    );
}
