import { useState, useRef } from "react";
import { ingestDocument } from "../api.js";

function humanBytes(n) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(2)} MB`;
}

function statusBadge(status) {
  if (status === "ready") return null;
  if (status === "processing") return <span className="doc-status processing">processing</span>;
  if (status === "failed") return <span className="doc-status failed">failed</span>;
  return <span className="doc-status pending">pending</span>;
}

export default function DocumentList({
  workspace,
  onAddDocument,
  onDeleteDocument,
}) {
  const [ingestState, setIngestState] = useState(null);
  const [uploadError, setUploadError] = useState(null);
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef(null);
  const uploading = !!ingestState;

  async function handleFile(file) {
    if (!file || file.type !== "application/pdf") {
      setUploadError("Only PDF files are supported.");
      return;
    }
    const docId = crypto.randomUUID();
    setIngestState({ phase: "extracting" });
    setUploadError(null);
    onAddDocument(workspace.id, {
      id: docId,
      name: file.name,
      charCount: 0,
      ingestStatus: "processing",
    });
    try {
      const result = await ingestDocument({
        file,
        documentId: docId,
        workspaceId: workspace.id,
        name: file.name,
        onProgress: (event) => setIngestState(event),
      });
      if (result) {
        onAddDocument(workspace.id, {
          id: docId,
          name: file.name,
          charCount: result.charCount,
          ingestStatus: "ready",
          chunkCount: result.chunkCount,
        });
      }
    } catch (err) {
      onAddDocument(workspace.id, {
        id: docId,
        name: file.name,
        charCount: 0,
        ingestStatus: "failed",
      });
      setUploadError(err.message || "Upload failed.");
    } finally {
      setIngestState(null);
    }
  }

  function onFileChange(e) {
    handleFile(e.target.files[0]);
    e.target.value = "";
  }

  function onDrop(e) {
    e.preventDefault();
    setDragOver(false);
    handleFile(e.dataTransfer.files[0]);
  }

  return (
    <div className="doc-list-section">
      <p className="sidebar-section-label">Documents</p>

      {workspace.documents.length === 0 ? (
        <p className="sidebar-empty-hint">No documents yet.</p>
      ) : (
        <ul className="doc-list">
          {workspace.documents.map((doc) => (
            <li key={doc.id} className="doc-item">
              <span className="doc-item-icon">PDF</span>
              <span className="doc-item-name" title={doc.name}>
                {doc.name}
              </span>
              {statusBadge(doc.ingestStatus)}
              <span className="doc-item-size">
                {humanBytes(doc.charCount || 0)}
              </span>
              <button
                className="btn-icon-delete"
                title="Remove document"
                onClick={() => onDeleteDocument(workspace.id, doc.id)}
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      )}

      {uploadError && (
        <p className="upload-error">{uploadError}</p>
      )}

      <div
        className={`upload-zone compact${dragOver ? " drag-over" : ""}${
          uploading ? " uploading" : ""
        }`}
        onClick={() => !uploading && inputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
      >
        {uploading ? (
          <>
            <span className="upload-zone-label">
              {ingestState?.phase === "extracting" && "Reading PDF…"}
              {ingestState?.phase === "embedding" && `Embedding (${ingestState.done}/${ingestState.total})`}
              {ingestState?.phase === "done" && "Ready"}
              {!ingestState?.phase && "Processing…"}
            </span>
            {ingestState?.phase === "embedding" && ingestState.total > 0 && (
              <div className="ingest-progress-bar compact">
                <div
                  className="ingest-progress-fill"
                  style={{ width: `${Math.round((ingestState.done / ingestState.total) * 100)}%` }}
                />
              </div>
            )}
          </>
        ) : (
          <>
            <span className="upload-zone-label">
              <strong>Upload PDF</strong>
            </span>
            <span className="upload-zone-sub">click or drag & drop</span>
          </>
        )}
        <input
          ref={inputRef}
          type="file"
          accept="application/pdf"
          style={{ display: "none" }}
          onChange={onFileChange}
          disabled={uploading}
        />
      </div>
    </div>
  );
}
