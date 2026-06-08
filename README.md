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

**Session History** — Every chat is saved to localStorage with its title, timestamp, and full message history. Sessions persist across browser refreshes and are organized per workspace.

**Dynamic Accent Colors** — Each workspace has a user-chosen color (from presets or a custom color picker) that themes the sidebar, input focus ring, message bubbles, buttons, and section labels throughout the UI.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18, Vite |
| Backend | Node.js, Express |
| AI | Anthropic Claude API (claude-sonnet-4-20250514) |
| PDF Parsing | pdf-parse |
| Diagram Rendering | Mermaid.js |
| Markdown Rendering | react-markdown |
| Persistence | localStorage (client-side) |
| Frontend Deploy | Vercel |
| Backend Deploy | Railway |

---

## Architecture

```
StudyBot/
├── client/                  # React + Vite SPA (deployed to Vercel)
│   └── src/
│       ├── components/      # UI components
│       │   ├── Sidebar.jsx         # Workspace switcher + doc/chat lists
│       │   ├── UploadZone.jsx      # Drag & drop PDF upload
│       │   ├── ChatWindow.jsx      # Message list + auto-scroll
│       │   ├── MessageBubble.jsx   # User / assistant message rows
│       │   ├── MessageContent.jsx  # Markdown + Mermaid + Quiz detection
│       │   ├── Mermaid.jsx         # Mermaid SVG renderer
│       │   ├── Quiz.jsx            # Interactive multiple choice quiz
│       │   ├── PromptChips.jsx     # Study tool shortcut buttons
│       │   └── ChatInput.jsx       # Textarea + send
│       ├── hooks/
│       │   └── useWorkspaces.js    # Workspace state + localStorage sync
│       ├── lib/
│       │   ├── storage.js          # localStorage CRUD
│       │   └── prompts.js          # Study tool prompt templates
│       └── api.js                  # Fetch wrapper for Express API
│
└── server/                  # Express API (deployed to Railway)
    └── src/
        ├── app.js                  # Express app + middleware + routes
        ├── routes/
        │   ├── upload.js           # POST /api/upload (PDF extraction)
        │   └── chat.js             # POST /api/chat (Claude API)
        └── services/
            ├── pdf.js              # Text extraction with pdf-parse
            └── claude.js           # Claude API with prompt caching
```

**Key design decisions:**
- The Anthropic API key lives exclusively on the Express server and is never referenced in the client bundle
- Document text is sent as a cached system block, dramatically reducing per-message cost for follow-up questions
- Workspace and chat state lives in localStorage — no database required for v1
- Quiz grading and scoring happen entirely client-side after a single JSON generation call

---

## Local Development

### Prerequisites
- Node.js 18+
- An Anthropic API key ([console.anthropic.com](https://console.anthropic.com))

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
# VITE_API_URL=http://localhost:3001 is already set in .env.example
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
| `PORT` | Port the Express server runs on | `3001` |
| `ALLOWED_ORIGIN` | CORS origin (your frontend URL) | Required |
| `CLAUDE_MODEL` | Anthropic model ID | `claude-sonnet-4-20250514` |
| `MAX_DOC_CHARS` | Max characters extracted from PDF | `40000` |

**client/.env**

| Variable | Description |
|---|---|
| `VITE_API_URL` | URL of the Express backend |

---

## Deployment

### Backend — Railway

1. Create a new project on [Railway](https://railway.app) and connect your GitHub repo
2. Set the root directory to `server`
3. Add all variables from the table above under the Variables tab
4. Go to Settings → Networking → Generate Domain and copy the URL

### Frontend — Vercel

1. Import your repo on [Vercel](https://vercel.com)
2. Set the root directory to `client`
3. Add `VITE_API_URL` pointing to your Railway domain
4. Deploy

Then update `ALLOWED_ORIGIN` in Railway to your Vercel domain and redeploy.

Both platforms auto-deploy on every push to `main`.

---

## Roadmap

See [ROADMAP.md](ROADMAP.md) for planned features including:
- **v2** — RAG pipeline for full textbook uploads (LangChain.js + ChromaDB)
- **v3** — Live PDF preview panel with page navigation
- **v4** — Multi-user support with cloud sync (Supabase)

---

## Security

- The Anthropic API key is never sent to or bundled with the frontend
- CORS is restricted to the configured `ALLOWED_ORIGIN`
- PDF upload is validated for file type and size server-side

---

## Author

Built by **Amrith Akshintala**
