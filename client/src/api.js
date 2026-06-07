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
