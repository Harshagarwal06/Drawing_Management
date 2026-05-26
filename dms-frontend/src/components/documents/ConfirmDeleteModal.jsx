import { useEffect } from "react";
import { createPortal } from "react-dom";
import { Trash2, Loader2 } from "lucide-react";

export default function ConfirmDeleteModal({ drawing, onConfirm, onCancel, loading }) {
  useEffect(() => {
    const h = e => { if (e.key === "Escape") onCancel(); };
    document.addEventListener("keydown", h);
    return () => document.removeEventListener("keydown", h);
  }, [onCancel]);

  return createPortal(
    <div
      className="fixed inset-0 z-[9998] flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.4)" }}
      onClick={e => { if (e.target === e.currentTarget) onCancel(); }}
      role="dialog"
      aria-modal="true"
      aria-label="Confirm delete"
    >
      <div className="bg-white rounded-2xl shadow-xl border border-border-slate w-full max-w-sm overflow-hidden">
        <div className="h-1 bg-red-500" />
        <div className="p-6">
          <div className="flex items-start gap-3 mb-5">
            <div className="w-10 h-10 rounded-full bg-status-rose-bg flex items-center justify-center shrink-0 mt-0.5">
              <Trash2 size={18} className="text-status-rose-text" />
            </div>
            <div>
              <h3 className="text-[15px] font-semibold text-on-surface">Delete drawing?</h3>
              <p className="text-[13px] text-on-surface-variant mt-1.5 leading-relaxed">
                <span className="font-mono font-bold text-primary">{drawing?.number}</span>
                {" "}will be permanently removed from the register. This cannot be undone.
              </p>
            </div>
          </div>

          <div className="flex gap-2 justify-end">
            <button
              onClick={onCancel}
              disabled={loading}
              className="px-4 py-2 rounded-lg border border-border-slate bg-white text-on-surface-variant hover:bg-surface-container text-[13px] font-medium transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={onConfirm}
              disabled={loading}
              className="px-4 py-2 rounded-lg bg-red-600 text-white hover:bg-red-700 text-[13px] font-medium transition-colors disabled:opacity-60 flex items-center gap-1.5"
            >
              {loading
                ? <><Loader2 size={13} className="animate-spin" />Deleting…</>
                : <><Trash2  size={13} />Delete</>}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
