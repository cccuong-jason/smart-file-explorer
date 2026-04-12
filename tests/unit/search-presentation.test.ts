import { describe, expect, it } from 'vitest';

import {
  DEFAULT_MAX_SEARCH_RESULTS,
  getConfidencePresentation,
  getReasonPresentation,
} from '@/lib/search/presentation';

describe('search presentation metadata', () => {
  it('provides descriptive confidence legend content', () => {
    const confidence = getConfidencePresentation('medium');

    expect(confidence.labelKey).toBe('confidence_medium');
    expect(confidence.legendKey).toBe('confidence_medium_legend');
    expect(confidence.tone).toBe('indigo');
  });

  it('provides concrete explanation copy and tone for semantic matches', () => {
    const reason = getReasonPresentation('semantic');

    expect(reason.labelKey).toBe('match_reason_semantic');
    expect(reason.descriptionKey).toBe('match_reason_semantic_description');
    expect(reason.tone).toBe('violet');
  });

  it('uses a generous default search result cap for pagination', () => {
    expect(DEFAULT_MAX_SEARCH_RESULTS).toBeGreaterThan(20);
  });
});
