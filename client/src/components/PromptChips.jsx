import { PROMPTS } from "../lib/prompts.js";

export default function PromptChips({ activeChat, isLoading, onSend }) {
  const disabled = !activeChat || isLoading;

  return (
    <div className="prompt-chips">
      {PROMPTS.map((p) => (
        <button
          key={p.id}
          className="chip"
          disabled={disabled}
          onClick={() => onSend(p.prompt)}
        >
          {p.label}
        </button>
      ))}
    </div>
  );
}
