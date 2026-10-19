import express from "express";
import auth from "../middleware/auth.js";
import Document from "../models/Document.js";
import DocumentChunk from "../models/DocumentChunk.js";
import getGeminiAPIResponse from "../utils/gemini.js";
import ActivityLog from "../models/ActivityLog.js";

const router = express.Router();

// 1. Document Summarizer
router.post("/tools/summarize-doc", auth, async (req, res) => {
    const { documentId } = req.body;
    if (!documentId) {
        return res.status(400).json({ error: "Missing documentId." });
    }

    try {
        const doc = await Document.findOne({ _id: documentId, userId: req.user.id });
        if (!doc) {
            return res.status(404).json({ error: "Document not found or access denied." });
        }

        const chunks = await DocumentChunk.find({ documentId: doc._id }).sort({ chunkIndex: 1 });
        if (chunks.length === 0) {
            return res.status(400).json({ error: "No text chunks found for this document." });
        }

        const fullText = chunks.map(c => c.text).join("\n");
        const prompt = `Summarize the following document concisely and outline its key points, takeaways, and topics. Document Name: ${doc.name}.
Text:
${fullText}`;

        const summary = await getGeminiAPIResponse(prompt);

        try {
            const log = new ActivityLog({
                userId: req.user.id,
                action: "tool_run",
                metadata: { toolName: "doc-summarizer", documentId }
            });
            await log.save();
        } catch (logErr) {
            console.error("Failed to log doc summary:", logErr);
        }

        res.json({ summary });
    } catch (err) {
        console.error("Document summary error:", err);
        res.status(500).json({ error: "Failed to summarize document." });
    }
});

// 2. Text Summarizer
router.post("/tools/summarize-text", auth, async (req, res) => {
    const { text } = req.body;
    if (!text || text.trim().length === 0) {
        return res.status(400).json({ error: "Missing text content." });
    }

    try {
        const prompt = `Summarize the following text concisely, retaining key facts and outlining major takeaways:
${text}`;

        const summary = await getGeminiAPIResponse(prompt);

        try {
            const log = new ActivityLog({
                userId: req.user.id,
                action: "tool_run",
                metadata: { toolName: "text-summarizer" }
            });
            await log.save();
        } catch (logErr) {
            console.error("Failed to log text summary:", logErr);
        }

        res.json({ summary });
    } catch (err) {
        console.error("Text summary error:", err);
        res.status(500).json({ error: "Failed to summarize text." });
    }
});

// 3. Code Explainer
router.post("/tools/code-explainer", auth, async (req, res) => {
    const { code, language } = req.body;
    if (!code || code.trim().length === 0) {
        return res.status(400).json({ error: "Missing code input." });
    }

    try {
        const prompt = `Analyze and explain the following ${language || 'programming'} code snippet. Identify any potential bugs, performance issues, or architectural flaws, and suggest concrete code improvements.
Return the output strictly as a JSON object matching this schema:
{
  "explanation": "Markdown string explaining how the code works and its overall design.",
  "issues": ["List of identified bugs, bottlenecks, or style issues"],
  "improvements": ["List of suggestions to optimize, secure, or simplify the code"]
}

Code:
${code}`;

        const responseText = await getGeminiAPIResponse(prompt, { responseMimeType: "application/json" });
        const result = JSON.parse(responseText);

        try {
            const log = new ActivityLog({
                userId: req.user.id,
                action: "tool_run",
                metadata: { toolName: "code-explainer", language }
            });
            await log.save();
        } catch (logErr) {
            console.error("Failed to log code explainer:", logErr);
        }

        res.json(result);
    } catch (err) {
        console.error("Code explainer error:", err);
        res.status(500).json({ error: "Failed to analyze code." });
    }
});

// 4. Structured Information Extractor
router.post("/tools/extract-info", auth, async (req, res) => {
    const { text, schemaDescription } = req.body;
    if (!text || !schemaDescription) {
        return res.status(400).json({ error: "Missing text or schema description." });
    }

    try {
        const prompt = `Extract structured data from the following text based on this description/instructions: "${schemaDescription}".
Return the output strictly as a JSON object or JSON array containing the extracted structured information.

Text:
${text}`;

        const responseText = await getGeminiAPIResponse(prompt, { responseMimeType: "application/json" });
        const result = JSON.parse(responseText);

        try {
            const log = new ActivityLog({
                userId: req.user.id,
                action: "tool_run",
                metadata: { toolName: "info-extractor", schemaDescription }
            });
            await log.save();
        } catch (logErr) {
            console.error("Failed to log info extraction:", logErr);
        }

        res.json({ extractedData: result });
    } catch (err) {
        console.error("Information extraction error:", err);
        res.status(500).json({ error: "Failed to extract information." });
    }
});

export default router;
