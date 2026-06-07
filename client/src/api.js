// All communication with the backend goes through this module.
// VITE_API_URL is the only env var the client needs — the API key never appears here.

const BASE = (import.meta.env.VITE_API_URL || "http://localhost:8787").replace(
  /\/+$/,
  ""
);

async function handleResponse(res) {
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(json.error || `Request failed (${res.status})`);
  }
  return json;
}

/**
 * Upload a PDF file to the backend for text extraction.
 * @param {File} file
 * @returns {Promise<{ filename: string, pages: number, charCount: number, text: string, truncated: boolean }>}
 */
export async function uploadPdf(file) {
  const body = new FormData();
  body.append("file", file);
  const res = await fetch(`${BASE}/api/upload`, { method: "POST", body });
  return handleResponse(res);
}

/**
 * Send a conversation turn to Claude.
 * @param {{ messages: Array<{role: string, content: string}>, documentText: string|null }} params
 * @returns {Promise<{ reply: string }>}
 */
export async function sendChat({ messages, documentText }) {
  const res = await fetch(`${BASE}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ messages, documentText: documentText ?? null }),
  });
  return handleResponse(res);
}

/**
 * Stream a conversation turn from Claude via SSE.
 * Calls onToken for each text delta; resolves when [DONE] is received.
 * @param {{ messages: Array<{role: string, content: string}>, documentText: string|null, onToken: (t: string) => void, signal?: AbortSignal }} params
 * @returns {Promise<void>}
 */
export async function streamChat({ messages, documentText, onToken, signal }) {
  const res = await fetch(`${BASE}/api/chat/stream`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ messages, documentText: documentText ?? null }),
    signal,
  });

  if (!res.ok) {
    const json = await res.json().catch(() => ({}));
    throw new Error(json.error || `Request failed (${res.status})`);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    // SSE events are separated by double newline; split and process complete lines
    const parts = buffer.split("\n\n");
    buffer = parts.pop(); // last element may be an incomplete event

    for (const part of parts) {
      for (const line of part.split("\n")) {
        if (!line.startsWith("data: ")) continue;
        const payload = line.slice(6).trim();
        if (payload === "[DONE]") return;
        try {
          const obj = JSON.parse(payload);
          if (obj.error) throw new Error(obj.error);
          if (typeof obj.token === "string") onToken(obj.token);
        } catch (parseErr) {
          if (parseErr.message !== payload) throw parseErr; // re-throw real errors
        }
      }
    }
  }
}
