import { useState } from "react";
import useWorkspaces from "./hooks/useWorkspaces.js";
import { sendChat } from "./api.js";
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
  } = useWorkspaces();

  const [isLoading, setIsLoading] = useState(false);
  const [sendError, setSendError] = useState(null);

  // Shared send handler for both ChatInput and PromptChips.
  // Constructs the outgoing messages array explicitly (including the new user
  // message) so the payload is correct without waiting for a React state flush.
  async function handleSend(content) {
    if (!activeChat || isLoading) return;

    appendMessage("user", content);

    const outgoing = [...activeChat.messages, { role: "user", content }];
    const documentText = activeDocument?.text ?? null;

    setIsLoading(true);
    setSendError(null);
    try {
      const { reply } = await sendChat({ messages: outgoing, documentText });
      appendMessage("assistant", reply);
    } catch (err) {
      setSendError(err.message || "Something went wrong. Please try again.");
    } finally {
      setIsLoading(false);
    }
  }

  // Derive --workspace-accent and its opacity variants from the active workspace's
  // chosen color so every component can reference these CSS custom properties.
  const accentHex = activeWorkspace
    ? getColor(activeWorkspace.color).value
    : "#6366f1";
  const accentDim   = hexRgba(accentHex, 0.15); // faint fill for active states
  const accentMuted = hexRgba(accentHex, 0.70); // 70% for section labels

  return (
    <div
      className="app-layout"
      style={{
        "--workspace-accent":       accentHex,
        "--workspace-accent-dim":   accentDim,
        "--workspace-accent-muted": accentMuted,
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
      />

      <div className="main-area">
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
        />

        {/* Input area — chips + textarea share the same rounded container */}
        <div className="input-area">
          {sendError && (
            <p className="banner error" style={{ marginBottom: "var(--space-2)" }}>
              {sendError}
            </p>
          )}
          <div className="input-wrapper">
            <PromptChips
              activeChat={activeChat}
              isLoading={isLoading}
              onSend={handleSend}
            />
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
