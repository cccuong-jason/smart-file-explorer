'use client';

import { ReactNode, useState, useCallback, useEffect } from 'react';

interface ResizableLayoutProps {
    sidebar: ReactNode;
    content: ReactNode;
    preview: ReactNode;
}

export function ResizableLayout({ sidebar, content, preview }: ResizableLayoutProps) {
    const [sidebarWidth, setSidebarWidth] = useState(280);
    const [previewWidth, setPreviewWidth] = useState(350);
    const [isResizingSidebar, setIsResizingSidebar] = useState(false);
    const [isResizingPreview, setIsResizingPreview] = useState(false);

    const startResizingSidebar = useCallback(() => setIsResizingSidebar(true), []);
    const startResizingPreview = useCallback(() => setIsResizingPreview(true), []);
    const stopResizing = useCallback(() => {
        setIsResizingSidebar(false);
        setIsResizingPreview(false);
    }, []);

    const resize = useCallback(
        (mouseMoveEvent: MouseEvent) => {
            if (isResizingSidebar) {
                setSidebarWidth(currentWidth => {
                    const newWidth = mouseMoveEvent.clientX;
                    if (newWidth < 200) return 200;
                    if (newWidth > 400) return 400;
                    return newWidth;
                });
            }
            if (isResizingPreview) {
                setPreviewWidth(currentWidth => {
                    const newWidth = window.innerWidth - mouseMoveEvent.clientX;
                    if (newWidth < 250) return 250;
                    if (newWidth > 600) return 600;
                    return newWidth;
                });
            }
        },
        [isResizingSidebar, isResizingPreview]
    );

    useEffect(() => {
        window.addEventListener('mousemove', resize);
        window.addEventListener('mouseup', stopResizing);
        return () => {
            window.removeEventListener('mousemove', resize);
            window.removeEventListener('mouseup', stopResizing);
        };
    }, [resize, stopResizing]);

    return (
        <div className="flex h-[calc(100vh-64px)] overflow-hidden bg-gray-50 dark:bg-gray-950 select-none">
            {/* Sidebar */}
            <aside
                className="shrink-0 bg-white dark:bg-gray-900 overflow-y-auto flex flex-col border-r border-transparent dark:border-gray-800"
                style={{ width: sidebarWidth }}
            >
                {sidebar}
            </aside>

            {/* Resizer 1 */}
            <div
                className="w-1 cursor-col-resize hover:bg-indigo-400 active:bg-indigo-600 transition-colors bg-gray-200 dark:bg-gray-800 z-10"
                onMouseDown={startResizingSidebar}
            />

            {/* Main Content */}
            <main className="flex-1 min-w-0 overflow-y-auto bg-white dark:bg-gray-900 relative">
                {content}
            </main>

            {/* Resizer 2 */}
            <div
                className="w-1 cursor-col-resize hover:bg-indigo-400 active:bg-indigo-600 transition-colors bg-gray-200 dark:bg-gray-800 z-10 hidden xl:block"
                onMouseDown={startResizingPreview}
            />

            {/* Preview */}
            <aside
                className="shrink-0 bg-gray-50 dark:bg-gray-950 overflow-y-auto hidden xl:block border-l border-gray-100 dark:border-gray-800"
                style={{ width: previewWidth }}
            >
                {preview}
            </aside>
        </div>
    );
}
