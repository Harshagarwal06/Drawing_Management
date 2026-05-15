import { Search, Eye, Download, MoreHorizontal } from "lucide-react";
import { Th } from "./SortableHeader";
import StatusBadge from "./StatusBadge";
import { DISCIPLINE_COLORS, DISCIPLINES, STATUSES, STATUS_META } from "../constants";

const PER_PAGE = 8;

export default function MasterRegisterTable({
  drawings,
  filtered,
  pageRows,
  page,
  totalPages,
  search,
  filterDisc,
  filterStat,
  sortKey,
  sortDir,
  isRestricted,
  onSearch,
  onFilterDisc,
  onFilterStat,
  onSort,
  onPageChange,
}) {
  const totalDrawings = drawings.length;

  return (
    <>
      {/* Discipline breakdown */}
      <section className="bg-white border border-slate-200 rounded-xl p-5">
        <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-4">Drawings by Discipline</h2>
        <div className="flex flex-wrap gap-3">
          {DISCIPLINES.map(disc => {
            const count  = drawings.filter(d => d.discipline === disc).length;
            const pct    = totalDrawings > 0 ? Math.round((count / totalDrawings) * 100) : 0;
            const colors = DISCIPLINE_COLORS[disc] ?? "bg-slate-100 text-slate-700";
            return (
              <div key={disc} className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium ${colors}`}>
                <span>{disc}</span>
                <span className="opacity-60 text-xs font-bold">{count}</span>
                <div className="w-12 h-1.5 bg-black/10 rounded-full overflow-hidden">
                  <div className="h-full bg-current rounded-full opacity-40" style={{ width: `${pct}%` }} />
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Register table */}
      <section className="bg-white border border-slate-200 rounded-xl overflow-hidden">

        {/* Toolbar */}
        <div className="px-5 py-4 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center gap-3">
          <div>
            <h2 className="text-sm font-bold text-slate-800">Master Drawing Register</h2>
            <p className="text-xs text-slate-400 mt-0.5">
              {filtered.length} drawing{filtered.length !== 1 ? "s" : ""} found
            </p>
          </div>
          <div className="sm:ml-auto flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
              <input
                placeholder="Search drawings…"
                value={search}
                onChange={e => onSearch(e.target.value)}
                className="pl-8 pr-3 py-2 text-xs border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-slate-50 w-44"
              />
            </div>
            <select
              value={filterDisc}
              onChange={e => onFilterDisc(e.target.value)}
              className="text-xs border border-slate-200 rounded-lg px-2.5 py-2 outline-none focus:ring-2 focus:ring-blue-500 bg-slate-50 text-slate-600"
            >
              <option value="All">All Disciplines</option>
              {DISCIPLINES.map(d => <option key={d}>{d}</option>)}
            </select>
            <select
              value={filterStat}
              onChange={e => onFilterStat(e.target.value)}
              className="text-xs border border-slate-200 rounded-lg px-2.5 py-2 outline-none focus:ring-2 focus:ring-blue-500 bg-slate-50 text-slate-600"
            >
              <option value="All">All Statuses</option>
              {STATUSES.map(s => <option key={s} value={s}>{STATUS_META[s].label}</option>)}
            </select>
            <button className="flex items-center gap-1.5 text-xs font-medium text-slate-600 border border-slate-200 hover:border-slate-300 px-3 py-2 rounded-lg transition bg-slate-50">
              <Download className="w-3.5 h-3.5" />
              Export
            </button>
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <Th col="number"     label="Drawing No."      sortKey={sortKey} sortDir={sortDir} onSort={onSort} />
                <Th col="title"      label="Title"            sortKey={sortKey} sortDir={sortDir} onSort={onSort} />
                <Th col="discipline" label="Discipline"       sortKey={sortKey} sortDir={sortDir} onSort={onSort} />
                <Th col="rev"        label="Rev."  cls="w-16" sortKey={sortKey} sortDir={sortDir} onSort={onSort} />
                <Th col="status"     label="Status"           sortKey={sortKey} sortDir={sortDir} onSort={onSort} />
                <Th col="issueDate"  label="Issue Date"       sortKey={sortKey} sortDir={sortDir} onSort={onSort} />
                <Th col="originator" label="Originator"       sortKey={sortKey} sortDir={sortDir} onSort={onSort} />
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {pageRows.length === 0 ? (
                <tr>
                  <td colSpan={8} className="text-center py-16 text-slate-400 text-sm">
                    No drawings match your filters.
                  </td>
                </tr>
              ) : pageRows.map(row => (
                <tr key={row.id} className="row-hover cursor-default">
                  <td className="px-4 py-3.5 font-mono text-xs font-semibold text-blue-700 whitespace-nowrap">{row.number}</td>
                  <td className="px-4 py-3.5 text-slate-700 max-w-xs">
                    <p className="font-medium truncate">{row.title}</p>
                    <p className="text-xs text-slate-400 mt-0.5">{row.transmittals} transmittal{row.transmittals !== 1 ? "s" : ""}</p>
                  </td>
                  <td className="px-4 py-3.5 whitespace-nowrap">
                    <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${DISCIPLINE_COLORS[row.discipline] ?? "bg-slate-100 text-slate-700"}`}>
                      {row.discipline}
                    </span>
                  </td>
                  <td className="px-4 py-3.5 text-center">
                    <span className="inline-block w-7 h-7 rounded-full bg-slate-100 text-slate-700 text-xs font-bold leading-7 text-center">
                      {row.rev}
                    </span>
                  </td>
                  <td className="px-4 py-3.5 whitespace-nowrap">
                    <StatusBadge code={row.status} />
                  </td>
                  <td className="px-4 py-3.5 text-slate-500 text-xs whitespace-nowrap">{row.issueDate}</td>
                  <td className="px-4 py-3.5 text-slate-500 text-xs whitespace-nowrap">{row.originator}</td>
                  <td className="px-4 py-3.5 whitespace-nowrap">
                    <div className="flex items-center gap-1">
                      <button
                        title="View"
                        className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded transition"
                        onClick={() => {
                          if (row.path) {
                            window.open(`http://localhost:3000${row.path}`, "_blank", "noopener,noreferrer");
                          } else {
                            alert("This is a mock drawing. Upload a real file to view it.");
                          }
                        }}
                      >
                        <Eye className="w-3.5 h-3.5" />
                      </button>
                      <button title="Download" className="p-1.5 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded transition">
                        <Download className="w-3.5 h-3.5" />
                      </button>
                      {!isRestricted && (
                        <button title="More options" className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded transition">
                          <MoreHorizontal className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="px-5 py-3.5 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center gap-2 justify-between bg-slate-50/50">
          <p className="text-xs text-slate-400">
            Showing{" "}
            {filtered.length === 0 ? 0 : Math.min((page - 1) * PER_PAGE + 1, filtered.length)}–{Math.min(page * PER_PAGE, filtered.length)}{" "}
            of {filtered.length} results
          </p>
          <div className="flex items-center gap-1">
            <button
              disabled={page === 1}
              onClick={() => onPageChange(page - 1)}
              className="px-3 py-1.5 text-xs font-medium border border-slate-200 rounded-lg disabled:opacity-40 hover:bg-slate-100 transition"
            >← Prev</button>
            {[...Array(totalPages)].map((_, i) => (
              <button
                key={i}
                onClick={() => onPageChange(i + 1)}
                className={`w-7 h-7 text-xs font-medium rounded-lg transition ${
                  page === i + 1
                    ? "bg-blue-600 text-white border border-blue-600"
                    : "border border-slate-200 text-slate-600 hover:bg-slate-100"
                }`}
              >
                {i + 1}
              </button>
            ))}
            <button
              disabled={page === totalPages || totalPages === 0}
              onClick={() => onPageChange(page + 1)}
              className="px-3 py-1.5 text-xs font-medium border border-slate-200 rounded-lg disabled:opacity-40 hover:bg-slate-100 transition"
            >Next →</button>
          </div>
        </div>
      </section>
    </>
  );
}
