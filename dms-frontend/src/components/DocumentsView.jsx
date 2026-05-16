const API = import.meta.env.VITE_API_URL;

const STATUS_LABEL = { S3: 'For Construction', S2: 'For Approval', S1: 'For Information', VOID: 'Void' };
const STATUS_COLOR = {
  S3:   'bg-emerald-500/20 text-emerald-400',
  S2:   'bg-amber-500/20 text-amber-400',
  S1:   'bg-blue-500/20 text-blue-400',
  VOID: 'bg-red-500/20 text-red-400',
};

export default function DocumentsView({ drawings }) {
  const withFiles = drawings.filter(d => d.path);
  const total     = drawings.length;
  const uploaded  = withFiles.length;
  const missing   = total - uploaded;

  return (
    <div className="max-w-[1400px] mx-auto space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="font-display-lg text-display-lg text-on-surface tracking-tight">Documents</h1>
          <p className="font-body-md text-body-md text-on-surface-variant mt-1">All uploaded drawing files</p>
        </div>
        <div className="flex items-center gap-4 text-sm text-on-surface-variant">
          <span><span className="text-primary font-semibold">{uploaded}</span> uploaded</span>
          {missing > 0 && <span><span className="text-amber-400 font-semibold">{missing}</span> without file</span>}
        </div>
      </div>

      {/* File list */}
      <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
        {withFiles.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 gap-4 text-on-surface-variant">
            <span className="material-symbols-outlined text-[56px] opacity-30">folder_open</span>
            <p className="font-headline-sm text-headline-sm">No files uploaded yet</p>
            <p className="font-body-sm text-body-sm text-center max-w-xs">Upload drawings from the Drawing Register to see them here.</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 text-on-surface-variant">
                <th className="text-left px-6 py-3 font-label-sm text-[11px] uppercase tracking-wider">Drawing</th>
                <th className="text-left px-4 py-3 font-label-sm text-[11px] uppercase tracking-wider hidden md:table-cell">Discipline</th>
                <th className="text-left px-4 py-3 font-label-sm text-[11px] uppercase tracking-wider">Rev</th>
                <th className="text-left px-4 py-3 font-label-sm text-[11px] uppercase tracking-wider hidden lg:table-cell">Status</th>
                <th className="text-left px-4 py-3 font-label-sm text-[11px] uppercase tracking-wider hidden lg:table-cell">File</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {withFiles.map(d => {
                const filename = d.path.split('/').pop();
                const ext = filename.split('.').pop().toUpperCase();
                return (
                  <tr key={d.id} className="hover:bg-white/3 transition-colors group">
                    <td className="px-6 py-3">
                      <p className="font-mono text-[12px] text-primary">{d.number}</p>
                      <p className="font-body-sm text-[11px] text-on-surface-variant truncate max-w-[200px]">{d.title}</p>
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell">
                      <span className="font-body-sm text-[12px] text-on-surface-variant">{d.discipline || '—'}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="font-mono text-[12px] text-on-surface">{d.rev || '—'}</span>
                    </td>
                    <td className="px-4 py-3 hidden lg:table-cell">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${STATUS_COLOR[d.status] || ''}`}>
                        {STATUS_LABEL[d.status] || d.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 hidden lg:table-cell">
                      <div className="flex items-center gap-2">
                        <span className="px-1.5 py-0.5 rounded bg-surface-container-highest text-[10px] font-mono text-on-surface-variant">{ext}</span>
                        <span className="font-body-sm text-[11px] text-on-surface-variant truncate max-w-[160px]">{filename}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2 justify-end opacity-0 group-hover:opacity-100 transition-opacity">
                        <a
                          href={`${API}${d.path}`}
                          target="_blank"
                          rel="noreferrer"
                          className="p-1.5 rounded-md hover:bg-gray-100 text-on-surface-variant hover:text-primary transition-colors"
                          title="View"
                        >
                          <span className="material-symbols-outlined text-[16px]">open_in_new</span>
                        </a>
                        <a
                          href={`${API}${d.path}`}
                          download={filename}
                          className="p-1.5 rounded-md hover:bg-gray-100 text-on-surface-variant hover:text-primary transition-colors"
                          title="Download"
                        >
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

      {/* Drawings without files */}
      {missing > 0 && (
        <div className="bg-white border border-amber-200 rounded-xl p-6 shadow-sm">
          <div className="flex items-center gap-2 mb-4">
            <span className="material-symbols-outlined text-amber-400 text-[20px]">warning</span>
            <h2 className="font-headline-sm text-headline-sm text-on-surface font-semibold">{missing} Drawing{missing > 1 ? 's' : ''} without uploaded files</h2>
          </div>
          <div className="flex flex-wrap gap-2">
            {drawings.filter(d => !d.path).map(d => (
              <span key={d.id} className="px-2 py-1 rounded-md bg-amber-500/10 text-amber-400 font-mono text-[11px]">{d.number}</span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
