import { useState } from "react";
import { createPortal } from "react-dom";
import { Loader2 } from "lucide-react";
import { API } from "./constants";
import useModalClose from "./useModalClose";

export default function EditMetadataModal({ drawing, token, onSuccess, onClose }) {
  const { handleBackdrop } = useModalClose(onClose);
  const knownDisciplines = ["Architecture", "Structure", "Electrical", "Plumbing", "Fire", "HVAC", "Civil", "Interior"];
  const initIsOther      = !!drawing.discipline && !knownDisciplines.includes(drawing.discipline);
  const [number,           setNumber]           = useState(drawing.number     ?? "");
  const [title,            setTitle]            = useState(drawing.title      ?? "");
  const [discipline,       setDiscipline]       = useState(initIsOther ? "__other__" : (drawing.discipline ?? ""));
  const [disciplineOther,  setDisciplineOther]  = useState(initIsOther ? (drawing.discipline ?? "") : "");
  const [revision,         setRevision]         = useState(drawing.rev        ?? "");
  const [originator,       setOriginator]       = useState(drawing.originator ?? "");
  const [loading,          setLoading]          = useState(false);
  const [error,            setError]            = useState("");

  const effectiveDiscipline = discipline === "__other__" ? disciplineOther.trim() : discipline;

  const handleSave = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`${API}/api/drawings/${drawing.id}`, {
        method:  "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body:    JSON.stringify({ number, title, discipline: effectiveDiscipline, revision, originator, status: drawing.status }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || "Failed to save changes."); setLoading(false); return; }
      await onSuccess(`"${data.number}" updated successfully.`);
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
      onClick={handleBackdrop}
      role="dialog"
      aria-modal="true"
      aria-label="Edit metadata"
    >
      <div className="bg-white rounded-2xl shadow-xl border border-border-slate w-full max-w-lg overflow-hidden">
        <div className="h-1 bg-primary" />
        <div className="px-6 py-4 border-b border-border-slate">
          <h2 className="text-[15px] font-semibold text-on-surface">Edit Metadata</h2>
          <p className="text-[12px] text-on-surface-variant mt-0.5 font-mono">{drawing.number}</p>
        </div>
        <div className="px-6 py-5 space-y-4">
          {error && (
            <div className="px-4 py-2.5 rounded-lg bg-status-rose-bg text-status-rose-text text-[12px] font-medium border border-status-rose-text/20">
              {error}
            </div>
          )}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-[11px] font-semibold text-on-surface-variant uppercase tracking-wider mb-1.5">Drawing No.</label>
              <input
                value={number}
                onChange={e => setNumber(e.target.value)}
                className="w-full px-3 py-2 text-[13px] border border-border-slate rounded-lg text-on-surface font-mono focus:outline-none focus:ring-1 focus:ring-primary/30 focus:border-primary"
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-on-surface-variant uppercase tracking-wider mb-1.5">Revision</label>
              <input
                value={revision}
                onChange={e => setRevision(e.target.value)}
                className="w-full px-3 py-2 text-[13px] border border-border-slate rounded-lg text-on-surface font-mono focus:outline-none focus:ring-1 focus:ring-primary/30 focus:border-primary"
              />
            </div>
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-on-surface-variant uppercase tracking-wider mb-1.5">Title</label>
            <input
              value={title}
              onChange={e => setTitle(e.target.value)}
              className="w-full px-3 py-2 text-[13px] border border-border-slate rounded-lg text-on-surface focus:outline-none focus:ring-1 focus:ring-primary/30 focus:border-primary"
            />
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-on-surface-variant uppercase tracking-wider mb-1.5">Discipline</label>
            <select
              value={discipline}
              onChange={e => {
                setDiscipline(e.target.value);
                if (e.target.value !== "__other__") setDisciplineOther("");
              }}
              className="w-full px-3 py-2 text-[13px] border border-border-slate rounded-lg text-on-surface bg-white focus:outline-none focus:ring-1 focus:ring-primary/30 focus:border-primary"
            >
              <option value="">— Select —</option>
              <option>Architecture</option>
              <option>Structure</option>
              <option>MEP</option>
              <optgroup label="MEP Subtypes">
                <option>Electrical</option>
                <option>Plumbing</option>
                <option>Fire</option>
                <option>HVAC</option>
              </optgroup>
              <option>Civil</option>
              <option>Interior</option>
              <option value="__other__">Other…</option>
            </select>
            {discipline === "__other__" && (
              <input
                autoFocus
                placeholder="Specify drawing type…"
                className="mt-2 w-full px-3 py-2 text-[13px] border border-border-slate rounded-lg text-on-surface focus:outline-none focus:ring-1 focus:ring-primary/30 focus:border-primary"
                value={disciplineOther}
                onChange={e => setDisciplineOther(e.target.value)}
              />
            )}
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-on-surface-variant uppercase tracking-wider mb-1.5">Originator</label>
            <input
              value={originator}
              onChange={e => setOriginator(e.target.value)}
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
            onClick={handleSave}
            disabled={loading}
            className="px-4 py-2 rounded-lg bg-primary text-white hover:bg-primary-container text-[13px] font-medium transition-colors disabled:opacity-60 flex items-center gap-1.5"
          >
            {loading ? <><Loader2 size={13} className="animate-spin" />Saving…</> : "Save Changes"}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
