import { useState } from "react";
import { getColor } from "../lib/colors.js";
import NewWorkspaceForm from "./NewWorkspaceForm.jsx";

export default function WorkspaceSwitcher({
  workspaces,
  activeWorkspaceId,
  onSelect,
  onCreateWorkspace,
  onDeleteWorkspace,
}) {
  const [showForm, setShowForm] = useState(false);

  function handleCreate(data) {
    onCreateWorkspace(data);
    setShowForm(false);
  }

  return (
    <div className="workspace-switcher">
      {workspaces.length === 0 && !showForm && (
        <p className="ws-empty-hint">Create your first workspace to get started.</p>
      )}

      <div className="workspace-pill-list">
        {workspaces.map((ws) => {
          const color = getColor(ws.color);
          const isActive = ws.id === activeWorkspaceId;
          return (
            <div
              key={ws.id}
              className={`workspace-pill${isActive ? " active" : ""}`}
              onClick={() => onSelect(ws.id)}
            >
              <span
                className="ws-color-dot"
                style={{ backgroundColor: color.value }}
              />
              <span className="ws-pill-name">{ws.name}</span>
              <button
                className="btn-icon-delete ws-pill-delete"
                title="Delete workspace"
                onClick={(e) => {
                  e.stopPropagation();
                  onDeleteWorkspace(ws.id);
                }}
              >
                ×
              </button>
            </div>
          );
        })}
      </div>

      {showForm ? (
        <NewWorkspaceForm
          onSubmit={handleCreate}
          onCancel={() => setShowForm(false)}
        />
      ) : (
        <button
          className="btn-new-workspace"
          onClick={() => setShowForm(true)}
        >
          + New Workspace
        </button>
      )}
    </div>
  );
}
