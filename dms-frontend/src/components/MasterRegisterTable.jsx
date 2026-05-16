import { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { MoreVertical, Eye, Download, Ban } from "lucide-react";

const API = import.meta.env.VITE_API_URL;

/* ── Status config ── */
const STATUS_MAP = {
  S3:   { label: "For Construction", pillCls: "bg-status-emerald-bg text-status-emerald-text", dot: "bg-status-emerald-text" },
  S2:   { label: "For Approval",     pillCls: "bg-status-amber-bg   text-status-amber-text",   dot: "bg-status-amber-text"   },
  S1:   { label: "For Information",  pillCls: "bg-blue-50           text-blue-700",             dot: "bg-blue-600"            },
  VOID: { label: "Void",             pillCls: "bg-status-rose-bg    text-status-rose-text",     dot: "bg-status-rose-text"    },
};

const STATUS_FILTERS = [
  { label: "All",              value: "All",  dot: "bg-on-surface-variant" },
  { label: "For Construction", value: "S3",   dot: "bg-status-emerald-text" },
  { label: "For Approval",     value: "S2",   dot: "bg-status-amber-text"   },
  { label: "For Information",  value: "S1",   dot: "bg-blue-600"            },
  { label: "Void",             value: "VOID", dot: "bg-status-rose-text"    },
];

const MEP_SUBTYPES = ["Electrical", "Plumbing", "Fire"];
const KNOWN_TYPES  = new Set(["Architecture", "Structure", ...MEP_SUBTYPES, "Civil", "Interior"]);

/* ── Truncate filename in the middle, preserving extension ── */
function truncateMid(str, maxLen = 22) {
  if (!str || str.length <= maxLen) return str;
  const dot  = str.lastIndexOf(".");
  const ext  = dot > 0 ? str.slice(dot) : "";
  const name = dot > 0 ? str.slice(0, dot) : str;
  const keep = maxLen - ext.length - 1;           // 1 for the ellipsis
  const head = Math.ceil(keep / 2);
  const tail = Math.floor(keep / 2);
  return `${name.slice(0, head)}…${name.slice(-tail)}${ext}`;
}

function SortIcon({ col, sortKey, sortDir }) {
  if (sortKey !== col)
    return <span className="material-symbols-outlined text-[13px] opacity-30 group-hover:opacity-70 transition-opacity">unfold_more</span>;
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
  onNewTransmittal,
  onVoid,
  isRestricted = false,
}) {
  const [discOpen, setDiscOpen] = useState(false);

  const extraTypes    = Array.from(new Set(allDrawings.map(d => d.discipline).filter(d => d && !KNOWN_TYPES.has(d))));
  const activeFilters = (filterStat !== "All" ? 1 : 0) + (filterDisc !== "All" ? 1 : 0) + (search ? 1 : 0);

  /* ── Export ── */
  const handleExport = () => {
    const headers = ["Drawing No.", "Title", "Discipline", "Rev", "Status", "Date", "Originator", "Transmittals"];
    const rows    = allDrawings.map(d => [d.number, d.title, d.discipline, d.rev, d.status, d.issueDate ?? "", d.originator, d.transmittals ?? 0]);
    const csv     = [headers, ...rows].map(r => r.map(v => `"${String(v ?? "").replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob    = new Blob([csv], { type: "text/csv" });
    const url     = URL.createObjectURL(blob);
    const a       = document.createElement("a"); a.href = url; a.download = "drawing-register.csv"; a.click();
    URL.revokeObjectURL(url);
  };

  const handleView     = d => { if (d.path) window.open(`${API}${d.path}`, "_blank"); };
  const handleDownload = d => {
    if (!d.path) return;
    const ext = d.path.slice(d.path.lastIndexOf("."));
    const a   = document.createElement("a"); a.href = `${API}${d.path}`; a.download = `${d.number}_Rev${d.rev}${ext}`; a.click();
  };
  const handleVoidClick = d => {
    if (window.confirm(`Void drawing ${d.number}?\n\nThis marks it as superseded and cannot be undone.`)) onVoid?.(d.id);
  };

  return (
    <div className="flex flex-col gap-6">

      {/* ── Page header ── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-headline-lg font-semibold text-on-surface tracking-tight">Master Drawing Register</h2>
          <p className="text-body-md text-on-surface-variant mt-1">
            Central repository for all project drawings.{total > 0 ? ` ${total} drawing${total !== 1 ? "s" : ""} found.` : ""}
          </p>
        </div>

        {/* ── Contextual Action Bar ── */}
        <div className="flex items-center gap-2 shrink-0">
          {onNewTransmittal && (
            <button
              onClick={onNewTransmittal}
              className="bg-white border border-border-slate text-on-surface-variant hover:bg-surface-container-low px-4 py-2 rounded-lg flex items-center gap-2 text-[14px] font-medium transition-colors active:scale-[0.98]"
            >
              <span className="material-symbols-outlined text-[17px]">send</span>
              New Transmittal
            </button>
          )}
          <button
            onClick={handleExport}
            className="bg-white border border-border-slate text-on-surface-variant hover:bg-surface-container-low px-4 py-2 rounded-lg flex items-center gap-2 text-[14px] font-medium transition-colors active:scale-[0.98]"
          >
            <span className="material-symbols-outlined text-[17px]">ios_share</span>
            Export
          </button>
          {!isRestricted && (
            <button
              onClick={onNewEntry}
              className="bg-primary text-white rounded-lg hover:bg-primary-container px-4 py-2 font-medium flex items-center gap-2 text-[14px] transition-colors active:scale-[0.98]"
            >
              <span className="material-symbols-outlined text-[17px]">upload</span>
              Upload to Project
            </button>
          )}
        </div>
      </div>

      {/* ── Toolbar ── */}
      <div className="relative z-20 bg-white border border-border-slate rounded-xl p-3 flex flex-wrap gap-3 items-center">

        {/* Search */}
        <div className="relative flex-1 min-w-[200px] max-w-xs">
          <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant text-[18px]">search</span>
          <input
            className="w-full bg-surface-container-low border border-border-slate rounded-lg pl-9 pr-8 py-2 text-on-surface text-[14px] placeholder:text-on-surface-variant focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/20 transition-all"
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

        {/* Drawing Type Dropdown */}
        <div className="relative">
          <button
            onClick={() => setDiscOpen(o => !o)}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg border text-[13px] font-medium transition-colors ${
              filterDisc !== "All"
                ? "bg-primary/10 border-primary/30 text-primary"
                : "bg-white border-border-slate text-on-surface-variant hover:bg-surface-container-low"
            }`}
          >
            <span className="material-symbols-outlined text-[16px]">category</span>
            {filterDisc === "All" ? "Drawing Type" : filterDisc}
            <span className="material-symbols-outlined text-[14px]">{discOpen ? "expand_less" : "expand_more"}</span>
          </button>

          {discOpen && (
            <div className="absolute top-full left-0 mt-1.5 w-52 bg-white border border-border-slate rounded-xl shadow-lg z-50 py-1.5 overflow-hidden">
              <TypeItem label="All"          active={filterDisc === "All"}          onClick={() => { onFilterDisc?.("All");          setDiscOpen(false); }} />
              <TypeItem label="Architecture" active={filterDisc === "Architecture"} onClick={() => { onFilterDisc?.("Architecture"); setDiscOpen(false); }} />
              <TypeItem label="Structure"    active={filterDisc === "Structure"}    onClick={() => { onFilterDisc?.("Structure");    setDiscOpen(false); }} />
              <TypeItem label="MEP" isGroup  active={filterDisc === "MEP"}          onClick={() => { onFilterDisc?.("MEP");          setDiscOpen(false); }} />
              {MEP_SUBTYPES.map(d => (
                <TypeItem key={d} label={d} indent active={filterDisc === d} onClick={() => { onFilterDisc?.(d); setDiscOpen(false); }} />
              ))}
              <TypeItem label="Civil"    active={filterDisc === "Civil"}    onClick={() => { onFilterDisc?.("Civil");    setDiscOpen(false); }} />
              <TypeItem label="Interior" active={filterDisc === "Interior"} onClick={() => { onFilterDisc?.("Interior"); setDiscOpen(false); }} />
              {extraTypes.map(d => (
                <TypeItem key={d} label={d} active={filterDisc === d} onClick={() => { onFilterDisc?.(d); setDiscOpen(false); }} />
              ))}
            </div>
          )}
        </div>

        {/* Status pills */}
        <div className="flex items-center gap-1.5 flex-wrap">
          {STATUS_FILTERS.map(pill => (
            <button
              key={pill.value}
              onClick={() => onFilterStat?.(pill.value)}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-full border text-[11px] font-semibold whitespace-nowrap transition-colors ${
                filterStat === pill.value
                  ? "bg-primary/10 border-primary/30 text-primary"
                  : "bg-white border-border-slate text-on-surface-variant hover:bg-surface-container-low"
              }`}
            >
              <span className={`w-1.5 h-1.5 rounded-full ${pill.dot}`} />
              {pill.label}
            </button>
          ))}
        </div>

        {/* Clear */}
        {activeFilters > 0 && (
          <button
            onClick={() => { onSearch?.(""); onFilterStat?.("All"); onFilterDisc?.("All"); }}
            className="ml-auto flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-on-surface-variant hover:text-status-rose-text hover:bg-status-rose-bg transition-colors text-[11px] font-medium"
          >
            <span className="material-symbols-outlined text-[14px]">filter_list_off</span>
            Clear ({activeFilters})
          </button>
        )}
      </div>

      {/* ── Table ── */}
      <div className="bg-white border border-border-slate rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left min-w-[900px]">

            {/* Header */}
            <thead className="bg-surface-container-low border-b border-border-slate">
              <tr>
                <th className="py-2.5 px-4 w-10 text-left">
                  <input type="checkbox" className="rounded border-border-slate text-primary focus:ring-primary/30" />
                </th>
                {[
                  { key: "number",     label: "Drawing No."  },
                  { key: "title",      label: "Title"        },
                  { key: "discipline", label: "Drawing Type" },
                  { key: "rev",        label: "Rev"          },
                  { key: "status",     label: "Status"       },
                  { key: "issueDate",  label: "Date"         },
                ].map(({ key, label }) => (
                  <th
                    key={key}
                    onClick={() => onSort?.(key)}
                    className="py-2.5 px-4 text-left text-on-surface-variant uppercase tracking-wider text-[11px] font-semibold cursor-pointer hover:text-on-surface transition-colors select-none group"
                  >
                    <div className="flex items-center gap-1">
                      {label}
                      <SortIcon col={key} sortKey={sortKey} sortDir={sortDir} />
                    </div>
                  </th>
                ))}
                <th className="py-2.5 px-4 text-left text-on-surface-variant uppercase tracking-wider text-[11px] font-semibold">
                  Actions
                </th>
              </tr>
            </thead>

            {/* Rows */}
            <tbody>
              {drawings.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-16 text-center">
                    <div className="flex flex-col items-center gap-3 text-on-surface-variant">
                      <span className="material-symbols-outlined text-[48px] opacity-25">folder_open</span>
                      <p className="text-body-md">
                        {activeFilters > 0 ? "No drawings match your filters." : "No drawings uploaded yet."}
                      </p>
                      {activeFilters > 0 && (
                        <button
                          onClick={() => { onSearch?.(""); onFilterStat?.("All"); onFilterDisc?.("All"); }}
                          className="text-primary text-[13px] font-medium hover:underline"
                        >
                          Clear all filters
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ) : drawings.map(d => {
                const s        = STATUS_MAP[d.status] || { label: d.status, pillCls: "bg-surface-container text-on-surface-variant", dot: "bg-on-surface-variant" };
                const filename = d.path ? d.path.split("/").pop() : null;
                return (
                  <tr key={d.id} className="border-b border-border-slate hover:bg-surface-container-low/50 transition-colors group">

                    {/* Checkbox */}
                    <td className="py-2.5 px-4 text-left">
                      <input type="checkbox" className="rounded border-border-slate text-primary focus:ring-primary/30 opacity-0 group-hover:opacity-100 transition-opacity" />
                    </td>

                    {/* Drawing No. + filename */}
                    <td className="py-2.5 px-4 text-left">
                      <span className="font-mono text-[13px] font-semibold text-primary group-hover:underline cursor-pointer">{d.number}</span>
                      {filename && (
                        <p className="font-mono text-[10px] text-on-surface-variant mt-0.5" title={filename}>
                          {truncateMid(filename)}
                        </p>
                      )}
                    </td>

                    {/* Title + meta */}
                    <td className="py-2.5 px-4 text-left">
                      <p className="text-[13px] text-on-surface font-medium leading-tight truncate max-w-[240px]">{d.title || "Untitled"}</p>
                      <p className="text-[11px] text-on-surface-variant mt-0.5">{d.originator} · {d.transmittals ?? 0} Tx</p>
                    </td>

                    {/* Discipline */}
                    <td className="py-2.5 px-4 text-left">
                      <span className="px-2 py-0.5 rounded bg-surface-container border border-border-slate text-on-surface-variant text-[11px] font-medium">{d.discipline}</span>
                    </td>

                    {/* Rev */}
                    <td className="py-2.5 px-4 text-left">
                      <span className="font-mono text-[13px] text-on-surface">{d.rev}</span>
                    </td>

                    {/* Status */}
                    <td className="py-2.5 px-4 text-left">
                      <span className={`rounded-full px-2.5 py-1 text-[11px] font-bold inline-flex items-center gap-1.5 ${s.pillCls}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`} />
                        {s.label}
                      </span>
                    </td>

                    {/* Date */}
                    <td className="py-2.5 px-4 text-left text-[12px] text-on-surface-variant">{d.issueDate ?? "—"}</td>

                    {/* Actions — always-visible MoreVertical menu */}
                    <td className="py-2.5 px-4 text-left">
                      <RowMenu
                        d={d}
                        isRestricted={isRestricted}
                        onView={() => handleView(d)}
                        onDownload={() => handleDownload(d)}
                        onVoid={() => handleVoidClick(d)}
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="bg-surface-container-low border-t border-border-slate px-4 py-3 flex items-center justify-between">
          <p className="text-[12px] text-on-surface-variant">
            {drawings.length > 0
              ? `Showing ${(page - 1) * 8 + 1}–${(page - 1) * 8 + drawings.length} of ${total}`
              : "No results"}
          </p>
          {totalPages > 1 && (
            <div className="flex items-center gap-1.5">
              <PagBtn onClick={() => onPageChange?.(page - 1)} disabled={page <= 1}         icon="chevron_left"  />
              {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
                const p = totalPages <= 7 ? i + 1 : i < 3 ? i + 1 : i === 3 ? "..." : totalPages - (6 - i);
                if (p === "...") return <span key="ell" className="w-8 text-center text-on-surface-variant text-[12px]">…</span>;
                return (
                  <button
                    key={p}
                    onClick={() => onPageChange?.(p)}
                    className={`w-8 h-8 rounded-lg text-[12px] font-medium transition-colors ${
                      p === page
                        ? "bg-primary text-white"
                        : "bg-white border border-border-slate text-on-surface-variant hover:bg-surface-container-low"
                    }`}
                  >{p}</button>
                );
              })}
              <PagBtn onClick={() => onPageChange?.(page + 1)} disabled={page >= totalPages} icon="chevron_right" />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ── RowMenu — portal-based dropdown (escapes overflow:hidden on table) ── */
function RowMenu({ d, isRestricted, onView, onDownload, onVoid }) {
  const [open,    setOpen]    = useState(false);
  const [menuPos, setMenuPos] = useState({ top: 0, left: 0 });
  const btnRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    const close = e => { if (!btnRef.current?.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);

  const handleClick = () => {
    if (!open && btnRef.current) {
      const r = btnRef.current.getBoundingClientRect();
      setMenuPos({ top: r.bottom + 4, left: r.left });
    }
    setOpen(o => !o);
  };

  return (
    <>
      <button
        ref={btnRef}
        onClick={handleClick}
        className="p-1.5 rounded-lg text-on-surface-variant hover:text-on-surface hover:bg-surface-container transition-colors"
        title="More actions"
      >
        <MoreVertical size={15} />
      </button>

      {open && createPortal(
        <div
          style={{ position: "fixed", top: menuPos.top, left: menuPos.left, zIndex: 9999 }}
          className="w-44 bg-white border border-border-slate rounded-xl shadow-lg py-1 overflow-hidden"
        >
          <DropItem icon={<Eye size={14} />}      label="View"     onClick={() => { onView();     setOpen(false); }} disabled={!d.path} />
          <DropItem icon={<Download size={14} />} label="Download" onClick={() => { onDownload(); setOpen(false); }} disabled={!d.path} />
          {!isRestricted && d.status !== "VOID" && (
            <>
              <div className="h-px bg-border-slate mx-2 my-1" />
              <DropItem icon={<Ban size={14} />} label="Void Drawing" onClick={() => { onVoid(); setOpen(false); }} danger />
            </>
          )}
        </div>,
        document.body
      )}
    </>
  );
}

function DropItem({ icon, label, onClick, disabled = false, danger = false }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`w-full flex items-center gap-2.5 px-3 py-2 text-[13px] font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
        danger
          ? "text-status-rose-text hover:bg-status-rose-bg"
          : "text-on-surface-variant hover:text-on-surface hover:bg-surface-container-low"
      }`}
    >
      {icon}
      {label}
    </button>
  );
}

/* ── Pagination button ── */
function PagBtn({ onClick, disabled, icon }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="w-8 h-8 rounded-lg flex items-center justify-center bg-white border border-border-slate text-on-surface-variant hover:bg-surface-container-low disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
    >
      <span className="material-symbols-outlined text-[18px]">{icon}</span>
    </button>
  );
}

/* ── Drawing Type dropdown item ── */
function TypeItem({ label, active, onClick, isGroup = false, indent = false }) {
  return (
    <button
      onClick={onClick}
      className={`w-full text-left flex items-center gap-2 transition-colors text-[12px] font-medium
        ${indent ? "pl-7 pr-3 py-1.5" : "px-3 py-2"}
        ${active
          ? "text-primary bg-primary/10"
          : isGroup
            ? "text-on-surface hover:bg-surface-container-low"
            : "text-on-surface-variant hover:text-on-surface hover:bg-surface-container-low"
        }`}
    >
      {indent
        ? <span className="w-1 h-1 rounded-full bg-on-surface-variant/50 shrink-0" />
        : <span className={`material-symbols-outlined text-[13px] text-primary ${active ? "opacity-100" : "opacity-0"}`}>check</span>
      }
      {label}
      {isGroup && !active && <span className="ml-auto text-[9px] text-outline uppercase tracking-wider">all</span>}
    </button>
  );
}
