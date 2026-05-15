import { ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";

export function SortIcon({ col, sortKey, sortDir }) {
  if (sortKey !== col) return <ArrowUpDown className="inline w-3 h-3 ml-1 text-slate-300" />;
  return sortDir === "asc"
    ? <ArrowUp className="inline w-3 h-3 ml-1 text-blue-500" />
    : <ArrowDown className="inline w-3 h-3 ml-1 text-blue-500" />;
}

export function Th({ col, label, cls = "", sortKey, sortDir, onSort }) {
  return (
    <th
      className={`px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider cursor-pointer select-none whitespace-nowrap hover:text-slate-700 ${cls}`}
      onClick={() => onSort(col)}
    >
      {label}
      <SortIcon col={col} sortKey={sortKey} sortDir={sortDir} />
    </th>
  );
}
