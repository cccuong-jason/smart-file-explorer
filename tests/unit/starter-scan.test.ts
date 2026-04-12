import { describe, expect, it } from 'vitest';
import {
  normalizeStarterScanSuggestions,
  shouldPromptForStarterScan,
  type StarterScanSuggestion,
} from '@/lib/onboarding/starter-scan';

describe('starter scan helpers', () => {
  const suggestions: StarterScanSuggestion[] = [
    { path: 'C:/Users/jason/Documents', label: 'Documents', description: 'Work documents' },
    { path: 'C:/Users/jason/Desktop', label: 'Desktop', description: 'Recent files' },
  ];

  it('prompts for guided starter scan only when the app has no indexed files and starter setup is not complete', () => {
    expect(
      shouldPromptForStarterScan({
        hasCompletedStarterScan: false,
        indexedFileCount: 0,
        suggestions,
      })
    ).toBe(true);

    expect(
      shouldPromptForStarterScan({
        hasCompletedStarterScan: true,
        indexedFileCount: 0,
        suggestions,
      })
    ).toBe(false);

    expect(
      shouldPromptForStarterScan({
        hasCompletedStarterScan: false,
        indexedFileCount: 12,
        suggestions,
      })
    ).toBe(false);
  });

  it('deduplicates starter scan suggestions by path and keeps the first entry', () => {
    expect(
      normalizeStarterScanSuggestions([
        suggestions[0],
        { path: 'C:/Users/jason/Documents', label: 'Docs copy', description: 'Duplicate' },
        suggestions[1],
      ])
    ).toEqual(suggestions);
  });
});
