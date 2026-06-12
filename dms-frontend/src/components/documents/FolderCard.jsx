import { memo } from "react";
import { Folder, ChevronRight } from "lucide-react";
import { countDescendants } from "./constants";
import FolderMenu from "./FolderMenu";

export default memo(function FolderCard({ node, fileCount, drawingCount = 0, onClick, onAdd, onRename, onMove, onDelete, viewMode }) {
  const subCount = countDescendants(node);
  const hasMenu  = onAdd || onRename || onMove || onDelete;

  // Mobile-only secondary text: "N folders · N drawings" (omit a part when 0, "Empty" when both 0)
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
        className="group flex items-center gap-3 px-4 py-2.5 rounded-xl hover:bg-surface-container cursor-pointer transition-colors"
      >
        <Folder size={18} className="text-primary shrink-0" />
        <span className="flex-1 text-[13px] font-medium text-on-surface truncate">{node.name}</span>
        {/* Mobile-only combined meta (matches grid copy); desktop keeps its original separate counts */}
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
        {/* Desktop: original folders/files copy (unchanged) */}
        <p className="hidden md:block text-[11px] text-on-surface-variant mt-0.5">
          {subCount > 0 ? `${subCount} folder${subCount !== 1 ? "s" : ""}` : ""}
          {subCount > 0 && fileCount > 0 ? " · " : ""}
          {fileCount > 0 ? `${fileCount} file${fileCount !== 1 ? "s" : ""}` : ""}
          {subCount === 0 && fileCount === 0 ? "Empty" : ""}
        </p>
        {/* Mobile: folders/drawings copy */}
        <p className="md:hidden text-[11px] text-on-surface-variant mt-0.5">{mobileMeta}</p>
      </div>
      {hasMenu && <FolderMenu onAdd={onAdd} onRename={onRename} onMove={onMove} onDelete={onDelete} />}
      {/* Mobile-only chevron affordance */}
      <ChevronRight size={16} className="md:hidden text-outline shrink-0" />
    </div>
  );
})
