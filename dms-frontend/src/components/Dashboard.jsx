import { useEffect, useState } from "react";

const API = import.meta.env.VITE_API_URL;

const STATUS_META = {
  S3:   { label: "For Construction", color: "#34d399" },
  S2:   { label: "For Approval",     color: "#fbbf24" },
  S1:   { label: "For Information",  color: "#60a5fa" },
  VOID: { label: "Void",             color: "#f87171" },
};

const ACTIVITY_ICONS = {
  upload:      { icon: "upload_file",       color: "text-primary",  bg: "bg-primary/10"  },
  revision:    { icon: "history",           color: "text-blue-400", bg: "bg-blue-500/10" },
  transmittal: { icon: "send_and_archive",  color: "text-tertiary", bg: "bg-tertiary/10" },
  void:        { icon: "block",             color: "text-red-400",  bg: "bg-red-500/10"  },
};

function timeAgo(iso) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1)  return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}

export default function Dashboard({ totalDrawings, totalTransmittals, latestRevisions, overdueItems, drawings, activeProjectId, token }) {
  const [activity, setActivity] = useState([]);

  useEffect(() => {
    if (!activeProjectId || !token) return;
    fetch(`${API}/api/activity?projectId=${activeProjectId}`, {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then(r => r.ok ? r.json() : [])
      .then(setActivity)
      .catch(() => {});
  }, [activeProjectId, token]);

  /* ── Discipline breakdown ── */
  const byDisc = {};
  drawings.forEach(d => {
    if (!byDisc[d.discipline]) byDisc[d.discipline] = { S1: 0, S2: 0, S3: 0, VOID: 0, total: 0 };
    byDisc[d.discipline][d.status] = (byDisc[d.discipline][d.status] || 0) + 1;
    byDisc[d.discipline].total += 1;
  });
  const discEntries = Object.entries(byDisc).sort((a, b) => b[1].total - a[1].total);
  const maxTotal = Math.max(...discEntries.map(([, v]) => v.total), 1);

  /* ── Status breakdown for donut-style summary ── */
  const statusCounts = { S3: 0, S2: 0, S1: 0, VOID: 0 };
  drawings.forEach(d => { if (statusCounts[d.status] !== undefined) statusCounts[d.status]++; });

  return (
    <div className="max-w-[1600px] mx-auto space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="font-display-lg text-display-lg text-on-surface tracking-tight">Dashboard</h1>
          <p className="font-body-md text-body-md text-on-surface-variant mt-1">Project Status & Activity</p>
        </div>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <MetricCard title="Total Drawings"      icon="architecture"     value={totalDrawings}     subValue={`${statusCounts.S3} for construction`} color="primary" />
        <MetricCard title="Issued Transmittals" icon="send_and_archive" value={totalTransmittals}  subValue={overdueItems > 0 ? `${overdueItems} overdue` : "All on schedule"} color="tertiary" />
        <MetricCard title="Pending Approval"    icon="pending_actions"  value={latestRevisions}   subValue="Awaiting review"   color="primary-container" />
        <MetricCard title="Overdue Items"       icon="warning"          value={overdueItems}       subValue="Requires attention" color="rose" />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Left: chart + recent drawings */}
        <div className="xl:col-span-2 space-y-6">

          {/* Discipline Breakdown Chart */}
          <div className="bg-slate-900/70 dark:bg-white/5 backdrop-blur-xl border border-white/10 rounded-xl p-6 shadow-[0_20px_25px_-5px_rgba(0,0,0,0.5)]">
            <div className="flex items-center justify-between mb-6">
              <h2 className="font-headline-sm text-headline-sm text-on-surface font-semibold">Drawings by Discipline</h2>
              <div className="flex items-center gap-4">
                {Object.entries(STATUS_META).map(([code, { label, color }]) => (
                  <div key={code} className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full" style={{ backgroundColor: color }} />
                    <span className="font-label-sm text-[10px] text-on-surface-variant">{label}</span>
                  </div>
                ))}
              </div>
            </div>

            {discEntries.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-40 gap-3 text-on-surface-variant">
                <span className="material-symbols-outlined text-[40px] opacity-30">bar_chart</span>
                <p className="font-body-sm text-body-sm">Upload drawings to see the breakdown</p>
              </div>
            ) : (
              <div className="space-y-3">
                {discEntries.map(([disc, counts]) => (
                  <div key={disc} className="flex items-center gap-4 group">
                    <span className="font-label-sm text-[11px] text-on-surface-variant w-28 shrink-0 truncate" title={disc}>{disc}</span>
                    <div className="flex-1 flex h-5 rounded-md overflow-hidden bg-surface-container">
                      {Object.entries(STATUS_META).map(([code, { color }]) =>
                        counts[code] > 0 ? (
                          <div
                            key={code}
                            title={`${STATUS_META[code].label}: ${counts[code]}`}
                            className="h-full transition-all"
                            style={{ width: `${(counts[code] / maxTotal) * 100}%`, backgroundColor: color + "b3" }}
                          />
                        ) : null
                      )}
                    </div>
                    <span className="font-mono text-[11px] text-on-surface-variant w-6 text-right shrink-0">{counts.total}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Status Summary Row */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {Object.entries(STATUS_META).map(([code, { label, color }]) => (
              <div key={code} className="bg-slate-900/70 dark:bg-white/5 backdrop-blur-xl border border-white/10 rounded-xl p-4 shadow-[0_10px_15px_-3px_rgba(0,0,0,0.4)]">
                <div className="flex items-center gap-2 mb-2">
                  <span className="w-2 h-2 rounded-full" style={{ backgroundColor: color }} />
                  <span className="font-label-sm text-[10px] text-on-surface-variant uppercase tracking-wide">{label}</span>
                </div>
                <p className="font-headline-sm text-headline-sm text-on-surface font-bold">{statusCounts[code]}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Right: Activity Feed */}
        <div className="xl:col-span-1">
          <div className="bg-slate-900/70 dark:bg-white/5 backdrop-blur-xl border border-white/10 rounded-xl p-6 shadow-[0_20px_25px_-5px_rgba(0,0,0,0.5)] flex flex-col" style={{ minHeight: "420px" }}>
            <div className="flex items-center justify-between mb-5 shrink-0">
              <h2 className="font-headline-sm text-headline-sm text-on-surface font-semibold">Activity Feed</h2>
              <span className="font-label-sm text-[10px] text-outline uppercase tracking-wider">{activity.length} events</span>
            </div>
            <div className="flex-1 overflow-y-auto pr-1 space-y-1 custom-scrollbar">
              {activity.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-40 gap-3 text-on-surface-variant">
                  <span className="material-symbols-outlined text-[36px] opacity-30">notifications_none</span>
                  <p className="font-body-sm text-body-sm text-center">Activity will appear here as you upload drawings and issue transmittals.</p>
                </div>
              ) : (
                activity.map((item, i) => {
                  const meta = ACTIVITY_ICONS[item.type] || ACTIVITY_ICONS.upload;
                  return (
                    <div key={item.id} className="flex gap-3 p-2.5 rounded-lg hover:bg-white/5 transition-colors">
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${meta.bg}`}>
                        <span className={`material-symbols-outlined text-[16px] ${meta.color}`}>{meta.icon}</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-label-sm text-[12px] text-on-surface leading-tight truncate">{item.title}</p>
                        {item.detail && (
                          <p className="font-body-sm text-[11px] text-on-surface-variant leading-tight mt-0.5 truncate">{item.detail}</p>
                        )}
                        <p className="font-label-sm text-[10px] text-outline mt-1">{timeAgo(item.created_at)}</p>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function MetricCard({ title, icon, value, subValue, color }) {
  const colorMap = {
    "primary":           "bg-primary text-primary",
    "tertiary":          "bg-tertiary text-tertiary",
    "primary-container": "bg-primary-container text-primary-container",
    "rose":              "bg-rose-500 text-rose-500",
  };
  const glowMap = {
    "primary":           "bg-primary/10 group-hover:bg-primary/20",
    "tertiary":          "bg-tertiary/10 group-hover:bg-tertiary/20",
    "primary-container": "bg-primary-container/10 group-hover:bg-primary-container/20",
    "rose":              "bg-rose-500/10 group-hover:bg-rose-500/20",
  };
  return (
    <div className={`relative overflow-hidden rounded-xl bg-slate-900/70 dark:bg-white/5 backdrop-blur-xl border ${color === "rose" ? "border-rose-500/20" : "border-white/10"} p-6 shadow-[0_20px_25px_-5px_rgba(0,0,0,0.5)] group hover:-translate-y-1 transition-transform duration-300`}>
      <div className={`absolute top-0 right-0 w-32 h-32 rounded-full blur-3xl -mr-10 -mt-10 transition-colors ${glowMap[color]}`} />
      <div className="relative z-10 flex flex-col h-full justify-between gap-4">
        <div className="flex items-start justify-between">
          <span className={`font-label-sm text-label-sm uppercase tracking-wider ${color === "rose" ? "text-rose-400" : "text-on-surface-variant"}`}>{title}</span>
          <div className={`w-8 h-8 rounded-full flex items-center justify-center ${colorMap[color]} bg-opacity-10`}>
            <span className="material-symbols-outlined text-[18px]">{icon}</span>
          </div>
        </div>
        <div>
          <div className="font-headline-lg text-headline-lg text-on-surface font-bold">{value}</div>
          <div className={`flex items-center gap-1 mt-1 font-body-sm text-body-sm ${color === "rose" ? "text-rose-400" : "text-emerald-400"}`}>
            <span className="material-symbols-outlined text-[14px]">info</span>
            <span>{subValue}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
