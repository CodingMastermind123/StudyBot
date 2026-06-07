import { useState } from "react";
import { ACCENT_COLORS } from "../lib/colors.js";

export default function NewWorkspaceForm({ onSubmit, onCancel }) {
  const [name, setName] = useState("");
  const [color, setColor] = useState(ACCENT_COLORS[0].id);
  const [error, setError] = useState("");

  function handleSubmit(e) {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) {
      setError("Name is required.");
      return;
    }
    onSubmit({ name: trimmed, color });
    setName("");
    setColor(ACCENT_COLORS[0].id);
    setError("");
  }

  return (
    <form className="new-workspace-form" onSubmit={handleSubmit}>
      <input
        className="ws-name-input"
        type="text"
        placeholder="Workspace name (e.g. PHYS 2426)"
        value={name}
        onChange={(e) => {
          setName(e.target.value);
          setError("");
        }}
        autoFocus
        maxLength={60}
      />
      {error && <p className="ws-form-error">{error}</p>}

      <div className="ws-color-picker">
        {ACCENT_COLORS.map((c) => (
          <button
            key={c.id}
            type="button"
            title={c.name}
            className={`ws-color-swatch${color === c.id ? " selected" : ""}`}
            style={{ backgroundColor: c.value }}
            onClick={() => setColor(c.id)}
          />
        ))}
      </div>

      <div className="ws-form-actions">
        <button type="submit" className="btn-ws-create">
          Create
        </button>
        <button type="button" className="btn-ws-cancel" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </form>
  );
}
