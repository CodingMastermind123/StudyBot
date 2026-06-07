import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// Model is configurable via CLAUDE_MODEL env var.
// Default value below should be verified/updated to a current Sonnet model before deployment.
const MODEL = process.env.CLAUDE_MODEL || "claude-sonnet-4-20250514";

/**
 * Send a conversation to Claude and return the assistant's reply text.
 * @param {{ messages: Array<{role: string, content: string}>, documentText: string|null }} params
 * @returns {Promise<string>}
 */
export async function getReply({ messages, documentText }) {
  // Build system prompt blocks. When a document is present, place it in a
  // cache_control block so it is prompt-cached across turns — the doc is
  // resent every message so caching cuts cost and latency significantly.
  const system = documentText
    ? [
        {
          type: "text",
          text: "You are a helpful study assistant. Answer questions based on the provided document. Be clear, accurate, and educational.",
        },
        {
          type: "text",
          text: `Document content:\n\n${documentText}`,
          cache_control: { type: "ephemeral" },
        },
      ]
    : "You are a helpful study assistant. No document has been loaded yet. Answer general study questions helpfully.";

  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 2048,
    system,
    messages,
  });

  // content is an array of blocks — collect all text blocks into one string
  return response.content
    .filter((block) => block.type === "text")
    .map((block) => block.text)
    .join("");
}
