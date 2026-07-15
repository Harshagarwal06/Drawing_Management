import { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { MoreVertical, FolderPlus, Pencil, FolderInput, Trash2 } from "lucide-react";

export default function FolderMenu({ onAdd, onRename, onMove, onDelete }) {
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
    const onKeyDown = event => { if (event.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", close);
    window.addEventListener("keydown", onKeyDown);
    return () => { document.removeEventListener("mousedown", close); window.removeEventListener("keydown", onKeyDown); };
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
        className="mobile-touch-target grid place-items-center rounded-lg hover:bg-surface-container transition-colors opacity-100 md:opacity-0 md:group-hover:opacity-100 md:group-focus-within:opacity-100 shrink-0"
        aria-label="Folder actions"
      >
        <MoreVertical size={14} className="text-on-surface-variant" />
      </button>

      {open && createPortal(
        <div
          ref={menuRef}
          style={{ position: "fixed", top: pos.top, left: pos.left }}
          className="z-[400] w-44 bg-white border border-border-slate rounded-xl shadow-lg py-1 overflow-hidden"
          onClick={e => e.stopPropagation()}
        >
          {onAdd && (
            <button onClick={() => { onAdd(); setOpen(false); }}
              className="w-full min-h-11 flex items-center gap-2 px-3 py-2 text-[12px] font-medium text-on-surface-variant hover:bg-surface-container-low transition-colors">
              <FolderPlus size={13} /> Add subfolder
            </button>
          )}
          {onRename && (
            <button onClick={() => { onRename(); setOpen(false); }}
              className="w-full min-h-11 flex items-center gap-2 px-3 py-2 text-[12px] font-medium text-on-surface-variant hover:bg-surface-container-low transition-colors">
              <Pencil size={13} /> Rename
            </button>
          )}
          {onMove && (
            <button onClick={() => { onMove(); setOpen(false); }}
              className="w-full min-h-11 flex items-center gap-2 px-3 py-2 text-[12px] font-medium text-on-surface-variant hover:bg-surface-container-low transition-colors">
              <FolderInput size={13} /> Move to Folder
            </button>
          )}
          {onDelete && (
            <>
              <div className="h-px bg-border-slate mx-2 my-1" />
              <button onClick={() => { onDelete(); setOpen(false); }}
                className="w-full min-h-11 flex items-center gap-2 px-3 py-2 text-[12px] font-medium text-status-rose-text hover:bg-status-rose-bg transition-colors">
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
