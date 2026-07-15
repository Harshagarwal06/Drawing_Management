import { useState, useRef, useEffect, useMemo } from "react";
import { createPortal } from "react-dom";
import {
  Folder, FolderOpen, ChevronRight, ChevronDown, Home, LayoutGrid, List,
  FolderPlus, Check, X, Upload, Search, Layers, FileText, Send, Clock,
  Loader2,
} from "lucide-react";

import { countDescendants, projectDot } from "./documents/constants";
import FileCard from "./documents/FileCard";
import FolderCard from "./documents/FolderCard";
import EditMetadataModal from "./documents/EditMetadataModal";
import RenameModal from "./documents/RenameModal";
import MoveFolderModal from "./documents/MoveFolderModal";
import MoveFolderNodeModal from "./documents/MoveFolderNodeModal";
import NewRevisionModal from "./documents/NewRevisionModal";
import RevisionHistoryPanel from "./documents/RevisionHistoryPanel";
import ConfirmDeleteModal from "./documents/ConfirmDeleteModal";

const API = import.meta.env.VITE_API_URL;

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
  if (res.status === 404) return null;
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

/* ──────────────────────────── StatChip ─────────────────────────────── */
function StatChip({ label, value, Icon, colorCls }) {
  return (
    <div className="flex items-center gap-2 px-2.5 sm:px-3 py-2 rounded-lg bg-surface-container-low border border-border-slate w-[100px] sm:w-[118px] shrink-0">
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

/* ─────────────────────── ProjectWorkspaceBar ───────────────────────── */
function ProjectWorkspaceBar({
  activeProject, projects, onProjectChange,
  totalFolders, totalDrawings, totalTransmittals, pendingApprovals,
}) {
  const shortName = activeProject?.name?.split("—")[1]?.trim() ?? activeProject?.name ?? "No project selected";
  const activeIdx = Math.max(0, projects.findIndex(p => p.id === activeProject?.id));

  return (
    <div className="hidden md:block bg-white border border-border-slate rounded-xl px-5 py-3.5 shadow-sm">
      <div className="flex items-center gap-4 flex-wrap xl:flex-nowrap">
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

        <div className="flex items-center gap-2 overflow-x-auto pb-1 -mb-1 scrollbar-hide">
          <StatChip label="Folders"      value={totalFolders}      Icon={Layers}    colorCls="bg-primary/10 text-primary" />
          <StatChip label="Drawings"     value={totalDrawings}     Icon={FileText}  colorCls="bg-blue-50 text-blue-600" />
          <StatChip label="Transmittals" value={totalTransmittals} Icon={Send}      colorCls="bg-status-emerald-bg text-status-emerald-text" />
          <StatChip label="Pending"      value={pendingApprovals}  Icon={Clock}     colorCls={pendingApprovals > 0 ? "bg-status-amber-bg text-status-amber-text" : "bg-surface-container text-on-surface-variant"} />
        </div>

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
  const [treeProjectId, setTreeProjectId] = useState(null); // project whose tree has loaded
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

  const [confirmDeleteDrawing, setConfirmDeleteDrawing] = useState(null);
  const [deleteLoading,        setDeleteLoading]        = useState(false);

  const [editDrawing,     setEditDrawing]     = useState(null);
  const [renameDrawing,   setRenameDrawing]   = useState(null);
  const [moveDrawing,     setMoveDrawing]     = useState(null);
  const [revisionDrawing, setRevisionDrawing] = useState(null);
  const [historyDrawing,  setHistoryDrawing]  = useState(null);

  const [moveFolderIdx,   setMoveFolderIdx]   = useState(null);

  const [localToast, setLocalToast] = useState(null);

  const addInputRef    = useRef(null);
  const renameInputRef = useRef(null);
  const subInputRef    = useRef(null);

  useEffect(() => {
    if (!activeProject?.id || !token) return;
    fetchTree(activeProject.id, token)
      .then(saved => { setTree(saved ?? DEFAULT_TREE()); })
      .catch(() => { setTree(DEFAULT_TREE()); })
      .finally(() => { setSegments([]); setTreeProjectId(activeProject.id); });
  }, [activeProject?.id, token]);

  /* Loading is derived: true until the active project's tree has landed */
  const treeLoading = !activeProject?.id || !token || treeProjectId !== activeProject.id;

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

  const currentNode       = getNode(tree, segments);
  const subfolders        = currentNode?.children ?? [];
  const currentFolderPath = [tree.name, ...segments].join("/");
  const currentFiles      = drawings.filter(d => (d.folderPath || "") === currentFolderPath && d.path);

  // Pre-compute file counts per folder path (O(n) instead of O(n²))
  const folderFileCounts = useMemo(() => {
    const counts = {};
    for (const d of drawings) {
      if (!d.path) continue;
      const fp = d.folderPath || "";
      counts[fp] = (counts[fp] || 0) + 1;
    }
    return counts;
  }, [drawings]);

  const countFilesUnder = (node, basePath) => {
    let count = folderFileCounts[basePath] || 0;
    for (const child of node.children ?? [])
      count += countFilesUnder(child, `${basePath}/${child.name}`);
    return count;
  };

  const totalFolders     = countDescendants(tree);
  const pendingApprovals = drawings.filter(d => d.status === "S2").length;

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
    updateTree(next => {
      getNode(next, segments).children[idx].name = name;
      return next;
    });
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
    } catch {
      showToast("Network error updating folder files.", "error");
    }
    setRenamingIdx(null);
  };

  const deleteFolder = async idx => {
    const folderName = subfolders[idx].name;
    const folderPath = [tree.name, ...segments, folderName].join("/");
    const parentPath = [tree.name, ...segments].join("/");
    updateTree(next => {
      getNode(next, segments).children.splice(idx, 1);
      return next;
    });
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
    } catch {
      // silent
    }
  };

  const moveFolder = async (targetPath) => {
    const idx        = moveFolderIdx;
    const folderNode = subfolders[idx];
    const folderName = folderNode.name;
    const oldPath    = [tree.name, ...segments, folderName].join("/");
    const newPath    = targetPath + "/" + folderName;
    updateTree(next => {
      const parentNode = getNode(next, segments);
      const [moved]    = parentNode.children.splice(idx, 1);
      const targetSegs = targetPath.split("/").slice(1);
      const targetNode = getNode(next, targetSegs);
      if (!targetNode.children) targetNode.children = [];
      targetNode.children.push(moved);
      return next;
    });
    setMoveFolderIdx(null);
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
    } catch {
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

      <ProjectWorkspaceBar
        activeProject={activeProject}
        projects={projects}
        onProjectChange={onProjectChange}
        totalFolders={totalFolders}
        totalDrawings={drawings.length}
        totalTransmittals={transmittals.length}
        pendingApprovals={pendingApprovals}
      />

      <div className="hidden md:block">
        <h1 className="text-[22px] md:text-headline-lg font-semibold text-on-surface">Documents</h1>
        <p className="text-body-md text-on-surface-variant mt-0.5">
          Organize drawings, folders, revisions, and files.
        </p>
      </div>

      <div className="bg-white border border-border-slate rounded-xl overflow-hidden">

        {/* Card header: breadcrumb + toolbar */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-x-3 gap-y-2 px-5 py-3 border-b border-border-slate flex-wrap">
          <nav className="flex items-center gap-1 flex-1 min-w-0 flex-wrap">
            <button onClick={navigateRoot} className="mobile-touch-target grid place-items-center rounded-md text-on-surface-variant hover:text-primary hover:bg-surface-container transition-colors shrink-0" title="Root" aria-label="Go to root folder">
              <Home size={14} />
            </button>
            <ChevronRight size={13} className="text-outline shrink-0" />
            <button
              onClick={navigateRoot}
              className={`min-h-11 px-1.5 py-0.5 rounded text-[12px] font-medium transition-colors leading-none whitespace-nowrap ${
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
                    className={`min-h-11 px-1.5 py-0.5 rounded text-[12px] font-medium transition-colors leading-none whitespace-nowrap ${
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

          <div className="flex items-center gap-2 flex-wrap w-full sm:w-auto">
            <div className="relative flex-1 sm:flex-none">
              <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-on-surface-variant pointer-events-none" />
              <input
                type="text"
                value={localSearch}
                onChange={e => setLocalSearch(e.target.value)}
                placeholder="Search in this folder…"
                className="min-h-11 pl-9 pr-11 py-2 text-[12px] w-full sm:w-[220px] bg-surface-container-low border border-border-slate rounded-lg text-on-surface placeholder:text-on-surface-variant focus:outline-none focus:ring-1 focus:ring-primary/20 focus:border-primary transition-colors"
              />
              {localSearch && (
                <button onClick={() => setLocalSearch("")} className="absolute right-0 top-1/2 -translate-y-1/2 mobile-touch-target grid place-items-center text-on-surface-variant hover:text-on-surface transition-colors" aria-label="Clear search">
                  <X size={12} />
                </button>
              )}
            </div>

            <div className="flex items-center bg-surface-container-low border border-border-slate rounded-lg p-0.5 shrink-0">
              <button
                onClick={() => setViewMode("grid")}
                className={`mobile-touch-target grid place-items-center rounded-md transition-colors ${viewMode === "grid" ? "bg-white shadow-sm text-primary" : "text-on-surface-variant hover:text-on-surface"}`}
                title="Grid view"
                aria-label="Grid view"
              >
                <LayoutGrid size={14} />
              </button>
              <button
                onClick={() => setViewMode("list")}
                className={`mobile-touch-target grid place-items-center rounded-md transition-colors ${viewMode === "list" ? "bg-white shadow-sm text-primary" : "text-on-surface-variant hover:text-on-surface"}`}
                title="List view"
                aria-label="List view"
              >
                <List size={14} />
              </button>
            </div>

            {!isProjectTeam && (
              <button
                onClick={() => setAddingFolder(true)}
                className="min-h-11 min-w-11 flex items-center gap-1.5 px-3 py-2 rounded-lg border border-border-slate bg-white hover:bg-surface-container text-[12px] font-medium text-on-surface-variant transition-colors shrink-0"
                title="New Folder"
              >
                <FolderPlus size={13} />
                <span className="hidden sm:inline">New Folder</span>
              </button>
            )}

            {onUpload && (
              <button
                onClick={() => onUpload(currentFolderPath)}
                className="min-h-11 min-w-11 flex items-center gap-1.5 px-3 py-2 rounded-lg bg-primary text-white hover:bg-primary-container text-[12px] font-medium shadow-sm transition-colors shrink-0"
                title="Upload Here"
              >
                <Upload size={13} />
                <span className="hidden sm:inline">Upload Here</span>
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
              <button onClick={() => setLocalSearch("")} className="text-[13px] font-medium text-primary hover:underline">
                Clear search
              </button>
            )}
          </div>
        ) : (
          <div className="p-3 sm:p-5 space-y-6">

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
                          <Folder size={14} className="text-status-rose-text shrink-0" />
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
                          <button onClick={() => renameFolder(originalIdx)} className="mobile-touch-target grid place-items-center text-primary" aria-label="Save folder name"><Check size={16} /></button>
                          <button onClick={() => setRenamingIdx(null)} className="mobile-touch-target grid place-items-center text-on-surface-variant" aria-label="Cancel folder rename"><X size={16} /></button>
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
                          <button onClick={() => commitSubfolder(originalIdx)} className="mobile-touch-target grid place-items-center text-primary" aria-label="Create subfolder"><Check size={16} /></button>
                          <button onClick={() => { setAddingSubIdx(null); setNewSubVal(""); }} className="mobile-touch-target grid place-items-center text-on-surface-variant" aria-label="Cancel subfolder"><X size={16} /></button>
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
                      <button onClick={addFolder} className="mobile-touch-target grid place-items-center text-primary" aria-label="Create folder"><Check size={16} /></button>
                      <button onClick={() => { setAddingFolder(false); setNewFolderVal(""); }} className="mobile-touch-target grid place-items-center text-on-surface-variant" aria-label="Cancel new folder"><X size={16} /></button>
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

      {/* ── Modals ── */}
      {confirmDeleteDrawing && (
        <ConfirmDeleteModal
          drawing={confirmDeleteDrawing}
          loading={deleteLoading}
          onConfirm={handleDeleteConfirm}
          onCancel={() => !deleteLoading && setConfirmDeleteDrawing(null)}
        />
      )}

      {editDrawing && (
        <EditMetadataModal
          drawing={editDrawing}
          token={token}
          onSuccess={handleDrawingUpdated}
          onClose={() => setEditDrawing(null)}
        />
      )}

      {renameDrawing && (
        <RenameModal
          drawing={renameDrawing}
          token={token}
          onSuccess={handleDrawingUpdated}
          onClose={() => setRenameDrawing(null)}
        />
      )}

      {moveDrawing && (
        <MoveFolderModal
          drawing={moveDrawing}
          token={token}
          tree={tree}
          onSuccess={handleDrawingUpdated}
          onClose={() => setMoveDrawing(null)}
        />
      )}

      {moveFolderIdx !== null && subfolders[moveFolderIdx] && (
        <MoveFolderNodeModal
          folderName={subfolders[moveFolderIdx].name}
          folderPath={[tree.name, ...segments, subfolders[moveFolderIdx].name].join("/")}
          tree={tree}
          onConfirm={moveFolder}
          onClose={() => setMoveFolderIdx(null)}
        />
      )}

      {revisionDrawing && (
        <NewRevisionModal
          drawing={revisionDrawing}
          token={token}
          projectId={activeProject?.id}
          onSuccess={handleDrawingUpdated}
          onClose={() => setRevisionDrawing(null)}
        />
      )}

      {historyDrawing && (
        <RevisionHistoryPanel
          drawing={historyDrawing}
          token={token}
          onClose={() => setHistoryDrawing(null)}
        />
      )}

      {/* ── Local toast ── */}
      {localToast && createPortal(
        <div className={`fixed bottom-[calc(5rem+env(safe-area-inset-bottom,0px))] md:bottom-6 left-1/2 -translate-x-1/2 z-[500] max-w-[calc(100%-2rem)] px-5 py-3 rounded-xl shadow-xl text-[13px] font-medium flex items-center gap-2 border ${
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
