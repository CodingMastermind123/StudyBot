#!/usr/bin/env node

// Offline backfill: embed existing documents that have text but no chunks.
// Uses the service-role key (bypasses RLS) — never run in a request handler.
//
// Required env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, OPENAI_API_KEY
// Usage: node server/scripts/backfill-embeddings.js

import "dotenv/config";
import { supabaseAdmin } from "../src/services/supabase.js";
import { chunkText } from "../src/services/chunking.js";
import { embedTexts } from "../src/services/embeddings.js";

async function backfill() {
  const sb = supabaseAdmin();

  const { data: docs, error: fetchErr } = await sb
    .from("documents")
    .select("id, user_id, text, char_count, ingest_status, chunk_count")
    .or("ingest_status.neq.ready,chunk_count.eq.0")
    .not("text", "is", null)
    .neq("text", "");

  if (fetchErr) {
    console.error("Failed to fetch documents:", fetchErr.message);
    process.exit(1);
  }

  console.log(`Found ${docs.length} document(s) to backfill.\n`);

  for (const doc of docs) {
    console.log(`Processing: ${doc.id} (${doc.char_count || 0} chars)`);

    try {
      await sb
        .from("documents")
        .update({ ingest_status: "processing" })
        .eq("id", doc.id);

      const chunks = chunkText(doc.text);
      if (chunks.length === 0) {
        console.log(`  Skipped — no chunks produced (empty text?)\n`);
        await sb
          .from("documents")
          .update({ ingest_status: "failed", chunk_count: 0 })
          .eq("id", doc.id);
        continue;
      }

      await sb
        .from("document_chunks")
        .delete()
        .eq("document_id", doc.id);

      const BATCH = 96;
      let embedded = 0;

      for (let i = 0; i < chunks.length; i += BATCH) {
        const batch = chunks.slice(i, i + BATCH);
        const embeddings = await embedTexts(batch);

        const rows = batch.map((content, j) => ({
          document_id: doc.id,
          user_id: doc.user_id,
          chunk_index: i + j,
          content,
          embedding: JSON.stringify(embeddings[j]),
        }));

        const { error: insertErr } = await sb
          .from("document_chunks")
          .insert(rows);
        if (insertErr) throw insertErr;

        embedded += batch.length;
        console.log(`  Embedded ${embedded}/${chunks.length} chunks`);
      }

      await sb
        .from("documents")
        .update({ ingest_status: "ready", chunk_count: chunks.length })
        .eq("id", doc.id);

      console.log(`  Done — ${chunks.length} chunks stored.\n`);
    } catch (err) {
      console.error(`  Failed: ${err.message}\n`);
      await sb
        .from("documents")
        .update({ ingest_status: "failed" })
        .eq("id", doc.id)
        .catch(() => {});
    }
  }

  console.log("Backfill complete.");
}

backfill().catch((err) => {
  console.error("Backfill failed:", err);
  process.exit(1);
});
