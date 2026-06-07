// Phase 7 will wire ChatWindow, ChatInput, PromptChips into the main area.
import useWorkspaces from "./hooks/useWorkspaces.js";
import Sidebar from "./components/Sidebar.jsx";

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

  // ── Empty-state hint for the main area ───────────────────────────────────
  let emptyTitle = "Welcome to StudyBot";
  let emptySub = "Create a workspace in the sidebar to get started.";
  if (activeWorkspace && activeWorkspace.documents.length === 0) {
    emptyTitle = "Upload a document";
    emptySub = "Add a PDF to this workspace, then start a chat.";
  } else if (activeWorkspace && activeWorkspace.chats.length === 0) {
    emptyTitle = "Start a new chat";
    emptySub = 'Click "+ New Chat" in the sidebar to begin.';
  } else if (activeWorkspace && !activeChat) {
    emptyTitle = "Select a chat";
    emptySub = "Pick a chat from the sidebar or create a new one.";
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

      {/* ── Main area (ChatWindow + input wired in Phase 7) ─────────────── */}
      <div className="main-area">
        {/* Document context bar */}
        <div className="doc-context-bar">
          {activeDocument ? (
            <>
              <span className="doc-badge">
                {activeWorkspace?.name}
              </span>
              <span className="doc-name">{activeDocument.name}</span>
            </>
          ) : (
            <>
              <span className="doc-badge">No document</span>
              <span className="doc-name" style={{ color: "var(--color-text-muted)" }}>
                {activeWorkspace
                  ? "Select or create a chat tied to a document"
                  : "Upload a PDF to get started"}
              </span>
            </>
          )}
        </div>

        {/* Chat window — messages rendered in Phase 7 */}
        <div className="chat-window">
          {!activeChat ? (
            <div className="empty-state">
              <p className="empty-state-title">{emptyTitle}</p>
              <p className="empty-state-sub">{emptySub}</p>
            </div>
          ) : (
            <div className="empty-state">
              <p className="empty-state-title">Chat ready</p>
              <p className="empty-state-sub">
                Message rendering wired in Phase 7.
              </p>
            </div>
          )}
        </div>

        {/* Sticky input area — fully wired in Phase 7 */}
        <div className="input-area">
          <div className="input-wrapper">
            <div className="prompt-chips">
              {["Summarize", "Notes", "Diagram", "Practice Problems"].map(
                (label) => (
                  <button key={label} className="chip" disabled>
                    {label}
                  </button>
                )
              )}
            </div>
            <textarea
              className="chat-textarea"
              placeholder="Ask something about your document…"
              rows={1}
              disabled
            />
            <div className="input-footer">
              <button className="btn-send" disabled>
                ↑
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
