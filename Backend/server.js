import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import dns from "dns";

dns.setServers(["8.8.8.8", "1.1.1.1"]);

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, ".env"), override: true });
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import mongoose from "mongoose";
import chatRoutes from "./routes/chat.js";
import authRoutes from "./routes/auth.js";
import documentRoutes from "./routes/documents.js";
import toolRoutes from "./routes/tools.js";
import analyticsRoutes from "./routes/analytics.js";
import evaluationRoutes from "./routes/evaluation.js";

const app = express();
const PORT = 8080;

// Security: Helmet headers
app.use(helmet());

// Security: Configurable CORS
const corsOptions = {
    origin: process.env.CORS_ORIGIN || "http://localhost:5173",
    optionsSuccessStatus: 200
};
app.use(cors(corsOptions));

app.use(express.json());

// Request logger middleware (no secrets)
app.use((req, res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.originalUrl}`);
    next();
});

// Rate limiting
const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 30,
    message: { error: "Too many authentication requests, please try again after 15 minutes." }
});

const generalLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 200,
    message: { error: "Too many API requests, please try again later." }
});

app.use("/api/auth", authLimiter, authRoutes);
app.use("/api", generalLimiter, chatRoutes);
app.use("/api", generalLimiter, documentRoutes);
app.use("/api", generalLimiter, toolRoutes);
app.use("/api", generalLimiter, analyticsRoutes);
app.use("/api", generalLimiter, evaluationRoutes);

// Centralized error handler
app.use((err, req, res, next) => {
    console.error("Unhandled Error Stack:", err.stack);
    res.status(500).json({ error: "A server error occurred. Please try again later." });
});

app.listen(PORT, () => {
    console.log(`server running on ${PORT}`);
    connectDB();
});

const connectDB = async() => {
    try {
        await mongoose.connect(process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/Cognivault");
        console.log("Connected with Database!");
    } catch(err) {
        console.log("Failed to connect with primary DB:", err.message);
        if (process.env.MONGODB_URI !== "mongodb://127.0.0.1:27017/Cognivault") {
            try {
                console.log("Attempting fallback to local MongoDB (mongodb://127.0.0.1:27017/Cognivault)...");
                await mongoose.connect("mongodb://127.0.0.1:27017/Cognivault");
                console.log("Connected with Database (local fallback)!");
            } catch (fallbackErr) {
                console.log("Failed to connect with local fallback DB:", fallbackErr.message);
            }
        }
    }
}

