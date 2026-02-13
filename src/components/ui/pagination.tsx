import { ChevronLeft, ChevronRight } from 'lucide-react';

interface PaginationProps {
    currentPage: number;
    totalPages: number;
    onPageChange: (page: number) => void;
}

export function Pagination({ currentPage, totalPages, onPageChange }: PaginationProps) {
    if (totalPages <= 1) return null;

    // Simple range generation for now. 
    // For production, we might want "1, 2, ..., 10, 11" logic.
    // Let's implement a smart range.
    const getPageNumbers = () => {
        const delta = 2;
        const range = [];
        for (let i = Math.max(2, currentPage - delta); i <= Math.min(totalPages - 1, currentPage + delta); i++) {
            range.push(i);
        }

        const showStart = currentPage - delta > 2;
        const showEnd = currentPage + delta < totalPages - 1;

        const pages = [1];
        if (showStart) pages.push(-1); // -1 for ellipsis
        pages.push(...range);
        if (showEnd) pages.push(-1);
        if (totalPages > 1) pages.push(totalPages);

        return pages;
    };

    return (
        <div className="flex items-center justify-center gap-1">
            <button
                disabled={currentPage === 1}
                onClick={() => onPageChange(currentPage - 1)}
                className="p-2 rounded-lg hover:bg-gray-100 disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
            >
                <ChevronLeft className="h-4 w-4" />
            </button>

            {getPageNumbers().map((page, idx) => (
                page === -1 ? (
                    <span key={`ellipsis-${idx}`} className="w-8 text-center text-gray-400">...</span>
                ) : (
                    <button
                        key={page}
                        onClick={() => onPageChange(page)}
                        className={`
                    w-8 h-8 rounded-lg text-sm font-medium transition-colors
                    ${currentPage === page
                                ? 'bg-indigo-600 text-white shadow-sm'
                                : 'text-gray-600 hover:bg-gray-100'}
                `}
                    >
                        {page}
                    </button>
                )
            ))}

            <button
                disabled={currentPage === totalPages}
                onClick={() => onPageChange(currentPage + 1)}
                className="p-2 rounded-lg hover:bg-gray-100 disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
            >
                <ChevronRight className="h-4 w-4" />
            </button>
        </div>
    );
}
