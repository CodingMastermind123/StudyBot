import { supabase } from "./supabase.js";

// ─── Hydration: DB rows → nested in-memory tree ────────────────────────────

function tsToMs(isoString) {
  return isoString ? new Date(isoString).getTime() : Date.now();
}

export function assembleStore(workspaceRows, documentRows, chatRows, messageRows) {
  const docsByWs = Object.groupBy(documentRows, (d) => d.workspace_id);
  const chatsByWs = Object.groupBy(chatRows, (c) => c.workspace_id);
  const msgsByChat = Object.groupBy(messageRows, (m) => m.chat_id);

  const workspaces = workspaceRows.map((ws) => {
    const docs = (docsByWs[ws.id] || [])
      .sort((a, b) => tsToMs(a.uploaded_at) - tsToMs(b.uploaded_at))
      .map((d) => ({
        id: d.id,
        name: d.name,
        charCount: d.char_count,
        ingestStatus: d.ingest_status || "pending",
        chunkCount: d.chunk_count || 0,
        uploadedAt: tsToMs(d.uploaded_at),
      }));

    const chats = (chatsByWs[ws.id] || [])
      .sort((a, b) => tsToMs(a.updated_at) - tsToMs(b.updated_at))
      .map((c) => {
        const msgs = (msgsByChat[c.id] || [])
          .sort((a, b) => tsToMs(a.created_at) - tsToMs(b.created_at))
          .map((m) => {
            const msg = {
              role: m.role,
              content: m.content,
              createdAt: tsToMs(m.created_at),
            };
            if (m.display_content) msg.displayContent = m.display_content;
            return msg;
          });

        return {
          id: c.id,
          title: c.title,
          documentId: c.document_id,
          createdAt: tsToMs(c.created_at),
          updatedAt: tsToMs(c.updated_at),
          messages: msgs,
        };
      });

    return {
      id: ws.id,
      name: ws.name,
      color: ws.color,
      createdAt: tsToMs(ws.created_at),
      documents: docs,
      chats,
    };
  });

  return { workspaces };
}

// ─── Full store fetch ──────────────────────────────────────────────────────

export async function fetchStore(userId) {
  const [wsRes, docRes, chatRes, msgRes] = await Promise.all([
    supabase.from("workspaces").select("*").eq("user_id", userId),
    supabase.from("documents").select("id,workspace_id,user_id,name,char_count,uploaded_at,ingest_status,chunk_count").eq("user_id", userId),
    supabase.from("chats").select("*").eq("user_id", userId),
    supabase.from("messages").select("*").eq("user_id", userId),
  ]);

  for (const res of [wsRes, docRes, chatRes, msgRes]) {
    if (res.error) throw res.error;
  }

  return assembleStore(wsRes.data, docRes.data, chatRes.data, msgRes.data);
}

// ─── Mutation helpers ──────────────────────────────────────────────────────

export async function insertWorkspace({ id, userId, name, color }) {
  const { error } = await supabase.from("workspaces").insert({
    id,
    user_id: userId,
    name,
    color,
  });
  if (error) throw error;
}

export async function updateWorkspace(id, fields) {
  const update = {};
  if (fields.name !== undefined) update.name = fields.name;
  if (fields.color !== undefined) update.color = fields.color;
  const { error } = await supabase.from("workspaces").update(update).eq("id", id);
  if (error) throw error;
}

export async function deleteWorkspaceRow(id) {
  const { error } = await supabase.from("workspaces").delete().eq("id", id);
  if (error) throw error;
}

export async function insertDocument({ id, workspaceId, userId, name, charCount, text }) {
  const { error } = await supabase.from("documents").insert({
    id,
    workspace_id: workspaceId,
    user_id: userId,
    name,
    char_count: charCount,
    text,
  });
  if (error) throw error;
}

export async function deleteDocumentRow(id) {
  const { error } = await supabase.from("documents").delete().eq("id", id);
  if (error) throw error;
}

export async function insertChat({ id, workspaceId, documentId, userId, title }) {
  const { error } = await supabase.from("chats").insert({
    id,
    workspace_id: workspaceId,
    document_id: documentId,
    user_id: userId,
    title,
  });
  if (error) throw error;
}

export async function updateChat(id, fields) {
  const update = {};
  if (fields.title !== undefined) update.title = fields.title;
  if (fields.updatedAt !== undefined) update.updated_at = new Date(fields.updatedAt).toISOString();
  const { error } = await supabase.from("chats").update(update).eq("id", id);
  if (error) throw error;
}

export async function deleteChatRow(id) {
  const { error } = await supabase.from("chats").delete().eq("id", id);
  if (error) throw error;
}

export async function insertMessage({ id, chatId, userId, role, content, displayContent }) {
  const row = {
    id,
    chat_id: chatId,
    user_id: userId,
    role,
    content,
  };
  if (displayContent) row.display_content = displayContent;
  const { error } = await supabase.from("messages").insert(row);
  if (error) throw error;
}
