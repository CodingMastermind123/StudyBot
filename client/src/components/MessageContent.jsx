import ReactMarkdown from "react-markdown";
import Mermaid from "./Mermaid.jsx";

// react-markdown v9: use className to distinguish block code (has language-xxx)
// from inline code (no className). Override `code` for both cases.
export default function MessageContent({ role, content }) {
  if (role === "user") {
    // User messages rendered as plain text — no markdown injection risk
    return <span style={{ whiteSpace: "pre-wrap" }}>{content}</span>;
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
