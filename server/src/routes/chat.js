import { Router } from "express";
import { getReply, streamReply } from "../services/claude.js";

const router = Router();

router.post("/chat", async (req, res) => {
  const { messages, documentText } = req.body;

  if (
    !Array.isArray(messages) ||
    messages.length === 0 ||
    !messages.every(
      (m) =>
        (m.role === "user" || m.role === "assistant") &&
        typeof m.content === "string"
    )
  ) {
    return res.status(400).json({
      error:
        "messages must be a non-empty array of { role: 'user'|'assistant', content: string }.",
    });
  }

  try {
    const reply = await getReply({
      messages,
      documentText: documentText || null,
    });
    return res.json({ reply });
  } catch (err) {
    // Never leak the API key or a raw stack trace to the client
    console.error("Claude API error:", err.message);
    return res.status(502).json({
      error: "Failed to get a response from the AI service. Please try again.",
    });
  }
});

// ── Streaming endpoint ────────────────────────────────────────────────────────
// Validates the same body shape as /chat, then streams SSE tokens.
// Events: `data: {"token":"..."}` per delta, `data: [DONE]` on completion,
// `data: {"error":"..."}` on failure (followed by connection close).
router.post("/chat/stream", async (req, res) => {
  const { messages, documentText } = req.body;

  if (
    !Array.isArray(messages) ||
    messages.length === 0 ||
    !messages.every(
      (m) =>
        (m.role === "user" || m.role === "assistant") &&
        typeof m.content === "string"
    )
  ) {
    return res.status(400).json({
      error:
        "messages must be a non-empty array of { role: 'user'|'assistant', content: string }.",
    });
  }

  // Set SSE headers before writing anything
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders();

  // If the client disconnects mid-stream, abort gracefully
  let closed = false;
  req.on("close", () => { closed = true; });

  try {
    await streamReply({
      messages,
      documentText: documentText || null,
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
