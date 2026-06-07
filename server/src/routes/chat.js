import { Router } from "express";
import { getReply } from "../services/claude.js";

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

export default router;
