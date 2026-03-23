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
            <div className="bg-white dark:bg-gray-900 rounded-xl shadow-2xl max-w-md w-full overflow-hidden animate-in zoom-in-95 duration-200 border border-gray-100 dark:border-gray-800">
                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-800/70">
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
                        <div className="bg-gray-100 dark:bg-gray-800 p-3 rounded-lg border border-gray-200 dark:border-gray-700 flex items-center gap-3">
                            <code className="text-xs font-mono text-indigo-700 break-all flex-1">{path}</code>
                            <Copy className="w-4 h-4 text-gray-400 dark:text-gray-500 shrink-0" />
                        </div>
                    </div>

                    <div className="bg-indigo-50 dark:bg-indigo-950/40 p-4 rounded-lg">
                        <h4 className="text-xs font-bold text-indigo-800 dark:text-indigo-200 mb-2">{t('copy_path_modal_examples')}</h4>
                        <div className="space-y-2 font-mono text-xs text-indigo-700 dark:text-indigo-200">
                            <div className="opacity-80">cd "{path}"</div>
                            <div className="opacity-80">code "{path}"</div>
                            <div className="opacity-80">open "{path}"</div>
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div className="p-4 bg-gray-50 dark:bg-gray-800/70 border-t border-gray-100 dark:border-gray-800 flex justify-end">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 bg-gray-900 text-white rounded-lg text-sm font-medium hover:bg-gray-800 transition-colors"
                    >
                        {t('copy_path_modal_acknowledge')}
                    </button>
                </div>
            </div>
        </div>
    );
}
