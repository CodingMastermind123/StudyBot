import { useState, useRef } from "react";
import useWorkspaces from "./hooks/useWorkspaces.js";
import { streamChat, sendChat, uploadPdf } from "./api.js";
import { getColor } from "./lib/colors.js";
import Sidebar from "./components/Sidebar.jsx";
import ChatWindow from "./components/ChatWindow.jsx";
import ChatInput from "./components/ChatInput.jsx";
import PromptChips from "./components/PromptChips.jsx";

// Convert a 6-digit hex colour to an rgba() string at the given opacity.
function hexRgba(hex, alpha) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

export default function App() {
  const {
    store,
    quotaError,
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
  } = useWorkspaces();

  const [isLoading, setIsLoading] = useState(false);
  const [sendError, setSendError] = useState(null);
  const [streamingContent, setStreamingContent] = useState(null);
  const [hideStreaming, setHideStreaming] = useState(false);

  // ── Main-area drag-drop ────────────────────────────────────────────────────
  // Active when the workspace exists but has no documents yet (and no active chat).
  const showMainDropzone =
    !activeChat && activeWorkspace && activeWorkspace.documents.length === 0;

  const [dragOverMain, setDragOverMain] = useState(false);
  const dragCountRef = useRef(0); // reliably track enter/leave across children

  async function handleMainDrop(file) {
    if (!activeWorkspace || !file) return;
    if (file.type !== "application/pdf") return;
    try {
      const data = await uploadPdf(file);
      addDocument(activeWorkspace.id, {
        name: data.filename,
        charCount: data.charCount,
        text: data.text,
      });
    } catch {
      // DocumentList in the sidebar shows its own errors; ignore here to keep the
      // drop overlay simple. User can retry via the sidebar upload zone.
    }
  }

  // ── Shared chat send handler ───────────────────────────────────────────────
  async function handleSend(content, opts = {}) {
    if (!activeChat || isLoading) return;
    const { displayContent, hideStreaming: hide } = opts;
    appendMessage("user", content, displayContent);
    const outgoing = [...activeChat.messages, { role: "user", content }];
    const documentText = activeDocument?.text ?? null;
    setIsLoading(true);
    setSendError(null);
    setStreamingContent("");
    if (hide) setHideStreaming(true);

    let accumulated = "";
    try {
      await streamChat({
        messages: outgoing,
        documentText,
        onToken: (token) => {
          accumulated += token;
          if (!hide) setStreamingContent(accumulated);
        },
      });
      appendMessage("assistant", accumulated);
    } catch (err) {
      if (accumulated) appendMessage("assistant", accumulated);
      setSendError(err.message || "Something went wrong. Please try again.");
    } finally {
      setIsLoading(false);
      setStreamingContent(null);
      setHideStreaming(false);
    }
  }

  // ── Workspace accent CSS custom properties ────────────────────────────────
  const accentHex   = activeWorkspace ? getColor(activeWorkspace.color).value : "#6366f1";
  const accentDim   = hexRgba(accentHex, 0.15); // faint fill for active states
  const accentMuted = hexRgba(accentHex, 0.70); // 70% for section labels
  const accentFaint = hexRgba(accentHex, 0.05); // 5% for the full-area drop overlay

  return (
    <div
      className="app-layout"
      style={{
        "--workspace-accent":       accentHex,
        "--workspace-accent-dim":   accentDim,
        "--workspace-accent-muted": accentMuted,
        "--workspace-accent-faint": accentFaint,
      }}
    >
      <Sidebar
        workspaces={store.workspaces}
        activeWorkspace={activeWorkspace}
        activeChatId={store.activeChatId}
        quotaError={quotaError}
        onSelectWorkspace={selectWorkspace}
        onCreateWorkspace={createWorkspace}
        onAddDocument={addDocument}
        onDeleteDocument={deleteDocument}
        onCreateChat={createChat}
        onSelectChat={selectChat}
        onDeleteChat={deleteChat}
        onDeleteWorkspace={deleteWorkspace}
        onRenameWorkspace={renameWorkspace}
        onRecolorWorkspace={recolorWorkspace}
      />

      {/* ── Main area ──────────────────────────────────────────────────────── */}
      <div
        className="main-area"
        onDragEnter={showMainDropzone ? (e) => {
          e.preventDefault();
          dragCountRef.current++;
          setDragOverMain(true);
        } : undefined}
        onDragOver={showMainDropzone ? (e) => e.preventDefault() : undefined}
        onDragLeave={showMainDropzone ? () => {
          dragCountRef.current--;
          if (dragCountRef.current <= 0) {
            dragCountRef.current = 0;
            setDragOverMain(false);
          }
        } : undefined}
        onDrop={showMainDropzone ? (e) => {
          e.preventDefault();
          dragCountRef.current = 0;
          setDragOverMain(false);
          handleMainDrop(e.dataTransfer.files[0]);
        } : undefined}
      >
        {/* Full-area drop overlay */}
        {dragOverMain && showMainDropzone && (
          <div className="main-drop-overlay">
            {/* Upload document SVG icon */}
            <svg width="52" height="52" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="1.2"
              strokeLinecap="round" strokeLinejoin="round">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
              <line x1="12" y1="18" x2="12" y2="12" />
              <polyline points="9 15 12 12 15 15" />
            </svg>
            <p className="main-drop-label">Drop to upload</p>
          </div>
        )}

        {/* Top bar — shows the active chat title; empty when no chat is selected */}
        <div className="doc-context-bar">
          {activeChat && (
            <span className="doc-name">{activeChat.title}</span>
          )}
        </div>

        <ChatWindow
          activeWorkspace={activeWorkspace}
          activeChat={activeChat}
          isLoading={isLoading}
          streamingContent={streamingContent}
          hideStreaming={hideStreaming}
          onAddDocument={addDocument}
          onSend={handleSend}
        />

        {/* Input area — chips sit above the input box */}
        <div className="input-area">
          {sendError && (
            <p className="banner error" style={{ marginBottom: "var(--space-2)" }}>
              {sendError}
            </p>
          )}
          <PromptChips
            activeChat={activeChat}
            isLoading={isLoading}
            onSend={handleSend}
          />
          <div className="input-wrapper">
            <ChatInput
              activeChat={activeChat}
              isLoading={isLoading}
              onSend={handleSend}
              onError={setSendError}
              onClearError={() => setSendError(null)}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
