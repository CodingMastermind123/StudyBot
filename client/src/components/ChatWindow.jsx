import { useEffect, useRef } from "react";
import MessageBubble from "./MessageBubble.jsx";

export default function ChatWindow({
  activeWorkspace,
  activeChat,
  isLoading,
}) {
  const bottomRef = useRef(null);
  const containerRef = useRef(null);

  // Auto-scroll to bottom on new messages, but only when already near the bottom
  // so we don't yank the view when a user scrolls up to read history.
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    if (distanceFromBottom < 120) {
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [activeChat?.messages?.length, isLoading]);

  // Context-aware empty states
  if (!activeWorkspace) {
    return (
      <div className="chat-window" ref={containerRef}>
        <div className="empty-state">
          <p className="empty-state-title">Welcome to StudyBot</p>
          <p className="empty-state-sub">Create a workspace in the sidebar to get started.</p>
        </div>
      </div>
    );
  }

  if (activeWorkspace.documents.length === 0) {
    return (
      <div className="chat-window" ref={containerRef}>
        <div className="empty-state">
          <p className="empty-state-title">Upload a document</p>
          <p className="empty-state-sub">Add a PDF to this workspace, then start a chat.</p>
        </div>
      </div>
    );
  }

  if (!activeChat) {
    return (
      <div className="chat-window" ref={containerRef}>
        <div className="empty-state">
          <p className="empty-state-title">Start a new chat</p>
          <p className="empty-state-sub">Click "+ New Chat" in the sidebar to begin.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="chat-window" ref={containerRef}>
      {activeChat.messages.length === 0 && !isLoading && (
        <div className="empty-state" style={{ flex: "none", paddingBottom: 0 }}>
          <p className="empty-state-sub">Send a message or use a prompt chip below.</p>
        </div>
      )}

      {activeChat.messages.map((msg, i) => (
        <MessageBubble key={i} role={msg.role} content={msg.content} />
      ))}

      {isLoading && (
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

      <div ref={bottomRef} />
    </div>
  );
}
