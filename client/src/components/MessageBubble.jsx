import MessageContent from "./MessageContent.jsx";

function esc(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function openExportTab(content, { workspaceName, documentName }) {
  const date = new Date().toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const metaParts = [workspaceName, documentName].filter(Boolean);
  const metaHtml = metaParts
    .map(esc)
    .join(' <span class="sep">·</span> ');
  const pageTitle = [...metaParts, "StudyBot"].filter(Boolean).join(" — ");

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${esc(pageTitle)}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&family=Instrument+Serif:ital@1&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet" />
  <script src="https://cdn.jsdelivr.net/npm/marked/marked.min.js"></script>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: 'Inter', system-ui, -apple-system, sans-serif;
      font-size: 15px;
      line-height: 1.75;
      color: #111;
      background: #fff;
    }
    .page {
      max-width: 740px;
      margin: 0 auto;
      padding: 52px 44px 80px;
    }
    /* ── Header ── */
    .export-header { margin-bottom: 20px; }
    .header-top {
      display: flex;
      align-items: baseline;
      justify-content: space-between;
      gap: 16px;
    }
    .wordmark {
      font-family: 'Instrument Serif', Georgia, serif;
      font-style: italic;
      font-size: 22px;
      letter-spacing: -0.01em;
      color: #111;
    }
    .header-date { font-size: 13px; color: #888; white-space: nowrap; }
    .header-meta {
      margin-top: 5px;
      font-size: 13px;
      color: #555;
    }
    .sep { color: #ccc; margin: 0 2px; }
    /* ── Print button ── */
    .print-bar {
      margin: 22px 0 0;
    }
    .btn-print {
      font-family: 'Inter', system-ui, sans-serif;
      font-size: 13px;
      font-weight: 500;
      padding: 8px 18px;
      background: #111;
      color: #fff;
      border: none;
      border-radius: 6px;
      cursor: pointer;
      transition: background 120ms ease;
    }
    .btn-print:hover { background: #333; }
    /* ── Divider ── */
    .divider {
      border: none;
      border-top: 1px solid #e5e5e5;
      margin: 24px 0 32px;
    }
    /* ── Content ── */
    .content h1, .content h2, .content h3,
    .content h4, .content h5, .content h6 {
      font-weight: 600;
      line-height: 1.3;
      color: #111;
      margin-top: 28px;
      margin-bottom: 10px;
    }
    .content h1 { font-size: 22px; }
    .content h2 { font-size: 18px; border-bottom: 1px solid #eee; padding-bottom: 6px; }
    .content h3 { font-size: 16px; }
    .content h4, .content h5, .content h6 { font-size: 15px; }
    .content p { margin-bottom: 14px; }
    .content ul, .content ol { padding-left: 22px; margin-bottom: 14px; }
    .content li { margin-bottom: 4px; }
    .content strong { font-weight: 600; }
    .content em { font-style: italic; }
    .content a { color: #2563eb; }
    .content blockquote {
      border-left: 3px solid #d1d5db;
      padding-left: 16px;
      color: #555;
      margin: 0 0 14px;
    }
    .content code {
      font-family: 'JetBrains Mono', 'Fira Code', monospace;
      font-size: 13px;
      background: #f3f4f6;
      padding: 1px 5px;
      border-radius: 3px;
      color: #111;
    }
    .content pre {
      background: #f8f9fa;
      border: 1px solid #e5e7eb;
      border-radius: 6px;
      padding: 16px;
      overflow-x: auto;
      margin-bottom: 16px;
    }
    .content pre code { background: none; padding: 0; font-size: 13px; }
    .content hr { border: none; border-top: 1px solid #e5e5e5; margin: 24px 0; }
    .content table { width: 100%; border-collapse: collapse; margin-bottom: 16px; font-size: 14px; }
    .content th, .content td { border: 1px solid #e5e7eb; padding: 8px 12px; text-align: left; }
    .content th { background: #f9fafb; font-weight: 600; }
    /* ── Print media ── */
    @media print {
      .print-bar { display: none !important; }
      .page { padding: 0; }
      body { font-size: 13px; }
      .content pre { white-space: pre-wrap; }
    }
  </style>
</head>
<body>
  <div class="page">
    <header class="export-header">
      <div class="header-top">
        <span class="wordmark">StudyBot</span>
        <span class="header-date">${esc(date)}</span>
      </div>
      ${metaHtml ? `<div class="header-meta">${metaHtml}</div>` : ""}
    </header>
    <div class="print-bar">
      <button class="btn-print" onclick="window.print()">Print / Save as PDF</button>
    </div>
    <hr class="divider" />
    <div id="content" class="content"></div>
  </div>
  <script>
    document.getElementById('content').innerHTML = marked.parse(${JSON.stringify(content)});
  </script>
</body>
</html>`;

  const blob = new Blob([html], { type: "text/html" });
  const url = URL.createObjectURL(blob);
  window.open(url, "_blank");
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}

function PrintIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2"
      strokeLinecap="round" strokeLinejoin="round">
      <polyline points="6 9 6 2 18 2 18 9" />
      <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
      <rect x="6" y="14" width="12" height="8" />
    </svg>
  );
}

export default function MessageBubble({ role, content, workspaceName, documentName, onSend }) {
  return (
    <div className={`message ${role}`}>
      <div className="message-body">
        <MessageContent role={role} content={content} onSend={onSend} />
      </div>
      {role === "assistant" && (
        <button
          className="message-export-btn"
          title="Export"
          onClick={() => openExportTab(content, { workspaceName, documentName })}
        >
          <PrintIcon />
        </button>
      )}
    </div>
  );
}
