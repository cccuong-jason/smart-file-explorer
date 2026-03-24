import Fuse from 'fuse.js';

export interface SearchableFile {
  path: string;
  name: string;
  content?: string;
  embedding?: number[];
}

export interface RankedSearchResult {
  file: SearchableFile;
  score: number;
}

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

export function rankSearchResults({
  query,
  files,
  queryEmbedding,
  semanticEnabled = true,
}: {
  query: string;
  files: SearchableFile[];
  queryEmbedding?: number[];
  semanticEnabled?: boolean;
}) {
  const results = new Map<string, number>();
  const fuse = new Fuse(files, {
    keys: ['name', 'content'],
    threshold: 0.4,
    ignoreLocation: true,
  });

  fuse.search(query).forEach((result) => {
    results.set(result.item.path, (1 - (result.score || 0)) * 0.5);
  });

  if (semanticEnabled && queryEmbedding) {
    for (const file of files) {
      let currentScore = results.get(file.path) || 0;

      if (file.name.toLowerCase().includes(query.toLowerCase())) {
        currentScore += 0.3;
      }
      if (file.name.toLowerCase() === query.toLowerCase()) {
        currentScore += 1.0;
      }

      if (file.embedding) {
        currentScore += cosineSimilarity(queryEmbedding, file.embedding) * 0.5;
      }

      if (currentScore > 0) {
        results.set(file.path, currentScore);
      }
    }
  }

  return Array.from(results.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([path, score]) => {
      const file = files.find((entry) => entry.path === path);
      return file ? { file, score } : null;
    })
    .filter((result): result is RankedSearchResult => Boolean(result && result.score > 0.1))
    .slice(0, 20);
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
