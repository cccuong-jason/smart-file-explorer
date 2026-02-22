import { pipeline, PipelineType } from '@xenova/transformers';

// Configure Transformers.js to use local models
import { env } from '@xenova/transformers';

// Read from environment variables (set in .env.local or Vercel dashboard).
// Fallback to safe production defaults if not set.
env.allowLocalModels = false;
env.allowRemoteModels = process.env.NEXT_PUBLIC_ALLOW_REMOTE_MODELS === 'true';
env.localModelPath = process.env.NEXT_PUBLIC_MODEL_PATH ?? '/models/';

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
                    local_files_only: true,
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
