import { useState, useRef } from "react";
import { X, Upload, CheckCircle2, Loader2, FolderOpen } from "lucide-react";
import Field from "./Field";
import { STATUSES, ORIGINATORS, STATUS_META } from "../constants";

export default function UploadModal({ onClose, onSubmit, initialFolder }) {
  const [form, setForm] = useState({
    drawingNumber: "",
    title: "",
    discipline: "",
    revision: "",
    originator: "",
    status: "S1",
    notes: "",
    folderPath: initialFolder || "",
  });
  const [file, setFile]             = useState(null);
  const [dragging, setDragging]     = useState(false);
  const [errors, setErrors]         = useState({});
  const [submitting, setSubmitting] = useState(false);
  const fileInputRef                = useRef(null);

  const set = (k, v) => {
    setForm(f => ({ ...f, [k]: v }));
    setErrors(e => ({ ...e, [k]: "" }));
  };

  const pickFile = (f) => {
    if (!f) return;
    setFile(f);
    setErrors(e => ({ ...e, file: "" }));
  };

  const handleDrop = (ev) => {
    ev.preventDefault();
    setDragging(false);
    pickFile(ev.dataTransfer.files[0]);
  };

  const validate = () => {
    const e = {};
    if (!file)                      e.file         = "A file is required";
    if (!form.drawingNumber.trim()) e.drawingNumber = "Required";
    if (!form.title.trim())         e.title         = "Required";
    if (!form.discipline)           e.discipline    = "Required";
    if (!form.revision.trim())      e.revision      = "Required";
    if (!form.originator)           e.originator    = "Required";
    return e;
  };

  const handleSubmit = async (ev) => {
    ev.preventDefault();
    const e = validate();
    if (Object.keys(e).length) { setErrors(e); return; }
    setSubmitting(true);
    try {
      await onSubmit(form, file);
    } finally {
      setSubmitting(false);
    }
  };

  const inputCls = (key) =>
    `w-full border rounded-lg px-3 py-2.5 text-sm text-slate-700 outline-none transition focus:ring-2 focus:ring-blue-500 focus:border-transparent placeholder:text-slate-300 ${
      errors[key] ? "border-red-400 bg-red-50" : "border-slate-200 bg-white"
    }`;

  const dropZoneCls = [
    "border-2 border-dashed rounded-xl p-5 text-center transition cursor-pointer group select-none",
    dragging   ? "border-blue-500 bg-blue-50 scale-[1.01]"
    : errors.file ? "border-red-400 bg-red-50"
    : file        ? "border-emerald-400 bg-emerald-50"
                  : "border-slate-200 bg-slate-50 hover:border-blue-400 hover:bg-blue-50",
  ].join(" ");

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(15,23,42,0.4)" }}>
      <div className="modal-enter bg-surface rounded-2xl shadow-card-lg border border-outline-variant w-full max-w-2xl overflow-hidden">

        {/* Header */}
        <div className="px-6 py-4 border-b border-outline-variant flex items-center justify-between bg-surface-container-low">
          <div>
            <div className="flex items-center gap-3">
              <h2 className="text-base font-semibold text-on-surface">Upload Drawing</h2>
              {initialFolder && (
                <span className="px-2.5 py-1 rounded-md bg-white border border-border-slate text-[11px] font-medium text-on-surface-variant flex items-center gap-1.5 shadow-sm">
                  <FolderOpen size={12} className="text-primary" />
                  {initialFolder.replace(/\//g, ' / ')}
                </span>
              )}
            </div>
            <p className="text-xs text-on-surface-variant mt-0.5">Register a new drawing to the Master Drawing Register</p>
          </div>
          <button onClick={onClose} className="text-on-surface-variant hover:text-on-surface transition p-1.5 rounded-lg hover:bg-surface-container">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">

          {/* Drop zone */}
          <div>
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.dwg,.dxf"
              className="hidden"
              onChange={ev => pickFile(ev.target.files[0])}
            />
            <div
              className={dropZoneCls}
              onClick={() => fileInputRef.current.click()}
              onDragOver={ev => { ev.preventDefault(); setDragging(true); }}
              onDragLeave={() => setDragging(false)}
              onDrop={handleDrop}
            >
              {file ? (
                <div className="flex items-center justify-center gap-2.5">
                  <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0" />
                  <span className="text-sm font-medium text-emerald-700 truncate max-w-xs">{file.name}</span>
                  <span className="text-xs text-emerald-500 shrink-0">({(file.size / 1024 / 1024).toFixed(1)} MB)</span>
                  <button
                    type="button"
                    onClick={ev => { ev.stopPropagation(); setFile(null); }}
                    className="ml-1 text-emerald-400 hover:text-red-500 transition text-xl leading-none font-light"
                  >×</button>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-2">
                  <Upload className={`w-8 h-8 transition ${dragging ? "text-blue-500" : "text-slate-300 group-hover:text-blue-400"}`} />
                  <p className={`text-sm font-medium transition ${dragging ? "text-blue-600" : "text-slate-500 group-hover:text-blue-600"}`}>
                    {dragging ? "Drop file here" : "Drag & drop PDF / DWG / DXF here"}
                  </p>
                  <p className="text-xs text-slate-400">or <span className="text-blue-500 underline">browse files</span> — max 100 MB</p>
                </div>
              )}
            </div>
            {errors.file && <p className="text-xs text-red-500 mt-1.5">{errors.file}</p>}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Field errors={errors} label="Drawing Number" id="drawingNumber" req>
              <input
                id="drawingNumber"
                placeholder="e.g. ARC-GF-004"
                className={inputCls("drawingNumber")}
                value={form.drawingNumber}
                onChange={e => set("drawingNumber", e.target.value)}
              />
            </Field>
            <Field errors={errors} label="Revision" id="revision" req>
              <input
                id="revision"
                placeholder="e.g. A"
                maxLength={4}
                className={inputCls("revision")}
                value={form.revision}
                onChange={e => set("revision", e.target.value.toUpperCase())}
              />
            </Field>
          </div>

          <Field errors={errors} label="Drawing Title" id="title" req>
            <input
              id="title"
              placeholder="e.g. Ground Floor Plan — Level 01"
              className={inputCls("title")}
              value={form.title}
              onChange={e => set("title", e.target.value)}
            />
          </Field>

          <div className="grid grid-cols-2 gap-4">
            <Field errors={errors} label="Drawing Type" id="discipline" req>
              <select id="discipline" className={inputCls("discipline")} value={form.discipline} onChange={e => set("discipline", e.target.value)}>
                <option value="">Select drawing type</option>
                <option>Architecture</option>
                <option>Structure</option>
                <optgroup label="MEP">
                  <option>Electrical</option>
                  <option>Plumbing</option>
                  <option>Fire</option>
                </optgroup>
                <option>Civil</option>
                <option>Interior</option>
              </select>
            </Field>
            <Field errors={errors} label="Originator" id="originator" req>
              <select id="originator" className={inputCls("originator")} value={form.originator} onChange={e => set("originator", e.target.value)}>
                <option value="">Select originator</option>
                {ORIGINATORS.map(o => <option key={o}>{o}</option>)}
              </select>
            </Field>
          </div>

          <Field errors={errors} label="Issue Status" id="status">
            <div className="grid grid-cols-4 gap-2">
              {STATUSES.map(s => {
                const m = STATUS_META[s];
                const active = form.status === s;
                return (
                  <button
                    type="button"
                    key={s}
                    onClick={() => set("status", s)}
                    className={`border rounded-lg py-2 px-2 text-xs font-semibold transition ${
                      active ? `${m.bg} ${m.text} border-current` : "border-slate-200 text-slate-500 hover:border-slate-300"
                    }`}
                  >
                    {s}
                  </button>
                );
              })}
            </div>
          </Field>

          <Field errors={errors} label="Notes / Comments" id="notes">
            <textarea
              id="notes"
              rows={2}
              placeholder="Optional transmittal notes…"
              className={`${inputCls("notes")} resize-none`}
              value={form.notes}
              onChange={e => set("notes", e.target.value)}
            />
          </Field>

          <div className="flex items-center justify-end gap-3 pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-900 border border-slate-200 hover:border-slate-300 rounded-lg transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-5 py-2 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition flex items-center gap-2 disabled:opacity-60"
            >
              {submitting ? (
                <><Loader2 className="w-4 h-4 animate-spin" />Uploading…</>
              ) : (
                <><Upload className="w-4 h-4" />Register Drawing</>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
