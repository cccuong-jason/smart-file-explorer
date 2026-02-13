import { X, Copy, Terminal } from 'lucide-react';

interface CopyPathInstructionModalProps {
    isOpen: boolean;
    onClose: () => void;
    path: string;
}

export function CopyPathInstructionModal({ isOpen, onClose, path }: CopyPathInstructionModalProps) {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in duration-200">
            <div className="bg-white rounded-xl shadow-2xl max-w-md w-full overflow-hidden animate-in zoom-in-95 duration-200">
                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b border-gray-100 bg-gray-50/50">
                    <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                        <Terminal className="w-4 h-4 text-indigo-600" />
                        How to use this path
                    </h3>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Content */}
                <div className="p-6 space-y-4">
                    <p className="text-sm text-gray-600 leading-relaxed">
                        The path has been copied to your clipboard. You can paste it directly into your terminal or file explorer's address bar.
                    </p>

                    <div className="space-y-2">
                        <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider">Copied Path</h4>
                        <div className="bg-gray-100 p-3 rounded-lg border border-gray-200 flex items-center gap-3">
                            <code className="text-xs font-mono text-indigo-700 break-all flex-1">{path}</code>
                            <Copy className="w-4 h-4 text-gray-400 shrink-0" />
                        </div>
                    </div>

                    <div className="bg-indigo-50 p-4 rounded-lg">
                        <h4 className="text-xs font-bold text-indigo-800 mb-2">Example Commands</h4>
                        <div className="space-y-2 font-mono text-xs text-indigo-700">
                            <div className="opacity-80">cd "{path}"</div>
                            <div className="opacity-80">code "{path}"</div>
                            <div className="opacity-80">open "{path}"</div>
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div className="p-4 bg-gray-50 border-t border-gray-100 flex justify-end">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 bg-gray-900 text-white rounded-lg text-sm font-medium hover:bg-gray-800 transition-colors"
                    >
                        Got it
                    </button>
                </div>
            </div>
        </div>
    );
}
