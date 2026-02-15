import { pipeline, PipelineType } from '@xenova/transformers';

// Configure Transformers.js to use local models
import { env } from '@xenova/transformers';

// Skip local checks (we are running largely in browser, but this setting helps in some contexts)
env.allowLocalModels = false;
// Disable remote models - force usage of local files
env.allowRemoteModels = false;
// Set the local model path (relative to public/)
env.localModelPath = '/models/';

// Singleton to ensure model is loaded only once
class EmbeddingPipeline {
    static task: PipelineType = 'feature-extraction';
    static model = 'Xenova/all-MiniLM-L6-v2';
    static instance: any = null;
    static isDisabled = false;

    static async getInstance() {
        if (this.isDisabled) {
            throw new Error("Semantic search is disabled due to previous load failure.");
        }
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
