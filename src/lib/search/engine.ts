// Search Worker Initialization
let worker: Worker | null = null;
const requestMap = new Map<string, (results: any) => void>();

function getWorker() {
    if (!worker) {
        worker = new Worker(new URL('./search.worker', import.meta.url));
        worker.onmessage = (e) => {
            const { type, payload, id } = e.data;
            if ((type === 'SEARCH_RESULT' || type === 'RELATED_RESULT') && requestMap.has(id)) {
                requestMap.get(id)?.(payload);
                requestMap.delete(id);
            }
        };
    }
    return worker;
}

export async function searchFiles(query: string): Promise<any[]> {
    return new Promise((resolve) => {
        const id = crypto.randomUUID();
        requestMap.set(id, resolve);
        getWorker().postMessage({ type: 'SEARCH', payload: { query }, id });
    });
}

export async function findRelatedFiles(sourceFile: any): Promise<any[]> {
    return new Promise((resolve) => {
        const id = crypto.randomUUID();
        requestMap.set(id, resolve);
        getWorker().postMessage({ type: 'RELATED', payload: { sourceFile }, id });
    });
}
