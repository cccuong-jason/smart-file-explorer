import Fuse from 'fuse.js';
import { DEFAULT_MAX_SEARCH_RESULTS } from './presentation';

export interface SearchableFile {
  path: string;
  name: string;
  content?: string;
  embedding?: number[];
  lastModified?: number;
  tags?: string[];
  isStarred?: boolean;
}

export interface SearchableChunk {
  id: string;
  filePath: string;
  index: number;
  text: string;
  embedding?: number[];
  pageNumber?: number;
  sourceLabel?: string;
}

export type SearchReasonCode =
  | 'exact_name'
  | 'filename_match'
  | 'semantic'
  | 'project_context'
  | 'content_terms'
  | 'tag_match'
  | 'starred'
  | 'recent_update'
  | 'latest_signal';

export type SearchConfidence = 'high' | 'medium' | 'low';

export interface RankedSearchResult {
  file: SearchableFile;
  score: number;
  confidence: SearchConfidence;
  reasons: SearchReasonCode[];
  factors: SearchFactor[];
  snippet?: string;
  locationLabel?: string;
  isLikelyLatest?: boolean;
}

export interface SearchFactor {
  code: SearchReasonCode;
  evidence: string[];
  locationLabel?: string;
  scoreContribution: number;
}

type ScoreAccumulator = {
  score: number;
  reasons: Set<SearchReasonCode>;
  factors: Map<SearchReasonCode, FactorAccumulator>;
  snippet?: string;
  isLikelyLatest: boolean;
};

type FactorAccumulator = {
  evidence: Set<string>;
  locationLabel?: string;
  scoreContribution: number;
};

export interface ChunkSignal {
  score: number;
  reasons: SearchReasonCode[];
  snippet?: string;
  locationLabel?: string;
}

const STOP_WORDS = new Set([
  'the',
  'and',
  'for',
  'with',
  'from',
  'this',
  'that',
  'into',
  'your',
  'latest',
  'newest',
  'current',
]);

const LATEST_QUERY_HINTS = new Set(['latest', 'newest', 'current', 'recent', 'final']);
const LATEST_FILE_HINTS = ['final', 'approved', 'signed', 'current'];

export function cosineSimilarity(a: number[], b: number[]) {
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  if (normA === 0 || normB === 0) {
    return 0;
  }

  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

function tokenize(value: string | undefined) {
  return (value ?? '')
    .toLowerCase()
    .split(/[^a-z0-9]+/i)
    .map((token) => token.trim())
    .filter((token) => token.length > 1);
}

function getEffectiveQueryTokens(query: string) {
  return tokenize(query).filter((token) => !STOP_WORDS.has(token));
}

function overlapCount(source: string[], target: string[]) {
  if (source.length === 0 || target.length === 0) {
    return 0;
  }

  const targetSet = new Set(target);
  return source.filter((token) => targetSet.has(token)).length;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function getRecencyBoost(lastModified?: number) {
  if (!lastModified) {
    return 0;
  }

  const msInDay = 1000 * 60 * 60 * 24;
  const ageInDays = Math.max(0, (Date.now() - lastModified) / msInDay);
  return clamp(1 - ageInDays / 45, 0, 1);
}

function hasLatestIntent(queryTokens: string[]) {
  return queryTokens.some((token) => LATEST_QUERY_HINTS.has(token));
}

function getVersionSignal(file: SearchableFile) {
  const haystack = `${file.name} ${file.content ?? ''}`.toLowerCase();
  const versionNumberMatch = haystack.match(/\bv(?:ersion)?\s?(\d+)\b/);
  const revisionMatch = haystack.match(/\brev(?:ision)?\s?(\d+)\b/);
  const numericVersion = Number(versionNumberMatch?.[1] ?? revisionMatch?.[1] ?? 0);
  const keywordSignal = LATEST_FILE_HINTS.some((token) => haystack.includes(token)) ? 0.5 : 0;

  return clamp(keywordSignal + Math.min(numericVersion * 0.12, 0.5), 0, 1);
}

function getConfidence(score: number): SearchConfidence {
  if (score >= 1.15) {
    return 'high';
  }
  if (score >= 0.65) {
    return 'medium';
  }
  return 'low';
}

function buildSnippet(file: SearchableFile, queryTokens: string[]) {
  if (!file.content) {
    return undefined;
  }

  const normalizedContent = file.content.toLowerCase();
  const matchingToken = queryTokens.find((token) => normalizedContent.includes(token));
  if (!matchingToken) {
    return file.content.slice(0, 140).trim();
  }

  const index = normalizedContent.indexOf(matchingToken);
  const start = Math.max(0, index - 35);
  const end = Math.min(file.content.length, index + 85);
  return file.content.slice(start, end).trim();
}

function buildSnippetFromText(text: string, queryTokens: string[]) {
  const normalizedContent = text.toLowerCase();
  const matchingToken = queryTokens.find((token) => normalizedContent.includes(token));
  if (!matchingToken) {
    return text.slice(0, 140).trim();
  }

  const index = normalizedContent.indexOf(matchingToken);
  const start = Math.max(0, index - 35);
  const end = Math.min(text.length, index + 85);
  return text.slice(start, end).trim();
}

function addScore(
  accumulator: ScoreAccumulator,
  amount: number,
  reason?: SearchReasonCode,
  snippet?: string,
  evidence: string[] = [],
  locationLabel?: string,
) {
  accumulator.score += amount;
  if (reason) {
    accumulator.reasons.add(reason);
    const factor = accumulator.factors.get(reason) ?? {
      evidence: new Set<string>(),
      locationLabel,
      scoreContribution: 0,
    };
    evidence.filter(Boolean).forEach((item) => factor.evidence.add(item));
    factor.scoreContribution += amount;
    if (!factor.locationLabel && locationLabel) {
      factor.locationLabel = locationLabel;
    }
    accumulator.factors.set(reason, factor);
  }
  if (!accumulator.snippet && snippet) {
    accumulator.snippet = snippet;
  }
}

function formatDirectory(path: string) {
  return path.replace(/[/\\][^/\\]+$/, '');
}

function getMatchedTerms(tokens: string[], haystackTokens: string[]) {
  const haystackSet = new Set(haystackTokens);
  return tokens.filter((token) => haystackSet.has(token));
}

function getVersionEvidence(file: SearchableFile) {
  const haystack = `${file.name} ${file.content ?? ''}`.toLowerCase();
  const evidence: string[] = [];

  const versionMatches = haystack.match(/\bv(?:ersion)?\s?\d+\b/g) ?? [];
  const revisionMatches = haystack.match(/\brev(?:ision)?\s?\d+\b/g) ?? [];
  const keywordMatches = LATEST_FILE_HINTS.filter((token) => haystack.includes(token));

  if (versionMatches.length > 0 || revisionMatches.length > 0) {
    evidence.push(`Version cues: ${[...versionMatches, ...revisionMatches].join(', ')}`);
  }

  if (keywordMatches.length > 0) {
    evidence.push(`Filename/content hints: ${keywordMatches.join(', ')}`);
  }

  return evidence;
}

function getRecencyEvidence(lastModified?: number) {
  if (!lastModified) {
    return [];
  }

  const diffMs = Math.max(0, Date.now() - lastModified);
  const day = 1000 * 60 * 60 * 24;
  const diffDays = Math.max(1, Math.round(diffMs / day));
  return [`Modified ${diffDays} day${diffDays === 1 ? '' : 's'} ago`];
}

function buildFactors(accumulator: ScoreAccumulator): SearchFactor[] {
  return Array.from(accumulator.factors.entries())
    .map(([code, factor]) => ({
      code,
      evidence: Array.from(factor.evidence),
      locationLabel: factor.locationLabel,
      scoreContribution: factor.scoreContribution,
    }))
    .sort((a, b) => b.scoreContribution - a.scoreContribution);
}

export function rankSearchResults({
  query,
  files,
  queryEmbedding,
  chunkSignals,
  semanticEnabled = true,
  maxResults = DEFAULT_MAX_SEARCH_RESULTS,
}: {
  query: string;
  files: SearchableFile[];
  queryEmbedding?: number[];
  chunkSignals?: Map<string, ChunkSignal>;
  semanticEnabled?: boolean;
  maxResults?: number;
}) {
  const queryTokens = getEffectiveQueryTokens(query);
  const wantsLatest = hasLatestIntent(tokenize(query));
  const results = new Map<string, ScoreAccumulator>();
  const fileMap = new Map(files.map((file) => [file.path, file]));
  const fuse = new Fuse(files, {
    keys: ['name', 'content', 'path', 'tags'],
    threshold: 0.35,
    ignoreLocation: true,
  });

  for (const result of fuse.search(query)) {
    const entry = results.get(result.item.path) ?? {
      score: 0,
      reasons: new Set<SearchReasonCode>(),
      factors: new Map<SearchReasonCode, FactorAccumulator>(),
      isLikelyLatest: false,
    };

    addScore(entry, (1 - (result.score || 0)) * 0.45);
    results.set(result.item.path, entry);
  }

  for (const file of files) {
    const entry = results.get(file.path) ?? {
      score: 0,
      reasons: new Set<SearchReasonCode>(),
      factors: new Map<SearchReasonCode, FactorAccumulator>(),
      isLikelyLatest: false,
    };
    const fileNameLower = file.name.toLowerCase();
    const fileStem = fileNameLower.replace(/\.[^.]+$/, '');
    const pathTokens = tokenize(file.path);
    const contentTokens = tokenize(file.content);
    const tagTokens = tokenize((file.tags || []).join(' '));
    const snippet = buildSnippet(file, queryTokens);
    const chunkSignal = chunkSignals?.get(file.path);

    if (chunkSignal) {
      entry.score += chunkSignal.score;
      chunkSignal.reasons.forEach((reason) => {
        addScore(
          entry,
          0,
          reason,
          undefined,
          chunkSignal.snippet ? [`Best matching passage: ${chunkSignal.snippet}`] : [],
          chunkSignal.locationLabel
        );
      });
      if (!entry.snippet && chunkSignal.snippet) {
        entry.snippet = chunkSignal.snippet;
      }
    }

    if (fileStem === query.trim().toLowerCase()) {
      addScore(entry, 0.65, 'exact_name', snippet, [`Exact filename: ${file.name}`]);
    } else if (queryTokens.some((token) => fileNameLower.includes(token))) {
      addScore(entry, 0.22, 'filename_match', snippet, [`Filename: ${file.name}`]);
    }

    const pathOverlap = overlapCount(queryTokens, pathTokens);
    if (pathOverlap > 0) {
      addScore(
        entry,
        Math.min(0.14 + pathOverlap * 0.08, 0.3),
        'project_context',
        snippet,
        [`Folder path: ${formatDirectory(file.path)}`]
      );
    }

    const contentOverlap = overlapCount(queryTokens, contentTokens);
    if (contentOverlap > 0) {
      const matchedTerms = getMatchedTerms(queryTokens, contentTokens);
      addScore(
        entry,
        Math.min(0.08 + contentOverlap * 0.05, 0.22),
        'content_terms',
        snippet,
        matchedTerms.length > 0 ? [`Matched terms: ${matchedTerms.join(', ')}`] : []
      );
    }

    const tagOverlap = overlapCount(queryTokens, tagTokens);
    if (tagOverlap > 0) {
      const matchedTags = getMatchedTerms(queryTokens, tagTokens);
      addScore(
        entry,
        Math.min(0.12 + tagOverlap * 0.04, 0.2),
        'tag_match',
        undefined,
        matchedTags.length > 0 ? [`Matching tags: ${matchedTags.join(', ')}`] : []
      );
    }

    if (file.isStarred) {
      addScore(entry, 0.08, 'starred', undefined, ['Starred by you']);
    }

    const recencyBoost = getRecencyBoost(file.lastModified);
    if (recencyBoost > 0.45) {
      addScore(entry, recencyBoost * 0.08, 'recent_update', undefined, getRecencyEvidence(file.lastModified));
    }

    const versionSignal = getVersionSignal(file);
    if (wantsLatest && versionSignal > 0) {
      addScore(entry, versionSignal * 0.24, 'latest_signal', snippet, getVersionEvidence(file));
      if (versionSignal >= 0.5 && recencyBoost >= 0.45) {
        entry.isLikelyLatest = true;
      }
    }

    if (semanticEnabled && queryEmbedding && file.embedding) {
      const similarity = cosineSimilarity(queryEmbedding, file.embedding);
      if (similarity > 0.2) {
        const semanticEvidence = chunkSignal?.snippet
          ? [`Best matching passage: ${chunkSignal.snippet}`]
          : snippet
            ? [`Best matching passage: ${snippet}`]
            : [];
        addScore(
          entry,
          similarity * 0.42,
          'semantic',
          snippet,
          semanticEvidence,
          chunkSignal?.locationLabel
        );
      }
    }

    if (entry.score > 0) {
      if (!entry.snippet) {
        entry.snippet = snippet;
      }
      results.set(file.path, entry);
    }
  }

  return Array.from(results.entries())
    .sort((a, b) => b[1].score - a[1].score)
    .flatMap((entry) => {
      const [path, metadata] = entry;
      const file = fileMap.get(path);
      if (!file || metadata.score <= 0.1) {
        return [];
      }

      return [{
        file,
        score: metadata.score,
        confidence: getConfidence(metadata.score),
        reasons: Array.from(metadata.reasons),
        factors: buildFactors(metadata),
        snippet: metadata.snippet,
        locationLabel: chunkSignals?.get(path)?.locationLabel,
        isLikelyLatest: metadata.isLikelyLatest || undefined,
      } satisfies RankedSearchResult];
    })
    .slice(0, maxResults);
}

export function collectChunkSignals({
  query,
  chunks,
  queryEmbedding,
  semanticEnabled = true,
}: {
  query: string;
  chunks: SearchableChunk[];
  queryEmbedding?: number[];
  semanticEnabled?: boolean;
}) {
  const queryTokens = getEffectiveQueryTokens(query);
  const signals = new Map<string, ScoreAccumulator>();
  const fuse = new Fuse(chunks, {
    keys: ['text'],
    threshold: 0.32,
    ignoreLocation: true,
  });

  for (const result of fuse.search(query)) {
    const entry = signals.get(result.item.filePath) ?? {
      score: 0,
      reasons: new Set<SearchReasonCode>(),
      factors: new Map<SearchReasonCode, FactorAccumulator>(),
      isLikelyLatest: false,
    };

    addScore(
      entry,
      (1 - (result.score || 0)) * 0.28,
      undefined,
      buildSnippetFromText(result.item.text, queryTokens)
    );
    signals.set(result.item.filePath, entry);
  }

  for (const chunk of chunks) {
    const entry = signals.get(chunk.filePath) ?? {
      score: 0,
      reasons: new Set<SearchReasonCode>(),
      factors: new Map<SearchReasonCode, FactorAccumulator>(),
      isLikelyLatest: false,
    };
    const chunkTokens = tokenize(chunk.text);
    const snippet = buildSnippetFromText(chunk.text, queryTokens);

    const contentOverlap = overlapCount(queryTokens, chunkTokens);
    if (contentOverlap > 0) {
      addScore(entry, Math.min(0.12 + contentOverlap * 0.06, 0.24), 'content_terms', snippet);
    }

    if (semanticEnabled && queryEmbedding && chunk.embedding) {
      const similarity = cosineSimilarity(queryEmbedding, chunk.embedding);
      if (similarity > 0.2) {
        addScore(entry, similarity * 0.36, 'semantic', snippet);
      }
    }

    if (entry.score > 0) {
      signals.set(chunk.filePath, entry);
    }
  }

  return new Map(
    Array.from(signals.entries()).map(([filePath, metadata]) => [
      filePath,
      {
        score: metadata.score,
        reasons: Array.from(metadata.reasons),
        snippet: metadata.snippet,
        locationLabel: chunks.find((chunk) => chunk.filePath === filePath && buildSnippetFromText(chunk.text, queryTokens) === metadata.snippet)?.sourceLabel,
      } satisfies ChunkSignal,
    ])
  );
}

export function findRelatedFileMatches(sourceFile: SearchableFile, files: SearchableFile[]) {
  if (!sourceFile.embedding) {
    return [];
  }

  return files
    .filter((file) => file.path !== sourceFile.path && file.embedding)
    .map((file) => ({
      file,
      score: cosineSimilarity(sourceFile.embedding!, file.embedding!),
    }))
    .filter((result) => result.score > 0.6)
    .sort((a, b) => b.score - a.score)
    .slice(0, 5);
}
