import { useState, useRef } from "react";
import { createPortal } from "react-dom";
import { Upload, Loader2 } from "lucide-react";
import { API, nextRev } from "./constants";
import useModalClose from "./useModalClose";

export default function NewRevisionModal({ drawing, token, projectId, onSuccess, onClose }) {
  const { handleBackdrop, panelRef } = useModalClose(onClose);
  const [title,      setTitle]      = useState(drawing.title      ?? "");
  const [revision,   setRevision]   = useState(nextRev(drawing.rev));
  const [file,       setFile]       = useState(null);
  const [dragging,   setDragging]   = useState(false);
  const [loading,    setLoading]    = useState(false);
  const [error,      setError]      = useState("");
  const fileInputRef = useRef(null);

  const handleFile = f => { if (f) setFile(f); };

  const handleSubmit = async () => {
    if (!file) { setError("Please select a file."); return; }
    setLoading(true);
    setError("");
    try {
      const fd = new FormData();
      fd.append("drawingFile",   file);
      fd.append("drawingNumber", drawing.number);
      fd.append("title",         title);
      fd.append("discipline",    drawing.discipline ?? "");
      fd.append("revision",      revision);
      fd.append("originator",    drawing.originator ?? "");
      fd.append("status",        drawing.status ?? "S3");
      fd.append("notes",         "");
      fd.append("projectId",     projectId ?? "");
      fd.append("folderPath",    drawing.folderPath ?? "");
      const res = await fetch(`${API}/api/upload`, {
        method:  "POST",
        headers: { Authorization: `Bearer ${token}` },
        body:    fd,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { setError(data.error || `Server responded ${res.status}`); setLoading(false); return; }
      await onSuccess(`New revision ${revision} of "${drawing.number}" uploaded.`);
      onClose();
    } catch {
      setError("Network error — please try again.");
      setLoading(false);
    }
  };

  return createPortal(
    <div
      className="fixed inset-0 z-[400] flex items-center justify-center p-4"
      style={{ background: "var(--color-scrim)" }}
      onClick={handleBackdrop}
      role="dialog"
      aria-modal="true"
      aria-label="Upload new revision"
    >
      <div ref={panelRef} className="bg-white rounded-2xl shadow-xl border border-border-slate w-full max-w-md overflow-hidden">
        <div className="h-1 bg-primary" />
        <div className="px-6 py-4 border-b border-border-slate">
          <h2 className="text-[15px] font-semibold text-on-surface">Upload New Revision</h2>
          <p className="text-[11px] text-on-surface-variant font-mono mt-0.5">{drawing.number} — locked</p>
        </div>
        <div className="px-6 py-5 space-y-4">
          {error && (
            <div className="px-4 py-2.5 rounded-lg bg-status-rose-bg text-status-rose-text text-[12px] font-medium border border-status-rose-text/20">
              {error}
            </div>
          )}

          <div
            onClick={() => fileInputRef.current?.click()}
            onDragOver={e => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={e => { e.preventDefault(); setDragging(false); handleFile(e.dataTransfer.files[0]); }}
            className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-colors ${
              file
                ? "border-status-emerald-text bg-status-emerald-bg"
                : dragging
                ? "border-primary bg-primary/5"
                : "border-border-slate hover:border-primary/50 hover:bg-surface-container-low"
            }`}
          >
            <input
              ref={fileInputRef}
              type="file"
              className="hidden"
              onChange={e => handleFile(e.target.files[0])}
            />
            <Upload size={20} className={`mx-auto mb-2 ${file ? "text-status-emerald-text" : "text-on-surface-variant"}`} />
            {file
              ? <p className="text-[13px] font-semibold text-status-emerald-text">{file.name}</p>
              : <>
                  <p className="text-[13px] font-medium text-on-surface">Drop file here or click to browse</p>
                  <p className="text-[11px] text-on-surface-variant mt-1">PDF, DWG, DXF, IFC, RVT</p>
                </>
            }
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-on-surface-variant uppercase tracking-wider mb-1.5">Revision</label>
            <input
              value={revision}
              onChange={e => setRevision(e.target.value)}
              className="w-full px-3 py-2 text-[13px] border border-border-slate rounded-lg text-on-surface font-mono focus:outline-none focus:ring-1 focus:ring-primary/30 focus:border-primary"
            />
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-on-surface-variant uppercase tracking-wider mb-1.5">Title</label>
            <input
              value={title}
              onChange={e => setTitle(e.target.value)}
              className="w-full px-3 py-2 text-[13px] border border-border-slate rounded-lg text-on-surface focus:outline-none focus:ring-1 focus:ring-primary/30 focus:border-primary"
            />
          </div>
        </div>
        <div className="px-6 py-4 border-t border-border-slate flex justify-end gap-2">
          <button
            onClick={onClose}
            disabled={loading}
            className="px-4 py-2 rounded-lg border border-border-slate bg-white text-on-surface-variant hover:bg-surface-container text-[13px] font-medium transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={loading || !file}
            className="px-4 py-2 rounded-lg bg-primary text-white hover:bg-primary-container text-[13px] font-medium transition-colors disabled:opacity-60 flex items-center gap-1.5"
          >
            {loading ? <><Loader2 size={13} className="animate-spin" />Uploading…</> : <><Upload size={13} />Upload Revision</>}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
