export interface TextChunk {
  index: number;
  text: string;
}

interface ChunkingOptions {
  maxChars?: number;
  overlapChars?: number;
  maxChunks?: number;
}

const DEFAULT_MAX_CHARS = 520;
const DEFAULT_OVERLAP_CHARS = 80;
const DEFAULT_MAX_CHUNKS = 18;

export function splitTextIntoChunks(text: string, options: ChunkingOptions = {}): TextChunk[] {
  const maxChars = options.maxChars ?? DEFAULT_MAX_CHARS;
  const overlapChars = options.overlapChars ?? DEFAULT_OVERLAP_CHARS;
  const maxChunks = options.maxChunks ?? DEFAULT_MAX_CHUNKS;
  const normalized = text.trim();

  if (!normalized) {
    return [];
  }

  const paragraphs = normalized
    .split(/\n\s*\n/g)
    .map((part) => part.replace(/\s+/g, ' ').trim())
    .filter(Boolean);

  const chunks: TextChunk[] = [];
  let current = '';

  const pushChunk = () => {
    const trimmed = current.trim();
    if (!trimmed) {
      return;
    }

    chunks.push({
      index: chunks.length,
      text: trimmed,
    });
    current = trimmed.slice(Math.max(0, trimmed.length - overlapChars));
  };

  for (const paragraph of paragraphs) {
    const candidate = current ? `${current}\n\n${paragraph}` : paragraph;
    if (candidate.length <= maxChars) {
      current = candidate;
      continue;
    }

    if (current) {
      pushChunk();
      if (chunks.length >= maxChunks) {
        return chunks;
      }
    }

    if (paragraph.length <= maxChars) {
      current = paragraph;
      continue;
    }

    let start = 0;
    while (start < paragraph.length && chunks.length < maxChunks) {
      const slice = paragraph.slice(start, start + maxChars).trim();
      if (!slice) {
        break;
      }

      chunks.push({
        index: chunks.length,
        text: slice,
      });

      if (slice.length < maxChars) {
        start = paragraph.length;
      } else {
        start += Math.max(1, maxChars - overlapChars);
      }
    }

    current = '';
    if (chunks.length >= maxChunks) {
      return chunks;
    }
  }

  if (current && chunks.length < maxChunks) {
    chunks.push({
      index: chunks.length,
      text: current.trim(),
    });
  }

  return chunks;
}

export function averageEmbeddings(embeddings: number[][]) {
  if (embeddings.length === 0) {
    return undefined;
  }

  const dimensions = embeddings[0]?.length ?? 0;
  if (dimensions === 0) {
    return undefined;
  }

  const totals = new Array(dimensions).fill(0);

  for (const embedding of embeddings) {
    for (let index = 0; index < dimensions; index += 1) {
      totals[index] += embedding[index] ?? 0;
    }
  }

  const averaged = totals.map((value) => value / embeddings.length);
  const magnitude = Math.sqrt(averaged.reduce((sum, value) => sum + value * value, 0));
  if (magnitude === 0) {
    return averaged;
  }

  return averaged.map((value) => value / magnitude);
}
