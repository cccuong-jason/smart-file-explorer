type InsightFile = {
  path: string;
  name: string;
  size: number;
  type: string;
  lastModified: number;
  group?: string;
  subtype?: string;
  tags?: string[];
  content?: string;
  embedding?: number[];
  isStarred?: boolean;
  isLikelyLatest?: boolean;
  indexingStage?: string;
  ocrStatus?: string;
};

export interface VersionGroup {
  id: string;
  title: string;
  variantCount: number;
  latestFile: InsightFile;
  files: InsightFile[];
}

export interface FolderInsight {
  id: string;
  path: string;
  title: string;
  fileCount: number;
  ocrCount: number;
  recentCount: number;
  primaryTypeLabel: string;
  topFile: InsightFile;
  topFiles: InsightFile[];
  importantFiles: InsightFile[];
  recentFiles: InsightFile[];
  versionGroups: VersionGroup[];
  projectKeywords: string[];
  summary: string;
  highlights: string[];
  rationale?: string[];
  summarySource?: 'heuristic' | 'ai';
  summaryModel?: string;
  summaryState?: 'local' | 'generating' | 'ready' | 'failed' | 'not_connected';
  summaryUpdatedAt?: number;
  summaryError?: string;
  workspaceScore: number;
}

const GROUP_LABELS: Record<string, string> = {
  documents: 'Documents',
  code: 'Code',
  images: 'Images',
  media: 'Media',
  archives: 'Archives',
  other: 'Other',
};

const STOP_WORDS = new Set([
  'the',
  'and',
  'for',
  'with',
  'this',
  'that',
  'from',
  'into',
  'your',
  'final',
  'draft',
  'copy',
  'document',
  'file',
  'notes',
]);

const VERSION_HINTS = ['final', 'approved', 'signed', 'current', 'latest'];
const RECENT_WINDOW_MS = 1000 * 60 * 60 * 24 * 7;

function needsOcrAttention(file: InsightFile) {
  return ['recommended', 'processing', 'failed'].includes(file.ocrStatus ?? '');
}

function tokenize(value: string | undefined) {
  return (value ?? '')
    .toLowerCase()
    .split(/[^a-z0-9]+/i)
    .map((token) => token.trim())
    .filter((token) => token.length > 1 && !STOP_WORDS.has(token));
}

function getParentPath(path: string) {
  const parts = path.split(/[/\\]+/).filter(Boolean);
  if (parts.length <= 1) {
    return path;
  }
  return parts.slice(0, -1).join('/');
}

function getFolderTitle(path: string) {
  const parts = path.split(/[/\\]+/).filter(Boolean);
  return parts[parts.length - 1] || path;
}

function cosineSimilarity(a: number[], b: number[]) {
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i += 1) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  if (normA === 0 || normB === 0) {
    return 0;
  }

  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

function getVersionCueScore(file: InsightFile) {
  const haystack = `${file.name} ${file.content ?? ''}`.toLowerCase();
  const versionNumberMatch = haystack.match(/\bv(?:ersion)?\s?(\d+)\b/);
  const revisionMatch = haystack.match(/\brev(?:ision)?\s?(\d+)\b/);
  const versionNumber = Number(versionNumberMatch?.[1] ?? revisionMatch?.[1] ?? 0);
  const keywordScore = VERSION_HINTS.some((token) => haystack.includes(token)) ? 1 : 0;
  return keywordScore + Math.min(versionNumber, 8) * 0.18;
}

function normalizeVersionTitle(name: string) {
  const stem = name.replace(/\.[^.]+$/, '').toLowerCase();
  return stem
    .replace(/(?:^|[\s._-])(final|draft|copy|approved|signed|current|latest)(?:$|[\s._-])/g, ' ')
    .replace(/(?:^|[\s._-])v(?:ersion)?\s?\d+(?:$|[\s._-])/g, ' ')
    .replace(/(?:^|[\s._-])rev(?:ision)?\s?\d+(?:$|[\s._-])/g, ' ')
    .replace(/(?:^|[\s._-])\d{4}[-_]\d{2}[-_]\d{2}(?:$|[\s._-])/g, ' ')
    .replace(/\(\d+\)/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/[_-]+/g, ' ')
    .trim();
}

function buildProjectKeywords(files: InsightFile[]) {
  const counts = new Map<string, number>();

  for (const file of files) {
    const nameTokens = tokenize(file.name);
    const pathTokens = tokenize(getParentPath(file.path));
    const contentTokens = tokenize(file.content).slice(0, 24);
    const tagTokens = (file.tags ?? []).flatMap((tag) => tokenize(tag));

    for (const token of nameTokens) {
      counts.set(token, (counts.get(token) ?? 0) + 3);
    }
    for (const token of pathTokens) {
      counts.set(token, (counts.get(token) ?? 0) + 2);
    }
    for (const token of contentTokens) {
      counts.set(token, (counts.get(token) ?? 0) + 1);
    }
    for (const token of tagTokens) {
      counts.set(token, (counts.get(token) ?? 0) + 4);
    }
  }

  return Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, 4)
    .map(([token]) => token);
}

function buildVersionGroups(files: InsightFile[]) {
  const byTitle = new Map<string, InsightFile[]>();

  for (const file of files) {
    const title = normalizeVersionTitle(file.name);
    if (!title || title.length < 3) {
      continue;
    }

    const bucket = byTitle.get(title) ?? [];
    bucket.push(file);
    byTitle.set(title, bucket);
  }

  return Array.from(byTitle.entries())
    .map(([title, groupFiles]) => {
      if (groupFiles.length < 2) {
        return null;
      }

      const sortedFiles = [...groupFiles].sort((a, b) => {
        const versionDiff = getVersionCueScore(b) - getVersionCueScore(a);
        if (versionDiff !== 0) {
          return versionDiff;
        }
        return b.lastModified - a.lastModified;
      });

      return {
        id: `${getParentPath(groupFiles[0].path)}::${title}`,
        title,
        variantCount: groupFiles.length,
        latestFile: sortedFiles[0],
        files: sortedFiles,
      } satisfies VersionGroup;
    })
    .filter((group): group is VersionGroup => Boolean(group))
    .sort((a, b) => b.variantCount - a.variantCount || b.latestFile.lastModified - a.latestFile.lastModified);
}

function getSemanticCentrality(file: InsightFile, folderFiles: InsightFile[]) {
  if (!file.embedding || folderFiles.length < 2) {
    return 0;
  }

  const similarities = folderFiles
    .filter((candidate) => candidate.path !== file.path && candidate.embedding)
    .map((candidate) => cosineSimilarity(file.embedding!, candidate.embedding!))
    .filter((score) => score > 0);

  if (similarities.length === 0) {
    return 0;
  }

  return similarities.reduce((sum, score) => sum + score, 0) / similarities.length;
}

function getKeywordOverlapScore(file: InsightFile, projectKeywords: string[]) {
  if (projectKeywords.length === 0) {
    return 0;
  }

  const haystack = new Set([
    ...tokenize(file.name),
    ...tokenize(file.content),
    ...(file.tags ?? []).flatMap((tag) => tokenize(tag)),
  ]);

  return projectKeywords.filter((keyword) => haystack.has(keyword)).length;
}

function getFileImportance(file: InsightFile, newestTimestamp: number, folderFiles: InsightFile[], projectKeywords: string[]) {
  let score = 0;
  if (file.isStarred) score += 5;
  if (file.isLikelyLatest) score += 3;
  if (file.group === 'documents') score += 2;
  if (needsOcrAttention(file)) score -= 1;
  if (file.indexingStage === 'semantic') score += 1;
  score += getVersionCueScore(file) * 1.6;
  score += getKeywordOverlapScore(file, projectKeywords) * 0.8;
  score += getSemanticCentrality(file, folderFiles) * 2;

  const ageDays = Math.max(0, (newestTimestamp - file.lastModified) / (1000 * 60 * 60 * 24));
  score += Math.max(0, 3 - ageDays / 3);
  return score;
}

function buildImportantFiles(sortedByImportance: InsightFile[], versionGroups: VersionGroup[]) {
  const groupedPaths = new Set(versionGroups.flatMap((group) => group.files.map((file) => file.path)));
  const importantFiles: InsightFile[] = [];

  for (const group of versionGroups) {
    importantFiles.push(group.latestFile);
  }

  for (const file of sortedByImportance) {
    if (importantFiles.some((candidate) => candidate.path === file.path)) {
      continue;
    }
    if (groupedPaths.has(file.path)) {
      continue;
    }
    importantFiles.push(file);
    if (importantFiles.length >= 4) {
      break;
    }
  }

  return importantFiles.slice(0, 4);
}

function buildSummary(title: string, topFile: InsightFile, _projectKeywords: string[], versionGroups: VersionGroup[], ocrCount: number) {
  const segments = [`${topFile.name} is the best document to open first in ${title}.`];

  if (versionGroups.length > 0) {
    segments.push(`There ${versionGroups.length === 1 ? 'is' : 'are'} ${versionGroups.length} competing version group${versionGroups.length === 1 ? '' : 's'}.`);
  }
  if (ocrCount > 0) {
    segments.push(`${ocrCount} scan${ocrCount === 1 ? '' : 's'} may still hide searchable text.`);
  }

  return segments.join(' ');
}

export function buildFolderInsights(files: InsightFile[]): FolderInsight[] {
  const byFolder = new Map<string, InsightFile[]>();

  for (const file of files) {
    const folderPath = getParentPath(file.path);
    const bucket = byFolder.get(folderPath) ?? [];
    bucket.push(file);
    byFolder.set(folderPath, bucket);
  }

  return Array.from(byFolder.entries())
    .map(([path, folderFiles]) => {
      const newestTimestamp = Math.max(...folderFiles.map((file) => file.lastModified || 0));
      const projectKeywords = buildProjectKeywords(folderFiles);
      const versionGroups = buildVersionGroups(folderFiles);
      const sortedByImportance = [...folderFiles].sort((a, b) => (
        getFileImportance(b, newestTimestamp, folderFiles, projectKeywords)
        - getFileImportance(a, newestTimestamp, folderFiles, projectKeywords)
      ));
      const importantFiles = buildImportantFiles(sortedByImportance, versionGroups);
      const topFile = importantFiles[0] ?? sortedByImportance[0];
      const primaryTypeEntry = Array.from(
        folderFiles.reduce((acc, file) => {
          const group = file.group ?? 'other';
          acc.set(group, (acc.get(group) ?? 0) + 1);
          return acc;
        }, new Map<string, number>())
      ).sort((a, b) => b[1] - a[1])[0];
      const ocrCount = folderFiles.filter((file) => needsOcrAttention(file)).length;
      const recentFiles = [...folderFiles]
        .filter((file) => newestTimestamp - file.lastModified <= RECENT_WINDOW_MS)
        .sort((a, b) => b.lastModified - a.lastModified)
        .slice(0, 3);
      const recentCount = recentFiles.length;
      const highlights: string[] = [];

      if (topFile.isLikelyLatest) {
        highlights.push('Likely latest version');
      }
      if (topFile.isStarred) {
        highlights.push('Starred by you');
      }
      if (recentCount > 0) {
        highlights.push(`${recentCount} recently updated`);
      }
      if (versionGroups.length > 0) {
        highlights.push(`${versionGroups.length} version group${versionGroups.length === 1 ? '' : 's'}`);
      }
      if (ocrCount > 0) {
        highlights.push(`${ocrCount} needs OCR`);
      }

      const workspaceScore = importantFiles.reduce((sum, file) => (
        sum + getFileImportance(file, newestTimestamp, folderFiles, projectKeywords)
      ), 0);

      return {
        id: path,
        path,
        title: getFolderTitle(path),
        fileCount: folderFiles.length,
        ocrCount,
        recentCount,
        primaryTypeLabel: GROUP_LABELS[primaryTypeEntry?.[0] ?? 'other'] ?? 'Other',
        topFile,
        topFiles: importantFiles.slice(0, 3),
        importantFiles,
        recentFiles,
        versionGroups,
        projectKeywords,
        summary: buildSummary(getFolderTitle(path), topFile, projectKeywords, versionGroups, ocrCount),
        highlights,
        rationale: [],
        summarySource: 'heuristic',
        summaryState: 'local',
        workspaceScore,
      } satisfies FolderInsight;
    })
    .sort((a, b) => b.workspaceScore - a.workspaceScore || b.topFile.lastModified - a.topFile.lastModified);
}
