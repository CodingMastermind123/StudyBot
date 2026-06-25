# StudyBot Roadmap

## v1
- [x] Workspace-based organization (multiple classes/subjects)
- [x] PDF upload and text extraction
- [x] AI chat powered by Claude API
- [x] Study tool shortcuts (Summarize, Notes, Diagram, Practice Problems)
- [x] Mermaid diagram rendering
- [x] Session history per workspace
- [x] Dynamic workspace accent colors

## v2a — Auth + Cloud Storage
- [x] User accounts with email/password and Google OAuth (Supabase Auth)
- [x] All data (workspaces, documents, chats, messages) stored in Supabase Postgres
- [x] Row Level Security for per-user data isolation
- [x] Optimistic UI with async persistence (feels instant like localStorage)
- [x] Session persistence across devices and browsers
- [x] Replaced localStorage entirely
- **Migration note:** No automated localStorage → Supabase backfill was implemented; existing local-only data is not migrated (start-fresh). Realistically only the developer had local data. A one-time import could be added later if needed.

## v2b — RAG Pipeline (Current)
Replaces the truncated-document approach with a full Retrieval-Augmented
Generation pipeline:
- [x] Upload entire textbooks (500+ pages) — no truncation
- [x] Server-side ingestion: extract → chunk (~3000 chars) → embed (OpenAI `text-embedding-3-small`) → store in Supabase pgvector
- [x] SSE progress UI during ingestion (extracting → embedding done/total → ready)
- [x] Top-k retrieval for chat: embed the question, vector-search the most relevant chunks via HNSW index
- [x] Broad retrieval for study tools (Summarize, Notes, Diagram, Practice): retrieves full document context so whole-document operations work correctly
- [x] Fallback to stored document text for un-ingested documents
- [x] Offline backfill script for pre-existing documents
- [x] JWT-forwarded Supabase access with RLS on `document_chunks` (parent-ownership checks)
- [x] Idempotent re-ingestion (re-upload replaces chunks cleanly)
- **Stack:** Express + OpenAI `text-embedding-3-small` + Supabase pgvector (HNSW)

## v3 — PDF Preview Panel
- Split-pane layout: chat on the left, live PDF preview on the right
- Ask Claude to "go to chapter 5" and the preview navigates there
- Powered by react-pdf
- Page sync between chat references and preview position
