// ─── Quota helpers ────────────────────────────────────────────────────────────

// Warn when one workspace's combined document text exceeds 3 MB
export const WORKSPACE_DOC_LIMIT_BYTES = 3 * 1024 * 1024;

// Accurate UTF-8 byte size via Blob (not .length which counts UTF-16 code units)
export function workspaceTextBytes(workspace) {
  return workspace.documents.reduce(
    (total, doc) => total + new Blob([doc.text ?? ""]).size,
    0
  );
}

export function isOverDocLimit(workspace) {
  return workspaceTextBytes(workspace) > WORKSPACE_DOC_LIMIT_BYTES;
}
