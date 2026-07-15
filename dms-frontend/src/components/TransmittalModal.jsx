import { useState } from "react";
import { X, Search, Send, Loader2, Plus, UserPlus } from "lucide-react";
import FieldLabel from "./FieldLabel";
import { TRANSMITTAL_PURPOSES } from "../constants";
import useModalClose from "./documents/useModalClose";

const STATUS_PILL = {
  S3:   { bg: "bg-status-emerald-bg", text: "text-status-emerald-text" },
  S2:   { bg: "bg-status-amber-bg",   text: "text-status-amber-text"   },
  S1:   { bg: "bg-blue-50",           text: "text-blue-700"            },
  VOID: { bg: "bg-status-rose-bg",    text: "text-status-rose-text"    },
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function TransmittalModal({ drawings, onClose, onSubmit }) {
  const { handleBackdrop, panelRef } = useModalClose(onClose);
  const [selectedDrawings,   setSelectedDrawings]   = useState([]);
  const [selectedRecipients, setSelectedRecipients] = useState([]);
  const [recipientName,      setRecipientName]      = useState("");
  const [recipientEmail,     setRecipientEmail]     = useState("");
  const [recipientError,     setRecipientError]     = useState("");
  const [purpose,            setPurpose]            = useState("");
  const [remarks,            setRemarks]            = useState("");
  const [drawingSearch,      setDrawingSearch]      = useState("");
  const [errors,             setErrors]             = useState({});
  const [submitting,         setSubmitting]         = useState(false);

  const filteredDrawings = drawings.filter(d => {
    const q = drawingSearch.toLowerCase();
    return !q || d.number.toLowerCase().includes(q) || d.title.toLowerCase().includes(q);
  });

  const toggleDrawing = id =>
    setSelectedDrawings(p => p.includes(id) ? p.filter(x => x !== id) : [...p, id]);

  const addRecipient = () => {
    const name  = recipientName.trim();
    const email = recipientEmail.trim();
    if (!name)                  { setRecipientError("Name is required"); return; }
    if (!EMAIL_RE.test(email))  { setRecipientError("Enter a valid email address"); return; }
    setSelectedRecipients(p => [...p, { name, email }]);
    setRecipientName("");
    setRecipientEmail("");
    setRecipientError("");
    setErrors(e => ({ ...e, recipients: "" }));
  };

  const removeRecipient = idx =>
    setSelectedRecipients(p => p.filter((_, i) => i !== idx));

  const handleRecipientKeyDown = e => {
    if (e.key === "Enter") { e.preventDefault(); addRecipient(); }
  };

  const validate = () => {
    const e = {};
    if (selectedDrawings.length === 0)   e.drawings   = "Select at least one drawing";
    if (selectedRecipients.length === 0) e.recipients = "Add at least one recipient";
    if (!purpose)                        e.purpose    = "Required";
    return e;
  };

  const handleSubmit = async ev => {
    ev.preventDefault();
    const e = validate();
    if (Object.keys(e).length) { setErrors(e); return; }
    setSubmitting(true);
    try { await onSubmit({ drawingIds: selectedDrawings, recipients: selectedRecipients, purpose, remarks }); }
    finally { setSubmitting(false); }
  };

  const errMsg = key => errors[key] && <p className="text-[12px] text-status-rose-text mt-1.5">{errors[key]}</p>;
  const fieldBorder = key => errors[key] ? "border-status-rose-text" : "border-border-slate";

  return (
    <div className="fixed inset-0 z-[400] flex items-center justify-center p-4" style={{ background: "var(--color-scrim)" }} onClick={handleBackdrop} role="dialog" aria-modal="true" aria-label="Create transmittal">
      <div ref={panelRef} className="modal-enter bg-white rounded-2xl shadow-xl border border-border-slate w-full max-w-3xl max-h-[92dvh] overflow-hidden flex flex-col">

        {/* Header */}
        <div className="px-6 py-4 flex items-center justify-between shrink-0 bg-surface-container-low border-b border-border-slate">
          <div>
            <h2 className="text-[16px] font-semibold text-on-surface">Create Transmittal</h2>
            <p className="text-[12px] text-on-surface-variant mt-0.5">Issue drawings to project recipients</p>
          </div>
          <button onClick={onClose} className="mobile-touch-target grid place-items-center rounded-lg text-on-surface-variant hover:bg-surface-container hover:text-on-surface transition-colors" aria-label="Close">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="overflow-y-auto flex-1">
          <div className="p-4 sm:p-6 grid grid-cols-1 md:grid-cols-2 gap-6">

            {/* LEFT — Drawing selection */}
            <div className="flex flex-col gap-3">
              <FieldLabel req>Drawings to Issue</FieldLabel>
              <div className={`border rounded-xl overflow-hidden ${fieldBorder("drawings")}`}>
                {/* Search bar */}
                <div className="flex items-center gap-2 px-3 py-2 border-b border-border-slate bg-surface-container-low">
                  <Search className="w-3.5 h-3.5 text-on-surface-variant shrink-0" />
                  <input
                    placeholder="Filter drawings…"
                    value={drawingSearch}
                    onChange={e => setDrawingSearch(e.target.value)}
                    className="min-h-11 text-[13px] flex-1 outline-none bg-transparent text-on-surface placeholder:text-on-surface-variant"
                  />
                  {selectedDrawings.length > 0 && (
                    <span className="text-[11px] font-semibold text-primary bg-primary/10 px-1.5 py-0.5 rounded-full shrink-0">
                      {selectedDrawings.length} selected
                    </span>
                  )}
                </div>

                {/* List */}
                <div className="overflow-y-auto" style={{ maxHeight: "240px" }}>
                  {filteredDrawings.length === 0 ? (
                    <p className="text-[12px] text-on-surface-variant text-center py-6">No drawings match.</p>
                  ) : filteredDrawings.map(d => {
                    const checked = selectedDrawings.includes(d.id);
                    const sp = STATUS_PILL[d.status] ?? STATUS_PILL.S1;
                    return (
                      <label
                        key={d.id}
                        className={`min-h-11 flex items-start gap-3 px-3 py-2.5 cursor-pointer border-b border-border-slate last:border-0 transition-colors ${
                          checked ? "bg-primary/5" : "hover:bg-surface-container-low"
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => { toggleDrawing(d.id); setErrors(e => ({ ...e, drawings: "" })); }}
                          className="mt-0.5 accent-primary shrink-0"
                        />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="font-mono text-[12px] font-bold text-primary">{d.number}</span>
                            <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-semibold ${sp.bg} ${sp.text}`}>{d.status}</span>
                          </div>
                          <p className="text-[12px] text-on-surface-variant truncate mt-0.5">{d.title}</p>
                        </div>
                        <span className="text-[11px] text-on-surface-variant font-medium shrink-0 mt-0.5">Rev.{d.rev}</span>
                      </label>
                    );
                  })}
                </div>

                {/* Footer */}
                <div className="flex items-center gap-3 px-3 py-2 border-t border-border-slate bg-surface-container-low">
                  <button type="button" onClick={() => { setSelectedDrawings(drawings.map(d => d.id)); setErrors(e => ({ ...e, drawings: "" })); }}
                    className="min-h-11 text-[12px] text-primary hover:underline font-medium">Select all</button>
                  <span className="text-on-surface-variant text-[12px]">·</span>
                  <button type="button" onClick={() => setSelectedDrawings([])}
                    className="min-h-11 text-[12px] text-on-surface-variant hover:underline">Clear</button>
                </div>
              </div>
              {errMsg("drawings")}
            </div>

            {/* RIGHT — Recipients + Purpose + Remarks */}
            <div className="flex flex-col gap-5">

              {/* Recipients — free-type */}
              <div>
                <FieldLabel req>Recipients</FieldLabel>

                {/* Added recipients as pills */}
                {selectedRecipients.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mb-2">
                    {selectedRecipients.map((r, i) => (
                      <span key={i} className="inline-flex items-center gap-1.5 bg-primary/10 text-primary text-[12px] font-medium px-2.5 py-1 rounded-full border border-primary/20">
                        <span className="w-4 h-4 rounded-full bg-primary text-white flex items-center justify-center text-[10px] font-bold shrink-0">
                          {r.name.charAt(0).toUpperCase()}
                        </span>
                        <span className="max-w-[160px] truncate">{r.name} &lt;{r.email}&gt;</span>
                        <button
                          type="button"
                          onClick={() => removeRecipient(i)}
                          className="mobile-touch-target grid place-items-center ml-0.5 text-primary/60 hover:text-primary leading-none"
                          aria-label="Remove recipient"
                        >×</button>
                      </span>
                    ))}
                  </div>
                )}

                {/* Input row */}
                <div className={`border rounded-xl overflow-hidden ${errors.recipients ? "border-status-rose-text" : "border-border-slate"}`}>
                  <div className="flex flex-col sm:flex-row items-stretch gap-0 divide-y sm:divide-y-0 sm:divide-x divide-border-slate">
                    <div className="flex items-center gap-2 px-3 py-2 flex-1 min-w-0">
                      <UserPlus className="w-3.5 h-3.5 text-on-surface-variant shrink-0" />
                      <input
                        type="text"
                        placeholder="Full name"
                        value={recipientName}
                        onChange={e => { setRecipientName(e.target.value); setRecipientError(""); }}
                        onKeyDown={handleRecipientKeyDown}
                        className="text-[13px] flex-1 outline-none bg-transparent text-on-surface placeholder:text-on-surface-variant min-w-0"
                      />
                    </div>
                    <div className="flex items-center gap-2 px-3 py-2 flex-1 min-w-0">
                      <input
                        type="email"
                        placeholder="email@company.com"
                        value={recipientEmail}
                        onChange={e => { setRecipientEmail(e.target.value); setRecipientError(""); }}
                        onKeyDown={handleRecipientKeyDown}
                        className="text-[13px] flex-1 outline-none bg-transparent text-on-surface placeholder:text-on-surface-variant min-w-0"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={addRecipient}
                      className="min-h-11 px-3 py-2 bg-primary/10 hover:bg-primary/20 text-primary transition-colors shrink-0 flex items-center justify-center gap-1.5"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span className="text-[12px] font-semibold hidden sm:inline">Add</span>
                    </button>
                  </div>
                </div>

                {recipientError && (
                  <p className="text-[12px] text-status-rose-text mt-1.5">{recipientError}</p>
                )}
                {errMsg("recipients")}
              </div>

              {/* Purpose */}
              <div>
                <FieldLabel req>Purpose of Issue</FieldLabel>
                <select
                  value={purpose}
                  onChange={e => { setPurpose(e.target.value); setErrors(er => ({ ...er, purpose: "" })); }}
                  className={`w-full border rounded-xl px-3 py-2.5 text-[14px] text-on-surface bg-white outline-none transition focus:ring-2 focus:ring-primary/20 focus:border-primary ${fieldBorder("purpose")}`}
                >
                  <option value="">Select purpose…</option>
                  {TRANSMITTAL_PURPOSES.map(p => <option key={p}>{p}</option>)}
                </select>
                {errMsg("purpose")}
              </div>

              {/* Remarks */}
              <div>
                <FieldLabel>Remarks</FieldLabel>
                <textarea
                  rows={4}
                  value={remarks}
                  onChange={e => setRemarks(e.target.value)}
                  placeholder="Add any cover notes, instructions, or deadlines…"
                  className="w-full border border-border-slate rounded-xl px-3 py-2.5 text-[14px] text-on-surface bg-white outline-none resize-none transition focus:ring-2 focus:ring-primary/20 focus:border-primary placeholder:text-on-surface-variant"
                />
              </div>

              {/* Summary */}
              {(selectedDrawings.length > 0 || selectedRecipients.length > 0 || purpose) && (
                <div className="bg-primary/5 border border-primary/20 rounded-xl p-3 text-[12px] text-primary space-y-1">
                  <p className="font-semibold text-[13px] mb-1.5">Transmittal Summary</p>
                  {selectedDrawings.length > 0  && <p><span className="font-medium">{selectedDrawings.length}</span> drawing{selectedDrawings.length !== 1 ? "s" : ""} selected</p>}
                  {selectedRecipients.length > 0 && <p><span className="font-medium">{selectedRecipients.length}</span> recipient{selectedRecipients.length !== 1 ? "s" : ""}</p>}
                  {purpose && <p>Purpose: <span className="font-medium">{purpose}</span></p>}
                </div>
              )}
            </div>
          </div>

          {/* Footer */}
          <div className="sticky bottom-0 px-4 sm:px-6 py-4 border-t border-border-slate bg-surface-container-low flex items-center justify-between gap-3 shrink-0 safe-bottom">
            <p className="text-[12px] text-on-surface-variant hidden sm:block">A PDF cover sheet will be generated &amp; emailed to recipients.</p>
            <div className="flex items-center gap-2 ml-auto">
              <button type="button" onClick={onClose}
                className="min-h-11 bg-white border border-border-slate text-on-surface-variant hover:bg-surface-container px-4 py-2 rounded-lg text-[14px] font-medium transition-colors">
                Cancel
              </button>
              <button type="submit" disabled={submitting}
                className="min-h-11 bg-primary text-white rounded-lg hover:bg-primary-container px-5 py-2 font-medium text-[14px] flex items-center gap-2 disabled:opacity-60 transition-colors whitespace-nowrap">
                {submitting
                  ? <><Loader2 className="w-4 h-4 animate-spin" />Sending…</>
                  : <><Send className="w-4 h-4" />Send Transmittal</>}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
