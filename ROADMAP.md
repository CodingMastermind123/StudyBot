# StudyBot Roadmap

## v1
- [x] Workspace-based organization (multiple classes/subjects)
- [x] PDF upload and text extraction
- [x] AI chat powered by Claude API
- [x] Study tool shortcuts (Summarize, Notes, Diagram, Practice Problems)
- [x] Mermaid diagram rendering
- [x] Session history per workspace
- [x] Dynamic workspace accent colors

## v2a — Auth + Cloud Storage (Current)
- [x] User accounts with email/password and Google OAuth (Supabase Auth)
- [x] All data (workspaces, documents, chats, messages) stored in Supabase Postgres
- [x] Row Level Security for per-user data isolation
- [x] Optimistic UI with async persistence (feels instant like localStorage)
- [x] Session persistence across devices and browsers
- [x] Replaced localStorage entirely
- **Migration note:** No automated localStorage → Supabase backfill was implemented; existing local-only data is not migrated (start-fresh). Realistically only the developer had local data. A one-time import could be added later if needed.

## v2b — RAG Pipeline
The next major upgrade. Instead of truncating large documents to fit 
Claude's context window, v2b will implement a proper Retrieval-Augmented 
Generation pipeline:
- Upload an entire textbook once (500+ pages)
- Document gets chunked and embedded as vectors on the backend
- Each chat message retrieves only the most semantically relevant chunks
- Claude answers with precise context rather than a truncated first section
- Planned stack: Express + LangChain.js + ChromaDB (local vector store)

## v3 — PDF Preview Panel
- Split-pane layout: chat on the left, live PDF preview on the right
- Ask Claude to "go to chapter 5" and the preview navigates there
- Powered by react-pdf
- Page sync between chat references and preview position
