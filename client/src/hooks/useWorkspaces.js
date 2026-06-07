import { useState, useCallback } from "react";
import {
  loadStore,
  saveStore,
  newId,
  isOverDocLimit,
  StorageQuotaError,
} from "../lib/storage.js";

export default function useWorkspaces() {
  const [store, setStore] = useState(() => loadStore());
  const [quotaError, setQuotaError] = useState(null);

  // Persist a new store value; surfaces quota failures via quotaError state
  // instead of letting them crash a render.
  const persist = useCallback((nextStore) => {
    setStore(nextStore);
    try {
      saveStore(nextStore);
      setQuotaError(null);
    } catch (err) {
      if (err instanceof StorageQuotaError) {
        setQuotaError(err.message);
      } else {
        throw err;
      }
    }
  }, []);

  // ─── Derived selectors ──────────────────────────────────────────────────────

  const activeWorkspace =
    store.workspaces.find((w) => w.id === store.activeWorkspaceId) ?? null;

  const activeChat =
    activeWorkspace?.chats.find((c) => c.id === store.activeChatId) ?? null;

  const activeDocument =
    activeWorkspace?.documents.find(
      (d) => d.id === activeChat?.documentId
    ) ?? null;

  // ─── Actions ────────────────────────────────────────────────────────────────

  const createWorkspace = useCallback(
    ({ name, color }) => {
      const id = newId();
      const workspace = {
        id,
        name: name.trim(),
        color,
        createdAt: Date.now(),
        documents: [],
        chats: [],
      };
      persist({
        ...store,
        workspaces: [...store.workspaces, workspace],
        activeWorkspaceId: id,
        activeChatId: null,
      });
      return id;
    },
    [store, persist]
  );

  const selectWorkspace = useCallback(
    (id) => {
      const ws = store.workspaces.find((w) => w.id === id);
      if (!ws) return;
      // Pick the most-recently-updated chat in the new workspace, or null
      const latestChat =
        ws.chats.length > 0
          ? ws.chats.reduce((a, b) => (a.updatedAt > b.updatedAt ? a : b))
          : null;
      persist({
        ...store,
        activeWorkspaceId: id,
        activeChatId: latestChat?.id ?? null,
      });
    },
    [store, persist]
  );

  const addDocument = useCallback(
    (workspaceId, { name, charCount, text }) => {
      const docId = newId();
      const doc = { id: docId, name, charCount, text, uploadedAt: Date.now() };
      const nextWorkspaces = store.workspaces.map((ws) => {
        if (ws.id !== workspaceId) return ws;
        return { ...ws, documents: [...ws.documents, doc] };
      });
      const updatedWs = nextWorkspaces.find((w) => w.id === workspaceId);
      const overLimit = updatedWs ? isOverDocLimit(updatedWs) : false;
      persist({ ...store, workspaces: nextWorkspaces });
      return { docId, overLimit };
    },
    [store, persist]
  );

  const createChat = useCallback(
    (workspaceId, documentId) => {
      const ws = store.workspaces.find((w) => w.id === workspaceId);
      if (!ws) return null;
      // Guard: documentId must belong to this workspace
      if (!ws.documents.find((d) => d.id === documentId)) return null;
      const chatId = newId();
      const now = Date.now();
      const chat = {
        id: chatId,
        title: "New chat",
        documentId,
        createdAt: now,
        updatedAt: now,
        messages: [],
      };
      const nextWorkspaces = store.workspaces.map((w) => {
        if (w.id !== workspaceId) return w;
        return { ...w, chats: [...w.chats, chat] };
      });
      persist({
        ...store,
        workspaces: nextWorkspaces,
        activeChatId: chatId,
      });
      return chatId;
    },
    [store, persist]
  );

  const selectChat = useCallback(
    (id) => {
      persist({ ...store, activeChatId: id });
    },
    [store, persist]
  );

  // appendMessage targets the active chat by id to avoid stale-closure index issues.
  const appendMessage = useCallback(
    (role, content) => {
      if (!store.activeChatId) return;
      const now = Date.now();
      const nextWorkspaces = store.workspaces.map((ws) => {
        const chatIdx = ws.chats.findIndex((c) => c.id === store.activeChatId);
        if (chatIdx === -1) return ws;
        const chat = ws.chats[chatIdx];
        const isFirstUserMsg =
          role === "user" && chat.messages.every((m) => m.role !== "user");
        const updatedChat = {
          ...chat,
          title: isFirstUserMsg
            ? content.trim().slice(0, 40) + (content.trim().length > 40 ? "…" : "")
            : chat.title,
          updatedAt: now,
          messages: [...chat.messages, { role, content }],
        };
        const newChats = [...ws.chats];
        newChats[chatIdx] = updatedChat;
        return { ...ws, chats: newChats };
      });
      persist({ ...store, workspaces: nextWorkspaces });
    },
    [store, persist]
  );

  const deleteWorkspace = useCallback(
    (id) => {
      const nextWorkspaces = store.workspaces.filter((w) => w.id !== id);
      const nextActiveId =
        store.activeWorkspaceId === id
          ? (nextWorkspaces[0]?.id ?? null)
          : store.activeWorkspaceId;
      // If the active workspace changed, reset activeChatId too
      const nextChatId =
        store.activeWorkspaceId === id ? null : store.activeChatId;
      persist({
        ...store,
        workspaces: nextWorkspaces,
        activeWorkspaceId: nextActiveId,
        activeChatId: nextChatId,
      });
    },
    [store, persist]
  );

  const deleteChat = useCallback(
    (chatId) => {
      const nextWorkspaces = store.workspaces.map((ws) => ({
        ...ws,
        chats: ws.chats.filter((c) => c.id !== chatId),
      }));
      const nextChatId = store.activeChatId === chatId ? null : store.activeChatId;
      persist({ ...store, workspaces: nextWorkspaces, activeChatId: nextChatId });
    },
    [store, persist]
  );

  // Deleting a document also removes all chats tied to it in the same workspace.
  const deleteDocument = useCallback(
    (workspaceId, docId) => {
      const nextWorkspaces = store.workspaces.map((ws) => {
        if (ws.id !== workspaceId) return ws;
        const orphanChatIds = new Set(
          ws.chats.filter((c) => c.documentId === docId).map((c) => c.id)
        );
        return {
          ...ws,
          documents: ws.documents.filter((d) => d.id !== docId),
          chats: ws.chats.filter((c) => !orphanChatIds.has(c.id)),
        };
      });
      // If the active chat was in the deleted set, clear it
      const allRemainingChatIds = new Set(
        nextWorkspaces.flatMap((ws) => ws.chats.map((c) => c.id))
      );
      const nextChatId = allRemainingChatIds.has(store.activeChatId)
        ? store.activeChatId
        : null;
      persist({ ...store, workspaces: nextWorkspaces, activeChatId: nextChatId });
    },
    [store, persist]
  );

  return {
    store,
    quotaError,
    // Selectors
    activeWorkspace,
    activeChat,
    activeDocument,
    // Actions
    createWorkspace,
    selectWorkspace,
    addDocument,
    createChat,
    selectChat,
    appendMessage,
    deleteWorkspace,
    deleteChat,
    deleteDocument,
  };
}
