import express from "express";
import cors from "cors";

const app = express();

// Parse allowed origins from comma-separated env var; fall back to localhost dev
const allowedOrigins = (process.env.ALLOWED_ORIGIN || "http://localhost:5173")
  .split(",")
  .map((o) => o.trim());

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (e.g. curl, Postman) in dev
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error(`CORS: origin ${origin} not allowed`));
      }
    },
    methods: ["GET", "POST"],
  })
);

app.use(express.json({ limit: "1mb" }));

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok" });
});

import uploadRouter from "./routes/upload.js";
app.use("/api", uploadRouter);

import chatRouter from "./routes/chat.js";
app.use("/api", chatRouter);

import documentsRouter from "./routes/documents.js";
app.use("/api", documentsRouter);

export default app;
