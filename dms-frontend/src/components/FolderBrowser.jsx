import { useState, useCallback, useRef, useEffect } from "react";
import {
  ChevronRight, ChevronDown, Folder, FolderOpen,
  FolderPlus, Search, LayoutGrid, Pencil, Trash2,
  Check, X, MoreVertical,
} from "lucide-react";

const DEFAULT_TREE = () => ({
  name: "Project",
  children: [
    {
      name: "Architecture",
      children: [
        { name: "Building", children: [] },
        { name: "Infra",    children: [] },
        { name: "Views",    children: [] },
      ],
    },
    {
      name: "Structural",
      children: [
        { name: "Infra",    children: [] },
        { name: "Building", children: [] },
      ],
    },
    {
      name: "MEP",
      children: [
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

const STORAGE_KEY = "uniqueproperties_folder_tree";

function loadTree() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) return JSON.parse(saved);
  } catch {}
  return DEFAULT_TREE();
}

/* ── FolderRowMenu — MoreVertical dropdown for a single folder row ── */
function FolderRowMenu({ pathKey, isRoot, onAdd, onRename, onDelete }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return;
    const close = e => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);

  return (
    <div ref={ref} className="relative shrink-0" onClick={e => e.stopPropagation()}>
      <button
        onClick={e => { e.stopPropagation(); setOpen(o => !o); }}
        className="p-0.5 rounded text-outline hover:text-on-surface hover:bg-surface-container transition-colors opacity-0 group-hover:opacity-100 focus:opacity-100"
        title="Folder options"
      >
        <MoreVertical size={13} />
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1 w-44 bg-white border border-border-slate rounded-xl shadow-lg z-50 py-1 overflow-hidden">
          <FolderMenuItem
            icon={<FolderPlus size={13} />}
            label="Add subfolder"
            onClick={() => { onAdd(); setOpen(false); }}
          />
          {!isRoot && (
            <>
              <FolderMenuItem
                icon={<Pencil size={13} />}
                label="Rename"
                onClick={() => { onRename(); setOpen(false); }}
              />
              <div className="h-px bg-border-slate mx-2 my-1" />
              <FolderMenuItem
                icon={<Trash2 size={13} />}
                label="Delete folder"
                onClick={() => { onDelete(); setOpen(false); }}
                danger
              />
            </>
          )}
        </div>
      )}
    </div>
  );
}

function FolderMenuItem({ icon, label, onClick, danger = false }) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-2 px-3 py-2 text-[12px] font-medium transition-colors ${
        danger
          ? "text-status-rose-text hover:bg-status-rose-bg"
          : "text-on-surface-variant hover:text-on-surface hover:bg-surface-container-low"
      }`}
    >
      {icon}
      {label}
    </button>
  );
}

/* ── TreeNode ─────────────────────────────────────────────────────── */
function TreeNode({
  node, depth, path, namePath,
  selectedPath, onSelect,
  addingTo, setAddingTo,
  editingPath, setEditingPath,
  onAddChild, onRename, onDelete,
  drawings,
}) {
  const [open, setOpen] = useState(depth < 2);
  const addInputRef  = useRef(null);
  const editInputRef = useRef(null);

  const pathKey      = namePath.join("/");
  const hasChildren  = node.children?.length > 0;
  const isSelected   = selectedPath === pathKey;
  const isAddingHere = addingTo === pathKey;
  const isEditing    = editingPath === pathKey;
  const isRoot       = depth === 0;
  const fileCount    = drawings.filter(d => d.folderPath === pathKey).length;

  useEffect(() => { if (isAddingHere) addInputRef.current?.focus(); }, [isAddingHere]);
  useEffect(() => {
    if (isEditing) { editInputRef.current?.focus(); editInputRef.current?.select(); }
  }, [isEditing]);

  const handleClick = () => {
    if (isEditing) return;
    onSelect(pathKey);
    if (node.children !== undefined) setOpen(o => !o);
  };

  const handleAddSubmit = e => {
    e?.preventDefault();
    const val = addInputRef.current?.value?.trim();
    if (val) { onAddChild(path, val); if (!open) setOpen(true); }
    setAddingTo(null);
  };

  const handleRenameSubmit = e => {
    e?.preventDefault();
    const val = editInputRef.current?.value?.trim();
    if (val && val !== node.name) onRename(path, val);
    setEditingPath(null);
  };

  return (
    <div className="select-none">
      {/* Row */}
      <div
        role="button"
        tabIndex={0}
        onClick={handleClick}
        onKeyDown={e => { if (!isEditing && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); handleClick(); } }}
        className={`
          group flex items-center gap-1.5 w-full rounded-lg px-2 py-[6px]
          cursor-pointer transition-all duration-150
          ${isSelected ? "bg-primary/10 text-primary" : "hover:bg-surface-container text-on-surface-variant"}
          ${isRoot ? "text-[13px] font-semibold text-on-surface" : "text-[12.5px] font-medium"}
        `}
        style={{ paddingLeft: `${depth * 18 + 8}px` }}
      >
        {/* Chevron */}
        <span className="w-4 h-4 flex items-center justify-center shrink-0">
          {node.children !== undefined ? (
            open
              ? <ChevronDown  size={14} className="text-on-surface-variant" />
              : <ChevronRight size={14} className="text-outline" />
          ) : <span className="w-3.5" />}
        </span>

        {/* Folder icon */}
        {open && hasChildren
          ? <FolderOpen size={15} className="text-primary shrink-0" />
          : <Folder     size={15} className={`shrink-0 ${isSelected ? "text-primary" : "text-on-surface-variant"}`} />
        }

        {/* Label or rename input */}
        {isEditing ? (
          <form onSubmit={handleRenameSubmit} className="flex-1 flex items-center gap-1 min-w-0" onClick={e => e.stopPropagation()}>
            <input
              ref={editInputRef}
              defaultValue={node.name}
              className="flex-1 min-w-0 bg-white border border-primary rounded px-1.5 py-0.5 text-[12px] text-on-surface outline-none focus:ring-1 focus:ring-primary/20"
              onBlur={handleRenameSubmit}
              onKeyDown={e => { if (e.key === "Escape") setEditingPath(null); }}
            />
            <button type="submit" className="p-0.5 text-primary"><Check size={12} /></button>
            <button type="button" onClick={e => { e.stopPropagation(); setEditingPath(null); }} className="p-0.5 text-on-surface-variant"><X size={12} /></button>
          </form>
        ) : (
          <span className="truncate leading-tight flex-1">{node.name}</span>
        )}

        {/* File count badge */}
        {!isEditing && fileCount > 0 && (
          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-primary/10 text-primary ml-0.5 shrink-0 tabular-nums">
            {fileCount}
          </span>
        )}

        {/* MoreVertical menu — replaces individual icon buttons */}
        {!isEditing && (
          <FolderRowMenu
            pathKey={pathKey}
            isRoot={isRoot}
            onAdd={() => { setAddingTo(pathKey); setOpen(true); }}
            onRename={() => setEditingPath(pathKey)}
            onDelete={() => onDelete(path)}
          />
        )}
      </div>

      {/* Inline add-child input */}
      {isAddingHere && (
        <form
          onSubmit={handleAddSubmit}
          className="flex items-center gap-1.5 pr-2 mb-0.5"
          style={{ paddingLeft: `${(depth + 1) * 18 + 16}px` }}
          onClick={e => e.stopPropagation()}
        >
          <FolderPlus size={13} className="text-primary shrink-0" />
          <input
            ref={addInputRef}
            placeholder="Folder name…"
            className="flex-1 min-w-0 bg-white border border-primary rounded-lg px-2 py-1 text-[12px] text-on-surface outline-none focus:ring-1 focus:ring-primary/20"
            onBlur={handleAddSubmit}
            onKeyDown={e => { if (e.key === "Escape") { e.preventDefault(); setAddingTo(null); } }}
          />
        </form>
      )}

      {/* Children */}
      <div className={`overflow-hidden transition-all duration-200 ease-in-out ${open ? "max-h-[2000px] opacity-100" : "max-h-0 opacity-0"}`}>
        {node.children?.map((child, idx) => (
          <TreeNode
            key={`${child.name}-${idx}`}
            node={child}
            depth={depth + 1}
            path={[...path, idx]}
            namePath={[...namePath, child.name]}
            selectedPath={selectedPath}
            onSelect={onSelect}
            addingTo={addingTo}
            setAddingTo={setAddingTo}
            editingPath={editingPath}
            setEditingPath={setEditingPath}
            onAddChild={onAddChild}
            onRename={onRename}
            onDelete={onDelete}
            drawings={drawings}
          />
        ))}
      </div>
    </div>
  );
}

/* ── FolderBrowser ────────────────────────────────────────────────── */
export default function FolderBrowser({ className = "", onFolderSelect, drawings = [] }) {
  const [tree,         setTree]         = useState(loadTree);
  const [selectedPath, setSelectedPath] = useState("");
  const [filterText,   setFilterText]   = useState("");
  const [addingTo,     setAddingTo]     = useState(null);
  const [editingPath,  setEditingPath]  = useState(null);

  const updateTree = useCallback(updater => {
    setTree(prev => {
      const next = updater(prev);
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); } catch {}
      return next;
    });
  }, []);

  const addChild = useCallback((path, label) => {
    updateTree(prev => {
      const next = structuredClone(prev);
      let cursor = next;
      for (const idx of path) cursor = cursor.children[idx];
      if (!cursor.children) cursor.children = [];
      if (cursor.children.some(c => c.name === label)) return prev;
      cursor.children.push({ name: label, children: [] });
      return next;
    });
  }, [updateTree]);

  const renameNode = useCallback((path, newName) => {
    updateTree(prev => {
      const next = structuredClone(prev);
      let cursor = next;
      for (const idx of path) cursor = cursor.children[idx];
      cursor.name = newName;
      return next;
    });
  }, [updateTree]);

  const deleteNode = useCallback(path => {
    updateTree(prev => {
      const next = structuredClone(prev);
      let parent = next;
      for (let i = 0; i < path.length - 1; i++) parent = parent.children[path[i]];
      parent.children.splice(path[path.length - 1], 1);
      return next;
    });
  }, [updateTree]);

  const handleSelect = useCallback(pathKey => {
    setSelectedPath(pathKey);
    onFolderSelect?.(pathKey);
  }, [onFolderSelect]);

  return (
    <div className={`flex flex-col bg-white border border-border-slate rounded-xl overflow-hidden h-full ${className}`}>

      {/* Header */}
      <div className="flex items-center justify-between px-4 pt-4 pb-2">
        <div className="flex items-center gap-2">
          <LayoutGrid size={15} className="text-primary" />
          <h2 className="text-[13px] font-bold tracking-wide text-on-surface uppercase">Explorer</h2>
        </div>
        <span className="text-[10px] text-outline font-mono">{countNodes(tree)} items</span>
      </div>

      {/* Search */}
      <div className="px-3 pb-2">
        <div className="relative">
          <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-outline" />
          <input
            type="text"
            placeholder="Filter folders…"
            value={filterText}
            onChange={e => setFilterText(e.target.value)}
            className="w-full pl-7 pr-3 py-1.5 bg-surface-container-low border border-border-slate rounded-lg text-[11.5px] text-on-surface placeholder:text-on-surface-variant focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/20 transition-all"
          />
        </div>
      </div>

      <div className="h-px bg-border-slate mx-3" />

      {/* Tree */}
      <div className="flex-1 overflow-y-auto px-1 py-2 folder-scrollbar">
        <TreeNode
          node={tree}
          depth={0}
          path={[]}
          namePath={[tree.name]}
          selectedPath={selectedPath}
          onSelect={handleSelect}
          addingTo={addingTo}
          setAddingTo={setAddingTo}
          editingPath={editingPath}
          setEditingPath={setEditingPath}
          onAddChild={addChild}
          onRename={renameNode}
          onDelete={deleteNode}
          drawings={drawings}
        />
      </div>

      <style>{`
        .folder-scrollbar::-webkit-scrollbar { width: 4px; }
        .folder-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .folder-scrollbar::-webkit-scrollbar-thumb { background: #E2E8F0; border-radius: 4px; }
        .folder-scrollbar::-webkit-scrollbar-thumb:hover { background: #CBD5E1; }
      `}</style>
    </div>
  );
}

function countNodes(node) {
  if (!node) return 0;
  let count = 1;
  if (node.children) for (const child of node.children) count += countNodes(child);
  return count;
}
