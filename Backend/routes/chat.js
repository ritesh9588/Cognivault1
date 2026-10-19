import express from "express";
import Thread from "../models/Thread.js";
import getGeminiAPIResponse from "../utils/gemini.js";
import auth from "../middleware/auth.js";
import { searchRelevantChunks, cosineSimilarity } from "../utils/vectorSearch.js";
import { generateEmbedding } from "../utils/embeddings.js";
import ActivityLog from "../models/ActivityLog.js";

const router = express.Router();

// Helper to summarize oldest messages
const summarizeMessages = async (messages) => {
    try {
        const textToSummarize = messages.map(m => `${m.role === "user" ? "User" : "Assistant"}: ${m.content}`).join("\n");
        const prompt = `Summarize the following chat conversation history concisely, retaining all key facts, topics discussed, context, and user preferences:

${textToSummarize}

Summary:`;
        const summary = await getGeminiAPIResponse(prompt);
        return summary;
    } catch (err) {
        console.error("Summarization failed:", err);
        return "";
    }
};

const RAG_KEYWORDS = [
    "resume", "cv", "document", "file", "uploaded", "my doc", 
    "pdf", "docx", "txt", "knowledge base", "knowledgebase",
    "paper", "attachment", "upload", "my file", "contract", "invoice"
];

const checkIsRagIntent = async (queryText) => {
    const lower = queryText.toLowerCase();
    
    const hasRagKeyword = RAG_KEYWORDS.some(k => lower.includes(k));
    if (hasRagKeyword) {
        return true;
    }
    
    const prompt = `You are a query classifier. Determine if the user's query is asking about their uploaded files, documents, resume, or custom knowledge base (RAG).
Response must be valid JSON matching this schema:
{
  "isRag": boolean
}

Query: "${queryText}"

Response:`;
    try {
        const responseText = await getGeminiAPIResponse(prompt, { responseMimeType: "application/json" });
        const res = JSON.parse(responseText.trim());
        return !!res.isRag;
    } catch (e) {
        console.error("Failed to classify query intent via Gemini:", e);
        return false;
    }
};

// Search threads semantically and with keyword fallback
router.get("/thread/search", auth, async (req, res) => {
    const { q } = req.query;
    if (!q || q.trim().length === 0) {
        return res.json([]);
    }

    try {
        let queryVector = null;
        try {
            queryVector = await generateEmbedding(q);
        } catch (e) {
            console.error("Failed to generate query vector for thread search:", e);
        }

        const threads = await Thread.find({ userId: req.user.id });
        const matches = [];

        for (const thread of threads) {
            let bestSimilarity = -1;
            let bestSnippet = "";

            for (const msg of thread.messages) {
                if (queryVector && msg.embedding && msg.embedding.length > 0) {
                    const sim = cosineSimilarity(queryVector, msg.embedding);
                    if (sim > bestSimilarity) {
                        bestSimilarity = sim;
                        bestSnippet = msg.content;
                    }
                }
            }

            // Keyword fallback check
            const titleMatch = thread.title.toLowerCase().includes(q.toLowerCase());
            const hasKeywordMatch = titleMatch || thread.messages.some(m => m.content.toLowerCase().includes(q.toLowerCase()));

            if (bestSimilarity >= 0.45 || hasKeywordMatch) {
                if (!bestSnippet && thread.messages.length > 0) {
                    bestSnippet = thread.messages[thread.messages.length - 1].content;
                }
                matches.push({
                    threadId: thread.threadId,
                    title: thread.title,
                    snippet: bestSnippet,
                    updatedAt: thread.updatedAt,
                    similarity: bestSimilarity,
                    isSemantic: bestSimilarity >= 0.45
                });
            }
        }

        // Sort descending by similarity score
        matches.sort((a, b) => b.similarity - a.similarity);
        res.json(matches);
    } catch (err) {
        console.error("Search threads error:", err);
        res.status(500).json({ error: "Failed to search threads." });
    }
});

// Get all threads for the authenticated user
router.get("/thread", auth, async(req, res) => {
    try {
        const threads = await Thread.find({ userId: req.user.id }).sort({updatedAt: -1});
        res.json(threads);
    } catch(err) {
        console.log(err);
        res.status(500).json({error: "Failed to fetch threads"});
    }
});

// Get messages for a specific thread belonging to the authenticated user
router.get("/thread/:threadId", auth, async(req, res) => {
    const {threadId} = req.params;

    try {
        const thread = await Thread.findOne({ threadId, userId: req.user.id });

        if(!thread) {
            return res.status(404).json({error: "Thread not found"});
        }

        res.json(thread.messages);
    } catch(err) {
        console.log(err);
        res.status(500).json({error: "Failed to fetch chat"});
    }
});

// Delete a specific thread belonging to the authenticated user
router.delete("/thread/:threadId", auth, async (req, res) => {
    const {threadId} = req.params;

    try {
        const deletedThread = await Thread.findOneAndDelete({ threadId, userId: req.user.id });

        if(!deletedThread) {
            return res.status(404).json({error: "Thread not found"});
        }

        res.status(200).json({success : "Thread deleted successfully"});
    } catch(err) {
        console.log(err);
        res.status(500).json({error: "Failed to delete thread"});
    }
});

// Send a chat message within a thread belonging to the authenticated user
router.post("/chat", auth, async(req, res) => {
    const {threadId, message} = req.body;

    if(!threadId || !message) {
        return res.status(400).json({error: "missing required fields"});
    }

    try {
        let thread = await Thread.findOne({ threadId, userId: req.user.id });

        // Generate user message embedding
        let userEmbedding = [];
        try {
            userEmbedding = await generateEmbedding(message);
        } catch (e) {
            console.error("Failed to generate user message embedding:", e);
        }

        if(!thread) {
            //create a new thread in Db
            thread = new Thread({
                userId: req.user.id,
                threadId,
                title: message,
                messages: [{role: "user", content: message, embedding: userEmbedding}]
            });
        } else {
            thread.messages.push({role: "user", content: message, embedding: userEmbedding});
        }

        // 1. Handle summarization if history is getting long (active messages length > 8)
        if (thread.messages.length > 8) {
            const countToSummarize = thread.messages.length - 6;
            const toSummarize = thread.messages.slice(0, countToSummarize);
            
            const newSummary = await summarizeMessages(toSummarize);
            if (newSummary) {
                thread.summary = thread.summary 
                    ? `${thread.summary}\nAdditionally: ${newSummary}`
                    : newSummary;
            }
        }

        // 2. Perform RAG context search based on user's current message if it is a RAG query
        const isRagIntent = await checkIsRagIntent(message);
        let currentPrompt = message;
        let isRag = false;
        let sources = [];

        if (isRagIntent) {
            const relevantChunks = await searchRelevantChunks(message, req.user.id);
            if (relevantChunks.length > 0) {
                isRag = true;
                sources = Array.from(new Set(relevantChunks.map(c => 
                    c.pageNumber ? `${c.sourceName} — Page ${c.pageNumber}` : c.sourceName
                )));
                
                const contextStr = relevantChunks.map(c => `[Document: ${c.sourceName}]\n${c.text}`).join("\n\n");
                currentPrompt = `You are a helpful assistant. Use the following context from the user's uploaded documents to answer their question.
If the context does not contain enough information to answer the question, clearly state: "I cannot find the answer to this question in the uploaded documents." and do not attempt to invent or make up an answer.

Context:
${contextStr}

User Question: ${message}`;
            }
        }

        // 3. Construct conversation history payload for Gemini
        const contents = [];

        if (thread.summary) {
            contents.push({
                role: "user",
                parts: [{ text: `Here is a summary of the context from the earlier part of our conversation: ${thread.summary}` }]
            });
            contents.push({
                role: "model",
                parts: [{ text: "Understood. I will keep that context in mind." }]
            });
        }

        const pastMessages = thread.summary 
            ? thread.messages.slice(-7, -1) // Last 6 past messages
            : thread.messages.slice(0, -1);  // All past messages

        for (const msg of pastMessages) {
            contents.push({
                role: msg.role === "user" ? "user" : "model",
                parts: [{ text: msg.content }]
            });
        }

        contents.push({
            role: "user",
            parts: [{ text: currentPrompt }]
        });

        // 4. Request completion from Gemini API
        const assistantReply = await getGeminiAPIResponse(contents);

        if (assistantReply === undefined || assistantReply === null) {
            throw new Error("Assistant response was empty or undefined.");
        }

        // Generate assistant message embedding
        let assistantEmbedding = [];
        try {
            assistantEmbedding = await generateEmbedding(assistantReply);
        } catch (e) {
            console.error("Failed to generate assistant reply embedding:", e);
        }

        // 5. Save assistant reply and commit to DB
        thread.messages.push({
            role: "assistant", 
            content: assistantReply,
            isRag,
            sources,
            embedding: assistantEmbedding
        });
        thread.updatedAt = new Date();

        await thread.save();

        // Save activity log
        try {
            const log = new ActivityLog({
                userId: req.user.id,
                action: isRag ? "rag_question" : "gemini_call",
                metadata: {
                    threadId,
                    sources: isRag ? sources : []
                }
            });
            await log.save();
        } catch (logErr) {
            console.error("Failed to save activity log:", logErr);
        }

        res.json({
            success: true,
            message: {
                role: "assistant",
                content: assistantReply,
                isRag,
                sources
            }
        });
    } catch(err) {
        console.error("Error in /chat route:", err);
        res.status(500).json({
            success: false,
            error: err.message || "something went wrong"
        });
    }
});

export default router;