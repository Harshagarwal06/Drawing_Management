const API = "http://localhost:3000";

const STATUS_PILLS = [
  { label: "All Active", value: "All", dot: "bg-primary" },
  { label: "For Construction", value: "S3", dot: "bg-emerald-500" },
  { label: "For Approval", value: "S2", dot: "bg-amber-500" },
];

export default function MasterRegisterTable({
  drawings = [],
  total = 0,
  page = 1,
  totalPages = 1,
  search = "",
  filterStat = "All",
  onPageChange,
  onSearch,
  onFilterStat,
  onNewEntry,
  onVoid,
}) {
  const handleExport = () => {
    const headers = ["Drawing No.", "Title", "Discipline", "Rev", "Status", "Date", "Originator", "Transmittals"];
    const rows = drawings.map(d => [d.number, d.title, d.discipline, d.rev, d.status, d.issueDate ?? "", d.originator, d.transmittals ?? 0]);
    const csv = [headers, ...rows].map(r => r.map(v => `"${String(v ?? "").replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "drawing-register.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleView = (d) => {
    if (d.path) window.open(`${API}${d.path}`, "_blank");
  };

  const handleDownload = (d) => {
    if (!d.path) return;
    const a = document.createElement("a");
    a.href = `${API}${d.path}`;
    a.download = d.number + "_" + d.rev + d.path.slice(d.path.lastIndexOf("."));
    a.click();
  };

  const handleVoidClick = (d) => {
    if (window.confirm(`Void drawing ${d.number}? This cannot be undone.`)) {
      onVoid?.(d.id);
    }
  };

  return (
    <div className="flex flex-col gap-6 max-w-full mx-auto w-full">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h2 className="font-headline-lg text-headline-lg font-bold text-on-surface tracking-tight mb-2">Master Drawing Register</h2>
          <p className="font-body-md text-body-md text-on-surface-variant max-w-2xl">Central repository for all project architectural, structural, and MEP documentation. Monitor status and revisions in real-time.</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={handleExport}
            className="px-4 py-2 rounded-lg bg-surface-container border border-white/10 text-on-surface hover:bg-white/5 transition-colors flex items-center gap-2 font-label-md text-label-md"
          >
            <span className="material-symbols-outlined text-[18px]">ios_share</span>
            Export Log
          </button>
          <button
            onClick={onNewEntry}
            className="px-4 py-2 rounded-lg bg-primary text-on-primary hover:bg-primary/90 transition-colors flex items-center gap-2 font-label-md text-label-md shadow-[0_0_15px_rgba(195,192,255,0.3)]"
          >
            <span className="material-symbols-outlined text-[18px]">add</span>
            New Entry
          </button>
        </div>
      </div>

      {/* Toolbar & Filters */}
      <div className="bg-surface-container-low border border-white/5 rounded-xl p-4 flex flex-col md:flex-row gap-4 items-center justify-between backdrop-blur-md shadow-lg">
        <div className="flex items-center gap-3 w-full md:w-auto">
          <div className="relative w-full md:w-80 group">
            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant group-focus-within:text-primary transition-colors">search</span>
            <input
              className="w-full bg-surface-container-lowest border border-white/10 rounded-lg pl-10 pr-4 py-2 text-on-surface font-body-sm text-body-sm placeholder:text-on-surface-variant focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/50 transition-all shadow-inner"
              placeholder="Search drawings, titles, or authors..."
              type="text"
              value={search}
              onChange={e => onSearch?.(e.target.value)}
            />
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2 w-full md:w-auto overflow-x-auto pb-1 md:pb-0 scrollbar-hide">
          <span className="font-label-sm text-label-sm text-outline px-2">STATUS:</span>
          {STATUS_PILLS.map(pill => (
            <button
              key={pill.value}
              onClick={() => onFilterStat?.(pill.value)}
              className={`px-3 py-1.5 rounded-full border font-label-sm text-label-sm flex items-center gap-1.5 whitespace-nowrap transition-colors ${
                filterStat === pill.value
                  ? "bg-primary/10 border-primary/20 text-primary"
                  : "bg-surface-container-highest border-white/5 text-on-surface-variant hover:text-on-surface hover:bg-white/5"
              }`}
            >
              <div className={`w-1.5 h-1.5 rounded-full ${pill.dot}`}></div>
              {pill.label}
            </button>
          ))}
        </div>
      </div>

      {/* Data Table Container */}
      <div className="bg-surface-container-low/50 backdrop-blur-xl border border-white/5 rounded-xl shadow-[0_20px_25px_-5px_rgba(0,0,0,0.5)] overflow-hidden flex flex-col relative w-full">
        <div className="overflow-x-auto w-full">
          <table className="w-full text-left border-collapse min-w-[1000px]">
            <thead className="bg-surface-container border-b border-surface-variant sticky top-0 z-10">
              <tr>
                <th className="py-3 px-4 font-label-sm text-label-sm text-outline-variant uppercase tracking-wider w-12 text-center">
                  <input className="rounded border-outline-variant bg-surface-container-lowest text-primary focus:ring-primary/50 focus:ring-offset-surface-container focus:ring-offset-2" type="checkbox" />
                </th>
                <th className="py-3 px-4 font-label-sm text-label-sm text-outline-variant uppercase tracking-wider cursor-pointer hover:text-on-surface transition-colors">
                  <div className="flex items-center gap-1">
                    Drawing No.
                    <span className="material-symbols-outlined text-[14px]">arrow_downward</span>
                  </div>
                </th>
                <th className="py-3 px-4 font-label-sm text-label-sm text-outline-variant uppercase tracking-wider">Title & Type</th>
                <th className="py-3 px-4 font-label-sm text-label-sm text-outline-variant uppercase tracking-wider">Discipline</th>
                <th className="py-3 px-4 font-label-sm text-label-sm text-outline-variant uppercase tracking-wider">Rev</th>
                <th className="py-3 px-4 font-label-sm text-label-sm text-outline-variant uppercase tracking-wider">Status</th>
                <th className="py-3 px-4 font-label-sm text-label-sm text-outline-variant uppercase tracking-wider">Date</th>
                <th className="py-3 px-4 font-label-sm text-label-sm text-outline-variant uppercase tracking-wider text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-variant font-body-sm text-body-sm">
              {drawings.length === 0 ? (
                <tr>
                  <td colSpan="8" className="text-center py-8 text-on-surface-variant font-body-sm text-body-sm">
                    No drawings found.
                  </td>
                </tr>
              ) : (
                drawings.map(d => {
                  let statusColor = "text-on-surface-variant";
                  let bgGlow = "bg-surface-container-highest border-white/5";
                  let dotColor = "bg-on-surface-variant";
                  let statusLabel = d.status;

                  if (d.status === "S3") {
                    statusColor = "text-emerald-400";
                    bgGlow = "bg-emerald-500/10 border-emerald-500/20";
                    dotColor = "bg-emerald-400 shadow-[0_0_5px_rgba(52,211,153,0.5)]";
                    statusLabel = "For Construction";
                  } else if (d.status === "S2") {
                    statusColor = "text-amber-400";
                    bgGlow = "bg-amber-500/10 border-amber-500/20";
                    dotColor = "bg-amber-400 shadow-[0_0_5px_rgba(251,191,36,0.5)]";
                    statusLabel = "For Approval";
                  } else if (d.status === "S1") {
                    statusColor = "text-blue-400";
                    bgGlow = "bg-blue-500/10 border-blue-500/20";
                    dotColor = "bg-blue-400 shadow-[0_0_5px_rgba(96,165,250,0.5)]";
                    statusLabel = "For Information";
                  } else if (d.status === "VOID") {
                    statusColor = "text-red-400";
                    bgGlow = "bg-red-500/10 border-red-500/20";
                    dotColor = "bg-red-400 shadow-[0_0_5px_rgba(248,113,113,0.5)]";
                    statusLabel = "Void";
                  }

                  return (
                    <tr key={d.id} className="group hover:bg-white/[0.02] transition-all duration-200 hover:shadow-[inset_2px_0_0_0_#c3c0ff]">
                      <td className="py-3 px-4 text-center">
                        <input className="rounded border-outline-variant bg-surface-container-lowest text-primary focus:ring-primary/50 focus:ring-offset-surface focus:ring-offset-2 opacity-50 group-hover:opacity-100 transition-opacity" type="checkbox" />
                      </td>
                      <td className="py-3 px-4">
                        <span className="font-mono text-on-surface font-medium">{d.number}</span>
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded bg-error-container/20 text-error flex items-center justify-center border border-error/20 shrink-0">
                            <span className="font-label-sm text-[10px] font-bold">PDF</span>
                          </div>
                          <div>
                            <p className="text-on-surface font-medium group-hover:text-primary transition-colors truncate max-w-[250px]">{d.title || "Untitled"}</p>
                            <p className="text-outline text-[12px]">{d.originator} • {d.transmittals ?? 0} Tx</p>
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <span className="px-2 py-1 rounded bg-surface-container-highest text-on-surface-variant text-[11px] font-medium border border-white/5">{d.discipline}</span>
                      </td>
                      <td className="py-3 px-4 text-on-surface">{d.rev}</td>
                      <td className="py-3 px-4">
                        <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border ${bgGlow} ${statusColor}`}>
                          <div className={`w-1.5 h-1.5 rounded-full ${dotColor}`}></div>
                          <span className="text-[11px] font-medium">{statusLabel}</span>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-on-surface-variant">{d.issueDate ?? "—"}</td>
                      <td className="py-3 px-4">
                        <div className="flex items-center justify-end gap-1 opacity-40 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={() => handleView(d)}
                            className="p-1.5 text-on-surface-variant hover:text-primary hover:bg-primary/10 rounded-md transition-colors"
                            title="View"
                          >
                            <span className="material-symbols-outlined text-[18px]">visibility</span>
                          </button>
                          <button
                            onClick={() => handleDownload(d)}
                            className="p-1.5 text-on-surface-variant hover:text-primary hover:bg-primary/10 rounded-md transition-colors"
                            title="Download"
                          >
                            <span className="material-symbols-outlined text-[18px]">download</span>
                          </button>
                          {d.status !== "VOID" && (
                            <button
                              onClick={() => handleVoidClick(d)}
                              className="p-1.5 text-on-surface-variant hover:text-error hover:bg-error/10 rounded-md transition-colors"
                              title="Void / Supersede"
                            >
                              <span className="material-symbols-outlined text-[18px]">block</span>
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Table Footer / Pagination */}
        <div className="bg-surface-container border-t border-surface-variant px-4 py-3 flex items-center justify-between">
          <p className="font-label-sm text-label-sm text-outline">
            Showing {drawings.length} of {total} {total === 1 ? "entry" : "entries"}
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={() => onPageChange?.(page - 1)}
              disabled={page <= 1}
              className="w-8 h-8 rounded flex items-center justify-center bg-surface-container-highest border border-white/5 text-on-surface-variant hover:text-on-surface hover:bg-white/5 disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <span className="material-symbols-outlined text-[18px]">chevron_left</span>
            </button>
            {Array.from({ length: totalPages }, (_, i) => i + 1).map(p => (
              <button
                key={p}
                onClick={() => onPageChange?.(p)}
                className={`w-8 h-8 rounded flex items-center justify-center font-label-md text-[13px] ${
                  p === page
                    ? "bg-primary text-on-primary"
                    : "bg-surface-container-highest border border-white/5 text-on-surface-variant hover:text-on-surface hover:bg-white/5"
                }`}
              >
                {p}
              </button>
            ))}
            <button
              onClick={() => onPageChange?.(page + 1)}
              disabled={page >= totalPages}
              className="w-8 h-8 rounded flex items-center justify-center bg-surface-container-highest border border-white/5 text-on-surface-variant hover:text-on-surface hover:bg-white/5 disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <span className="material-symbols-outlined text-[18px]">chevron_right</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
