'use client';

import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import { X, CheckCircle, AlertCircle, Info, AlertTriangle } from 'lucide-react';

export type ToastType = 'success' | 'error' | 'info' | 'warning';

interface Toast {
    id: string;
    message: string;
    type: ToastType;
    actionLabel?: string;
    onAction?: () => void;
}

interface ToastOptions {
    actionLabel?: string;
    onAction?: () => void;
}

interface ToastContextType {
    toast: (message: string, type?: ToastType, options?: ToastOptions) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export function useToast() {
    const context = useContext(ToastContext);
    if (!context) {
        throw new Error('useToast must be used within a ToastProvider');
    }
    return context;
}

export function ToastProvider({ children }: { children: ReactNode }) {
    const [toasts, setToasts] = useState<Toast[]>([]);

    const removeToast = useCallback((id: string) => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
    }, []);

    const addToast = useCallback((message: string, type: ToastType = 'info', options?: ToastOptions) => {
        const id = Math.random().toString(36).substring(2, 9);
        setToasts((prev) => [...prev, { id, message, type, actionLabel: options?.actionLabel, onAction: options?.onAction }]);

        setTimeout(() => {
            removeToast(id);
        }, 3000);
    }, [removeToast]);

    const getIcon = (type: ToastType) => {
        switch (type) {
            case 'success': return <CheckCircle className="w-5 h-5 text-green-500" />;
            case 'error': return <AlertCircle className="w-5 h-5 text-red-500" />;
            case 'warning': return <AlertTriangle className="w-5 h-5 text-amber-500" />;
            default: return <Info className="w-5 h-5 text-blue-500" />;
        }
    };

    return (
        <ToastContext.Provider value={{ toast: addToast }}>
            {children}
            <div data-testid="toast-viewport" className="fixed bottom-4 right-4 z-[300] flex flex-col gap-2 pointer-events-none">
                {toasts.map((t) => (
                    <div
                        key={t.id}
                        className="pointer-events-auto flex items-center gap-3 min-w-[300px] bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 shadow-lg rounded-lg p-4 animate-in slide-in-from-right-full fade-in duration-300"
                    >
                        {getIcon(t.type)}
                        <p className="text-sm font-medium text-gray-700 dark:text-gray-100 flex-1">{t.message}</p>
                        {t.actionLabel && t.onAction && (
                            <button
                                onClick={() => {
                                    t.onAction?.();
                                    removeToast(t.id);
                                }}
                                className="rounded-md border border-gray-200 px-2.5 py-1 text-xs font-semibold text-[var(--ui-primary)] transition-colors hover:bg-[var(--ui-primary-soft)] dark:border-gray-700"
                            >
                                {t.actionLabel}
                            </button>
                        )}
                        <button
                            onClick={() => removeToast(t.id)}
                            className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                        >
                            <X className="w-4 h-4" />
                        </button>
                    </div>
                ))}
            </div>
        </ToastContext.Provider>
    );
}
