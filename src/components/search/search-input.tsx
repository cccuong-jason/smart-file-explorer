import { Search, Loader2 } from 'lucide-react';
import { useState, useEffect, useRef } from 'react';
import { useTranslation } from '@/lib/i18n';

export interface SearchRequest {
    mode: 'lexical' | 'semantic';
    trigger: 'change' | 'submit' | 'history' | 'clear';
}

interface SearchInputProps {
    onSearch: (query: string, request?: SearchRequest) => void;
    isSearching: boolean;
}

export function SearchInput({ onSearch, isSearching }: SearchInputProps) {
    const { t } = useTranslation();
    const [query, setQuery] = useState('');
    const [history, setHistory] = useState<string[]>([]);
    const [showHistory, setShowHistory] = useState(false);
    const lexicalTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const semanticTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const hasInteractedRef = useRef(false);

    useEffect(() => {
        const saved = localStorage.getItem('search_history');
        if (saved) setHistory(JSON.parse(saved));
    }, []);

    useEffect(() => {
        return () => {
            if (lexicalTimerRef.current) clearTimeout(lexicalTimerRef.current);
            if (semanticTimerRef.current) clearTimeout(semanticTimerRef.current);
        };
    }, []);

    useEffect(() => {
        if (!hasInteractedRef.current) {
            return;
        }

        if (lexicalTimerRef.current) clearTimeout(lexicalTimerRef.current);
        if (semanticTimerRef.current) clearTimeout(semanticTimerRef.current);

        const trimmed = query.trim();
        if (!trimmed) {
            onSearch('', { mode: 'lexical', trigger: 'clear' });
            return;
        }

        lexicalTimerRef.current = setTimeout(() => {
            onSearch(trimmed, { mode: 'lexical', trigger: 'change' });
        }, 150);

        semanticTimerRef.current = setTimeout(() => {
            onSearch(trimmed, { mode: 'semantic', trigger: 'change' });
        }, 450);
    }, [query, onSearch]);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const trimmed = query.trim();
        if (lexicalTimerRef.current) clearTimeout(lexicalTimerRef.current);
        if (semanticTimerRef.current) clearTimeout(semanticTimerRef.current);

        if (trimmed) {
            const newHistory = [trimmed, ...history.filter(h => h !== trimmed)].slice(0, 5);
            setHistory(newHistory);
            localStorage.setItem('search_history', JSON.stringify(newHistory));
        }
        onSearch(trimmed, { mode: trimmed ? 'semantic' : 'lexical', trigger: trimmed ? 'submit' : 'clear' });
        setShowHistory(false);
    };

    const handleHistoryClick = (q: string) => {
        setQuery(q);
        if (lexicalTimerRef.current) clearTimeout(lexicalTimerRef.current);
        if (semanticTimerRef.current) clearTimeout(semanticTimerRef.current);
        onSearch(q, { mode: 'semantic', trigger: 'history' });
        setShowHistory(false);
    };

    return (
        <form onSubmit={handleSubmit} className="relative w-full max-w-2xl mx-auto z-50">
            <div className="relative" data-tour="search-bar">
                <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-primary" />
                <input
                    type="search"
                    value={query}
                    onChange={(e) => {
                        hasInteractedRef.current = true;
                        setQuery(e.target.value);
                    }}
                    onFocus={() => setShowHistory(true)}
                    onBlur={() => setTimeout(() => setShowHistory(false), 200)}
                    placeholder={t('search_input_placeholder')}
                    className="w-full rounded border-2 border-border bg-card py-4 pl-12 pr-14 text-lg text-foreground shadow-sm transition-all placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary"
                />
                <div className="absolute right-4 top-1/2 -translate-y-1/2">
                    {isSearching ? (
                        <Loader2 className="h-5 w-5 animate-spin text-primary" />
                    ) : (
                        <kbd className="hidden rounded border-2 border-border bg-secondary px-2 py-1 font-head text-xs font-semibold text-foreground sm:inline-block">
                            {t('search_submit_hint')}
                        </kbd>
                    )}
                </div>
            </div>

            {/* History Dropdown */}
            {showHistory && history.length > 0 && (
                <div className="absolute left-0 right-0 top-full mt-2 overflow-hidden rounded border-2 border-border bg-card shadow-md animate-in fade-in zoom-in-95 duration-200">
                    <div className="border-b-2 border-border bg-secondary px-4 py-2 font-head text-xs font-semibold uppercase text-muted-foreground">{t('search_recent')}</div>
                    {history.map((h, i) => (
                        <button
                            key={i}
                            type="button"
                            onClick={() => handleHistoryClick(h)}
                            className="flex w-full items-center gap-2 px-4 py-3 text-left text-sm text-foreground transition-colors hover:bg-secondary"
                        >
                            <Search className="h-4 w-4 text-muted-foreground" />
                            {h}
                        </button>
                    ))}
                </div>
            )}
        </form>
    );
}
