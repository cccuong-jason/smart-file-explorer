import { storeFile, getFile } from './db';
import { generateEmbedding } from '../search/vector-engine';
import * as mammoth from 'mammoth';

const TEXT_EXTENSIONS = [
    '.txt', '.md', '.json', '.js', '.ts', '.tsx', '.jsx', '.css', '.html', '.py', '.java', '.c', '.cpp', '.h', '.hpp', '.rs', '.go', '.yml', '.yaml', '.xml', '.ini', '.env', '.sh', '.bat', '.ps1', '.sql', '.rb', '.php'
];
const DOCUMENT_EXTENSIONS = ['.pdf', '.docx'];
const IGNORED_EXTENSIONS = [
    // Images
    '.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp', '.svg', '.ico', '.tiff',
    // Video/Audio
    '.mp4', '.mov', '.avi', '.mkv', '.mp3', '.wav', '.ogg',
    // Archives/Binary
    '.zip', '.tar', '.gz', '.7z', '.exe', '.dll', '.bin', '.iso',
    // System
    '.ds_store', 'thumbs.db'
];
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB limit for content extraction

export type ProgressCallback = (count: number, currentFile: string) => void;

// --- 1. Fast Counting Phase ---
export async function countTotalFiles(dirHandle: FileSystemDirectoryHandle): Promise<number> {
    let count = 0;
    async function traverse(handle: FileSystemDirectoryHandle) {
        for await (const entry of handle.values()) {
            if (entry.kind === 'file') {
                const ext = '.' + entry.name.split('.').pop()?.toLowerCase();
                if (IGNORED_EXTENSIONS.includes(ext)) continue;
                if (TEXT_EXTENSIONS.includes(ext) || DOCUMENT_EXTENSIONS.includes(ext)) {
                    count++;
                }
            } else if (entry.kind === 'directory') {
                if (entry.name.startsWith('.') || entry.name === 'node_modules' || entry.name === 'dist' || entry.name === 'build' || entry.name === '.git') continue;
                await traverse(entry as FileSystemDirectoryHandle);
            }
        }
    }
    await traverse(dirHandle);
    return count;
}

// --- 2. Generator Logic for Controlled Processing ---
export async function* createFileGenerator(dirHandle: FileSystemDirectoryHandle, path = ''): AsyncGenerator<{ handle: FileSystemFileHandle, path: string }> {
    for await (const entry of dirHandle.values()) {
        const entryPath = path ? `${path}/${entry.name}` : entry.name;

        if (entry.kind === 'file') {
            const ext = '.' + entry.name.split('.').pop()?.toLowerCase();
            if (IGNORED_EXTENSIONS.includes(ext)) continue;
            if (TEXT_EXTENSIONS.includes(ext) || DOCUMENT_EXTENSIONS.includes(ext)) {
                yield { handle: entry as FileSystemFileHandle, path: entryPath };
            }
        } else if (entry.kind === 'directory') {
            if (entry.name.startsWith('.') || entry.name === 'node_modules' || entry.name === 'dist' || entry.name === 'build' || entry.name === '.git') continue;
            yield* createFileGenerator(entry as FileSystemDirectoryHandle, entryPath);
        }
    }
}

// --- 3. Processing Logic (Single File) ---
export async function processFile(fileHandle: FileSystemFileHandle, filePath: string) {
    const file = await fileHandle.getFile();
    const fileExtension = '.' + file.name.split('.').pop()?.toLowerCase();

    // PERFORMANCE: Check if already indexed and unchanged
    const existing = await getFile(filePath);
    if (existing && existing.lastModified === file.lastModified && existing.processingStatus === 'completed') {
        // Skip processing
        return;
    }

    let content = '';
    // Basic Metadata
    const metadata = {
        path: filePath,
        name: file.name,
        size: file.size,
        type: file.type || 'application/octet-stream',
        lastModified: file.lastModified,
        tags: existing?.tags || [], // Preserve tags if re-indexing
        isStarred: existing?.isStarred || false, // Preserve star status
        processingStatus: 'pending' as const
    };

    await storeFile(metadata); // Initial store

    if (file.size > MAX_FILE_SIZE) {
        await storeFile({ ...metadata, processingStatus: 'completed' }); // Skip heavy content
        return;
    }

    try {
        if (TEXT_EXTENSIONS.includes(fileExtension)) {
            content = await file.text();
        } else if (fileExtension === '.docx') {
            const arrayBuffer = await file.arrayBuffer();
            const result = await mammoth.extractRawText({ arrayBuffer });
            content = result.value;
        }
        // PDF extraction requires setting up pdf.js worker URL, skipped for initial skeleton to keep it simple, added as TODO
        // else if (fileExtension === '.pdf') { ... }

        if (content) {
            let embedding: number[] | undefined;
            try {
                // Attempt to generate embedding
                embedding = await generateEmbedding(content.slice(0, 1000));
            } catch (err) {
                console.warn(`Embedding generation failed for ${file.name} (network restricted?):`, err);
                // Continue without embedding - keyword search will still work
            }

            await storeFile({
                ...metadata,
                content,
                embedding, // Will be undefined if failed
                processingStatus: 'completed'
            });
        } else {
            await storeFile({ ...metadata, processingStatus: 'completed' });
        }

    } catch (error) {
        console.error(`Error processing file ${file.name}:`, error);
        await storeFile({ ...metadata, processingStatus: 'failed' });
    }
}
