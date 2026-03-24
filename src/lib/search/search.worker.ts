
import { getAllFiles } from '../file-system/db';
import { generateEmbedding } from './vector-engine';
import { findRelatedFileMatches, rankSearchResults } from './core';

// Search Logic
async function searchFiles(query: string, useSemantic = true) {
    const allFiles = await getAllFiles();
    if (!useSemantic) {
        return rankSearchResults({ query, files: allFiles, semanticEnabled: false });
    }

    try {
        const queryEmbedding = await generateEmbedding(query);
        return rankSearchResults({
            query,
            files: allFiles,
            queryEmbedding,
            semanticEnabled: true,
        });
    } catch (error) {
        console.error("Worker: Embedding generation failed", error);
        return rankSearchResults({ query, files: allFiles, semanticEnabled: false });
    }
}

// Related Files Logic
async function findRelatedFiles(sourceFile: any) {
    const allFiles = await getAllFiles();
    return findRelatedFileMatches(sourceFile, allFiles);
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
