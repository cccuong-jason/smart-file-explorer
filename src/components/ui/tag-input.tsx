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
                <span key={tag} className="flex items-center gap-1 rounded border-2 border-border bg-secondary px-2 py-1 font-head text-xs text-foreground">
                    {tag}
                    <button
                        onClick={() => onRemoveTag(tag)}
                        className="hover:text-primary focus:outline-none"
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
                        className="w-24 rounded border-2 border-border bg-card px-2 py-1 text-xs text-foreground outline-none placeholder:text-muted-foreground focus:border-primary"
                    />
                </div>
            ) : (
                <button
                    onClick={() => setIsInputVisible(true)}
                    className="flex items-center gap-1 rounded border-2 border-dashed border-border px-2 py-1 font-head text-xs text-muted-foreground transition-all hover:border-primary hover:text-primary"
                >
                    <Plus className="w-3 h-3" /> {t('add_tag')}
                </button>
            )}
        </div>
    );
}
