// All communication with the backend goes through this module.
// VITE_API_URL is the only env var the client needs — the API key never appears here.

import { supabase } from "./lib/supabase.js";

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

async function authHeader() {
  const { data } = await supabase.auth.getSession();
  return data.session
    ? { Authorization: `Bearer ${data.session.access_token}` }
    : {};
}

function parseSSE(res, onEvent) {
  return new Promise(async (resolve, reject) => {
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const parts = buffer.split("\n\n");
      buffer = parts.pop();

      for (const part of parts) {
        for (const line of part.split("\n")) {
          if (!line.startsWith("data: ")) continue;
          const payload = line.slice(6).trim();
          if (payload === "[DONE]") {
            resolve();
            return;
          }
          try {
            const obj = JSON.parse(payload);
            if (obj.error) {
              reject(new Error(obj.error));
              return;
            }
            onEvent(obj);
          } catch (parseErr) {
            if (parseErr.message !== payload) {
              reject(parseErr);
              return;
            }
          }
        }
      }
    }
    resolve();
  });
}

/**
 * Upload a PDF file to the backend for text extraction (legacy path).
 */
export async function uploadPdf(file) {
  const body = new FormData();
  body.append("file", file);
  const res = await fetch(`${BASE}/api/upload`, { method: "POST", body });
  return handleResponse(res);
}

/**
 * Ingest a document: upload PDF, extract text, chunk, embed, store.
 * Streams SSE progress events and calls onProgress for each.
 * Resolves with the final "done" event payload.
 */
export async function ingestDocument({ file, documentId, workspaceId, name, onProgress }) {
  const auth = await authHeader();
  const body = new FormData();
  body.append("file", file);
  body.append("documentId", documentId);
  body.append("workspaceId", workspaceId);
  body.append("name", name);

  const res = await fetch(`${BASE}/api/documents/ingest`, {
    method: "POST",
    headers: { ...auth },
    body,
  });

  if (!res.ok) {
    const json = await res.json().catch(() => ({}));
    throw new Error(json.error || `Ingestion failed (${res.status})`);
  }

  let result = null;
  await parseSSE(res, (event) => {
    if (event.phase === "done") result = event;
    if (onProgress) onProgress(event);
  });

  return result;
}

/**
 * Send a conversation turn to Claude.
 */
export async function sendChat({ messages, documentId, retrieval }) {
  const auth = await authHeader();
  const res = await fetch(`${BASE}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...auth },
    body: JSON.stringify({ messages, documentId: documentId ?? null, retrieval }),
  });
  return handleResponse(res);
}

/**
 * Stream a conversation turn from Claude via SSE.
 * Calls onToken for each text delta; resolves when [DONE] is received.
 */
export async function streamChat({ messages, documentId, retrieval, onToken, signal }) {
  const auth = await authHeader();
  const res = await fetch(`${BASE}/api/chat/stream`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...auth },
    body: JSON.stringify({ messages, documentId: documentId ?? null, retrieval }),
    signal,
  });

  if (!res.ok) {
    const json = await res.json().catch(() => ({}));
    throw new Error(json.error || `Request failed (${res.status})`);
  }

  await parseSSE(res, (obj) => {
    if (typeof obj.token === "string") onToken(obj.token);
  });
}
