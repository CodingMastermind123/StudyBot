import { useEffect, useRef, useState } from "react";
import mermaid from "mermaid";

// Initialize once at module scope — mermaid v11 async API
mermaid.initialize({ startOnLoad: false, theme: "dark" });

let idCounter = 0;

export default function Mermaid({ code }) {
  const containerRef = useRef(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!containerRef.current) return;

    let cancelled = false;
    const id = `mermaid-${++idCounter}`;

    (async () => {
      try {
        const { svg } = await mermaid.render(id, code);
        if (!cancelled && containerRef.current) {
          containerRef.current.innerHTML = svg;
          setError(false);
        }
      } catch {
        if (!cancelled) setError(true);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [code]);

  if (error) {
    return (
      <pre className="mermaid-card" style={{ whiteSpace: "pre-wrap" }}>
        {code}
      </pre>
    );
  }

  return (
    <div className="mermaid-card">
      <span className="mermaid-label">diagram</span>
      <div ref={containerRef} />
    </div>
  );
}
