import { useState } from "react";

const API = import.meta.env.VITE_API_URL;

const STATUS_PILLS = [
  { label: "All",              value: "All",  dot: "bg-on-surface-variant" },
  { label: "For Construction", value: "S3",   dot: "bg-emerald-500" },
  { label: "For Approval",     value: "S2",   dot: "bg-amber-500"   },
  { label: "For Information",  value: "S1",   dot: "bg-blue-500"    },
  { label: "Void",             value: "VOID", dot: "bg-red-500"     },
];

const STATUS_MAP = {
  S3:   { label: "For Construction", text: "text-emerald-400", bg: "bg-emerald-500/10 border-emerald-500/20", dot: "bg-emerald-400 shadow-[0_0_5px_rgba(52,211,153,0.5)]"  },
  S2:   { label: "For Approval",     text: "text-amber-400",   bg: "bg-amber-500/10  border-amber-500/20",   dot: "bg-amber-400  shadow-[0_0_5px_rgba(251,191,36,0.5)]"   },
  S1:   { label: "For Information",  text: "text-blue-400",    bg: "bg-blue-500/10   border-blue-500/20",    dot: "bg-blue-400   shadow-[0_0_5px_rgba(96,165,250,0.5)]"    },
  VOID: { label: "Void",             text: "text-red-400",     bg: "bg-red-500/10    border-red-500/20",     dot: "bg-red-400    shadow-[0_0_5px_rgba(248,113,113,0.5)]"   },
};

function SortIcon({ col, sortKey, sortDir }) {
  if (sortKey !== col) return <span className="material-symbols-outlined text-[13px] opacity-30 group-hover:opacity-60 transition-opacity">unfold_more</span>;
  return <span className="material-symbols-outlined text-[13px] text-primary">{sortDir === "asc" ? "arrow_upward" : "arrow_downward"}</span>;
}

export default function MasterRegisterTable({
  drawings = [],
  allDrawings = [],
  total = 0,
  page = 1,
  totalPages = 1,
  search = "",
  filterStat = "All",
  filterDisc = "All",
  sortKey = "number",
  sortDir = "asc",
  onPageChange,
  onSearch,
  onFilterStat,
  onFilterDisc,
  onSort,
  onNewEntry,
  onVoid,
}) {
  const [discOpen, setDiscOpen] = useState(false);

  /* derive unique disciplines from ALL drawings (not just current page) */
  const disciplines = ["All", ...Array.from(new Set(allDrawings.map(d => d.discipline).filter(Boolean))).sort()];

  const activeFilters = (filterStat !== "All" ? 1 : 0) + (filterDisc !== "All" ? 1 : 0) + (search ? 1 : 0);

  const handleExport = () => {
    const headers = ["Drawing No.", "Title", "Discipline", "Rev", "Status", "Date", "Originator", "Transmittals"];
    const rows = allDrawings.map(d => [d.number, d.title, d.discipline, d.rev, d.status, d.issueDate ?? "", d.originator, d.transmittals ?? 0]);
    const csv = [headers, ...rows].map(r => r.map(v => `"${String(v ?? "").replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a");
    a.href = url; a.download = "drawing-register.csv"; a.click();
    URL.revokeObjectURL(url);
  };

  const handleView = (d) => { if (d.path) window.open(`${API}${d.path}`, "_blank"); };

  const handleDownload = (d) => {
    if (!d.path) return;
    const ext = d.path.slice(d.path.lastIndexOf("."));
    const a   = document.createElement("a");
    a.href = `${API}${d.path}`; a.download = `${d.number}_Rev${d.rev}${ext}`; a.click();
  };

  const handleVoidClick = (d) => {
    if (window.confirm(`Void drawing ${d.number}?\n\nThis marks it as superseded and cannot be undone.`)) {
      onVoid?.(d.id);
    }
  };

  return (
    <div className="flex flex-col gap-5 max-w-full mx-auto w-full">

      {/* ── Page Header ── */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h2 className="font-headline-lg text-headline-lg font-bold text-on-surface tracking-tight">Master Drawing Register</h2>
          <p className="font-body-md text-body-md text-on-surface-variant mt-1 max-w-xl">
            Central repository for all project drawings. {total > 0 ? `${total} drawing${total !== 1 ? "s" : ""} found.` : ""}
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={handleExport}
            className="px-3.5 py-2 rounded-lg bg-surface-container border border-white/10 text-on-surface-variant hover:text-on-surface hover:bg-white/5 transition-colors flex items-center gap-1.5 font-label-md text-label-md"
          >
            <span className="material-symbols-outlined text-[17px]">ios_share</span>
            Export
          </button>
          <button
            onClick={onNewEntry}
            className="px-3.5 py-2 rounded-lg bg-primary text-on-primary hover:bg-primary/90 transition-colors flex items-center gap-1.5 font-label-md text-label-md shadow-[0_0_20px_rgba(195,192,255,0.25)]"
          >
            <span className="material-symbols-outlined text-[17px]">add</span>
            Upload Drawing
          </button>
        </div>
      </div>

      {/* ── Toolbar ── */}
      <div className="bg-surface-container-low border border-white/5 rounded-xl p-3 flex flex-wrap gap-3 items-center backdrop-blur-md shadow-lg">
        {/* Search */}
        <div className="relative flex-1 min-w-[200px] max-w-xs group">
          <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant text-[18px] group-focus-within:text-primary transition-colors">search</span>
          <input
            className="w-full bg-surface-container-lowest border border-white/10 rounded-lg pl-9 pr-8 py-2 text-on-surface font-body-sm text-body-sm placeholder:text-on-surface-variant focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/50 transition-all"
            placeholder="Search drawings…"
            type="text"
            value={search}
            onChange={e => onSearch?.(e.target.value)}
          />
          {search && (
            <button onClick={() => onSearch?.("")} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-on-surface-variant hover:text-on-surface transition-colors">
              <span className="material-symbols-outlined text-[16px]">close</span>
            </button>
          )}
        </div>

        {/* Discipline Dropdown */}
        <div className="relative">
          <button
            onClick={() => setDiscOpen(o => !o)}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg border font-label-sm text-label-sm transition-colors ${
              filterDisc !== "All"
                ? "bg-primary/10 border-primary/30 text-primary"
                : "bg-surface-container-lowest border-white/10 text-on-surface-variant hover:text-on-surface hover:bg-white/5"
            }`}
          >
            <span className="material-symbols-outlined text-[16px]">category</span>
            {filterDisc === "All" ? "All Disciplines" : filterDisc}
            <span className="material-symbols-outlined text-[14px]">{discOpen ? "expand_less" : "expand_more"}</span>
          </button>
          {discOpen && (
            <div className="absolute top-full left-0 mt-1 w-52 bg-surface-container border border-white/10 rounded-xl shadow-[0_16px_32px_-8px_rgba(0,0,0,0.8)] z-30 py-1 backdrop-blur-xl">
              {disciplines.map(d => (
                <button
                  key={d}
                  onClick={() => { onFilterDisc?.(d); setDiscOpen(false); }}
                  className={`w-full text-left px-3 py-2 font-label-sm text-[12px] transition-colors flex items-center gap-2 ${
                    filterDisc === d ? "text-primary bg-primary/10" : "text-on-surface-variant hover:text-on-surface hover:bg-white/5"
                  }`}
                >
                  {filterDisc === d && <span className="material-symbols-outlined text-[14px]">check</span>}
                  {filterDisc !== d && <span className="w-[14px]" />}
                  {d}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Status Pills */}
        <div className="flex items-center gap-1.5 flex-wrap">
          {STATUS_PILLS.map(pill => (
            <button
              key={pill.value}
              onClick={() => onFilterStat?.(pill.value)}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-full border font-label-sm text-[11px] whitespace-nowrap transition-colors ${
                filterStat === pill.value
                  ? "bg-primary/10 border-primary/20 text-primary"
                  : "bg-surface-container-lowest border-white/5 text-on-surface-variant hover:text-on-surface hover:bg-white/5"
              }`}
            >
              <span className={`w-1.5 h-1.5 rounded-full ${pill.dot}`} />
              {pill.label}
            </button>
          ))}
        </div>

        {/* Clear all */}
        {activeFilters > 0 && (
          <button
            onClick={() => { onSearch?.(""); onFilterStat?.("All"); onFilterDisc?.("All"); }}
            className="ml-auto flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-on-surface-variant hover:text-error hover:bg-error/10 transition-colors font-label-sm text-[11px]"
          >
            <span className="material-symbols-outlined text-[14px]">filter_list_off</span>
            Clear ({activeFilters})
          </button>
        )}
      </div>

      {/* ── Table ── */}
      <div className="bg-surface-container-low/50 backdrop-blur-xl border border-white/5 rounded-xl shadow-[0_20px_25px_-5px_rgba(0,0,0,0.5)] overflow-hidden flex flex-col w-full">
        <div className="overflow-x-auto w-full">
          <table className="w-full text-left border-collapse min-w-[900px]">
            <thead className="bg-surface-container border-b border-white/5">
              <tr>
                <th className="py-3 px-4 w-10 text-center">
                  <input className="rounded border-white/20 bg-surface-container-lowest text-primary focus:ring-primary/50" type="checkbox" />
                </th>
                {[
                  { key: "number",    label: "Drawing No." },
                  { key: "title",     label: "Title"       },
                  { key: "discipline",label: "Discipline"  },
                  { key: "rev",       label: "Rev"         },
                  { key: "status",    label: "Status"      },
                  { key: "issueDate", label: "Date"        },
                ].map(({ key, label }) => (
                  <th
                    key={key}
                    onClick={() => onSort?.(key)}
                    className="py-3 px-4 font-label-sm text-[11px] text-outline-variant uppercase tracking-wider cursor-pointer hover:text-on-surface transition-colors select-none group"
                  >
                    <div className="flex items-center gap-1">
                      {label}
                      <SortIcon col={key} sortKey={sortKey} sortDir={sortDir} />
                    </div>
                  </th>
                ))}
                <th className="py-3 px-4 font-label-sm text-[11px] text-outline-variant uppercase tracking-wider text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.04]">
              {drawings.length === 0 ? (
                <tr>
                  <td colSpan="8" className="py-16 text-center">
                    <div className="flex flex-col items-center gap-3 text-on-surface-variant">
                      <span className="material-symbols-outlined text-[48px] opacity-25">folder_open</span>
                      <p className="font-body-md text-body-md">
                        {activeFilters > 0 ? "No drawings match your filters." : "No drawings uploaded yet."}
                      </p>
                      {activeFilters > 0 && (
                        <button
                          onClick={() => { onSearch?.(""); onFilterStat?.("All"); onFilterDisc?.("All"); }}
                          className="text-primary font-label-sm text-label-sm hover:underline"
                        >
                          Clear all filters
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ) : drawings.map(d => {
                const s = STATUS_MAP[d.status] || { label: d.status, text: "text-on-surface-variant", bg: "bg-surface-container-highest border-white/5", dot: "bg-on-surface-variant" };
                return (
                  <tr key={d.id} className="group hover:bg-white/[0.025] transition-colors">
                    <td className="py-3 px-4 text-center">
                      <input className="rounded border-white/20 bg-surface-container-lowest text-primary focus:ring-primary/50 opacity-0 group-hover:opacity-100 transition-opacity" type="checkbox" />
                    </td>
                    <td className="py-3 px-4">
                      <span className="font-mono text-[13px] text-on-surface font-semibold group-hover:text-primary transition-colors">{d.number}</span>
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex flex-col">
                        <span className="text-[13px] text-on-surface font-medium leading-tight truncate max-w-[260px]">{d.title || "Untitled"}</span>
                        <span className="text-[11px] text-outline mt-0.5">{d.originator} · {d.transmittals ?? 0} Tx</span>
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <span className="px-2 py-0.5 rounded bg-surface-container-highest text-on-surface-variant text-[11px] border border-white/5">{d.discipline}</span>
                    </td>
                    <td className="py-3 px-4">
                      <span className="font-mono text-[13px] text-on-surface">{d.rev}</span>
                    </td>
                    <td className="py-3 px-4">
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[11px] font-medium ${s.bg} ${s.text}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`} />
                        {s.label}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-[12px] text-on-surface-variant">{d.issueDate ?? "—"}</td>
                    <td className="py-3 px-4">
                      <div className="flex items-center justify-end gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => handleView(d)}
                          disabled={!d.path}
                          className="p-1.5 rounded-lg text-on-surface-variant hover:text-primary hover:bg-primary/10 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                          title="View"
                        >
                          <span className="material-symbols-outlined text-[17px]">visibility</span>
                        </button>
                        <button
                          onClick={() => handleDownload(d)}
                          disabled={!d.path}
                          className="p-1.5 rounded-lg text-on-surface-variant hover:text-primary hover:bg-primary/10 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                          title="Download"
                        >
                          <span className="material-symbols-outlined text-[17px]">download</span>
                        </button>
                        {d.status !== "VOID" && (
                          <button
                            onClick={() => handleVoidClick(d)}
                            className="p-1.5 rounded-lg text-on-surface-variant hover:text-error hover:bg-error/10 transition-colors"
                            title="Void / Supersede"
                          >
                            <span className="material-symbols-outlined text-[17px]">block</span>
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Footer */}
        <div className="bg-surface-container border-t border-white/5 px-4 py-3 flex items-center justify-between">
          <p className="font-label-sm text-[12px] text-outline">
            {drawings.length > 0 ? `Showing ${(page - 1) * 8 + 1}–${(page - 1) * 8 + drawings.length} of ${total}` : "No results"}
          </p>
          {totalPages > 1 && (
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => onPageChange?.(page - 1)}
                disabled={page <= 1}
                className="w-8 h-8 rounded-lg flex items-center justify-center bg-surface-container-highest border border-white/5 text-on-surface-variant hover:text-on-surface hover:bg-white/5 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              >
                <span className="material-symbols-outlined text-[18px]">chevron_left</span>
              </button>
              {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
                const p = totalPages <= 7 ? i + 1 : i < 3 ? i + 1 : i === 3 ? "..." : totalPages - (6 - i);
                if (p === "...") return <span key="ellipsis" className="w-8 text-center text-on-surface-variant text-[12px]">…</span>;
                return (
                  <button
                    key={p}
                    onClick={() => onPageChange?.(p)}
                    className={`w-8 h-8 rounded-lg flex items-center justify-center font-label-md text-[12px] transition-colors ${
                      p === page ? "bg-primary text-on-primary" : "bg-surface-container-highest border border-white/5 text-on-surface-variant hover:bg-white/5"
                    }`}
                  >
                    {p}
                  </button>
                );
              })}
              <button
                onClick={() => onPageChange?.(page + 1)}
                disabled={page >= totalPages}
                className="w-8 h-8 rounded-lg flex items-center justify-center bg-surface-container-highest border border-white/5 text-on-surface-variant hover:text-on-surface hover:bg-white/5 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              >
                <span className="material-symbols-outlined text-[18px]">chevron_right</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
