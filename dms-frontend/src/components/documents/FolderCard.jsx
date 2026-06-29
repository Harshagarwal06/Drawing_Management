import { memo } from "react";
import { Folder, ChevronRight } from "lucide-react";
import { countDescendants } from "./constants";
import FolderMenu from "./FolderMenu";

export default memo(function FolderCard({ node, fileCount, drawingCount = 0, onClick, onAdd, onRename, onMove, onDelete, viewMode }) {
  const subCount = countDescendants(node);
  const hasMenu  = onAdd || onRename || onMove || onDelete;
  const hasCont  = subCount > 0 || drawingCount > 0;

  const mobileMeta = subCount === 0 && drawingCount === 0
    ? "Empty"
    : [
        subCount     > 0 ? `${subCount} folder${subCount !== 1 ? "s" : ""}`       : null,
        drawingCount > 0 ? `${drawingCount} drawing${drawingCount !== 1 ? "s" : ""}` : null,
      ].filter(Boolean).join(" · ");

  if (viewMode === "list") {
    return (
      <div
        onClick={onClick}
        className="group flex items-center gap-3 px-4 py-2.5 rounded-xl hover:bg-surface-container active:bg-surface-container cursor-pointer transition-colors touch-manipulation"
      >
        <Folder size={18} className="text-primary shrink-0" />
        <span className="flex-1 text-[13px] font-medium text-on-surface truncate">{node.name}</span>
        <span className="md:hidden text-[11px] text-on-surface-variant shrink-0">{mobileMeta}</span>
        {fileCount > 0 && (
          <span className="hidden md:inline text-[11px] text-on-surface-variant">{fileCount} file{fileCount !== 1 ? "s" : ""}</span>
        )}
        {subCount > 0 && (
          <span className="hidden md:inline text-[11px] text-on-surface-variant">{subCount} folder{subCount !== 1 ? "s" : ""}</span>
        )}
        {hasMenu && <FolderMenu onAdd={onAdd} onRename={onRename} onMove={onMove} onDelete={onDelete} />}
        <ChevronRight size={14} className="text-outline shrink-0" />
      </div>
    );
  }

  // Grid view
  return (
    <div
      onClick={onClick}
      className="group bg-surface-container-low hover:bg-surface-container active:bg-surface-container border border-border-slate rounded-xl cursor-pointer transition-all duration-150 hover:shadow-sm touch-manipulation"
    >
      {/* Mobile: centered vertical card */}
      <div className="md:hidden flex flex-col items-center text-center p-3 relative">
        <div className={`w-12 h-12 rounded-full flex items-center justify-center mb-2.5 ${hasCont ? "bg-primary/10" : "bg-surface-container"}`}>
          <Folder size={22} className={hasCont ? "text-primary" : "text-on-surface-variant"} />
        </div>
        <p className="text-[13px] font-semibold text-on-surface w-full truncate">{node.name}</p>
        <p className="text-[11px] text-on-surface-variant mt-0.5">{mobileMeta}</p>
        {hasMenu && (
          <div className="absolute top-2 right-2" onClick={e => e.stopPropagation()}>
            <FolderMenu onAdd={onAdd} onRename={onRename} onMove={onMove} onDelete={onDelete} />
          </div>
        )}
      </div>

      {/* Desktop: horizontal row */}
      <div className="hidden md:flex items-center gap-3 px-4 py-3">
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
    </div>
  );
});
