import { useState, useEffect, useRef } from "react";
import { getColor, ACCENT_COLORS } from "../lib/colors.js";
import NewWorkspaceForm from "./NewWorkspaceForm.jsx";

export default function WorkspaceSwitcher({
  workspaces,
  activeWorkspaceId,
  onSelect,
  onCreateWorkspace,
  onDeleteWorkspace,
  onRenameWorkspace,
  onRecolorWorkspace,
}) {
  const [showForm, setShowForm] = useState(false);
  const [openMenuId, setOpenMenuId] = useState(null);
  const [menuMode, setMenuMode] = useState(null); // null | 'rename' | 'color' | 'deleteConfirm'
  const [renameValue, setRenameValue] = useState("");
  const menuContainerRef = useRef(null);
  const colorMenuInputRef = useRef(null);
  // Tracks the last custom hex value shown in the native picker (so it opens on the right color).
  const [customMenuColor, setCustomMenuColor] = useState("#6366f1");

  // Close the dropdown when clicking anywhere outside the open wrapper
  useEffect(() => {
    if (!openMenuId) return;
    function handleOutsideClick(e) {
      if (!menuContainerRef.current?.contains(e.target)) closeMenu();
    }
    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, [openMenuId]);

  function toggleMenu(wsId, wsName, e) {
    e.stopPropagation();
    if (openMenuId === wsId) { closeMenu(); return; }
    setOpenMenuId(wsId);
    setMenuMode(null);
    setRenameValue(wsName);
  }

  function closeMenu() {
    setOpenMenuId(null);
    setMenuMode(null);
    setRenameValue("");
  }

  function submitRename(wsId) {
    const trimmed = renameValue.trim();
    if (trimmed) onRenameWorkspace(wsId, trimmed);
    closeMenu();
  }

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
          const isMenuOpen = openMenuId === ws.id;

          return (
            <div
              key={ws.id}
              className="ws-pill-wrapper"
              ref={(el) => { if (isMenuOpen) menuContainerRef.current = el; }}
            >
              {/* ── Pill row ── */}
              <div
                className={`workspace-pill${isActive ? " active" : ""}`}
                onClick={() => onSelect(ws.id)}
              >
                <span className="ws-color-dot" style={{ backgroundColor: color.value }} />
                <span className="ws-pill-name">{ws.name}</span>
                <button
                  className={`ws-context-btn${isMenuOpen ? " open" : ""}`}
                  title="Workspace options"
                  onClick={(e) => toggleMenu(ws.id, ws.name, e)}
                >
                  ···
                </button>
              </div>

              {/* ── Context dropdown ── */}
              {isMenuOpen && (
                <div className="ws-context-menu">
                  {menuMode === null && (
                    <>
                      <button
                        className="ws-menu-item"
                        onClick={() => setMenuMode("rename")}
                      >
                        Rename
                      </button>
                      <button
                        className="ws-menu-item"
                        onClick={() => setMenuMode("color")}
                      >
                        Change Color
                      </button>
                      <button
                        className="ws-menu-item danger"
                        onClick={() => setMenuMode("deleteConfirm")}
                      >
                        Delete
                      </button>
                    </>
                  )}

                  {menuMode === "rename" && (
                    <div className="ws-menu-section">
                      <input
                        className="ws-menu-rename-input"
                        value={renameValue}
                        autoFocus
                        maxLength={60}
                        onChange={(e) => setRenameValue(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") submitRename(ws.id);
                          if (e.key === "Escape") closeMenu();
                        }}
                        onBlur={() => submitRename(ws.id)}
                      />
                    </div>
                  )}

                  {menuMode === "color" && (
                    <div className="ws-menu-colors">
                      {ACCENT_COLORS.map((c) => (
                        <button
                          key={c.id}
                          className={`ws-color-swatch${ws.color === c.id ? " selected" : ""}`}
                          style={{ backgroundColor: c.value }}
                          title={c.name}
                          onClick={() => {
                            onRecolorWorkspace(ws.id, c.id);
                            closeMenu();
                          }}
                        />
                      ))}
                      {(() => {
                        const isCustom = ws.color?.startsWith("#");
                        return (
                          <>
                            <button
                              className={`ws-color-swatch ws-color-swatch-custom${isCustom ? " selected" : ""}`}
                              style={isCustom ? { backgroundColor: ws.color } : undefined}
                              title="Custom color"
                              onClick={() => colorMenuInputRef.current?.click()}
                            >
                              {!isCustom && "+"}
                            </button>
                            <input
                              ref={colorMenuInputRef}
                              type="color"
                              style={{ display: "none" }}
                              value={isCustom ? ws.color : customMenuColor}
                              onChange={(e) => {
                                setCustomMenuColor(e.target.value);
                                onRecolorWorkspace(ws.id, e.target.value);
                              }}
                            />
                          </>
                        );
                      })()}
                    </div>
                  )}

                  {menuMode === "deleteConfirm" && (
                    <div className="ws-menu-section">
                      <p className="ws-menu-confirm-text">Are you sure?</p>
                      <div className="ws-menu-confirm-actions">
                        <button
                          className="ws-menu-confirm-yes"
                          onClick={() => {
                            onDeleteWorkspace(ws.id);
                            closeMenu();
                          }}
                        >
                          Confirm
                        </button>
                        <button className="ws-menu-confirm-no" onClick={closeMenu}>
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {showForm ? (
        <NewWorkspaceForm onSubmit={handleCreate} onCancel={() => setShowForm(false)} />
      ) : (
        <button className="btn-new-workspace" onClick={() => setShowForm(true)}>
          + New Workspace
        </button>
      )}
    </div>
  );
}
