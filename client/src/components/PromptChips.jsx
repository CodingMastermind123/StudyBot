import { useState } from "react";
import { PROMPTS } from "../lib/prompts.js";

const DIFFICULTIES = ["Easy", "Medium", "Hard"];
const PRACTICE_ID = "practice";

function PracticeForm({ onGenerate, onCancel }) {
  const [count, setCount] = useState(5);
  const [difficulty, setDifficulty] = useState("Medium");

  function clamp(val) {
    return Math.min(20, Math.max(1, val));
  }

  return (
    <div className="practice-form">
      {/* Number stepper */}
      <div className="practice-form-group">
        <span className="practice-form-label">Questions</span>
        <div className="practice-stepper">
          <button
            className="stepper-btn"
            onClick={() => setCount((n) => clamp(n - 1))}
            disabled={count <= 1}
          >−</button>
          <input
            className="stepper-input"
            type="number"
            min={1}
            max={20}
            value={count}
            onChange={(e) => setCount(clamp(Number(e.target.value)))}
          />
          <button
            className="stepper-btn"
            onClick={() => setCount((n) => clamp(n + 1))}
            disabled={count >= 20}
          >+</button>
        </div>
      </div>

      {/* Difficulty selector */}
      <div className="practice-form-group">
        <span className="practice-form-label">Difficulty</span>
        <div className="practice-difficulty">
          {DIFFICULTIES.map((d) => (
            <button
              key={d}
              className={`difficulty-btn${difficulty === d ? " active" : ""}`}
              onClick={() => setDifficulty(d)}
            >
              {d}
            </button>
          ))}
        </div>
      </div>

      {/* Actions */}
      <div className="practice-form-actions">
        <button
          className="chip practice-generate-btn"
          onClick={() => onGenerate(count, difficulty)}
        >
          Generate
        </button>
        <button className="practice-cancel-btn" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </div>
  );
}

export default function PromptChips({ activeChat, isLoading, onSend }) {
  const [showPracticeForm, setShowPracticeForm] = useState(false);
  const disabled = !activeChat || isLoading;

  function handleChipClick(p) {
    if (p.id === PRACTICE_ID) {
      setShowPracticeForm(true);
    } else {
      onSend(p.prompt, { displayContent: p.displayLabel, retrieval: p.retrieval });
    }
  }

  function handleGenerate(count, difficulty) {
    const practicePrompt = PROMPTS.find((p) => p.id === PRACTICE_ID);
    onSend(practicePrompt.buildPrompt(count, difficulty), {
      displayContent: practicePrompt.buildDisplayLabel(count, difficulty),
      hideStreaming: true,
      retrieval: practicePrompt.retrieval,
    });
    setShowPracticeForm(false);
  }

  if (showPracticeForm) {
    return (
      <div className="prompt-chips">
        <PracticeForm
          onGenerate={handleGenerate}
          onCancel={() => setShowPracticeForm(false)}
        />
      </div>
    );
  }

  return (
    <div className="prompt-chips">
      {PROMPTS.map((p) => (
        <button
          key={p.id}
          className="chip"
          disabled={disabled}
          onClick={() => handleChipClick(p)}
        >
          {p.label}
        </button>
      ))}
    </div>
  );
}
