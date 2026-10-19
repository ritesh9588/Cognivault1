import express from "express";
import auth from "../middleware/auth.js";
import Thread from "../models/Thread.js";
import Document from "../models/Document.js";
import ActivityLog from "../models/ActivityLog.js";

const router = express.Router();

router.get("/analytics", auth, async (req, res) => {
    try {
        const userId = req.user.id;

        // Fetch user data
        const threads = await Thread.find({ userId });
        const docs = await Document.find({ userId });
        const logs = await ActivityLog.find({ userId });

        // Calculate summary counters
        const totalConversations = threads.length;
        
        let totalMessages = 0;
        let ragQuestionsCount = 0;
        let normalChatCount = 0;
        
        const convsOverTime = {};
        const msgsOverTime = {};

        threads.forEach(t => {
            totalMessages += t.messages.length;
            
            // Group convs by date
            const cDateStr = new Date(t.createdAt).toISOString().split('T')[0];
            convsOverTime[cDateStr] = (convsOverTime[cDateStr] || 0) + 1;

            t.messages.forEach(m => {
                // Group messages by date
                const mDateStr = new Date(m.timestamp).toISOString().split('T')[0];
                msgsOverTime[mDateStr] = (msgsOverTime[mDateStr] || 0) + 1;

                if (m.role === "assistant") {
                    if (m.isRag) {
                        ragQuestionsCount++;
                    } else {
                        normalChatCount++;
                    }
                }
            });
        });

        const totalDocs = docs.length;
        const syncedDocs = docs.filter(d => d.status === "synced").length;

        // Group tool usage
        let toolRunsCount = 0;
        const toolUsageBreakdown = {
            "doc-summarizer": 0,
            "text-summarizer": 0,
            "code-explainer": 0,
            "info-extractor": 0
        };

        logs.forEach(l => {
            if (l.action === "tool_run") {
                toolRunsCount++;
                const toolName = l.metadata && l.metadata.toolName;
                if (toolName && toolUsageBreakdown[toolName] !== undefined) {
                    toolUsageBreakdown[toolName]++;
                }
            }
        });

        const totalGeminiCalls = logs.length; // Approximate using total actions logged

        // Build recent activity stream
        const activities = [];

        // Document upload activities
        docs.forEach(d => {
            activities.push({
                icon: "fa-file-pdf",
                desc: `Uploaded file: ${d.name}`,
                time: d.uploadDate
            });
        });

        // Thread creation activities
        threads.forEach(t => {
            activities.push({
                icon: "fa-comments",
                desc: `Created chat: "${t.title}"`,
                time: t.createdAt
            });
        });

        // Tools execution activities
        logs.forEach(l => {
            if (l.action === "tool_run") {
                const toolFriendlyName = {
                    "doc-summarizer": "Document Summarizer",
                    "text-summarizer": "Text Summarizer",
                    "code-explainer": "Code Explainer",
                    "info-extractor": "Structured Extractor"
                }[l.metadata.toolName] || "AI Tool";

                activities.push({
                    icon: "fa-bolt",
                    desc: `Executed tool: ${toolFriendlyName}`,
                    time: l.timestamp
                });
            }
        });

        // Sort activities by timestamp descending and take the last 8
        activities.sort((a, b) => new Date(b.time) - new Date(a.time));
        const recentActivity = activities.slice(0, 8);

        res.json({
            summary: {
                totalConversations,
                totalMessages,
                totalDocs,
                syncedDocs,
                ragQuestionsCount,
                toolRunsCount,
                totalGeminiCalls
            },
            charts: {
                convsOverTime,
                msgsOverTime,
                ragSplit: {
                    rag: ragQuestionsCount,
                    normal: normalChatCount
                },
                toolUsageBreakdown
            },
            recentActivity
        });
    } catch (err) {
        console.error("Analytics fetch error:", err);
        res.status(500).json({ error: "Failed to load analytics data." });
    }
});

export default router;
