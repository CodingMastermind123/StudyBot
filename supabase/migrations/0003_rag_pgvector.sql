-- StudyBot v2b: RAG pipeline — pgvector, document_chunks, HNSW index, RLS, similarity RPC.
-- Run this in Supabase Dashboard → SQL Editor → New Query → paste → Run.

-- ── pgvector extension ─────────────────────────────────────────────────────

create extension if not exists vector;

-- ── Ingestion status columns on documents ──────────────────────────────────

alter table documents add column if not exists ingest_status text not null default 'pending';
alter table documents add column if not exists chunk_count integer not null default 0;

-- ── Document chunks table ──────────────────────────────────────────────────

create table document_chunks (
  id          uuid primary key default gen_random_uuid(),
  document_id uuid not null references documents(id) on delete cascade,
  user_id     uuid not null references auth.users(id) on delete cascade default auth.uid(),
  chunk_index integer not null,
  content     text not null,
  embedding   vector(1536) not null,
  created_at  timestamptz not null default now()
);

create index on document_chunks(document_id);

-- HNSW index for cosine similarity — no training step, strong recall,
-- handles incremental per-upload inserts well.
create index on document_chunks using hnsw (embedding vector_cosine_ops)
  with (m = 16, ef_construction = 64);

-- ── RLS ────────────────────────────────────────────────────────────────────

alter table document_chunks enable row level security;

create policy "document_chunks_select" on document_chunks for select
  using (user_id = auth.uid());

create policy "document_chunks_insert" on document_chunks for insert
  with check (
    user_id = auth.uid()
    and exists (
      select 1 from documents d
      where d.id = document_chunks.document_id
        and d.user_id = auth.uid()
    )
  );

create policy "document_chunks_update" on document_chunks for update
  using (user_id = auth.uid())
  with check (
    user_id = auth.uid()
    and exists (
      select 1 from documents d
      where d.id = document_chunks.document_id
        and d.user_id = auth.uid()
    )
  );

create policy "document_chunks_delete" on document_chunks for delete
  using (user_id = auth.uid());

-- ── Similarity search RPC ──────────────────────────────────────────────────
-- SECURITY INVOKER (default) so RLS applies — user only matches own chunks.

create or replace function match_document_chunks(
  p_document_id uuid,
  p_query_embedding vector(1536),
  p_match_count int default 8
)
returns table (id uuid, chunk_index int, content text, similarity float)
language sql stable
as $$
  select c.id, c.chunk_index, c.content,
         1 - (c.embedding <=> p_query_embedding) as similarity
  from document_chunks c
  where c.document_id = p_document_id
  order by c.embedding <=> p_query_embedding
  limit p_match_count;
$$;

grant execute on function match_document_chunks(uuid, vector, int) to authenticated;
