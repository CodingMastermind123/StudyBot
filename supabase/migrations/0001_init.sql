-- StudyBot v2a: Auth + Storage Migration
-- Run this in Supabase Dashboard → SQL Editor → New Query → paste → Run.

-- ── Workspaces ──────────────────────────────────────────────────────────────

create table workspaces (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade default auth.uid(),
  name       text not null,
  color      text not null,
  created_at timestamptz not null default now()
);

create index on workspaces(user_id);

alter table workspaces enable row level security;

create policy "workspaces_select" on workspaces for select
  using (user_id = auth.uid());
create policy "workspaces_insert" on workspaces for insert
  with check (user_id = auth.uid());
create policy "workspaces_update" on workspaces for update
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "workspaces_delete" on workspaces for delete
  using (user_id = auth.uid());

-- ── Documents ───────────────────────────────────────────────────────────────

create table documents (
  id           uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  user_id      uuid not null references auth.users(id) on delete cascade default auth.uid(),
  name         text not null,
  char_count   integer,
  text         text,
  uploaded_at  timestamptz not null default now()
);

create index on documents(workspace_id);

alter table documents enable row level security;

create policy "documents_select" on documents for select
  using (user_id = auth.uid());
create policy "documents_insert" on documents for insert
  with check (user_id = auth.uid());
create policy "documents_update" on documents for update
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "documents_delete" on documents for delete
  using (user_id = auth.uid());

-- ── Chats ───────────────────────────────────────────────────────────────────

create table chats (
  id           uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  document_id  uuid references documents(id) on delete cascade,
  user_id      uuid not null references auth.users(id) on delete cascade default auth.uid(),
  title        text not null default 'New chat',
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index on chats(workspace_id);
create index on chats(document_id);

alter table chats enable row level security;

create policy "chats_select" on chats for select
  using (user_id = auth.uid());
create policy "chats_insert" on chats for insert
  with check (user_id = auth.uid());
create policy "chats_update" on chats for update
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "chats_delete" on chats for delete
  using (user_id = auth.uid());

-- ── Messages ────────────────────────────────────────────────────────────────

create table messages (
  id              uuid primary key default gen_random_uuid(),
  chat_id         uuid not null references chats(id) on delete cascade,
  user_id         uuid not null references auth.users(id) on delete cascade default auth.uid(),
  role            text not null check (role in ('user', 'assistant')),
  content         text not null,
  display_content text,
  created_at      timestamptz not null default now()
);

create index on messages(chat_id);

alter table messages enable row level security;

create policy "messages_select" on messages for select
  using (user_id = auth.uid());
create policy "messages_insert" on messages for insert
  with check (user_id = auth.uid());
create policy "messages_update" on messages for update
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "messages_delete" on messages for delete
  using (user_id = auth.uid());
