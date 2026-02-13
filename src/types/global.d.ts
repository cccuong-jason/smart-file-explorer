export { };

declare global {
    interface Window {
        showDirectoryPicker(options?: any): Promise<FileSystemDirectoryHandle>;
    }

    interface FileSystemHandle {
        kind: 'file' | 'directory';
        name: string;
        isSameEntry(other: FileSystemHandle): Promise<boolean>;
    }

    interface FileSystemFileHandle extends FileSystemHandle {
        kind: 'file';
        getFile(): Promise<File>;
        createWritable(options?: any): Promise<FileSystemWritableFileStream>;
    }

    interface FileSystemDirectoryHandle extends FileSystemHandle {
        kind: 'directory';
        getDirectoryHandle(name: string, options?: any): Promise<FileSystemDirectoryHandle>;
        getFileHandle(name: string, options?: any): Promise<FileSystemFileHandle>;
        removeEntry(name: string, options?: any): Promise<void>;
        resolve(possibleDescendant: FileSystemHandle): Promise<string[] | null>;
        values(): AsyncIterableIterator<FileSystemHandle>;
        keys(): AsyncIterableIterator<string>;
        entries(): AsyncIterableIterator<[string, FileSystemHandle]>;
    }

    interface FileSystemWritableFileStream extends WritableStream {
        write(data: any): Promise<void>;
        seek(position: number): Promise<void>;
        truncate(size: number): Promise<void>;
    }
}
