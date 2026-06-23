import { useState, useRef } from "react";
import { uploadPdf } from "../api.js";

function humanBytes(n) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(2)} MB`;
}

export default function DocumentList({
  workspace,
  onAddDocument,
  onDeleteDocument,
}) {
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState(null);
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef(null);

  async function handleFile(file) {
    if (!file || file.type !== "application/pdf") {
      setUploadError("Only PDF files are supported.");
      return;
    }
    setUploading(true);
    setUploadError(null);
    try {
      const data = await uploadPdf(file);
      onAddDocument(workspace.id, {
        name: data.filename,
        charCount: data.charCount,
        text: data.text,
      });
    } catch (err) {
      setUploadError(err.message || "Upload failed.");
    } finally {
      setUploading(false);
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
              <span className="doc-item-size">
                {humanBytes(new Blob([doc.text ?? ""]).size)}
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
          <span className="upload-zone-label">Uploading…</span>
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
