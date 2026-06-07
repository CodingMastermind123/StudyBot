# StudyBot Roadmap

## v1 (Current)
- [x] Workspace-based organization (multiple classes/subjects)
- [x] PDF upload and text extraction
- [x] AI chat powered by Claude API
- [x] Study tool shortcuts (Summarize, Notes, Diagram, Practice Problems)
- [x] Mermaid diagram rendering
- [x] Session history per workspace
- [x] Dynamic workspace accent colors
- [x] localStorage persistence

## v2 — RAG Pipeline
The biggest planned upgrade. Instead of truncating large documents to fit 
Claude's context window, v2 will implement a proper Retrieval-Augmented 
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

## v4 — Multi-user / Cloud Sync
- User accounts and authentication (Clerk or Supabase Auth)
- Workspaces and chat history synced to the cloud (Supabase PostgreSQL)
- Access your workspaces from any device or browser
- PDF storage in Supabase Storage (no re-uploading)
- Replaces localStorage entirely
