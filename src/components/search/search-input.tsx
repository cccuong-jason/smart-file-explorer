import { Search, Loader2 } from 'lucide-react';
import { useState, useEffect } from 'react';

interface SearchInputProps {
    onSearch: (query: string) => void;
    isSearching: boolean;
}

export function SearchInput({ onSearch, isSearching }: SearchInputProps) {
    const [query, setQuery] = useState('');
    const [history, setHistory] = useState<string[]>([]);
    const [showHistory, setShowHistory] = useState(false);

    useEffect(() => {
        const saved = localStorage.getItem('search_history');
        if (saved) setHistory(JSON.parse(saved));
    }, []);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (query.trim()) {
            const newHistory = [query, ...history.filter(h => h !== query)].slice(0, 5);
            setHistory(newHistory);
            localStorage.setItem('search_history', JSON.stringify(newHistory));
        }
        onSearch(query);
        setShowHistory(false);
    };

    const handleHistoryClick = (q: string) => {
        setQuery(q);
        onSearch(q);
        setShowHistory(false);
    };

    return (
        <form onSubmit={handleSubmit} className="relative w-full max-w-2xl mx-auto z-50">
            <div className="relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-500" />
                <input
                    type="text"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    onFocus={() => setShowHistory(true)}
                    onBlur={() => setTimeout(() => setShowHistory(false), 200)}
                    placeholder="Search files by name or content..."
                    className="w-full rounded-full border border-gray-200 bg-white pl-12 pr-14 py-4 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-4 focus:ring-indigo-500/10 transition-all text-lg placeholder:text-gray-500 text-gray-900"
                    disabled={isSearching}
                />
                <div className="absolute right-4 top-1/2 -translate-y-1/2">
                    {isSearching ? (
                        <Loader2 className="h-5 w-5 animate-spin text-indigo-600" />
                    ) : (
                        <kbd className="hidden sm:inline-block px-2 py-1 text-xs font-semibold text-gray-500 bg-gray-50 border border-gray-200 rounded-md">
                            Enter
                        </kbd>
                    )}
                </div>
            </div>

            {/* History Dropdown */}
            {showHistory && history.length > 0 && (
                <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-xl shadow-xl border border-gray-100 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                    <div className="px-4 py-2 text-xs font-semibold text-gray-400 uppercase bg-gray-50/50">Recent Searches</div>
                    {history.map((h, i) => (
                        <button
                            key={i}
                            type="button"
                            onClick={() => handleHistoryClick(h)}
                            className="w-full text-left px-4 py-3 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2 transition-colors"
                        >
                            <Search className="w-4 h-4 text-gray-400" />
                            {h}
                        </button>
                    ))}
                </div>
            )}
        </form>
    );
}
