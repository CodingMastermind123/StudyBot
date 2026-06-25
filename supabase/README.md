# Supabase Setup — StudyBot v2a

Follow these steps to set up the Supabase backend for StudyBot. You'll need a
free Supabase account at [supabase.com](https://supabase.com).

---

## 1. Create a Supabase Project

1. Go to [supabase.com/dashboard](https://supabase.com/dashboard) → **New Project**.
2. Pick an org, name the project (e.g. `studybot`), set a database password, choose a region close to your users.
3. Wait for provisioning to finish.

## 2. Copy Your API Credentials

1. Go to **Project Settings → API**.
2. Copy the **Project URL** and the **anon / public** key.
3. Paste them into `client/.env`:
   ```
   VITE_SUPABASE_URL=https://<your-ref>.supabase.co
   VITE_SUPABASE_ANON_KEY=eyJ...
   ```
4. Later, add the same two vars to **Vercel → Project → Settings → Environment Variables** before deploying.

> The **anon key** is safe to expose in the client bundle — Row Level Security (RLS) is the security boundary. The **service-role key** must NEVER be put in the client or committed to the repo.

## 3. Run the Database Migration

1. In the Supabase dashboard, go to **SQL Editor → New Query**.
2. Paste the entire contents of [`migrations/0001_init.sql`](migrations/0001_init.sql).
3. Click **Run**.
4. Verify in **Table Editor** that four tables exist: `workspaces`, `documents`, `chats`, `messages`.
5. Verify in **Authentication → Policies** (or each table's RLS tab) that every table shows **RLS enabled** with four policies (select, insert, update, delete).

If you already ran `0001_init.sql` before `0002_harden_child_rls.sql` existed, run
[`migrations/0002_harden_child_rls.sql`](migrations/0002_harden_child_rls.sql) once.
It tightens child-table insert/update policies so documents, chats, and messages can
only reference parent rows owned by the same authenticated user.

### RAG migration (v2b)

6. Run [`migrations/0003_rag_pgvector.sql`](migrations/0003_rag_pgvector.sql) in the SQL Editor.
7. Verify:
   - The `vector` extension exists (check **Database → Extensions**)
   - The `document_chunks` table exists with columns: `id, document_id, user_id, chunk_index, content, embedding, created_at`
   - The `documents` table has new columns: `ingest_status` (text), `chunk_count` (integer)
   - `document_chunks` has RLS enabled with 4 policies (select, insert, update, delete)
   - The `match_document_chunks` function exists (check **Database → Functions**)

## 4. Enable Email Auth

1. Go to **Authentication → Providers → Email**.
2. Email is enabled by default. Note the **Confirm email** toggle:
   - **On** (default): new signups must click a confirmation link before they can log in. Good for production.
   - **Off**: users can log in immediately after signup. Easier for local testing.
3. Choose whichever suits your current needs — the app handles both states gracefully.

## 5. Enable Google OAuth

1. Go to [Google Cloud Console](https://console.cloud.google.com/) → **APIs & Services → Credentials**.
2. Create an **OAuth consent screen** (External, add your app name and email).
3. Create an **OAuth 2.0 Client ID** (Web application).
   - **Authorized redirect URI**: `https://<your-supabase-ref>.supabase.co/auth/v1/callback`
     (find your ref in Supabase → Project Settings → General).
4. Copy the **Client ID** and **Client Secret**.
5. In Supabase dashboard → **Authentication → Providers → Google**:
   - Toggle **Enable**.
   - Paste the Client ID and Client Secret.
   - Save.

> The Google client secret stays in the Supabase dashboard only — it is never in the repo or client bundle.

## 6. Configure Redirect URLs

1. Go to **Authentication → URL Configuration**.
2. Set **Site URL** to your production domain: `https://study-bot-lovat.vercel.app`
3. Under **Redirect URLs**, add:
   - `http://localhost:5173` (local dev)
   - `https://study-bot-lovat.vercel.app` (production)

---

## 7. Verify RLS Isolation

This confirms that Row Level Security prevents cross-user data access. You need two separate user accounts.

### App-level check (recommended)

1. **User A** — log in, create a workspace, upload a document, start a chat, send a message.
2. **User B** — log in with a different account (use a second browser or incognito window).
3. Verify User B sees **no workspaces, documents, chats, or messages** from User A.
4. Open the browser Network tab while logged in as User B. Confirm the four `select` requests to `*.supabase.co/rest/v1/{workspaces,documents,chats,messages}` each return **empty arrays** (`[]`).
5. As User B, create a workspace and verify User A cannot see it either.

### Cross-owner insert check

1. While logged in as User B, open the browser console and note one of User A's workspace IDs (you can find it in the Supabase dashboard → Table Editor → workspaces).
2. Attempt to insert a document referencing User A's `workspace_id`:
   - In the Supabase **SQL Editor** (logged in as admin), run:
     ```sql
     -- Replace <user_b_id> and <user_a_workspace_id> with real UUIDs
     set request.jwt.claims = '{"sub": "<user_b_id>", "role": "authenticated"}';
     set role = 'authenticated';
     insert into documents (workspace_id, user_id, name, char_count, text)
     values ('<user_a_workspace_id>', '<user_b_id>', 'attack.pdf', 0, 'test');
     ```
   - This must be **rejected** by the parent-ownership policy (`documents_insert` checks that the workspace belongs to the inserting user).
3. Repeat for chats and messages with cross-user parent IDs — all must be rejected.

### Chunk RLS isolation (v2b)

1. **User A** — upload and ingest a document (wait for "ready" status).
2. **User B** — in the Supabase SQL Editor, simulate User B querying User A's chunks:
   ```sql
   set request.jwt.claims = '{"sub": "<user_b_id>", "role": "authenticated"}';
   set role = 'authenticated';
   select * from document_chunks where document_id = '<user_a_doc_id>';
   ```
   This must return **zero rows** (RLS blocks cross-user access).
3. Attempt a cross-owner chunk insert:
   ```sql
   insert into document_chunks (document_id, user_id, chunk_index, content, embedding)
   values ('<user_a_doc_id>', '<user_b_id>', 0, 'attack', '[0,0,...,0]'::vector(1536));
   ```
   This must be **rejected** by the parent-ownership policy.
4. Call the RPC as User B against User A's document:
   ```sql
   select * from match_document_chunks('<user_a_doc_id>', '[0,0,...,0]'::vector(1536), 5);
   ```
   This must return **zero rows** (SECURITY INVOKER respects RLS).

### Expected results

- User B sees none of User A's data (and vice versa) — **pass**.
- Cross-owner inserts are rejected with a policy violation — **pass**.
- Chunk RLS isolation verified (no cross-user chunk access or RPC results) — **pass**.
- If either check fails, review the RLS policies in `migrations/0001_init.sql`, `0002_harden_child_rls.sql`, and `0003_rag_pgvector.sql`.

---

## Quick Checklist

- [ ] Project created, URL + anon key in `client/.env`
- [ ] Migration `0001_init.sql` executed, 4 tables with RLS enabled
- [ ] Migration `0002_harden_child_rls.sql` executed (parent-ownership checks)
- [ ] Migration `0003_rag_pgvector.sql` executed (pgvector, document_chunks, HNSW, RPC)
- [ ] Email auth enabled (confirm-email toggle set per preference)
- [ ] Google OAuth configured (Cloud Console credentials + Supabase provider)
- [ ] Site URL + redirect URLs set
- [ ] Vercel env vars added (before production deploy)
- [ ] Server env vars set: `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `OPENAI_API_KEY`
- [ ] RLS isolation verified (§7 — two-user cross-check including chunks)
