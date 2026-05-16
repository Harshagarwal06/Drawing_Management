import { useState } from "react";
import FolderBrowser from "./FolderBrowser";
import { PanelLeftClose, PanelLeftOpen } from "lucide-react";

const API = import.meta.env.VITE_API_URL;

const STATUS_LABEL = { S3: 'For Construction', S2: 'For Approval', S1: 'For Information', VOID: 'Void' };
const STATUS_PILL  = {
  S3:   'bg-status-emerald-bg text-status-emerald-text',
  S2:   'bg-status-amber-bg   text-status-amber-text',
  S1:   'bg-blue-50           text-blue-700',
  VOID: 'bg-status-rose-bg   text-status-rose-text',
};

export default function DocumentsView({ drawings, onUpload }) {
  const [explorerOpen, setExplorerOpen] = useState(true);
  const [selectedFolder, setSelectedFolder] = useState("");

  const folderDrawings = selectedFolder
    ? drawings.filter(d => (d.folderPath || "") === selectedFolder)
    : drawings;

  const withFiles = folderDrawings.filter(d => d.path);
  const missing   = folderDrawings.length - withFiles.length;

  return (
    <div className="max-w-[1400px] mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-headline-lg font-semibold text-on-surface">Documents</h1>
          <p className="text-body-md text-on-surface-variant mt-1">All uploaded drawing files</p>
        </div>
        <div className="flex items-center gap-4 text-[14px] text-on-surface-variant">
          {/* Explorer toggle */}
          <button
            onClick={() => setExplorerOpen(o => !o)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border-slate hover:bg-surface-container transition-colors text-[13px] font-medium text-on-surface-variant"
            title={explorerOpen ? "Hide explorer" : "Show explorer"}
          >
            {explorerOpen ? <PanelLeftClose size={15} /> : <PanelLeftOpen size={15} />}
            Explorer
          </button>

          {/* Upload Here button */}
          {onUpload && selectedFolder && (
            <button
              onClick={() => onUpload(selectedFolder)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary text-white hover:bg-primary-container transition-colors text-[13px] font-medium shadow-sm active:scale-[0.98]"
            >
              <span className="material-symbols-outlined text-[16px]">upload</span>
              Upload to Folder
            </button>
          )}

          <div className="h-4 w-px bg-border-slate hidden sm:block" />

          <span><span className="text-primary font-semibold">{withFiles.length}</span> uploaded</span>
          {missing > 0 && <span><span className="text-status-amber-text font-semibold">{missing}</span> without file</span>}
        </div>
      </div>

      {/* Main content: Explorer sidebar + Files table */}
      <div className="flex gap-6 items-start">
        {/* Explorer panel */}
        {explorerOpen && (
          <div className="hidden lg:block w-[260px] shrink-0 sticky top-20">
            <FolderBrowser
              className="h-[calc(100vh-200px)]"
              onFolderSelect={setSelectedFolder}
              drawings={drawings}
            />
          </div>
        )}

        {/* File table — grows to fill remaining space */}
        <div className="flex-1 min-w-0 space-y-6">
          <div className="bg-white border border-border-slate rounded-xl overflow-hidden">
            {withFiles.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-64 gap-4 text-on-surface-variant">
                <span className="material-symbols-outlined text-[56px] opacity-25">folder_open</span>
                <p className="text-[18px] font-semibold text-on-surface">No files uploaded yet</p>
                <p className="text-[14px] text-on-surface-variant text-center max-w-xs">Upload drawings from the Drawing Register to see them here.</p>
              </div>
            ) : (
              <table className="w-full">
                <thead className="bg-surface-container-low border-b border-border-slate">
                  <tr>
                    {["Drawing", "Discipline", "Rev", "Status", "Location", "File", ""].map((h, i) => (
                      <th key={i} className={`px-6 py-3 text-[11px] font-semibold text-on-surface-variant uppercase tracking-wider text-left ${i === 6 ? "w-20" : ""} ${i === 1 || i === 4 ? "hidden md:table-cell" : ""} ${i >= 3 && i <= 5 && i !== 4 ? "hidden lg:table-cell" : ""}`}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-slate">
                  {withFiles.map(d => {
                    const filename = d.path.split('/').pop();
                    const ext      = filename.split('.').pop().toUpperCase();
                    const folder   = d.folderPath ? d.folderPath.split('/').pop() : 'Root';
                    return (
                      <tr key={d.id} className="hover:bg-surface-container-low transition-colors group">
                        <td className="px-6 py-3">
                          <p className="font-mono text-[13px] font-bold text-primary">{d.number}</p>
                          <p className="text-[11px] text-on-surface-variant truncate max-w-[200px]">{d.title}</p>
                        </td>
                        <td className="px-4 py-3 hidden md:table-cell">
                          <span className="text-[12px] text-on-surface-variant">{d.discipline || '—'}</span>
                        </td>
                        <td className="px-4 py-3">
                          <span className="font-mono text-[12px] text-on-surface">Rev {d.rev || '—'}</span>
                        </td>
                        <td className="px-4 py-3 hidden lg:table-cell">
                          <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${STATUS_PILL[d.status] || 'bg-surface-container text-on-surface-variant'}`}>
                            {STATUS_LABEL[d.status] || d.status}
                          </span>
                        </td>
                        <td className="px-4 py-3 hidden md:table-cell">
                          <div className="flex items-center gap-1.5 text-on-surface-variant">
                            <span className="material-symbols-outlined text-[14px]">folder</span>
                            <span className="text-[12px] truncate max-w-[120px]" title={d.folderPath}>{folder}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 hidden lg:table-cell">
                          <div className="flex items-center gap-2">
                            <span className="px-1.5 py-0.5 rounded bg-surface-container border border-border-slate text-[10px] font-mono text-on-surface-variant">{ext}</span>
                            <span className="text-[11px] text-on-surface-variant truncate max-w-[160px]">{filename}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1 justify-end opacity-0 group-hover:opacity-100 transition-opacity">
                            <a href={`${API}${d.path}`} target="_blank" rel="noreferrer"
                              className="p-1.5 rounded-lg hover:bg-surface-container text-on-surface-variant hover:text-primary transition-colors" title="View">
                              <span className="material-symbols-outlined text-[16px]">open_in_new</span>
                            </a>
                            <a href={`${API}${d.path}`} download={filename}
                              className="p-1.5 rounded-lg hover:bg-surface-container text-on-surface-variant hover:text-primary transition-colors" title="Download">
                              <span className="material-symbols-outlined text-[16px]">download</span>
                            </a>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>

          {/* Missing files warning */}
          {missing > 0 && (
            <div className="bg-white border border-status-amber-text/30 rounded-xl p-6">
              <div className="flex items-center gap-2 mb-4">
                <span className="material-symbols-outlined text-status-amber-text text-[20px]">warning</span>
                <h2 className="text-[18px] font-semibold text-on-surface">{missing} Drawing{missing > 1 ? 's' : ''} without uploaded files</h2>
              </div>
              <div className="flex flex-wrap gap-2">
                {folderDrawings.filter(d => !d.path).map(d => (
                  <span key={d.id} className="px-2 py-1 rounded bg-status-amber-bg text-status-amber-text font-mono text-[11px]">{d.number}</span>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
