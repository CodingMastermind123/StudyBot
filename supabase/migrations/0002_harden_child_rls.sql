-- StudyBot v2a: Harden child-table RLS parent ownership checks.
-- Run this after 0001_init.sql for existing Supabase projects.

-- ── Documents ───────────────────────────────────────────────────────────────

drop policy if exists "documents_insert" on documents;
drop policy if exists "documents_update" on documents;

create policy "documents_insert" on documents for insert
  with check (
    user_id = auth.uid()
    and exists (
      select 1 from workspaces
      where workspaces.id = documents.workspace_id
        and workspaces.user_id = auth.uid()
    )
  );

create policy "documents_update" on documents for update
  using (user_id = auth.uid())
  with check (
    user_id = auth.uid()
    and exists (
      select 1 from workspaces
      where workspaces.id = documents.workspace_id
        and workspaces.user_id = auth.uid()
    )
  );

-- ── Chats ───────────────────────────────────────────────────────────────────

drop policy if exists "chats_insert" on chats;
drop policy if exists "chats_update" on chats;

create policy "chats_insert" on chats for insert
  with check (
    user_id = auth.uid()
    and exists (
      select 1 from workspaces
      where workspaces.id = chats.workspace_id
        and workspaces.user_id = auth.uid()
    )
    and (
      document_id is null
      or exists (
        select 1 from documents
        where documents.id = chats.document_id
          and documents.workspace_id = chats.workspace_id
          and documents.user_id = auth.uid()
      )
    )
  );

create policy "chats_update" on chats for update
  using (user_id = auth.uid())
  with check (
    user_id = auth.uid()
    and exists (
      select 1 from workspaces
      where workspaces.id = chats.workspace_id
        and workspaces.user_id = auth.uid()
    )
    and (
      document_id is null
      or exists (
        select 1 from documents
        where documents.id = chats.document_id
          and documents.workspace_id = chats.workspace_id
          and documents.user_id = auth.uid()
      )
    )
  );

-- ── Messages ────────────────────────────────────────────────────────────────

drop policy if exists "messages_insert" on messages;
drop policy if exists "messages_update" on messages;

create policy "messages_insert" on messages for insert
  with check (
    user_id = auth.uid()
    and exists (
      select 1 from chats
      where chats.id = messages.chat_id
        and chats.user_id = auth.uid()
    )
  );

create policy "messages_update" on messages for update
  using (user_id = auth.uid())
  with check (
    user_id = auth.uid()
    and exists (
      select 1 from chats
      where chats.id = messages.chat_id
        and chats.user_id = auth.uid()
    )
  );
