import { memo } from "react";
import { Folder, ChevronRight } from "lucide-react";
import { countDescendants } from "./constants";
import FolderMenu from "./FolderMenu";

export default memo(function FolderCard({ node, fileCount, onClick, onAdd, onRename, onMove, onDelete, viewMode }) {
  const subCount = countDescendants(node);
  const hasMenu  = onAdd || onRename || onMove || onDelete;

  if (viewMode === "list") {
    return (
      <div className="group min-h-11 flex items-center rounded-xl hover:bg-surface-container transition-colors">
        <button
          type="button"
          onClick={event => {
            if (event.detail > 0) event.currentTarget.blur();
            onClick?.();
          }}
          className="min-h-11 min-w-0 flex flex-1 items-center gap-3 rounded-xl px-4 py-2.5 text-left"
          aria-label={`Open folder ${node.name}`}
        >
          <Folder size={18} className="text-primary shrink-0" aria-hidden="true" />
          <span className="flex-1 text-[13px] font-medium text-on-surface truncate">{node.name}</span>
          {fileCount > 0 && (
            <span className="text-[11px] text-on-surface-variant">{fileCount} file{fileCount !== 1 ? "s" : ""}</span>
          )}
          {subCount > 0 && (
            <span className="text-[11px] text-on-surface-variant">{subCount} folder{subCount !== 1 ? "s" : ""}</span>
          )}
          <ChevronRight size={14} className="text-outline shrink-0" aria-hidden="true" />
        </button>
        {hasMenu && <FolderMenu onAdd={onAdd} onRename={onRename} onMove={onMove} onDelete={onDelete} />}
      </div>
    );
  }

  return (
    <div className="group min-h-[64px] flex items-center bg-surface-container-low hover:bg-surface-container border border-border-slate rounded-xl transition-colors">
      <button
        type="button"
        onClick={event => {
          if (event.detail > 0) event.currentTarget.blur();
          onClick?.();
        }}
        className="min-h-[64px] min-w-0 flex flex-1 items-center gap-3 rounded-xl px-4 py-3 text-left"
        aria-label={`Open folder ${node.name}`}
      >
        <span className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
          <Folder size={18} className="text-primary" aria-hidden="true" />
        </span>
        <span className="flex-1 min-w-0">
          <span className="block text-[13px] font-semibold text-on-surface truncate leading-tight">{node.name}</span>
          <span className="block text-[11px] text-on-surface-variant mt-0.5">
            {subCount > 0 ? `${subCount} folder${subCount !== 1 ? "s" : ""}` : ""}
            {subCount > 0 && fileCount > 0 ? " · " : ""}
            {fileCount > 0 ? `${fileCount} file${fileCount !== 1 ? "s" : ""}` : ""}
            {subCount === 0 && fileCount === 0 ? "Empty" : ""}
          </span>
        </span>
      </button>
      {hasMenu && <FolderMenu onAdd={onAdd} onRename={onRename} onMove={onMove} onDelete={onDelete} />}
    </div>
  );
})
