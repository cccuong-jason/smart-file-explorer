import { openDB, DBSchema, IDBPDatabase } from 'idb';
import { save } from '@tauri-apps/plugin-dialog';
import { writeTextFile } from '@tauri-apps/plugin-fs';

interface FileMetadata {
    processingStatus: 'pending' | 'processing' | 'completed' | 'failed';
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

interface SmartFileExplorerDB extends DBSchema {
    files: {
        key: string;
        value: FileMetadata;
        indexes: { 'by-name': string; 'by-starred': number; 'by-tags': string[] };
    };
}

const DB_NAME = 'smart-file-explorer-db';
const DB_VERSION = 3;

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
}

export const deleteFile = async (path: string) => {
    const db = await getDB();
    await db.delete('files', path);
}
