const STORE_KEY = "studybot.workspaces";

export class StorageQuotaError extends Error {
  constructor() {
    super("localStorage quota exceeded — remove a document or workspace to free space.");
    this.name = "StorageQuotaError";
  }
}

function emptyStore() {
  return { workspaces: [], activeWorkspaceId: null, activeChatId: null };
}

export function loadStore() {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (!raw) return emptyStore();
    const parsed = JSON.parse(raw);
    // Sanity check — must be an object with a workspaces array
    if (!parsed || !Array.isArray(parsed.workspaces)) return emptyStore();
    return parsed;
  } catch {
    return emptyStore();
  }
}

export function saveStore(store) {
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(store));
  } catch (err) {
    if (
      err instanceof DOMException &&
      (err.name === "QuotaExceededError" ||
        err.name === "NS_ERROR_DOM_QUOTA_REACHED" ||
        err.code === 22)
    ) {
      throw new StorageQuotaError();
    }
    throw err;
  }
}

export function newId() {
  return crypto.randomUUID();
}

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
