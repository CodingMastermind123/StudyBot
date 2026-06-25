export const PROMPTS = [
  {
    id: "summarize",
    label: "Summarize",
    displayLabel: "Summarize this document",
    retrieval: "broad",
    prompt:
      "Please summarize this document in clear bullet points, covering the main ideas and key takeaways.",
  },
  {
    id: "notes",
    label: "Notes",
    displayLabel: "Create study notes",
    retrieval: "broad",
    prompt:
      "Create structured study notes from this document. Use headings, sub-points, and highlight important definitions or concepts.",
  },
  {
    id: "diagram",
    label: "Diagram",
    displayLabel: "Generate a diagram",
    retrieval: "broad",
    prompt:
      "Create a single Mermaid diagram that visually represents the key concepts or structure of this document. Return it in a ```mermaid fenced code block. Important rules for valid syntax: use only one diagram type (flowchart, mindmap, or graph), keep node labels short (under 40 chars), wrap labels with special characters in quotes, do not use parentheses or brackets inside node labels, and return only ONE code block.",
  },
  {
    id: "practice",
    label: "Practice Problems",
    retrieval: "broad",
    buildPrompt: (count, difficulty) =>
      `Generate ${count} multiple choice practice problems based on the document at ${difficulty} difficulty. Return ONLY a valid JSON object with no markdown, no backticks, no explanation — just raw JSON in this exact format:\n\n{"questions":[{"id":1,"question":"question text here","choices":{"A":"choice text","B":"choice text","C":"choice text","D":"choice text"},"correct":"A","explanation":"explanation of why this is correct and others are wrong"}]}\n\nDo not include anything outside the JSON object.`,
    buildDisplayLabel: (count, difficulty) =>
      `Generate practice quiz · ${count} questions · ${difficulty}`,
  },
];
