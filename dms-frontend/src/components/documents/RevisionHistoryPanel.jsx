import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { History, X, Loader2, Eye, Download } from "lucide-react";
import { API, resolveUrl, STATUS_PILL, STATUS_LABEL } from "./constants";
import { anchorClick } from "../../utils/native";

const SLIDE_STYLE = document.getElementById("dms-slide-right") || (() => {
  const s = document.createElement("style");
  s.id = "dms-slide-right";
  s.textContent = `@keyframes slideInRight { from { transform: translateX(100%); } to { transform: translateX(0); } }`;
  document.head.appendChild(s);
  return s;
})();

export default function RevisionHistoryPanel({ drawing, token, onClose }) {
  const [revisions, setRevisions] = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [error,     setError]     = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`${API}/api/drawings/${drawing.id}/revisions`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) throw new Error("Failed to load revisions");
        const data = await res.json();
        if (!cancelled) setRevisions(data);
      } catch (e) {
        if (!cancelled) setError(e.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [drawing.id, token]);

  useEffect(() => {
    const handler = e => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onClose]);

  return createPortal(
    <>
      <div
        className="fixed inset-0 z-[9988] bg-black/30 backdrop-blur-[2px]"
        onClick={onClose}
      />

      <div className="fixed inset-y-0 right-0 z-[9989] w-full max-w-md bg-white border-l border-border-slate shadow-2xl flex flex-col animate-in slide-in-from-right"
           style={{ animation: "slideInRight .2s ease-out" }}
      >
        <div className="shrink-0 border-b border-border-slate px-5 py-4">
          <div className="flex items-center justify-between mb-1">
            <h2 className="text-[15px] font-semibold text-on-surface flex items-center gap-2">
              <History size={16} className="text-primary" />
              Revision History
            </h2>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-on-surface-variant hover:bg-surface-container hover:text-on-surface transition-colors"
            >
              <X size={16} />
            </button>
          </div>
          <p className="text-[13px] font-mono font-bold text-primary break-all">{drawing.number}</p>
          <p className="text-[11px] text-on-surface-variant mt-0.5 break-words">{drawing.title}</p>
        </div>

        <div className="flex-1 overflow-y-auto">
          {loading && (
            <div className="flex items-center justify-center h-40">
              <Loader2 size={20} className="animate-spin text-primary" />
            </div>
          )}

          {error && (
            <div className="m-4 px-4 py-3 rounded-lg bg-status-rose-bg text-status-rose-text text-[12px] font-medium border border-status-rose-text/20">
              {error}
            </div>
          )}

          {!loading && !error && revisions.length === 0 && (
            <div className="flex flex-col items-center justify-center h-40 text-on-surface-variant">
              <History size={24} className="text-outline mb-2" />
              <p className="text-[13px] font-medium">No revision history</p>
              <p className="text-[11px] mt-0.5">This drawing has not been revised yet.</p>
            </div>
          )}

          {!loading && !error && revisions.length > 0 && (
            <div className="px-5 py-4">
              <div className="relative">
                <div className="absolute left-[15px] top-3 bottom-3 w-px bg-border-slate" />

                {[...revisions].reverse().map((rev, i) => {
                  const isCurrent = rev.current;
                  const filename  = rev.path?.split("/").pop() ?? "";
                  const ext       = filename.split(".").pop().toUpperCase();
                  const statusPill  = STATUS_PILL[rev.status]  ?? "bg-surface-container text-on-surface-variant";
                  const statusLabel = STATUS_LABEL[rev.status] ?? rev.status;

                  return (
                    <div key={rev.id ?? "current"} className="relative pl-10 pb-6 last:pb-0">
                      <div className={`absolute left-[9px] top-1.5 w-[13px] h-[13px] rounded-full border-2 ${
                        isCurrent
                          ? "bg-primary border-primary"
                          : "bg-surface-container border-border-slate"
                      }`} />

                      <div className={`rounded-xl border overflow-hidden ${
                        isCurrent
                          ? "border-primary/30 bg-primary/5"
                          : "border-border-slate bg-white opacity-80"
                      } transition-colors`}>

                        {!isCurrent && (
                          <div className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-50 border-b border-amber-200">
                            <svg width="11" height="11" viewBox="0 0 16 16" fill="none" className="shrink-0 text-amber-600">
                              <path d="M8 1L15 14H1L8 1Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/>
                              <path d="M8 6v4M8 11.5v.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                            </svg>
                            <p className="text-[10px] font-medium text-amber-700">
                              Older revision — use the current revision for latest work.
                            </p>
                          </div>
                        )}

                        <div className="p-3.5">
                          <div className="flex items-center gap-1.5 flex-wrap mb-1.5">
                            <span className={`px-2 py-0.5 rounded-full text-[11px] font-bold font-mono ${
                              isCurrent ? "bg-primary text-white" : "bg-surface-container text-on-surface-variant"
                            }`}>
                              Rev {rev.rev || "—"}
                            </span>

                            {isCurrent ? (
                              <span className="px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider bg-status-emerald-bg text-status-emerald-text border border-status-emerald-text/20">
                                ✓ Current
                              </span>
                            ) : (
                              <span className="px-1.5 py-0.5 rounded text-[9px] font-semibold uppercase tracking-wider bg-amber-50 text-amber-700 border border-amber-200">
                                Superseded
                              </span>
                            )}

                            {rev.status && (
                              <span className={`px-1.5 py-0.5 rounded-full text-[9px] font-semibold ${statusPill}`}>
                                {statusLabel}
                              </span>
                            )}
                          </div>

                          <p className={`text-[12px] font-medium leading-snug mb-1 ${isCurrent ? "text-on-surface" : "text-on-surface-variant"}`}>
                            {rev.title}
                          </p>

                          <div className="flex items-center gap-3 text-[11px] text-on-surface-variant">
                            {rev.created_at && (
                              <span>{new Date(rev.created_at).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}</span>
                            )}
                            {rev.uploaded_by && <span>by {rev.uploaded_by}</span>}
                            {rev.discipline  && <span>{rev.discipline}</span>}
                          </div>

                          {rev.path && (
                            <div className="flex items-center gap-1 mt-2.5">
                              <a
                                href={resolveUrl(rev.path)}
                                target="_blank"
                                rel="noreferrer"
                                onClick={anchorClick(resolveUrl(rev.path))}
                                className="flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-medium text-on-surface-variant hover:text-primary hover:bg-surface-container transition-colors"
                              >
                                <Eye size={12} /> View
                              </a>
                              <a
                                href={resolveUrl(rev.path)}
                                download={`${drawing.number}_Rev${rev.rev || "X"}.${ext.toLowerCase()}`}
                                onClick={anchorClick(resolveUrl(rev.path))}
                                className="flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-medium text-on-surface-variant hover:text-primary hover:bg-surface-container transition-colors"
                              >
                                <Download size={12} /> Download
                              </a>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        <div className="shrink-0 border-t border-border-slate px-5 py-3">
          <p className="text-[11px] text-on-surface-variant">
            {revisions.length} revision{revisions.length !== 1 ? "s" : ""} total
          </p>
        </div>
      </div>
    </>,
    document.body
  );
}
