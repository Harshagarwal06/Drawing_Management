import { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import {
  Folder, FolderOpen, ChevronRight, Home, LayoutGrid, List,
  MoreVertical, FolderPlus, Pencil, Trash2, Eye, Download,
  Check, X, FileText, Upload,
} from "lucide-react";

const API          = import.meta.env.VITE_API_URL;
const STORAGE_KEY  = "uniqueproperties_folder_tree";

/* ─────────────────────────── helpers ─────────────────────────── */
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

/** Walk the tree along `segments` (relative to root) and return that node */
function getNode(tree, segments) {
  let node = tree;
  for (const seg of segments) {
    const child = node.children?.find(c => c.name === seg);
    if (!child) return null;
    node = child;
  }
  return node;
}

/** Count total descendant nodes */
function countDescendants(node) {
  let n = 0;
  for (const c of node.children ?? []) n += 1 + countDescendants(c);
  return n;
}

const STATUS_PILL  = {
  S3: "bg-status-emerald-bg text-status-emerald-text",
  S2: "bg-status-amber-bg   text-status-amber-text",
  S1: "bg-blue-50           text-blue-700",
  VOID: "bg-status-rose-bg  text-status-rose-text",
};
const STATUS_LABEL = {
  S3: "For Construction", S2: "For Approval", S1: "For Information", VOID: "Void",
};
const EXT_STYLE = {
  PDF: "bg-red-50   text-red-600",
  DWG: "bg-blue-50  text-blue-700",
  DXF: "bg-indigo-50 text-indigo-600",
  IFC: "bg-purple-50 text-purple-600",
  RVT: "bg-orange-50 text-orange-600",
};

/* ─────────────────────────── FolderMenu ──────────────────────── */
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

/* ─────────────────────────── FolderCard ─────────────────────── */
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

/* ─────────────────────────── FileCard ───────────────────────── */
function FileCard({ d, viewMode }) {
  const filename = d.path?.split("/").pop() ?? "";
  const ext      = filename.split(".").pop().toUpperCase();
  const extStyle = EXT_STYLE[ext] ?? "bg-surface-container text-on-surface-variant";
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
          <a href={`${API}${d.path}`} target="_blank" rel="noreferrer"
            onClick={e => e.stopPropagation()}
            className="p-1.5 rounded-lg hover:bg-surface-container-low text-on-surface-variant hover:text-primary transition-colors" title="View">
            <Eye size={14} />
          </a>
          <a href={`${API}${d.path}`} download={filename}
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
      {/* Top colour band */}
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
            <a href={`${API}${d.path}`} target="_blank" rel="noreferrer"
              className="p-1.5 rounded-lg hover:bg-surface-container text-on-surface-variant hover:text-primary transition-colors" title="View">
              <Eye size={13} />
            </a>
            <a href={`${API}${d.path}`} download={filename}
              className="p-1.5 rounded-lg hover:bg-surface-container text-on-surface-variant hover:text-primary transition-colors" title="Download">
              <Download size={13} />
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────────── DocumentsView ──────────────────── */
export default function DocumentsView({ drawings, onUpload }) {
  const [tree,         setTree]         = useState(loadTree);
  const [segments,     setSegments]     = useState([]);   // path below root
  const [viewMode,     setViewMode]     = useState("grid");
  const [renamingIdx,  setRenamingIdx]  = useState(null); // child index being renamed
  const [renameVal,    setRenameVal]    = useState("");
  const [addingFolder, setAddingFolder] = useState(false);
  const [newFolderVal, setNewFolderVal] = useState("");
  const addInputRef    = useRef(null);
  const renameInputRef = useRef(null);

  useEffect(() => { if (addingFolder)   addInputRef.current?.focus();   }, [addingFolder]);
  useEffect(() => { if (renamingIdx !== null) renameInputRef.current?.focus(); }, [renamingIdx]);

  const updateTree = updater => {
    setTree(prev => {
      const next = updater(structuredClone(prev));
      saveTree(next);
      return next;
    });
  };

  /** Get the current node in the tree */
  const currentNode = getNode(tree, segments);
  const subfolders  = currentNode?.children ?? [];

  /** Full folder path string for the current location (matches drawing.folderPath) */
  const currentFolderPath = [tree.name, ...segments].join("/");

  /** Files whose folderPath matches exactly this level */
  const currentFiles = drawings.filter(d => (d.folderPath || "") === currentFolderPath && d.path);

  /** Count files anywhere under a subfolder (recursive) */
  const countFilesUnder = (node, basePath) => {
    const nodePath = basePath;
    let count = drawings.filter(d => (d.folderPath || "") === nodePath && d.path).length;
    for (const child of node.children ?? []) {
      count += countFilesUnder(child, `${basePath}/${child.name}`);
    }
    return count;
  };

  /* ── Navigation ── */
  const navigateInto = name => setSegments(s => [...s, name]);
  const navigateTo   = idx  => setSegments(s => s.slice(0, idx));

  /* ── Folder CRUD (operates on currentNode's children) ── */
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
      const node = getNode(next, segments);
      node.children[idx].name = name;
      return next;
    });
    setRenamingIdx(null);
  };

  const deleteFolder = idx => {
    updateTree(next => {
      const node = getNode(next, segments);
      node.children.splice(idx, 1);
      return next;
    });
  };

  const addSubfolder = (childIdx, name) => {
    if (!name) return;
    updateTree(next => {
      const node = getNode(next, segments);
      const child = node.children[childIdx];
      if (!child.children) child.children = [];
      if (!child.children.some(c => c.name === name))
        child.children.push({ name, children: [] });
      return next;
    });
  };

  const isEmpty = subfolders.length === 0 && currentFiles.length === 0;

  return (
    <div className="max-w-[1400px] mx-auto space-y-4">

      {/* ── Page header ── */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-headline-lg font-semibold text-on-surface">Documents</h1>
          <p className="text-body-md text-on-surface-variant mt-0.5">Browse your project drawing files</p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {/* View toggle */}
          <div className="flex items-center bg-surface-container-low border border-border-slate rounded-lg p-0.5">
            <button
              onClick={() => setViewMode("grid")}
              className={`p-1.5 rounded-md transition-colors ${viewMode === "grid" ? "bg-white shadow-sm text-primary" : "text-on-surface-variant hover:text-on-surface"}`}
              title="Grid view"
            >
              <LayoutGrid size={15} />
            </button>
            <button
              onClick={() => setViewMode("list")}
              className={`p-1.5 rounded-md transition-colors ${viewMode === "list" ? "bg-white shadow-sm text-primary" : "text-on-surface-variant hover:text-on-surface"}`}
              title="List view"
            >
              <List size={15} />
            </button>
          </div>

          {/* New folder */}
          <button
            onClick={() => setAddingFolder(true)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-border-slate hover:bg-surface-container text-[13px] font-medium text-on-surface-variant transition-colors"
          >
            <FolderPlus size={15} />
            New Folder
          </button>

          {/* Upload */}
          {onUpload && (
            <button
              onClick={() => onUpload(currentFolderPath)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-primary text-white hover:bg-primary-container text-[13px] font-medium shadow-sm transition-all active:scale-[0.98]"
            >
              <Upload size={15} />
              Upload Here
            </button>
          )}
        </div>
      </div>

      {/* ── Breadcrumb ── */}
      <nav className="flex items-center gap-1 flex-wrap">
        <button
          onClick={() => setSegments([])}
          className={`flex items-center gap-1 px-2 py-1 rounded-lg text-[13px] font-medium transition-colors ${
            segments.length === 0
              ? "text-primary bg-primary/8"
              : "text-on-surface-variant hover:text-on-surface hover:bg-surface-container"
          }`}
        >
          <Home size={14} />
          {tree.name}
        </button>

        {segments.map((seg, i) => (
          <div key={i} className="flex items-center gap-1">
            <ChevronRight size={14} className="text-outline shrink-0" />
            <button
              onClick={() => navigateTo(i + 1)}
              className={`px-2 py-1 rounded-lg text-[13px] font-medium transition-colors ${
                i === segments.length - 1
                  ? "text-primary bg-primary/8"
                  : "text-on-surface-variant hover:text-on-surface hover:bg-surface-container"
              }`}
            >
              {seg}
            </button>
          </div>
        ))}
      </nav>

      {/* ── Content card ── */}
      <div className="bg-white border border-border-slate rounded-xl overflow-hidden">

        {isEmpty && !addingFolder ? (
          <div className="flex flex-col items-center justify-center h-64 gap-3 text-on-surface-variant">
            <div className="w-16 h-16 rounded-2xl bg-surface-container-low flex items-center justify-center">
              <FolderOpen size={32} className="text-outline" />
            </div>
            <p className="text-[15px] font-semibold text-on-surface">This folder is empty</p>
            <p className="text-[13px] text-on-surface-variant">Create a subfolder or upload drawings here</p>
          </div>
        ) : (
          <div className="p-5 space-y-6">

            {/* ── Folders section ── */}
            {(subfolders.length > 0 || addingFolder) && (
              <div>
                <p className="text-[11px] font-semibold text-on-surface-variant uppercase tracking-wider mb-3">
                  Folders
                </p>

                <div className={viewMode === "grid"
                  ? "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3"
                  : "space-y-0.5"
                }>
                  {subfolders.map((child, idx) => {
                    const childPath = `${currentFolderPath}/${child.name}`;
                    const fileCount = countFilesUnder(child, childPath);

                    if (renamingIdx === idx) {
                      return (
                        <div key={idx}
                          className="flex items-center gap-2 bg-surface-container-low border border-primary rounded-xl px-4 py-3"
                        >
                          <Folder size={16} className="text-primary shrink-0" />
                          <input
                            ref={renameInputRef}
                            value={renameVal}
                            onChange={e => setRenameVal(e.target.value)}
                            onBlur={() => renameFolder(idx)}
                            onKeyDown={e => {
                              if (e.key === "Enter") renameFolder(idx);
                              if (e.key === "Escape") setRenamingIdx(null);
                            }}
                            className="flex-1 bg-transparent text-[13px] font-medium text-on-surface outline-none"
                          />
                          <button onClick={() => renameFolder(idx)} className="p-0.5 text-primary"><Check size={13} /></button>
                          <button onClick={() => setRenamingIdx(null)} className="p-0.5 text-on-surface-variant"><X size={13} /></button>
                        </div>
                      );
                    }

                    return (
                      <FolderCard
                        key={idx}
                        node={child}
                        fileCount={fileCount}
                        viewMode={viewMode}
                        onClick={() => navigateInto(child.name)}
                        onAdd={() => {
                          const name = window.prompt(`New subfolder inside "${child.name}":`);
                          if (name?.trim()) addSubfolder(idx, name.trim());
                        }}
                        onRename={() => { setRenamingIdx(idx); setRenameVal(child.name); }}
                        onDelete={() => deleteFolder(idx)}
                      />
                    );
                  })}

                  {/* Inline new folder input */}
                  {addingFolder && (
                    <div className={`flex items-center gap-2 border border-primary rounded-xl px-4 py-3 bg-primary/5 ${viewMode === "list" ? "" : ""}`}>
                      <Folder size={16} className="text-primary shrink-0" />
                      <input
                        ref={addInputRef}
                        value={newFolderVal}
                        onChange={e => setNewFolderVal(e.target.value)}
                        placeholder="Folder name…"
                        onBlur={addFolder}
                        onKeyDown={e => {
                          if (e.key === "Enter") addFolder();
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
            {currentFiles.length > 0 && (
              <div>
                <p className="text-[11px] font-semibold text-on-surface-variant uppercase tracking-wider mb-3">
                  Files — {currentFiles.length}
                </p>

                {viewMode === "grid" ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                    {currentFiles.map(d => <FileCard key={d.id} d={d} viewMode="grid" />)}
                  </div>
                ) : (
                  <div className="space-y-0.5">
                    {currentFiles.map(d => <FileCard key={d.id} d={d} viewMode="list" />)}
                  </div>
                )}
              </div>
            )}

            {/* Files exist here but have no uploaded file */}
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
