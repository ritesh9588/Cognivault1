import mongoose from "mongoose";

const DocumentChunkSchema = new mongoose.Schema({
    documentId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Document",
        required: true
    },
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true
    },
    text: {
        type: String,
        required: true
    },
    pageNumber: {
        type: Number
    },
    embedding: {
        type: [Number],
        required: true
    },
    chunkIndex: {
        type: Number,
        required: true
    }
});

export default mongoose.model("DocumentChunk", DocumentChunkSchema);
