import { useState, useEffect } from "react";
import { X, FolderPlus, Loader2 } from "lucide-react";

export default function ProjectModal({ onClose, onSubmit }) {
  useEffect(() => {
    const h = e => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", h);
    return () => document.removeEventListener("keydown", h);
  }, [onClose]);
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (ev) => {
    ev.preventDefault();
    if (!name.trim() || !code.trim()) {
      setError("Both project name and code are required.");
      return;
    }
    setError("");
    setSubmitting(true);
    try {
      await onSubmit({ name, code });
    } catch (err) {
      setError("Failed to create project.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(15,23,42,0.55)" }} onClick={e => { if (e.target === e.currentTarget) onClose(); }} role="dialog" aria-modal="true" aria-label="New project">
      <div className="modal-enter bg-white/95 backdrop-blur-xl rounded-2xl shadow-2xl border border-white/50 w-full max-w-md overflow-hidden">
        {/* Header */}
        <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between bg-gradient-to-r from-slate-900 to-slate-800">
          <div>
            <h2 className="text-base font-semibold text-white flex items-center gap-2">
              <FolderPlus className="w-5 h-5 text-indigo-400" />
              New Project
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">Create a new drawing management project.</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white transition p-1 rounded-lg hover:bg-white/10" aria-label="Close">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && <p className="text-xs font-semibold text-red-500 bg-red-50 p-2 rounded-lg border border-red-100">{error}</p>}
          
          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-widest mb-1.5">Project Name</label>
            <input
              autoFocus
              placeholder="e.g. Orion Tower, Dubai"
              value={name}
              onChange={e => setName(e.target.value)}
              className="w-full bg-white/50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-700 outline-none transition-all focus:ring-2 focus:ring-blue-500 focus:border-transparent focus:bg-white"
            />
          </div>
          
          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-widest mb-1.5">Project Code</label>
            <input
              placeholder="e.g. ORI-2024"
              value={code}
              onChange={e => setCode(e.target.value.toUpperCase())}
              className="w-full bg-white/50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-700 outline-none transition-all focus:ring-2 focus:ring-blue-500 focus:border-transparent focus:bg-white"
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100 mt-6">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-900 border border-slate-200 hover:border-slate-300 rounded-lg transition bg-white"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-5 py-2 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition flex items-center gap-2 disabled:opacity-60 shadow-[0_4px_14px_0_rgba(59,130,246,0.39)]"
            >
              {submitting ? <><Loader2 className="w-4 h-4 animate-spin" />Creating…</> : "Create Project"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
