import { useState, useCallback, useRef, useEffect } from "react";
import { useAuth } from "../context/AuthContext.jsx";
import { isOverDocLimit } from "../lib/storage.js";
import {
  fetchStore,
  insertWorkspace,
  updateWorkspace,
  deleteWorkspaceRow,
  insertDocument,
  deleteDocumentRow,
  insertChat,
  updateChat,
  deleteChatRow,
  insertMessage,
} from "../lib/db.js";

function emptyStore() {
  return { workspaces: [], activeWorkspaceId: null, activeChatId: null };
}

export default function useWorkspaces() {
  const { user } = useAuth();
  const [store, setStore] = useState(emptyStore);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const storeRef = useRef(store);
  storeRef.current = store;

  // Track which user we've hydrated for to avoid double-fetch under StrictMode
  const hydratedForRef = useRef(null);

  useEffect(() => {
    if (!user) {
      setStore(emptyStore());
      setLoading(false);
      hydratedForRef.current = null;
      return;
    }
    if (hydratedForRef.current === user.id) return;
    hydratedForRef.current = user.id;

    setLoading(true);
    fetchStore(user.id)
      .then((data) => {
        const first = data.workspaces[0];
        const latestChat = first?.chats.length
          ? first.chats.reduce((a, b) => (a.updatedAt > b.updatedAt ? a : b))
          : null;
        setStore({
          ...data,
          activeWorkspaceId: first?.id ?? null,
          activeChatId: latestChat?.id ?? null,
        });
      })
      .catch((err) => setError("Couldn't load your data — check your connection."))
      .finally(() => setLoading(false));
  }, [user]);

  // Optimistic persist: update local state immediately, fire DB write in background.
  // On failure, roll back and surface error.
  const persist = useCallback(
    (nextStore, dbWrite) => {
      const prev = storeRef.current;
      setStore(nextStore);
      if (dbWrite) {
        dbWrite().catch(() => {
          setStore(prev);
          setError("Couldn't save your changes — check your connection and try again.");
        });
      }
    },
    []
  );

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
      const id = crypto.randomUUID();
      const workspace = {
        id,
        name: name.trim(),
        color,
        createdAt: Date.now(),
        documents: [],
        chats: [],
      };
      persist(
        {
          ...storeRef.current,
          workspaces: [...storeRef.current.workspaces, workspace],
          activeWorkspaceId: id,
          activeChatId: null,
        },
        () => insertWorkspace({ id, userId: user.id, name: name.trim(), color })
      );
      return id;
    },
    [user, persist]
  );

  const selectWorkspace = useCallback(
    (id) => {
      const ws = storeRef.current.workspaces.find((w) => w.id === id);
      if (!ws) return;
      const latestChat =
        ws.chats.length > 0
          ? ws.chats.reduce((a, b) => (a.updatedAt > b.updatedAt ? a : b))
          : null;
      setStore({
        ...storeRef.current,
        activeWorkspaceId: id,
        activeChatId: latestChat?.id ?? null,
      });
    },
    []
  );

  const addDocument = useCallback(
    (workspaceId, { id, name, charCount, ingestStatus = "ready", chunkCount = 0 }) => {
      const docId = id || crypto.randomUUID();
      const doc = { id: docId, name, charCount, ingestStatus, chunkCount, uploadedAt: Date.now() };
      const nextWorkspaces = storeRef.current.workspaces.map((ws) => {
        if (ws.id !== workspaceId) return ws;
        const exists = ws.documents.some((d) => d.id === docId);
        if (exists) {
          return {
            ...ws,
            documents: ws.documents.map((d) => (d.id === docId ? { ...d, ...doc } : d)),
          };
        }
        return { ...ws, documents: [...ws.documents, doc] };
      });
      const updatedWs = nextWorkspaces.find((w) => w.id === workspaceId);
      const overLimit = updatedWs ? isOverDocLimit(updatedWs) : false;
      setStore({ ...storeRef.current, workspaces: nextWorkspaces });
      return { docId, overLimit };
    },
    []
  );

  const createChat = useCallback(
    (workspaceId, documentId) => {
      const ws = storeRef.current.workspaces.find((w) => w.id === workspaceId);
      if (!ws) return null;
      if (!ws.documents.find((d) => d.id === documentId)) return null;
      const chatId = crypto.randomUUID();
      const now = Date.now();
      const chat = {
        id: chatId,
        title: "New chat",
        documentId,
        createdAt: now,
        updatedAt: now,
        messages: [],
      };
      const nextWorkspaces = storeRef.current.workspaces.map((w) => {
        if (w.id !== workspaceId) return w;
        return { ...w, chats: [...w.chats, chat] };
      });
      persist(
        {
          ...storeRef.current,
          workspaces: nextWorkspaces,
          activeChatId: chatId,
        },
        () => insertChat({ id: chatId, workspaceId, documentId, userId: user.id, title: "New chat" })
      );
      return chatId;
    },
    [user, persist]
  );

  const selectChat = useCallback(
    (id) => {
      setStore({ ...storeRef.current, activeChatId: id });
    },
    []
  );

  const appendMessage = useCallback(
    (role, content, displayContent) => {
      const currentStore = storeRef.current;
      if (!currentStore.activeChatId) return;
      const now = Date.now();
      const msgId = crypto.randomUUID();
      const titleSource = displayContent || content;
      let shouldSetTitle = false;
      let newTitle = null;

      const nextWorkspaces = currentStore.workspaces.map((ws) => {
        const chatIdx = ws.chats.findIndex((c) => c.id === currentStore.activeChatId);
        if (chatIdx === -1) return ws;
        const chat = ws.chats[chatIdx];
        const isFirstUserMsg =
          role === "user" && chat.messages.every((m) => m.role !== "user");
        shouldSetTitle = isFirstUserMsg && chat.title === "New chat";
        if (shouldSetTitle) {
          newTitle = titleSource.trim().slice(0, 40) + (titleSource.trim().length > 40 ? "…" : "");
        }
        const msg = { role, content, createdAt: now };
        if (displayContent) msg.displayContent = displayContent;
        const updatedChat = {
          ...chat,
          title: shouldSetTitle ? newTitle : chat.title,
          updatedAt: now,
          messages: [...chat.messages, msg],
        };
        const newChats = [...ws.chats];
        newChats[chatIdx] = updatedChat;
        return { ...ws, chats: newChats };
      });

      const nextStore = { ...currentStore, workspaces: nextWorkspaces };
      setStore(nextStore);
      storeRef.current = nextStore;

      const chatId = currentStore.activeChatId;
      insertMessage({ id: msgId, chatId, userId: user.id, role, content, displayContent })
        .then(() => {
          if (shouldSetTitle) {
            return updateChat(chatId, { title: newTitle, updatedAt: now });
          }
          return updateChat(chatId, { updatedAt: now });
        })
        .catch(() => {
          setError("Couldn't save message — check your connection.");
        });
    },
    [user]
  );

  const deleteWorkspace = useCallback(
    (id) => {
      const nextWorkspaces = storeRef.current.workspaces.filter((w) => w.id !== id);
      const nextActiveId =
        storeRef.current.activeWorkspaceId === id
          ? (nextWorkspaces[0]?.id ?? null)
          : storeRef.current.activeWorkspaceId;
      const nextChatId =
        storeRef.current.activeWorkspaceId === id ? null : storeRef.current.activeChatId;
      persist(
        {
          ...storeRef.current,
          workspaces: nextWorkspaces,
          activeWorkspaceId: nextActiveId,
          activeChatId: nextChatId,
        },
        () => deleteWorkspaceRow(id)
      );
    },
    [persist]
  );

  const deleteChat = useCallback(
    (chatId) => {
      const nextWorkspaces = storeRef.current.workspaces.map((ws) => ({
        ...ws,
        chats: ws.chats.filter((c) => c.id !== chatId),
      }));
      const nextChatId = storeRef.current.activeChatId === chatId ? null : storeRef.current.activeChatId;
      persist(
        { ...storeRef.current, workspaces: nextWorkspaces, activeChatId: nextChatId },
        () => deleteChatRow(chatId)
      );
    },
    [persist]
  );

  const deleteDocument = useCallback(
    (workspaceId, docId) => {
      const nextWorkspaces = storeRef.current.workspaces.map((ws) => {
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
      const allRemainingChatIds = new Set(
        nextWorkspaces.flatMap((ws) => ws.chats.map((c) => c.id))
      );
      const nextChatId = allRemainingChatIds.has(storeRef.current.activeChatId)
        ? storeRef.current.activeChatId
        : null;
      persist(
        { ...storeRef.current, workspaces: nextWorkspaces, activeChatId: nextChatId },
        () => deleteDocumentRow(docId)
      );
    },
    [persist]
  );

  const renameWorkspace = useCallback(
    (id, name) => {
      const trimmed = name.trim();
      if (!trimmed) return;
      persist(
        {
          ...storeRef.current,
          workspaces: storeRef.current.workspaces.map((ws) =>
            ws.id === id ? { ...ws, name: trimmed } : ws
          ),
        },
        () => updateWorkspace(id, { name: trimmed })
      );
    },
    [persist]
  );

  const recolorWorkspace = useCallback(
    (id, colorId) => {
      persist(
        {
          ...storeRef.current,
          workspaces: storeRef.current.workspaces.map((ws) =>
            ws.id === id ? { ...ws, color: colorId } : ws
          ),
        },
        () => updateWorkspace(id, { color: colorId })
      );
    },
    [persist]
  );

  return {
    store,
    loading,
    error,
    activeWorkspace,
    activeChat,
    activeDocument,
    createWorkspace,
    selectWorkspace,
    addDocument,
    createChat,
    selectChat,
    appendMessage,
    deleteWorkspace,
    deleteChat,
    deleteDocument,
    renameWorkspace,
    recolorWorkspace,
  };
}
