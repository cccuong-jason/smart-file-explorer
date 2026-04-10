import type { SearchConfidence, SearchReasonCode } from './core';

export const DEFAULT_MAX_SEARCH_RESULTS = 200;

export type PresentationTone =
  | 'indigo'
  | 'blue'
  | 'violet'
  | 'amber'
  | 'emerald'
  | 'pink'
  | 'yellow'
  | 'slate';

type ToneClasses = {
  badge: string;
  mutedBadge: string;
  section: string;
  row: string;
  dot: string;
};

type ConfidencePresentation = {
  labelKey: string;
  legendKey: string;
  tone: PresentationTone;
};

type ReasonPresentation = {
  labelKey: string;
  descriptionKey: string;
  tone: PresentationTone;
};

const toneClasses: Record<PresentationTone, ToneClasses> = {
  indigo: {
    badge:
      'border-indigo-200 bg-indigo-50 text-indigo-700 dark:border-indigo-900 dark:bg-indigo-950/40 dark:text-indigo-200',
    mutedBadge:
      'bg-indigo-50 text-indigo-700 dark:bg-indigo-950/30 dark:text-indigo-200',
    section:
      'border-indigo-100 bg-indigo-50/70 dark:border-indigo-900 dark:bg-indigo-950/30',
    row:
      'border-indigo-200/80 bg-white/80 dark:border-indigo-900 dark:bg-gray-950/60',
    dot: 'bg-indigo-500 dark:bg-indigo-300',
  },
  blue: {
    badge:
      'border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-900 dark:bg-blue-950/40 dark:text-blue-200',
    mutedBadge:
      'bg-blue-50 text-blue-700 dark:bg-blue-950/30 dark:text-blue-200',
    section:
      'border-blue-100 bg-blue-50/70 dark:border-blue-900 dark:bg-blue-950/30',
    row:
      'border-blue-200/80 bg-white/80 dark:border-blue-900 dark:bg-gray-950/60',
    dot: 'bg-blue-500 dark:bg-blue-300',
  },
  violet: {
    badge:
      'border-violet-200 bg-violet-50 text-violet-700 dark:border-violet-900 dark:bg-violet-950/40 dark:text-violet-200',
    mutedBadge:
      'bg-violet-50 text-violet-700 dark:bg-violet-950/30 dark:text-violet-200',
    section:
      'border-violet-100 bg-violet-50/70 dark:border-violet-900 dark:bg-violet-950/30',
    row:
      'border-violet-200/80 bg-white/80 dark:border-violet-900 dark:bg-gray-950/60',
    dot: 'bg-violet-500 dark:bg-violet-300',
  },
  amber: {
    badge:
      'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200',
    mutedBadge:
      'bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-200',
    section:
      'border-amber-100 bg-amber-50/70 dark:border-amber-900 dark:bg-amber-950/30',
    row:
      'border-amber-200/80 bg-white/80 dark:border-amber-900 dark:bg-gray-950/60',
    dot: 'bg-amber-500 dark:bg-amber-300',
  },
  emerald: {
    badge:
      'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200',
    mutedBadge:
      'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-200',
    section:
      'border-emerald-100 bg-emerald-50/70 dark:border-emerald-900 dark:bg-emerald-950/30',
    row:
      'border-emerald-200/80 bg-white/80 dark:border-emerald-900 dark:bg-gray-950/60',
    dot: 'bg-emerald-500 dark:bg-emerald-300',
  },
  pink: {
    badge:
      'border-pink-200 bg-pink-50 text-pink-700 dark:border-pink-900 dark:bg-pink-950/40 dark:text-pink-200',
    mutedBadge:
      'bg-pink-50 text-pink-700 dark:bg-pink-950/30 dark:text-pink-200',
    section:
      'border-pink-100 bg-pink-50/70 dark:border-pink-900 dark:bg-pink-950/30',
    row:
      'border-pink-200/80 bg-white/80 dark:border-pink-900 dark:bg-gray-950/60',
    dot: 'bg-pink-500 dark:bg-pink-300',
  },
  yellow: {
    badge:
      'border-yellow-200 bg-yellow-50 text-yellow-700 dark:border-yellow-900 dark:bg-yellow-950/40 dark:text-yellow-200',
    mutedBadge:
      'bg-yellow-50 text-yellow-700 dark:bg-yellow-950/30 dark:text-yellow-200',
    section:
      'border-yellow-100 bg-yellow-50/70 dark:border-yellow-900 dark:bg-yellow-950/30',
    row:
      'border-yellow-200/80 bg-white/80 dark:border-yellow-900 dark:bg-gray-950/60',
    dot: 'bg-yellow-500 dark:bg-yellow-300',
  },
  slate: {
    badge:
      'border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-800 dark:bg-slate-900/50 dark:text-slate-200',
    mutedBadge:
      'bg-slate-100 text-slate-700 dark:bg-slate-900/40 dark:text-slate-200',
    section:
      'border-slate-200 bg-slate-50/70 dark:border-slate-800 dark:bg-slate-900/40',
    row:
      'border-slate-200/80 bg-white/80 dark:border-slate-800 dark:bg-gray-950/60',
    dot: 'bg-slate-500 dark:bg-slate-300',
  },
};

export function getConfidencePresentation(confidence?: SearchConfidence): ConfidencePresentation {
  switch (confidence) {
    case 'high':
      return {
        labelKey: 'confidence_high',
        legendKey: 'confidence_high_legend',
        tone: 'emerald',
      };
    case 'low':
      return {
        labelKey: 'confidence_low',
        legendKey: 'confidence_low_legend',
        tone: 'amber',
      };
    case 'medium':
    default:
      return {
        labelKey: 'confidence_medium',
        legendKey: 'confidence_medium_legend',
        tone: 'indigo',
      };
  }
}

export function getReasonPresentation(reason: SearchReasonCode): ReasonPresentation {
  switch (reason) {
    case 'exact_name':
      return {
        labelKey: 'match_reason_exact_name',
        descriptionKey: 'match_reason_exact_name_description',
        tone: 'blue',
      };
    case 'filename_match':
      return {
        labelKey: 'match_reason_filename_match',
        descriptionKey: 'match_reason_filename_match_description',
        tone: 'indigo',
      };
    case 'semantic':
      return {
        labelKey: 'match_reason_semantic',
        descriptionKey: 'match_reason_semantic_description',
        tone: 'violet',
      };
    case 'project_context':
      return {
        labelKey: 'match_reason_project_context',
        descriptionKey: 'match_reason_project_context_description',
        tone: 'amber',
      };
    case 'content_terms':
      return {
        labelKey: 'match_reason_content_terms',
        descriptionKey: 'match_reason_content_terms_description',
        tone: 'emerald',
      };
    case 'tag_match':
      return {
        labelKey: 'match_reason_tag_match',
        descriptionKey: 'match_reason_tag_match_description',
        tone: 'pink',
      };
    case 'starred':
      return {
        labelKey: 'match_reason_starred',
        descriptionKey: 'match_reason_starred_description',
        tone: 'yellow',
      };
    case 'recent_update':
      return {
        labelKey: 'match_reason_recent_update',
        descriptionKey: 'match_reason_recent_update_description',
        tone: 'slate',
      };
    case 'latest_signal':
    default:
      return {
        labelKey: 'match_reason_latest_signal',
        descriptionKey: 'match_reason_latest_signal_description',
        tone: 'indigo',
      };
  }
}

export function getConfidenceTranslationKey(confidence?: SearchConfidence) {
  return getConfidencePresentation(confidence).labelKey;
}

export function getReasonTranslationKey(reason: SearchReasonCode) {
  return getReasonPresentation(reason).labelKey;
}

export function getToneClasses(tone: PresentationTone): ToneClasses {
  return toneClasses[tone];
}

export function getMatchPercentage(score?: number) {
  if (!score || Number.isNaN(score)) {
    return 0;
  }

  return Math.min(Math.max(Math.round(score * 100), 0), 100);
}
