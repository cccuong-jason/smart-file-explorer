import { X, Copy, Terminal } from '@/components/icons';
import { useTranslation } from '@/lib/i18n';
import { Button } from '@/components/retroui/Button';

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
            <div className="w-full max-w-md overflow-hidden rounded border-2 border-border bg-card text-card-foreground shadow-md animate-in zoom-in-95 duration-200">
                {/* Header */}
                <div className="flex items-center justify-between border-b-2 border-border bg-secondary p-4">
                    <h3 className="flex items-center gap-2 font-head font-semibold text-foreground">
                        <Terminal className="h-4 w-4 text-primary" />
                        {t('copy_path_modal_title')}
                    </h3>
                    <Button type="button" onClick={onClose} variant="outline" size="icon" className="bg-card text-foreground">
                        <X className="h-5 w-5" />
                    </Button>
                </div>

                {/* Content */}
                <div className="p-6 space-y-4">
                    <p className="text-sm leading-relaxed text-muted-foreground">
                        {t('copy_path_modal_description')}
                    </p>

                    <div className="space-y-2">
                        <h4 className="font-head text-xs font-bold uppercase text-muted-foreground">{t('copy_path_modal_label')}</h4>
                        <div className="flex items-center gap-3 rounded border-2 border-border bg-secondary p-3">
                            <code className="flex-1 break-all font-mono text-xs text-primary">{path}</code>
                            <Copy className="h-4 w-4 shrink-0 text-muted-foreground" />
                        </div>
                    </div>

                    <div className="rounded border-2 border-border bg-secondary p-4">
                        <h4 className="mb-2 font-head text-xs font-bold text-primary">{t('copy_path_modal_examples')}</h4>
                        <div className="space-y-2 font-mono text-xs text-foreground">
                            <div className="opacity-80">cd "{path}"</div>
                            <div className="opacity-80">code "{path}"</div>
                            <div className="opacity-80">open "{path}"</div>
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div className="flex justify-end border-t-2 border-border bg-secondary p-4">
                    <Button
                        type="button"
                        onClick={onClose}
                        size="sm"
                    >
                        {t('copy_path_modal_acknowledge')}
                    </Button>
                </div>
            </div>
        </div>
    );
}
