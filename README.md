# StudyBot

An AI-powered study assistant that lets you upload course materials and interact with them through a smart chat interface. Built with React, Express, and the Anthropic Claude API.

**Live demo:** [study-bot-lovat.vercel.app](https://study-bot-lovat.vercel.app)

---

## Screenshots

### Workspace Dashboard
![Workspace Dashboard](screenshots/workspace.png)

### AI Chat with Document Context
![AI Chat](screenshots/chat.png)

### Interactive Practice Quiz
![Practice Quiz](screenshots/quiz.png)

### Print-Ready Study Notes Export
![Notes Export](screenshots/notes-export.png)

---

## Features

**Workspaces** — Organize your studying by class. Create a workspace for Physics, Math, Chemistry, or any subject. Each workspace has its own documents, chats, and a custom accent color that themes the entire UI.

**PDF Upload & AI Chat** — Upload a textbook chapter or lecture slides and ask anything about the material. StudyBot uses Claude as its AI backbone with prompt caching, so follow-up questions in the same session cost a fraction of a cent.

**Study Tool Shortcuts** — One-click prompts for the most common study tasks:
- **Summarize** — bullet-point summary of the document
- **Notes** — structured study notes organized by topic
- **Diagram** — Mermaid.js diagram illustrating a key concept
- **Practice Problems** — configurable interactive quiz (see below)

**Interactive Practice Quiz** — Generate multiple choice quizzes with a configurable number of questions and difficulty level (Easy / Medium / Hard). Questions render as a real quiz UI — select your answers, submit, and get instant grading with per-question explanations and a final score. No extra API calls needed after generation.

**Print-Ready Notes Export** — Any assistant response can be exported as a clean, print-formatted page with a single click. Includes workspace name, document name, and date. Useful for open-note exams.

**Mermaid Diagram Rendering** — When Claude returns a Mermaid diagram, it renders as an actual SVG diagram in the chat, not raw code.

**User Accounts** — Sign up with email/password or Google OAuth. Your data is stored in Supabase with Row Level Security, so each user can only ever see their own workspaces, documents, and chats.

**Session History** — Every chat is saved to Supabase with its title, timestamp, and full message history. Sessions persist across browser refreshes and devices, organized per workspace.

**Dynamic Accent Colors** — Each workspace has a user-chosen color (from presets or a custom color picker) that themes the sidebar, input focus ring, message bubbles, buttons, and section labels throughout the UI.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18, Vite |
| Backend | Node.js, Express |
| AI | Anthropic Claude API (claude-sonnet-4-20250514) |
| Embeddings | OpenAI `text-embedding-3-small` |
| Vector Store | Supabase pgvector (HNSW index) |
| PDF Parsing | pdf-parse |
| Diagram Rendering | Mermaid.js |
| Markdown Rendering | react-markdown |
| Auth | Supabase Auth (email/password + Google OAuth) |
| Database | Supabase (Postgres + Row Level Security) |
| Frontend Deploy | Vercel |
| Backend Deploy | Railway |

---

## Architecture

```
StudyBot/
├── client/                  # React + Vite SPA (deployed to Vercel)
│   └── src/
│       ├── components/      # UI components
│       │   ├── AuthScreen.jsx      # Login / signup / Google OAuth
│       │   ├── Sidebar.jsx         # Workspace switcher + doc/chat lists
│       │   ├── ChatWindow.jsx      # Message list + auto-scroll
│       │   ├── MessageBubble.jsx   # User / assistant message rows
│       │   ├── MessageContent.jsx  # Markdown + Mermaid + Quiz detection
│       │   ├── Mermaid.jsx         # Mermaid SVG renderer
│       │   ├── Quiz.jsx            # Interactive multiple choice quiz
│       │   ├── PromptChips.jsx     # Study tool shortcut buttons
│       │   └── ChatInput.jsx       # Textarea + send
│       ├── context/
│       │   └── AuthContext.jsx     # Supabase Auth provider + useAuth hook
│       ├── hooks/
│       │   └── useWorkspaces.js    # Workspace state + Supabase sync
│       ├── lib/
│       │   ├── supabase.js         # Supabase client singleton
│       │   ├── db.js               # Supabase data-access layer (CRUD + hydration)
│       │   ├── storage.js          # Quota helpers (doc size warnings)
│       │   └── prompts.js          # Study tool prompt templates
│       └── api.js                  # Fetch wrapper for Express API
│
├── server/                  # Express API (deployed to Railway)
│   └── src/
│       ├── app.js                  # Express app + middleware + routes
│       ├── routes/
│       │   ├── upload.js           # POST /api/upload (PDF extraction, legacy)
│       │   ├── documents.js        # POST /api/documents/ingest (RAG pipeline)
│       │   └── chat.js             # POST /api/chat (Claude API + retrieval)
│       └── services/
│           ├── pdf.js              # Text extraction with pdf-parse
│           ├── claude.js           # Claude API with prompt caching
│           ├── supabase.js         # Per-request JWT-scoped + admin clients
│           ├── embeddings.js       # OpenAI embedding with batching + retry
│           ├── chunking.js         # Text chunking (paragraph/sentence-aware)
│           └── retrieval.js        # Top-k and broad retrieval modes
│   └── scripts/
│       └── backfill-embeddings.js  # One-time backfill for existing docs
│
└── supabase/
    ├── migrations/
    │   ├── 0001_init.sql           # Tables, indexes, RLS policies
    │   ├── 0002_harden_child_rls.sql  # Parent-ownership RLS tightening
    │   └── 0003_rag_pgvector.sql   # pgvector, document_chunks, HNSW, RPC
    └── README.md                   # Dashboard setup runbook
```

**Key design decisions:**
- The Anthropic and OpenAI API keys live exclusively on the Express server and are never referenced in the client bundle
- RAG pipeline: documents are chunked (~3000 chars), embedded (OpenAI `text-embedding-3-small`), and stored as vectors in Supabase pgvector. Chat retrieves the most relevant chunks via HNSW cosine similarity; study tools use broad (full-doc) retrieval
- The client forwards the user's Supabase JWT to the server for RLS-scoped database access — no service-role key in request handlers
- All user data (workspaces, documents, chats, messages, chunks) is stored in Supabase Postgres with Row Level Security — data CRUD goes client → Supabase directly, while AI calls and ingestion route through Express
- Quiz grading and scoring happen entirely client-side after a single JSON generation call

---

## Local Development

### Prerequisites
- Node.js 18+
- An Anthropic API key ([console.anthropic.com](https://console.anthropic.com))
- A Supabase project (free tier works — see [`supabase/README.md`](supabase/README.md) for setup)

### Setup

```bash
# Clone the repo
git clone https://github.com/CodingMastermind123/StudyBot.git
cd StudyBot

# Install server dependencies
cd server
npm install
cp .env.example .env
# Add your ANTHROPIC_API_KEY to server/.env

# Install client dependencies
cd ../client
npm install
cp .env.example .env
# Add your VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to client/.env
# VITE_API_URL=http://localhost:8787 is already set
```

### Running locally

```bash
# Terminal 1 — start the backend
cd server
npm run dev

# Terminal 2 — start the frontend
cd client
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) in your browser.

### Environment Variables

**server/.env**

| Variable | Description | Default |
|---|---|---|
| `ANTHROPIC_API_KEY` | Your Anthropic API key | Required |
| `OPENAI_API_KEY` | OpenAI API key (embeddings) | Required |
| `OPENAI_EMBEDDING_MODEL` | OpenAI embedding model | `text-embedding-3-small` |
| `SUPABASE_URL` | Supabase project URL | Required |
| `SUPABASE_ANON_KEY` | Supabase anon/public key | Required |
| `SUPABASE_SERVICE_ROLE_KEY` | Service-role key (backfill script only) | Optional |
| `PORT` | Port the Express server runs on | `8787` |
| `ALLOWED_ORIGIN` | CORS origin (your frontend URL) | Required |
| `CLAUDE_MODEL` | Anthropic model ID | `claude-sonnet-4-20250514` |
| `MAX_DOC_CHARS` | Max characters extracted from PDF | `200000` |
| `RAG_TOP_K` | Number of chunks for top-k retrieval | `8` |
| `RAG_CHUNK_SIZE` | Target chunk size in characters | `3000` |
| `RAG_CHUNK_OVERLAP` | Overlap between chunks in characters | `400` |
| `RAG_BROAD_CHAR_BUDGET` | Max chars for broad retrieval mode | `480000` |

**client/.env**

| Variable | Description |
|---|---|
| `VITE_API_URL` | URL of the Express backend |
| `VITE_SUPABASE_URL` | Supabase project URL (from Project Settings → API) |
| `VITE_SUPABASE_ANON_KEY` | Supabase anon/public key (safe to expose — RLS is the security boundary) |

> **Note:** The Supabase **service-role key** is only used in the offline backfill script (`server/scripts/backfill-embeddings.js`) and must never be placed in the client or used in request handlers.

---

## Deployment

### Backend — Railway

1. Create a new project on [Railway](https://railway.app) and connect your GitHub repo
2. Set the root directory to `server`
3. Add all variables from the table above under the Variables tab
4. Go to Settings → Networking → Generate Domain and copy the URL

### Supabase

See [`supabase/README.md`](supabase/README.md) for the full setup runbook (project creation, running the migration SQL, configuring Google OAuth, and setting redirect URLs).

### Frontend — Vercel

1. Import your repo on [Vercel](https://vercel.com)
2. Set the root directory to `client`
3. Add environment variables:
   - `VITE_API_URL` — your Railway domain
   - `VITE_SUPABASE_URL` — your Supabase project URL
   - `VITE_SUPABASE_ANON_KEY` — your Supabase anon/public key
4. Deploy

Then update `ALLOWED_ORIGIN` in Railway to your Vercel domain and redeploy. Railway also needs `OPENAI_API_KEY`, `SUPABASE_URL`, and `SUPABASE_ANON_KEY` for the RAG pipeline.

Both platforms auto-deploy on every push to `main`.

---

## RAG Pipeline

StudyBot uses Retrieval-Augmented Generation to handle documents of any size — from a single page to a 500+ page textbook.

**Ingestion (once per document):** PDF → text extraction → chunking (~3000 chars, paragraph-aware) → embedding via OpenAI `text-embedding-3-small` (1536 dimensions) → stored in Supabase pgvector with an HNSW index. Progress streams to the UI over SSE.

**Retrieval (each interaction):**
- **Top-k mode** (default for chat): embeds the user's question, vector-searches the top 8 most relevant chunks via cosine similarity, sends only those to Claude
- **Broad mode** (study tools — Summarize, Notes, Diagram, Practice): retrieves all chunks in document order so Claude sees the full document for whole-document operations. Large documents are stride-sampled to fit within the context budget.

**Fallback:** Documents that haven't been ingested yet (e.g., during backfill) fall back to the stored raw text.

**Backfilling existing documents:**
```bash
# Set SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, OPENAI_API_KEY in server/.env
node server/scripts/backfill-embeddings.js
```

**Cost:** `text-embedding-3-small` costs ~$0.02/1M tokens. A 500-page textbook ≈ ~333k tokens ≈ **~$0.007 one-time** to embed. Each chat query embeds only the question (tens of tokens → effectively free).

---

## Roadmap

See [ROADMAP.md](ROADMAP.md) for planned features including:
- **v2b** — RAG pipeline for full textbook uploads (implemented)
- **v3** — Live PDF preview panel with page navigation

---

## Security

- The Anthropic and OpenAI API keys are never sent to or bundled with the frontend
- The Supabase service-role key is only used in the offline backfill script — never in request handlers
- CORS is restricted to the configured `ALLOWED_ORIGIN`
- PDF upload is validated for file type and size server-side
- All user data is protected by Supabase Row Level Security — each table (including `document_chunks`) enforces `user_id = auth.uid()` on SELECT, INSERT, UPDATE, and DELETE, with parent-ownership checks on child tables
- The client forwards the user's Supabase JWT to the server; the server builds a per-request Supabase client scoped to that user so RLS applies automatically
- Only the Supabase anon (public) key is used in the client; the service-role key is never referenced in client code

---

## Author

Built by **Amrith Akshintala**
