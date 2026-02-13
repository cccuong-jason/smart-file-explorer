import { Search, Loader2 } from 'lucide-react';
import { useState } from 'react';

interface SearchInputProps {
    onSearch: (query: string) => void;
    isSearching: boolean;
}

export function SearchInput({ onSearch, isSearching }: SearchInputProps) {
    const [query, setQuery] = useState('');

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onSearch(query);
    };

    return (
        <form onSubmit={handleSubmit} className="relative w-full max-w-2xl mx-auto">
            <div className="relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                <input
                    type="text"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Search files by name or content..."
                    className="w-full rounded-full border border-gray-200 bg-white pl-12 pr-14 py-4 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-4 focus:ring-blue-500/10 transition-all text-lg"
                    disabled={isSearching}
                />
                <div className="absolute right-4 top-1/2 -translate-y-1/2">
                    {isSearching ? (
                        <Loader2 className="h-5 w-5 animate-spin text-blue-600" />
                    ) : (
                        <kbd className="hidden sm:inline-block px-2 py-1 text-xs font-semibold text-gray-400 bg-gray-50 border border-gray-200 rounded-md">
                            Enter
                        </kbd>
                    )}
                </div>
            </div>
        </form>
    );
}
