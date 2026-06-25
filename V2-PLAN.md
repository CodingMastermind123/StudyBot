# PLAN.md — StudyBot v2a: Auth + Storage Migration (localStorage → Supabase)

> Audience: Claude Code Sonnet 4.6 (the executor). This plan is the single source of
> truth for v2a. Scope is **authentication + storage migration only**. Do NOT build
> the RAG pipeline, Canvas integration, flashcards, exam countdown, or any new study
> feature. Those are explicitly out of scope.

---

## 1. Objective

Migrate StudyBot from single-user, browser-`localStorage` persistence to a multi-user
Supabase backend:

1. Add **Supabase Auth** with **email/password** and **Google OAuth**.
2. Gate the app behind auth: logged-out users see a login/signup screen (in the
   existing warm maroon/cream design system); logged-in users see the current app.
3. Persistent sessions across refreshes; a logout control in the UI.
4. Create **Supabase Postgres** tables for `workspaces`, `documents`, `chats`,
   `messages`, each scoped by `user_id` (from `auth.users`), protected by
   **Row Level Security (RLS)** so a user can only ever read/write their own rows.
5. Replace **all** `localStorage` reads/writes in the client with async Supabase
   queries, preserving the existing nested data shape and **every** existing feature
   (workspace CRUD, document upload, chat + streaming, study-tool prompts,
   interactive quiz, notes export, dynamic accent colors).
6. Store document extracted text in Supabase tied to the document row (instead of
   client-only).
7. Keep the Express server solely as the Claude API proxy (API key stays server-side).
   Route **all data CRUD directly client → Supabase** (RLS protects it); keep **Claude
   calls** going through Express.

**Definition of success:** Two different accounts, in two browsers, each see only their
own workspaces/documents/chats/messages. All v1 features work identically. A page
refresh keeps the user logged in and shows their synced data. No `localStorage`
persistence of user data remains. RLS provably blocks cross-user access.

---

## 2. Repo Instructions / Local Rules

**Discovered instruction files:**

- There is **no** `AGENTS.md`, `agents.md`, `CLAUDE.md`, or `claude.md` in this repo.
- The only guidance docs are `README.md` and `ROADMAP.md` (root). `PLAN.md` (root) is
  the original v1 plan — do not confuse it with this file (`V2-PLAN.md`).
- User auto-memory rule (from the harness, applies to the executor): **never run
  `git push` unless the user explicitly asks.** You may stage/commit if asked, but do
  not push. Treat deployment as automatic from `main` once the user pushes themselves.

**How these affect implementation/testing:**

- `README.md` documents the architecture, env vars, and deployment flow. After the
  migration you **must update README.md** (Tech Stack table, Architecture tree, Env
  Variables tables, Deployment section, the "Persistence: localStorage" line, and the
  Security section). This is part of the work, not optional.
- `README.md` "Key design decisions" currently says "Workspace and chat state lives in
  localStorage — no database required for v1." Update this to describe Supabase + RLS.
- Follow existing code conventions exactly (see §3). The codebase is plain JS (no
  TypeScript), ESM modules (`"type": "module"`), React 18 function components with
  hooks, 2-space indentation, descriptive `//` and `// ──` section comments, and CSS
  custom properties for all theming.
- Do not introduce a state-management library, TypeScript, a component library, or a
  router unless this plan calls for it (it does not — keep it minimal).

---

## 3. Current-State Understanding

### 3.1 Project layout (relevant files)

```
client/
  index.html                     # Google Fonts; #root mount
  vite.config.js                 # Vite + React + vitest (jsdom) config
  vercel.json                    # SPA rewrite to /index.html
  .env.example                   # VITE_API_URL only
  src/
    main.jsx                     # ReactDOM root → <App/>
    App.jsx                      # Top-level: composes useWorkspaces + chat send + accent CSS vars
    api.js                       # fetch wrapper to Express (uploadPdf, sendChat, streamChat)
    index.css                    # ALL styling + design tokens (:root custom props)
    test-setup.js                # jest-dom for vitest
    hooks/
      useWorkspaces.js           # THE state layer: load/save store, all CRUD actions
    lib/
      storage.js                 # localStorage CRUD: loadStore/saveStore/newId + quota helpers
      colors.js                  # ACCENT_COLORS presets + getColor()
      prompts.js                 # Study-tool prompt templates
    components/
      Sidebar.jsx                # Shell: WorkspaceSwitcher + WorkspacePanel
      WorkspaceSwitcher.jsx      # Workspace pills, context menu (rename/recolor/delete), NewWorkspaceForm
      NewWorkspaceForm.jsx       # Create-workspace form (name + color)
      WorkspacePanel.jsx         # Quota banner + DocumentList + ChatList
      DocumentList.jsx           # Doc list + upload zone (calls uploadPdf, onAddDocument)
      ChatList.jsx               # Chat list + "New Chat" + doc picker
      ChatWindow.jsx             # Empty states + message list + center upload zone
      MessageBubble.jsx          # User/assistant rows, notes export
      MessageContent.jsx         # Markdown + Mermaid + Quiz detection
      Mermaid.jsx                # Mermaid SVG renderer
      Quiz.jsx                   # Client-side interactive quiz (no storage coupling)
      PromptChips.jsx            # Study-tool shortcut buttons
      ChatInput.jsx              # Textarea + send
server/
  src/
    index.js                     # dotenv + app.listen
    app.js                       # express + cors(ALLOWED_ORIGIN) + json + routes
    routes/upload.js             # POST /api/upload (multer + pdf extraction)
    routes/chat.js               # POST /api/chat + /api/chat/stream (Claude)
    services/claude.js           # Anthropic SDK, prompt caching
    services/pdf.js              # pdf-parse extraction
  .env.example                   # ANTHROPIC_API_KEY, PORT, ALLOWED_ORIGIN, CLAUDE_MODEL, MAX_DOC_CHARS
```

### 3.2 How persistence works today (the thing being replaced)

- `lib/storage.js` reads/writes a **single JSON blob** under `localStorage` key
  `"studybot.workspaces"`. Shape:
  ```
  {
    workspaces: [
      {
        id, name, color, createdAt,        // createdAt = Date.now() (epoch ms)
        documents: [ { id, name, charCount, text, uploadedAt } ],
        chats: [
          {
            id, title, documentId, createdAt, updatedAt,
            messages: [ { role, content, createdAt, displayContent? } ]
          }
        ]
      }
    ],
    activeWorkspaceId,
    activeChatId
  }
  ```
- `hooks/useWorkspaces.js` is the **only** module that imports `storage.js`. It holds
  the whole store in one `useState`, exposes derived selectors (`activeWorkspace`,
  `activeChat`, `activeDocument`) and **synchronous** action functions
  (`createWorkspace`, `selectWorkspace`, `addDocument`, `createChat`, `selectChat`,
  `appendMessage`, `deleteWorkspace`, `deleteChat`, `deleteDocument`, `renameWorkspace`,
  `recolorWorkspace`). Each action computes a new store object and calls
  `persist(nextStore)` → `setStore` + `saveStore`.
- **`appendMessage` uses a `storeRef` (always-current ref)** so the user message and the
  assistant reply (two sequential calls) don't clobber each other. This ordering
  guarantee must be preserved in the async version.
- `App.jsx` consumes the hook, owns chat send (`handleSend` → `streamChat`), and injects
  workspace accent color as CSS custom properties (`--workspace-accent*`).

### 3.3 Components' coupling to the data shape (critical for migration)

Every consumer reads the **nested tree** synchronously:
- `WorkspaceSwitcher`: `ws.documents.length`, `ws.chats.length`, `getColor(ws.color)`.
- `DocumentList`: `workspace.documents.map(...)`, `new Blob([doc.text]).size`.
- `ChatList`: `workspace.documents`, `workspace.chats`, sorts by `chat.updatedAt`
  (number), `relativeTime(chat.updatedAt)` (expects epoch ms).
- `ChatWindow`: `activeWorkspace.documents.length`, `activeChat.messages.map(...)`,
  `msg.createdAt`, `msg.displayContent`.
- `App.handleSend`: reads `activeChat.messages`, `activeDocument.text` (sent to Express).
- `WorkspacePanel`/`storage.js`: `isOverDocLimit(workspace)` reads `workspace.documents`
  and `doc.text`.

**Design consequence:** The cheapest, safest migration keeps this exact in-memory shape
and exact action names/signatures, and changes only `useWorkspaces` + a new data layer
underneath it. Components should need near-zero changes (only timestamp-format and
quota-banner concerns, addressed below). **Do this — do not refactor components to fetch
their own data.**

### 3.4 Server

- `server/src/app.js`: CORS allows comma-separated `ALLOWED_ORIGIN`; only `GET`/`POST`.
- `routes/chat.js`: `POST /api/chat` and `/api/chat/stream` take `{ messages, documentText }`
  in the body. The client already passes `documentText` from `activeDocument.text`.
- **The server does not touch storage and needs no functional change for this migration.**
  Document text still flows client → Express per request. JWT verification on these
  endpoints is optional hardening (see §6 Phase 7) and is **not required** because the
  Claude proxy holds no user data and RLS protects all data access.

### 3.5 Env / config / deploy today

- Client env: only `VITE_API_URL` (Vite inlines at build → requires rebuild to change).
- Server env: `ANTHROPIC_API_KEY`, `PORT` (8787), `ALLOWED_ORIGIN`, `CLAUDE_MODEL`,
  `MAX_DOC_CHARS`.
- Vercel root = `client`; Railway root = `server`; both auto-deploy from `main`.
- `.gitignore` already ignores `.env`, `.env.local`, `.env.*.local`; keeps `.env.example`.

### 3.6 Design tokens (for the auth screens — must match)

From `client/src/index.css :root`:
- Sidebar maroon: `--sb-bg: #500000`, sidebar text `--sb-text: #f5e8e0`.
- Main bg cream: `--color-bg: #f5efe4`, input bg `--color-bg-input: #ede5d6`,
  card `--color-card: #ffffff`, `--color-card-2: #f9f4ea`.
- Accent maroon: `--color-accent: #500000`, hover `--color-accent-hover: #6a0000`.
- Text: `--text-heading: #1a1208`, `--text-body: #2c1e10`, `--text-strong: #500000`,
  `--text-meta: #a09080`.
- Borders: `--border-input: #d0c4b0`, `--border-card: #e4d8c4`.
- Error: `--color-error: #be123c`.
- Fonts: `--font-display` (Playfair Display, for the "StudyBot" wordmark/headings),
  `--font-ui` (DM Sans, for body/buttons/inputs), `--font-serif` (Source Serif 4).
- Radii: `--radius-md: 6px`, `--radius-lg: 8px`, `--radius-xl: 10px`.
- Shadows: `--shadow-card`, `--shadow-input`, `--shadow-send`.
- Spacing scale `--space-1..10`, transitions `--transition-base: 200ms ease-out`.

The auth screen must use these tokens (no hardcoded colors), Playfair for the wordmark,
DM Sans for inputs/buttons, maroon `#500000` primary buttons with `--color-accent-hover`
on hover, cream `#f5efe4` page background, and a white card with `--shadow-card`.

---

## 4. Assumptions and Open Questions

**Assumptions (proceed on these unless evidence contradicts):**

1. A new Supabase project will be created by the user; the executor cannot create cloud
   resources. The executor therefore **writes the SQL migration file and step-by-step
   dashboard instructions** into the repo (`supabase/` dir + README), and wires the
   client to read `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` from env. Treat real
   project creation, SQL execution, and OAuth provider setup as **manual steps the user
   performs**, documented precisely in this plan and in `supabase/README.md`.
2. There is **no existing production user data to migrate** programmatically — current
   data lives in each browser's `localStorage` only. We will **not** build an automated
   localStorage→Supabase importer. (Optional nicety: a one-time "import local data"
   button. This is OUT of scope unless the user later asks. Do not build it.)
3. Keep the **nested in-memory store shape** in `useWorkspaces` (§3.3 rationale).
4. Generate row IDs **client-side** with `crypto.randomUUID()` and pass them in inserts
   (so optimistic UI has stable ids immediately). DB columns are `uuid` with no default
   needed, but add `default gen_random_uuid()` anyway as a safety net.
5. Store timestamps in Postgres as `timestamptz` (idiomatic), and **convert to epoch-ms
   numbers in the hydration mapper** so `relativeTime()` and numeric sorts keep working
   unchanged. (See §5 risk — this is the single most likely regression.)
6. The **anon key** is safe to expose in the client bundle (that's its purpose; RLS is
   the security boundary). The **service-role key is NOT needed** for this plan and must
   **never** be put in the client. Do not add it anywhere unless a server-side admin op
   is introduced (none is).
7. Email confirmation: default Supabase behavior may require email confirmation. For a
   smooth demo, the plan documents how to toggle "Confirm email" in the dashboard. The
   executor's UI must handle the "check your email to confirm" state gracefully either
   way.
8. Google OAuth uses Supabase's hosted callback (`<project>.supabase.co/auth/v1/callback`);
   the client calls `signInWithOAuth({ provider: 'google' })` and relies on
   `redirectTo` + Supabase URL config. No Google client secret is ever in the repo.

**Open questions the executor should verify while implementing (don't block — pick the
documented default):**

- Does the deployed Vercel domain need to be added to Supabase Auth "Redirect URLs"?
  **Yes** — document both `http://localhost:5173` and the Vercel URL. Verify the exact
  Vercel URL from `README.md` (`study-bot-lovat.vercel.app`).
- Should logout clear in-memory state immediately? **Yes** — on `SIGNED_OUT`, reset the
  store to empty and show the auth screen.
- Quota banner (`isOverDocLimit`, `StorageQuotaError`): localStorage quota no longer
  applies. **Keep `isOverDocLimit`** (still a reasonable per-workspace size warning) but
  **remove the `StorageQuotaError`/`quotaError` path** since Supabase has no 5 MB quota.
  Replace generic write failures with a friendly "Couldn't save — check your connection"
  banner. (Details in §6 Phase 5.)

---

## 5. Risks / Edge Cases

1. **Timestamp format regression (highest risk).** `ChatList` sorts by `chat.updatedAt`
   as a number and `relativeTime(ts)` does `Date.now() - ts`. Postgres returns ISO
   strings for `timestamptz`. If you hydrate raw strings, sorting/relative-time break
   subtly. **Mitigation:** the hydration mapper converts every `*_at` column to epoch ms
   (`new Date(row.created_at).getTime()`). Keep the in-memory fields named exactly
   `createdAt`, `updatedAt`, `uploadedAt` (camelCase, numeric).

2. **Sync vs async actions.** Components today call actions synchronously and read the
   updated tree on next render. Converting to async Supabase writes risks UI lag or lost
   updates. **Mitigation:** optimistic update — update local React state immediately with
   the client-generated id, then `await` the Supabase write in the background; on error,
   roll back and show a banner. Keep action signatures identical so callers don't change
   (e.g. `createWorkspace` still returns the id synchronously from the optimistic path;
   if a caller `await`s it that's fine, but don't require it).

3. **`appendMessage` ordering.** The user msg and assistant reply are two sequential
   calls relying on `storeRef`. With async DB writes, a naive implementation could insert
   the assistant row before the user row, or set the title twice. **Mitigation:** keep
   the `storeRef`-based local update synchronous and ordered exactly as today; perform DB
   inserts in the same order; do not block the second local update on the first DB write.

4. **RLS misconfiguration = security failure (hard requirement).** If RLS is disabled, or
   a policy uses `USING (true)`, or `user_id` isn't set on insert, users could read each
   other's data. **Mitigation:** every table has `ENABLE ROW LEVEL SECURITY`, a default
   on `user_id` of `auth.uid()`, and policies `USING (user_id = auth.uid())` +
   `WITH CHECK (user_id = auth.uid())` for all of SELECT/INSERT/UPDATE/DELETE. Add an
   explicit cross-user test (§7.4).

5. **Cascade deletes.** Deleting a workspace must delete its documents, chats, messages;
   deleting a document deletes its chats + their messages (today `deleteDocument` removes
   orphaned chats). **Mitigation:** FKs with `ON DELETE CASCADE`. Then the client only
   needs to delete the top entity and refresh local state.

6. **Document text size.** Server `MAX_DOC_CHARS=200000`. A Postgres `text` column
   handles this fine, but the default Supabase row size and the `messages.content` for
   quiz JSON are also large-ish. No special handling needed, but don't `select` the giant
   `text` column when you only need document metadata for lists (perf). **Mitigation:**
   hydrate full text on load (needed for chat), but if perf is a concern, you may lazy-load
   `documents.text` only for the active document. **Default: load it all on hydrate** for
   simplicity; note the optimization but don't implement it unless needed.

7. **Session race on first paint.** Supabase restores the session async; rendering the app
   before the session resolves causes a flash of the auth screen. **Mitigation:** an
   `AuthProvider` with a `loading` state that renders a neutral splash until
   `getSession()` resolves.

8. **OAuth redirect loop / wrong redirect.** If Supabase Site URL / Redirect URLs don't
   include the running origin, Google sign-in fails or lands on the wrong page.
   **Mitigation:** document the exact URLs to allowlist; use
   `redirectTo: window.location.origin`.

9. **CORS unaffected but double-check.** Express CORS only matters for Claude calls.
   Supabase calls go to `*.supabase.co` directly (Supabase handles its own CORS). No
   server CORS change needed. Don't accidentally route Supabase through Express.

10. **Empty-state correctness.** When a fresh user logs in (no workspaces), the existing
    "Welcome to StudyBot / create a workspace" empty state must show. Ensure hydration of
    an empty account yields `workspaces: []`, not an error.

11. **StrictMode double-invoke.** `main.jsx` uses `<StrictMode>`, which double-invokes
    effects in dev. The auth listener and initial hydration must be idempotent
    (subscribe/unsubscribe cleanly; don't double-insert).

12. **Build-time env inlining.** `VITE_*` vars are inlined at build. Missing
    `VITE_SUPABASE_URL`/`ANON_KEY` at build time → runtime crash. **Mitigation:** add to
    `.env.example`, guard `createClient` with a clear thrown error if missing, and add to
    Vercel before the next deploy.

---

## 6. Implementation Plan

> Work in phases. After each phase, run the verification noted in its "Definition of
> done". Do not push (`git push`) — only commit if/when the user asks.

### Phase 0 — Branch, dependencies, Supabase client scaffolding

- **Step 0.1 — Create a feature branch.**
  - Purpose: isolate the migration from `main` (which auto-deploys).
  - Action: `git checkout -b v2a-auth-supabase` (the user is currently on `main`).
  - DoD: `git status` shows the new branch.

- **Step 0.2 — Add the Supabase JS client dependency (client only).**
  - Files: `client/package.json`.
  - Action: from `client/`, run `npm install @supabase/supabase-js`. Confirm it lands in
    `dependencies` (not dev).
  - Pitfall: install in `client/`, not root or server.
  - DoD: `@supabase/supabase-js` appears in `client/package.json` dependencies and
    `client/node_modules`.

- **Step 0.3 — Add client env vars.**
  - Files: `client/.env.example` (commit), `client/.env` (local, gitignored — create it).
  - Add:
    ```
    VITE_SUPABASE_URL=
    VITE_SUPABASE_ANON_KEY=
    ```
    Keep existing `VITE_API_URL`. Add a comment that these come from Supabase →
    Project Settings → API, and that the anon key is safe to expose (RLS is the boundary).
  - DoD: both files contain the three `VITE_*` vars; `.env` is not tracked by git
    (verify with `git status` — should not list `client/.env`).

- **Step 0.4 — Create the Supabase client singleton.**
  - New file: `client/src/lib/supabase.js`.
  - Inspect first: `client/src/api.js` for the env-var-reading style
    (`import.meta.env.VITE_*`) and module-singleton pattern.
  - Implement: read `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`; if either is
    missing, `throw new Error("Missing Supabase env vars — see client/.env.example")`;
    export a single `createClient(...)` instance with
    `auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }`.
  - Pitfall: create exactly one client instance (module singleton). Multiple instances
    cause auth state desync.
  - DoD: `import { supabase } from "./lib/supabase.js"` works; dev server boots without
    error when env vars are set.

### Phase 1 — Database schema, RLS, and migration SQL (repo artifact + dashboard steps)

- **Step 1.1 — Author the SQL migration file.**
  - New files: `supabase/migrations/0001_init.sql` and `supabase/README.md`.
  - Purpose: a runnable, reviewable schema with RLS. This is the security core.
  - Schema (idiomatic Postgres; mirrors §3.2 shape):
    - `workspaces`: `id uuid pk default gen_random_uuid()`,
      `user_id uuid not null references auth.users(id) on delete cascade default auth.uid()`,
      `name text not null`, `color text not null`, `created_at timestamptz not null default now()`.
    - `documents`: `id uuid pk default gen_random_uuid()`,
      `workspace_id uuid not null references workspaces(id) on delete cascade`,
      `user_id uuid not null references auth.users(id) on delete cascade default auth.uid()`,
      `name text not null`, `char_count integer`, `text text`,
      `uploaded_at timestamptz not null default now()`.
    - `chats`: `id uuid pk default gen_random_uuid()`,
      `workspace_id uuid not null references workspaces(id) on delete cascade`,
      `document_id uuid references documents(id) on delete cascade`,
      `user_id uuid not null references auth.users(id) on delete cascade default auth.uid()`,
      `title text not null default 'New chat'`,
      `created_at timestamptz not null default now()`,
      `updated_at timestamptz not null default now()`.
    - `messages`: `id uuid pk default gen_random_uuid()`,
      `chat_id uuid not null references chats(id) on delete cascade`,
      `user_id uuid not null references auth.users(id) on delete cascade default auth.uid()`,
      `role text not null check (role in ('user','assistant'))`,
      `content text not null`, `display_content text`,
      `created_at timestamptz not null default now()`.
  - Indexes: `create index on documents(workspace_id)`, `chats(workspace_id)`,
    `chats(document_id)`, `messages(chat_id)`, and `workspaces(user_id)`.
  - **RLS** — for EACH of the four tables:
    - `alter table <t> enable row level security;`
    - One policy per command (or a single `for all`) using:
      `using (user_id = auth.uid())` and, for insert/update,
      `with check (user_id = auth.uid())`.
    - Recommended explicit form (clearest to review):
      ```sql
      create policy "<t>_select" on <t> for select using (user_id = auth.uid());
      create policy "<t>_insert" on <t> for insert with check (user_id = auth.uid());
      create policy "<t>_update" on <t> for update using (user_id = auth.uid()) with check (user_id = auth.uid());
      create policy "<t>_delete" on <t> for delete using (user_id = auth.uid());
      ```
  - Pitfalls: do NOT use `using (true)`; ensure `user_id` defaults to `auth.uid()` so
    client inserts don't have to send it (but the client SHOULD still send it explicitly
    too — belt and suspenders). Keep `on delete cascade` on all FKs so client deletes are
    simple.
  - DoD: SQL file is syntactically valid Postgres, covers all four tables, every table
    has RLS enabled + four policies, all FKs cascade.

- **Step 1.2 — Write `supabase/README.md` dashboard runbook.**
  - Contents (manual steps for the user, written precisely):
    1. Create a Supabase project; copy Project URL + anon public key into
       `client/.env` and (later) Vercel.
    2. SQL Editor → paste `migrations/0001_init.sql` → Run. Verify 4 tables + RLS "on".
    3. Authentication → Providers → enable **Email** (default on). Note the "Confirm
       email" toggle and what it means for testing.
    4. Authentication → Providers → enable **Google**: create OAuth credentials in Google
       Cloud Console (OAuth consent screen + Web client), set the **Authorized redirect
       URI** to `https://<project-ref>.supabase.co/auth/v1/callback`, paste Client ID +
       Secret into Supabase. (Secrets never go in the repo.)
    5. Authentication → URL Configuration → set **Site URL** to the Vercel domain; add
       **Redirect URLs**: `http://localhost:5173` and the Vercel URL.
  - DoD: a non-expert could follow it end-to-end.

### Phase 2 — Auth context + session gating

- **Step 2.1 — Create an Auth context/provider.**
  - New file: `client/src/context/AuthContext.jsx` (create `src/context/` dir).
  - Inspect first: `main.jsx` (where to wrap), `App.jsx` (how it's rendered).
  - Implement: `AuthProvider` that on mount calls `supabase.auth.getSession()`, stores
    `session`/`user`, sets `loading=false` when resolved, and subscribes via
    `supabase.auth.onAuthStateChange` (update on `SIGNED_IN`/`SIGNED_OUT`/`TOKEN_REFRESHED`).
    Clean up the subscription on unmount (return the unsubscribe). Export a `useAuth()`
    hook returning `{ session, user, loading, signOut }` where `signOut` calls
    `supabase.auth.signOut()`.
  - Pitfalls: idempotent under StrictMode (subscribe once, unsubscribe in cleanup); don't
    render children that hit the DB before `loading` is false.
  - DoD: `useAuth()` reflects login state and survives refresh.

- **Step 2.2 — Wrap the app and gate rendering.**
  - Files: `client/src/main.jsx`, `client/src/App.jsx` (or a new `Root` wrapper).
  - Inspect first: current `main.jsx` render tree.
  - Implement: wrap `<App/>` in `<AuthProvider>`. In `App` (or a thin `Root`):
    - if `loading` → render a centered splash (wordmark "StudyBot" in Playfair on cream
      bg) — neutral, no flash.
    - else if no `session` → render `<AuthScreen/>` (Phase 3).
    - else → render the existing app shell.
  - Pitfall: keep the existing `app-layout` + accent-CSS-var logic intact for the
    logged-in branch.
  - DoD: logged-out users see the auth screen; logged-in users see the app; refresh keeps
    them logged in (after Phase 3 + a test account exist).

### Phase 3 — Auth screen UI (matching the design system)

- **Step 3.1 — Build `AuthScreen`.**
  - New file: `client/src/components/AuthScreen.jsx`.
  - Inspect first: `index.css` tokens (§3.6), `NewWorkspaceForm.jsx` for input/button
    class conventions, and existing `.banner.error` styling for error display.
  - Implement a single screen with a centered white card on cream bg:
    - Wordmark "StudyBot" (Playfair, `--text-strong`/maroon).
    - Tab/toggle between **Log in** and **Sign up**.
    - Email + password inputs (DM Sans, `--border-input`, focus ring via accent).
    - Primary submit button: maroon `#500000` bg, hover `--color-accent-hover`, white
      text, `--shadow-send` (matches existing send button feel).
    - "Continue with Google" button (outlined/secondary style; include a Google "G"
      mark — inline SVG, no external asset).
    - Inline error banner (reuse `.banner.error` class) for auth errors.
    - Loading state on submit (disable button, "Signing in…").
    - On sign-up when email confirmation is on: show a "Check your email to confirm your
      account" success state.
  - Wire actions to Supabase:
    - Log in: `supabase.auth.signInWithPassword({ email, password })`.
    - Sign up: `supabase.auth.signUp({ email, password })`.
    - Google: `supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: window.location.origin } })`.
  - Map Supabase auth errors to friendly messages (invalid credentials, user exists,
    weak password, rate limit). Never show raw error objects.
  - Add corresponding CSS to `index.css` under a new clearly-commented section
    (`/* ─── Auth Screen ─── */`) using ONLY existing tokens. Do not hardcode hex values
    that duplicate tokens; reference the custom properties.
  - Pitfalls: match font families and radii exactly; keep it keyboard-accessible
    (labels, Enter submits); don't break on small viewports.
  - DoD: screen renders in the maroon/cream system; email/password and Google flows
    invoke Supabase; errors and loading states display correctly.

- **Step 3.2 — Add a logout control.**
  - Files: `client/src/components/Sidebar.jsx` (preferred home — bottom of the sidebar),
    plus `AuthContext` `signOut`.
  - Inspect first: `Sidebar.jsx` structure (it has `sidebar-header` + `sidebar-nav`;
    add a `sidebar-footer`).
  - Implement: a small footer in the maroon sidebar showing the user's email
    (`useAuth().user.email`, truncated) and a "Log out" button (subtle, sidebar-text
    color, hover state). On click → `signOut()`. On `SIGNED_OUT`, app returns to
    `AuthScreen` (handled by the gate in Phase 2) — and the data hook resets (Phase 4).
  - Add `.sidebar-footer` styles to `index.css` matching sidebar tokens.
  - Pitfall: `Sidebar` currently receives many props from `App`; pass `userEmail`/`onLogout`
    down or consume `useAuth()` directly inside `Sidebar` (simpler — context is global).
  - DoD: a logout button is visible, works, and returns to the auth screen.

### Phase 4 — Replace the storage layer with Supabase (core migration)

> This is the heart of the change. Goal: `useWorkspaces` keeps the SAME public API and
> the SAME nested in-memory shape, but loads/persists via Supabase. Components stay
> essentially unchanged.

- **Step 4.1 — Create the Supabase data-access module.**
  - New file: `client/src/lib/db.js` (replaces the persistence role of `storage.js`).
  - Inspect first: `storage.js` (what it exported), `useWorkspaces.js` (every action and
    the exact shape it builds).
  - Implement async functions, each scoped to the current user via RLS (the client
    passes `user_id` explicitly too):
    - `fetchStore(userId)`: query all four tables for the user, then **assemble the
      nested tree** identical to §3.2, converting `*_at` columns to epoch-ms numbers and
      DB snake_case to the in-memory camelCase the components expect:
      - workspace: `{ id, name, color, createdAt, documents: [...], chats: [...] }`
      - document: `{ id, name, charCount, text, uploadedAt }`
      - chat: `{ id, title, documentId, createdAt, updatedAt, messages: [...] }`
      - message: `{ role, content, createdAt, displayContent? }` (omit `displayContent`
        when null, to match today's optional field).
      - Sort documents by `uploaded_at`, chats by `updated_at`, messages by `created_at asc`.
      - Implementation tip: 4 queries (`select *` per table filtered by `user_id`), then
        assemble in JS by grouping on `workspace_id`/`document_id`/`chat_id`. This avoids
        N+1 and is simplest.
    - Mutation helpers (each returns the inserted/updated row or throws):
      `insertWorkspace`, `updateWorkspace` (name/color), `deleteWorkspace`,
      `insertDocument`, `deleteDocument`, `insertChat`, `updateChat` (title/updatedAt),
      `deleteChat`, `insertMessage`. Each accepts the same data the current actions build.
      For inserts, pass the client-generated `id` and `user_id`.
  - Map camelCase↔snake_case at this boundary only (e.g. `documentId` → `document_id`).
  - Pitfalls: always include `user_id` on insert (don't rely solely on the default);
    select only needed columns where cheap, but full `text` is needed for hydration; do
    not leak snake_case into the React layer.
  - DoD: `db.js` exports a complete async API covering every current action + a
    `fetchStore` hydrator producing the exact in-memory shape.

- **Step 4.2 — Rewrite `useWorkspaces` to use `db.js` (optimistic + async).**
  - File: `client/src/hooks/useWorkspaces.js`.
  - Inspect first: every action's current behavior, especially `appendMessage`'s
    `storeRef` ordering and `selectWorkspace`'s "latest chat" logic.
  - Implement:
    - State: `store` (same shape, starts empty), plus `loading` and `error` states.
    - On the user being available (pass `user` in from `App`/context, or read `useAuth`
      inside the hook): call `fetchStore(user.id)` and `setStore`. On `SIGNED_OUT`/no user,
      reset to `emptyStore()`.
    - Keep `activeWorkspaceId`/`activeChatId` in local state (NOT persisted to DB — these
      are UI selection, fine to keep client-side; default to first workspace / latest chat
      after hydrate). Do not create a DB table for active selection.
    - For each action: **optimistic local update first** (build next store exactly as
      today using a `crypto.randomUUID()` id), then `await db.<mutation>(...)` in the
      background; on failure, roll back the local change and set a user-facing `error`.
    - Preserve `appendMessage` ordering: do the synchronous `storeRef`-based local update
      exactly as today (including the first-user-message title logic), then fire the
      message insert and, when a title is set, the chat `updateChat({title, updatedAt})`.
      Insert user message then assistant message in order.
    - Keep the same return object keys; you MAY add `loading`/`error`. Remove
      `quotaError` (see Phase 5) OR repurpose it as a generic `error` — pick one and
      update `App`/`Sidebar`/`WorkspacePanel` accordingly.
  - Pitfalls: don't make callers `await` (keep `createWorkspace` returning the id from the
    optimistic branch); don't double-insert under StrictMode (hydration effect must be
    keyed on user id and guarded); keep numeric timestamps.
  - DoD: all actions update the UI instantly and persist to Supabase; reload reflects DB
    state; switching accounts shows different data.

- **Step 4.3 — Delete/retire `localStorage` usage in `storage.js`.**
  - File: `client/src/lib/storage.js`.
  - Action: remove `STORE_KEY`, `loadStore`, `saveStore`, `StorageQuotaError`. KEEP
    `newId` (or move to `db.js`/inline `crypto.randomUUID()`), and KEEP `isOverDocLimit` /
    `workspaceTextBytes` / `WORKSPACE_DOC_LIMIT_BYTES` (still used as a soft size warning
    by `WorkspacePanel`). Update all importers accordingly.
  - Verify no remaining references: grep the client for `localStorage`, `loadStore`,
    `saveStore`, `StorageQuotaError`, `STORE_KEY`. There must be ZERO references to
    user-data localStorage after this step (Supabase's own auth localStorage keys are
    fine and managed by the SDK).
  - DoD: `grep -rn "localStorage" client/src` returns nothing except (none) — Supabase
    SDK manages its own storage internally, not in our code.

### Phase 5 — Wire auth/user into the data layer + fix quota/error UX

- **Step 5.1 — Pass the authenticated user into the data hook.**
  - Files: `client/src/App.jsx` (consume `useAuth()`; pass `user` to `useWorkspaces`, or
    have the hook consume `useAuth` directly), `useWorkspaces.js`.
  - Implement: ensure `useWorkspaces` only fetches when there's a user, and resets on
    logout. Show a brief loading state in the main area while `loading` is true
    (reuse/extend an existing empty-state container; keep it on-brand).
  - DoD: login → data loads; logout → data clears and auth screen shows.

- **Step 5.2 — Replace the localStorage quota UX.**
  - Files: `WorkspacePanel.jsx`, `App.jsx`, `useWorkspaces.js`.
  - Inspect first: current `quotaError` prop flow (App → Sidebar → WorkspacePanel) and the
    `.banner.info.quota-banner` rendering.
  - Implement: remove `StorageQuotaError`-based `quotaError`. Keep the `isOverDocLimit`
    soft-warning banner (still meaningful — large docs cost more to send to Claude). Add a
    generic `error` banner for failed Supabase writes ("Couldn't save your changes — check
    your connection and try again."). Reuse existing `.banner.error` styling.
  - DoD: no references to `StorageQuotaError`; soft size warning still works; write
    failures surface a friendly banner.

### Phase 6 — Document text storage confirmation

- **Step 6.1 — Confirm document text lives in Supabase and still reaches Claude.**
  - Files: `App.jsx` (`handleSend` reads `activeDocument.text`), `ChatWindow.jsx` /
    `DocumentList.jsx` (upload → `onAddDocument`).
  - Inspect first: upload flow — `uploadPdf(file)` (Express extracts text) →
    `onAddDocument(workspaceId, { name, charCount, text })`. Today text goes into the
    in-memory store. After Phase 4, `addDocument` inserts the row (with `text`) into
    Supabase and the optimistic store holds it too.
  - Verify: `activeDocument.text` is populated from `fetchStore` on reload (the column is
    selected), so chat still sends `documentText` to Express correctly after a refresh.
  - Pitfall: ensure `fetchStore` selects the `text` column (don't accidentally exclude it
    for "perf"). If you later lazy-load it, `handleSend` must still have it.
  - DoD: upload a PDF, refresh, start a chat — Claude still answers with document context;
    Network tab shows `documentText` populated in the `/api/chat/stream` request.

### Phase 7 — Server (no functional change) + optional hardening

- **Step 7.1 — Confirm the server needs no change.**
  - Files: `server/src/*` — read-only confirmation.
  - The Claude proxy holds no user data; data CRUD bypasses it. No new server env vars are
    required for the core plan.
  - DoD: server still builds/runs; `/api/chat/stream` unchanged.

- **Step 7.2 — (OPTIONAL, document but do not implement unless asked) JWT verification.**
  - If later required, the client would send the Supabase access token
    (`supabase.auth.getSession()` → `access_token`) as `Authorization: Bearer` to Express,
    and Express would verify it with the project's JWT secret
    (`SUPABASE_JWT_SECRET` / JWKS). This adds a `server/.env` var. **Not in scope now** —
    note it in README "Future hardening". Do NOT add the service-role key to the server.
  - DoD: a one-paragraph note exists; no code added.

### Phase 8 — Docs, env, deployment notes

- **Step 8.1 — Update `README.md`.**
  - Tech Stack: Persistence → "Supabase (Postgres + Auth + RLS)"; add Auth row
    (email/password + Google OAuth).
  - Architecture tree: add `client/src/lib/supabase.js`, `client/src/lib/db.js`,
    `client/src/context/AuthContext.jsx`, `client/src/components/AuthScreen.jsx`,
    `supabase/migrations/0001_init.sql`. Replace the `storage.js` (localStorage) line.
  - "Key design decisions": replace the localStorage bullet with Supabase + RLS + "data
    CRUD goes client→Supabase, Claude calls go through Express".
  - Environment Variables: add a **client** table rows for `VITE_SUPABASE_URL`,
    `VITE_SUPABASE_ANON_KEY`. Note the anon key is public/safe; the service-role key is
    NOT used and must never be in the client.
  - Deployment: add "Add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` to Vercel
    (Project → Settings → Environment Variables) and redeploy." Note Railway needs **no**
    new vars. Link to `supabase/README.md` for dashboard setup (SQL, Google provider,
    redirect URLs).
  - Security section: add RLS guarantees (per-user isolation), anon-key rationale.
  - Roadmap: update v4 ("Multi-user with Supabase") to reflect it's now done in v2a.
  - DoD: README accurately describes the new architecture; no stale localStorage claims.

- **Step 8.2 — Update `ROADMAP.md`** if it lists localStorage/multi-user — mark v2a auth
  + storage migration done, keep RAG as the next item. (Read it first; keep edits minimal
  and accurate.)
  - DoD: roadmap consistent with reality.

---

## 7. Testing Plan

> The repo has Vitest configured (`client` + `server`) but currently **no test files**.
> Add focused tests where they add real value (the hydration mapper + RLS), and rely on
> manual/Playwright flows for UI. Don't over-invest in brittle component tests.

### 7.1 Static checks / build

- `cd client && npm install` (picks up `@supabase/supabase-js`).
- `cd client && npm run build` — must succeed (catches missing env guard, import typos).
  Provide dummy `VITE_SUPABASE_URL`/`ANON_KEY` in the build env so the guard passes.
- `cd server && npm test` — existing server tests (if any) still pass; server unchanged.
- Grep gates (must all be empty of user-data usage):
  - `grep -rn "localStorage" client/src` → no app code references (SDK-internal only).
  - `grep -rn "loadStore\|saveStore\|StorageQuotaError\|studybot.workspaces" client/src` → none.

### 7.2 Unit test — hydration mapper (highest-value test)

- New file: `client/src/lib/db.test.js`.
- Test the pure assembly/mapping function: given representative DB rows (snake_case, ISO
  `*_at` strings), it returns the nested in-memory tree with:
  - camelCase keys (`documentId`, `createdAt`, `updatedAt`, `uploadedAt`, `charCount`,
    `displayContent`),
  - numeric epoch-ms timestamps,
  - correct grouping/nesting and sort order,
  - `displayContent` omitted when null.
- Recommend extracting the pure assembler (e.g. `assembleStore(rows)`) from `fetchStore`
  so it's testable without network. Run with `cd client && npm test`.

### 7.3 Manual / Playwright end-to-end flows (use the preview tooling)

Run the app (`npm run dev` at root runs server+client) against a real Supabase project,
then verify each flow. Use the browser preview/Playwright MCP for snapshots.

1. **Signup (email/password):** new email → either logged in or "confirm email" state per
   dashboard setting. Confirm, then log in. Lands on the app with an empty "Welcome /
   create a workspace" state.
2. **Login persistence:** refresh the page → still logged in, data present (no auth-screen
   flash beyond the splash).
3. **Google OAuth:** click "Continue with Google" → completes → returns to the app
   logged in. (Requires dashboard provider config; if not yet configured, verify the
   button triggers the redirect and document the dashboard requirement.)
4. **Workspace CRUD:** create (name + color), rename, recolor (preset + custom hex),
   delete (with confirm). Verify accent CSS vars update the UI. Reload → persisted.
5. **Document upload:** upload a PDF → appears in the sidebar with size; reload → still
   there; `documents.text` stored in Supabase (spot-check via Supabase Table Editor).
6. **Chat + streaming:** new chat (single doc auto-selects; multi-doc shows picker), send
   a message, see streaming tokens, assistant reply saved. Reload → full message history
   present and in order. Title set from first user message.
7. **Study-tool prompts:** Summarize, Notes, Diagram (renders Mermaid), Practice (quiz).
8. **Interactive quiz:** generate, answer, submit, see per-question grading + score
   (client-side, no extra API call). Confirm raw quiz JSON is suppressed in the bubble.
9. **Notes export:** export an assistant response → print-formatted page with workspace
   name, doc name, date.
10. **Delete cascade:** delete a document → its chats disappear; delete a workspace → its
    docs/chats/messages disappear (verify in Supabase Table Editor that child rows are
    gone via FK cascade).
11. **Logout:** click logout → returns to auth screen; in-memory data cleared (open
    DevTools → no `studybot.workspaces` localStorage key exists at all).

### 7.4 RLS / cross-user security test (hard requirement)

- Create **two** accounts (A and B) in two browser profiles. As A, create a workspace +
  doc + chat + message. As B, confirm B sees none of A's data.
- Direct API probe: in B's browser console (or a script) using B's session, run a
  Supabase query for all rows in each table — confirm only B's rows return, even when
  querying without a `user_id` filter (RLS must enforce it server-side). Attempt to
  `update`/`delete` one of A's row ids (if known) as B → must affect 0 rows / be denied.
- Optional SQL check in the dashboard: confirm each table shows "RLS enabled" and four
  policies.
- DoD: zero cross-user read/write is possible.

### 7.5 Negative / error paths

- Wrong password → friendly error, no crash, no raw error object.
- Duplicate signup email → friendly "account exists" message.
- Network offline during a save → optimistic UI rolls back + error banner appears.
- Missing `VITE_SUPABASE_*` at boot → clear thrown error (test by temporarily unsetting).

### 7.6 Regression checks

- All v1 features (workspace switcher meta counts, doc size display, relative chat times,
  empty states, accent theming, Mermaid, quiz suppression, notes export) behave exactly
  as before. Pay special attention to **relative timestamps and chat sort order** (the
  timestamp-conversion risk from §5).

---

## 8. Validation Checklist for Sonnet

- [ ] `client` builds (`npm run build`) with Supabase env vars set.
- [ ] `db.test.js` (hydration mapper) passes; `npm test` green in `client`.
- [ ] No app-code references to `localStorage`/`loadStore`/`saveStore`/`StorageQuotaError`.
- [ ] Auth screen matches the maroon/cream design system (tokens only, Playfair wordmark,
      DM Sans, maroon primary button, Google button).
- [ ] Email/password signup + login + Google OAuth all work; sessions persist on refresh.
- [ ] Logout control present, works, returns to auth screen, clears in-memory data.
- [ ] All four tables exist with RLS enabled + per-user policies (SELECT/INSERT/UPDATE/DELETE).
- [ ] Two-account test proves zero cross-user data access (reads AND writes).
- [ ] Every v1 feature works: workspace CRUD, upload, chat+streaming, prompts, quiz,
      notes export, dynamic accent colors.
- [ ] Document text is stored in Supabase and still reaches Claude after a reload.
- [ ] Relative chat times + sort order correct (timestamp conversion verified).
- [ ] Cascade deletes verified (doc→chats, workspace→all children).
- [ ] Service-role key is NOT in the client (or anywhere); only the anon key is exposed.
- [ ] README + ROADMAP updated; `supabase/README.md` runbook written; `.env.example`
      updated with `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY`.
- [ ] Express server unchanged and still proxies Claude correctly.
- [ ] No `git push` performed unless the user explicitly asked.

## 9. Suggested Execution Order for Sonnet

1. **Phase 0** — branch, install `@supabase/supabase-js`, env vars, `supabase.js` client.
2. **Phase 1** — write `0001_init.sql` + `supabase/README.md`. (Ask the user to create the
   Supabase project, run the SQL, configure Google + redirect URLs, and paste the URL +
   anon key into `client/.env`. You cannot do cloud steps yourself — surface these clearly.)
3. **Phase 2** — `AuthContext` + gating + splash.
4. **Phase 3** — `AuthScreen` UI + CSS + logout control.
5. **Phase 4** — `db.js` (with a pure `assembleStore`) → rewrite `useWorkspaces` →
   retire localStorage in `storage.js`. (This is the riskiest phase; do it after auth so
   you can actually log in and exercise it.)
6. **Phase 5** — wire user into the hook; fix quota/error UX.
7. **Phase 6** — confirm document text round-trips to Claude.
8. **Phase 7** — confirm server unchanged; note optional JWT hardening.
9. **Write the `db.test.js` unit test** (can be done alongside Phase 4).
10. **Phase 8** — docs/env/deploy notes.
11. **Testing Plan §7** — static checks, manual flows, and the two-account RLS test.

Commit at the end of each phase with a descriptive message (do NOT push). Verify the app
boots and the current phase's DoD before moving on.

## 10. Final Notes for Sonnet

- **Preserve the public API of `useWorkspaces` and the nested in-memory shape.** The whole
  migration's safety rests on components not needing changes. If you find yourself editing
  many components, stop — you've drifted from the plan; re-read §3.3.
- **Timestamps:** in-memory `*At` fields stay **numeric epoch ms**. Convert at the DB
  boundary only. This is the #1 subtle-regression source.
- **Optimistic updates with rollback**, not blocking awaits in the UI path — keep the app
  feeling instant like the localStorage version.
- **RLS is the security boundary.** Never weaken it for convenience. Always set `user_id`
  on insert. The anon key is meant to be public; the service-role key must never appear
  client-side and isn't needed here.
- **You cannot create the Supabase project, run SQL, or configure Google OAuth** — those
  are dashboard actions. Write the artifacts and instructions, then explicitly tell the
  user which manual steps to perform and what values to paste into `client/.env` (and
  later Vercel) before the app will run.
- **Do not deploy or push.** Both Vercel and Railway auto-deploy from `main`; pushing the
  branch is the user's call. Mention that `VITE_SUPABASE_URL`/`VITE_SUPABASE_ANON_KEY`
  must be added to Vercel before the next production deploy or the live site will break.
- **Rollback:** all work is on the `v2a-auth-supabase` branch; `main` stays deployable.
  If something goes wrong, `main` (localStorage v1) is untouched. Do not merge until the
  §7 RLS test passes.
- **Scope discipline:** no RAG, embeddings, vector search, Canvas, flashcards, or exam
  countdown. Auth + storage migration only.
