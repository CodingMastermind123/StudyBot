import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the supabase client before importing db.js
vi.mock("./supabase.js", () => ({
  supabase: { from: vi.fn() },
}));

import { supabase } from "./supabase.js";
import {
  insertWorkspace,
  updateWorkspace,
  deleteWorkspaceRow,
  insertDocument,
  deleteDocumentRow,
  insertChat,
  updateChat,
  deleteChatRow,
  insertMessage,
} from "./db.js";

function mockChain(terminal = { error: null }) {
  const chain = {
    insert: vi.fn().mockReturnValue(Promise.resolve(terminal)),
    update: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnValue(Promise.resolve(terminal)),
  };
  supabase.from.mockReturnValue(chain);
  return chain;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("insertWorkspace", () => {
  it("inserts with correct snake_case payload", async () => {
    const chain = mockChain();
    await insertWorkspace({ id: "ws-1", userId: "u-1", name: "Bio", color: "forest" });

    expect(supabase.from).toHaveBeenCalledWith("workspaces");
    expect(chain.insert).toHaveBeenCalledWith({
      id: "ws-1",
      user_id: "u-1",
      name: "Bio",
      color: "forest",
    });
  });

  it("throws when supabase returns an error", async () => {
    mockChain({ error: { message: "insert failed" } });
    await expect(
      insertWorkspace({ id: "ws-1", userId: "u-1", name: "Bio", color: "forest" })
    ).rejects.toEqual({ message: "insert failed" });
  });
});

describe("updateWorkspace", () => {
  it("sends only provided fields", async () => {
    const chain = mockChain();
    await updateWorkspace("ws-1", { name: "History" });

    expect(supabase.from).toHaveBeenCalledWith("workspaces");
    expect(chain.update).toHaveBeenCalledWith({ name: "History" });
    expect(chain.eq).toHaveBeenCalledWith("id", "ws-1");
  });

  it("sends color when provided", async () => {
    const chain = mockChain();
    await updateWorkspace("ws-1", { color: "maroon" });

    expect(chain.update).toHaveBeenCalledWith({ color: "maroon" });
  });

  it("throws on error", async () => {
    mockChain({ error: { message: "update failed" } });
    await expect(updateWorkspace("ws-1", { name: "X" })).rejects.toEqual({
      message: "update failed",
    });
  });
});

describe("deleteWorkspaceRow", () => {
  it("deletes by id", async () => {
    const chain = mockChain();
    await deleteWorkspaceRow("ws-1");

    expect(supabase.from).toHaveBeenCalledWith("workspaces");
    expect(chain.delete).toHaveBeenCalled();
    expect(chain.eq).toHaveBeenCalledWith("id", "ws-1");
  });

  it("throws on error", async () => {
    mockChain({ error: { message: "delete failed" } });
    await expect(deleteWorkspaceRow("ws-1")).rejects.toEqual({
      message: "delete failed",
    });
  });
});

describe("insertDocument", () => {
  it("maps camelCase to snake_case correctly", async () => {
    const chain = mockChain();
    await insertDocument({
      id: "doc-1",
      workspaceId: "ws-1",
      userId: "u-1",
      name: "notes.pdf",
      charCount: 500,
      text: "document text",
    });

    expect(supabase.from).toHaveBeenCalledWith("documents");
    expect(chain.insert).toHaveBeenCalledWith({
      id: "doc-1",
      workspace_id: "ws-1",
      user_id: "u-1",
      name: "notes.pdf",
      char_count: 500,
      text: "document text",
    });
  });

  it("throws on error", async () => {
    mockChain({ error: { message: "doc insert failed" } });
    await expect(
      insertDocument({
        id: "doc-1",
        workspaceId: "ws-1",
        userId: "u-1",
        name: "x.pdf",
        charCount: 1,
        text: "t",
      })
    ).rejects.toEqual({ message: "doc insert failed" });
  });
});

describe("deleteDocumentRow", () => {
  it("deletes by id", async () => {
    const chain = mockChain();
    await deleteDocumentRow("doc-1");

    expect(supabase.from).toHaveBeenCalledWith("documents");
    expect(chain.delete).toHaveBeenCalled();
    expect(chain.eq).toHaveBeenCalledWith("id", "doc-1");
  });
});

describe("insertChat", () => {
  it("maps camelCase to snake_case correctly", async () => {
    const chain = mockChain();
    await insertChat({
      id: "chat-1",
      workspaceId: "ws-1",
      documentId: "doc-1",
      userId: "u-1",
      title: "New chat",
    });

    expect(supabase.from).toHaveBeenCalledWith("chats");
    expect(chain.insert).toHaveBeenCalledWith({
      id: "chat-1",
      workspace_id: "ws-1",
      document_id: "doc-1",
      user_id: "u-1",
      title: "New chat",
    });
  });
});

describe("updateChat", () => {
  it("maps updatedAt to ISO snake_case", async () => {
    const chain = mockChain();
    const ts = Date.parse("2026-06-25T12:00:00.000Z");
    await updateChat("chat-1", { title: "Renamed", updatedAt: ts });

    expect(supabase.from).toHaveBeenCalledWith("chats");
    expect(chain.update).toHaveBeenCalledWith({
      title: "Renamed",
      updated_at: new Date(ts).toISOString(),
    });
    expect(chain.eq).toHaveBeenCalledWith("id", "chat-1");
  });

  it("sends only title when updatedAt is not provided", async () => {
    const chain = mockChain();
    await updateChat("chat-1", { title: "Only title" });

    expect(chain.update).toHaveBeenCalledWith({ title: "Only title" });
  });
});

describe("deleteChatRow", () => {
  it("deletes by id", async () => {
    const chain = mockChain();
    await deleteChatRow("chat-1");

    expect(supabase.from).toHaveBeenCalledWith("chats");
    expect(chain.delete).toHaveBeenCalled();
    expect(chain.eq).toHaveBeenCalledWith("id", "chat-1");
  });
});

describe("insertMessage", () => {
  it("includes display_content when displayContent is provided", async () => {
    const chain = mockChain();
    await insertMessage({
      id: "msg-1",
      chatId: "chat-1",
      userId: "u-1",
      role: "user",
      content: "full prompt text",
      displayContent: "Summarize",
    });

    expect(supabase.from).toHaveBeenCalledWith("messages");
    expect(chain.insert).toHaveBeenCalledWith({
      id: "msg-1",
      chat_id: "chat-1",
      user_id: "u-1",
      role: "user",
      content: "full prompt text",
      display_content: "Summarize",
    });
  });

  it("omits display_content when displayContent is not provided", async () => {
    const chain = mockChain();
    await insertMessage({
      id: "msg-2",
      chatId: "chat-1",
      userId: "u-1",
      role: "assistant",
      content: "response text",
    });

    const payload = chain.insert.mock.calls[0][0];
    expect(payload).not.toHaveProperty("display_content");
    expect(payload).toEqual({
      id: "msg-2",
      chat_id: "chat-1",
      user_id: "u-1",
      role: "assistant",
      content: "response text",
    });
  });

  it("throws on error", async () => {
    mockChain({ error: { message: "msg insert failed" } });
    await expect(
      insertMessage({
        id: "msg-1",
        chatId: "chat-1",
        userId: "u-1",
        role: "user",
        content: "text",
      })
    ).rejects.toEqual({ message: "msg insert failed" });
  });
});
