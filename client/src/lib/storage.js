// ─── Quota helpers ────────────────────────────────────────────────────────────

// Informational threshold — RAG handles large docs fine, but surface a note
export const WORKSPACE_DOC_LIMIT_BYTES = 3 * 1024 * 1024;

export function workspaceTextBytes(workspace) {
  return workspace.documents.reduce(
    (total, doc) => total + (doc.charCount || 0),
    0
  );
}

export function isOverDocLimit(workspace) {
  return workspaceTextBytes(workspace) > WORKSPACE_DOC_LIMIT_BYTES;
}
