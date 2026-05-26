import { Eye, Download } from "lucide-react";
import { resolveUrl, STATUS_PILL, STATUS_LABEL, STATUS_BAR, EXT_STYLE } from "./constants";
import FileMenu from "./FileMenu";

export default function FileCard({ d, viewMode, onDelete, onEditMetadata, onRename, onMove, onNewRevision, onViewHistory }) {
  const filename    = d.path?.split("/").pop() ?? "";
  const ext         = filename.split(".").pop().toUpperCase();
  const extStyle    = EXT_STYLE[ext] ?? "bg-surface-container text-on-surface-variant";
  const statusPill  = STATUS_PILL[d.status]  ?? "bg-surface-container text-on-surface-variant";
  const statusLabel = STATUS_LABEL[d.status] ?? d.status;
  const statusBar   = STATUS_BAR[d.status]   ?? "bg-blue-400";

  const actions = onDelete ? {
    onEditMetadata: () => onEditMetadata(d),
    onRename:       () => onRename(d),
    onMove:         () => onMove(d),
    onSupersede:    onNewRevision ? () => onNewRevision(d) : undefined,
    onViewHistory:  onViewHistory ? () => onViewHistory(d) : undefined,
    onDelete:       () => onDelete(d),
  } : null;

  const historyOnly = !actions && onViewHistory ? {
    onViewHistory: () => onViewHistory(d),
  } : null;

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

  return (
    <div className="bg-white border border-border-slate rounded-xl overflow-hidden hover:shadow-md transition-all duration-150 cursor-default flex flex-col">
      <div className={`h-1.5 shrink-0 ${statusBar}`} />

      <div className="p-4 flex flex-col flex-1">
        <div className="flex items-start justify-between gap-1.5 mb-3">
          <span className={`px-2 py-1 rounded-lg text-[10px] font-mono font-bold shrink-0 ${extStyle}`}>{ext}</span>
          <div className="flex items-center gap-1 min-w-0">
            <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold shrink-0 ${statusPill}`}>{statusLabel}</span>
            {(actions || historyOnly) && <FileMenu {...(actions || historyOnly)} />}
          </div>
        </div>

        <p className="font-mono text-[13px] font-bold text-primary leading-tight mb-0.5">{d.number}</p>
        <p className="text-[11px] text-on-surface-variant leading-snug line-clamp-2 flex-1 mb-3">{d.title}</p>

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
