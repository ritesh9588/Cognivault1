import DocumentChunk from "../models/DocumentChunk.js";
import Document from "../models/Document.js";
import { generateEmbedding } from "./embeddings.js";
import { searchBM25 } from "./bm25.js";
import { rerankChunks } from "./reranker.js";

// Cosine similarity helper
export const cosineSimilarity = (vecA, vecB) => {
    let dotProduct = 0.0;
    let normA = 0.0;
    let normB = 0.0;
    for (let i = 0; i < vecA.length; i++) {
        dotProduct += vecA[i] * vecB[i];
        normA += vecA[i] * vecA[i];
        normB += vecB[i] * vecB[i];
    }
    if (normA === 0 || normB === 0) return 0;
    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
};

export const searchRelevantChunks = async (queryText, userId, threshold = 0.5, limit = 4, strategy = "rerank") => {
    try {
        // Load configuration from environment variables with safe defaults
        const vectorCount = parseInt(process.env.VECTOR_CANDIDATE_COUNT) || 20;
        const bm25Count = parseInt(process.env.BM25_CANDIDATE_COUNT) || 20;
        const rerankCount = parseInt(process.env.RERANKING_CANDIDATE_COUNT) || 25;
        const finalTopK = parseInt(process.env.FINAL_TOP_K) || limit; // Fallback to parameter limit if not configured
        const rerankModel = process.env.RERANKING_MODEL || "Xenova/ms-marco-MiniLM-L-6-v2";

        // Fetch all chunks for this user
        const chunks = await DocumentChunk.find({ userId });
        if (chunks.length === 0) {
            const emptyRes = [];
            emptyRes.latencies = { retrieval: 0, reranking: 0, total: 0 };
            return emptyRes;
        }

        // ==========================================
        // STRATEGY A: VECTOR ONLY
        // ==========================================
        if (strategy === "vector") {
            const startRetrieval = Date.now();
            let queryVector = [];
            try {
                queryVector = await generateEmbedding(queryText);
            } catch (err) {
                console.error("Vector only embedding failed:", err);
                const errRes = [];
                errRes.latencies = { retrieval: Date.now() - startRetrieval, reranking: 0, total: Date.now() - startRetrieval };
                return errRes;
            }

            const matches = [];
            for (const chunk of chunks) {
                const similarity = cosineSimilarity(queryVector, chunk.embedding);
                if (similarity >= threshold) {
                    matches.push({ chunk, similarity });
                }
            }

            matches.sort((a, b) => b.similarity - a.similarity);
            const topMatches = matches.slice(0, finalTopK);

            const results = [];
            for (const match of topMatches) {
                const doc = await Document.findById(match.chunk.documentId);
                results.push({
                    text: match.chunk.text,
                    sourceName: doc ? doc.name : "Unknown Document",
                    pageNumber: match.chunk.pageNumber,
                    similarity: match.similarity
                });
            }

            const duration = Date.now() - startRetrieval;
            results.latencies = { retrieval: duration, reranking: 0, total: duration };
            return results;
        }

        // ==========================================
        // STRATEGY B: HYBRID (VECTOR + BM25 + RRF)
        // ==========================================
        if (strategy === "hybrid") {
            const startRetrieval = Date.now();
            
            // Parallel Vector Search
            let vectorCandidates = [];
            try {
                const queryVector = await generateEmbedding(queryText);
                const matches = [];
                for (const chunk of chunks) {
                    const similarity = cosineSimilarity(queryVector, chunk.embedding);
                    matches.push({ chunk, similarity });
                }
                matches.sort((a, b) => b.similarity - a.similarity);
                vectorCandidates = matches.slice(0, vectorCount);
            } catch (vectorErr) {
                console.error("Hybrid search: Vector branch embedding failed:", vectorErr.message);
            }

            // Parallel BM25 Keyword Search
            const bm25Candidates = searchBM25(chunks, queryText, bm25Count);

            // Reciprocal Rank Fusion (RRF)
            const vectorRankMap = new Map();
            vectorCandidates.forEach((cand, idx) => {
                vectorRankMap.set(cand.chunk._id.toString(), idx + 1);
            });

            const bm25RankMap = new Map();
            bm25Candidates.forEach((cand, idx) => {
                bm25RankMap.set(cand.chunk._id.toString(), idx + 1);
            });

            const uniqueChunksMap = new Map();
            vectorCandidates.forEach(c => uniqueChunksMap.set(c.chunk._id.toString(), c.chunk));
            bm25Candidates.forEach(c => uniqueChunksMap.set(c.chunk._id.toString(), c.chunk));

            const rrfK = 60;
            const fusedResults = [];

            for (const [id, chunk] of uniqueChunksMap.entries()) {
                const vectorRank = vectorRankMap.get(id);
                const bm25Rank = bm25RankMap.get(id);

                const scoreVector = vectorRank ? (1.0 / (rrfK + vectorRank)) : 0.0;
                const scoreBM25 = bm25Rank ? (1.0 / (rrfK + bm25Rank)) : 0.0;
                const rrfScore = scoreVector + scoreBM25;

                fusedResults.push({ chunk, rrfScore });
            }

            fusedResults.sort((a, b) => b.rrfScore - a.rrfScore);
            const selected = fusedResults.slice(0, finalTopK);

            const results = [];
            for (const item of selected) {
                const doc = await Document.findById(item.chunk.documentId);
                results.push({
                    text: item.chunk.text,
                    sourceName: doc ? doc.name : "Unknown Document",
                    pageNumber: item.chunk.pageNumber,
                    similarity: item.rrfScore
                });
            }

            const duration = Date.now() - startRetrieval;
            results.latencies = { retrieval: duration, reranking: 0, total: duration };
            return results;
        }

        // ==========================================
        // STRATEGY C: HYBRID + RERANKING
        // ==========================================
        const startRetrieval = Date.now();
        
        // 1. Parallel Vector Search
        let vectorCandidates = [];
        try {
            const queryVector = await generateEmbedding(queryText);
            const matches = [];
            for (const chunk of chunks) {
                const similarity = cosineSimilarity(queryVector, chunk.embedding);
                matches.push({ chunk, similarity });
            }
            matches.sort((a, b) => b.similarity - a.similarity);
            vectorCandidates = matches.slice(0, vectorCount);
        } catch (vectorErr) {
            console.error("Vector search embedding generation failed, continuing with BM25 keyword matching:", vectorErr.message);
        }

        // 2. Parallel BM25 Keyword Search
        const bm25Candidates = searchBM25(chunks, queryText, bm25Count);

        // 3. Reciprocal Rank Fusion (RRF)
        const vectorRankMap = new Map();
        vectorCandidates.forEach((cand, idx) => {
            vectorRankMap.set(cand.chunk._id.toString(), idx + 1);
        });

        const bm25RankMap = new Map();
        bm25Candidates.forEach((cand, idx) => {
            bm25RankMap.set(cand.chunk._id.toString(), idx + 1);
        });

        const uniqueChunksMap = new Map();
        vectorCandidates.forEach(c => uniqueChunksMap.set(c.chunk._id.toString(), c.chunk));
        bm25Candidates.forEach(c => uniqueChunksMap.set(c.chunk._id.toString(), c.chunk));

        const rrfK = 60;
        const fusedResults = [];

        for (const [id, chunk] of uniqueChunksMap.entries()) {
            const vectorRank = vectorRankMap.get(id);
            const bm25Rank = bm25RankMap.get(id);

            const scoreVector = vectorRank ? (1.0 / (rrfK + vectorRank)) : 0.0;
            const scoreBM25 = bm25Rank ? (1.0 / (rrfK + bm25Rank)) : 0.0;
            const rrfScore = scoreVector + scoreBM25;

            fusedResults.push({ chunk, rrfScore });
        }

        fusedResults.sort((a, b) => b.rrfScore - a.rrfScore);
        const candidatesToRerank = fusedResults.slice(0, rerankCount).map(res => res.chunk);

        const retrievalDuration = Date.now() - startRetrieval;

        // 4. Cross-Encoder Reranking
        const startReranking = Date.now();
        let topChunks = [];
        
        if (candidatesToRerank.length > 0) {
            try {
                const reranked = await rerankChunks(queryText, candidatesToRerank, rerankModel);
                const selected = reranked.slice(0, finalTopK);
                topChunks = selected.map(s => ({
                    chunk: s.chunk,
                    score: s.score
                }));
            } catch (rerankErr) {
                console.error(`[RAG-Pipeline] Reranking failed (Model: ${rerankModel}). Falling back to fused RRF results. Error:`, rerankErr.message);
                const selected = fusedResults.slice(0, finalTopK);
                topChunks = selected.map(s => ({
                    chunk: s.chunk,
                    score: s.rrfScore
                }));
            }
        }
        
        const rerankDuration = Date.now() - startReranking;

        // 5. Fetch document metadata and return formatted results
        const results = [];
        for (const item of topChunks) {
            const doc = await Document.findById(item.chunk.documentId);
            results.push({
                text: item.chunk.text,
                sourceName: doc ? doc.name : "Unknown Document",
                pageNumber: item.chunk.pageNumber,
                similarity: item.score
            });
        }

        results.latencies = {
            retrieval: retrievalDuration,
            reranking: rerankDuration,
            total: retrievalDuration + rerankDuration
        };

        return results;
    } catch (err) {
        console.error("RAG pipeline error:", err);
        const errRes = [];
        errRes.latencies = { retrieval: 0, reranking: 0, total: 0 };
        return errRes;
    }
};

