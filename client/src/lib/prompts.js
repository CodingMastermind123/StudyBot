export const PROMPTS = [
  {
    id: "summarize",
    label: "Summarize",
    displayLabel: "Summarize this document",
    prompt:
      "Please summarize this document in clear bullet points, covering the main ideas and key takeaways.",
  },
  {
    id: "notes",
    label: "Notes",
    displayLabel: "Create study notes",
    prompt:
      "Create structured study notes from this document. Use headings, sub-points, and highlight important definitions or concepts.",
  },
  {
    id: "diagram",
    label: "Diagram",
    displayLabel: "Generate a diagram",
    prompt:
      "Create a Mermaid diagram that visually represents the key concepts or structure of this document. Return it in a ```mermaid fenced code block.",
  },
  {
    id: "practice",
    label: "Practice Problems",
    buildPrompt: (count, difficulty) =>
      `Generate ${count} multiple choice practice problems based on the document at ${difficulty} difficulty. Return ONLY a valid JSON object with no markdown, no backticks, no explanation — just raw JSON in this exact format:\n\n{"questions":[{"id":1,"question":"question text here","choices":{"A":"choice text","B":"choice text","C":"choice text","D":"choice text"},"correct":"A","explanation":"explanation of why this is correct and others are wrong"}]}\n\nDo not include anything outside the JSON object.`,
    buildDisplayLabel: (count, difficulty) =>
      `Generate practice quiz · ${count} questions · ${difficulty}`,
  },
];
