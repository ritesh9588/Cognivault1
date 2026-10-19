import mongoose from "mongoose";

const EvaluationRunSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true
    },
    question: {
        type: String,
        required: true
    },
    groundTruthAnswer: {
        type: String
    },
    strategy: {
        type: String,
        enum: ["vector", "hybrid", "rerank"],
        required: true
    },
    retrievedContext: [{
        text: String,
        sourceName: String,
        pageNumber: Number,
        similarity: Number
    }],
    generatedAnswer: {
        type: String,
        required: true
    },
    latency: {
        retrieval: Number,
        reranking: Number,
        llm: Number,
        total: Number
    },
    metrics: {
        retrievalRelevance: Number,
        faithfulness: Number,
        contextPrecision: Number,
        contextRecall: Number, // null or not available if groundTruth is not supplied
        answerRelevance: Number,
        success: Boolean
    },
    timestamp: {
        type: Date,
        default: Date.now
    }
});

export default mongoose.model("EvaluationRun", EvaluationRunSchema);
