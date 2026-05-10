import { ChevronDown, ChevronRight } from 'lucide-react';
import { useState } from 'react';

export interface FilterOption {
    id: string;
    label: string;
    count?: number;
    icon?: React.ReactNode;
    children?: FilterOption[];
}

interface FilterSectionProps {
    title: string;
    options: FilterOption[];
    selectedIds: string[];
    onChange: (id: string) => void;
    type?: 'checkbox' | 'radio';
    expanded?: boolean;
}

export function FilterSection({
    title,
    options,
    selectedIds,
    onChange,
    type = 'checkbox',
    expanded = true
}: FilterSectionProps) {
    const [isExpanded, setIsExpanded] = useState(expanded);

    const renderOption = (option: FilterOption, level = 0) => {
        const isSelected = selectedIds.includes(option.id);
        return (
            <div key={option.id} className={level > 0 ? 'ml-6' : ''}>
                <div
                    onClick={() => onChange(option.id)}
                    className={`
                        group flex items-center justify-between px-2 py-1.5 rounded-md cursor-pointer transition-all
                        ${isSelected ? 'bg-[var(--ui-primary-soft)] text-[var(--ui-primary)]' : 'text-gray-600 hover:bg-[var(--ui-surface-muted)] dark:text-gray-300'}
                    `}
                >
                    <div className="flex items-center gap-2.5">
                        <div className={`
                            w-4 h-4 rounded border flex items-center justify-center transition-all flex-shrink-0
                            ${type === 'radio' ? 'rounded-full' : 'rounded-[4px]'}
                            ${isSelected
                                ? 'bg-[var(--ui-primary)] border-[var(--ui-primary)]'
                                : 'border-[var(--ui-border)] bg-[var(--ui-surface)] group-hover:border-[var(--ui-primary-border)]'}
                        `}>
                            {isSelected && (
                                type === 'radio'
                                    ? <div className="w-1.5 h-1.5 bg-white rounded-full" />
                                    : <svg className="w-2.5 h-2.5 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
                            )}
                        </div>

                        <span className={`text-sm flex items-center gap-2 ${isSelected ? 'font-medium' : ''}`}>
                            {option.icon && (
                                <span className={`${isSelected ? 'text-[var(--ui-primary)]' : 'text-gray-400 group-hover:text-gray-500 dark:text-gray-500 dark:group-hover:text-gray-300'}`}>
                                    {option.icon}
                                </span>
                            )}
                            {option.label}
                        </span>
                    </div>

                    {option.count !== undefined && (
                        <span className={`
                            text-[10px] px-1.5 py-0.5 rounded-full font-medium transition-colors
                            ${isSelected ? 'bg-[var(--ui-surface)] text-[var(--ui-primary)]' : 'bg-[var(--ui-surface-muted)] text-gray-400 group-hover:bg-[var(--ui-surface)] dark:text-gray-500'}
                        `}>
                            {option.count}
                        </span>
                    )}
                </div>

                {option.children && option.children.length > 0 && (
                    <div className="space-y-1 pt-1">
                        {option.children.map((child) => renderOption(child, level + 1))}
                    </div>
                )}
            </div>
        );
    };

    return (
        <div className="py-4 border-b border-[var(--ui-border)] last:border-0">
            <button
                onClick={() => setIsExpanded(!isExpanded)}
                className="flex items-center justify-between w-full text-left mb-3 group"
            >
                <span className="text-xs font-bold uppercase tracking-wider text-gray-400 group-hover:text-[var(--ui-primary)] transition-colors dark:text-gray-500">
                    {title}
                </span>
                {isExpanded ? (
                    <ChevronDown className="h-3.5 w-3.5 text-gray-300 group-hover:text-[var(--ui-primary)] dark:text-gray-600" />
                ) : (
                    <ChevronRight className="h-3.5 w-3.5 text-gray-300 group-hover:text-[var(--ui-primary)] dark:text-gray-600" />
                )}
            </button>

            {isExpanded && (
                <div className="space-y-1">
                    {options.map((option) => renderOption(option))}
                </div>
            )}
        </div>
    );
}
