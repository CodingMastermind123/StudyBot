import { useState } from "react";
import useWorkspaces from "./hooks/useWorkspaces.js";
import { sendChat } from "./api.js";
import Sidebar from "./components/Sidebar.jsx";
import ChatWindow from "./components/ChatWindow.jsx";
import ChatInput from "./components/ChatInput.jsx";
import PromptChips from "./components/PromptChips.jsx";

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

  return (
    <div className="app-layout">
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
        {/* Document context bar */}
        <div className="doc-context-bar">
          {activeDocument ? (
            <>
              <span className="doc-badge">{activeWorkspace?.name}</span>
              <span className="doc-name">{activeDocument.name}</span>
            </>
          ) : (
            <>
              <span className="doc-badge">No document</span>
              <span
                className="doc-name"
                style={{ color: "var(--color-text-muted)" }}
              >
                {activeWorkspace
                  ? "Select or create a chat tied to a document"
                  : "Upload a PDF to get started"}
              </span>
            </>
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
