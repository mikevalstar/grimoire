/**
 * Local embedding generation using @huggingface/transformers with nomic-embed-text-v1.5.
 * Lazy-loads the model pipeline on first use — first run triggers a ~270MB download.
 * Progress callbacks allow the CLI to show download status.
 */

import type { FeatureExtractionPipeline } from "@huggingface/transformers";

const MODEL_NAME = "nomic-ai/nomic-embed-text-v1.5";
const EMBEDDING_DIM = 768;

export type ProgressCallback = (info: { status: string; progress?: number; file?: string }) => void;

let pipelineInstance: FeatureExtractionPipeline | null = null;
let pipelineLoading: Promise<FeatureExtractionPipeline> | null = null;

/**
 * Get or create the embedding pipeline (singleton).
 * First call downloads the ONNX model if not cached.
 */
async function getPipeline(onProgress?: ProgressCallback): Promise<FeatureExtractionPipeline> {
  if (pipelineInstance) return pipelineInstance;
  if (pipelineLoading) return pipelineLoading;

  pipelineLoading = (async () => {
    const { pipeline } = await import("@huggingface/transformers");
    const pipe = await pipeline("feature-extraction", MODEL_NAME, {
      dtype: "fp32",
      revision: "main",
      progress_callback: onProgress
        ? (data: Record<string, unknown>) => {
            onProgress({
              status: typeof data.status === "string" ? data.status : "",
              progress: typeof data.progress === "number" ? data.progress : undefined,
              file: typeof data.file === "string" ? data.file : undefined,
            });
          }
        : undefined,
    });
    pipelineInstance = pipe as FeatureExtractionPipeline;
    pipelineLoading = null;
    return pipelineInstance;
  })();

  return pipelineLoading;
}

/**
 * Generate a 768-dimensional embedding vector for the given text.
 * Uses nomic-embed-text-v1.5 with the "search_document: " prefix for documents
 * and "search_query: " prefix for queries.
 */
export async function generateEmbedding(
  text: string,
  options?: { prefix?: "search_document" | "search_query"; onProgress?: ProgressCallback },
): Promise<number[]> {
  const prefix = options?.prefix ?? "search_document";
  const pipe = await getPipeline(options?.onProgress);

  // nomic-embed-text-v1.5 uses task prefixes for asymmetric search
  const prefixedText = `${prefix}: ${text}`;

  // Truncate to model context window (~8192 tokens, ~32K chars as rough limit)
  const truncated = prefixedText.length > 32000 ? prefixedText.slice(0, 32000) : prefixedText;

  const output = await pipe(truncated, { pooling: "mean", normalize: true });
  const embedding = Array.from(output.data as Float32Array).slice(0, EMBEDDING_DIM);

  return embedding;
}

/**
 * Generate embeddings for multiple texts in sequence.
 * Returns an array of vectors in the same order as input.
 */
export async function generateEmbeddings(
  texts: string[],
  options?: { prefix?: "search_document" | "search_query"; onProgress?: ProgressCallback },
): Promise<number[][]> {
  const results: number[][] = [];
  for (const text of texts) {
    results.push(await generateEmbedding(text, options));
  }
  return results;
}

export { EMBEDDING_DIM };
