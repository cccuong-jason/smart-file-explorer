import { AlertCircle, X } from '@/components/icons';
import { useState } from 'react';

import { Button } from '@/components/retroui/Button';

interface HelperAlertProps {
    title: string;
    message: string;
    onDismiss?: () => void;
    className?: string;
}

export function HelperAlert({ title, message, onDismiss, className = '' }: HelperAlertProps) {
    const [isVisible, setIsVisible] = useState(true);

    if (!isVisible) return null;

    return (
        <div className={`relative rounded-md border-2 border-border bg-secondary p-3 shadow ${className}`}>
            <div className="flex gap-3">
                <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-foreground" />
                <div className="flex-1">
                    <h4 className="mb-1 font-head text-sm text-foreground">{title}</h4>
                    <p className="text-xs leading-relaxed text-foreground/80">
                        {message}
                    </p>
                </div>
                <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => {
                        setIsVisible(false);
                        onDismiss?.();
                    }}
                    className="h-7 w-7 border-0 shadow-none hover:translate-y-0 active:translate-x-0 active:translate-y-0"
                >
                    <X className="h-4 w-4" />
                </Button>
            </div>
        </div>
    );
}
