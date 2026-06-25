import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const MODEL = process.env.CLAUDE_MODEL || "claude-sonnet-4-6";

function buildSystem(contextText) {
  if (contextText) {
    return [
      {
        type: "text",
        text: "You are a helpful study assistant. Answer questions based on the provided document context. Be clear, accurate, and educational.",
      },
      {
        type: "text",
        text: `Document context:\n\n${contextText}`,
        cache_control: { type: "ephemeral" },
      },
    ];
  }
  return "You are a helpful study assistant. No relevant document context was found. Answer carefully based on your knowledge, and ask the user to clarify if needed.";
}

/**
 * Send a conversation to Claude and return the assistant's reply text.
 * @param {{ messages: Array<{role: string, content: string}>, contextText: string|null }} params
 * @returns {Promise<string>}
 */
export async function getReply({ messages, contextText = null }) {
  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 2048,
    system: buildSystem(contextText),
    messages,
  });

  return response.content
    .filter((block) => block.type === "text")
    .map((block) => block.text)
    .join("");
}

/**
 * Stream a conversation turn from Claude, calling onToken for each text delta.
 * @param {{ messages: Array<{role: string, content: string}>, contextText: string|null, onToken: (t: string) => void }} params
 * @returns {Promise<void>}
 */
export async function streamReply({ messages, contextText = null, onToken }) {
  const stream = client.messages.stream({
    model: MODEL,
    max_tokens: 2048,
    system: buildSystem(contextText),
    messages,
  });

  for await (const event of stream) {
    if (
      event.type === "content_block_delta" &&
      event.delta?.type === "text_delta"
    ) {
      onToken(event.delta.text);
    }
  }

  await stream.finalMessage();
}
