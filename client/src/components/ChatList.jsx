import { useState } from "react";

function relativeTime(ts) {
  const diff = Date.now() - ts;
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export default function ChatList({
  workspace,
  activeChatId,
  onSelectChat,
  onCreateChat,
  onDeleteChat,
}) {
  const [pickingDoc, setPickingDoc] = useState(false);

  const docs = workspace.documents;

  function handleNewChat() {
    if (docs.length === 0) return;
    if (docs.length === 1) {
      onCreateChat(workspace.id, docs[0].id);
      return;
    }
    // >1 docs: show inline picker
    setPickingDoc(true);
  }

  function handlePickDoc(docId) {
    setPickingDoc(false);
    onCreateChat(workspace.id, docId);
  }

  const docMap = Object.fromEntries(docs.map((d) => [d.id, d.name]));

  // Sort chats newest-first for display
  const sorted = [...workspace.chats].sort((a, b) => b.updatedAt - a.updatedAt);

  return (
    <div className="chat-list-section">
      <p className="sidebar-section-label">Chats</p>

      {sorted.length === 0 ? (
        <p className="sidebar-empty-hint">No chats yet.</p>
      ) : (
        <ul className="chat-list">
          {sorted.map((chat) => (
            <li
              key={chat.id}
              className={`chat-item${chat.id === activeChatId ? " active" : ""}`}
              onClick={() => onSelectChat(chat.id)}
            >
              <div className="chat-item-body">
                <span className="chat-item-title">{chat.title}</span>
                <span className="chat-item-meta">
                  {docMap[chat.documentId]
                    ? `${docMap[chat.documentId]} · `
                    : ""}
                  {relativeTime(chat.updatedAt)}
                </span>
              </div>
              <button
                className="btn-icon-delete"
                title="Delete chat"
                onClick={(e) => {
                  e.stopPropagation();
                  onDeleteChat(chat.id);
                }}
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      )}

      {pickingDoc && (
        <div className="doc-picker">
          <p className="doc-picker-label">Choose a document for this chat:</p>
          {docs.map((doc) => (
            <button
              key={doc.id}
              className="doc-picker-option"
              onClick={() => handlePickDoc(doc.id)}
            >
              {doc.name}
            </button>
          ))}
          <button
            className="btn-ws-cancel"
            onClick={() => setPickingDoc(false)}
          >
            Cancel
          </button>
        </div>
      )}

      {!pickingDoc && (
        <button
          className="btn-new-chat-sidebar"
          disabled={docs.length === 0}
          title={docs.length === 0 ? "Upload a document first" : ""}
          onClick={handleNewChat}
        >
          {docs.length === 0 ? "Upload a document first" : "+ New Chat"}
        </button>
      )}
    </div>
  );
}
