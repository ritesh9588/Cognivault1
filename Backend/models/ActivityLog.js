import mongoose from "mongoose";

const ActivityLogSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true
    },
    action: {
        type: String, // 'tool_run' | 'rag_question' | 'gemini_call'
        required: true
    },
    metadata: {
        type: mongoose.Schema.Types.Mixed, // e.g. { toolName: "code-explainer", tokens: 100 }
        default: {}
    },
    timestamp: {
        type: Date,
        default: Date.now
    }
});

export default mongoose.model("ActivityLog", ActivityLogSchema);
