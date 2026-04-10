export const STARTER_SCAN_COMPLETED_KEY = 'sfe_starter_scan_completed';

export interface StarterScanSuggestion {
  path: string;
  label: string;
  description: string;
}

export function normalizeStarterScanSuggestions(suggestions: StarterScanSuggestion[]) {
  const seen = new Set<string>();
  const normalized: StarterScanSuggestion[] = [];

  for (const suggestion of suggestions) {
    const path = suggestion.path.trim();
    if (!path || seen.has(path.toLowerCase())) {
      continue;
    }

    seen.add(path.toLowerCase());
    normalized.push({
      path,
      label: suggestion.label.trim() || path.split(/[/\\]/).pop() || path,
      description: suggestion.description.trim(),
    });
  }

  return normalized;
}

export function shouldPromptForStarterScan({
  hasCompletedStarterScan,
  indexedFileCount,
  suggestions,
}: {
  hasCompletedStarterScan: boolean;
  indexedFileCount: number;
  suggestions: StarterScanSuggestion[];
}) {
  return !hasCompletedStarterScan && indexedFileCount === 0 && suggestions.length > 0;
}
