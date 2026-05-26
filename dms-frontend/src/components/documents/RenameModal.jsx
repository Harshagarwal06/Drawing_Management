import { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { Loader2 } from "lucide-react";
import { API } from "./constants";

export default function RenameModal({ drawing, token, onSuccess, onClose }) {
  const [title,   setTitle]   = useState(drawing.title ?? "");
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState("");
  const inputRef = useRef(null);

  useEffect(() => { inputRef.current?.select(); }, []);

  const handleRename = async () => {
    if (!title.trim()) return;
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`${API}/api/drawings/${drawing.id}`, {
        method:  "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body:    JSON.stringify({ title }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || "Rename failed."); setLoading(false); return; }
      await onSuccess(`"${drawing.number}" renamed successfully.`);
      onClose();
    } catch {
      setError("Network error — please try again.");
      setLoading(false);
    }
  };

  return createPortal(
    <div
      className="fixed inset-0 z-[9990] flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.45)" }}
    >
      <div className="bg-white rounded-2xl shadow-xl border border-border-slate w-full max-w-sm overflow-hidden">
        <div className="h-1 bg-primary" />
        <div className="px-6 py-5">
          <h2 className="text-[15px] font-semibold text-on-surface mb-0.5">Rename Drawing</h2>
          <p className="text-[11px] text-on-surface-variant font-mono mb-4">{drawing.number}</p>
          {error && (
            <div className="mb-3 px-4 py-2.5 rounded-lg bg-status-rose-bg text-status-rose-text text-[12px] font-medium border border-status-rose-text/20">
              {error}
            </div>
          )}
          <label className="block text-[11px] font-semibold text-on-surface-variant uppercase tracking-wider mb-1.5">Title</label>
          <input
            ref={inputRef}
            value={title}
            onChange={e => setTitle(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter") handleRename(); if (e.key === "Escape") onClose(); }}
            className="w-full px-3 py-2 text-[13px] border border-border-slate rounded-lg text-on-surface focus:outline-none focus:ring-1 focus:ring-primary/30 focus:border-primary"
          />
        </div>
        <div className="px-6 pb-5 flex justify-end gap-2">
          <button
            onClick={onClose}
            disabled={loading}
            className="px-4 py-2 rounded-lg border border-border-slate bg-white text-on-surface-variant hover:bg-surface-container text-[13px] font-medium transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleRename}
            disabled={loading || !title.trim()}
            className="px-4 py-2 rounded-lg bg-primary text-white hover:bg-primary-container text-[13px] font-medium transition-colors disabled:opacity-60 flex items-center gap-1.5"
          >
            {loading ? <><Loader2 size={13} className="animate-spin" />Renaming…</> : "Rename"}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
