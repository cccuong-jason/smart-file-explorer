import { pipeline, PipelineType } from '@xenova/transformers';

// Configure Transformers.js to use local models
import { env } from '@xenova/transformers';

const allowRemoteModels = import.meta.env.VITE_ALLOW_REMOTE_MODELS === 'true';
const localModelPath = import.meta.env.VITE_MODEL_PATH ?? '/models/';

// Read from frontend environment variables with safe local-first defaults.
env.allowLocalModels = true;
env.allowRemoteModels = allowRemoteModels;
env.localModelPath = localModelPath;

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
