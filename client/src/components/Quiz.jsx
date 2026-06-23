import { useState } from "react";
import { PROMPTS } from "../lib/prompts.js";

const CHOICE_KEYS = ["A", "B", "C", "D"];
const PRACTICE_ID = "practice";

function CheckIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2.5"
      strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

function XIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2.5"
      strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}

export default function Quiz({ questions, onSend }) {
  const [answers, setAnswers] = useState({});
  const [checked, setChecked] = useState({});

  function handleSelect(questionId, choice) {
    if (checked[questionId]) return;
    setAnswers((prev) => ({ ...prev, [questionId]: choice }));
  }

  function handleCheck(questionId) {
    if (!answers[questionId] || checked[questionId]) return;
    const q = questions.find((qq) => qq.id === questionId);
    const isCorrect = answers[questionId] === q.correct;
    setChecked((prev) => ({ ...prev, [questionId]: isCorrect ? "correct" : "wrong" }));
  }

  function handleNewQuiz() {
    if (!onSend) return;
    const practice = PROMPTS.find((p) => p.id === PRACTICE_ID);
    onSend(practice.buildPrompt(questions.length, "Medium"), {
      displayContent: practice.buildDisplayLabel(questions.length, "Medium"),
      hideStreaming: true,
    });
  }

  const checkedCount = Object.keys(checked).length;
  const correctCount = Object.values(checked).filter((v) => v === "correct").length;

  return (
    <div className="quiz-container">
      {/* ── Header card ── */}
      <div className="quiz-header-card">
        <div className="quiz-header-left">
          <h2 className="quiz-header-title">Practice Quiz</h2>
          <span className="quiz-header-sub">
            {questions.length} QUESTION{questions.length !== 1 ? "S" : ""}
          </span>
        </div>
        {checkedCount > 0 && (
          <span className="quiz-header-score">
            {correctCount} / {checkedCount} correct
          </span>
        )}
      </div>

      {/* ── Question cards ── */}
      {questions.map((q, qi) => {
        const selected = answers[q.id];
        const result = checked[q.id];
        const isChecked = !!result;

        return (
          <div key={q.id} className="quiz-card">
            <span className="quiz-q-label">
              QUESTION {qi + 1} OF {questions.length}
            </span>
            <p className="quiz-question-text">{q.question}</p>

            <div className="quiz-choices">
              {CHOICE_KEYS.map((key) => {
                const isSelected = selected === key;
                const isCorrectAnswer = isChecked && key === q.correct;
                const isWrongPick = isChecked && isSelected && key !== q.correct;
                const isDimmed = isChecked && !isSelected && key !== q.correct;

                let cls = "quiz-choice";
                if (!isChecked && isSelected) cls += " quiz-choice--selected";
                if (isCorrectAnswer)          cls += " quiz-choice--correct";
                if (isWrongPick)              cls += " quiz-choice--wrong";
                if (isDimmed)                 cls += " quiz-choice--dimmed";

                return (
                  <button
                    key={key}
                    className={cls}
                    onClick={() => handleSelect(q.id, key)}
                    disabled={isChecked}
                  >
                    <span className="quiz-choice-key">{key}</span>
                    <span className="quiz-choice-text">{q.choices[key]}</span>
                    {isCorrectAnswer && <span className="quiz-choice-icon quiz-choice-icon--correct"><CheckIcon /></span>}
                    {isWrongPick && <span className="quiz-choice-icon quiz-choice-icon--wrong"><XIcon /></span>}
                  </button>
                );
              })}
            </div>

            {isChecked && q.explanation && (
              <div className="quiz-explanation-box">
                <span className="quiz-explanation-label">EXPLANATION</span>
                <p className="quiz-explanation-text">{q.explanation}</p>
              </div>
            )}

            {!isChecked && (
              <button
                className="quiz-check-btn"
                disabled={!selected}
                onClick={() => handleCheck(q.id)}
              >
                Check Answer
              </button>
            )}

            {isChecked && (
              <span className={`quiz-result-pill quiz-result-pill--${result}`}>
                {result === "correct" ? <><CheckIcon /> Correct!</> : <><XIcon /> Incorrect</>}
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}
