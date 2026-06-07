import ReactMarkdown from "react-markdown";
import Mermaid from "./Mermaid.jsx";
import Quiz from "./Quiz.jsx";

// Try to parse assistant content as a quiz JSON object.
// Strips ``` wrappers Claude occasionally adds despite being told not to.
function tryParseQuiz(content) {
  try {
    let text = content.trim();
    if (text.startsWith("```")) {
      text = text.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "").trim();
    }
    const parsed = JSON.parse(text);
    if (parsed && Array.isArray(parsed.questions) && parsed.questions.length > 0) {
      return parsed;
    }
  } catch {
    // not JSON — fall through to normal rendering
  }
  return null;
}

// react-markdown v9: use className to distinguish block code (has language-xxx)
// from inline code (no className). Override `code` for both cases.
export default function MessageContent({ role, content, onSend }) {
  if (role === "user") {
    // User messages rendered as plain text — no markdown injection risk
    return <span style={{ whiteSpace: "pre-wrap" }}>{content}</span>;
  }

  const quiz = tryParseQuiz(content);
  if (quiz) {
    return <Quiz questions={quiz.questions} onSend={onSend} />;
  }

  return (
    <ReactMarkdown
      components={{
        code({ className, children, ...props }) {
          const lang = /language-(\w+)/.exec(className || "")?.[1];
          const codeText = String(children).replace(/\n$/, "");

          if (lang === "mermaid") {
            return <Mermaid code={codeText} />;
          }

          // Block code (has a language class) vs inline code (no class)
          if (className) {
            return (
              <pre>
                <code className={className} {...props}>
                  {children}
                </code>
              </pre>
            );
          }

          return (
            <code className={className} {...props}>
              {children}
            </code>
          );
        },
      }}
    >
      {content}
    </ReactMarkdown>
  );
}
