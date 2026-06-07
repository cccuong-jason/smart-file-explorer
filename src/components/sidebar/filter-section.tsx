import { ChevronDown, ChevronRight } from '@/components/icons';
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
                        group flex items-center justify-between px-2 py-1.5 rounded cursor-pointer transition-all
                        ${isSelected ? 'border-2 border-border bg-secondary text-foreground shadow' : 'border-2 border-transparent text-foreground/80 hover:border-border hover:bg-muted'}
                    `}
                >
                    <div className="flex items-center gap-2.5">
                        <div className={`
                            w-4 h-4 rounded border-2 flex items-center justify-center transition-all flex-shrink-0
                            ${type === 'radio' ? 'rounded-full' : 'rounded-[4px]'}
                            ${isSelected
                                ? 'bg-primary border-border'
                                : 'border-border bg-card group-hover:bg-muted'}
                        `}>
                            {isSelected && (
                                type === 'radio'
                                    ? <div className="w-1.5 h-1.5 bg-primary-foreground rounded-full" />
                                    : <svg className="w-2.5 h-2.5 text-primary-foreground" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
                            )}
                        </div>

                        <span className={`text-sm flex items-center gap-2 ${isSelected ? 'font-medium' : ''}`}>
                            {option.icon && (
                                <span className={`${isSelected ? 'text-foreground' : 'text-muted-foreground group-hover:text-foreground'}`}>
                                    {option.icon}
                                </span>
                            )}
                            {option.label}
                        </span>
                    </div>

                    {option.count !== undefined && (
                        <span className={`
                            text-[10px] px-1.5 py-0.5 rounded border border-border font-medium transition-colors
                            ${isSelected ? 'bg-card text-foreground' : 'bg-muted text-muted-foreground group-hover:bg-card'}
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
        <div className="py-4 border-b-2 border-border last:border-0">
            <button
                onClick={() => setIsExpanded(!isExpanded)}
                className="flex items-center justify-between w-full text-left mb-3 group"
            >
                <span className="font-head text-xs uppercase tracking-wider text-muted-foreground group-hover:text-foreground transition-colors">
                    {title}
                </span>
                {isExpanded ? (
                    <ChevronDown className="h-3.5 w-3.5 text-muted-foreground group-hover:text-foreground" />
                ) : (
                    <ChevronRight className="h-3.5 w-3.5 text-muted-foreground group-hover:text-foreground" />
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
