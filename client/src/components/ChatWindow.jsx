import { useEffect, useRef, useState } from "react";
import MessageBubble from "./MessageBubble.jsx";
import { ingestDocument } from "../api.js";

/* ── Inline SVG icons for empty states ─────────────────────────────────── */
function BookIcon() {
  return (
    <svg className="empty-icon" width="52" height="52" viewBox="0 0 24 24"
      fill="none" stroke="currentColor" strokeWidth="1.2"
      strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
      <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
    </svg>
  );
}

function UploadDocIcon() {
  return (
    <svg className="empty-icon" width="52" height="52" viewBox="0 0 24 24"
      fill="none" stroke="currentColor" strokeWidth="1.2"
      strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="12" y1="18" x2="12" y2="12" />
      <polyline points="9 15 12 12 15 15" />
    </svg>
  );
}

function ChatIcon() {
  return (
    <svg className="empty-icon" width="52" height="52" viewBox="0 0 24 24"
      fill="none" stroke="currentColor" strokeWidth="1.2"
      strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  );
}

export default function ChatWindow({ activeWorkspace, activeChat, isLoading, streamingContent, hideStreaming, onAddDocument, onSend }) {
  const bottomRef = useRef(null);
  const containerRef = useRef(null);

  // ── Center upload zone state ───────────────────────────────────────────────
  const fileInputRef = useRef(null);
  const [ingestState, setIngestState] = useState(null); // { phase, done, total }
  const [uploadError, setUploadError] = useState(null);
  const uploading = !!ingestState;

  async function handleCenterFile(file) {
    if (!file) return;
    if (file.type !== "application/pdf") {
      setUploadError("Only PDF files are supported.");
      return;
    }
    const docId = crypto.randomUUID();
    setIngestState({ phase: "extracting" });
    setUploadError(null);
    onAddDocument(activeWorkspace.id, {
      id: docId,
      name: file.name,
      charCount: 0,
      ingestStatus: "processing",
    });
    try {
      const result = await ingestDocument({
        file,
        documentId: docId,
        workspaceId: activeWorkspace.id,
        name: file.name,
        onProgress: (event) => setIngestState(event),
      });
      if (result) {
        onAddDocument(activeWorkspace.id, {
          id: docId,
          name: file.name,
          charCount: result.charCount,
          ingestStatus: "ready",
          chunkCount: result.chunkCount,
        });
      }
    } catch (err) {
      onAddDocument(activeWorkspace.id, {
        id: docId,
        name: file.name,
        charCount: 0,
        ingestStatus: "failed",
      });
      setUploadError(err.message || "Upload failed. Please try again.");
    } finally {
      setIngestState(null);
    }
  }

  // Auto-scroll to bottom on new messages and on each streaming token,
  // but only when already near the bottom so we don't yank the view when
  // the user has scrolled up to read history.
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    if (distanceFromBottom < 120) {
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [activeChat?.messages?.length, isLoading, streamingContent]);

  // Context-aware empty states
  if (!activeWorkspace) {
    return (
      <div className="chat-window" ref={containerRef}>
        <div className="empty-state">
          <BookIcon />
          <p className="empty-state-title">Welcome to StudyBot</p>
          <p className="empty-state-sub">Create a workspace in the sidebar to get started.</p>
        </div>
      </div>
    );
  }

  if (activeWorkspace.documents.length === 0) {
    return (
      <div className="chat-window" ref={containerRef}>
        <div className="empty-state upload-state">
          <div
            className={`upload-state-box${uploading ? " uploading" : ""}`}
            onClick={() => !uploading && fileInputRef.current?.click()}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => e.key === "Enter" && !uploading && fileInputRef.current?.click()}
          >
            <UploadDocIcon />
            {uploading ? (
              <>
                <p className="empty-state-title">
                  {ingestState?.phase === "extracting" && "Reading PDF…"}
                  {ingestState?.phase === "embedding" && `Embedding chunks (${ingestState.done}/${ingestState.total})`}
                  {ingestState?.phase === "done" && "Ready"}
                  {!ingestState?.phase && "Processing…"}
                </p>
                {ingestState?.phase === "embedding" && ingestState.total > 0 && (
                  <div className="ingest-progress-bar">
                    <div
                      className="ingest-progress-fill"
                      style={{ width: `${Math.round((ingestState.done / ingestState.total) * 100)}%` }}
                    />
                  </div>
                )}
              </>
            ) : (
              <>
                <p className="empty-state-title">Upload a document</p>
                <p className="empty-state-sub">Click to choose a PDF, or drag & drop one here.</p>
              </>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept="application/pdf"
              style={{ display: "none" }}
              onChange={(e) => { handleCenterFile(e.target.files[0]); e.target.value = ""; }}
              disabled={uploading}
            />
          </div>
          {uploadError && (
            <p className="upload-center-error">{uploadError}</p>
          )}
        </div>
      </div>
    );
  }

  if (!activeChat) {
    return (
      <div className="chat-window" ref={containerRef}>
        <div className="empty-state">
          <ChatIcon />
          <p className="empty-state-title">Start a new chat</p>
          <p className="empty-state-sub">Click "+ New Chat" in the sidebar to begin.</p>
        </div>
      </div>
    );
  }

  const workspaceName = activeWorkspace?.name;
  const documentName = activeWorkspace?.documents.find(
    (d) => d.id === activeChat?.documentId
  )?.name;

  return (
    <div className="chat-window" ref={containerRef}>
      {activeChat.messages.length === 0 && !isLoading && (
        <div className="empty-state" style={{ flex: "none", paddingBottom: 0 }}>
          <p className="empty-state-sub">Send a message or use a prompt chip below.</p>
        </div>
      )}

      {activeChat.messages.map((msg, i) => (
        <MessageBubble
          key={i}
          role={msg.role}
          content={msg.content}
          displayContent={msg.displayContent}
          timestamp={msg.createdAt}
          workspaceName={workspaceName}
          documentName={documentName}
          onSend={onSend}
        />
      ))}

      {/* Typing dots: show while waiting for first token, or for the entire
          duration when hideStreaming is true (e.g. quiz JSON responses) */}
      {isLoading && (!streamingContent || hideStreaming) && (
        <div className="message assistant">
          <div className="message-body">
            <div className="typing-indicator">
              <span className="typing-dot" />
              <span className="typing-dot" />
              <span className="typing-dot" />
            </div>
          </div>
        </div>
      )}

      {/* Live streaming bubble — hidden when hideStreaming suppresses it */}
      {streamingContent && !hideStreaming && (
        <MessageBubble role="assistant" content={streamingContent} />
      )}

      <div ref={bottomRef} />
    </div>
  );
}
