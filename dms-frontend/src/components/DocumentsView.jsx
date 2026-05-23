import { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import {
  Folder, FolderOpen, ChevronRight, ChevronDown, Home, LayoutGrid, List,
  MoreVertical, FolderPlus, Pencil, Trash2, Eye, Download,
  Check, X, Upload, Search, Layers, FileText, Send, Clock,
  FileEdit, FolderInput, RefreshCcw, Loader2, History,
} from "lucide-react";

import { DISCIPLINES } from "../constants";

const API         = import.meta.env.VITE_API_URL;
/* Supports both legacy local paths (/uploads/…) and full R2 URLs */
const resolveUrl  = p => p?.startsWith('http') ? p : `${API}${p}`;
const PALETTE     = ["#3525cd", "#2563eb", "#059669", "#d97706", "#9333ea"];
const projectDot  = idx => PALETTE[idx % PALETTE.length];

/* ─────────────────────────── Tree helpers ──────────────────────────── */
const DEFAULT_TREE = () => ({
  name: "Project",
  children: [
    { name: "Architecture", children: [
        { name: "Building", children: [] },
        { name: "Infra",    children: [] },
        { name: "Views",    children: [] },
      ],
    },
    { name: "Structural", children: [
        { name: "Infra",    children: [] },
        { name: "Building", children: [] },
      ],
    },
    { name: "MEP", children: [
        { name: "Electrical", children: [] },
        { name: "Plumbing",   children: [] },
        { name: "Fire",       children: [] },
        { name: "HVAC",       children: [] },
      ],
    },
    { name: "Landscape", children: [] },
    { name: "Sanction",  children: [] },
    { name: "Interior",  children: [] },
  ],
});

async function fetchTree(projectId, token) {
  const res = await fetch(`${API}/api/projects/${projectId}/folders`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (res.status === 404) return null; // no tree saved yet
  if (!res.ok) throw new Error('Failed to fetch folder tree');
  const data = await res.json();
  return data.tree;
}

async function persistTree(projectId, token, tree) {
  await fetch(`${API}/api/projects/${projectId}/folders`, {
    method:  'PUT',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body:    JSON.stringify({ tree }),
  });
}
function getNode(tree, segments) {
  let node = tree;
  for (const seg of segments) {
    const child = node.children?.find(c => c.name === seg);
    if (!child) return null;
    node = child;
  }
  return node;
}
function countDescendants(node) {
  let n = 0;
  for (const c of node.children ?? []) n += 1 + countDescendants(c);
  return n;
}

/* ─────────────────────────── Style maps ────────────────────────────── */
const STATUS_PILL  = {
  S3:   "bg-status-emerald-bg text-status-emerald-text",
  S2:   "bg-status-amber-bg   text-status-amber-text",
  S1:   "bg-blue-50           text-blue-700",
  VOID: "bg-status-rose-bg    text-status-rose-text",
};
const STATUS_LABEL = {
  S3: "For Construction", S2: "For Approval", S1: "For Information", VOID: "Void",
};
const STATUS_BAR = {
  S3:   "bg-status-emerald-text",
  S2:   "bg-status-amber-text",
  VOID: "bg-status-rose-text",
  S1:   "bg-blue-400",
};
const EXT_STYLE = {
  PDF: "bg-red-50    text-red-600",
  DWG: "bg-blue-50   text-blue-700",
  DXF: "bg-indigo-50 text-indigo-600",
  IFC: "bg-purple-50 text-purple-600",
  RVT: "bg-orange-50 text-orange-600",
};

/* ────────────────────────── nextRev helper ─────────────────────────── */
function nextRev(rev) {
  if (!rev) return "A";
  const c = rev.trim().toUpperCase();
  if (/^[A-Z]$/.test(c)) return String.fromCharCode(c.charCodeAt(0) + 1);
  return c;
}

/* ─────────────────────── SwitchProjectDropdown ─────────────────────── */
function SwitchProjectDropdown({ projects, activeProject, onProjectChange }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const close = e => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  return (
    <div className="relative shrink-0" ref={ref}>
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-border-slate bg-white hover:bg-surface-container text-[12px] font-medium text-on-surface transition-colors shadow-sm"
      >
        <span className="material-symbols-outlined text-[15px] text-primary">sync_alt</span>
        Switch Project
        <ChevronDown
          size={12}
          className={`text-on-surface-variant transition-transform duration-200 ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-72 bg-surface border border-outline-variant rounded-xl shadow-card-lg z-50 overflow-hidden">
          <div className="px-4 pt-3 pb-2 border-b border-border-slate">
            <p className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest">
              Switch Project
            </p>
          </div>
          <div className="py-1 max-h-60 overflow-y-auto custom-scrollbar">
            {projects.map((p, idx) => {
              const isActive = p.id === activeProject?.id;
              return (
                <button
                  key={p.id}
                  onClick={() => { onProjectChange(p); setOpen(false); }}
                  className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors ${
                    isActive ? "bg-primary/10" : "hover:bg-surface-container-low"
                  }`}
                >
                  <span
                    className="w-2.5 h-2.5 rounded-full shrink-0"
                    style={{ backgroundColor: projectDot(idx) }}
                  />
                  <div className="flex-1 min-w-0">
                    <p className={`font-mono text-[12px] font-bold leading-tight ${isActive ? "text-primary" : "text-on-surface"}`}>
                      {p.code}
                    </p>
                    <p className="text-[11px] text-on-surface-variant truncate mt-0.5">
                      {p.name?.split("—")[1]?.trim() ?? p.name}
                    </p>
                  </div>
                  {isActive && (
                    <span className="material-symbols-outlined text-[16px] text-primary shrink-0">check_circle</span>
                  )}
                </button>
              );
            })}
            {projects.length === 0 && (
              <p className="px-4 py-4 text-[12px] text-on-surface-variant">No projects available.</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/* ──────────────────────────── StatChip ─────────────────────────────── */
function StatChip({ label, value, Icon, colorCls }) {
  return (
    <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-surface-container-low border border-border-slate w-[118px] shrink-0">
      <div className={`w-6 h-6 rounded-md flex items-center justify-center shrink-0 ${colorCls}`}>
        <Icon size={13} />
      </div>
      <div className="min-w-0">
        <p className="text-[10px] text-on-surface-variant leading-none truncate">{label}</p>
        <p className="text-[14px] font-bold text-on-surface leading-tight mt-0.5">{value}</p>
      </div>
    </div>
  );
}

/* ─────────────────────── ProjectWorkspaceBar ───────────────────────── */
function ProjectWorkspaceBar({
  activeProject, projects, onProjectChange,
  totalFolders, totalDrawings, totalTransmittals, pendingApprovals,
  isProjectTeam,
}) {
  const shortName = activeProject?.name?.split("—")[1]?.trim() ?? activeProject?.name ?? "No project selected";
  const activeIdx = Math.max(0, projects.findIndex(p => p.id === activeProject?.id));

  return (
    <div className="bg-white border border-border-slate rounded-xl px-5 py-3.5 shadow-sm">
      <div className="flex items-center gap-4 flex-wrap xl:flex-nowrap">

        {/* Project identity */}
        <div className="flex items-center gap-2.5 flex-1 min-w-0">
          <span
            className="w-2.5 h-2.5 rounded-full shrink-0"
            style={{ backgroundColor: projectDot(activeIdx) }}
          />
          <span className="font-mono font-bold text-primary text-[15px] leading-none shrink-0">
            {activeProject?.code ?? "—"}
          </span>
          <span className="text-[15px] font-semibold text-on-surface leading-none truncate">
            {shortName}
          </span>
          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-status-emerald-bg text-status-emerald-text border border-status-emerald-text/25 shrink-0">
            Active
          </span>
        </div>

        {/* Stats */}
        <div className="flex items-center gap-2 flex-nowrap overflow-x-auto">
          <StatChip label="Folders"      value={totalFolders}      Icon={Layers}    colorCls="bg-primary/10 text-primary" />
          <StatChip label="Drawings"     value={totalDrawings}     Icon={FileText}  colorCls="bg-blue-50 text-blue-600" />
          <StatChip label="Transmittals" value={totalTransmittals} Icon={Send}      colorCls="bg-status-emerald-bg text-status-emerald-text" />
          <StatChip label="Pending"      value={pendingApprovals}  Icon={Clock}     colorCls={pendingApprovals > 0 ? "bg-status-amber-bg text-status-amber-text" : "bg-surface-container text-on-surface-variant"} />
        </div>

        {/* Switch project — only shown when user has access to more than 1 project */}
        {projects.length > 1 && (
          <SwitchProjectDropdown
            projects={projects}
            activeProject={activeProject}
            onProjectChange={onProjectChange}
          />
        )}
      </div>
    </div>
  );
}

/* ─────────────────────────── FolderMenu ────────────────────────────── */
function FolderMenu({ onAdd, onRename, onMove, onDelete }) {
  const [open, setOpen] = useState(false);
  const [pos,  setPos]  = useState({ top: 0, left: 0 });
  const btnRef  = useRef(null);
  const menuRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    const close = e => {
      if (
        menuRef.current && !menuRef.current.contains(e.target) &&
        btnRef.current  && !btnRef.current.contains(e.target)
      ) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);

  const toggle = e => {
    e.stopPropagation();
    if (!open && btnRef.current) {
      const r = btnRef.current.getBoundingClientRect();
      setPos({ top: r.bottom + 4, left: r.right - 176 });
    }
    setOpen(o => !o);
  };

  return (
    <>
      <button
        ref={btnRef}
        onClick={toggle}
        className="p-1.5 rounded-lg hover:bg-black/8 transition-colors opacity-0 group-hover:opacity-100 shrink-0"
      >
        <MoreVertical size={14} className="text-on-surface-variant" />
      </button>

      {open && createPortal(
        <div
          ref={menuRef}
          style={{ position: "fixed", top: pos.top, left: pos.left, zIndex: 9999 }}
          className="w-44 bg-white border border-border-slate rounded-xl shadow-lg py-1 overflow-hidden"
          onClick={e => e.stopPropagation()}
        >
          {onAdd && (
            <button onClick={() => { onAdd(); setOpen(false); }}
              className="w-full flex items-center gap-2 px-3 py-2 text-[12px] font-medium text-on-surface-variant hover:bg-surface-container-low transition-colors">
              <FolderPlus size={13} /> Add subfolder
            </button>
          )}
          {onRename && (
            <button onClick={() => { onRename(); setOpen(false); }}
              className="w-full flex items-center gap-2 px-3 py-2 text-[12px] font-medium text-on-surface-variant hover:bg-surface-container-low transition-colors">
              <Pencil size={13} /> Rename
            </button>
          )}
          {onMove && (
            <button onClick={() => { onMove(); setOpen(false); }}
              className="w-full flex items-center gap-2 px-3 py-2 text-[12px] font-medium text-on-surface-variant hover:bg-surface-container-low transition-colors">
              <FolderInput size={13} /> Move to Folder
            </button>
          )}
          {onDelete && (
            <>
              <div className="h-px bg-border-slate mx-2 my-1" />
              <button onClick={() => { onDelete(); setOpen(false); }}
                className="w-full flex items-center gap-2 px-3 py-2 text-[12px] font-medium text-status-rose-text hover:bg-status-rose-bg transition-colors">
                <Trash2 size={13} /> Delete
              </button>
            </>
          )}
        </div>,
        document.body
      )}
    </>
  );
}

/* ──────────────────────── EditMetadataModal ────────────────────────── */
function EditMetadataModal({ drawing, token, onSuccess, onClose }) {
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

/* ────────────────────────── RenameModal ────────────────────────────── */
function RenameModal({ drawing, token, onSuccess, onClose }) {
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

/* ─────────────────────────── FolderPicker ──────────────────────────── */
function FolderPicker({ node, path, selected, onSelect, depth = 0, disabledPrefix = "" }) {
  const [expanded, setExpanded] = useState(depth < 2);
  const hasChildren = node.children && node.children.length > 0;
  const isDisabled  = disabledPrefix && (path === disabledPrefix || path.startsWith(disabledPrefix + "/"));

  return (
    <div>
      <button
        onClick={() => !isDisabled && onSelect(path)}
        disabled={isDisabled}
        className={`w-full flex items-center gap-2 py-1.5 rounded-lg transition-colors text-left text-[13px] ${
          isDisabled
            ? "opacity-35 cursor-not-allowed text-on-surface-variant"
            : selected === path
              ? "bg-primary/10 text-primary font-semibold"
              : "text-on-surface hover:bg-surface-container-low"
        }`}
        style={{ paddingLeft: 12 + depth * 16, paddingRight: 12 }}
      >
        {hasChildren ? (
          <span
            onClick={e => { e.stopPropagation(); setExpanded(x => !x); }}
            className="p-0.5 rounded hover:bg-black/8 shrink-0"
          >
            {expanded
              ? <ChevronDown size={13} className="text-on-surface-variant" />
              : <ChevronRight size={13} className="text-on-surface-variant" />}
          </span>
        ) : (
          <span className="w-[21px] shrink-0" />
        )}
        <Folder size={14} className={selected === path ? "text-primary shrink-0" : "text-on-surface-variant shrink-0"} />
        <span className="truncate">{node.name}</span>
      </button>
      {expanded && hasChildren && (
        <div>
          {node.children.map((child, i) => (
            <FolderPicker
              key={i}
              node={child}
              path={`${path}/${child.name}`}
              selected={selected}
              onSelect={onSelect}
              depth={depth + 1}
              disabledPrefix={disabledPrefix}
            />
          ))}
        </div>
      )}
    </div>
  );
}

/* ────────────────────────── MoveFolderModal ────────────────────────── */
function MoveFolderModal({ drawing, token, tree, onSuccess, onClose }) {
  const [selectedPath, setSelectedPath] = useState(drawing.folderPath ?? "");
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState("");

  const handleMove = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`${API}/api/drawings/${drawing.id}`, {
        method:  "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body:    JSON.stringify({ folderPath: selectedPath }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || "Move failed."); setLoading(false); return; }
      await onSuccess(`"${drawing.number}" moved successfully.`);
      onClose();
    } catch {
      setError("Network error — please try again.");
      setLoading(false);
    }
  };

  const confirmDisabled = !selectedPath || selectedPath === drawing.folderPath;

  return createPortal(
    <div
      className="fixed inset-0 z-[9990] flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.45)" }}
    >
      <div className="bg-white rounded-2xl shadow-xl border border-border-slate w-full max-w-sm overflow-hidden flex flex-col max-h-[80vh]">
        <div className="h-1 bg-primary shrink-0" />
        <div className="px-6 py-4 border-b border-border-slate shrink-0">
          <h2 className="text-[15px] font-semibold text-on-surface">Move to Folder</h2>
          <p className="text-[11px] text-on-surface-variant font-mono mt-0.5">{drawing.number}</p>
        </div>
        <div className="flex-1 overflow-y-auto px-3 py-3 custom-scrollbar">
          {error && (
            <div className="mb-2 px-4 py-2.5 rounded-lg bg-status-rose-bg text-status-rose-text text-[12px] font-medium border border-status-rose-text/20">
              {error}
            </div>
          )}
          <FolderPicker
            node={tree}
            path={tree.name}
            selected={selectedPath}
            onSelect={setSelectedPath}
            depth={0}
          />
        </div>
        {selectedPath && (
          <div className="px-6 py-2 bg-surface-container-low border-t border-border-slate shrink-0">
            <p className="text-[11px] text-on-surface-variant font-mono truncate">→ {selectedPath}</p>
          </div>
        )}
        <div className="px-6 py-4 border-t border-border-slate flex justify-end gap-2 shrink-0">
          <button
            onClick={onClose}
            disabled={loading}
            className="px-4 py-2 rounded-lg border border-border-slate bg-white text-on-surface-variant hover:bg-surface-container text-[13px] font-medium transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleMove}
            disabled={loading || confirmDisabled}
            className="px-4 py-2 rounded-lg bg-primary text-white hover:bg-primary-container text-[13px] font-medium transition-colors disabled:opacity-60 flex items-center gap-1.5"
          >
            {loading ? <><Loader2 size={13} className="animate-spin" />Moving…</> : "Move Here"}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

/* ──────────────────────── MoveFolderNodeModal ──────────────────────── */
function MoveFolderNodeModal({ folderName, folderPath, tree, onConfirm, onClose }) {
  // The folder's current parent path (where it already lives)
  const parentPath    = folderPath.split("/").slice(0, -1).join("/");
  const [selectedPath, setSelectedPath] = useState("");
  const [loading,      setLoading]      = useState(false);
  const [error,        setError]        = useState("");

  const confirmDisabled = !selectedPath || selectedPath === parentPath;

  const handleMove = async () => {
    setLoading(true);
    setError("");
    try {
      await onConfirm(selectedPath);
      onClose();
    } catch {
      setError("Move failed — please try again.");
      setLoading(false);
    }
  };

  return createPortal(
    <div
      className="fixed inset-0 z-[9990] flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.45)" }}
    >
      <div className="bg-white rounded-2xl shadow-xl border border-border-slate w-full max-w-sm overflow-hidden flex flex-col max-h-[80vh]">
        <div className="h-1 bg-primary shrink-0" />
        <div className="px-6 py-4 border-b border-border-slate shrink-0">
          <h2 className="text-[15px] font-semibold text-on-surface">Move Folder</h2>
          <p className="text-[11px] text-on-surface-variant font-mono mt-0.5 truncate">{folderName}</p>
        </div>
        <div className="flex-1 overflow-y-auto px-3 py-3 custom-scrollbar">
          {error && (
            <div className="mb-2 px-4 py-2.5 rounded-lg bg-status-rose-bg text-status-rose-text text-[12px] font-medium border border-status-rose-text/20">
              {error}
            </div>
          )}
          <FolderPicker
            node={tree}
            path={tree.name}
            selected={selectedPath}
            onSelect={setSelectedPath}
            depth={0}
            disabledPrefix={folderPath}
          />
        </div>
        {selectedPath && (
          <div className="px-6 py-2 bg-surface-container-low border-t border-border-slate shrink-0">
            <p className="text-[11px] text-on-surface-variant font-mono truncate">→ {selectedPath}/{folderName}</p>
          </div>
        )}
        <div className="px-6 py-4 border-t border-border-slate flex justify-end gap-2 shrink-0">
          <button
            onClick={onClose}
            disabled={loading}
            className="px-4 py-2 rounded-lg border border-border-slate bg-white text-on-surface-variant hover:bg-surface-container text-[13px] font-medium transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleMove}
            disabled={loading || confirmDisabled}
            className="px-4 py-2 rounded-lg bg-primary text-white hover:bg-primary-container text-[13px] font-medium transition-colors disabled:opacity-60 flex items-center gap-1.5"
          >
            {loading ? <><Loader2 size={13} className="animate-spin" />Moving…</> : "Move Here"}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

/* ────────────────────────── NewRevisionModal ───────────────────────── */
function NewRevisionModal({ drawing, token, projectId, onSuccess, onClose }) {
  const [title,      setTitle]      = useState(drawing.title      ?? "");
  const [revision,   setRevision]   = useState(nextRev(drawing.rev));
  const [file,       setFile]       = useState(null);
  const [dragging,   setDragging]   = useState(false);
  const [loading,    setLoading]    = useState(false);
  const [error,      setError]      = useState("");
  const fileInputRef = useRef(null);

  const handleFile = f => { if (f) setFile(f); };

  const handleSubmit = async () => {
    if (!file) { setError("Please select a file."); return; }
    setLoading(true);
    setError("");
    try {
      const fd = new FormData();
      fd.append("drawingFile",   file);
      fd.append("drawingNumber", drawing.number);
      fd.append("title",         title);
      fd.append("discipline",    drawing.discipline ?? "");
      fd.append("revision",      revision);
      fd.append("originator",    drawing.originator ?? "");
      fd.append("status",        drawing.status ?? "S3");
      fd.append("notes",         "");
      fd.append("projectId",     projectId ?? "");
      fd.append("folderPath",    drawing.folderPath ?? "");
      const res = await fetch(`${API}/api/upload`, {
        method:  "POST",
        headers: { Authorization: `Bearer ${token}` },
        body:    fd,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { setError(data.error || `Server responded ${res.status}`); setLoading(false); return; }
      await onSuccess(`New revision ${revision} of "${drawing.number}" uploaded.`);
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
      <div className="bg-white rounded-2xl shadow-xl border border-border-slate w-full max-w-md overflow-hidden">
        <div className="h-1 bg-primary" />
        <div className="px-6 py-4 border-b border-border-slate">
          <h2 className="text-[15px] font-semibold text-on-surface">Upload New Revision</h2>
          <p className="text-[11px] text-on-surface-variant font-mono mt-0.5">{drawing.number} — locked</p>
        </div>
        <div className="px-6 py-5 space-y-4">
          {error && (
            <div className="px-4 py-2.5 rounded-lg bg-status-rose-bg text-status-rose-text text-[12px] font-medium border border-status-rose-text/20">
              {error}
            </div>
          )}

          {/* File drop zone */}
          <div
            onClick={() => fileInputRef.current?.click()}
            onDragOver={e => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={e => { e.preventDefault(); setDragging(false); handleFile(e.dataTransfer.files[0]); }}
            className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-colors ${
              file
                ? "border-status-emerald-text bg-status-emerald-bg"
                : dragging
                ? "border-primary bg-primary/5"
                : "border-border-slate hover:border-primary/50 hover:bg-surface-container-low"
            }`}
          >
            <input
              ref={fileInputRef}
              type="file"
              className="hidden"
              onChange={e => handleFile(e.target.files[0])}
            />
            <Upload size={20} className={`mx-auto mb-2 ${file ? "text-status-emerald-text" : "text-on-surface-variant"}`} />
            {file
              ? <p className="text-[13px] font-semibold text-status-emerald-text">{file.name}</p>
              : <>
                  <p className="text-[13px] font-medium text-on-surface">Drop file here or click to browse</p>
                  <p className="text-[11px] text-on-surface-variant mt-1">PDF, DWG, DXF, IFC, RVT</p>
                </>
            }
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-on-surface-variant uppercase tracking-wider mb-1.5">Revision</label>
            <input
              value={revision}
              onChange={e => setRevision(e.target.value)}
              className="w-full px-3 py-2 text-[13px] border border-border-slate rounded-lg text-on-surface font-mono focus:outline-none focus:ring-1 focus:ring-primary/30 focus:border-primary"
            />
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-on-surface-variant uppercase tracking-wider mb-1.5">Title</label>
            <input
              value={title}
              onChange={e => setTitle(e.target.value)}
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
            onClick={handleSubmit}
            disabled={loading || !file}
            className="px-4 py-2 rounded-lg bg-primary text-white hover:bg-primary-container text-[13px] font-medium transition-colors disabled:opacity-60 flex items-center gap-1.5"
          >
            {loading ? <><Loader2 size={13} className="animate-spin" />Uploading…</> : <><Upload size={13} />Upload Revision</>}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

/* ─────────────────────────── FileMenu ──────────────────────────────── */
/*  Portal dropdown for file card actions — escapes overflow:hidden     */
const FILE_MENU_W = 204;
const FILE_MENU_H = 260;

function FileMenu({ onEditMetadata, onRename, onMove, onSupersede, onViewHistory, onDelete }) {
  const [open, setOpen] = useState(false);
  const [pos,  setPos]  = useState({ top: 0, left: 0 });
  const btnRef  = useRef(null);
  const menuRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    const close = e => {
      if (
        menuRef.current && !menuRef.current.contains(e.target) &&
        btnRef.current  && !btnRef.current.contains(e.target)
      ) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);

  const toggle = e => {
    e.stopPropagation();
    if (!open && btnRef.current) {
      const r          = btnRef.current.getBoundingClientRect();
      const spaceBelow = window.innerHeight - r.bottom;
      const left       = Math.max(8, Math.min(window.innerWidth - FILE_MENU_W - 8, r.right - FILE_MENU_W));
      const top        = spaceBelow < FILE_MENU_H + 8 ? r.top - FILE_MENU_H - 4 : r.bottom + 4;
      setPos({ top, left });
    }
    setOpen(o => !o);
  };

  const close = () => setOpen(false);

  return (
    <>
      <button
        ref={btnRef}
        onClick={toggle}
        className="p-1 rounded-lg text-on-surface-variant hover:bg-surface-container hover:text-on-surface transition-colors shrink-0"
        title="More actions"
      >
        <MoreVertical size={14} />
      </button>

      {open && createPortal(
        <div
          ref={menuRef}
          style={{ position: "fixed", top: pos.top, left: pos.left, zIndex: 9999, width: FILE_MENU_W }}
          className="bg-white border border-border-slate rounded-xl shadow-xl py-1 overflow-hidden"
          onClick={e => e.stopPropagation()}
        >
          {/* ── Standard actions (only shown if write-access callbacks are provided) ── */}
          {onEditMetadata && (
            <button
              onClick={() => { onEditMetadata(); close(); }}
              className="w-full flex items-center gap-2.5 px-4 py-2.5 text-[13px] font-medium text-on-surface hover:bg-surface-container-low transition-colors text-left"
            >
              <FileEdit size={13} className="text-on-surface-variant shrink-0" />
              Edit Metadata
            </button>
          )}
          {onRename && (
            <button
              onClick={() => { onRename(); close(); }}
              className="w-full flex items-center gap-2.5 px-4 py-2.5 text-[13px] font-medium text-on-surface hover:bg-surface-container-low transition-colors text-left"
            >
              <Pencil size={13} className="text-on-surface-variant shrink-0" />
              Rename
            </button>
          )}
          {onMove && (
            <button
              onClick={() => { onMove(); close(); }}
              className="w-full flex items-center gap-2.5 px-4 py-2.5 text-[13px] font-medium text-on-surface hover:bg-surface-container-low transition-colors text-left"
            >
              <FolderInput size={13} className="text-on-surface-variant shrink-0" />
              Move to Folder
            </button>
          )}
          {onSupersede && (
            <button
              onClick={() => { onSupersede(); close(); }}
              className="w-full flex items-center gap-2.5 px-4 py-2.5 text-[13px] font-medium text-on-surface hover:bg-surface-container-low transition-colors text-left"
            >
              <RefreshCcw size={13} className="text-on-surface-variant shrink-0" />
              Upload New Revision
            </button>
          )}
          {onViewHistory && (
            <button
              onClick={() => { onViewHistory(); close(); }}
              className="w-full flex items-center gap-2.5 px-4 py-2.5 text-[13px] font-medium text-on-surface hover:bg-surface-container-low transition-colors text-left"
            >
              <History size={13} className="text-on-surface-variant shrink-0" />
              Revision History
            </button>
          )}

          {/* ── Destructive ── */}
          {onDelete && <>
          <div className="h-px bg-border-slate mx-2 my-1" />
          <button
            onClick={() => { onDelete(); close(); }}
            className="w-full flex items-center gap-2.5 px-4 py-2.5 text-[13px] font-medium text-red-600 hover:bg-red-50 transition-colors text-left"
          >
            <Trash2 size={13} className="text-red-500 shrink-0" />
            Delete
          </button>
          </>}
        </div>,
        document.body
      )}
    </>
  );
}

/* ─────────────────────── ConfirmDeleteModal ────────────────────────── */
function ConfirmDeleteModal({ drawing, onConfirm, onCancel, loading }) {
  return createPortal(
    <div
      className="fixed inset-0 z-[9998] flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.4)" }}
    >
      <div className="bg-white rounded-2xl shadow-xl border border-border-slate w-full max-w-sm overflow-hidden">
        <div className="h-1 bg-red-500" />
        <div className="p-6">
          {/* Icon + message */}
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

          {/* Actions */}
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

/* ──────────────────── Slide-in animation ─────────────────────────────── */
const SLIDE_STYLE = document.getElementById("dms-slide-right") || (() => {
  const s = document.createElement("style");
  s.id = "dms-slide-right";
  s.textContent = `@keyframes slideInRight { from { transform: translateX(100%); } to { transform: translateX(0); } }`;
  document.head.appendChild(s);
  return s;
})();

/* ──────────────────── RevisionHistoryPanel ──────────────────────────── */
function RevisionHistoryPanel({ drawing, token, onClose }) {
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

  /* Close on Escape */
  useEffect(() => {
    const handler = e => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onClose]);

  return createPortal(
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-[9988] bg-black/30 backdrop-blur-[2px]"
        onClick={onClose}
      />

      {/* Panel — slides in from right */}
      <div className="fixed inset-y-0 right-0 z-[9989] w-full max-w-md bg-white border-l border-border-slate shadow-2xl flex flex-col animate-in slide-in-from-right"
           style={{ animation: "slideInRight .2s ease-out" }}
      >
        {/* Header */}
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
          <p className="text-[13px] font-mono font-bold text-primary">{drawing.number}</p>
          <p className="text-[11px] text-on-surface-variant mt-0.5">{drawing.title}</p>
        </div>

        {/* Body */}
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
              {/* Timeline — rendered newest first for readability */}
              <div className="relative">
                {/* Vertical timeline line */}
                <div className="absolute left-[15px] top-3 bottom-3 w-px bg-border-slate" />

                {[...revisions].reverse().map((rev, i) => {
                  const isCurrent = rev.current;
                  const filename  = rev.path?.split("/").pop() ?? "";
                  const ext       = filename.split(".").pop().toUpperCase();
                  const statusPill  = STATUS_PILL[rev.status]  ?? "bg-surface-container text-on-surface-variant";
                  const statusLabel = STATUS_LABEL[rev.status] ?? rev.status;

                  return (
                    <div key={rev.id ?? "current"} className="relative pl-10 pb-6 last:pb-0">
                      {/* Timeline dot */}
                      <div className={`absolute left-[9px] top-1.5 w-[13px] h-[13px] rounded-full border-2 ${
                        isCurrent
                          ? "bg-primary border-primary"
                          : "bg-surface-container border-border-slate"
                      }`} />

                      {/* Content card */}
                      <div className={`rounded-xl border overflow-hidden ${
                        isCurrent
                          ? "border-primary/30 bg-primary/5"
                          : "border-border-slate bg-white opacity-80"
                      } transition-colors`}>

                        {/* Superseded warning banner — older revisions only */}
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
                          {/* Badge row */}
                          <div className="flex items-center gap-1.5 flex-wrap mb-1.5">
                            {/* Rev pill */}
                            <span className={`px-2 py-0.5 rounded-full text-[11px] font-bold font-mono ${
                              isCurrent ? "bg-primary text-white" : "bg-surface-container text-on-surface-variant"
                            }`}>
                              Rev {rev.rev || "—"}
                            </span>

                            {/* CURRENT or SUPERSEDED label */}
                            {isCurrent ? (
                              <span className="px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider bg-status-emerald-bg text-status-emerald-text border border-status-emerald-text/20">
                                ✓ Current
                              </span>
                            ) : (
                              <span className="px-1.5 py-0.5 rounded text-[9px] font-semibold uppercase tracking-wider bg-amber-50 text-amber-700 border border-amber-200">
                                Superseded
                              </span>
                            )}

                            {/* Real status badge — shown on all revisions */}
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

                          {/* Actions — View & Download always available */}
                          {rev.path && (
                            <div className="flex items-center gap-1 mt-2.5">
                              <a
                                href={resolveUrl(rev.path)}
                                target="_blank"
                                rel="noreferrer"
                                className="flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-medium text-on-surface-variant hover:text-primary hover:bg-surface-container transition-colors"
                              >
                                <Eye size={12} /> View
                              </a>
                              <a
                                href={resolveUrl(rev.path)}
                                download={`${drawing.number}_Rev${rev.rev || "X"}.${ext.toLowerCase()}`}
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

        {/* Footer */}
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

/* ─────────────────────────── FileCard ──────────────────────────────── */
function FileCard({ d, viewMode, onDelete, onEditMetadata, onRename, onMove, onNewRevision, onViewHistory }) {
  const filename    = d.path?.split("/").pop() ?? "";
  const ext         = filename.split(".").pop().toUpperCase();
  const extStyle    = EXT_STYLE[ext] ?? "bg-surface-container text-on-surface-variant";
  const statusPill  = STATUS_PILL[d.status]  ?? "bg-surface-container text-on-surface-variant";
  const statusLabel = STATUS_LABEL[d.status] ?? d.status;
  const statusBar   = STATUS_BAR[d.status]   ?? "bg-blue-400";

  /* Shared action callbacks */
  const actions = onDelete ? {
    onEditMetadata: () => onEditMetadata(d),
    onRename:       () => onRename(d),
    onMove:         () => onMove(d),
    onSupersede:    onNewRevision ? () => onNewRevision(d) : undefined,
    onViewHistory:  onViewHistory ? () => onViewHistory(d) : undefined,
    onDelete:       () => onDelete(d),
  } : null;

  /* History is available even for read-only users (no onDelete needed) */
  const historyOnly = !actions && onViewHistory ? {
    onViewHistory: () => onViewHistory(d),
  } : null;

  /* ── List row ── */
  if (viewMode === "list") {
    return (
      <div className="group flex items-center gap-3 px-4 py-2.5 rounded-xl hover:bg-surface-container transition-colors">
        <span className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-bold shrink-0 ${extStyle}`}>{ext}</span>
        <div className="flex-1 min-w-0">
          <p className="text-[13px] font-bold text-primary font-mono leading-tight">{d.number}</p>
          <p className="text-[11px] text-on-surface-variant truncate">{d.title}</p>
        </div>
        <span className="font-mono text-[11px] text-on-surface-variant hidden sm:block shrink-0">Rev {d.rev || "—"}</span>
        {d.issueDate && <span className="text-[11px] text-on-surface-variant hidden lg:block shrink-0">{d.issueDate}</span>}
        <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold hidden md:block shrink-0 ${statusPill}`}>{statusLabel}</span>

        {/* Actions — always visible */}
        <div className="flex items-center gap-0.5 shrink-0">
          <a
            href={resolveUrl(d.path)} target="_blank" rel="noreferrer"
            onClick={e => e.stopPropagation()}
            className="p-1.5 rounded-lg hover:bg-surface-container-low text-on-surface-variant hover:text-primary transition-colors"
            title="View"
          >
            <Eye size={14} />
          </a>
          <a
            href={resolveUrl(d.path)} download={filename}
            onClick={e => e.stopPropagation()}
            className="p-1.5 rounded-lg hover:bg-surface-container-low text-on-surface-variant hover:text-primary transition-colors"
            title="Download"
          >
            <Download size={14} />
          </a>
          {(actions || historyOnly) && <FileMenu {...(actions || historyOnly)} />}
        </div>
      </div>
    );
  }

  /* ── Grid card ── */
  return (
    <div className="bg-white border border-border-slate rounded-xl overflow-hidden hover:shadow-md transition-all duration-150 cursor-default flex flex-col">
      {/* Status colour bar */}
      <div className={`h-1.5 shrink-0 ${statusBar}`} />

      <div className="p-4 flex flex-col flex-1">
        {/* Top row: EXT badge · status pill · ⋮ menu */}
        <div className="flex items-start justify-between gap-1.5 mb-3">
          <span className={`px-2 py-1 rounded-lg text-[10px] font-mono font-bold shrink-0 ${extStyle}`}>{ext}</span>
          <div className="flex items-center gap-1 min-w-0">
            <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold shrink-0 ${statusPill}`}>{statusLabel}</span>
            {(actions || historyOnly) && <FileMenu {...(actions || historyOnly)} />}
          </div>
        </div>

        {/* Drawing number + title */}
        <p className="font-mono text-[13px] font-bold text-primary leading-tight mb-0.5">{d.number}</p>
        <p className="text-[11px] text-on-surface-variant leading-snug line-clamp-2 flex-1 mb-3">{d.title}</p>

        {/* Bottom row: Rev · Date · View · Download */}
        <div className="flex items-center justify-between mt-auto">
          <div className="flex flex-col gap-0.5">
            <span className="font-mono text-[11px] text-on-surface-variant">Rev {d.rev || "—"}</span>
            {d.issueDate && <span className="text-[10px] text-on-surface-variant">{d.issueDate}</span>}
          </div>
          <div className="flex items-center gap-0.5">
            <a
              href={resolveUrl(d.path)} target="_blank" rel="noreferrer"
              className="p-1.5 rounded-lg hover:bg-surface-container text-on-surface-variant hover:text-primary transition-colors"
              title="View"
            >
              <Eye size={13} />
            </a>
            <a
              href={resolveUrl(d.path)} download={filename}
              className="p-1.5 rounded-lg hover:bg-surface-container text-on-surface-variant hover:text-primary transition-colors"
              title="Download"
            >
              <Download size={13} />
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────────── FolderCard ────────────────────────────── */
function FolderCard({ node, fileCount, onClick, onAdd, onRename, onMove, onDelete, viewMode }) {
  const subCount = countDescendants(node);
  const hasMenu  = onAdd || onRename || onMove || onDelete;

  if (viewMode === "list") {
    return (
      <div
        onClick={onClick}
        className="group flex items-center gap-3 px-4 py-2.5 rounded-xl hover:bg-surface-container cursor-pointer transition-colors"
      >
        <Folder size={18} className="text-primary shrink-0" />
        <span className="flex-1 text-[13px] font-medium text-on-surface truncate">{node.name}</span>
        {fileCount > 0 && (
          <span className="text-[11px] text-on-surface-variant">{fileCount} file{fileCount !== 1 ? "s" : ""}</span>
        )}
        {subCount > 0 && (
          <span className="text-[11px] text-on-surface-variant">{subCount} folder{subCount !== 1 ? "s" : ""}</span>
        )}
        {hasMenu && <FolderMenu onAdd={onAdd} onRename={onRename} onMove={onMove} onDelete={onDelete} />}
        <ChevronRight size={14} className="text-outline shrink-0" />
      </div>
    );
  }

  return (
    <div
      onClick={onClick}
      className="group flex items-center gap-3 bg-surface-container-low hover:bg-surface-container border border-border-slate rounded-xl px-4 py-3 cursor-pointer transition-all duration-150 hover:shadow-sm"
    >
      <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
        <Folder size={18} className="text-primary" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[13px] font-semibold text-on-surface truncate leading-tight">{node.name}</p>
        <p className="text-[11px] text-on-surface-variant mt-0.5">
          {subCount > 0 ? `${subCount} folder${subCount !== 1 ? "s" : ""}` : ""}
          {subCount > 0 && fileCount > 0 ? " · " : ""}
          {fileCount > 0 ? `${fileCount} file${fileCount !== 1 ? "s" : ""}` : ""}
          {subCount === 0 && fileCount === 0 ? "Empty" : ""}
        </p>
      </div>
      {hasMenu && <FolderMenu onAdd={onAdd} onRename={onRename} onMove={onMove} onDelete={onDelete} />}
    </div>
  );
}

/* ─────────────────────────── DocumentsView ─────────────────────────── */
export default function DocumentsView({
  drawings,
  onUpload,
  onDeleteDrawing,
  projects      = [],
  activeProject,
  onProjectChange,
  transmittals  = [],
  isProjectTeam = false,
  token         = "",
  onDrawingUpdate,
}) {
  const [tree,          setTree]          = useState(DEFAULT_TREE);
  const [treeLoading,   setTreeLoading]   = useState(true);
  const [segments,      setSegments]      = useState([]);
  const [viewMode,      setViewMode]      = useState("grid");
  const [renamingIdx,   setRenamingIdx]   = useState(null);
  const [renameVal,     setRenameVal]     = useState("");
  const [addingFolder,  setAddingFolder]  = useState(false);
  const [newFolderVal,  setNewFolderVal]  = useState("");
  const [addingSubIdx,  setAddingSubIdx]  = useState(null);
  const [newSubVal,     setNewSubVal]     = useState("");
  const [confirmDelIdx, setConfirmDelIdx] = useState(null);
  const [localSearch,   setLocalSearch]   = useState("");

  /* File delete state */
  const [confirmDeleteDrawing, setConfirmDeleteDrawing] = useState(null); // drawing object
  const [deleteLoading,        setDeleteLoading]        = useState(false);

  /* Drawing action modal state */
  const [editDrawing,     setEditDrawing]     = useState(null);
  const [renameDrawing,   setRenameDrawing]   = useState(null);
  const [moveDrawing,     setMoveDrawing]     = useState(null);
  const [revisionDrawing, setRevisionDrawing] = useState(null);
  const [historyDrawing,  setHistoryDrawing]  = useState(null);

  /* Folder move state */
  const [moveFolderIdx,   setMoveFolderIdx]   = useState(null);

  /* Local toast for actions + delete feedback */
  const [localToast, setLocalToast] = useState(null);

  const addInputRef    = useRef(null);
  const renameInputRef = useRef(null);
  const subInputRef    = useRef(null);

  /* Load folder tree from server whenever the active project changes */
  useEffect(() => {
    if (!activeProject?.id || !token) return;
    setTreeLoading(true);
    setSegments([]);
    fetchTree(activeProject.id, token)
      .then(saved => { setTree(saved ?? DEFAULT_TREE()); })
      .catch(() => { setTree(DEFAULT_TREE()); })
      .finally(() => setTreeLoading(false));
  }, [activeProject?.id]);

  useEffect(() => { if (addingFolder)         addInputRef.current?.focus();    }, [addingFolder]);
  useEffect(() => { if (renamingIdx !== null)  renameInputRef.current?.focus(); }, [renamingIdx]);
  useEffect(() => { if (addingSubIdx !== null) subInputRef.current?.focus();    }, [addingSubIdx]);

  const showToast = (msg, type = "info") => {
    setLocalToast({ msg, type });
    setTimeout(() => setLocalToast(null), 3000);
  };

  const handleDrawingUpdated = async (msg) => {
    await onDrawingUpdate?.();
    showToast(msg, "success");
  };

  const updateTree = updater => {
    setTree(prev => {
      const next = updater(structuredClone(prev));
      if (activeProject?.id && token) {
        persistTree(activeProject.id, token, next).catch(() => {});
      }
      return next;
    });
  };

  /* ── Derived from tree + location ── */
  const currentNode       = getNode(tree, segments);
  const subfolders        = currentNode?.children ?? [];
  const currentFolderPath = [tree.name, ...segments].join("/");
  const currentFiles      = drawings.filter(d => (d.folderPath || "") === currentFolderPath && d.path);

  const countFilesUnder = (node, basePath) => {
    let count = drawings.filter(d => (d.folderPath || "") === basePath && d.path).length;
    for (const child of node.children ?? [])
      count += countFilesUnder(child, `${basePath}/${child.name}`);
    return count;
  };

  /* ── Workspace bar stats ── */
  const totalFolders     = countDescendants(tree);
  const pendingApprovals = drawings.filter(d => d.status === "S2").length;

  /* ── Navigation ── */
  const navigateInto = name => { setSegments(s => [...s, name]); setLocalSearch(""); };
  const navigateTo   = idx  => { setSegments(s => s.slice(0, idx)); setLocalSearch(""); };
  const navigateRoot = ()   => { setSegments([]); setLocalSearch(""); };

  /* ── Folder CRUD ── */
  const addFolder = () => {
    const name = newFolderVal.trim();
    if (!name) { setAddingFolder(false); setNewFolderVal(""); return; }
    updateTree(next => {
      const node = getNode(next, segments);
      if (!node.children) node.children = [];
      if (!node.children.some(c => c.name === name))
        node.children.push({ name, children: [] });
      return next;
    });
    setAddingFolder(false);
    setNewFolderVal("");
  };

  const renameFolder = async idx => {
    const name = renameVal.trim();
    if (!name) { setRenamingIdx(null); return; }
    
    const oldName = subfolders[idx].name;
    if (oldName === name) { setRenamingIdx(null); return; }

    const oldPath = [tree.name, ...segments, oldName].join("/");
    const newPath = [tree.name, ...segments, name].join("/");

    // 1. Update tree model on server
    updateTree(next => {
      getNode(next, segments).children[idx].name = name;
      return next;
    });

    // 2. Call backend to recursively update all drawings' folder paths
    try {
      const res = await fetch(`${API}/api/projects/${activeProject.id}/folders/rename`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ oldPath, newPath }),
      });
      if (res.ok) {
        await onDrawingUpdate?.();
        showToast(`Folder renamed to "${name}" and files updated.`, "success");
      } else {
        showToast("Error updating drawing paths on server.", "error");
      }
    } catch (err) {
      console.error(err);
      showToast("Network error updating folder files.", "error");
    }

    setRenamingIdx(null);
  };

  const deleteFolder = async idx => {
    const folderName = subfolders[idx].name;
    const folderPath = [tree.name, ...segments, folderName].join("/");
    const parentPath = [tree.name, ...segments].join("/");

    // 1. Update tree model on server
    updateTree(next => {
      getNode(next, segments).children.splice(idx, 1);
      return next;
    });

    // 2. Call backend to bubble up drawings
    try {
      const res = await fetch(`${API}/api/projects/${activeProject.id}/folders/delete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ folderPath, parentPath }),
      });
      if (res.ok) {
        await onDrawingUpdate?.();
        showToast(`Folder deleted. Files bubbled up to parent folder.`, "success");
      }
    } catch (err) {
      console.error(err);
    }
  };

  const moveFolder = async (targetPath) => {
    const idx        = moveFolderIdx;
    const folderNode = subfolders[idx];
    const folderName = folderNode.name;
    const oldPath    = [tree.name, ...segments, folderName].join("/");
    const newPath    = targetPath + "/" + folderName;

    // 1. Update tree: remove from current parent, insert under target
    updateTree(next => {
      const parentNode = getNode(next, segments);
      const [moved]    = parentNode.children.splice(idx, 1);
      const targetSegs = targetPath.split("/").slice(1); // strip root name
      const targetNode = getNode(next, targetSegs);
      if (!targetNode.children) targetNode.children = [];
      targetNode.children.push(moved);
      return next;
    });

    setMoveFolderIdx(null);

    // 2. Update drawing folder_paths on backend
    try {
      const res = await fetch(`${API}/api/projects/${activeProject.id}/folders/move`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body:    JSON.stringify({ oldPath, newPath }),
      });
      if (res.ok) {
        await onDrawingUpdate?.();
        showToast(`"${folderName}" moved successfully.`, "success");
      } else {
        showToast("Error updating drawing paths on server.", "error");
      }
    } catch (err) {
      console.error(err);
      showToast("Network error moving folder.", "error");
    }
  };

  const addSubfolder = (childIdx, name) => {
    if (!name) return;
    updateTree(next => {
      const child = getNode(next, segments).children[childIdx];
      if (!child.children) child.children = [];
      if (!child.children.some(c => c.name === name))
        child.children.push({ name, children: [] });
      return next;
    });
  };

  const commitSubfolder = childIdx => {
    const name = newSubVal.trim();
    if (name) addSubfolder(childIdx, name);
    setAddingSubIdx(null);
    setNewSubVal("");
  };

  /* ── File delete ── */
  const handleDeleteConfirm = async () => {
    if (!confirmDeleteDrawing || !onDeleteDrawing) return;
    setDeleteLoading(true);
    try {
      await onDeleteDrawing(confirmDeleteDrawing.id);
      showToast(`"${confirmDeleteDrawing.number}" deleted successfully.`, "success");
      setConfirmDeleteDrawing(null);
    } catch {
      showToast("Failed to delete drawing. Please try again.", "error");
    } finally {
      setDeleteLoading(false);
    }
  };

  /* ── Local search ── */
  const _naturalSort = new Intl.Collator(undefined, { numeric: true, sensitivity: "base" });

  const filteredSubfolderEntries = subfolders
    .map((child, originalIdx) => ({ child, originalIdx }))
    .filter(({ child }) =>
      !localSearch || child.name.toLowerCase().includes(localSearch.toLowerCase())
    )
    .sort((a, b) => _naturalSort.compare(a.child.name, b.child.name));

  const filteredFiles = currentFiles
    .filter(d => {
      if (!localSearch) return true;
      const q        = localSearch.toLowerCase();
      const filename = d.path?.split("/").pop()?.toLowerCase() ?? "";
      return (
        d.number?.toLowerCase().includes(q) ||
        d.title?.toLowerCase().includes(q)  ||
        d.rev?.toLowerCase().includes(q)    ||
        d.status?.toLowerCase().includes(q) ||
        filename.includes(q)
      );
    })
    .sort((a, b) => _naturalSort.compare(a.number ?? "", b.number ?? ""));

  const searchActive = localSearch.length > 0;
  const noResults    = searchActive && filteredSubfolderEntries.length === 0 && filteredFiles.length === 0 && !addingFolder;
  const actualEmpty  = !searchActive && subfolders.length === 0 && currentFiles.length === 0 && !addingFolder;

  const folderWord  = subfolders.length === 1 ? "folder"  : "folders";
  const drawingWord = currentFiles.length === 1 ? "drawing" : "drawings";
  const summaryLine = `${subfolders.length} ${folderWord} · ${currentFiles.length} ${drawingWord} in this location`;

  if (treeLoading) {
    return (
      <div className="max-w-[1400px] mx-auto space-y-4">
        <div className="bg-white border border-border-slate rounded-xl p-10 flex items-center justify-center gap-3 text-on-surface-variant">
          <Loader2 size={20} className="animate-spin text-primary" />
          <span className="text-[14px]">Loading folders…</span>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-[1400px] mx-auto space-y-4">

      {/* ── Project Workspace Bar ── */}
      <ProjectWorkspaceBar
        activeProject={activeProject}
        projects={projects}
        onProjectChange={onProjectChange}
        totalFolders={totalFolders}
        totalDrawings={drawings.length}
        totalTransmittals={transmittals.length}
        pendingApprovals={pendingApprovals}
        isProjectTeam={isProjectTeam}
      />

      {/* ── Page title ── */}
      <div>
        <h1 className="text-[22px] md:text-headline-lg font-semibold text-on-surface">Documents</h1>
        <p className="text-body-md text-on-surface-variant mt-0.5">
          Organize drawings, folders, revisions, and files.
        </p>
      </div>

      {/* ── Content card ── */}
      <div className="bg-white border border-border-slate rounded-xl overflow-hidden">

        {/* Card header: breadcrumb + toolbar */}
        <div className="flex items-center gap-x-3 gap-y-2 px-5 py-3 border-b border-border-slate flex-wrap">

          {/* Breadcrumb */}
          <nav className="flex items-center gap-1 flex-1 min-w-0 flex-wrap">
            <button
              onClick={navigateRoot}
              className="p-1 rounded-md text-on-surface-variant hover:text-primary hover:bg-surface-container transition-colors shrink-0"
              title="Root"
            >
              <Home size={14} />
            </button>
            <ChevronRight size={13} className="text-outline shrink-0" />
            <button
              onClick={navigateRoot}
              className={`px-1.5 py-0.5 rounded text-[12px] font-medium transition-colors leading-none ${
                segments.length === 0
                  ? "text-on-surface font-semibold pointer-events-none"
                  : "text-on-surface-variant hover:text-on-surface hover:bg-surface-container"
              }`}
            >
              Documents
            </button>
            {segments.map((seg, i) => {
              const isLast = i === segments.length - 1;
              return (
                <div key={i} className="flex items-center gap-1">
                  <ChevronRight size={13} className="text-outline shrink-0" />
                  <button
                    onClick={() => !isLast && navigateTo(i + 1)}
                    className={`px-1.5 py-0.5 rounded text-[12px] font-medium transition-colors leading-none ${
                      isLast
                        ? "text-on-surface font-semibold pointer-events-none"
                        : "text-on-surface-variant hover:text-on-surface hover:bg-surface-container"
                    }`}
                  >
                    {seg}
                  </button>
                </div>
              );
            })}
          </nav>

          {/* Toolbar */}
          <div className="flex items-center gap-2 flex-wrap">
            {/* Local search */}
            <div className="relative">
              <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-on-surface-variant pointer-events-none" />
              <input
                type="text"
                value={localSearch}
                onChange={e => setLocalSearch(e.target.value)}
                placeholder="Search in this folder…"
                className="pl-8 pr-7 py-1.5 text-[12px] w-full sm:w-[200px] bg-surface-container-low border border-border-slate rounded-lg text-on-surface placeholder:text-on-surface-variant focus:outline-none focus:ring-1 focus:ring-primary/20 focus:border-primary transition-all"
              />
              {localSearch && (
                <button
                  onClick={() => setLocalSearch("")}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-on-surface-variant hover:text-on-surface transition-colors"
                >
                  <X size={12} />
                </button>
              )}
            </div>

            {/* View toggle */}
            <div className="flex items-center bg-surface-container-low border border-border-slate rounded-lg p-0.5 shrink-0">
              <button
                onClick={() => setViewMode("grid")}
                className={`p-1.5 rounded-md transition-colors ${viewMode === "grid" ? "bg-white shadow-sm text-primary" : "text-on-surface-variant hover:text-on-surface"}`}
                title="Grid view"
              >
                <LayoutGrid size={14} />
              </button>
              <button
                onClick={() => setViewMode("list")}
                className={`p-1.5 rounded-md transition-colors ${viewMode === "list" ? "bg-white shadow-sm text-primary" : "text-on-surface-variant hover:text-on-surface"}`}
                title="List view"
              >
                <List size={14} />
              </button>
            </div>

            {/* New Folder */}
            {!isProjectTeam && (
              <button
                onClick={() => setAddingFolder(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border-slate bg-white hover:bg-surface-container text-[12px] font-medium text-on-surface-variant transition-colors shrink-0"
              >
                <FolderPlus size={13} />
                New Folder
              </button>
            )}

            {/* Upload Here */}
            {onUpload && (
              <button
                onClick={() => onUpload(currentFolderPath)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary text-white hover:bg-primary-container text-[12px] font-medium shadow-sm transition-all active:scale-[0.98] shrink-0"
              >
                <Upload size={13} />
                Upload Here
              </button>
            )}
          </div>
        </div>

        {/* Folder summary line */}
        <div className="px-5 py-2 border-b border-border-slate bg-surface-container-low">
          <p className="text-[11px] text-on-surface-variant">
            {summaryLine}
            {searchActive && (
              <span className="ml-2 text-primary font-medium">
                · Showing results for "{localSearch}"
              </span>
            )}
          </p>
        </div>

        {/* Empty / no-results states */}
        {(actualEmpty || noResults) ? (
          <div className="flex flex-col items-center justify-center h-64 gap-3 text-on-surface-variant">
            <div className="w-16 h-16 rounded-2xl bg-surface-container-low flex items-center justify-center">
              {noResults
                ? <Search size={28} className="text-outline" />
                : <FolderOpen size={32} className="text-outline" />}
            </div>
            <p className="text-[15px] font-semibold text-on-surface">
              {noResults ? "No results found" : "This folder is empty"}
            </p>
            <p className="text-[13px] text-on-surface-variant text-center max-w-xs">
              {noResults
                ? `No folders or files match "${localSearch}"`
                : "Create a subfolder or upload drawings here"}
            </p>
            {noResults && (
              <button
                onClick={() => setLocalSearch("")}
                className="text-[13px] font-medium text-primary hover:underline"
              >
                Clear search
              </button>
            )}
          </div>
        ) : (
          <div className="p-5 space-y-6">

            {/* ── Folders section ── */}
            {(filteredSubfolderEntries.length > 0 || addingFolder) && (
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <p className="text-[11px] font-semibold text-on-surface-variant uppercase tracking-wider">Folders</p>
                  {searchActive && filteredSubfolderEntries.length < subfolders.length && (
                    <span className="text-[10px] text-on-surface-variant bg-surface-container px-1.5 py-0.5 rounded-full">
                      {filteredSubfolderEntries.length} of {subfolders.length}
                    </span>
                  )}
                </div>

                <div className={viewMode === "grid"
                  ? "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3"
                  : "space-y-0.5"
                }>
                  {filteredSubfolderEntries.map(({ child, originalIdx }) => {
                    const childPath = `${currentFolderPath}/${child.name}`;
                    const fileCount = countFilesUnder(child, childPath);

                    if (confirmDelIdx === originalIdx) {
                      return (
                        <div key={originalIdx} className="flex items-center gap-2 bg-status-rose-bg border border-status-rose-text/30 rounded-xl px-4 py-3">
                          <Trash2 size={14} className="text-status-rose-text shrink-0" />
                          <p className="flex-1 text-[12px] font-medium text-status-rose-text">Delete "{child.name}"?</p>
                          <button
                            onClick={() => { deleteFolder(originalIdx); setConfirmDelIdx(null); }}
                            className="px-2.5 py-1 rounded-lg bg-status-rose-text text-white text-[11px] font-semibold hover:opacity-90 transition-opacity"
                          >Delete</button>
                          <button
                            onClick={() => setConfirmDelIdx(null)}
                            className="px-2.5 py-1 rounded-lg border border-status-rose-text/30 text-status-rose-text text-[11px] font-medium hover:bg-status-rose-text/10 transition-colors"
                          >Cancel</button>
                        </div>
                      );
                    }

                    if (renamingIdx === originalIdx) {
                      return (
                        <div key={originalIdx} className="flex items-center gap-2 bg-surface-container-low border border-primary rounded-xl px-4 py-3">
                          <Folder size={16} className="text-primary shrink-0" />
                          <input
                            ref={renameInputRef}
                            value={renameVal}
                            onChange={e => setRenameVal(e.target.value)}
                            onBlur={() => renameFolder(originalIdx)}
                            onKeyDown={e => {
                              if (e.key === "Enter")  renameFolder(originalIdx);
                              if (e.key === "Escape") setRenamingIdx(null);
                            }}
                            className="flex-1 bg-transparent text-[13px] font-medium text-on-surface outline-none"
                          />
                          <button onClick={() => renameFolder(originalIdx)} className="p-0.5 text-primary"><Check size={13} /></button>
                          <button onClick={() => setRenamingIdx(null)} className="p-0.5 text-on-surface-variant"><X size={13} /></button>
                        </div>
                      );
                    }

                    if (addingSubIdx === originalIdx) {
                      return (
                        <div key={originalIdx} className="flex items-center gap-2 border border-primary rounded-xl px-4 py-3 bg-primary/5">
                          <FolderPlus size={14} className="text-primary shrink-0" />
                          <input
                            ref={subInputRef}
                            value={newSubVal}
                            onChange={e => setNewSubVal(e.target.value)}
                            placeholder={`Subfolder inside "${child.name}"…`}
                            onBlur={() => commitSubfolder(originalIdx)}
                            onKeyDown={e => {
                              if (e.key === "Enter")  commitSubfolder(originalIdx);
                              if (e.key === "Escape") { setAddingSubIdx(null); setNewSubVal(""); }
                            }}
                            className="flex-1 bg-transparent text-[13px] font-medium text-on-surface placeholder:text-outline outline-none"
                          />
                          <button onClick={() => commitSubfolder(originalIdx)} className="p-0.5 text-primary"><Check size={13} /></button>
                          <button onClick={() => { setAddingSubIdx(null); setNewSubVal(""); }} className="p-0.5 text-on-surface-variant"><X size={13} /></button>
                        </div>
                      );
                    }

                    return (
                      <FolderCard
                        key={originalIdx}
                        node={child}
                        fileCount={fileCount}
                        viewMode={viewMode}
                        onClick={() => navigateInto(child.name)}
                        onAdd={!isProjectTeam ? () => { setAddingSubIdx(originalIdx); setNewSubVal(""); } : undefined}
                        onRename={!isProjectTeam ? () => { setRenamingIdx(originalIdx); setRenameVal(child.name); } : undefined}
                        onMove={!isProjectTeam ? () => setMoveFolderIdx(originalIdx) : undefined}
                        onDelete={!isProjectTeam ? () => setConfirmDelIdx(originalIdx) : undefined}
                      />
                    );
                  })}

                  {addingFolder && (
                    <div className="flex items-center gap-2 border border-primary rounded-xl px-4 py-3 bg-primary/5">
                      <Folder size={16} className="text-primary shrink-0" />
                      <input
                        ref={addInputRef}
                        value={newFolderVal}
                        onChange={e => setNewFolderVal(e.target.value)}
                        placeholder="Folder name…"
                        onBlur={addFolder}
                        onKeyDown={e => {
                          if (e.key === "Enter")  addFolder();
                          if (e.key === "Escape") { setAddingFolder(false); setNewFolderVal(""); }
                        }}
                        className="flex-1 bg-transparent text-[13px] font-medium text-on-surface placeholder:text-outline outline-none"
                      />
                      <button onClick={addFolder} className="p-0.5 text-primary"><Check size={13} /></button>
                      <button onClick={() => { setAddingFolder(false); setNewFolderVal(""); }} className="p-0.5 text-on-surface-variant"><X size={13} /></button>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* ── Files section ── */}
            {filteredFiles.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <p className="text-[11px] font-semibold text-on-surface-variant uppercase tracking-wider">
                    Files — {filteredFiles.length}
                  </p>
                  {searchActive && filteredFiles.length < currentFiles.length && (
                    <span className="text-[10px] text-on-surface-variant bg-surface-container px-1.5 py-0.5 rounded-full">
                      {filteredFiles.length} of {currentFiles.length}
                    </span>
                  )}
                </div>
                {viewMode === "grid" ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                    {filteredFiles.map(d => (
                      <FileCard
                        key={d.id}
                        d={d}
                        viewMode="grid"
                        onDelete={onDeleteDrawing ? setConfirmDeleteDrawing : undefined}
                        onEditMetadata={onDeleteDrawing ? setEditDrawing   : undefined}
                        onRename=      {onDeleteDrawing ? setRenameDrawing  : undefined}
                        onMove=        {onDeleteDrawing ? setMoveDrawing    : undefined}
                        onNewRevision= {onUpload && onDeleteDrawing ? setRevisionDrawing : undefined}
                        onViewHistory= {setHistoryDrawing}
                      />
                    ))}
                  </div>
                ) : (
                  <div className="space-y-0.5">
                    {filteredFiles.map(d => (
                      <FileCard
                        key={d.id}
                        d={d}
                        viewMode="list"
                        onDelete={onDeleteDrawing ? setConfirmDeleteDrawing : undefined}
                        onEditMetadata={onDeleteDrawing ? setEditDrawing   : undefined}
                        onRename=      {onDeleteDrawing ? setRenameDrawing  : undefined}
                        onMove=        {onDeleteDrawing ? setMoveDrawing    : undefined}
                        onNewRevision= {onUpload && onDeleteDrawing ? setRevisionDrawing : undefined}
                        onViewHistory= {setHistoryDrawing}
                      />
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Drawings with no uploaded file */}
            {(() => {
              const missing = drawings.filter(d => (d.folderPath || "") === currentFolderPath && !d.path);
              if (!missing.length) return null;
              return (
                <div className="bg-status-amber-bg border border-status-amber-text/30 rounded-xl p-4">
                  <p className="text-[12px] font-semibold text-status-amber-text mb-2">
                    {missing.length} drawing{missing.length > 1 ? "s" : ""} in this folder without uploaded files
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {missing.map(d => (
                      <span key={d.id} className="px-2 py-1 rounded bg-white text-status-amber-text font-mono text-[11px] border border-status-amber-text/20">
                        {d.number}
                      </span>
                    ))}
                  </div>
                </div>
              );
            })()}
          </div>
        )}
      </div>

      {/* ── Delete confirmation modal ── */}
      {confirmDeleteDrawing && (
        <ConfirmDeleteModal
          drawing={confirmDeleteDrawing}
          loading={deleteLoading}
          onConfirm={handleDeleteConfirm}
          onCancel={() => !deleteLoading && setConfirmDeleteDrawing(null)}
        />
      )}

      {/* ── Edit Metadata modal ── */}
      {editDrawing && (
        <EditMetadataModal
          drawing={editDrawing}
          token={token}
          onSuccess={handleDrawingUpdated}
          onClose={() => setEditDrawing(null)}
        />
      )}

      {/* ── Rename modal ── */}
      {renameDrawing && (
        <RenameModal
          drawing={renameDrawing}
          token={token}
          onSuccess={handleDrawingUpdated}
          onClose={() => setRenameDrawing(null)}
        />
      )}

      {/* ── Move to Folder modal ── */}
      {moveDrawing && (
        <MoveFolderModal
          drawing={moveDrawing}
          token={token}
          tree={tree}
          onSuccess={handleDrawingUpdated}
          onClose={() => setMoveDrawing(null)}
        />
      )}

      {/* ── Move Folder modal ── */}
      {moveFolderIdx !== null && subfolders[moveFolderIdx] && (
        <MoveFolderNodeModal
          folderName={subfolders[moveFolderIdx].name}
          folderPath={[tree.name, ...segments, subfolders[moveFolderIdx].name].join("/")}
          tree={tree}
          onConfirm={moveFolder}
          onClose={() => setMoveFolderIdx(null)}
        />
      )}

      {/* ── New Revision modal ── */}
      {revisionDrawing && (
        <NewRevisionModal
          drawing={revisionDrawing}
          token={token}
          projectId={activeProject?.id}
          onSuccess={handleDrawingUpdated}
          onClose={() => setRevisionDrawing(null)}
        />
      )}

      {/* ── Revision History side panel ── */}
      {historyDrawing && (
        <RevisionHistoryPanel
          drawing={historyDrawing}
          token={token}
          onClose={() => setHistoryDrawing(null)}
        />
      )}

      {/* ── Local toast (actions + delete feedback) ── */}
      {localToast && createPortal(
        <div className={`fixed bottom-6 left-1/2 -translate-x-1/2 z-[9999] px-5 py-3 rounded-xl shadow-xl text-[13px] font-medium flex items-center gap-2 border whitespace-nowrap ${
          localToast.type === "success"
            ? "bg-status-emerald-bg text-status-emerald-text border-status-emerald-text/20"
            : localToast.type === "error"
            ? "bg-status-rose-bg text-status-rose-text border-status-rose-text/20"
            : "bg-on-surface text-white border-transparent"
        }`}>
          {localToast.msg}
        </div>,
        document.body
      )}
    </div>
  );
}
