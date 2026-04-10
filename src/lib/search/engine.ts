// Search Worker Initialization
import { logFrontendMessage } from '../telemetry/logger';

let worker: Worker | null = null;
const requestMap = new Map<string, { resolve: (results: any) => void; reject: (error: Error) => void }>();

export interface SearchOptions {
    useSemantic?: boolean;
}

function getWorker() {
    if (!worker) {
        worker = new Worker(new URL('./search.worker', import.meta.url), { type: 'module' });
        worker.onmessage = (e) => {
            const { type, payload, id } = e.data;
            if ((type === 'SEARCH_RESULT' || type === 'RELATED_RESULT') && requestMap.has(id)) {
                requestMap.get(id)?.resolve(payload);
                requestMap.delete(id);
            }
            if (type === 'ERROR' && requestMap.has(id)) {
                const errorMessage = payload || 'Search worker failed';
                void logFrontendMessage('error', errorMessage, 'search-engine');
                requestMap.get(id)?.reject(new Error(errorMessage));
                requestMap.delete(id);
            }
        };
        worker.onerror = (event) => {
            const error = event instanceof ErrorEvent
                ? new Error(event.message || 'Search worker crashed')
                : new Error('Search worker crashed');
            void logFrontendMessage('error', error.message, 'search-engine');
            for (const [, handlers] of requestMap) {
                handlers.reject(error);
            }
            requestMap.clear();
        };
    }
    return worker;
}

export async function searchFiles(query: string, options: SearchOptions = {}): Promise<any[]> {
    return new Promise((resolve, reject) => {
        const id = crypto.randomUUID();
        requestMap.set(id, { resolve, reject });
        getWorker().postMessage({
            type: 'SEARCH',
            payload: {
                query,
                useSemantic: options.useSemantic ?? true,
            },
            id,
        });
    });
}

export async function findRelatedFiles(sourceFile: any): Promise<any[]> {
    return new Promise((resolve, reject) => {
        const id = crypto.randomUUID();
        requestMap.set(id, { resolve, reject });
        getWorker().postMessage({ type: 'RELATED', payload: { sourceFile }, id });
    });
}
