import { useState, useRef, useEffect } from "react";

// Renders only the textarea + send button — the input-area/input-wrapper
// shell is owned by App.jsx so PromptChips can share the same container.
export default function ChatInput({ activeChat, isLoading, onSend, onError, onClearError }) {
  const [text, setText] = useState("");
  const textareaRef = useRef(null);

  // Auto-resize textarea height as content grows
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 180)}px`;
  }, [text]);

  const canSend = !!activeChat && !isLoading && text.trim().length > 0;

  function handleKeyDown(e) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (canSend) submit(text.trim());
    }
  }

  async function submit(content) {
    if (!content || isLoading || !activeChat) return;
    setText("");
    onClearError?.();
    try {
      await onSend(content);
    } catch (err) {
      onError?.(err.message || "Something went wrong. Please try again.");
    }
  }

  return (
    <>
      <textarea
        ref={textareaRef}
        className="chat-textarea"
        placeholder={
          activeChat
            ? "Ask something about your document…"
            : "Select a chat to start typing…"
        }
        value={text}
        rows={1}
        disabled={!activeChat || isLoading}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={handleKeyDown}
      />
      <div className="input-footer">
        <button
          className="btn-send"
          disabled={!canSend}
          onClick={() => submit(text.trim())}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" stroke="none">
            <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
          </svg>
        </button>
      </div>
    </>
  );
}
