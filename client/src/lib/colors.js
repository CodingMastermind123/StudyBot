// Per-workspace accent color presets.
// Each color's hex value is injected as --workspace-accent on the app root
// so all CSS can reference var(--workspace-accent) dynamically.
export const ACCENT_COLORS = [
  { id: "amber",   name: "Amber",   value: "#d97706" },
  { id: "rose",    name: "Rose",    value: "#be123c" },
  { id: "emerald", name: "Emerald", value: "#166534" },
  { id: "indigo",  name: "Indigo",  value: "#6366f1" },
  { id: "sky",     name: "Sky",     value: "#0ea5e9" },
  { id: "green",   name: "Green",   value: "#10b981" },
  { id: "yellow",  name: "Yellow",  value: "#f59e0b" },
  { id: "violet",  name: "Violet",  value: "#8b5cf6" },
];

export function getColor(id) {
  if (id && id.startsWith("#")) return { id, name: "Custom", value: id };
  return ACCENT_COLORS.find((c) => c.id === id) ?? ACCENT_COLORS[0];
}
