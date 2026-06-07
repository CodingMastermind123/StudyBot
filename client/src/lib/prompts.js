export const PROMPTS = [
  {
    id: "summarize",
    label: "Summarize",
    prompt:
      "Please summarize this document in clear bullet points, covering the main ideas and key takeaways.",
  },
  {
    id: "notes",
    label: "Notes",
    prompt:
      "Create structured study notes from this document. Use headings, sub-points, and highlight important definitions or concepts.",
  },
  {
    id: "diagram",
    label: "Diagram",
    prompt:
      "Create a Mermaid diagram that visually represents the key concepts or structure of this document. Return it in a ```mermaid fenced code block.",
  },
  {
    id: "practice",
    label: "Practice Problems",
    // prompt is built dynamically in PromptChips — this field is unused for this id
    buildPrompt: (count, difficulty) =>
      `Generate ${count} ${difficulty} practice problems based on the document. Number them 1 through ${count}. Do not include answers. After the last question add a separator and text: "Reply show answers when ready to see solutions."`,
  },
];
