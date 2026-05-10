import { X, Copy, Terminal } from 'lucide-react';
import { useTranslation } from '@/lib/i18n';

interface CopyPathInstructionModalProps {
    isOpen: boolean;
    onClose: () => void;
    path: string;
}

export function CopyPathInstructionModal({ isOpen, onClose, path }: CopyPathInstructionModalProps) {
    const { t } = useTranslation();

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in duration-200">
            <div className="w-full max-w-md overflow-hidden rounded-xl border border-[var(--ui-border)] bg-[var(--ui-surface)] shadow-2xl animate-in zoom-in-95 duration-200">
                {/* Header */}
                <div className="flex items-center justify-between border-b border-[var(--ui-border)] bg-[var(--ui-surface-muted)] p-4">
                    <h3 className="font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2">
                        <Terminal className="w-4 h-4 text-indigo-600" />
                        {t('copy_path_modal_title')}
                    </h3>
                    <button onClick={onClose} className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 transition-colors">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Content */}
                <div className="p-6 space-y-4">
                    <p className="text-sm text-gray-600 dark:text-gray-300 leading-relaxed">
                        {t('copy_path_modal_description')}
                    </p>

                    <div className="space-y-2">
                        <h4 className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">{t('copy_path_modal_label')}</h4>
                        <div className="flex items-center gap-3 rounded-lg border border-[var(--ui-border)] bg-[var(--ui-surface-muted)] p-3">
                            <code className="text-xs font-mono text-indigo-700 break-all flex-1">{path}</code>
                            <Copy className="w-4 h-4 text-gray-400 dark:text-gray-500 shrink-0" />
                        </div>
                    </div>

                    <div className="rounded-lg bg-[var(--ui-primary-soft)] p-4">
                        <h4 className="mb-2 text-xs font-bold text-[var(--ui-primary)]">{t('copy_path_modal_examples')}</h4>
                        <div className="space-y-2 font-mono text-xs text-[var(--ui-primary-strong)]">
                            <div className="opacity-80">cd "{path}"</div>
                            <div className="opacity-80">code "{path}"</div>
                            <div className="opacity-80">open "{path}"</div>
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div className="flex justify-end border-t border-[var(--ui-border)] bg-[var(--ui-surface-muted)] p-4">
                    <button
                        onClick={onClose}
                        className="rounded-lg bg-[var(--ui-primary-strong)] px-4 py-2 text-sm font-medium text-white transition-colors hover:brightness-95"
                    >
                        {t('copy_path_modal_acknowledge')}
                    </button>
                </div>
            </div>
        </div>
    );
}
