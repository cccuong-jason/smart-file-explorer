import { storeFile, getFile } from './db';
import { generateEmbedding } from '../search/vector-engine';
import { readFile } from '@tauri-apps/plugin-fs';

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB limit for content extraction

export interface TauriFileMetadata {
    path: string;
    name: string;
    size: number;
    type: string;
    lastModified: number;
}

export async function processFile(metadata: TauriFileMetadata) {
    const existing = await getFile(metadata.path);
    if (existing && existing.lastModified === metadata.lastModified && existing.processingStatus === 'completed') {
        return; // Skip if unmodified
    }

    const { path, name, size, type, lastModified } = metadata;
    const isDocx = name.endsWith('.docx');

    const dbMeta = {
        path,
        name,
        size,
        type: type || 'application/octet-stream',
        lastModified,
        tags: existing?.tags || [],
        isStarred: existing?.isStarred || false,
        processingStatus: 'pending' as const
    };

    await storeFile(dbMeta);

    if (size > MAX_FILE_SIZE) {
        await storeFile({ ...dbMeta, processingStatus: 'completed' });
        return;
    }

    try {
        let content = '';

        const contentBytes = await readFile(path);

        if (!isDocx) {
            const decoder = new TextDecoder('utf-8');
            content = decoder.decode(contentBytes);
        } else {
            // Mammoth requires an array buffer; Uint8Array can be used if converted.
            // Just skipping docx parsing for the MVP migration.
            content = "DocX preview requires native plugin support for extraction.";
        }

        if (content) {
            let embedding: number[] | undefined;
            try {
                embedding = await generateEmbedding(content.slice(0, 1000));
            } catch (err) {
                console.warn(`Embedding failed for ${name}:`, err);
            }

            await storeFile({
                ...dbMeta,
                content,
                embedding,
                processingStatus: 'completed'
            });
        } else {
            await storeFile({ ...dbMeta, processingStatus: 'completed' });
        }
    } catch (error) {
        console.error(`Error processing file ${name}:`, error);
        await storeFile({ ...dbMeta, processingStatus: 'failed' });
    }
}
