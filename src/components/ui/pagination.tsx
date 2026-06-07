import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useState, useRef, useEffect, useMemo } from 'react';

import { Button } from '@/components/retroui/Button';

interface PaginationProps {
    currentPage: number;
    totalPages: number;
    onPageChange: (page: number) => void;
}

export function Pagination({ currentPage, totalPages, onPageChange }: PaginationProps) {
    const containerRef = useRef<HTMLDivElement>(null);
    const pageRefs = useRef<Record<number, HTMLButtonElement>>({});
    const [highlightStyle, setHighlightStyle] = useState({ left: 0, width: 0, opacity: 0 });

    const pages = useMemo(() => {
        const delta = 2;
        const range = [];
        for (let i = Math.max(2, currentPage - delta); i <= Math.min(totalPages - 1, currentPage + delta); i++) {
            range.push(i);
        }

        const showStart = currentPage - delta > 2;
        const showEnd = currentPage + delta < totalPages - 1;

        const p = [1];
        if (showStart) p.push(-1); // -1 for ellipsis
        p.push(...range);
        if (showEnd) p.push(-1);
        if (totalPages > 1) p.push(totalPages);

        return p;
    }, [currentPage, totalPages]);

    useEffect(() => {
        const activeButton = pageRefs.current[currentPage];
        const container = containerRef.current;
        if (activeButton && container) {
            const containerRect = container.getBoundingClientRect();
            const buttonRect = activeButton.getBoundingClientRect();
            setHighlightStyle({
                left: buttonRect.left - containerRect.left,
                width: buttonRect.width,
                opacity: 1
            });
        } else {
            setHighlightStyle(prev => ({ ...prev, opacity: 0 }));
        }
    }, [currentPage, pages]);

    if (totalPages <= 1) return null;

    return (
        <div className="flex items-center justify-center gap-2">
            <Button
                variant="outline"
                size="icon"
                disabled={currentPage === 1}
                onClick={() => onPageChange(currentPage - 1)}
                className="h-9 w-9 text-foreground disabled:pointer-events-none disabled:opacity-20"
                aria-label="Previous Page"
            >
                <ChevronLeft className="h-4 w-4" />
            </Button>

            <div 
                ref={containerRef}
                className="relative flex items-center rounded-md border-2 border-border bg-secondary p-1 shadow-md"
            >
                {/* Smooth sliding highlight */}
                <div 
                    className="absolute h-8 rounded bg-primary shadow transition-all duration-300 ease-in-out pointer-events-none z-0"
                    style={{
                        left: `${highlightStyle.left}px`,
                        width: `${highlightStyle.width}px`,
                        opacity: highlightStyle.opacity,
                        top: '4px' // Centered within the p-1 padding
                    }}
                />

                {pages.map((page, idx) => (
                    page === -1 ? (
                        <div key={`ellipsis-${idx}`} className="w-8 h-8 flex items-center justify-center text-gray-400 select-none text-xs font-bold">
                            ...
                        </div>
                    ) : (
                        <Button
                            variant="ghost"
                            size="icon"
                            key={page}
                            ref={el => { if(el) pageRefs.current[page] = el; }}
                            onClick={() => onPageChange(page)}
                            className={`
                                relative z-10 h-8 w-8 border-0 text-xs font-bold shadow-none transition-colors duration-200 hover:translate-y-0 active:translate-y-0 active:translate-x-0
                                ${currentPage === page
                                    ? 'text-primary-foreground hover:bg-transparent'
                                    : 'text-foreground hover:bg-transparent'}
                            `}
                        >
                            {page}
                        </Button>
                    )
                ))}
            </div>

            <Button
                variant="outline"
                size="icon"
                disabled={currentPage === totalPages}
                onClick={() => onPageChange(currentPage + 1)}
                className="h-9 w-9 text-foreground disabled:pointer-events-none disabled:opacity-20"
                aria-label="Next Page"
            >
                <ChevronRight className="h-4 w-4" />
            </Button>
        </div>
    );
}
