import { describe, expect, it } from "vitest";
import { assembleStore } from "./db.js";

describe("assembleStore", () => {
  it("hydrates Supabase rows into the nested in-memory store shape", () => {
    const workspaceRows = [
      {
        id: "workspace-1",
        user_id: "user-1",
        name: "Biology",
        color: "forest",
        created_at: "2026-06-20T10:00:00.000Z",
      },
      {
        id: "workspace-2",
        user_id: "user-1",
        name: "History",
        color: "maroon",
        created_at: "2026-06-21T10:00:00.000Z",
      },
    ];

    const documentRows = [
      {
        id: "doc-2",
        workspace_id: "workspace-1",
        user_id: "user-1",
        name: "Later notes.pdf",
        char_count: 42,
        text: "later text",
        uploaded_at: "2026-06-22T12:00:00.000Z",
      },
      {
        id: "doc-1",
        workspace_id: "workspace-1",
        user_id: "user-1",
        name: "Earlier notes.pdf",
        char_count: 24,
        text: "earlier text",
        uploaded_at: "2026-06-22T09:00:00.000Z",
      },
    ];

    const chatRows = [
      {
        id: "chat-2",
        workspace_id: "workspace-1",
        document_id: "doc-2",
        user_id: "user-1",
        title: "Second chat",
        created_at: "2026-06-23T10:00:00.000Z",
        updated_at: "2026-06-23T13:00:00.000Z",
      },
      {
        id: "chat-1",
        workspace_id: "workspace-1",
        document_id: "doc-1",
        user_id: "user-1",
        title: "First chat",
        created_at: "2026-06-23T08:00:00.000Z",
        updated_at: "2026-06-23T09:00:00.000Z",
      },
    ];

    const messageRows = [
      {
        id: "message-2",
        chat_id: "chat-1",
        user_id: "user-1",
        role: "assistant",
        content: "answer",
        display_content: null,
        created_at: "2026-06-23T09:02:00.000Z",
      },
      {
        id: "message-1",
        chat_id: "chat-1",
        user_id: "user-1",
        role: "user",
        content: "question",
        display_content: "Summarize this",
        created_at: "2026-06-23T09:01:00.000Z",
      },
    ];

    expect(
      assembleStore(workspaceRows, documentRows, chatRows, messageRows)
    ).toEqual({
      workspaces: [
        {
          id: "workspace-1",
          name: "Biology",
          color: "forest",
          createdAt: Date.parse("2026-06-20T10:00:00.000Z"),
          documents: [
            {
              id: "doc-1",
              name: "Earlier notes.pdf",
              charCount: 24,
              text: "earlier text",
              uploadedAt: Date.parse("2026-06-22T09:00:00.000Z"),
            },
            {
              id: "doc-2",
              name: "Later notes.pdf",
              charCount: 42,
              text: "later text",
              uploadedAt: Date.parse("2026-06-22T12:00:00.000Z"),
            },
          ],
          chats: [
            {
              id: "chat-1",
              title: "First chat",
              documentId: "doc-1",
              createdAt: Date.parse("2026-06-23T08:00:00.000Z"),
              updatedAt: Date.parse("2026-06-23T09:00:00.000Z"),
              messages: [
                {
                  role: "user",
                  content: "question",
                  createdAt: Date.parse("2026-06-23T09:01:00.000Z"),
                  displayContent: "Summarize this",
                },
                {
                  role: "assistant",
                  content: "answer",
                  createdAt: Date.parse("2026-06-23T09:02:00.000Z"),
                },
              ],
            },
            {
              id: "chat-2",
              title: "Second chat",
              documentId: "doc-2",
              createdAt: Date.parse("2026-06-23T10:00:00.000Z"),
              updatedAt: Date.parse("2026-06-23T13:00:00.000Z"),
              messages: [],
            },
          ],
        },
        {
          id: "workspace-2",
          name: "History",
          color: "maroon",
          createdAt: Date.parse("2026-06-21T10:00:00.000Z"),
          documents: [],
          chats: [],
        },
      ],
    });
  });
});
