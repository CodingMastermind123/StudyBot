// Per-workspace accent color presets — used for color dots/labels only,
// NOT for overriding global CSS vars.
export const ACCENT_COLORS = [
  { id: "indigo",  name: "Indigo",  value: "#6366f1" },
  { id: "sky",     name: "Sky",     value: "#38bdf8" },
  { id: "emerald", name: "Emerald", value: "#34d399" },
  { id: "amber",   name: "Amber",   value: "#fbbf24" },
  { id: "rose",    name: "Rose",    value: "#fb7185" },
  { id: "violet",  name: "Violet",  value: "#a78bfa" },
];

export function getColor(id) {
  return ACCENT_COLORS.find((c) => c.id === id) ?? ACCENT_COLORS[0];
}
