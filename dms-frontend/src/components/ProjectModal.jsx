import { useState } from "react";
import { X, FolderPlus, Loader2 } from "lucide-react";
import useModalClose from "./documents/useModalClose";

export default function ProjectModal({ onClose, onSubmit }) {
  const { handleBackdrop, panelRef } = useModalClose(onClose);
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
    } catch {
      setError("Failed to create project.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[400] flex items-center justify-center p-4" style={{ background: "var(--color-scrim)" }} onClick={handleBackdrop} role="dialog" aria-modal="true" aria-label="New project">
      <div ref={panelRef} className="modal-enter bg-surface rounded-2xl shadow-card-lg border border-border-slate w-full max-w-md overflow-hidden">
        {/* Header */}
        <div className="px-4 sm:px-6 py-5 border-b border-border-slate flex items-center justify-between bg-surface-container-low">
          <div>
            <h2 className="text-base font-semibold text-on-surface flex items-center gap-2">
              <FolderPlus className="w-5 h-5 text-primary" />
              New Project
            </h2>
            <p className="text-xs text-on-surface-variant mt-0.5">Create a project drawing workspace.</p>
          </div>
          <button onClick={onClose} className="mobile-touch-target grid place-items-center text-on-surface-variant hover:text-on-surface transition-colors rounded-lg hover:bg-surface-container" aria-label="Close">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 sm:p-6 space-y-4">
          {error && <p className="text-xs font-semibold text-red-500 bg-red-50 p-2 rounded-lg border border-red-100">{error}</p>}
          
          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-widest mb-1.5">Project Name</label>
            <input
              autoFocus
              placeholder="Project name"
              value={name}
              onChange={e => setName(e.target.value)}
              className="w-full min-h-11 bg-white border border-border-slate rounded-lg px-4 py-2.5 text-sm text-on-surface outline-none transition-colors focus:ring-2 focus:ring-primary/20 focus:border-primary"
            />
          </div>
          
          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-widest mb-1.5">Project Code</label>
            <input
              placeholder="Project code"
              value={code}
              onChange={e => setCode(e.target.value.toUpperCase())}
              className="w-full min-h-11 bg-white border border-border-slate rounded-lg px-4 py-2.5 text-sm text-on-surface outline-none transition-colors focus:ring-2 focus:ring-primary/20 focus:border-primary"
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100 mt-6">
            <button
              type="button"
              onClick={onClose}
              className="min-h-11 px-4 py-2 text-sm font-medium text-on-surface-variant hover:text-on-surface border border-border-slate rounded-lg transition-colors bg-white"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="min-h-11 px-5 py-2 text-sm font-semibold text-white bg-primary hover:bg-primary-container rounded-lg transition-colors flex items-center gap-2 disabled:opacity-60"
            >
              {submitting ? <><Loader2 className="w-4 h-4 animate-spin" />Creating…</> : "Create Project"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
