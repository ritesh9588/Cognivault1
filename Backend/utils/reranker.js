import { AutoTokenizer, AutoModelForSequenceClassification } from "@xenova/transformers";

let tokenizer = null;
let model = null;
let currentModelName = null;

/**
 * Initializes the tokenizer and sequence classification model.
 * Uses quantized weights by default for low memory usage and faster loading.
 * 
 * @param {string} modelName - Hugging Face model identifier.
 */
export const initReranker = async (modelName) => {
    if (tokenizer && model && currentModelName === modelName) {
        return;
    }

    console.log(`[Reranker] Initializing Cross-Encoder model: ${modelName}...`);
    
    // Configure transformers local cache and env if needed
    // By default Xenova/Transformers.js downloads to ~/.cache/huggingface/hub or ~/.cache/huggingface
    tokenizer = await AutoTokenizer.from_pretrained(modelName);
    model = await AutoModelForSequenceClassification.from_pretrained(modelName, {
        quantized: true
    });
    currentModelName = modelName;
    console.log(`[Reranker] Model ${modelName} loaded successfully.`);
};

/**
 * Reranks a list of candidate chunks against a query.
 * 
 * @param {string} query - The original user search query.
 * @param {Array} chunks - List of document chunks.
 * @param {string} modelName - Model name to use.
 * @returns {Promise<Array>} List of { chunk, score } sorted descending by score.
 */
export const rerankChunks = async (query, chunks, modelName) => {
    if (!chunks || chunks.length === 0) {
        return [];
    }

    await initReranker(modelName);

    // Prepare inputs for batch encoding
    const textBatch = Array(chunks.length).fill(query);
    const pairBatch = chunks.map(chunk => chunk.text);

    // Tokenize all pairs in batch
    const inputs = await tokenizer(textBatch, {
        text_pair: pairBatch,
        padding: true,
        truncation: true,
        return_tensors: "pt"
    });

    // Run inference
    const output = await model(inputs);

    // Read logits dimensions
    // output.logits.dims is [batch_size, num_labels]
    const dims = output.logits.dims;
    const numLabels = dims[1] || 1;

    const scored = chunks.map((chunk, i) => {
        let score;
        if (numLabels === 1) {
            score = output.logits.data[i];
        } else {
            // For binary classification, relevance is typically the last label (index 1)
            score = output.logits.data[i * numLabels + (numLabels - 1)];
        }
        return {
            chunk,
            score
        };
    });

    // Sort descending by reranking score
    scored.sort((a, b) => b.score - a.score);

    return scored;
};
