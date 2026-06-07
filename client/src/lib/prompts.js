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
    prompt:
      "Generate 5 practice questions based on this document. Include a mix of question types and provide the answers below each question.",
  },
];
