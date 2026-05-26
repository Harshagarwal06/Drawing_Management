export const API = import.meta.env.VITE_API_URL;
export const resolveUrl = p => p?.startsWith('http') ? p : `${API}${p}`;

export const PALETTE = ["#3525cd", "#2563eb", "#059669", "#d97706", "#9333ea"];
export const projectDot = idx => PALETTE[idx % PALETTE.length];

export const STATUS_PILL = {
  S3:   "bg-status-emerald-bg text-status-emerald-text",
  S2:   "bg-status-amber-bg   text-status-amber-text",
  S1:   "bg-blue-50           text-blue-700",
  VOID: "bg-status-rose-bg    text-status-rose-text",
};
export const STATUS_LABEL = {
  S3: "For Construction", S2: "For Approval", S1: "For Information", VOID: "Void",
};
export const STATUS_BAR = {
  S3:   "bg-status-emerald-text",
  S2:   "bg-status-amber-text",
  VOID: "bg-status-rose-text",
  S1:   "bg-blue-400",
};
export const EXT_STYLE = {
  PDF: "bg-red-50    text-red-600",
  DWG: "bg-blue-50   text-blue-700",
  DXF: "bg-indigo-50 text-indigo-600",
  IFC: "bg-purple-50 text-purple-600",
  RVT: "bg-orange-50 text-orange-600",
};

export function nextRev(rev) {
  if (!rev) return "A";
  const c = rev.trim().toUpperCase();
  if (/^[A-Z]$/.test(c)) return String.fromCharCode(c.charCodeAt(0) + 1);
  return c;
}

export function countDescendants(node) {
  let n = 0;
  for (const c of node.children ?? []) n += 1 + countDescendants(c);
  return n;
}
