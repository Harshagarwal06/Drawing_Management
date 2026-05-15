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

  const toggleDrawing = (id) =>
    setSelectedDrawings(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);

  const addRecipient = (r) => {
    setSelectedRecipients(prev => [...prev, r]);
    setRecipientSearch("");
    setErrors(e => ({ ...e, recipients: "" }));
  };

  const removeRecipient = (id) =>
    setSelectedRecipients(prev => prev.filter(r => r.id !== id));

  const validate = () => {
    const e = {};
    if (selectedDrawings.length === 0)   e.drawings   = "Select at least one drawing";
    if (selectedRecipients.length === 0) e.recipients = "Add at least one recipient";
    if (!purpose)                        e.purpose    = "Required";
    return e;
  };

  const handleSubmit = (ev) => {
    ev.preventDefault();
    const e = validate();
    if (Object.keys(e).length) { setErrors(e); return; }
    setSubmitting(true);
    setTimeout(() => {
      onSubmit({ drawingIds: selectedDrawings, recipients: selectedRecipients, purpose, remarks });
      setSubmitting(false);
    }, 950);
  };

  const errMsg = (key) => errors[key] && (
    <p className="text-xs text-red-500 mt-1.5">{errors[key]}</p>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(15,23,42,0.6)" }}>
      <div
        className="modal-enter bg-white rounded-2xl shadow-2xl w-full max-w-3xl overflow-hidden flex flex-col"
        style={{ maxHeight: "92vh" }}
      >
        {/* Header */}
        <div
          className="px-6 py-5 flex items-center justify-between shrink-0"
          style={{ background: "linear-gradient(135deg,#1e1b4b 0%,#312e81 60%,#4338ca 100%)" }}
        >
          <div>
            <div className="flex items-center gap-2 mb-0.5">
              <span className="text-xs font-mono font-bold text-indigo-300 bg-indigo-900/50 px-2 py-0.5 rounded">
                {trnNumber}
              </span>
            </div>
            <h2 className="text-base font-semibold text-white">Create Transmittal</h2>
            <p className="text-xs text-indigo-300 mt-0.5">Issue drawings to project recipients with a formal cover sheet</p>
          </div>
          <button onClick={onClose} className="text-indigo-300 hover:text-white transition p-1 rounded-lg hover:bg-white/10">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="overflow-y-auto flex-1">
          <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">

            {/* LEFT — Drawing selection */}
            <div className="flex flex-col gap-3">
              <div>
                <FieldLabel req>Drawings to Issue</FieldLabel>
                <div className={`border rounded-xl overflow-hidden ${errors.drawings ? "border-red-400" : "border-slate-200"}`}>
                  <div className="flex items-center gap-2 px-3 py-2 border-b border-slate-100 bg-slate-50">
                    <Search className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <input
                      placeholder="Filter drawings…"
                      value={drawingSearch}
                      onChange={e => setDrawingSearch(e.target.value)}
                      className="text-xs flex-1 outline-none bg-transparent text-slate-600 placeholder:text-slate-300"
                    />
                    {selectedDrawings.length > 0 && (
                      <span className="text-xs font-semibold text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded-full shrink-0">
                        {selectedDrawings.length} selected
                      </span>
                    )}
                  </div>

                  <div className="overflow-y-auto" style={{ maxHeight: "260px" }}>
                    {filteredDrawings.length === 0 ? (
                      <p className="text-xs text-slate-400 text-center py-6">No drawings match.</p>
                    ) : filteredDrawings.map(d => {
                      const checked = selectedDrawings.includes(d.id);
                      const sm = STATUS_META[d.status] ?? STATUS_META.S1;
                      return (
                        <label
                          key={d.id}
                          className={`flex items-start gap-3 px-3 py-2.5 cursor-pointer border-b border-slate-50 last:border-0 transition ${
                            checked ? "bg-indigo-50/60" : "hover:bg-slate-50"
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => { toggleDrawing(d.id); setErrors(e => ({ ...e, drawings: "" })); }}
                            className="mt-0.5 accent-indigo-600 shrink-0"
                          />
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="font-mono text-xs font-semibold text-indigo-700">{d.number}</span>
                              <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${sm.bg} ${sm.text}`}>{d.status}</span>
                            </div>
                            <p className="text-xs text-slate-500 truncate mt-0.5">{d.title}</p>
                          </div>
                          <span className="text-xs text-slate-300 font-medium shrink-0 mt-0.5">Rev.{d.rev}</span>
                        </label>
                      );
                    })}
                  </div>

                  <div className="flex items-center gap-3 px-3 py-2 border-t border-slate-100 bg-slate-50">
                    <button
                      type="button"
                      onClick={() => { setSelectedDrawings(drawings.map(d => d.id)); setErrors(e => ({ ...e, drawings: "" })); }}
                      className="text-xs text-indigo-600 hover:underline font-medium"
                    >Select all</button>
                    <span className="text-slate-300">·</span>
                    <button
                      type="button"
                      onClick={() => setSelectedDrawings([])}
                      className="text-xs text-slate-500 hover:underline"
                    >Clear</button>
                  </div>
                </div>
                {errMsg("drawings")}
              </div>
            </div>

            {/* RIGHT — Recipients + Purpose + Remarks */}
            <div className="flex flex-col gap-5">

              {/* Recipients */}
              <div className="relative">
                <FieldLabel req>Recipients</FieldLabel>
                <div
                  className={`min-h-[42px] border rounded-xl px-3 py-2 flex flex-wrap gap-1.5 cursor-text transition ${
                    errors.recipients ? "border-red-400 bg-red-50" : "border-slate-200 bg-white"
                  }`}
                  onClick={() => setRecipientOpen(true)}
                >
                  {selectedRecipients.map(r => (
                    <span key={r.id} className="inline-flex items-center gap-1 bg-indigo-100 text-indigo-700 text-xs font-medium px-2 py-1 rounded-full">
                      <span className={`w-4 h-4 rounded-full ${avatarColor(r.id)} text-white flex items-center justify-center text-[8px] font-bold shrink-0`}>
                        {r.avatar[0]}
                      </span>
                      {r.name}
                      <button
                        type="button"
                        onClick={e => { e.stopPropagation(); removeRecipient(r.id); }}
                        className="ml-0.5 text-indigo-400 hover:text-indigo-700"
                      >×</button>
                    </span>
                  ))}
                  <input
                    placeholder={selectedRecipients.length === 0 ? "Search people or groups…" : ""}
                    value={recipientSearch}
                    onChange={e => { setRecipientSearch(e.target.value); setRecipientOpen(true); }}
                    onFocus={() => setRecipientOpen(true)}
                    className="text-xs flex-1 min-w-[120px] outline-none bg-transparent text-slate-600 placeholder:text-slate-300 py-0.5"
                  />
                </div>

                {recipientOpen && filteredRecipients.length > 0 && (
                  <div className="absolute z-20 left-0 right-0 top-full mt-1 bg-white border border-slate-200 rounded-xl shadow-lg overflow-hidden">
                    {filteredRecipients.slice(0, 6).map(r => (
                      <button
                        type="button"
                        key={r.id}
                        onMouseDown={e => { e.preventDefault(); addRecipient(r); setRecipientOpen(false); }}
                        className="w-full flex items-center gap-2.5 px-3 py-2.5 text-left hover:bg-indigo-50 transition border-b border-slate-50 last:border-0"
                      >
                        <span className={`w-7 h-7 rounded-full ${avatarColor(r.id)} text-white text-xs font-bold flex items-center justify-center shrink-0`}>
                          {r.avatar}
                        </span>
                        <div>
                          <p className="text-xs font-semibold text-slate-700">{r.name}</p>
                          <p className="text-xs text-slate-400">{r.role}</p>
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
                  className={`w-full border rounded-xl px-3 py-2.5 text-sm text-slate-700 outline-none transition focus:ring-2 focus:ring-indigo-500 focus:border-transparent ${
                    errors.purpose ? "border-red-400 bg-red-50" : "border-slate-200 bg-white"
                  }`}
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
                  placeholder="Add any cover notes, instructions, or deadlines for the recipient…"
                  className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm text-slate-700 outline-none resize-none transition focus:ring-2 focus:ring-indigo-500 focus:border-transparent placeholder:text-slate-300 bg-white"
                />
              </div>

              {/* Live summary */}
              {(selectedDrawings.length > 0 || selectedRecipients.length > 0 || purpose) && (
                <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-3 text-xs text-indigo-700 space-y-1">
                  <p className="font-semibold text-indigo-800 mb-1.5">Transmittal Summary</p>
                  {selectedDrawings.length > 0  && <p>📐 <span className="font-medium">{selectedDrawings.length}</span> drawing{selectedDrawings.length !== 1 ? "s" : ""} selected</p>}
                  {selectedRecipients.length > 0 && <p>👥 <span className="font-medium">{selectedRecipients.length}</span> recipient{selectedRecipients.length !== 1 ? "s" : ""}</p>}
                  {purpose && <p>📋 Purpose: <span className="font-medium">{purpose}</span></p>}
                </div>
              )}
            </div>
          </div>

          {/* Footer */}
          <div className="px-6 py-4 border-t border-slate-100 bg-slate-50/60 flex items-center justify-between gap-3 shrink-0">
            <p className="text-xs text-slate-400 hidden sm:block">A PDF cover sheet will be auto-generated and attached.</p>
            <div className="flex items-center gap-2 ml-auto">
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
                className="px-5 py-2 text-sm font-semibold text-white rounded-lg transition flex items-center gap-2 disabled:opacity-60"
                style={{ background: submitting ? "#6366f1" : "linear-gradient(135deg,#4f46e5,#7c3aed)" }}
              >
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
