import { createRequire } from "module";

// Use createRequire to load the CJS pdf-parse module from ESM.
// Import the implementation directly to avoid a debug code path in the
// package index that reads a bundled test PDF and throws ENOENT.
const require = createRequire(import.meta.url);
const pdfParse = require("pdf-parse/lib/pdf-parse.js");

/**
 * Extract text from a PDF buffer.
 * @param {Buffer} buffer
 * @returns {{ text: string, pages: number }}
 * @throws if the PDF yields no extractable text (e.g. scanned/image-only)
 */
export async function extractText(buffer) {
  const data = await pdfParse(buffer);
  const text = (data.text || "").trim();

  if (!text) {
    const err = new Error(
      "No extractable text — this PDF may contain scanned images only."
    );
    err.code = "EMPTY_PDF";
    throw err;
  }

  return { text, pages: data.numpages };
}
