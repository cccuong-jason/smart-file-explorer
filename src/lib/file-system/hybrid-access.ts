
// This file is client-side only

export class HybridFileAccess {
    private useNativeAPI: boolean;
    private ignoredDirectories = new Set(['node_modules', '.git', '.next', 'dist', 'build']);

    constructor() {
        this.useNativeAPI = typeof window !== 'undefined' && 'showDirectoryPicker' in window;
    }

    async selectDirectory(): Promise<AsyncGenerator<File>> {
        if (!this.useNativeAPI) {
            throw new Error("Native API not supported. Please use a browser like Chrome or Edge.");
        }

        try {
            // @ts-ignore
            const dirHandle = await window.showDirectoryPicker();
            return this.readDirectoryRecursively(dirHandle);
        } catch (err) {
            console.error("Error accessing directory:", err);
            // Return empty generator on error/cancel
            return (async function* () { })();
        }
    }

    private async *readDirectoryRecursively(dirHandle: any): AsyncGenerator<File> {
        for await (const entry of dirHandle.values()) {
            if (entry.kind === 'file') {
                if (entry.name.startsWith('.')) continue; // Skip hidden files

                // Filter by extension if needed, for MVP we yield all and let worker/UI filter or process
                // Basic check to avoid binary blob dumps if possible, but detection is hard without reading
                const file = await entry.getFile();
                yield file;
            } else if (entry.kind === 'directory') {
                if (this.ignoredDirectories.has(entry.name) || entry.name.startsWith('.')) continue;

                yield* this.readDirectoryRecursively(entry);
            }
        }
    }
}
