import { describe, it, expect } from "vitest";
import { chunkText } from "./chunking.js";

describe("chunkText", () => {
  it("returns empty array for empty/whitespace input", () => {
    expect(chunkText("")).toEqual([]);
    expect(chunkText("   ")).toEqual([]);
    expect(chunkText(null)).toEqual([]);
    expect(chunkText(undefined)).toEqual([]);
  });

  it("returns a single chunk for short text", () => {
    const text = "Hello, this is a short paragraph.";
    const chunks = chunkText(text, { chunkSize: 3000, overlap: 400 });
    expect(chunks).toHaveLength(1);
    expect(chunks[0]).toBe(text);
  });

  it("produces chunks approximately the target size", () => {
    const text = "A".repeat(10000);
    const chunks = chunkText(text, { chunkSize: 3000, overlap: 400 });
    expect(chunks.length).toBeGreaterThan(1);
    for (const chunk of chunks) {
      expect(chunk.length).toBeLessThanOrEqual(3100);
    }
  });

  it("applies overlap between consecutive chunks", () => {
    const text = "word ".repeat(2000);
    const chunks = chunkText(text, { chunkSize: 3000, overlap: 400 });
    expect(chunks.length).toBeGreaterThan(1);
    for (let i = 1; i < chunks.length; i++) {
      const prevEnd = chunks[i - 1].slice(-200);
      const currStart = chunks[i].slice(0, 200);
      const hasOverlap =
        prevEnd.includes(currStart.slice(0, 50)) ||
        currStart.includes(prevEnd.slice(-50));
      expect(hasOverlap).toBe(true);
    }
  });

  it("never emits empty chunks", () => {
    const text = "\n\n\n\nHello\n\n\n\nWorld\n\n\n\n";
    const chunks = chunkText(text, { chunkSize: 50, overlap: 10 });
    for (const chunk of chunks) {
      expect(chunk.trim().length).toBeGreaterThan(0);
    }
  });

  it("prefers paragraph boundaries for splits", () => {
    const para1 = "First paragraph. ".repeat(50);
    const para2 = "Second paragraph. ".repeat(50);
    const text = para1 + "\n\n" + para2;
    const chunks = chunkText(text, { chunkSize: para1.length + 100, overlap: 50 });
    expect(chunks.length).toBeGreaterThanOrEqual(2);
    const firstChunkEndsClean =
      chunks[0].endsWith(para1.trim()) ||
      chunks[0].includes("\n\n") === false;
    expect(firstChunkEndsClean).toBe(true);
  });

  it("prefers sentence boundaries when no paragraph break available", () => {
    const text = "This is sentence one. This is sentence two. This is sentence three. This is sentence four. ".repeat(20);
    const chunks = chunkText(text, { chunkSize: 200, overlap: 40 });
    expect(chunks.length).toBeGreaterThan(1);
    for (let i = 0; i < chunks.length - 1; i++) {
      const endsAtSentence = chunks[i].endsWith(".") || chunks[i].endsWith(". ".trimEnd());
      expect(endsAtSentence).toBe(true);
    }
  });

  it("handles very large input without crashing", () => {
    const text = "Large document content. ".repeat(50000);
    const chunks = chunkText(text);
    expect(chunks.length).toBeGreaterThan(100);
    expect(chunks.every((c) => c.length > 0)).toBe(true);
  });

  it("respects custom chunkSize and overlap", () => {
    const text = "X".repeat(5000);
    const chunks = chunkText(text, { chunkSize: 1000, overlap: 200 });
    expect(chunks.length).toBeGreaterThan(4);
    for (const chunk of chunks) {
      expect(chunk.length).toBeLessThanOrEqual(1100);
    }
  });

  it("covers the full input text (no content lost)", () => {
    const words = Array.from({ length: 500 }, (_, i) => `word${i}`);
    const text = words.join(" ");
    const chunks = chunkText(text, { chunkSize: 500, overlap: 100 });
    const combined = chunks.join(" ");
    for (const word of ["word0", "word250", "word499"]) {
      expect(combined).toContain(word);
    }
  });
});
