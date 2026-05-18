import { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import {
  Folder, FolderOpen, ChevronRight, ChevronDown, Home, LayoutGrid, List,
  MoreVertical, FolderPlus, Pencil, Trash2, Eye, Download,
  Check, X, Upload, Search, Layers, FileText, Send, Clock,
} from "lucide-react";

const API         = import.meta.env.VITE_API_URL;
/* Supports both legacy local paths (/uploads/…) and full R2 URLs */
const resolveUrl  = p => p?.startsWith('http') ? p : `${API}${p}`;
const STORAGE_KEY = "uniqueproperties_folder_tree";
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

function loadTree() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) return JSON.parse(saved);
  } catch {}
  return DEFAULT_TREE();
}
function saveTree(tree) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(tree)); } catch {}
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
const EXT_STYLE = {
  PDF: "bg-red-50    text-red-600",
  DWG: "bg-blue-50   text-blue-700",
  DXF: "bg-indigo-50 text-indigo-600",
  IFC: "bg-purple-50 text-purple-600",
  RVT: "bg-orange-50 text-orange-600",
};

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
        <div className="flex items-center gap-2 flex-wrap">
          <StatChip
            label="Folders"
            value={totalFolders}
            Icon={Layers}
            colorCls="bg-primary/10 text-primary"
          />
          <StatChip
            label="Drawings"
            value={totalDrawings}
            Icon={FileText}
            colorCls="bg-blue-50 text-blue-600"
          />
          <StatChip
            label="Transmittals"
            value={totalTransmittals}
            Icon={Send}
            colorCls="bg-status-emerald-bg text-status-emerald-text"
          />
          <StatChip
            label="Pending"
            value={pendingApprovals}
            Icon={Clock}
            colorCls={pendingApprovals > 0
              ? "bg-status-amber-bg text-status-amber-text"
              : "bg-surface-container text-on-surface-variant"}
          />
        </div>

        {/* Switch project — hidden for Project Team */}
        {!isProjectTeam && (
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
function FolderMenu({ onAdd, onRename, onDelete }) {
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
          <button onClick={() => { onAdd(); setOpen(false); }}
            className="w-full flex items-center gap-2 px-3 py-2 text-[12px] font-medium text-on-surface-variant hover:bg-surface-container-low transition-colors">
            <FolderPlus size={13} /> Add subfolder
          </button>
          <button onClick={() => { onRename(); setOpen(false); }}
            className="w-full flex items-center gap-2 px-3 py-2 text-[12px] font-medium text-on-surface-variant hover:bg-surface-container-low transition-colors">
            <Pencil size={13} /> Rename
          </button>
          <div className="h-px bg-border-slate mx-2 my-1" />
          <button onClick={() => { onDelete(); setOpen(false); }}
            className="w-full flex items-center gap-2 px-3 py-2 text-[12px] font-medium text-status-rose-text hover:bg-status-rose-bg transition-colors">
            <Trash2 size={13} /> Delete
          </button>
        </div>,
        document.body
      )}
    </>
  );
}

/* ─────────────────────────── FolderCard ────────────────────────────── */
function FolderCard({ node, fileCount, onClick, onAdd, onRename, onDelete, viewMode }) {
  const subCount = countDescendants(node);

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
        <FolderMenu onAdd={onAdd} onRename={onRename} onDelete={onDelete} />
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
      <FolderMenu onAdd={onAdd} onRename={onRename} onDelete={onDelete} />
    </div>
  );
}

/* ─────────────────────────── FileCard ──────────────────────────────── */
function FileCard({ d, viewMode }) {
  const filename    = d.path?.split("/").pop() ?? "";
  const ext         = filename.split(".").pop().toUpperCase();
  const extStyle    = EXT_STYLE[ext] ?? "bg-surface-container text-on-surface-variant";
  const statusPill  = STATUS_PILL[d.status]  ?? "bg-surface-container text-on-surface-variant";
  const statusLabel = STATUS_LABEL[d.status] ?? d.status;

  if (viewMode === "list") {
    return (
      <div className="group flex items-center gap-3 px-4 py-2.5 rounded-xl hover:bg-surface-container transition-colors">
        <span className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-bold shrink-0 ${extStyle}`}>{ext}</span>
        <div className="flex-1 min-w-0">
          <p className="text-[13px] font-bold text-primary font-mono leading-tight">{d.number}</p>
          <p className="text-[11px] text-on-surface-variant truncate">{d.title}</p>
        </div>
        <span className="font-mono text-[11px] text-on-surface-variant hidden sm:block shrink-0">Rev {d.rev || "—"}</span>
        <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold hidden md:block shrink-0 ${statusPill}`}>{statusLabel}</span>
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
          <a href={resolveUrl(d.path)} target="_blank" rel="noreferrer"
            onClick={e => e.stopPropagation()}
            className="p-1.5 rounded-lg hover:bg-surface-container-low text-on-surface-variant hover:text-primary transition-colors" title="View">
            <Eye size={14} />
          </a>
          <a href={resolveUrl(d.path)} download={filename}
            onClick={e => e.stopPropagation()}
            className="p-1.5 rounded-lg hover:bg-surface-container-low text-on-surface-variant hover:text-primary transition-colors" title="Download">
            <Download size={14} />
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="group bg-white border border-border-slate rounded-xl overflow-hidden hover:shadow-md transition-all duration-150 cursor-default">
      <div className={`h-1.5 ${d.status === "S3" ? "bg-status-emerald-text" : d.status === "S2" ? "bg-status-amber-text" : d.status === "VOID" ? "bg-status-rose-text" : "bg-blue-400"}`} />
      <div className="p-4">
        <div className="flex items-start justify-between gap-2 mb-3">
          <span className={`px-2 py-1 rounded-lg text-[10px] font-mono font-bold ${extStyle}`}>{ext}</span>
          <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${statusPill}`}>{statusLabel}</span>
        </div>
        <p className="font-mono text-[13px] font-bold text-primary leading-tight mb-0.5">{d.number}</p>
        <p className="text-[11px] text-on-surface-variant leading-snug line-clamp-2 mb-3">{d.title}</p>
        <div className="flex items-center justify-between">
          <span className="font-mono text-[11px] text-on-surface-variant">Rev {d.rev || "—"}</span>
          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <a href={resolveUrl(d.path)} target="_blank" rel="noreferrer"
              className="p-1.5 rounded-lg hover:bg-surface-container text-on-surface-variant hover:text-primary transition-colors" title="View">
              <Eye size={13} />
            </a>
            <a href={resolveUrl(d.path)} download={filename}
              className="p-1.5 rounded-lg hover:bg-surface-container text-on-surface-variant hover:text-primary transition-colors" title="Download">
              <Download size={13} />
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────────── DocumentsView ─────────────────────────── */
export default function DocumentsView({
  drawings,
  onUpload,
  projects      = [],
  activeProject,
  onProjectChange,
  transmittals  = [],
  isProjectTeam = false,
}) {
  const [tree,          setTree]          = useState(loadTree);
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

  const addInputRef    = useRef(null);
  const renameInputRef = useRef(null);
  const subInputRef    = useRef(null);

  useEffect(() => { if (addingFolder)         addInputRef.current?.focus();    }, [addingFolder]);
  useEffect(() => { if (renamingIdx !== null)  renameInputRef.current?.focus(); }, [renamingIdx]);
  useEffect(() => { if (addingSubIdx !== null) subInputRef.current?.focus();    }, [addingSubIdx]);

  const updateTree = updater => {
    setTree(prev => {
      const next = updater(structuredClone(prev));
      saveTree(next);
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

  const renameFolder = idx => {
    const name = renameVal.trim();
    if (!name) { setRenamingIdx(null); return; }
    updateTree(next => {
      getNode(next, segments).children[idx].name = name;
      return next;
    });
    setRenamingIdx(null);
  };

  const deleteFolder = idx => {
    updateTree(next => {
      getNode(next, segments).children.splice(idx, 1);
      return next;
    });
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

  /* ── Local search — preserves originalIdx for all CRUD ops ── */
  const filteredSubfolderEntries = subfolders
    .map((child, originalIdx) => ({ child, originalIdx }))
    .filter(({ child }) =>
      !localSearch || child.name.toLowerCase().includes(localSearch.toLowerCase())
    );

  const filteredFiles = currentFiles.filter(d => {
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
  });

  const searchActive = localSearch.length > 0;
  const noResults    = searchActive && filteredSubfolderEntries.length === 0 && filteredFiles.length === 0 && !addingFolder;
  const actualEmpty  = !searchActive && subfolders.length === 0 && currentFiles.length === 0 && !addingFolder;

  /* ── Folder summary line ── */
  const folderWord  = subfolders.length === 1 ? "folder"  : "folders";
  const drawingWord = currentFiles.length === 1 ? "drawing" : "drawings";
  const summaryLine = `${subfolders.length} ${folderWord} · ${currentFiles.length} ${drawingWord} in this location`;

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

      {/* ── Single page title ── */}
      <div>
        <h1 className="text-headline-lg font-semibold text-on-surface">Documents</h1>
        <p className="text-body-md text-on-surface-variant mt-0.5">
          Organize drawings, folders, revisions, and files.
        </p>
      </div>

      {/* ── Content card ── */}
      <div className="bg-white border border-border-slate rounded-xl overflow-hidden">

        {/* Card header: breadcrumb (left) + toolbar (right) */}
        <div className="flex items-center gap-3 px-5 py-3 border-b border-border-slate flex-wrap gap-y-2">

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

          {/* Toolbar: search + view toggle + New Folder + Upload Here */}
          <div className="flex items-center gap-2 shrink-0 flex-wrap">

            {/* Local search */}
            <div className="relative">
              <Search
                size={13}
                className="absolute left-2.5 top-1/2 -translate-y-1/2 text-on-surface-variant pointer-events-none"
              />
              <input
                type="text"
                value={localSearch}
                onChange={e => setLocalSearch(e.target.value)}
                placeholder="Search in this folder…"
                className="pl-8 pr-7 py-1.5 text-[12px] w-[200px] bg-surface-container-low border border-border-slate rounded-lg text-on-surface placeholder:text-on-surface-variant focus:outline-none focus:ring-1 focus:ring-primary/20 focus:border-primary transition-all"
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
            <button
              onClick={() => setAddingFolder(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border-slate bg-white hover:bg-surface-container text-[12px] font-medium text-on-surface-variant transition-colors shrink-0"
            >
              <FolderPlus size={13} />
              New Folder
            </button>

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
                  <p className="text-[11px] font-semibold text-on-surface-variant uppercase tracking-wider">
                    Folders
                  </p>
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
                  {/* Render filtered folders using originalIdx for all CRUD ops */}
                  {filteredSubfolderEntries.map(({ child, originalIdx }) => {
                    const childPath = `${currentFolderPath}/${child.name}`;
                    const fileCount = countFilesUnder(child, childPath);

                    /* Delete confirmation */
                    if (confirmDelIdx === originalIdx) {
                      return (
                        <div key={originalIdx} className="flex items-center gap-2 bg-status-rose-bg border border-status-rose-text/30 rounded-xl px-4 py-3">
                          <Trash2 size={14} className="text-status-rose-text shrink-0" />
                          <p className="flex-1 text-[12px] font-medium text-status-rose-text">Delete "{child.name}"?</p>
                          <button
                            onClick={() => { deleteFolder(originalIdx); setConfirmDelIdx(null); }}
                            className="px-2.5 py-1 rounded-lg bg-status-rose-text text-white text-[11px] font-semibold hover:opacity-90 transition-opacity"
                          >
                            Delete
                          </button>
                          <button
                            onClick={() => setConfirmDelIdx(null)}
                            className="px-2.5 py-1 rounded-lg border border-status-rose-text/30 text-status-rose-text text-[11px] font-medium hover:bg-status-rose-text/10 transition-colors"
                          >
                            Cancel
                          </button>
                        </div>
                      );
                    }

                    /* Rename inline */
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

                    /* Add subfolder inline */
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
                        onAdd={() => { setAddingSubIdx(originalIdx); setNewSubVal(""); }}
                        onRename={() => { setRenamingIdx(originalIdx); setRenameVal(child.name); }}
                        onDelete={() => setConfirmDelIdx(originalIdx)}
                      />
                    );
                  })}

                  {/* New folder input — always shown at end when active */}
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
                    {filteredFiles.map(d => <FileCard key={d.id} d={d} viewMode="grid" />)}
                  </div>
                ) : (
                  <div className="space-y-0.5">
                    {filteredFiles.map(d => <FileCard key={d.id} d={d} viewMode="list" />)}
                  </div>
                )}
              </div>
            )}

            {/* Drawings in this folder that have no uploaded file yet */}
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
    </div>
  );
}
