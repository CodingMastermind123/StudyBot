// ~3000 chars ≈ 750 tokens — large enough for coherent embedding signal,
// small enough for precise retrieval within the 8191-token embedding cap.
// ~400-char overlap preserves context across chunk boundaries.
const DEFAULT_CHUNK_SIZE =
  parseInt(process.env.RAG_CHUNK_SIZE, 10) || 3000;
const DEFAULT_OVERLAP =
  parseInt(process.env.RAG_CHUNK_OVERLAP, 10) || 400;

export function chunkText(
  text,
  { chunkSize = DEFAULT_CHUNK_SIZE, overlap = DEFAULT_OVERLAP } = {}
) {
  if (!text || !text.trim()) return [];

  const chunks = [];
  let start = 0;

  while (start < text.length) {
    let end = Math.min(start + chunkSize, text.length);

    if (end < text.length) {
      const window = text.slice(start, end);

      const paraBreak = window.lastIndexOf("\n\n");
      if (paraBreak > chunkSize * 0.5) {
        end = start + paraBreak + 2;
      } else {
        const sentenceBreak = window.lastIndexOf(". ");
        if (sentenceBreak > chunkSize * 0.5) {
          end = start + sentenceBreak + 2;
        }
      }
    }

    const chunk = text.slice(start, end).trim();
    if (chunk) {
      chunks.push(chunk);
    }

    if (end >= text.length) break;
    start = end - overlap;
    if (start < 0) start = 0;
  }

  return chunks;
}
