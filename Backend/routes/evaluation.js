import express from "express";
import auth from "../middleware/auth.js";
import EvaluationRun from "../models/EvaluationRun.js";
import Document from "../models/Document.js";
import { searchRelevantChunks } from "../utils/vectorSearch.js";
import getGeminiAPIResponse from "../utils/gemini.js";
import {
    evaluateRetrievalRelevance,
    evaluateFaithfulness,
    evaluateAnswerRelevance,
    evaluateContextRecall
} from "../utils/evaluator.js";

const router = express.Router();

// Helper to generate LLM response using context chunks
const generateRAGAnswer = async (question, chunks) => {
    if (!chunks || chunks.length === 0) {
        return {
            reply: "I cannot find the answer to this question in the uploaded documents.",
            llmDuration: 0
        };
    }

    const contextStr = chunks.map(c => `[Document: ${c.sourceName}]\n${c.text}`).join("\n\n");
    const prompt = `You are a helpful assistant. Use the following context from the user's uploaded documents to answer their question.
If the context does not contain enough information to answer the question, clearly state: "I cannot find the answer to this question in the uploaded documents." and do not attempt to invent or make up an answer.

Context:
${contextStr}

User Question: ${question}`;

    const startLLM = Date.now();
    try {
        const reply = await getGeminiAPIResponse(prompt);
        const llmDuration = Date.now() - startLLM;
        return { reply, llmDuration };
    } catch (err) {
        console.error("Gemini API call failed during evaluation:", err);
        return {
            reply: "Failed to generate answer due to LLM error.",
            llmDuration: Date.now() - startLLM
        };
    }
};

// 1. Run RAG Evaluation for a single query using the default (rerank) pipeline
router.post("/evaluation/run", auth, async (req, res) => {
    const { question, groundTruthAnswer } = req.body;
    if (!question || question.trim().length === 0) {
        return res.status(400).json({ error: "Question is required." });
    }

    try {
        const userId = req.user.id;

        // Retrieve context using Rerank strategy
        const relevantChunks = await searchRelevantChunks(question, userId, 0.4, 4, "rerank");
        const latencies = relevantChunks.latencies || { retrieval: 0, reranking: 0, total: 0 };

        // Generate LLM answer
        const { reply, llmDuration } = await generateRAGAnswer(question, relevantChunks);

        // Run judge evaluations
        const relevanceResult = await evaluateRetrievalRelevance(question, relevantChunks);
        const faithfulnessResult = await evaluateFaithfulness(question, relevantChunks, reply);
        const answerRelevanceResult = await evaluateAnswerRelevance(question, reply);
        const recallResult = await evaluateContextRecall(question, relevantChunks, groundTruthAnswer);

        // Calculate success: successful if both retrieval relevance and faithfulness are >= 0.6
        const isSuccess = relevanceResult.score >= 0.6 && faithfulnessResult.score >= 0.7;

        // Save run
        const run = new EvaluationRun({
            userId,
            question,
            groundTruthAnswer: groundTruthAnswer || null,
            strategy: "rerank",
            retrievedContext: relevantChunks.map(c => ({
                text: c.text,
                sourceName: c.sourceName,
                pageNumber: c.pageNumber,
                similarity: c.similarity
            })),
            generatedAnswer: reply,
            latency: {
                retrieval: latencies.retrieval,
                reranking: latencies.reranking,
                llm: llmDuration,
                total: latencies.total + llmDuration
            },
            metrics: {
                retrievalRelevance: relevanceResult.score,
                faithfulness: faithfulnessResult.score,
                contextPrecision: relevanceResult.precision,
                contextRecall: recallResult.score,
                answerRelevance: answerRelevanceResult.score,
                success: isSuccess
            }
        });

        await run.save();

        res.status(201).json(run);
    } catch (err) {
        console.error("Evaluation run error:", err);
        res.status(500).json({ error: "Failed to execute RAG evaluation." });
    }
});

// 2. Compare Retrieval Strategies (Vector vs Hybrid vs Reranking) for the same query
router.post("/evaluation/compare", auth, async (req, res) => {
    const { question, groundTruthAnswer } = req.body;
    if (!question || question.trim().length === 0) {
        return res.status(400).json({ error: "Question is required." });
    }

    try {
        const userId = req.user.id;
        const strategies = ["vector", "hybrid", "rerank"];
        const runs = {};

        for (const strategy of strategies) {
            console.log(`[RAG-Evaluation] Evaluating strategy '${strategy}' for question: "${question}"`);

            // Retrieve context
            const relevantChunks = await searchRelevantChunks(question, userId, 0.4, 4, strategy);
            const latencies = relevantChunks.latencies || { retrieval: 0, reranking: 0, total: 0 };

            // Generate LLM answer
            const { reply, llmDuration } = await generateRAGAnswer(question, relevantChunks);

            // Run judge evaluations
            const relevanceResult = await evaluateRetrievalRelevance(question, relevantChunks);
            const faithfulnessResult = await evaluateFaithfulness(question, relevantChunks, reply);
            const answerRelevanceResult = await evaluateAnswerRelevance(question, reply);
            const recallResult = await evaluateContextRecall(question, relevantChunks, groundTruthAnswer);

            const isSuccess = relevanceResult.score >= 0.6 && faithfulnessResult.score >= 0.7;

            // Save individual run record
            const run = new EvaluationRun({
                userId,
                question,
                groundTruthAnswer: groundTruthAnswer || null,
                strategy,
                retrievedContext: relevantChunks.map(c => ({
                    text: c.text,
                    sourceName: c.sourceName,
                    pageNumber: c.pageNumber,
                    similarity: c.similarity
                })),
                generatedAnswer: reply,
                latency: {
                    retrieval: latencies.retrieval,
                    reranking: latencies.reranking,
                    llm: llmDuration,
                    total: latencies.total + llmDuration
                },
                metrics: {
                    retrievalRelevance: relevanceResult.score,
                    faithfulness: faithfulnessResult.score,
                    contextPrecision: relevanceResult.precision,
                    contextRecall: recallResult.score,
                    answerRelevance: answerRelevanceResult.score,
                    success: isSuccess
                }
            });

            await run.save();
            runs[strategy] = run;
        }

        res.status(200).json(runs);
    } catch (err) {
        console.error("Strategy comparison error:", err);
        res.status(500).json({ error: "Failed to compare RAG strategies." });
    }
});

// 3. Get User's Evaluation History
router.get("/evaluation/history", auth, async (req, res) => {
    try {
        const history = await EvaluationRun.find({ userId: req.user.id })
            .sort({ timestamp: -1 })
            .limit(50);
        res.json(history);
    } catch (err) {
        console.error("Fetch evaluation history error:", err);
        res.status(500).json({ error: "Failed to fetch evaluation history." });
    }
});

// 4. Get RAG Evaluation Statistics
router.get("/evaluation/stats", auth, async (req, res) => {
    try {
        const userId = req.user.id;
        const runs = await EvaluationRun.find({ userId });
        const totalDocs = await Document.countDocuments({ userId, status: "synced" });

        if (runs.length === 0) {
            return res.json({
                totalDocuments: totalDocs,
                questionsEvaluated: 0,
                avgRetrievalLatency: 0,
                avgRerankLatency: 0,
                avgLlmLatency: 0,
                avgTotalLatency: 0,
                avgRetrievalRelevance: 0,
                avgFaithfulness: 0,
                avgContextPrecision: 0,
                avgContextRecall: null,
                avgAnswerRelevance: 0,
                successRate: 0,
                byStrategy: {
                    vector: { count: 0, latency: 0, relevance: 0, faithfulness: 0 },
                    hybrid: { count: 0, latency: 0, relevance: 0, faithfulness: 0 },
                    rerank: { count: 0, latency: 0, relevance: 0, faithfulness: 0 }
                }
            });
        }

        // Initialize sum variables
        let totalRetrievalTime = 0;
        let totalRerankTime = 0;
        let totalLlmTime = 0;
        let totalDuration = 0;

        let totalRelevance = 0;
        let totalFaithfulness = 0;
        let totalPrecision = 0;
        let totalRecall = 0;
        let recallCount = 0;
        let totalAnsRelevance = 0;
        let successCount = 0;

        const strategyStats = {
            vector: { count: 0, latency: 0, relevance: 0, faithfulness: 0 },
            hybrid: { count: 0, latency: 0, relevance: 0, faithfulness: 0 },
            rerank: { count: 0, latency: 0, relevance: 0, faithfulness: 0 }
        };

        runs.forEach(r => {
            // Latencies
            totalRetrievalTime += r.latency.retrieval || 0;
            totalRerankTime += r.latency.reranking || 0;
            totalLlmTime += r.latency.llm || 0;
            totalDuration += r.latency.total || 0;

            // Metrics
            totalRelevance += r.metrics.retrievalRelevance || 0;
            totalFaithfulness += r.metrics.faithfulness || 0;
            totalPrecision += r.metrics.contextPrecision || 0;
            totalAnsRelevance += r.metrics.answerRelevance || 0;

            if (r.metrics.contextRecall !== null && r.metrics.contextRecall !== undefined) {
                totalRecall += r.metrics.contextRecall;
                recallCount++;
            }

            if (r.metrics.success) {
                successCount++;
            }

            // Strategy groupings
            const sName = r.strategy;
            if (strategyStats[sName]) {
                strategyStats[sName].count++;
                strategyStats[sName].latency += r.latency.total || 0;
                strategyStats[sName].relevance += r.metrics.retrievalRelevance || 0;
                strategyStats[sName].faithfulness += r.metrics.faithfulness || 0;
            }
        });

        const n = runs.length;

        // Calculate strategy averages
        Object.keys(strategyStats).forEach(key => {
            const stat = strategyStats[key];
            if (stat.count > 0) {
                stat.avgLatency = stat.latency / stat.count;
                stat.avgRelevance = stat.relevance / stat.count;
                stat.avgFaithfulness = stat.faithfulness / stat.count;
            } else {
                stat.avgLatency = 0;
                stat.avgRelevance = 0;
                stat.avgFaithfulness = 0;
            }
        });

        res.json({
            totalDocuments: totalDocs,
            questionsEvaluated: n,
            avgRetrievalLatency: totalRetrievalTime / n,
            avgRerankLatency: totalRerankTime / n,
            avgLlmLatency: totalLlmTime / n,
            avgTotalLatency: totalDuration / n,
            avgRetrievalRelevance: totalRelevance / n,
            avgFaithfulness: totalFaithfulness / n,
            avgContextPrecision: totalPrecision / n,
            avgContextRecall: recallCount > 0 ? totalRecall / recallCount : null,
            avgAnswerRelevance: totalAnsRelevance / n,
            successRate: (successCount / n) * 100,
            byStrategy: strategyStats
        });
    } catch (err) {
        console.error("Calculate evaluation statistics error:", err);
        res.status(500).json({ error: "Failed to compile RAG evaluation stats." });
    }
});

export default router;
