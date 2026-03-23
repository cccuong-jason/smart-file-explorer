import { X, Plus } from 'lucide-react';
import { useState, KeyboardEvent } from 'react';
import { useTranslation } from '@/lib/i18n';

interface TagInputProps {
    tags: string[];
    onAddTag: (tag: string) => void;
    onRemoveTag: (tag: string) => void;
}

export function TagInput({ tags, onAddTag, onRemoveTag }: TagInputProps) {
    const { t } = useTranslation();
    const [inputValue, setInputValue] = useState('');
    const [isInputVisible, setIsInputVisible] = useState(false);

    const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            const tag = inputValue.trim();
            if (tag && !tags.includes(tag)) {
                onAddTag(tag);
                setInputValue('');
            }
        }
    };

    return (
        <div className="flex flex-wrap gap-2 items-center">
            {tags.map(tag => (
                <span key={tag} className="bg-indigo-50 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-200 text-xs px-2 py-1 rounded-full flex items-center gap-1 border border-indigo-100 dark:border-indigo-900">
                    {tag}
                    <button
                        onClick={() => onRemoveTag(tag)}
                        className="hover:text-indigo-900 dark:hover:text-indigo-100 focus:outline-none"
                    >
                        <X className="w-3 h-3" />
                    </button>
                </span>
            ))}

            {isInputVisible ? (
                <div className="flex items-center">
                    <input
                        type="text"
                        value={inputValue}
                        onChange={(e) => setInputValue(e.target.value)}
                        onKeyDown={handleKeyDown}
                        onBlur={() => {
                            if (!inputValue) setIsInputVisible(false);
                        }}
                        autoFocus
                        placeholder={`${t('add_tag')}...`}
                        className="text-xs border border-indigo-200 dark:border-indigo-800 rounded-full px-2 py-1 outline-none focus:border-indigo-400 w-24 text-gray-700 dark:text-gray-100 bg-white dark:bg-gray-900 placeholder-gray-400 dark:placeholder:text-gray-500"
                    />
                </div>
            ) : (
                <button
                    onClick={() => setIsInputVisible(true)}
                    className="text-xs flex items-center gap-1 text-gray-400 dark:text-gray-500 hover:text-indigo-600 dark:hover:text-indigo-300 border border-dashed border-gray-300 dark:border-gray-700 hover:border-indigo-300 dark:hover:border-indigo-700 rounded-full px-2 py-1 transition-all"
                >
                    <Plus className="w-3 h-3" /> {t('add_tag')}
                </button>
            )}
        </div>
    );
}
