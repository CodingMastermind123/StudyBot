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

## Quick Checklist

- [ ] Project created, URL + anon key in `client/.env`
- [ ] Migration SQL executed, 4 tables with RLS enabled
- [ ] Email auth enabled (confirm-email toggle set per preference)
- [ ] Google OAuth configured (Cloud Console credentials + Supabase provider)
- [ ] Site URL + redirect URLs set
- [ ] Vercel env vars added (before production deploy)
