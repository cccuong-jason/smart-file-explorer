import { env, pipeline, type PipelineType } from '@xenova/transformers';

const allowRemoteModels = import.meta.env.VITE_ALLOW_REMOTE_MODELS === 'true';
const localModelPath = import.meta.env.VITE_MODEL_PATH ?? '/models/';
const ortWasmPath = withTrailingSlash(import.meta.env.VITE_ORT_WASM_PATH ?? '/ort/');

// Read from frontend environment variables with safe local-first defaults.
env.allowLocalModels = true;
env.allowRemoteModels = allowRemoteModels;
env.localModelPath = localModelPath;
env.backends.onnx.wasm.wasmPaths = ortWasmPath;

function withTrailingSlash(path: string) {
    return path.endsWith('/') ? path : `${path}/`;
}

// Singleton to ensure model is loaded only once
class EmbeddingPipeline {
    static task: PipelineType = 'feature-extraction';
    static model = 'Xenova/all-MiniLM-L6-v2';
    static instance: any = null;

    static async getInstance() {
        if (this.instance === null) {
            try {
                // Load model from local 'public/models' directory
                this.instance = await pipeline(this.task, this.model, {
                    local_files_only: !env.allowRemoteModels,
                });
            } catch (error) {
                console.error("Failed to load LOCAL vector embedding model. Check 'public/models' integrity.", error);
                throw error;
            }
        }
        return this.instance;
    }
}

export async function generateEmbedding(text: string): Promise<number[]> {
    const extractor = await EmbeddingPipeline.getInstance();
    const output = await extractor(text, { pooling: 'mean', normalize: true });
    return Array.from(output.data);
}
