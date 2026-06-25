import { Router } from "express";
import multer from "multer";
import { extractText } from "../services/pdf.js";
import { supabaseForToken } from "../services/supabase.js";
import { chunkText } from "../services/chunking.js";
import { embedTexts } from "../services/embeddings.js";

const router = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 },
  fileFilter(_req, file, cb) {
    if (file.mimetype === "application/pdf") {
      cb(null, true);
    } else {
      const err = new Error("Only PDF files are accepted.");
      err.code = "INVALID_MIME";
      cb(err, false);
    }
  },
});

function extractToken(req) {
  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith("Bearer ")) return null;
  return auth.slice(7);
}

router.post("/documents/ingest", upload.single("file"), async (req, res) => {
  const token = extractToken(req);
  if (!token) {
    return res.status(401).json({ error: "Authorization header required." });
  }

  if (!req.file) {
    return res.status(400).json({ error: "No file uploaded." });
  }

  const { documentId, workspaceId, name } = req.body;
  if (!documentId || !workspaceId || !name) {
    return res
      .status(400)
      .json({ error: "documentId, workspaceId, and name are required." });
  }

  const sb = supabaseForToken(token);

  const { data: { user }, error: userErr } = await sb.auth.getUser();
  if (userErr || !user) {
    return res.status(401).json({ error: "Invalid or expired token." });
  }

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders();

  let closed = false;
  req.on("close", () => { closed = true; });

  const emit = (obj) => {
    if (!closed) res.write(`data: ${JSON.stringify(obj)}\n\n`);
  };

  try {
    emit({ phase: "extracting" });
    console.log("[ingest] extracting text...");

    const { text } = await extractText(req.file.buffer);
    console.log("[ingest] extracted", text.length, "chars");
    const charCount = text.length;

    const { error: upsertErr } = await sb.from("documents").upsert(
      {
        id: documentId,
        workspace_id: workspaceId,
        user_id: user.id,
        name,
        char_count: charCount,
        text,
        ingest_status: "processing",
        chunk_count: 0,
      },
      { onConflict: "id" }
    );
    if (upsertErr) throw upsertErr;
    console.log("[ingest] doc row upserted");

    await sb
      .from("document_chunks")
      .delete()
      .eq("document_id", documentId);
    console.log("[ingest] old chunks cleared");

    const chunks = chunkText(text);
    console.log("[ingest] chunked into", chunks.length, "chunks");
    emit({ phase: "embedding", done: 0, total: chunks.length });

    const EMBED_BATCH = 20;
    let embedded = 0;

    for (let i = 0; i < chunks.length; i += EMBED_BATCH) {
      if (closed) break;

      const batch = chunks.slice(i, i + EMBED_BATCH);
      const embeddings = await embedTexts(batch);

      const rows = batch.map((content, j) => ({
        document_id: documentId,
        user_id: user.id,
        chunk_index: i + j,
        content,
        embedding: JSON.stringify(embeddings[j]),
      }));

      const { error: insertErr } = await sb
        .from("document_chunks")
        .insert(rows);
      if (insertErr) throw insertErr;

      embedded += batch.length;
      console.log("[ingest] embedded", embedded, "/", chunks.length);
      emit({ phase: "embedding", done: embedded, total: chunks.length });
    }

    const { error: statusErr } = await sb
      .from("documents")
      .update({ ingest_status: "ready", chunk_count: chunks.length })
      .eq("id", documentId);
    if (statusErr) throw statusErr;

    emit({
      phase: "done",
      documentId,
      charCount,
      chunkCount: chunks.length,
    });
    if (!closed) res.write("data: [DONE]\n\n");
  } catch (err) {
    console.error("Ingest error:", err.message);

    try {
      await sb
        .from("documents")
        .update({ ingest_status: "failed" })
        .eq("id", documentId);
    } catch (_) {}

    emit({ error: "Document ingestion failed. Please try again." });
  } finally {
    res.end();
  }
});

router.use((err, _req, res, _next) => {
  if (err.code === "LIMIT_FILE_SIZE") {
    return res.status(413).json({ error: "File exceeds the 50 MB limit." });
  }
  if (err.code === "INVALID_MIME") {
    return res.status(400).json({ error: err.message });
  }
  console.error("Documents upload error:", err);
  return res.status(500).json({ error: "Upload failed." });
});

export default router;
