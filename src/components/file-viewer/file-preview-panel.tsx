import { FileText, Calendar, HardDrive, ExternalLink, Tag, Link2, Copy, FileCode, FileJson, FileType, Image as ImageIcon, Music, Video, Archive } from 'lucide-react';
import { useToast } from '@/components/ui/toast';
import { TagInput } from '@/components/ui/tag-input';
import { addFileTag, removeFileTag } from '@/lib/file-system/db';
import { findRelatedFiles } from '@/lib/search/engine';
import { useState, useEffect } from 'react';
import { CopyPathInstructionModal } from '@/components/ui/copy-path-modal';

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
            <div className="h-full flex flex-col items-center justify-center text-gray-400 p-8 text-center">
                <div className="h-16 w-16 bg-gray-100 rounded-2xl flex items-center justify-center mb-4">
                    <FileText className="h-8 w-8 text-gray-300" />
                </div>
                <h3 className="text-lg font-medium text-gray-900">Select a file</h3>
                <p className="text-sm mt-1">Click on a file item to view its details and content preview.</p>
            </div>
        );
    }

    const handleCopyPath = () => {
        navigator.clipboard.writeText(file.path);
        toast('Path copied to clipboard', 'success');
        setIsCopyModalOpen(true); // Show instruction modal
    };

    const handleAddTag = async (tag: string) => {
        try {
            const newTags = await addFileTag(file.path, tag);
            onTagsChange?.(file.path, newTags);
            toast(`Tag "${tag}" added`, 'success');
        } catch (error) {
            console.error(error);
            toast('Failed to add tag', 'error');
        }
    };

    const handleRemoveTag = async (tag: string) => {
        try {
            const newTags = await removeFileTag(file.path, tag);
            onTagsChange?.(file.path, newTags);
            toast(`Tag "${tag}" removed`, 'info');
        } catch (error) {
            console.error(error);
            toast('Failed to remove tag', 'error');
        }
    };

    // Resolve Icon
    const ext = file.name.split('.').pop()?.toLowerCase() || 'unknown';
    const config = FILE_TYPE_CONFIG[ext] || FILE_TYPE_CONFIG['unknown'];
    const HeaderIcon = config.icon;

    return (
        <div className="h-full flex flex-col bg-white">
            <CopyPathInstructionModal
                isOpen={isCopyModalOpen}
                onClose={() => setIsCopyModalOpen(false)}
                path={file.path}
            />

            {/* Header */}
            <div className="p-6 border-b border-gray-100">
                <div className={`h-12 w-12 rounded-xl flex items-center justify-center mb-4 ${config.color}`}>
                    <HeaderIcon className="h-6 w-6" />
                </div>
                <h2 className="text-xl font-bold text-gray-900 break-words">{file.name}</h2>
                <div className="flex items-center gap-2 mt-1">
                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded uppercase ${config.color.replace('text-', 'text-opacity-80 text-').replace('bg-', 'bg-opacity-50 bg-')}`}>
                        {config.label}
                    </span>
                    <p className="text-sm text-gray-500 font-mono break-all line-clamp-1">{file.path}</p>
                </div>
            </div>

            {/* actions */}
            <div className="px-6 py-4 border-b border-gray-100 flex gap-2">
                <button
                    onClick={handleCopyPath}
                    className="flex-1 flex items-center justify-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 transition-colors font-medium text-sm shadow-sm hover:shadow active:scale-[0.98]"
                >
                    <Copy className="h-4 w-4" />
                    Copy Path
                </button>
            </div>

            {/* Metadata */}
            <div className="p-6 space-y-4 border-b border-gray-100">
                <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Information</h3>

                <div className="flex items-center gap-3 text-sm">
                    <HardDrive className="h-4 w-4 text-gray-400" />
                    <span className="text-gray-600">Size:</span>
                    <span className="font-medium text-gray-900">{(file.size / 1024).toFixed(2)} KB</span>
                </div>

                <div className="flex items-center gap-3 text-sm">
                    <Calendar className="h-4 w-4 text-gray-400" />
                    <span className="text-gray-600">Modified:</span>
                    <span className="font-medium text-gray-900">{new Date(file.lastModified).toLocaleDateString()}</span>
                </div>

                {/* Inline Tags */}
                <div className="flex items-start gap-3 text-sm">
                    <Tag className="h-4 w-4 text-gray-400 mt-1.5 shrink-0" />
                    <div className="flex-1 flex flex-wrap items-center gap-2 mt-0.5">
                        <span className="text-gray-600 mr-1">Tags:</span>
                        <TagInput
                            tags={file.tags || []}
                            onAddTag={handleAddTag}
                            onRemoveTag={handleRemoveTag}
                        />
                    </div>
                </div>
            </div>

            {/* Content Preview */}
            <div className="flex-1 overflow-auto p-6 bg-gray-50/50">
                <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Preview</h3>
                {file.content ? (
                    <pre className="text-xs font-mono text-gray-700 whitespace-pre-wrap break-words bg-white p-4 rounded-lg border border-gray-200 shadow-sm transition-all hover:border-indigo-200">
                        {file.content.slice(0, 2000)}
                        {file.content.length > 2000 && <span className="text-gray-400 italic block mt-2">... (Content truncated)</span>}
                    </pre>
                ) : (
                    <div className="flex flex-col items-center justify-center h-32 text-gray-400 text-sm italic">
                        No text content available for preview.
                    </div>
                )}

                {/* Related Files */}
                {relatedFiles.length > 0 && (
                    <div className="mt-8 pt-6 border-t border-gray-200">
                        <div className="flex items-center gap-2 mb-4 text-indigo-700">
                            <Link2 className="w-4 h-4" />
                            <h3 className="text-xs font-bold uppercase tracking-wider">Related Files</h3>
                        </div>
                        <div className="space-y-2">
                            {relatedFiles.map(({ file: related, score }) => (
                                <div
                                    key={related.path}
                                    onClick={() => onSelectFile?.(related)}
                                    className="flex items-start gap-3 p-3 bg-white rounded-lg border border-gray-100 hover:border-indigo-200 hover:shadow-sm cursor-pointer transition-all group active:scale-[0.99]"
                                >
                                    <div className="p-1.5 bg-indigo-50 rounded-md text-indigo-600 group-hover:bg-indigo-100 transition-colors">
                                        <FileText className="w-4 h-4" />
                                    </div>
                                    <div className="min-w-0 flex-1">
                                        <div className="flex items-center justify-between gap-2">
                                            <p className="text-sm font-medium text-gray-900 truncate group-hover:text-indigo-700 transition-colors">{related.name}</p>
                                            <span className="text-[10px] font-semibold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded-full shrink-0">
                                                {(score * 100).toFixed(0)}%
                                            </span>
                                        </div>
                                        <p className="text-xs text-gray-500 truncate mt-0.5">{related.path}</p>
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
