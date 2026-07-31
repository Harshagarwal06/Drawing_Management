import { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import {
  MoreVertical, FileEdit, Pencil, FolderInput, RefreshCcw, History, Trash2,
} from "lucide-react";

const FILE_MENU_W = 204;
const FILE_MENU_H = 260;

export default function FileMenu({ onEditMetadata, onRename, onMove, onSupersede, onViewHistory, onDelete }) {
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
        className="mobile-touch-target grid place-items-center rounded-lg text-on-surface-variant hover:bg-surface-container hover:text-on-surface transition-colors shrink-0"
        title="More actions"
        aria-label="More actions"
      >
        <MoreVertical size={14} />
      </button>

      {open && createPortal(
        <div
          ref={menuRef}
          style={{ position: "fixed", top: pos.top, left: pos.left, width: FILE_MENU_W }}
          className="z-[400] bg-white border border-border-slate rounded-xl shadow-xl py-1 overflow-hidden"
          onClick={e => e.stopPropagation()}
        >
          {onEditMetadata && (
            <button
              onClick={() => { onEditMetadata(); close(); }}
              className="w-full min-h-11 flex items-center gap-2.5 px-4 py-2.5 text-[13px] font-medium text-on-surface hover:bg-surface-container-low transition-colors text-left"
            >
              <FileEdit size={13} className="text-on-surface-variant shrink-0" />
              Edit Metadata
            </button>
          )}
          {onRename && (
            <button
              onClick={() => { onRename(); close(); }}
              className="w-full min-h-11 flex items-center gap-2.5 px-4 py-2.5 text-[13px] font-medium text-on-surface hover:bg-surface-container-low transition-colors text-left"
            >
              <Pencil size={13} className="text-on-surface-variant shrink-0" />
              Rename
            </button>
          )}
          {onMove && (
            <button
              onClick={() => { onMove(); close(); }}
              className="w-full min-h-11 flex items-center gap-2.5 px-4 py-2.5 text-[13px] font-medium text-on-surface hover:bg-surface-container-low transition-colors text-left"
            >
              <FolderInput size={13} className="text-on-surface-variant shrink-0" />
              Move to Folder
            </button>
          )}
          {onSupersede && (
            <button
              onClick={() => { onSupersede(); close(); }}
              className="w-full min-h-11 flex items-center gap-2.5 px-4 py-2.5 text-[13px] font-medium text-on-surface hover:bg-surface-container-low transition-colors text-left"
            >
              <RefreshCcw size={13} className="text-on-surface-variant shrink-0" />
              Upload New Revision
            </button>
          )}
          {onViewHistory && (
            <button
              onClick={() => { onViewHistory(); close(); }}
              className="w-full min-h-11 flex items-center gap-2.5 px-4 py-2.5 text-[13px] font-medium text-on-surface hover:bg-surface-container-low transition-colors text-left"
            >
              <History size={13} className="text-on-surface-variant shrink-0" />
              Revision History
            </button>
          )}

          {onDelete && <>
          <div className="h-px bg-border-slate mx-2 my-1" />
          <button
            onClick={() => { onDelete(); close(); }}
            className="w-full min-h-11 flex items-center gap-2.5 px-4 py-2.5 text-[13px] font-medium text-red-600 hover:bg-red-50 transition-colors text-left"
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
