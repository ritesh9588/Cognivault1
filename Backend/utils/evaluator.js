import getGeminiAPIResponse from "./gemini.js";

// Helper to parse JSON output from Gemini, handling markdown code fences
const parseJSON = (text) => {
    try {
        let clean = text.trim();
        // Remove markdown block backticks if present
        if (clean.startsWith("```")) {
            const lines = clean.split("\n");
            if (lines[0].startsWith("```")) {
                lines.shift();
            }
            if (lines[lines.length - 1].startsWith("```")) {
                lines.pop();
            }
            clean = lines.join("\n").trim();
        }
        return JSON.parse(clean);
    } catch (err) {
        console.error("JSON parsing failed on judge response:", err.message, "Response was:", text);
        // Try regex match for score/evaluations as fallback
        const scoreMatch = text.match(/"score"\s*:\s*(0?\.\d+|1\.0|1|0)/);
        if (scoreMatch) {
            return { score: parseFloat(scoreMatch[1]) };
        }
        throw err;
    }
};

/**
 * Evaluates the relevance of the retrieved context chunks to the query.
 * Also measures Context Precision.
 */
export const evaluateRetrievalRelevance = async (question, contexts) => {
    if (!contexts || contexts.length === 0) {
        return { score: 0, precision: 0, explanation: "No context retrieved." };
    }

    const contextStr = contexts.map((c, i) => `Chunk ${i + 1}: [Document: ${c.sourceName}]\n${c.text}`).join("\n\n");

    const prompt = `You are an expert AI evaluator.
Your task is to judge the relevance of the following retrieved context chunks to the user's question.
For each chunk, determine if it contains facts, context, or details that are useful or relevant to answering the question. Output 1 if relevant, 0 if not relevant.

Question: ${question}

Context Chunks:
${contextStr}

Respond with a JSON object of this format:
{
  "evaluations": [
    { "chunkIndex": 1, "relevant": 1, "explanation": "..." },
    { "chunkIndex": 2, "relevant": 0, "explanation": "..." }
  ]
}
Ensure you return ONLY valid JSON inside markdown block or raw JSON.`;

    try {
        const reply = await getGeminiAPIResponse(prompt);
        const parsed = parseJSON(reply);
        const evals = parsed.evaluations || [];
        
        let sum = 0;
        evals.forEach(e => sum += e.relevant);
        const avg = evals.length > 0 ? sum / evals.length : 0.0;
        
        return {
            score: avg,
            precision: avg,
            explanation: evals.map(e => `Chunk ${e.chunkIndex || e.chunkIndex === 0 ? e.chunkIndex + 1 : "?"}: ${e.relevant === 1 ? 'Relevant' : 'Irrelevant'} (${e.explanation})`).join(" | ")
        };
    } catch (err) {
        console.error("Retrieval relevance evaluation failed:", err);
        return { score: 0.5, precision: 0.5, explanation: "Retrieval evaluation failed (graceful fallback)." };
    }
};

/**
 * Evaluates the faithfulness (groundedness) of the answer with respect to the retrieved context.
 */
export const evaluateFaithfulness = async (question, contexts, answer) => {
    if (!contexts || contexts.length === 0) {
        return { score: 0, explanation: "No context retrieved to support the answer." };
    }

    const contextStr = contexts.map((c, i) => `Chunk ${i + 1}: ${c.text}`).join("\n\n");

    const prompt = `You are an expert AI evaluator.
Determine if the generated answer is faithful to (grounded in) the retrieved context.
Do not assume or use outside knowledge. Only check if the claims in the answer are supported by the context.

Question: ${question}

Context:
${contextStr}

Generated Answer:
${answer}

Provide a score from 0.0 to 1.0 (where 1.0 means all statements in the answer are completely supported by the context, and 0.0 means none are supported).

Respond with a JSON object of this format:
{
  "score": 0.85,
  "explanation": "..."
}
Ensure you return ONLY valid JSON.`;

    try {
        const reply = await getGeminiAPIResponse(prompt);
        const parsed = parseJSON(reply);
        return {
            score: parsed.score !== undefined ? parsed.score : 0.5,
            explanation: parsed.explanation || "No explanation provided."
        };
    } catch (err) {
        console.error("Faithfulness evaluation failed:", err);
        return { score: 0.5, explanation: "Faithfulness evaluation failed (graceful fallback)." };
    }
};

/**
 * Evaluates how relevant the generated answer is to the question.
 */
export const evaluateAnswerRelevance = async (question, answer) => {
    const prompt = `You are an expert AI evaluator.
Determine if the generated answer directly and effectively addresses the user's question.

Question: ${question}

Generated Answer:
${answer}

Provide a score from 0.0 to 1.0 (where 1.0 means the answer fully and directly answers the question, and 0.0 means it is completely off-topic or fails to answer the question).

Respond with a JSON object of this format:
{
  "score": 0.9,
  "explanation": "..."
}
Ensure you return ONLY valid JSON.`;

    try {
        const reply = await getGeminiAPIResponse(prompt);
        const parsed = parseJSON(reply);
        return {
            score: parsed.score !== undefined ? parsed.score : 0.5,
            explanation: parsed.explanation || "No explanation provided."
        };
    } catch (err) {
        console.error("Answer relevance evaluation failed:", err);
        return { score: 0.5, explanation: "Answer relevance evaluation failed (graceful fallback)." };
    }
};

/**
 * Evaluates Context Recall against a ground-truth answer.
 */
export const evaluateContextRecall = async (question, contexts, groundTruthAnswer) => {
    if (!groundTruthAnswer || groundTruthAnswer.trim().length === 0) {
        return { score: null, explanation: "Context Recall is not available because ground truth answer was not provided." };
    }
    if (!contexts || contexts.length === 0) {
        return { score: 0, explanation: "Context Recall is 0 because no contexts were retrieved." };
    }

    const contextStr = contexts.map((c, i) => `Chunk ${i + 1}: ${c.text}`).join("\n\n");

    const prompt = `You are an expert AI evaluator.
Determine if the retrieved context contains the necessary information to construct the ground-truth answer.

Question: ${question}

Retrieved Context:
${contextStr}

Ground Truth Answer:
${groundTruthAnswer}

Provide a score from 0.0 to 1.0 indicating how much of the key information in the ground-truth answer is present in the retrieved context (1.0 means all key information is present, 0.0 means none is present).

Respond with a JSON object of this format:
{
  "score": 0.75,
  "explanation": "..."
}
Ensure you return ONLY valid JSON.`;

    try {
        const reply = await getGeminiAPIResponse(prompt);
        const parsed = parseJSON(reply);
        return {
            score: parsed.score !== undefined ? parsed.score : null,
            explanation: parsed.explanation || "No explanation provided."
        };
    } catch (err) {
        console.error("Context recall evaluation failed:", err);
        return { score: null, explanation: "Context Recall evaluation failed (graceful fallback)." };
    }
};
