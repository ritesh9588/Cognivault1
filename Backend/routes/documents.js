import express from "express";
import multer from "multer";
import mammoth from "mammoth";
import { createRequire } from "module";
const require = createRequire(import.meta.url);
const pdfParse = require("pdf-parse");
import auth from "../middleware/auth.js";
import Document from "../models/Document.js";
import DocumentChunk from "../models/DocumentChunk.js";
import { generateEmbedding } from "../utils/embeddings.js";

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

// Helper to chunk text
const chunkText = (text, maxLength = 1000, overlap = 200) => {
    const chunks = [];
    let start = 0;
    while (start < text.length) {
        let end = start + maxLength;
        chunks.push(text.slice(start, end));
        start += (maxLength - overlap);
    }
    return chunks;
};

// GET all documents
router.get("/documents", auth, async (req, res) => {
    try {
        const documents = await Document.find({ userId: req.user.id }).sort({ uploadDate: -1 });
        res.json(documents);
    } catch (err) {
        console.error("Fetch documents error:", err);
        res.status(500).json({ error: "Failed to fetch documents." });
    }
});

// DELETE a document and its chunks
router.delete("/documents/:id", auth, async (req, res) => {
    try {
        const doc = await Document.findOne({ _id: req.params.id, userId: req.user.id });
        if (!doc) {
            return res.status(404).json({ error: "Document not found." });
        }

        // Delete associated chunks
        await DocumentChunk.deleteMany({ documentId: doc._id, userId: req.user.id });

        // Delete document meta
        await Document.deleteOne({ _id: doc._id });

        res.json({ success: "Document deleted successfully." });
    } catch (err) {
        console.error("Delete document error:", err);
        res.status(500).json({ error: "Failed to delete document." });
    }
});

// POST upload and process document
router.post("/documents/upload", auth, upload.single("file"), async (req, res) => {
    if (!req.file) {
        return res.status(400).json({ error: "No file uploaded." });
    }

    const { originalname, buffer, size, mimetype } = req.file;

    if (size > 5 * 1024 * 1024) {
        return res.status(400).json({ error: "File exceeds maximum size limit of 5MB." });
    }
    const isPDF = originalname.endsWith(".pdf") || mimetype === "application/pdf";
    const isDocx = originalname.endsWith(".docx") || mimetype === "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

    if (!isPDF && !isDocx) {
        return res.status(400).json({ error: "Only PDF and DOCX files are allowed." });
    }

    try {
        // Create document entry with processing status
        const doc = new Document({
            userId: req.user.id,
            name: originalname,
            type: isPDF ? "PDF" : "DOCX",
            fileSize: size,
            status: "processing"
        });

        await doc.save();

        // Run extraction and embedding generation asynchronously
        processDocumentInBackground(doc, buffer, isPDF, req.user.id);

        // Return processing document immediately
        res.status(201).json(doc);
    } catch (err) {
        console.error("Upload route error:", err);
        res.status(500).json({ error: "Failed to upload document." });
    }
});

// Asynchronous worker function
const processDocumentInBackground = async (doc, buffer, isPDF, userId) => {
    try {
        let text = "";

        const chunksWithMeta = [];

        if (isPDF) {
            const uint8Array = new Uint8Array(buffer);
            const parser = new pdfParse.PDFParse(uint8Array);
            const result = await parser.getText();
            
            if (!result.pages || result.pages.length === 0) {
                throw new Error("No pages found in PDF.");
            }

            for (const page of result.pages) {
                const pageChunks = chunkText(page.text);
                for (const chunkStr of pageChunks) {
                    chunksWithMeta.push({
                        text: chunkStr,
                        pageNumber: page.num
                    });
                }
            }
        } else {
            const result = await mammoth.extractRawText({ buffer });
            const docxChunks = chunkText(result.value);
            for (const chunkStr of docxChunks) {
                chunksWithMeta.push({
                    text: chunkStr,
                    pageNumber: null
                });
            }
        }

        if (chunksWithMeta.length === 0) {
            throw new Error("No text content could be extracted.");
        }

        // Loop and generate embeddings
        for (let i = 0; i < chunksWithMeta.length; i++) {
            const item = chunksWithMeta[i];
            const chunkStr = item.text.trim();
            if (chunkStr.length === 0) continue;

            const embedding = await generateEmbedding(chunkStr);

            const docChunk = new DocumentChunk({
                documentId: doc._id,
                userId,
                text: chunkStr,
                pageNumber: item.pageNumber,
                embedding,
                chunkIndex: i
            });

            await docChunk.save();
        }

        // Set status to synced
        doc.status = "synced";
        await doc.save();
    } catch (err) {
        console.error(`Error processing document ${doc.name}:`, err);
        doc.status = "failed";
        await doc.save();
    }
};

export default router;
