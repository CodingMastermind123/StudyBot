# StudyBot

An AI-powered study assistant that lets you upload a PDF and have a conversation about it. Ask questions, get summaries, generate notes, create practice problems, and more — all grounded in your document.

## Features

- **PDF upload** — drag & drop or click to upload; text is extracted server-side
- **Multi-workspace** — organise documents and chats into separate colour-coded workspaces
- **Streaming responses** — assistant replies appear token-by-token via SSE
- **Study tools** — one-click prompt chips for Summarize, Notes, Diagram, and Practice Problems
- **Mermaid diagrams** — the assistant can render diagrams inline from markdown fenced blocks
- **Persistent state** — workspaces, documents, and chat history survive page refreshes (localStorage)
- **Prompt caching** — document text is sent with `cache_control` so repeat turns are faster and cheaper

## Screenshots

> _Add screenshots here once deployed._

## Architecture

```
┌─────────────────────┐        ┌──────────────────────────┐
│  Client (React/Vite)│        │  Server (Express / Node) │
│  Vercel             │        │  Render or Railway       │
│                     │        │                          │
│  src/               │  HTTPS │  src/                    │
│  ├── App.jsx        │◄──────►│  ├── routes/             │
│  ├── api.js         │  REST  │  │   ├── chat.js         │
│  ├── components/    │  + SSE │  │   └── upload.js       │
│  ├── hooks/         │        │  └── services/           │
│  └── lib/           │        │      ├── claude.js       │
│                     │        │      └── pdf.js          │
└─────────────────────┘        └──────────────┬───────────┘
                                              │
                                     Anthropic Claude API
```

**API endpoints**

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/health` | Liveness check |
| `POST` | `/api/upload` | Upload a PDF, returns extracted text |
| `POST` | `/api/chat` | Single-turn chat (non-streaming fallback) |
| `POST` | `/api/chat/stream` | Streaming chat via SSE |

## Local Development

### Prerequisites

- Node.js 18+
- An [Anthropic API key](https://console.anthropic.com/)

### 1. Clone and install

```bash
git clone https://github.com/CodingMastermind123/StudyBot.git
cd StudyBot

# Install server dependencies
cd server && npm install

# Install client dependencies
cd ../client && npm install
```

### 2. Configure the server

```bash
cd server
cp .env.example .env
```

Open `.env` and fill in your API key:

```
ANTHROPIC_API_KEY=sk-ant-...
PORT=8787
ALLOWED_ORIGIN=http://localhost:5173
CLAUDE_MODEL=claude-sonnet-4-20250514
MAX_DOC_CHARS=200000
```

### 3. Run both servers

Open two terminals:

```bash
# Terminal 1 — backend
cd server && npm run dev

# Terminal 2 — frontend
cd client && npm run dev
```

Then open **http://localhost:5173** in your browser.

### 4. Run tests

```bash
cd server && npm test
cd client && npm test
```

## Environment Variables

### Server (`server/.env`)

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `ANTHROPIC_API_KEY` | ✅ | — | Your Anthropic API key |
| `PORT` | | `8787` | Port the Express server listens on |
| `ALLOWED_ORIGIN` | | `http://localhost:5173` | Comma-separated allowed CORS origins |
| `CLAUDE_MODEL` | | `claude-sonnet-4-20250514` | Claude model ID to use |
| `MAX_DOC_CHARS` | | `200000` | Max characters extracted from a PDF |

### Client (`client/.env` or Vercel environment)

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `VITE_API_URL` | ✅ (prod) | `http://localhost:8787` | Full URL of the deployed backend |

## Deployment

### Frontend — Vercel

1. Import the repo into [Vercel](https://vercel.com/new).
2. Set **Root Directory** to `client`.
3. Framework preset: **Vite** (auto-detected).
4. Add environment variable: `VITE_API_URL` → your backend URL (e.g. `https://studybot-api.onrender.com`).
5. Deploy. The `client/vercel.json` SPA rewrite is already in place — all routes fall through to `index.html`.

### Backend — Render

1. Create a new **Web Service** on [Render](https://render.com).
2. Connect the repo, set **Root Directory** to `server`.
3. **Build command:** `npm install`
4. **Start command:** `node src/index.js`
5. Add environment variables:
   - `ANTHROPIC_API_KEY` — your key
   - `ALLOWED_ORIGIN` — your Vercel domain (e.g. `https://studybot.vercel.app`)
   - `CLAUDE_MODEL`, `MAX_DOC_CHARS` (optional, see table above)

### Backend — Railway (alternative)

1. Create a new project, connect the repo.
2. Set **Root Directory** to `server`.
3. Railway auto-detects the `Procfile` (`web: node src/index.js`).
4. Set the same environment variables as above.

## Security

- The `ANTHROPIC_API_KEY` lives **only on the server** and is never sent to the client.
- The client's built bundle is checked post-build: `grep` for `ANTHROPIC_API_KEY` or `sk-ant` must return nothing.
- CORS is restricted to the origin(s) listed in `ALLOWED_ORIGIN`; unrecognised origins are rejected.
- PDF uploads are size-limited (10 MB by default via multer) and validated by MIME type server-side.

## Known Limitations

- **Context cap** — very long documents are truncated at `MAX_DOC_CHARS` (default 200 000 characters, ~150 pages). Text beyond that is silently dropped.
- **Scanned PDFs** — image-only PDFs yield no extractable text. A message is shown but the document cannot be queried.
- **localStorage quota** — workspace data (including extracted text) is stored in the browser. Most browsers cap this at 5–10 MB; uploading many large documents may hit the limit. A quota warning banner appears when storage is nearly full.
- **No authentication** — all workspaces are local to the browser. There is no user account system.
- **Single-user** — the server holds no session state; it is stateless between requests.
