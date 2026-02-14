
import { getAllFiles } from '../file-system/db';
import { generateEmbedding } from './vector-engine';
import Fuse from 'fuse.js';

// Cosine Similarity Utility
function cosineSimilarity(A: number[], B: number[]) {
    let dotProduct = 0;
    let normA = 0;
    let normB = 0;
    for (let i = 0; i < A.length; i++) {
        dotProduct += A[i] * B[i];
        normA += A[i] * A[i];
        normB += B[i] * B[i];
    }
    if (normA === 0 || normB === 0) return 0;
    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

// Search Logic
async function searchFiles(query: string, useSemantic = true) {
    const allFiles = await getAllFiles();
    const results = new Map<string, number>(); // path -> score

    // 1. Keyword Search (Fuse.js)
    const fuse = new Fuse(allFiles, {
        keys: ['name', 'content'],
        threshold: 0.4,
        ignoreLocation: true
    });

    const fuseResults = fuse.search(query);
    fuseResults.forEach(res => {
        results.set(res.item.path, (1 - (res.score || 0)) * 0.5); // Normalize Fuse score
    });

    // 2. Semantic Search (Vector)
    if (useSemantic) {
        try {
            const queryEmbedding = await generateEmbedding(query);
            for (const file of allFiles) {
                let currentScore = results.get(file.path) || 0;

                // Filename Priority Boost
                if (file.name.toLowerCase().includes(query.toLowerCase())) {
                    currentScore += 0.3; // Boost for partial match
                }
                if (file.name.toLowerCase() === query.toLowerCase()) {
                    currentScore += 1.0; // Huge boost for exact match
                }

                if (file.embedding) {
                    const sim = cosineSimilarity(queryEmbedding, file.embedding);
                    currentScore += (sim * 0.5); // Add semantic score
                }

                if (currentScore > 0) results.set(file.path, currentScore);
            }
        } catch (error) {
            console.error("Worker: Embedding generation failed", error);
            // Fallback to keyword search only if embedding fails
        }
    }

    // Sort by score desc
    return Array.from(results.entries())
        .sort((a, b) => b[1] - a[1])
        .map(([path, score]) => {
            const file = allFiles.find(f => f.path === path);
            return { file, score };
        })
        .filter(r => r.score > 0.1) // Filter very low relevance
        .slice(0, 20); // Top 20 results
}

// Related Files Logic
async function findRelatedFiles(sourceFile: any) {
    if (!sourceFile.embedding) return [];

    const allFiles = await getAllFiles();
    const results: { file: any, score: number }[] = [];

    for (const file of allFiles) {
        if (file.path === sourceFile.path) continue; // Skip self
        if (file.embedding) {
            const sim = cosineSimilarity(sourceFile.embedding, file.embedding);
            if (sim > 0.6) { // Threshold
                results.push({ file, score: sim });
            }
        }
    }

    return results.sort((a, b) => b.score - a.score).slice(0, 5);
}

// Handle Messages
self.onmessage = async (e: MessageEvent) => {
    const { type, payload, id } = e.data;

    try {
        if (type === 'SEARCH') {
            const results = await searchFiles(payload.query);
            self.postMessage({ type: 'SEARCH_RESULT', payload: results, id });
        } else if (type === 'RELATED') {
            const results = await findRelatedFiles(payload.sourceFile);
            self.postMessage({ type: 'RELATED_RESULT', payload: results, id });
        }
    } catch (error: any) {
        self.postMessage({ type: 'ERROR', payload: error.message, id });
    }
};
