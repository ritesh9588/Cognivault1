import mongoose from "mongoose";

const DocumentSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true
    },
    name: {
        type: String,
        required: true
    },
    type: {
        type: String,
        required: true
    },
    fileSize: {
        type: Number,
        required: true
    },
    status: {
        type: String,
        enum: ["processing", "synced", "failed"],
        default: "processing"
    },
    uploadDate: {
        type: Date,
        default: Date.now
    }
});

export default mongoose.model("Document", DocumentSchema);
