import { pipeline, PipelineType } from '@xenova/transformers';

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
                // Attempt to load the model. This triggers a network request to HuggingFace.
                // If offline or blocked by CSP/CORS, this will throw.
                this.instance = await pipeline(this.task, this.model);
            } catch (error) {
                console.error("Failed to load vector embedding model. Semantic search will be permanently disabled for this session.", error);
                this.isDisabled = true; // prevent further attempts
                throw error; // Re-throw to be handled by caller
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
