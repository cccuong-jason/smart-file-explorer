import { openDB, DBSchema, IDBPDatabase } from 'idb';
import { save } from '@tauri-apps/plugin-dialog';
import { writeTextFile } from '@tauri-apps/plugin-fs';
import type { FileClassification } from '../file-browser/classification';

export type FileIndexingStage = 'metadata' | 'content' | 'semantic' | 'failed';
export type VisualIndexingStage = 'none' | 'processing' | 'completed' | 'failed';
export type OcrStatus = 'recommended' | 'processing' | 'completed' | 'failed';

export interface FileMetadata extends FileClassification {
    processingStatus: 'pending' | 'processing' | 'completed' | 'failed';
    ocrStatus?: OcrStatus;
    indexingStage?: FileIndexingStage;
    visualIndexingStage?: VisualIndexingStage;
    path: string;
    name: string;
    size: number;
    type: string;
    lastModified: number;
    content?: string;
    embedding?: number[];
    tags?: string[];
    isStarred?: boolean;
}

export interface FileChunk {
    id: string;
    filePath: string;
    index: number;
    text: string;
    embedding?: number[];
    pageNumber?: number;
    sourceLabel?: string;
}

export interface VisualChunk {
    id: string;
    filePath: string;
    kind: 'image';
    sourceLabel: string;
    embedding: number[];
    ocrText?: string;
    ocrConfidence?: number;
    createdAt: number;
}

export interface WorkspaceAiSummaryRecord {
    workspaceId: string;
    fingerprint: string;
    title?: string;
    summary: string;
    highlights: string[];
    rationale: string[];
    model: string;
    updatedAt: number;
}

export type WatchedFolderStatus = 'idle' | 'watching' | 'indexing' | 'paused' | 'error';

export interface WatchedFolderRecord {
    path: string;
    enabled: boolean;
    status: WatchedFolderStatus;
    lastScanStartedAt?: number;
    lastScanCompletedAt?: number;
    lastError?: string;
}

interface SmartFileExplorerDB extends DBSchema {
    files: {
        key: string;
        value: FileMetadata;
        indexes: { 'by-name': string; 'by-starred': number; 'by-tags': string[] };
    };
    chunks: {
        key: string;
        value: FileChunk;
        indexes: { 'by-file-path': string; 'by-file-path-and-index': [string, number] };
    };
    visualChunks: {
        key: string;
        value: VisualChunk;
        indexes: { 'by-file-path': string };
    };
    workspaceAiSummaries: {
        key: string;
        value: WorkspaceAiSummaryRecord;
    };
    watchedFolders: {
        key: string;
        value: WatchedFolderRecord;
    };
}

const DB_NAME = 'smart-file-explorer-db';
const DB_VERSION = 7;

let dbPromise: Promise<IDBPDatabase<SmartFileExplorerDB>>;

export const getDB = () => {
    if (!dbPromise) {
        dbPromise = openDB<SmartFileExplorerDB>(DB_NAME, DB_VERSION, {
            upgrade(db, oldVersion, newVersion, transaction) {
                if (oldVersion < 1) {
                    const store = db.createObjectStore('files', { keyPath: 'path' });
                    store.createIndex('by-name', 'name');
                }
                if (oldVersion < 2) {
                    const store = transaction.objectStore('files');
                    store.createIndex('by-starred', 'isStarred');
                }
                if (oldVersion < 3) {
                    const store = transaction.objectStore('files');
                    store.createIndex('by-tags', 'tags', { multiEntry: true });
                }
                if (oldVersion < 4) {
                    const chunkStore = db.createObjectStore('chunks', { keyPath: 'id' });
                    chunkStore.createIndex('by-file-path', 'filePath');
                    chunkStore.createIndex('by-file-path-and-index', ['filePath', 'index']);
                }
                if (oldVersion < 5) {
                    db.createObjectStore('workspaceAiSummaries', { keyPath: 'workspaceId' });
                }
                if (oldVersion < 6) {
                    db.createObjectStore('watchedFolders', { keyPath: 'path' });
                }
                if (oldVersion < 7) {
                    const visualChunkStore = db.createObjectStore('visualChunks', { keyPath: 'id' });
                    visualChunkStore.createIndex('by-file-path', 'filePath');
                }
            },
        });
    }
    return dbPromise;
};

export const storeFile = async (file: FileMetadata) => {
    const db = await getDB();
    await db.put('files', file);
};

export const getFile = async (path: string) => {
    const db = await getDB();
    return db.get('files', path);
};

export const getAllFiles = async () => {
    const db = await getDB();
    return db.getAll('files');
};

export const getOcrCandidateCount = async () => {
    const db = await getDB();
    const files = await db.getAll('files');
    return files.filter((file) => ['recommended', 'processing', 'failed'].includes(file.ocrStatus ?? '')).length;
};

export const storeFileChunks = async (filePath: string, chunks: FileChunk[]) => {
    const db = await getDB();
    const tx = db.transaction('chunks', 'readwrite');
    const index = tx.store.index('by-file-path');
    let cursor = await index.openCursor(IDBKeyRange.only(filePath));

    while (cursor) {
        await cursor.delete();
        cursor = await cursor.continue();
    }

    for (const chunk of chunks) {
        await tx.store.put(chunk);
    }

    await tx.done;
};

export const getFileChunks = async (filePath: string) => {
    const db = await getDB();
    return db.getAllFromIndex('chunks', 'by-file-path', filePath);
};

export const getAllChunks = async () => {
    const db = await getDB();
    return db.getAll('chunks');
};

export const storeVisualChunks = async (filePath: string, chunks: VisualChunk[]) => {
    const db = await getDB();
    const tx = db.transaction('visualChunks', 'readwrite');
    const index = tx.store.index('by-file-path');
    let cursor = await index.openCursor(IDBKeyRange.only(filePath));

    while (cursor) {
        await cursor.delete();
        cursor = await cursor.continue();
    }

    for (const chunk of chunks) {
        await tx.store.put(chunk);
    }

    await tx.done;
};

export const getVisualChunks = async (filePath: string) => {
    const db = await getDB();
    return db.getAllFromIndex('visualChunks', 'by-file-path', filePath);
};

export const getAllVisualChunks = async () => {
    const db = await getDB();
    return db.getAll('visualChunks');
};

export const storeWorkspaceAiSummary = async (summary: WorkspaceAiSummaryRecord) => {
    const db = await getDB();
    await db.put('workspaceAiSummaries', summary);
};

export const getWatchedFolders = async () => {
    const db = await getDB();
    const folders = await db.getAll('watchedFolders');
    return folders.sort((a, b) => a.path.localeCompare(b.path));
};

export const saveWatchedFolder = async (folder: WatchedFolderRecord) => {
    const db = await getDB();
    await db.put('watchedFolders', folder);
};

export const setWatchedFolderEnabled = async (path: string, enabled: boolean) => {
    const db = await getDB();
    const existing = await db.get('watchedFolders', path);
    if (!existing) {
        return;
    }

    await db.put('watchedFolders', {
        ...existing,
        enabled,
        status: enabled ? existing.status : 'paused',
    });
};

export const setWatchedFolderStatus = async (
    path: string,
    updates: Partial<Pick<WatchedFolderRecord, 'status' | 'lastScanStartedAt' | 'lastScanCompletedAt' | 'lastError'>>
) => {
    const db = await getDB();
    const existing = await db.get('watchedFolders', path);
    if (!existing) {
        return;
    }

    await db.put('watchedFolders', {
        ...existing,
        ...updates,
    });
};

export const removeWatchedFolder = async (path: string) => {
    const db = await getDB();
    await db.delete('watchedFolders', path);
};

export const getWorkspaceAiSummary = async (workspaceId: string) => {
    const db = await getDB();
    return db.get('workspaceAiSummaries', workspaceId);
};

export const deleteWorkspaceAiSummary = async (workspaceId: string) => {
    const db = await getDB();
    await db.delete('workspaceAiSummaries', workspaceId);
};

export const toggleFileStar = async (path: string) => {
    const db = await getDB();
    const file = await db.get('files', path);
    if (file) {
        file.isStarred = !file.isStarred;
        await db.put('files', file);
        return file.isStarred;
    }
    return false;
};

export const addFileTag = async (path: string, tag: string) => {
    const db = await getDB();
    const file = await db.get('files', path);
    if (file) {
        if (!file.tags) file.tags = [];
        if (!file.tags.includes(tag)) {
            file.tags.push(tag);
            await db.put('files', file);
        }
        return file.tags;
    }
    return [];
};

export const removeFileTag = async (path: string, tag: string) => {
    const db = await getDB();
    const file = await db.get('files', path);
    if (file && file.tags) {
        file.tags = file.tags.filter(t => t !== tag);
        await db.put('files', file);
        return file.tags;
    }
    return [];
};

export const exportIndexToJSON = async () => {
    const db = await getDB();
    const allFiles = await db.getAll('files');
    const jsonStr = JSON.stringify(allFiles, null, 2);
    
    const filePath = await save({
        filters: [{
            name: 'JSON Database Index',
            extensions: ['json']
        }],
        defaultPath: `smart-file-explorer-index-${new Date().toISOString().split('T')[0]}.json`
    });

    if (filePath) {
        await writeTextFile(filePath, jsonStr);
    }
    
    return allFiles.length;
};

export const clearDatabase = async () => {
    const db = await getDB();
    await db.clear('files');
    await db.clear('chunks');
    await db.clear('visualChunks');
    await db.clear('workspaceAiSummaries');
    await db.clear('watchedFolders');
}

export const deleteFile = async (path: string) => {
    const db = await getDB();
    const tx = db.transaction(['files', 'chunks', 'visualChunks'], 'readwrite');
    await tx.objectStore('files').delete(path);

    const chunkIndex = tx.objectStore('chunks').index('by-file-path');
    let cursor = await chunkIndex.openCursor(IDBKeyRange.only(path));
    while (cursor) {
        await cursor.delete();
        cursor = await cursor.continue();
    }

    const visualChunkIndex = tx.objectStore('visualChunks').index('by-file-path');
    let visualCursor = await visualChunkIndex.openCursor(IDBKeyRange.only(path));
    while (visualCursor) {
        await visualCursor.delete();
        visualCursor = await visualCursor.continue();
    }

    await tx.done;
}
