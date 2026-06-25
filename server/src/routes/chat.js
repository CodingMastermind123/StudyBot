import { Router } from "express";
import { getReply, streamReply } from "../services/claude.js";
import { supabaseForToken } from "../services/supabase.js";
import { retrieveContext } from "../services/retrieval.js";

const router = Router();

function validateMessages(messages) {
  return (
    Array.isArray(messages) &&
    messages.length > 0 &&
    messages.every(
      (m) =>
        (m.role === "user" || m.role === "assistant") &&
        typeof m.content === "string"
    )
  );
}

function extractToken(req) {
  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith("Bearer ")) return null;
  return auth.slice(7);
}

async function getContextText(req) {
  const { documentId, retrieval = "topk" } = req.body;
  if (!documentId) return null;

  const token = extractToken(req);
  if (!token) {
    const err = new Error("Authorization required when documentId is provided.");
    err.statusCode = 401;
    throw err;
  }

  const sb = supabaseForToken(token);
  const lastUserMsg = [...req.body.messages].reverse().find((m) => m.role === "user");
  const query = lastUserMsg?.content || "";

  const { contextText } = await retrieveContext({
    sb,
    documentId,
    query,
    mode: retrieval,
  });

  return contextText;
}

router.post("/chat", async (req, res) => {
  const { messages } = req.body;

  if (!validateMessages(messages)) {
    return res.status(400).json({
      error:
        "messages must be a non-empty array of { role: 'user'|'assistant', content: string }.",
    });
  }

  try {
    const contextText = await getContextText(req);
    const reply = await getReply({ messages, contextText });
    return res.json({ reply });
  } catch (err) {
    if (err.statusCode === 401) {
      return res.status(401).json({ error: err.message });
    }
    console.error("Claude API error:", err.message);
    return res.status(502).json({
      error: "Failed to get a response from the AI service. Please try again.",
    });
  }
});

router.post("/chat/stream", async (req, res) => {
  const { messages } = req.body;

  if (!validateMessages(messages)) {
    return res.status(400).json({
      error:
        "messages must be a non-empty array of { role: 'user'|'assistant', content: string }.",
    });
  }

  let contextText;
  try {
    contextText = await getContextText(req);
  } catch (err) {
    if (err.statusCode === 401) {
      return res.status(401).json({ error: err.message });
    }
    console.error("Retrieval error:", err.message);
    contextText = null;
  }

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders();

  let closed = false;
  req.on("close", () => { closed = true; });

  try {
    await streamReply({
      messages,
      contextText,
      onToken: (token) => {
        if (!closed) res.write(`data: ${JSON.stringify({ token })}\n\n`);
      },
    });
    if (!closed) res.write("data: [DONE]\n\n");
  } catch (err) {
    console.error("Claude streaming error:", err.message);
    if (!closed) {
      res.write(
        `data: ${JSON.stringify({ error: "Failed to get a response from the AI service." })}\n\n`
      );
    }
  } finally {
    res.end();
  }
});

export default router;
