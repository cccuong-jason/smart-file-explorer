import { AlertCircle, X } from 'lucide-react';
import { useState } from 'react';

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
        <div className={`bg-amber-50 border border-amber-200 rounded-lg p-3 relative ${className}`}>
            <div className="flex gap-3">
                <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                <div className="flex-1">
                    <h4 className="text-sm font-semibold text-amber-800 mb-1">{title}</h4>
                    <p className="text-xs text-amber-700 leading-relaxed">
                        {message}
                    </p>
                </div>
                <button
                    onClick={() => {
                        setIsVisible(false);
                        onDismiss?.();
                    }}
                    className="text-amber-400 hover:text-amber-600 transition-colors"
                >
                    <X className="w-4 h-4" />
                </button>
            </div>
        </div>
    );
}
