# PLAN.md

> Handoff implementation plan for **StudyBot**. Author: Claude Code Opus 4.8 (planning). Executor: Claude Code Sonnet 4.6 (implementation). Do not deviate from the contracts in this document without recording the reason.

---

## 1. Objective

Build **StudyBot** from scratch: a full-stack, single-user AI study assistant. A user uploads a PDF, the backend extracts its text, and the user chats about that material with Claude. The app provides four one-click "study tool" prompt shortcuts (Summarize, Notes, Diagram, Practice Problems), renders Mermaid diagrams returned by Claude, and persists chat sessions in `localStorage`. The repo is a monorepo (`/client` React+Vite, `/server` Express) deployable to Vercel (frontend) + Railway/Render (backend).

**Hard requirements that must hold at completion:**
- The Anthropic API key lives only on the server and is **never** sent to or referenced by the browser bundle.
- All five core features work end-to-end (upload → chat → shortcuts → Mermaid render → history persistence).
- Clean, commented code and a portfolio-grade `README.md` with local-dev + deployment instructions.

---

## 2. Repo Instructions / Local Rules

- **Discovered instruction files:** None. This is a confirmed greenfield repository (no `AGENTS.md`, `CLAUDE.md`, `claude.md`, `agents.md`, package manifests, or source files). The working directory `/Users/amrith/Documents/StudyBot` is the repo root.
- **Effect on the plan:** Because there are no existing conventions, **this PLAN.md is the source of truth**. Sonnet must establish conventions (file layout, naming, lint/test tooling) as specified here and apply them consistently. There are no legacy patterns to preserve and no backward-compatibility constraints.
- **First action Sonnet must take:** Run `ls -la` and `git status` at the repo root to confirm the directory is empty (or only contains this `PLAN.md`). If unexpected files exist, STOP and report before scaffolding. If the directory is not a git repo, run `git init` before committing.
- **Model-ID note (instruction conflict to surface):** The spec pins `claude-sonnet-4-20250514`. Make the model id configurable via a `CLAUDE_MODEL` env var defaulting to that value, and add a code comment noting the id should be verified/updated to a current Sonnet model before deployment. Do not hard-code the model string in multiple places.

---

## 3. Current-State Understanding

There is no current system. Everything is net-new. The target end-state architecture:

```
StudyBot/
├── PLAN.md                     # this file
├── README.md                   # portfolio README (write last)
├── .gitignore                  # root ignores (node_modules, .env, dist, etc.)
├── package.json                # OPTIONAL root: concurrently dev script only
├── client/                     # React + Vite SPA  (Vercel root)
│   ├── index.html
│   ├── package.json
│   ├── vite.config.js
│   ├── vercel.json
│   ├── .env.example            # VITE_API_URL
│   └── src/
│       ├── main.jsx
│       ├── App.jsx
│       ├── api.js              # fetch wrapper around VITE_API_URL
│       ├── index.css           # dark theme + layout
│       ├── lib/
│       │   ├── storage.js      # localStorage CRUD for the workspace store + quota helpers
│       │   ├── colors.js       # 6 preset accent colors
│       │   └── prompts.js      # study-tool prompt templates
│       ├── hooks/
│       │   └── useWorkspaces.js  # workspace/document/chat state + persistence
│       └── components/
│           ├── Sidebar.jsx           # sidebar container (switcher + panel)
│           ├── WorkspaceSwitcher.jsx # workspace pills + New Workspace
│           ├── NewWorkspaceForm.jsx  # name + color picker
│           ├── WorkspacePanel.jsx    # documents + chats sub-sections + quota banner
│           ├── DocumentList.jsx      # docs list + upload control (POST /api/upload)
│           ├── ChatList.jsx          # chat threads + New Chat (ties chat to a doc)
│           ├── ChatWindow.jsx        # main area: message list + scroll + empty states
│           ├── MessageBubble.jsx     # one message row (user/assistant)
│           ├── MessageContent.jsx    # markdown + mermaid detection
│           ├── Mermaid.jsx           # renders a mermaid code block
│           ├── PromptChips.jsx       # 4 study-tool chips
│           └── ChatInput.jsx         # textarea + send
└── server/                     # Express API  (Railway/Render root)
    ├── package.json
    ├── Procfile                # web: node src/index.js
    ├── .env.example            # ANTHROPIC_API_KEY, PORT, ALLOWED_ORIGIN, CLAUDE_MODEL, MAX_DOC_CHARS
    └── src/
        ├── index.js            # server bootstrap (listen)
        ├── app.js              # express app + middleware + routes (exported for tests)
        ├── routes/
        │   ├── upload.js       # POST /api/upload
        │   └── chat.js         # POST /api/chat
        ├── services/
        │   ├── pdf.js          # extractText(buffer) -> {text, pages}
        │   └── claude.js       # chat(messages, documentText) -> string
        └── __tests__/          # vitest + supertest
```

**Key data contracts (define once, reuse everywhere):**

- **Workspace store** (single object stored in `localStorage` under key `studybot.workspaces`). Replaces the old flat `studybot.sessions` array (which was never built — phases 5–7 were re-architected before any client state existed, so there is **no migration**):
  ```
  {
    workspaces: [
      {
        id: string,                 // crypto.randomUUID()
        name: string,               // e.g. "PHYS 2426"
        color: string,              // one of the 6 preset accent color ids/values
        createdAt: number,
        documents: [
          { id: string, name: string, charCount: number, text: string, uploadedAt: number }
        ],
        chats: [
          { id: string, title: string, documentId: string,   // chat is tied to ONE doc in this workspace
            createdAt: number, updatedAt: number,
            messages: Array<{ role: "user" | "assistant", content: string }> }
        ]
      }
    ],
    activeWorkspaceId: string | null,
    activeChatId: string | null
  }
  ```
  Notes: each `chat.documentId` must reference a `document.id` **within the same workspace**. `document.text` is stored client-side so chats keep working after refresh without re-upload. Be aware of the localStorage ~5 MB total quota; additionally warn when one workspace's combined `document.text` exceeds **3 MB** (see Risks). Backend is unchanged — documents are populated from the existing `POST /api/upload` response (`{ filename, pages, charCount, text }`, map `filename`→`name`), and chats call the existing `POST /api/chat` with `documentText` resolved from the chat's tied document.

- **`POST /api/upload`** — `multipart/form-data`, field name **`file`**.
  - Success `200`: `{ filename: string, pages: number, charCount: number, text: string }`
  - Errors: `400` (no file / not a PDF), `413` (too large), `422` (extraction failed/empty), `500`.

- **`POST /api/chat`** — `application/json`:
  - Request: `{ messages: Array<{role, content}>, documentText: string | null }`
  - Success `200`: `{ reply: string }`
  - Errors: `400` (missing/invalid messages), `502` (Anthropic API error), `500`.

- **`GET /api/health`** → `200 { status: "ok" }`.

---

## 4. Assumptions and Open Questions

Proceed on these assumptions (do not block; note any that prove wrong):

1. **PDF parsing library:** Use the Node-native **`pdf-parse`** library (a thin wrapper over pdf.js) for server-side text extraction. `pdfplumber` is Python and incompatible with an Express/Node backend, so it is rejected. **Pitfall:** importing `require('pdf-parse')` triggers a debug code path that reads a bundled test PDF and throws `ENOENT` in some environments — import the implementation directly: `require('pdf-parse/lib/pdf-parse.js')`. If `pdf-parse` proves unreliable, fall back to `pdfjs-dist` legacy build (`pdfjs-dist/legacy/build/pdf.mjs`) iterating `page.getTextContent()`.
2. **Response mode:** v1 uses **non-streaming** JSON (`{ reply }`) for reliability and simpler error handling. Streaming (SSE) is an explicitly-scoped optional enhancement (Phase 8), not part of the core success criteria.
3. **Anthropic SDK:** Use `@anthropic-ai/sdk` (latest). Build the request with the document text in a **system prompt block carrying `cache_control: { type: "ephemeral" }`** so the (large, repeated) document context is prompt-cached across turns — this materially cuts cost/latency since the doc is resent every message. Conversation turns go in `messages`.
4. **Styling:** Hand-written CSS in `index.css` using CSS variables for the dark theme. No CSS framework / component library, to keep the bundle minimal and the aesthetic controllable.
5. **Markdown rendering:** Use `react-markdown` for assistant messages; intercept fenced code blocks with language `mermaid` and route them to the `Mermaid` component. User messages render as plain text (no markdown) to avoid surprises.
6. **Test runner:** **Vitest** on both client and server (single mental model). Server route tests use `supertest`; the Anthropic SDK and `pdf` service are mocked. Client component tests use `@testing-library/react` + `jsdom`.
7. **Package manager:** `npm` (lockfiles committed). Node 18+ (global `fetch`, ESM). Pick **ESM** (`"type": "module"`) for both packages and use `import` syntax consistently.
8. **Deployment targets:** Frontend → Vercel (project root = `client/`). Backend → Render or Railway (root = `server/`). Document both; do not actually deploy (no credentials) — produce the config files and instructions only.

**Open items to verify while implementing (best-effort, non-blocking):**
- Confirm the exact success/return shape of `pdf-parse` (`data.text`, `data.numpages`).
- Confirm the current `react-markdown` major version's API for the `components={{ code }}` override (the `inline`/`className` props differ across v8/v9).
- Confirm `mermaid` v10+ async API: `mermaid.initialize(...)` then `await mermaid.render(id, code)`.

---

## 5. Risks / Edge Cases

**Security (highest priority):**
- **API key leakage** — never reference `ANTHROPIC_API_KEY` in `client/`. Only `VITE_*` vars are bundled into the frontend; the key must not have a `VITE_` prefix and must not appear in any client file. Verify with a post-build grep (see Testing).
- **CORS** — server must restrict `Access-Control-Allow-Origin` to the known client origin via `ALLOWED_ORIGIN` (comma-separated allowed). Avoid blanket `*` in production; allow localhost in dev.
- **Unbounded upload** — enforce a Multer `fileSize` limit (e.g. 25 MB) and reject non-`application/pdf` mimetypes; return `413`/`400` rather than crashing.

**Functional / context-window:**
- **Oversized documents** exceed Claude's context window. Cap stored/sent document text at `MAX_DOC_CHARS` (default ~200k chars ≈ a large textbook chapter set; tune down if you hit token errors). When truncating, append a marker like `\n\n[Document truncated for length]` and surface a non-blocking UI notice.
- **Scanned/image-only PDFs** yield empty text — return `422` with a clear message ("No extractable text — this PDF may be scanned images"). The frontend must show this, not silently proceed.
- **localStorage quota (~5 MB total) + per-workspace 3 MB doc warning** — storing full `document.text` for every document in every workspace can blow the browser quota fast. Two layers: (1) warn (non-blocking banner) when a single workspace's combined `document.text` exceeds **3 MB** (`isOverDocLimit`); (2) on an actual `QuotaExceededError` during save, throw the typed `StorageQuotaError`, surface it via the hook's `quotaError`, and **do not auto-evict** (workspaces are user-meaningful — unlike the old auto-evicted sessions, the user must remove documents/workspaces themselves). Pitfall: a failed save must not corrupt in-memory state or crash a render.

**UI/UX:**
- **Mermaid render failure** — invalid Mermaid syntax from Claude must not crash the app. `Mermaid.jsx` must catch render errors and fall back to showing the raw code in a `<pre>`.
- **Chat before upload** — chatting with no document is allowed but the system prompt should note no document is loaded; prompt chips that require a document should be disabled or prompt an upload first. Decide and keep consistent (recommend: chips disabled until a document is loaded; free-form chat allowed).
- **Race conditions** — disable the send button / chips while a request is in flight; prevent double-submits. Show a typing/loading indicator.
- **Session restore** — clicking a history item must fully replace messages + document context; "New Chat" must clear them. Guard against mutating the persisted array in place (always write immutably).
- **Auto-scroll** — new messages should scroll into view without yanking the page when the user has scrolled up to read history.

**Developer/system:**
- **ESM vs CJS mismatch** with `pdf-parse` (CJS) inside an ESM server — use `createRequire` or default import interop; verify it loads.
- **Vite env at build time** — `VITE_API_URL` is inlined at build; document that changing the backend URL requires a rebuild/redeploy of the frontend.
- **Trailing-slash / path joins** between `VITE_API_URL` and `/api/...` — normalize in `api.js`.

---

## 6. Implementation Plan

Execute phases in order. Each step lists purpose, files, what to inspect/modify, patterns to preserve, pitfalls, and a definition of done (DoD). Commit at the end of each phase with a clear message.

### Phase 0 — Repo bootstrap & guardrails
- **Step 0.1 — Confirm clean state.** Purpose: avoid clobbering. Inspect: `ls -la`, `git status`. Modify: if not a git repo, `git init`. DoD: confirmed empty (besides `PLAN.md`); git initialized.
- **Step 0.2 — Root `.gitignore`.** Files: `/.gitignore`. Add `node_modules/`, `dist/`, `.env`, `.env.local`, `*.log`, `.DS_Store`, `coverage/`. Pitfall: ensure `.env.example` is **not** ignored. DoD: gitignore present.
- **Step 0.3 — (Optional) root `package.json`.** Files: `/package.json`. Purpose: one-command dev. Add `private: true` and a `dev` script using `concurrently` to run client + server. Keep client/server as fully independent installs (no npm workspaces, to keep Vercel/Render roots simple). DoD: `npm run dev` from root starts both (after their deps are installed).

### Phase 1 — Server scaffold & health check
- **Step 1.1 — Init server package.** Files: `server/package.json`. Set `"type": "module"`, scripts: `start` (`node src/index.js`), `dev` (`node --watch src/index.js`), `test` (`vitest run`). Deps: `express`, `cors`, `multer`, `dotenv`, `@anthropic-ai/sdk`, `pdf-parse`. DevDeps: `vitest`, `supertest`. DoD: installs cleanly.
- **Step 1.2 — App factory.** Files: `server/src/app.js`. Purpose: testable app. Create and `export` an Express `app` (do **not** call `listen` here). Add `express.json({ limit: "1mb" })`, `cors({ origin: <from ALLOWED_ORIGIN>, ... })`, `GET /api/health`. Mount routers (added next phases). Pattern: keep bootstrap (`index.js`) separate from app config so tests import `app` without opening a port. DoD: `import app` works; `/api/health` returns `{status:"ok"}`.
- **Step 1.3 — Bootstrap.** Files: `server/src/index.js`. Load `dotenv`, import `app`, `app.listen(process.env.PORT || 8787)`. DoD: `npm run dev` logs listening port; `curl /api/health` works.
- **Step 1.4 — `.env.example` + Procfile.** Files: `server/.env.example` (`ANTHROPIC_API_KEY=`, `PORT=8787`, `ALLOWED_ORIGIN=http://localhost:5173`, `CLAUDE_MODEL=claude-sonnet-4-20250514`, `MAX_DOC_CHARS=200000`), `server/Procfile` (`web: node src/index.js`). DoD: files present; never commit a real key.

### Phase 2 — PDF upload & extraction
- **Step 2.1 — PDF service.** Files: `server/src/services/pdf.js`. Inspect: `pdf-parse` return shape. Implement `extractText(buffer) -> { text, pages }`. Import via the direct lib path to dodge the debug ENOENT bug. Throw a typed error on empty text. Pitfall: ESM interop with the CJS module. DoD: returns text for a real PDF buffer; throws on empty.
- **Step 2.2 — Upload route.** Files: `server/src/routes/upload.js`, mount in `app.js`. Use `multer({ storage: memoryStorage, limits: { fileSize: 25*1024*1024 }, fileFilter })` accepting only `application/pdf`. Handler: extract text, truncate to `MAX_DOC_CHARS`, respond `{ filename, pages, charCount, text }`. Map errors to `400/413/422/500`. Add a Multer error-handling middleware so `LIMIT_FILE_SIZE` → `413`. DoD: uploading a valid PDF returns text; non-PDF → 400; oversized → 413; scanned/empty → 422.

### Phase 3 — Claude chat service & route
- **Step 3.1 — Claude service.** Files: `server/src/services/claude.js`. Implement `getReply({ messages, documentText }) -> string`. Build a **system prompt**: a study-assistant persona + the document text in a block with `cache_control: { type: "ephemeral" }` (only when `documentText` present; otherwise note "no document loaded"). Call `anthropic.messages.create({ model: process.env.CLAUDE_MODEL, max_tokens: ~2048, system, messages })`. Return `response.content` joined text. Pitfall: `content` is an array of blocks — concatenate `text` blocks. Comment the model-id configurability note from §2. DoD: returns assistant text given a mocked SDK; passes the document via cached system block.
- **Step 3.2 — Chat route.** Files: `server/src/routes/chat.js`, mount in `app.js`. Validate `messages` is a non-empty array of `{role,content}`; `400` otherwise. Call the service; on Anthropic error → `502` with safe message (never leak key/stack). Respond `{ reply }`. DoD: valid request returns reply; invalid → 400; SDK throw → 502.

### Phase 4 — Client scaffold & dark theme
- **Step 4.1 — Init client.** Files: `client/` via `npm create vite@latest client -- --template react` (or scaffold manually). Set `"type":"module"`. Deps: `react`, `react-dom`, `react-markdown`, `mermaid`. DevDeps: `vite`, `@vitejs/plugin-react`, `vitest`, `@testing-library/react`, `@testing-library/jest-dom`, `jsdom`. Scripts: `dev`, `build`, `preview`, `test`. DoD: `npm run dev` serves the default app.
- **Step 4.2 — Env + API wrapper.** Files: `client/.env.example` (`VITE_API_URL=http://localhost:8787`), `client/src/api.js`. Implement `uploadPdf(file)` and `sendChat({messages, documentText})` using `fetch`, normalizing base URL + path, parsing JSON, and throwing readable errors on non-2xx. Pitfall: never put the API key here; only `VITE_API_URL`. DoD: functions callable; base-URL join handles trailing slash.
- **Step 4.3 — Dark theme + layout shell.** Files: `client/src/index.css`, `client/src/App.jsx`. Define CSS variables (dark bg, subtle borders, clean type), a two-pane layout (Sidebar | main), responsive down to tablet (collapsible sidebar). DoD: app renders an empty dark shell with sidebar + main regions.

> **Re-architecture note (phases 5–7 only):** Phases 0–4 are DONE and must not be touched — repo scaffolded, server running with PDF-upload + Claude-chat endpoints, client base theme + CSS custom properties in place. The backend is unchanged: **no new API routes**. Phases 5–7 below replace the original flat-session design with a **Workspace** model (Workspace → Documents + Chats; each chat tied to one document). All new client state lives in `localStorage` under `studybot.workspaces` (schema in §3). Reuse the existing `api.js` (`uploadPdf`, `sendChat`) and the phase-4 CSS custom properties — extend, do not redefine, the theme.

### Phase 5 — Workspace state model, storage & quota
Purpose: establish the workspace data layer (colors, persistence, quota, state hook) before any sidebar/main UI is built. No components yet.

- **Step 5.1 — Accent color presets.** Files: `client/src/lib/colors.js`.
  - Inspect first: the phase-4 `index.css` CSS custom properties so the 6 accents harmonize with the existing dark palette (use existing `--` vars where one fits).
  - Modify: export `ACCENT_COLORS` as an array of **exactly 6** objects `{ id: string, name: string, value: string /* hex */ }`. Provide a helper `getColor(id)` that returns a safe default (first color) for unknown ids.
  - Pitfall: these are per-workspace accent dots/labels, NOT theme overrides — do not mutate global CSS vars here.
  - DoD: importing `ACCENT_COLORS` yields 6 stable entries; `getColor` never returns `undefined`.

- **Step 5.2 — Storage lib (workspace store).** Files: `client/src/lib/storage.js`.
  - Inspect first: confirm `crypto.randomUUID()` is available (modern browsers/Vite target — it is); otherwise add a tiny fallback id generator.
  - Modify: implement against the single key `studybot.workspaces` holding the root object from §3.
    - `loadStore()` → parse JSON; on missing/corrupt JSON return a **fresh empty store** `{ workspaces: [], activeWorkspaceId: null, activeChatId: null }` (never throw to the caller).
    - `saveStore(store)` → `JSON.stringify` + `setItem`, wrapped in try/catch. On `QuotaExceededError` (or `name === "QuotaExceededError"` / code 22) **throw a typed `StorageQuotaError`** (define and export it) — do **not** silently drop or auto-evict, because workspaces are user-meaningful (unlike the old auto-evicted sessions).
    - `newId()` → `crypto.randomUUID()`.
  - Pitfall: do NOT migrate or read the old `studybot.sessions` key — it was never populated; ignore it entirely.
  - DoD: round-trips the root object; corrupt/missing JSON → empty store (no throw); simulated quota failure throws `StorageQuotaError`.

- **Step 5.3 — Quota helpers.** Files: `client/src/lib/storage.js` (same file; keep cohesive).
  - Modify: export `WORKSPACE_DOC_LIMIT_BYTES = 3 * 1024 * 1024`; `workspaceTextBytes(workspace)` summing `new Blob([doc.text]).size` across `workspace.documents` (Blob gives accurate UTF-8 byte size — do not use `string.length`); `isOverDocLimit(workspace)` → boolean.
  - DoD: byte total is accurate for multi-byte text; threshold constant exported and used by the UI banner (Step 6.4).

- **Step 5.4 — `useWorkspaces` hook.** Files: `client/src/hooks/useWorkspaces.js`.
  - Inspect first: Step 5.2/5.3 exports.
  - Modify: on mount, `loadStore()` into state. Persist on every change with `saveStore`, but wrap each persisting action in try/catch for `StorageQuotaError` and expose the failure via a returned `quotaError` state (string|null) — **never** let a quota failure crash a render. Always update state **immutably** (rebuild arrays/objects; never mutate nested arrays in place).
  - Derived selectors to expose: `activeWorkspace` (by `activeWorkspaceId`), `activeChat` (by `activeChatId`, searched within `activeWorkspace.chats`), `activeDocument` (`activeWorkspace.documents` whose `id === activeChat.documentId`).
  - Actions to expose:
    - `createWorkspace({ name, color })` → push new workspace (empty `documents`/`chats`), set it active, clear `activeChatId`; returns the new id.
    - `selectWorkspace(id)` → set `activeWorkspaceId`; set `activeChatId` to that workspace's most-recently-updated chat (`max updatedAt`) or `null`.
    - `addDocument(workspaceId, { name, charCount, text })` → append `{ id, name, charCount, text, uploadedAt: Date.now() }`; returns `{ docId, overLimit: boolean }` where `overLimit = isOverDocLimit` of the post-add workspace.
    - `createChat(workspaceId, documentId)` → append `{ id, title: "New chat", documentId, createdAt, updatedAt, messages: [] }`, set active; returns chat id. Guard: `documentId` must belong to the workspace, else no-op + return null.
    - `selectChat(id)` → set `activeChatId`.
    - `appendMessage(role, content)` → append to **the active chat by id** (not by index); if it's the first `user` message, set `title` to the trimmed/truncated content (~40 chars); bump `updatedAt = Date.now()`.
    - Recommended (optional but include): `deleteWorkspace(id)`, `deleteChat(id)`, `deleteDocument(workspaceId, docId)` — when deleting a document, also delete or orphan-guard chats whose `documentId` matches (simplest: delete those chats; document the choice).
  - Pitfalls: `appendMessage` must target the active chat by id (concurrent workspaces share the same hook); resolving `documentText` for a send is the caller's job via `activeDocument` (Phase 7), the hook just stores.
  - DoD: every action updates state + persists; refresh restores exactly; quota failures surface through `quotaError` (not a thrown render error); no in-place mutation.

### Phase 6 — Sidebar: workspace switcher, documents & chats
Purpose: build the new sidebar (workspace switcher on top, per-workspace documents + chats in the middle). Main area stays for Phase 7. Reuse phase-4 layout containers and CSS vars.

- **Step 6.1 — Sidebar container.** Files: `client/src/components/Sidebar.jsx`.
  - Inspect first: the existing phase-4 sidebar shell / CSS vars in `App.jsx` + `index.css`.
  - Modify: compose `<WorkspaceSwitcher>` (always visible, top) + `<WorkspacePanel>` (middle, rendered **only when `activeWorkspace` exists**). Pass `useWorkspaces` values/handlers down as props (the hook is instantiated in `App.jsx`, Step 7.6) — prefer prop drilling over context for this small tree.
  - DoD: switcher always renders; panel appears only with an active workspace; matches dark aesthetic.

- **Step 6.2 — WorkspaceSwitcher.** Files: `client/src/components/WorkspaceSwitcher.jsx`.
  - Modify: render workspace **pills** = color dot (`getColor(ws.color).value`) + name; highlight the active one; click → `selectWorkspace(ws.id)`. A **"New Workspace"** button sits at the bottom of the list and toggles `NewWorkspaceForm`.
  - Edge case: empty list → show a short "Create your first workspace" hint above the button.
  - DoD: lists workspaces with color dots; active highlighted; new-workspace entry point works.

- **Step 6.3 — NewWorkspaceForm.** Files: `client/src/components/NewWorkspaceForm.jsx`.
  - Modify: inline form (or small modal) with a **name** text input (required; trim; reject empty/whitespace) and a **color picker** rendering the 6 `ACCENT_COLORS` as selectable dots (default = first). On submit → `createWorkspace({ name, color })`, close the form (the hook auto-selects the new workspace).
  - Pitfall: prevent submit on empty name; clear inputs on close.
  - DoD: creates a workspace with chosen name + color and it becomes active.

- **Step 6.4 — WorkspacePanel.** Files: `client/src/components/WorkspacePanel.jsx`.
  - Modify: for the `activeWorkspace`, render two labeled sub-sections — `<DocumentList>` then `<ChatList>`. Render a **quota warning banner** when `isOverDocLimit(activeWorkspace)` is true (copy: e.g. "This workspace's documents exceed 3 MB — older browsers may fail to save. Consider removing a document."). Also surface the hook's `quotaError` (from a failed save) as a banner here.
  - DoD: both sub-sections render under the active workspace; warning banner appears at >3 MB and on quota-save failure.

- **Step 6.5 — DocumentList + upload control.** Files: `client/src/components/DocumentList.jsx`.
  - Inspect first: the existing `client/src/api.js` `uploadPdf` contract from phase 4 (returns `{ filename, pages, charCount, text }`).
  - Modify: list the active workspace's documents (name + human-readable size from `charCount`/bytes). Provide an **upload control** (file picker; drag-drop optional) that calls `api.uploadPdf(file)`, shows loading + error states (including the **422 scanned-PDF** message), and on success calls `addDocument(activeWorkspace.id, { name: filename, charCount, text })`. If the returned `overLimit` is true, ensure the Step 6.4 banner shows.
  - Pitfalls: backend is unchanged — do not invent fields; map `filename`→`name`. Disable the control / show spinner while a request is in flight to prevent double-upload.
  - DoD: uploading adds a document to the active workspace; errors surfaced; quota banner triggers past 3 MB.

- **Step 6.6 — ChatList + New Chat.** Files: `client/src/components/ChatList.jsx`.
  - Modify: list chat threads for the active workspace (title, `updatedAt`, and the tied document's name); highlight active; click → `selectChat(chat.id)`. A **"New Chat"** button behaves by document count:
    - 0 documents → button **disabled** with hint "Upload a document first".
    - exactly 1 document → `createChat(ws.id, theOnlyDocId)`.
    - >1 documents → show a small inline document picker, then `createChat(ws.id, chosenDocId)`.
  - Pitfall: a chat must always carry a valid `documentId` within the workspace.
  - DoD: chats listed and selectable; New Chat correctly ties to a document; disabled with 0 docs.

### Phase 7 — Main chat area, rendering & prompt chips
Purpose: render the active chat in the (unchanged) main area, wire send through the existing `/api/chat` using the chat's tied document, and add the 4 study-tool chips. Reuse the original Mermaid/markdown plan — only the data source changed (active chat + its document).

- **Step 7.1 — Mermaid component.** Files: `client/src/components/Mermaid.jsx`.
  - Modify: `mermaid.initialize({ startOnLoad: false, theme: "dark" })` once (module scope). On code change, `await mermaid.render(uniqueId, code)` into a container; wrap in try/catch → fallback `<pre>{code}</pre>`. Verify the installed `mermaid` v10+ async API.
  - DoD: valid diagram renders an `<svg>`; invalid syntax falls back to raw code without crashing.

- **Step 7.2 — MessageContent + MessageBubble.** Files: `client/src/components/MessageContent.jsx`, `client/src/components/MessageBubble.jsx`.
  - Modify: assistant content → `react-markdown` with a `code` override routing `language-mermaid` fenced blocks → `<Mermaid>`, other code → styled `<pre><code>`. User content → plain text (no markdown). Bubble styles differ for user vs assistant, using phase-4 CSS vars.
  - Pitfall: confirm the installed `react-markdown` major's `code` override prop shape (`inline`/`className` differ across v8/v9).
  - DoD: markdown renders; mermaid blocks become diagrams; user text is literal (no markdown injection).

- **Step 7.3 — ChatWindow.** Files: `client/src/components/ChatWindow.jsx`.
  - Modify: the main area. If no `activeChat` → render an **empty state** whose hint depends on context: no workspace → "Create a workspace"; workspace but no documents → "Upload a document"; documents but no chat → "Start a new chat". Otherwise map `activeChat.messages` → `<MessageBubble>`, show a loading indicator while a reply is pending, and auto-scroll to bottom on new messages **without** yanking when the user has scrolled up.
  - DoD: shows the active chat's messages; correct empty states per context.

- **Step 7.4 — ChatInput + send wiring.** Files: `client/src/components/ChatInput.jsx`.
  - Modify: textarea with Enter-to-send / Shift+Enter newline; disabled while a request is in flight or when there is no `activeChat`. On send:
    1. `appendMessage("user", text)`.
    2. Build the outgoing array as `activeChat.messages` **including** the just-added user message (append-then-read via the updated state, or construct the array explicitly to avoid an off-by-one).
    3. Resolve `documentText` from `activeDocument.text` (the active chat's tied document — NOT a global doc).
    4. `await api.sendChat({ messages, documentText })`.
    5. `appendMessage("assistant", reply)`.
    6. On error: show a non-crashing inline error; do not lose the user's message.
  - Pitfalls: ensure the user's new message is in the payload; `documentText` comes from the chat's tied document; guard against double-submit.
  - DoD: round-trip works, persists to the active chat, disabled states correct, errors handled gracefully.

- **Step 7.5 — Prompt templates + chips.** Files: `client/src/lib/prompts.js`, `client/src/components/PromptChips.jsx`.
  - Modify `prompts.js`: export the 4 templates as `{ id, label, prompt }` — **Summarize** (bullet summary), **Notes** (structured study notes), **Diagram** (explicitly instruct Claude to return a ```mermaid fenced block), **Practice Problems** (5 quiz questions with answers).
  - Modify `PromptChips.jsx`: render the 4 chips near the input; clicking sends the template through the **same send path** as Step 7.4 (treat it as a user message). Disable chips when there is **no active chat** (hence no document) or while a request is in flight.
  - DoD: each chip triggers the correct prompt and renders the result; the Diagram chip yields a rendered Mermaid diagram.

- **Step 7.6 — App wiring.** Files: `client/src/App.jsx`.
  - Inspect first: the phase-4 layout shell (do not redefine theme/CSS vars).
  - Modify: instantiate `useWorkspaces()` once; pass values/handlers to `<Sidebar>` and the main-area components (`<ChatWindow>`, `<PromptChips>`, `<ChatInput>`); render quota/`quotaError` banners (or delegate to `WorkspacePanel`); ensure the top-level empty state when there are no workspaces.
  - DoD: full flow works end-to-end — create workspace → upload document → New Chat (tied to that doc) → chat + use chips → switch workspaces/chats → everything persists across refresh.

### Phase 8 — (Optional, scoped) Streaming
Only after Phases 1–7 are fully working and tested. Add SSE: server `POST /api/chat/stream` using `anthropic.messages.stream`, client consumes via `fetch`+`ReadableStream`, appending tokens. Keep the non-streaming endpoint as fallback. DoD: tokens appear incrementally; non-streaming path still works. **Do not start this if any earlier phase is incomplete.**

### Phase 9 — Deployment config & README
- **Step 9.1 — Vercel config.** Files: `client/vercel.json`. SPA rewrite all routes → `/index.html`; document setting `VITE_API_URL` in Vercel env and project root = `client/`. DoD: file present and valid.
- **Step 9.2 — Backend deploy.** Files: confirm `server/Procfile`; document Render (start cmd `node src/index.js`, root `server/`) and Railway equivalents, plus required env vars and setting `ALLOWED_ORIGIN` to the Vercel domain. DoD: instructions complete.
- **Step 9.3 — README (write last).** Files: `/README.md`. Sections: overview + feature list, screenshots placeholder, architecture diagram (text ok), local dev (install client+server, copy `.env.example`→`.env`, run both), env-var table, deployment (Vercel + Render/Railway), security note (key server-only), known limitations (context cap, scanned PDFs, localStorage quota). DoD: a new dev can run the app from the README alone.

---

## 7. Testing Plan

Run after each phase; full suite before completion. Use Vitest both sides.

**Server unit/integration (`server/src/__tests__/`, `supertest` + mocked SDK/pdf):**
- `health` → `200 {status:"ok"}`.
- `upload`: valid PDF (use a small committed fixture `server/src/__tests__/fixtures/sample.pdf`) → `200` with `text`; non-PDF → `400`; oversized (mock limit) → `413`; mocked empty extraction → `422`.
- `chat`: valid body (mock `claude.getReply`) → `200 {reply}`; empty/invalid `messages` → `400`; service throws → `502`; assert the response **never** contains the API key or a stack trace.
- `claude` service: assert the system prompt includes the document text **with `cache_control`** when `documentText` is present, and the persona when absent (mock the SDK and inspect the call args).
- `pdf` service: real fixture → non-empty text + page count; empty/garbage buffer → throws.

**Client unit/component (`@testing-library/react`, mocked `api.js`):**
- `storage.js`: round-trips the workspace store; corrupt/missing JSON → fresh empty store (no throw); simulated `QuotaExceededError` → throws `StorageQuotaError`; `workspaceTextBytes`/`isOverDocLimit` accurate at the 3 MB boundary (incl. multi-byte text).
- `colors.js`: exactly 6 accents; `getColor(unknownId)` returns a default (never `undefined`).
- `useWorkspaces`: `createWorkspace` sets active + clears chat; `selectWorkspace` picks the most-recent chat or null; `addDocument` returns `{docId, overLimit}` and appends to the right workspace; `createChat` ties to a valid `documentId` (rejects a foreign doc); `appendMessage` targets the active chat by id and auto-titles from the first user message; quota-failed save surfaces via `quotaError` without throwing to render; state persists across reload (re-mount reads store).
- `Mermaid`: valid code renders an `<svg>`; invalid code → `<pre>` fallback (no throw).
- `MessageContent`: ```mermaid block → Mermaid component; normal markdown → formatted; user text rendered literally (no markdown injection).
- `ChatList` / `New Chat`: disabled with 0 docs; ties to the only doc when exactly 1; shows a picker when >1.
- `PromptChips`: disabled when no active chat; clicking sends the correct template; disabled while loading.
- `ChatInput`: Enter sends, Shift+Enter newlines, disabled in flight / with no active chat; outgoing payload includes the just-added user message and the active chat's document text.

**Build / static checks:**
- `cd server && npm run test`; `cd client && npm run test` — all green.
- `cd client && npm run build` succeeds. **Security gate:** after build, grep the output bundle for the key and ensure absence: `! grep -ri "ANTHROPIC_API_KEY\|sk-ant" client/dist` (must find nothing). Also grep all of `client/src` for `ANTHROPIC` (should be nothing).
- Optional: add ESLint and run `npm run lint` both sides.

**Manual end-to-end (document in a checklist; run locally with both servers up):**
1. Start server + client, open the Vite URL.
2. Upload a real text PDF (drag-drop and file-picker both) → document name appears, chips enable.
3. Free-form question → user bubble, loading indicator, assistant reply rendered as markdown.
4. Click each of the 4 chips → correct outputs; **Diagram** renders an actual Mermaid SVG.
5. Refresh the page → active session and history persist.
6. New Chat → clears; select an old session → fully restores messages + document.
7. **Negative paths:** upload a non-PDF (rejected), upload a scanned/image PDF (422 message shown), stop the backend and send a message (graceful client error, no crash), feed Claude a prompt that yields invalid Mermaid (raw-code fallback).
8. **Responsive:** verify usable layout at desktop and tablet widths.

---

## 8. Validation Checklist for Sonnet

- [ ] Repo confirmed greenfield before scaffolding; git initialized.
- [ ] `server` and `client` install cleanly; `npm run dev` runs both.
- [ ] All five core features work in the manual E2E flow.
- [ ] Server tests pass; client tests pass; `client` builds.
- [ ] **API key never in client source or built bundle** (grep gate passes).
- [ ] CORS restricted via `ALLOWED_ORIGIN`; upload size/mime limits enforced.
- [ ] Document context capped at `MAX_DOC_CHARS`; truncation surfaced to user.
- [ ] Mermaid invalid-syntax fallback works; no crash.
- [ ] Workspace store persists across refresh; corrupt JSON degrades to empty store; per-workspace 3 MB warning + `StorageQuotaError`/`quotaError` handled (no auto-evict, no render crash).
- [ ] Each chat is tied to a valid document in its workspace; switching workspaces/chats loads the right messages + document.
- [ ] Streaming (Phase 8) only added if all prior phases complete; non-streaming path intact.
- [ ] `.env.example` files present for both packages; no real secrets committed.
- [ ] `vercel.json` + `Procfile` present; deployment instructions complete.
- [ ] README enables a fresh dev to run and deploy from scratch.
- [ ] No dead code, no half-wired components, all imports resolve.

---

## 9. Suggested Execution Order for Sonnet

1. **Phase 0** (bootstrap, gitignore) → commit.
2. **Phase 1** server scaffold + health → verify `curl` → commit.
3. **Phase 2** PDF upload (test with a real fixture) → commit.
4. **Phase 3** Claude service + chat route (mocked SDK tests) → commit.
5. **Phase 4** client scaffold + theme → commit.
6. **Phase 5** workspace data layer (`colors.js` → `storage.js` + quota → `useWorkspaces`) with unit tests → commit.
7. **Phase 6** sidebar (Sidebar → WorkspaceSwitcher → NewWorkspaceForm → WorkspacePanel → DocumentList → ChatList). Wire upload to `/api/upload`; verify create-workspace → upload-doc → new-chat flow → commit.
8. **Phase 7** main area (Mermaid → MessageContent/Bubble → ChatWindow → ChatInput send wiring → PromptChips → App wiring). Do a first end-to-end run with a real API key; manually verify all 4 chips, especially Diagram → commit.
9. **Run full test suite + build + security grep gate.** Fix everything red.
10. **Phase 9** deployment config + README → commit.
11. **Phase 8** streaming — only if time remains and everything else is green.

Build backend-first so the frontend always has a working API to call. Wire one vertical slice (upload → chat) end-to-end before polishing UI.

## 10. Final Notes for Sonnet

- **Security is the top success criterion.** Treat any path where the key could reach the client as a blocking bug. The grep gate is mandatory, not optional.
- **Prompt caching matters here:** the document is resent every turn — put it in a `cache_control`-marked system block to avoid paying full input cost each message. Verify the SDK accepts the block shape for the configured model; if the model rejects `cache_control`, degrade gracefully (still works, just uncached).
- **Don't over-engineer v1.** No database, no auth, no streaming in the core. Resist adding libraries beyond those listed.
- **ESM/CJS interop** with `pdf-parse` is the most likely early blocker — solve it in Phase 2 before building further, using the direct `pdf-parse/lib/pdf-parse.js` import and `createRequire` if needed.
- **`react-markdown` and `mermaid` versions** have shifted APIs across majors — verify the actual installed version's API rather than assuming; both are called out in §4 open items.
- **localStorage quota** will bite with large PDFs stored across workspaces. The plan deliberately warns at 3 MB per workspace and surfaces a typed `StorageQuotaError` rather than auto-evicting — do not change this to silent eviction; workspaces/documents are user-owned data. Keep all saves wrapped so a failed write never corrupts in-memory state.
- **Re-architecture boundary:** phases 0–4 and the entire backend are frozen — no new API routes, no server edits, no theme/CSS-var redefinition. Phases 5–7 only add client state + components and reuse the existing `api.js` (`uploadPdf`, `sendChat`).
- **Vite env is build-time** — note in the README that changing `VITE_API_URL` requires a frontend rebuild/redeploy.
- Commit per phase with descriptive messages; keep components small and commented; match the file layout in §3 exactly so the README's instructions stay accurate.
