// Layout shell — components wired in Phases 5-7
export default function App() {
  return (
    <div className="app-layout">
      {/* ── Sidebar ───────────────────────────────────────────────── */}
      <aside className="sidebar">
        <div className="sidebar-header">
          <span className="wordmark">StudyBot</span>
          <button className="btn-new-chat" style={{ width: "auto", padding: "4px 10px" }}>
            New chat
          </button>
        </div>
        <nav className="sidebar-nav">
          {/* Session list rendered by Sidebar component (Phase 6) */}
        </nav>
      </aside>

      {/* ── Main area ─────────────────────────────────────────────── */}
      <div className="main-area">
        {/* Document context bar */}
        <div className="doc-context-bar">
          <span className="doc-badge">No document</span>
          <span className="doc-name" style={{ color: "var(--color-text-muted)" }}>
            Upload a PDF to get started
          </span>
        </div>

        {/* Chat window */}
        <div className="chat-window">
          <div className="empty-state">
            <p className="empty-state-title">Start a conversation</p>
            <p className="empty-state-sub">
              Upload a PDF from the input area below, then ask anything about it.
            </p>
          </div>
        </div>

        {/* Sticky input area */}
        <div className="input-area">
          <div className="input-wrapper">
            <div className="prompt-chips">
              {["Summarize", "Notes", "Diagram", "Practice Problems"].map((label) => (
                <button key={label} className="chip" disabled>
                  {label}
                </button>
              ))}
            </div>
            <textarea
              className="chat-textarea"
              placeholder="Ask something about your document…"
              rows={1}
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
