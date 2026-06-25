import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";

// ── Mock modules before imports ──────────────────────────────────────────────

const { mockDb } = vi.hoisted(() => {
  const mockDb = {
    fetchStore: vi.fn(),
    insertWorkspace: vi.fn(),
    updateWorkspace: vi.fn(),
    deleteWorkspaceRow: vi.fn(),
    insertDocument: vi.fn(),
    deleteDocumentRow: vi.fn(),
    insertChat: vi.fn(),
    updateChat: vi.fn(),
    deleteChatRow: vi.fn(),
    insertMessage: vi.fn(),
  };
  return { mockDb };
});

vi.mock("../context/AuthContext.jsx", () => ({
  useAuth: () => ({ user: { id: "u-1", email: "test@example.com" } }),
}));

vi.mock("../lib/storage.js", () => ({
  isOverDocLimit: () => false,
}));

vi.mock("../lib/db.js", () => mockDb);

import useWorkspaces from "./useWorkspaces.js";

// ── Helpers ──────────────────────────────────────────────────────────────────

function seedStore() {
  return {
    workspaces: [
      {
        id: "ws-1",
        name: "Biology",
        color: "forest",
        createdAt: 1000,
        documents: [
          { id: "doc-1", name: "notes.pdf", charCount: 100, text: "text", uploadedAt: 2000 },
        ],
        chats: [
          {
            id: "chat-1",
            title: "New chat",
            documentId: "doc-1",
            createdAt: 3000,
            updatedAt: 3000,
            messages: [],
          },
        ],
      },
      {
        id: "ws-2",
        name: "History",
        color: "maroon",
        createdAt: 500,
        documents: [],
        chats: [],
      },
    ],
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockDb.fetchStore.mockResolvedValue(seedStore());
  mockDb.insertWorkspace.mockResolvedValue(undefined);
  mockDb.updateWorkspace.mockResolvedValue(undefined);
  mockDb.deleteWorkspaceRow.mockResolvedValue(undefined);
  mockDb.insertDocument.mockResolvedValue(undefined);
  mockDb.deleteDocumentRow.mockResolvedValue(undefined);
  mockDb.insertChat.mockResolvedValue(undefined);
  mockDb.updateChat.mockResolvedValue(undefined);
  mockDb.deleteChatRow.mockResolvedValue(undefined);
  mockDb.insertMessage.mockResolvedValue(undefined);
});

async function renderAndHydrate() {
  const { result } = renderHook(() => useWorkspaces());
  await waitFor(() => expect(result.current.loading).toBe(false));
  return result;
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe("useWorkspaces — initial hydration", () => {
  it("calls fetchStore with the user id and populates store", async () => {
    const result = await renderAndHydrate();

    expect(mockDb.fetchStore).toHaveBeenCalledWith("u-1");
    expect(result.current.store.workspaces).toHaveLength(2);
    expect(result.current.activeWorkspace.id).toBe("ws-1");
  });

  it("sets activeChatId to the latest chat in the first workspace", async () => {
    const result = await renderAndHydrate();

    expect(result.current.store.activeChatId).toBe("chat-1");
  });

  it("sets error on fetchStore failure", async () => {
    mockDb.fetchStore.mockRejectedValue(new Error("network"));
    const { result } = renderHook(() => useWorkspaces());
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.error).toBe("Couldn't load your data — check your connection.");
  });
});

describe("useWorkspaces — createWorkspace (optimistic + rollback)", () => {
  it("optimistically adds a workspace and sets it active", async () => {
    const result = await renderAndHydrate();

    act(() => {
      result.current.createWorkspace({ name: "Chemistry", color: "blue" });
    });

    expect(result.current.store.workspaces).toHaveLength(3);
    const created = result.current.store.workspaces[2];
    expect(created.name).toBe("Chemistry");
    expect(created.color).toBe("blue");
    expect(created.documents).toEqual([]);
    expect(created.chats).toEqual([]);
    expect(result.current.activeWorkspace.name).toBe("Chemistry");
  });

  it("rolls back on DB write failure", async () => {
    mockDb.insertWorkspace.mockRejectedValue(new Error("write failed"));
    const result = await renderAndHydrate();

    act(() => {
      result.current.createWorkspace({ name: "Chemistry", color: "blue" });
    });

    expect(result.current.store.workspaces).toHaveLength(3);

    await waitFor(() => expect(result.current.error).toBeTruthy());

    expect(result.current.store.workspaces).toHaveLength(2);
    expect(result.current.error).toBe(
      "Couldn't save your changes — check your connection and try again."
    );
  });
});

describe("useWorkspaces — deleteWorkspace", () => {
  it("removes the workspace and re-points activeWorkspaceId", async () => {
    const result = await renderAndHydrate();

    act(() => {
      result.current.deleteWorkspace("ws-1");
    });

    expect(result.current.store.workspaces).toHaveLength(1);
    expect(result.current.store.activeWorkspaceId).toBe("ws-2");
    expect(result.current.store.activeChatId).toBeNull();
  });

  it("sets activeWorkspaceId to null when last workspace deleted", async () => {
    mockDb.fetchStore.mockResolvedValue({
      workspaces: [{ id: "ws-only", name: "Solo", color: "red", createdAt: 1, documents: [], chats: [] }],
    });
    const result = await renderAndHydrate();

    act(() => {
      result.current.deleteWorkspace("ws-only");
    });

    expect(result.current.store.workspaces).toHaveLength(0);
    expect(result.current.store.activeWorkspaceId).toBeNull();
  });

  it("rolls back on delete failure", async () => {
    mockDb.deleteWorkspaceRow.mockRejectedValue(new Error("delete failed"));
    const result = await renderAndHydrate();

    act(() => {
      result.current.deleteWorkspace("ws-1");
    });

    expect(result.current.store.workspaces).toHaveLength(1);

    await waitFor(() => expect(result.current.error).toBeTruthy());

    expect(result.current.store.workspaces).toHaveLength(2);
  });
});

describe("useWorkspaces — renameWorkspace", () => {
  it("optimistically renames", async () => {
    const result = await renderAndHydrate();

    act(() => {
      result.current.renameWorkspace("ws-1", "Biochemistry");
    });

    expect(result.current.activeWorkspace.name).toBe("Biochemistry");
    expect(mockDb.updateWorkspace).toHaveBeenCalledWith("ws-1", { name: "Biochemistry" });
  });

  it("trims whitespace and ignores empty names", async () => {
    const result = await renderAndHydrate();

    act(() => {
      result.current.renameWorkspace("ws-1", "   ");
    });

    expect(result.current.activeWorkspace.name).toBe("Biology");
    expect(mockDb.updateWorkspace).not.toHaveBeenCalled();
  });
});

describe("useWorkspaces — deleteDocument", () => {
  it("removes the document and its dependent chats", async () => {
    const result = await renderAndHydrate();

    act(() => {
      result.current.selectWorkspace("ws-1");
    });

    act(() => {
      result.current.deleteDocument("ws-1", "doc-1");
    });

    const ws = result.current.store.workspaces.find((w) => w.id === "ws-1");
    expect(ws.documents).toHaveLength(0);
    expect(ws.chats).toHaveLength(0);
    expect(result.current.store.activeChatId).toBeNull();
  });
});

describe("useWorkspaces — appendMessage (no-rollback asymmetry)", () => {
  it("appends a message optimistically and sets chat title on first user message", async () => {
    const result = await renderAndHydrate();

    act(() => {
      result.current.selectChat("chat-1");
    });

    act(() => {
      result.current.appendMessage("user", "What is mitosis?");
    });

    const chat = result.current.activeChat;
    expect(chat.messages).toHaveLength(1);
    expect(chat.messages[0].role).toBe("user");
    expect(chat.messages[0].content).toBe("What is mitosis?");
    expect(chat.title).toBe("What is mitosis?");
  });

  it("uses displayContent for the title when provided", async () => {
    const result = await renderAndHydrate();

    act(() => {
      result.current.selectChat("chat-1");
    });

    act(() => {
      result.current.appendMessage("user", "full prompt", "Summarize");
    });

    const chat = result.current.activeChat;
    expect(chat.title).toBe("Summarize");
    expect(chat.messages[0].displayContent).toBe("Summarize");
  });

  it("truncates title to 40 chars with ellipsis", async () => {
    const result = await renderAndHydrate();

    act(() => {
      result.current.selectChat("chat-1");
    });

    const longText = "A".repeat(50);
    act(() => {
      result.current.appendMessage("user", longText);
    });

    expect(result.current.activeChat.title).toBe("A".repeat(40) + "…");
  });

  it("does NOT rollback on save failure (documents asymmetry)", async () => {
    mockDb.insertMessage.mockRejectedValue(new Error("save failed"));
    const result = await renderAndHydrate();

    act(() => {
      result.current.selectChat("chat-1");
    });

    act(() => {
      result.current.appendMessage("user", "test message");
    });

    expect(result.current.activeChat.messages).toHaveLength(1);

    await waitFor(() => expect(result.current.error).toBeTruthy());

    expect(result.current.activeChat.messages).toHaveLength(1);
    expect(result.current.error).toBe("Couldn't save message — check your connection.");
  });
});

describe("useWorkspaces — createChat", () => {
  it("creates a chat and sets it active", async () => {
    const result = await renderAndHydrate();

    let chatId;
    act(() => {
      chatId = result.current.createChat("ws-1", "doc-1");
    });

    expect(chatId).toBeTruthy();
    const ws = result.current.store.workspaces.find((w) => w.id === "ws-1");
    expect(ws.chats).toHaveLength(2);
    expect(result.current.store.activeChatId).toBe(chatId);
  });

  it("returns null for non-existent workspace", async () => {
    const result = await renderAndHydrate();

    let chatId;
    act(() => {
      chatId = result.current.createChat("ws-nonexistent", "doc-1");
    });

    expect(chatId).toBeNull();
  });

  it("returns null for non-existent document", async () => {
    const result = await renderAndHydrate();

    let chatId;
    act(() => {
      chatId = result.current.createChat("ws-1", "doc-nonexistent");
    });

    expect(chatId).toBeNull();
  });
});

describe("useWorkspaces — deleteChat", () => {
  it("removes the chat and clears activeChatId if it was active", async () => {
    const result = await renderAndHydrate();

    act(() => {
      result.current.selectChat("chat-1");
    });

    act(() => {
      result.current.deleteChat("chat-1");
    });

    const ws = result.current.store.workspaces.find((w) => w.id === "ws-1");
    expect(ws.chats).toHaveLength(0);
    expect(result.current.store.activeChatId).toBeNull();
  });
});
