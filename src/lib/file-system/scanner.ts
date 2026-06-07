import { storeFile, getFile, storeFileChunks, storeVisualChunks, type FileChunk, type FileMetadata, type VisualIndexingStage } from './db';
import { generateEmbeddingInBackground } from '../search/embedding-engine';
import { generateVisualEmbeddingInBackground } from '../search/visual-embedding-engine';
import { averageEmbeddings, splitTextIntoChunks } from '../search/chunking';
import { invoke } from '@tauri-apps/api/core';
import { classifyFile } from '../file-browser/classification';
import { runLocalOcr } from '../ocr/ocr-engine';
import { logEvent } from '../telemetry/logger';

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB limit for content extraction

export interface TauriFileMetadata {
    path: string;
    name: string;
    size: number;
    type: string;
    lastModified: number;
}

interface ExtractedSegment {
    text: string;
    pageNumber?: number;
    sourceLabel?: string;
    confidence?: number;
}

interface ProcessFileOptions {
    skipInitialStage?: boolean;
    onFileUpdated?: (file: FileMetadata) => void;
}

function shouldRecommendOcr(fileName: string) {
    const ext = fileName.split('.').pop()?.toLowerCase() ?? '';
    return ['pdf', 'png', 'jpg', 'jpeg', 'webp', 'bmp'].includes(ext);
}

function shouldIndexVisual(fileName: string) {
    const ext = fileName.split('.').pop()?.toLowerCase() ?? '';
    return ['png', 'jpg', 'jpeg', 'webp', 'bmp'].includes(ext);
}

function buildBaseFileRecord(metadata: TauriFileMetadata, existing?: FileMetadata): FileMetadata {
    const { path, name, size, type, lastModified } = metadata;
    const classification = classifyFile(name);

    return {
        path,
        name,
        size,
        type: type || 'application/octet-stream',
        lastModified,
        group: classification.group,
        subtype: classification.subtype,
        tags: existing?.tags || [],
        isStarred: existing?.isStarred || false,
        processingStatus: 'pending',
        indexingStage: 'metadata',
        visualIndexingStage: existing?.visualIndexingStage ?? 'none',
    };
}

async function emitFileUpdate(file: FileMetadata, onFileUpdated?: (file: FileMetadata) => void) {
    await storeFile(file);
    onFileUpdated?.(file);
}

function buildStoredChunks(path: string, segments: ExtractedSegment[]) {
    const storedChunks: FileChunk[] = [];
    let chunkIndex = 0;

    for (const segment of segments) {
        const textChunks = splitTextIntoChunks(segment.text);
        for (const chunk of textChunks) {
            storedChunks.push({
                id: `${path}::${chunkIndex}`,
                filePath: path,
                index: chunkIndex,
                text: chunk.text,
                pageNumber: segment.pageNumber,
                sourceLabel: segment.sourceLabel,
            });
            chunkIndex += 1;
        }
    }

    return storedChunks;
}

async function finalizeExtractedContent(
    dbMeta: FileMetadata,
    path: string,
    name: string,
    segments: ExtractedSegment[],
    options: ProcessFileOptions = {},
    ocrStatus?: FileMetadata['ocrStatus'],
    extraFileFields: Partial<FileMetadata> = {}
) {
    const content = segments.map((segment) => segment.text).join('\n\n').trim();
    if (!content) {
        return false;
    }

    const storedChunks = buildStoredChunks(path, segments);
    const chunkEmbeddings: number[][] = [];

    await storeFileChunks(path, storedChunks);

    await emitFileUpdate(
        {
            ...dbMeta,
            content,
            ocrStatus,
            processingStatus: 'processing',
            indexingStage: 'content',
            ...extraFileFields,
        },
        options.onFileUpdated
    );

    for (const chunk of storedChunks) {
        try {
            chunk.embedding = await generateEmbeddingInBackground(chunk.text);
            if (chunk.embedding) {
                chunkEmbeddings.push(chunk.embedding);
            }
        } catch (err) {
            console.warn(`Chunk embedding failed for ${name}#${chunk.index}:`, err);
            void logEvent({
                level: 'warn',
                area: 'indexing',
                event: 'embedding.chunk_failed',
                message: 'Chunk embedding failed',
                path,
                error: err instanceof Error ? err.message : String(err),
                data: { name, chunkIndex: chunk.index },
            });
        }
    }

    await storeFileChunks(path, storedChunks);

    const embedding = averageEmbeddings(chunkEmbeddings);

    await emitFileUpdate({
        ...dbMeta,
        content,
        embedding,
        ocrStatus,
        processingStatus: 'completed',
        indexingStage: 'semantic',
        ...extraFileFields,
    }, options.onFileUpdated);

    return true;
}

async function indexVisualImage(path: string, name: string, segments: ExtractedSegment[]): Promise<VisualIndexingStage | undefined> {
    if (!shouldIndexVisual(name)) {
        return undefined;
    }

    try {
        const embedding = await generateVisualEmbeddingInBackground(path, name);
        const ocrText = segments.map((segment) => segment.text).join('\n\n').trim() || undefined;
        const confidenceValues = segments
            .map((segment) => segment.confidence)
            .filter((confidence): confidence is number => typeof confidence === 'number');

        await storeVisualChunks(path, [{
            id: `${path}::visual::0`,
            filePath: path,
            kind: 'image',
            sourceLabel: 'Image content',
            embedding,
            ocrText,
            ocrConfidence: confidenceValues.length > 0
                ? Math.round(confidenceValues.reduce((sum, confidence) => sum + confidence, 0) / confidenceValues.length)
                : undefined,
            createdAt: Date.now(),
        }]);

        return 'completed';
    } catch (error) {
        console.warn(`Visual embedding failed for ${name}:`, error);
        await storeVisualChunks(path, []);
        return 'failed';
    }
}

export async function stageFileForIndexing(metadata: TauriFileMetadata) {
    const existing = await getFile(metadata.path);
    const baseFile = buildBaseFileRecord(metadata, existing);
    const stagedFile: FileMetadata = {
        ...baseFile,
        processingStatus: 'processing',
        indexingStage: 'metadata',
    };

    await storeFile(stagedFile);
    return stagedFile;
}

function shouldSkipProcessing(existing: FileMetadata | undefined, metadata: TauriFileMetadata) {
    return existing
        && existing.lastModified === metadata.lastModified
        && existing.processingStatus === 'completed';
}

export async function processFile(metadata: TauriFileMetadata, options: ProcessFileOptions = {}) {
    const existing = await getFile(metadata.path);
    if (shouldSkipProcessing(existing, metadata)) {
        return;
    }

    const { path, name } = metadata;
    const dbMeta = buildBaseFileRecord(metadata, existing);

    if (!options.skipInitialStage) {
        await emitFileUpdate(
            {
                ...dbMeta,
                processingStatus: 'processing',
                indexingStage: 'metadata',
            },
            options.onFileUpdated
        );
    }

    if (metadata.size > MAX_FILE_SIZE) {
        await storeFileChunks(path, []);
        await emitFileUpdate(
            {
                ...dbMeta,
                processingStatus: 'completed',
                indexingStage: 'metadata',
            },
            options.onFileUpdated
        );
        return;
    }

    try {
        const segments = await invoke<ExtractedSegment[]>('extract_document_segments', { path });
        const hasNativeContent = await finalizeExtractedContent(dbMeta, path, name, segments, options);

        if (hasNativeContent) {
            return;
        }

        if (shouldRecommendOcr(name)) {
            await emitFileUpdate({
                ...dbMeta,
                ocrStatus: 'processing',
                processingStatus: 'processing',
                indexingStage: 'metadata',
            }, options.onFileUpdated);

            try {
                const ocrSegments = await runLocalOcr(path, name);
                const visualIndexingStage = await indexVisualImage(path, name, ocrSegments);
                const visualFields = visualIndexingStage ? { visualIndexingStage } : {};
                const hasOcrContent = await finalizeExtractedContent(
                    dbMeta,
                    path,
                    name,
                    ocrSegments,
                    options,
                    'completed',
                    visualFields
                );

                if (hasOcrContent) {
                    return;
                }

                await storeFileChunks(path, []);
                await emitFileUpdate({
                    ...dbMeta,
                    ocrStatus: 'recommended',
                    processingStatus: 'completed',
                    indexingStage: 'metadata',
                    ...visualFields,
                }, options.onFileUpdated);
                return;
            } catch (ocrError) {
                console.warn(`OCR failed for ${name}:`, ocrError);
                void logEvent({
                    level: 'warn',
                    area: 'indexing',
                    event: 'ocr.failed',
                    message: 'OCR failed while processing file',
                    path,
                    error: ocrError instanceof Error ? ocrError.message : String(ocrError),
                    data: { name },
                });
                await storeFileChunks(path, []);
                await emitFileUpdate({
                    ...dbMeta,
                    ocrStatus: 'failed',
                    processingStatus: 'completed',
                    indexingStage: 'metadata',
                }, options.onFileUpdated);
                return;
            }
        }

        await storeFileChunks(path, []);
        await emitFileUpdate({
            ...dbMeta,
            ocrStatus: undefined,
            processingStatus: 'completed',
            indexingStage: 'metadata',
        }, options.onFileUpdated);
    } catch (error) {
        console.error(`Error processing file ${name}:`, error);
        void logEvent({
            level: 'error',
            area: 'indexing',
            event: 'file.processing_failed',
            message: 'File processing failed',
            path,
            error: error instanceof Error ? error.message : String(error),
            data: { name },
        });
        await storeFileChunks(path, []);
        await emitFileUpdate({
            ...dbMeta,
            processingStatus: 'failed',
            indexingStage: 'failed',
        }, options.onFileUpdated);
    }
}
