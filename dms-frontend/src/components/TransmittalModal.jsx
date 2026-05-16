import { useState } from "react";
import { X, Search, Send, Loader2 } from "lucide-react";
import FieldLabel from "./FieldLabel";
import { MOCK_RECIPIENTS, TRANSMITTAL_PURPOSES, STATUS_META } from "../constants";

const AVATAR_COLORS = [
  "bg-violet-500","bg-blue-500","bg-teal-500","bg-amber-500","bg-pink-500",
  "bg-cyan-500","bg-orange-500","bg-emerald-500","bg-rose-500","bg-indigo-500",
];
const avatarColor = (id) =>
  AVATAR_COLORS[MOCK_RECIPIENTS.findIndex(r => r.id === id) % AVATAR_COLORS.length];

const STATUS_PILL = {
  S3:   { bg: "bg-status-emerald-bg", text: "text-status-emerald-text" },
  S2:   { bg: "bg-status-amber-bg",   text: "text-status-amber-text"   },
  S1:   { bg: "bg-blue-50",           text: "text-blue-700"            },
  VOID: { bg: "bg-status-rose-bg",    text: "text-status-rose-text"    },
};

export default function TransmittalModal({ drawings, onClose, onSubmit, trnNumber }) {
  const [selectedDrawings,   setSelectedDrawings]   = useState([]);
  const [selectedRecipients, setSelectedRecipients] = useState([]);
  const [purpose,            setPurpose]            = useState("");
  const [remarks,            setRemarks]            = useState("");
  const [drawingSearch,      setDrawingSearch]      = useState("");
  const [recipientSearch,    setRecipientSearch]    = useState("");
  const [recipientOpen,      setRecipientOpen]      = useState(false);
  const [errors,             setErrors]             = useState({});
  const [submitting,         setSubmitting]         = useState(false);

  const filteredDrawings = drawings.filter(d => {
    const q = drawingSearch.toLowerCase();
    return !q || d.number.toLowerCase().includes(q) || d.title.toLowerCase().includes(q);
  });

  const filteredRecipients = MOCK_RECIPIENTS.filter(r =>
    !selectedRecipients.find(s => s.id === r.id) &&
    (recipientSearch === "" ||
      r.name.toLowerCase().includes(recipientSearch.toLowerCase()) ||
      r.role.toLowerCase().includes(recipientSearch.toLowerCase()))
  );

  const toggleDrawing   = id => setSelectedDrawings(p => p.includes(id) ? p.filter(x => x !== id) : [...p, id]);
  const addRecipient    = r  => { setSelectedRecipients(p => [...p, r]); setRecipientSearch(""); setErrors(e => ({ ...e, recipients: "" })); };
  const removeRecipient = id => setSelectedRecipients(p => p.filter(r => r.id !== id));

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

  /* shared input border */
  const fieldBorder = key => errors[key] ? "border-status-rose-text" : "border-border-slate";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.3)" }}>
      <div className="modal-enter bg-white rounded-2xl shadow-xl border border-border-slate w-full max-w-3xl overflow-hidden flex flex-col" style={{ maxHeight: "92vh" }}>

        {/* Header */}
        <div className="px-6 py-4 flex items-center justify-between shrink-0 bg-surface-container-low border-b border-border-slate">
          <div>
            <span className="text-xs font-mono font-bold text-primary bg-primary/10 px-2 py-0.5 rounded border border-primary/20">
              {trnNumber}
            </span>
            <h2 className="text-[16px] font-semibold text-on-surface mt-1">Create Transmittal</h2>
            <p className="text-[12px] text-on-surface-variant mt-0.5">Issue drawings to project recipients</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-on-surface-variant hover:bg-surface-container hover:text-on-surface transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="overflow-y-auto flex-1">
          <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">

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
                    className="text-[13px] flex-1 outline-none bg-transparent text-on-surface placeholder:text-on-surface-variant"
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
                        className={`flex items-start gap-3 px-3 py-2.5 cursor-pointer border-b border-border-slate last:border-0 transition-colors ${
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
                    className="text-[12px] text-primary hover:underline font-medium">Select all</button>
                  <span className="text-on-surface-variant text-[12px]">·</span>
                  <button type="button" onClick={() => setSelectedDrawings([])}
                    className="text-[12px] text-on-surface-variant hover:underline">Clear</button>
                </div>
              </div>
              {errMsg("drawings")}
            </div>

            {/* RIGHT — Recipients + Purpose + Remarks */}
            <div className="flex flex-col gap-5">

              {/* Recipients */}
              <div className="relative">
                <FieldLabel req>Recipients</FieldLabel>
                <div
                  className={`min-h-[44px] border rounded-xl px-3 py-2 flex flex-wrap gap-1.5 cursor-text bg-white transition-colors ${fieldBorder("recipients")}`}
                  onClick={() => setRecipientOpen(true)}
                >
                  {selectedRecipients.map(r => (
                    <span key={r.id} className="inline-flex items-center gap-1 bg-primary/10 text-primary text-[12px] font-medium px-2 py-1 rounded-full">
                      <span className={`w-4 h-4 rounded-full ${avatarColor(r.id)} text-white flex items-center justify-center text-[8px] font-bold shrink-0`}>
                        {r.avatar[0]}
                      </span>
                      {r.name}
                      <button type="button" onClick={e => { e.stopPropagation(); removeRecipient(r.id); }}
                        className="ml-0.5 text-primary/60 hover:text-primary">×</button>
                    </span>
                  ))}
                  <input
                    placeholder={selectedRecipients.length === 0 ? "Search people or groups…" : ""}
                    value={recipientSearch}
                    onChange={e => { setRecipientSearch(e.target.value); setRecipientOpen(true); }}
                    onFocus={() => setRecipientOpen(true)}
                    className="text-[13px] flex-1 min-w-[120px] outline-none bg-transparent text-on-surface placeholder:text-on-surface-variant py-0.5"
                  />
                </div>

                {recipientOpen && filteredRecipients.length > 0 && (
                  <div className="absolute z-20 left-0 right-0 top-full mt-1 bg-white border border-border-slate rounded-xl shadow-lg overflow-hidden">
                    {filteredRecipients.slice(0, 6).map(r => (
                      <button type="button" key={r.id}
                        onMouseDown={e => { e.preventDefault(); addRecipient(r); setRecipientOpen(false); }}
                        className="w-full flex items-center gap-2.5 px-3 py-2.5 text-left hover:bg-surface-container-low transition-colors border-b border-border-slate last:border-0"
                      >
                        <span className={`w-7 h-7 rounded-full ${avatarColor(r.id)} text-white text-[12px] font-bold flex items-center justify-center shrink-0`}>
                          {r.avatar}
                        </span>
                        <div>
                          <p className="text-[13px] font-semibold text-on-surface">{r.name}</p>
                          <p className="text-[11px] text-on-surface-variant">{r.role}</p>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
                {recipientOpen && <div className="fixed inset-0 z-10" onClick={() => setRecipientOpen(false)} />}
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
                  {selectedDrawings.length > 0  && <p>📐 <span className="font-medium">{selectedDrawings.length}</span> drawing{selectedDrawings.length !== 1 ? "s" : ""} selected</p>}
                  {selectedRecipients.length > 0 && <p>👥 <span className="font-medium">{selectedRecipients.length}</span> recipient{selectedRecipients.length !== 1 ? "s" : ""}</p>}
                  {purpose && <p>📋 Purpose: <span className="font-medium">{purpose}</span></p>}
                </div>
              )}
            </div>
          </div>

          {/* Footer */}
          <div className="px-6 py-4 border-t border-border-slate bg-surface-container-low flex items-center justify-between gap-3 shrink-0">
            <p className="text-[12px] text-on-surface-variant hidden sm:block">A PDF cover sheet will be auto-generated.</p>
            <div className="flex items-center gap-2 ml-auto">
              <button type="button" onClick={onClose}
                className="bg-white border border-border-slate text-on-surface-variant hover:bg-surface-container px-4 py-2 rounded-lg text-[14px] font-medium transition-colors">
                Cancel
              </button>
              <button type="submit" disabled={submitting}
                className="bg-primary text-white rounded-lg hover:bg-primary-container px-5 py-2 font-medium text-[14px] flex items-center gap-2 disabled:opacity-60 transition-colors">
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
