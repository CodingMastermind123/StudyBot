import { embedQuery } from "./embeddings.js";

const TOP_K = parseInt(process.env.RAG_TOP_K, 10) || 8;
const BROAD_CHAR_BUDGET =
  parseInt(process.env.RAG_BROAD_CHAR_BUDGET, 10) || 480000;

export async function retrieveContext({ sb, documentId, query, mode = "topk", topK = TOP_K, charBudget = BROAD_CHAR_BUDGET }) {
  if (mode === "broad") {
    return broadRetrieval({ sb, documentId, charBudget });
  }
  return topkRetrieval({ sb, documentId, query, topK });
}

async function topkRetrieval({ sb, documentId, query, topK }) {
  const queryEmbedding = await embedQuery(query);

  const { data: chunks, error } = await sb.rpc("match_document_chunks", {
    p_document_id: documentId,
    p_query_embedding: JSON.stringify(queryEmbedding),
    p_match_count: topK,
  });

  if (error) throw error;

  if (!chunks || chunks.length === 0) {
    return fallback({ sb, documentId });
  }

  const contextText = chunks
    .map((c) => `[Chunk ${c.chunk_index}]\n${c.content}`)
    .join("\n\n---\n\n");

  return { contextText, chunkCount: chunks.length };
}

async function broadRetrieval({ sb, documentId, charBudget }) {
  const { data: allChunks, error } = await sb
    .from("document_chunks")
    .select("chunk_index, content")
    .eq("document_id", documentId)
    .order("chunk_index", { ascending: true });

  if (error) throw error;

  if (!allChunks || allChunks.length === 0) {
    return fallback({ sb, documentId });
  }

  const totalChars = allChunks.reduce((sum, c) => sum + c.content.length, 0);

  if (totalChars <= charBudget) {
    const contextText = allChunks.map((c) => c.content).join("\n\n");
    return { contextText, chunkCount: allChunks.length, sampled: false };
  }

  const stride = Math.ceil(allChunks.length / Math.floor(charBudget / (totalChars / allChunks.length)));
  const sampled = [];
  let chars = 0;

  for (let i = 0; i < allChunks.length && chars < charBudget; i += stride) {
    sampled.push(allChunks[i]);
    chars += allChunks[i].content.length;
  }

  const contextText =
    sampled.map((c) => c.content).join("\n\n") +
    "\n\n[Note: This is a representative sample spanning the full document. Some sections were omitted for length.]";

  return { contextText, chunkCount: sampled.length, sampled: true };
}

async function fallback({ sb, documentId }) {
  const { data: doc, error } = await sb
    .from("documents")
    .select("text, char_count")
    .eq("id", documentId)
    .single();

  if (error || !doc || !doc.text) {
    return { contextText: null };
  }

  const budgeted = doc.text.length > BROAD_CHAR_BUDGET
    ? doc.text.slice(0, BROAD_CHAR_BUDGET) + "\n\n[Document truncated for length]"
    : doc.text;

  return { contextText: budgeted, chunkCount: 0 };
}
