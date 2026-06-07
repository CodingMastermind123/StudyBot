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
  const [submitted, setSubmitted] = useState(false);
  const [score, setScore] = useState(0);

  const answeredCount = Object.keys(answers).length;
  const allAnswered = answeredCount === questions.length;

  function handleSelect(questionId, choice) {
    if (submitted) return;
    setAnswers((prev) => ({ ...prev, [questionId]: choice }));
  }

  function handleSubmit() {
    if (!allAnswered) return;
    const correct = questions.filter((q) => answers[q.id] === q.correct).length;
    setScore(correct);
    setSubmitted(true);
  }

  function handleRetry() {
    setAnswers({});
    setSubmitted(false);
    setScore(0);
  }

  function handleNewQuiz() {
    if (!onSend) return;
    const practice = PROMPTS.find((p) => p.id === PRACTICE_ID);
    onSend(practice.buildPrompt(questions.length, "Medium"));
  }

  const pct = submitted ? (score / questions.length) * 100 : 0;
  const scoreColor = pct >= 70 ? "#4caf50" : pct >= 50 ? "#f59e0b" : "#e05252";

  return (
    <div className="quiz">
      {/* ── Post-submit: score banner ── */}
      {submitted && (
        <div
          className="quiz-score-banner"
          style={{ borderColor: scoreColor, background: `${scoreColor}18` }}
        >
          <span className="quiz-score-text" style={{ color: scoreColor }}>
            You got {score}/{questions.length} correct
          </span>
          <div className="quiz-score-actions">
            <button className="quiz-btn-secondary" onClick={handleRetry}>
              Retry
            </button>
            {onSend && (
              <button className="quiz-btn-primary" onClick={handleNewQuiz}>
                New Quiz
              </button>
            )}
          </div>
        </div>
      )}

      {/* ── Pre-submit: progress bar ── */}
      {!submitted && (
        <div className="quiz-progress">
          <span className="quiz-progress-label">
            {answeredCount}/{questions.length} answered
          </span>
          <div className="quiz-progress-track">
            <div
              className="quiz-progress-fill"
              style={{ width: `${(answeredCount / questions.length) * 100}%` }}
            />
          </div>
        </div>
      )}

      {/* ── Questions ── */}
      {questions.map((q, qi) => {
        const selected = answers[q.id];

        return (
          <div
            key={q.id}
            className={`quiz-question${qi < questions.length - 1 ? " quiz-question--divided" : ""}`}
          >
            <p className="quiz-question-text">
              <span className="quiz-q-num">{q.id}.</span>{" "}{q.question}
            </p>

            <div className="quiz-choices">
              {CHOICE_KEYS.map((key) => {
                const isSelected = selected === key;
                const isCorrect = submitted && key === q.correct;
                const isWrongPick = submitted && isSelected && key !== q.correct;
                const isDimmed = submitted && !isSelected && key !== q.correct;

                let cls = "quiz-choice";
                if (!submitted && isSelected) cls += " quiz-choice--selected";
                if (isCorrect)               cls += " quiz-choice--correct";
                if (isWrongPick)             cls += " quiz-choice--wrong";
                if (isDimmed)                cls += " quiz-choice--dimmed";

                return (
                  <button
                    key={key}
                    className={cls}
                    onClick={() => handleSelect(q.id, key)}
                    disabled={submitted}
                  >
                    <span className="quiz-choice-indicator">
                      {isCorrect   && <CheckIcon />}
                      {isWrongPick && <XIcon />}
                      {!submitted && isSelected && <span className="quiz-dot" />}
                    </span>
                    <span className="quiz-choice-key">{key}</span>
                    <span className="quiz-choice-text">{q.choices[key]}</span>
                  </button>
                );
              })}
            </div>

            {submitted && q.explanation && (
              <p className="quiz-explanation">{q.explanation}</p>
            )}
          </div>
        );
      })}

      {/* ── Pre-submit: submit button ── */}
      {!submitted && (
        <div className="quiz-footer">
          <button
            className="quiz-submit-btn"
            disabled={!allAnswered}
            onClick={handleSubmit}
          >
            Submit Quiz
          </button>
        </div>
      )}
    </div>
  );
}
