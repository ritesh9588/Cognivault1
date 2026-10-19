/**
 * Dynamic in-memory BM25 retrieval over a collection of document chunks.
 */

// Simple robust tokenizer for English text, retaining technical terms, identifiers, names, numbers.
export const tokenize = (text) => {
    if (!text || typeof text !== "string") return [];
    return text.toLowerCase()
        .replace(/[^\w\s-]/g, " ") // Replace punctuation with space, keeping word characters and hyphens
        .split(/\s+/)
        .filter(token => token.length > 0);
};

/**
 * Computes BM25 scores for all document chunks with respect to a user query.
 * 
 * Formula parameters:
 * k1: controls term frequency scaling (typical range 1.2 - 2.0). We use 1.5.
 * b: controls document length normalization (typical value 0.75). We use 0.75.
 * 
 * @param {Array} chunks - List of DocumentChunk mongoose documents or plain objects.
 * @param {string} queryText - The user query string.
 * @returns {Array} List of matches with score: { chunk, score } sorted by score descending.
 */
export const computeBM25 = (chunks, queryText) => {
    const queryTokens = tokenize(queryText);
    if (queryTokens.length === 0 || chunks.length === 0) {
        return [];
    }

    const N = chunks.length;

    // Pre-tokenize all chunks and build term frequencies
    const docTokenLists = [];
    const docTermFreqs = []; // List of Maps: term -> frequency
    const docLengths = [];
    let totalDocLength = 0;

    // Track document frequency for each term: term -> number of documents containing it
    const docFreq = new Map();

    for (const chunk of chunks) {
        const tokens = tokenize(chunk.text);
        docTokenLists.push(tokens);
        docLengths.push(tokens.length);
        totalDocLength += tokens.length;

        const termFreqMap = new Map();
        const uniqueTokensInDoc = new Set();

        for (const token of tokens) {
            termFreqMap.set(token, (termFreqMap.get(token) || 0) + 1);
            uniqueTokensInDoc.add(token);
        }
        docTermFreqs.push(termFreqMap);

        for (const token of uniqueTokensInDoc) {
            docFreq.set(token, (docFreq.get(token) || 0) + 1);
        }
    }

    const avgdl = totalDocLength / N;
    const k1 = 1.5;
    const b = 0.75;

    // Calculate IDF for each query token
    const idfs = new Map();
    for (const token of queryTokens) {
        const n = docFreq.get(token) || 0;
        // Standard BM25 IDF with safety clamping to avoid negative IDF for very common terms
        const idf = Math.log((N - n + 0.5) / (n + 0.5) + 1);
        idfs.set(token, Math.max(0.0001, idf));
    }

    // Score each chunk
    const scoredChunks = [];

    for (let i = 0; i < N; i++) {
        const chunk = chunks[i];
        const tfMap = docTermFreqs[i];
        const docLen = docLengths[i];

        let score = 0;
        for (const token of queryTokens) {
            const tf = tfMap.get(token) || 0;
            if (tf > 0) {
                const idf = idfs.get(token);
                // BM25 scoring formula
                const numerator = tf * (k1 + 1);
                const denominator = tf + k1 * (1 - b + b * (docLen / avgdl));
                score += idf * (numerator / denominator);
            }
        }

        if (score > 0) {
            scoredChunks.push({
                chunk,
                score
            });
        }
    }

    // Sort descending by BM25 score
    scoredChunks.sort((a, b) => b.score - a.score);

    return scoredChunks;
};

/**
 * Perform BM25 retrieval and return limited candidates.
 * 
 * @param {Array} chunks - List of DocumentChunk objects.
 * @param {string} queryText - The search query.
 * @param {number} limit - Maximum candidates to return.
 * @returns {Array} Ranked list of matches: { chunk, score }
 */
export const searchBM25 = (chunks, queryText, limit = 20) => {
    const scored = computeBM25(chunks, queryText);
    return scored.slice(0, limit);
};
