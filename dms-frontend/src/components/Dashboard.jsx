import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

const API = import.meta.env.VITE_API_URL;

const STATUS_META = {
  S3:   { label: "For Construction", color: "#059669" },
  S2:   { label: "For Approval",     color: "#d97706" },
  S1:   { label: "For Information",  color: "#2563eb" },
  VOID: { label: "Void",             color: "#dc2626" },
};

const STATUS_DISPLAY = {
  S3:   { label: "For Construction", textCls: "text-status-emerald-text", bgCls: "bg-status-emerald-bg" },
  S2:   { label: "For Approval",     textCls: "text-status-amber-text",   bgCls: "bg-status-amber-bg"   },
  S1:   { label: "For Information",  textCls: "text-blue-600",            bgCls: "bg-blue-50"           },
  VOID: { label: "Void",             textCls: "text-status-rose-text",    bgCls: "bg-status-rose-bg"    },
};

const ACTIVITY_ICONS = {
  upload:      { icon: "upload_file",      bgCls: "bg-primary-fixed/30",     textCls: "text-primary"              },
  revision:    { icon: "edit",             bgCls: "bg-primary-fixed/30",     textCls: "text-primary"              },
  transmittal: { icon: "check_circle",     bgCls: "bg-status-emerald-bg",    textCls: "text-status-emerald-text"  },
  void:        { icon: "error",            bgCls: "bg-status-rose-bg",       textCls: "text-status-rose-text"     },
};

function timeAgo(iso) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1)  return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export default function Dashboard({
  totalDrawings, totalTransmittals, latestRevisions, overdueItems,
  drawings, activeProjectId, token,
}) {
  const navigate = useNavigate();
  const [activity, setActivity]           = useState([]);
  const [activityError, setActivityError] = useState(false);

  useEffect(() => {
    if (!activeProjectId || !token) return;
    setActivityError(false);
    fetch(`${API}/api/activity?projectId=${activeProjectId}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(r => r.ok ? r.json() : Promise.reject())
      .then(setActivity)
      .catch(() => setActivityError(true));
  }, [activeProjectId, token]);

  /* Discipline breakdown */
  const byDisc = {};
  drawings.forEach(d => {
    if (!byDisc[d.discipline]) byDisc[d.discipline] = { S1: 0, S2: 0, S3: 0, VOID: 0, total: 0 };
    byDisc[d.discipline][d.status] = (byDisc[d.discipline][d.status] || 0) + 1;
    byDisc[d.discipline].total += 1;
  });
  const discEntries = Object.entries(byDisc).sort((a, b) => b[1].total - a[1].total);
  const maxTotal = Math.max(...discEntries.map(([, v]) => v.total), 1);

  /* Latest drawings — sorted by issue date descending, fall back to id */
  const latestDrawings = [...drawings]
    .sort((a, b) => {
      const da = a.issueDate ? new Date(a.issueDate).getTime() : 0;
      const db = b.issueDate ? new Date(b.issueDate).getTime() : 0;
      return db - da || b.id - a.id;
    })
    .slice(0, 5);

  return (
    <div className="space-y-8">
      {/* Page Header */}
      <div>
        <h2 className="font-semibold text-[22px] md:text-headline-lg text-on-surface">Project Dashboard</h2>
        <p className="font-body-md text-on-surface-variant mt-1">Real-time status overview of project documentation and delivery.</p>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          icon="architecture"
          title="TOTAL DRAWINGS"
          value={totalDrawings}
          sub={`${drawings.filter(d => d.status === "S3").length} for construction`}
          iconBg="bg-primary/5"
          iconColor="text-primary"
          onClick={() => navigate("/register")}
        />
        <MetricCard
          icon="move_to_inbox"
          title="ISSUED TRANSMITTALS"
          value={totalTransmittals}
          sub="Sent to recipients"
          iconBg="bg-primary/5"
          iconColor="text-primary"
          onClick={() => navigate("/transmittals")}
        />
        <MetricCard
          icon="update"
          title="PENDING APPROVAL"
          value={latestRevisions}
          sub="Awaiting review"
          iconBg="bg-primary/5"
          iconColor="text-primary"
          onClick={() => navigate("/register", { state: { filterStat: "S2" } })}
        />
        <MetricCard
          icon="warning"
          title="OVERDUE ITEMS"
          value={overdueItems}
          sub={overdueItems > 0 ? "Needs attention" : "Nothing overdue"}
          badge={overdueItems > 0 ? { label: "Critical", cls: "text-status-rose-text bg-status-rose-bg" } : undefined}
          iconBg={overdueItems > 0 ? "bg-status-rose-bg" : "bg-status-emerald-bg"}
          iconColor={overdueItems > 0 ? "text-status-rose-text" : "text-status-emerald-text"}
          onClick={() => navigate("/transmittals")}
        />
      </div>

      {/* Chart + Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">

        {/* Chart (Discipline Breakdown) */}
        <div className="lg:col-span-8 bg-white border border-border-slate rounded-xl p-8 flex flex-col lg:h-[460px]">
          <div className="flex justify-between items-center mb-8">
            <div>
              <h4 className="font-headline-md text-headline-md text-on-surface">Drawings by Discipline</h4>
              <p className="font-body-sm text-on-surface-variant">Status breakdown per drawing type.</p>
            </div>
            <div className="flex gap-2 flex-wrap justify-end">
              {Object.entries(STATUS_META).map(([code, { label, color }]) => (
                <div key={code} className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: color }} />
                  <span className="font-label-sm text-on-surface-variant text-[11px]">{label}</span>
                </div>
              ))}
            </div>
          </div>

          {discEntries.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center h-40 gap-3 text-on-surface-variant">
              <span className="material-symbols-outlined text-[48px] opacity-25">bar_chart</span>
              <p className="font-body-sm text-body-sm">Upload drawings to see the breakdown</p>
            </div>
          ) : (
            <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar space-y-4">
              {discEntries.map(([disc, counts]) => (
                <div key={disc} className="flex items-center gap-4">
                  <span className="font-label-sm text-[12px] text-on-surface-variant w-32 shrink-0 truncate" title={disc}>{disc}</span>
                  <div className="flex-1 flex h-6 rounded-md overflow-hidden bg-surface-container">
                    {Object.entries(STATUS_META).map(([code, { color }]) =>
                      counts[code] > 0 ? (
                        <div
                          key={code}
                          title={`${STATUS_META[code].label}: ${counts[code]}`}
                          className="h-full transition-all"
                          style={{ width: `${(counts[code] / maxTotal) * 100}%`, backgroundColor: color, opacity: 0.85 }}
                        />
                      ) : null
                    )}
                  </div>
                  <span className="font-mono text-[12px] text-on-surface w-8 text-right shrink-0">{counts.total}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Activity Feed — timeline style */}
        <div className="lg:col-span-4 bg-white border border-border-slate rounded-xl flex flex-col lg:h-[460px]">
          <div className="p-6 border-b border-border-slate">
            <h4 className="font-headline-md text-headline-md text-on-surface">Activity Feed</h4>
            <p className="font-body-sm text-on-surface-variant">Recent project events and updates.</p>
          </div>
          <div className="flex-1 min-h-0 overflow-y-auto p-6 space-y-6 custom-scrollbar">
            {activityError ? (
              <div className="flex flex-col items-center justify-center h-40 gap-3 text-on-surface-variant">
                <span className="material-symbols-outlined text-[36px] opacity-30">wifi_off</span>
                <p className="font-body-sm text-body-sm text-center text-status-rose-text">Could not load activity — check your connection.</p>
              </div>
            ) : activity.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-40 gap-3 text-on-surface-variant">
                <span className="material-symbols-outlined text-[36px] opacity-30">notifications_none</span>
                <p className="font-body-sm text-body-sm text-center">Activity will appear here as you upload drawings and issue transmittals.</p>
              </div>
            ) : (
              activity.map((item, i) => {
                const meta = ACTIVITY_ICONS[item.type] || ACTIVITY_ICONS.upload;
                const isLast = i === activity.length - 1;
                return (
                  <div key={item.id} className="flex gap-4 relative">
                    {!isLast && (
                      <div className="absolute left-4 top-8 bottom-0 w-px bg-border-slate -mb-6" />
                    )}
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 z-10 ${meta.bgCls}`}>
                      <span className={`material-symbols-outlined text-[18px] ${meta.textCls}`}>{meta.icon}</span>
                    </div>
                    <div>
                      <p className="font-body-md text-on-surface text-[13px] leading-snug">{item.title}</p>
                      {item.detail && (
                        <p className="font-label-sm text-[11px] text-on-surface-variant mt-1">{item.detail} · {timeAgo(item.created_at)}</p>
                      )}
                      {!item.detail && (
                        <p className="font-label-sm text-[11px] text-on-surface-variant mt-1">{timeAgo(item.created_at)}</p>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
          <div className="px-6 py-3 border-t border-border-slate shrink-0">
            <button
              onClick={() => navigate("/register")}
              className="w-full text-center text-[12px] font-medium text-primary hover:underline"
            >
              View All Activity
            </button>
          </div>
        </div>
      </div>

      {/* Latest Drawing Revisions Table */}
      <div className="bg-white border border-border-slate rounded-xl overflow-hidden">
        <div className="p-6 border-b border-border-slate flex justify-between items-center">
          <div>
            <h4 className="font-headline-md text-headline-md text-on-surface">Latest Drawing Revisions</h4>
            <p className="font-body-sm text-on-surface-variant">Recently uploaded and updated drawings.</p>
          </div>
          <button onClick={() => navigate("/register")} className="text-primary font-label-md hover:underline text-[13px]">
            View Register
          </button>
        </div>
        <div className="overflow-x-auto">
          {latestDrawings.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-32 gap-3 text-on-surface-variant">
              <span className="material-symbols-outlined text-[36px] opacity-25">folder_open</span>
              <p className="font-body-sm text-body-sm">No drawings uploaded yet.</p>
            </div>
          ) : (
            <table className="w-full text-left">
              <thead className="bg-surface-container-low border-b border-border-slate">
                <tr>
                  {["Sheet No.", "Title", "Rev", "Date", "Status"].map((h) => (
                    <th key={h} className="px-6 py-4 font-label-sm text-on-surface-variant uppercase tracking-wider text-[11px]">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border-slate">
                {latestDrawings.map(d => {
                  const s = STATUS_DISPLAY[d.status] || { label: d.status, textCls: "text-on-surface-variant", bgCls: "bg-surface-container" };
                  return (
                    <tr key={d.id} className="hover:bg-surface-container-low transition-colors">
                      <td className="px-6 py-4 font-body-md font-bold text-primary text-[13px]">{d.number}</td>
                      <td className="px-6 py-4 font-body-md text-on-surface text-[13px] max-w-[260px] truncate">{d.title || "Untitled"}</td>
                      <td className="px-6 py-4 font-body-md text-[13px]">Rev {d.rev}</td>
                      <td className="px-6 py-4 font-body-md text-on-surface-variant text-[13px]">{d.issueDate ?? "—"}</td>
                      <td className="px-6 py-4">
                        <span className={`px-3 py-1 rounded-full font-label-sm text-[11px] ${s.bgCls} ${s.textCls}`}>{s.label}</span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}

function MetricCard({ icon, badge, title, value, sub, iconBg, iconColor, onClick }) {
  return (
    <div
      className={`bg-white border border-border-slate p-5 rounded-xl hover:shadow-md transition-shadow flex items-start gap-4 ${onClick ? "cursor-pointer" : ""}`}
      onClick={onClick}
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={onClick ? (e) => { if (e.key === "Enter" || e.key === " ") onClick(); } : undefined}
    >
      <div className={`p-2.5 rounded-lg shrink-0 ${iconBg} ${iconColor}`}>
        <span className="material-symbols-outlined text-[22px]" style={{ fontVariationSettings: "'FILL' 0" }}>{icon}</span>
      </div>
      <div className="min-w-0">
        <p className="font-label-sm text-[11px] text-on-surface-variant uppercase tracking-wider truncate">{title}</p>
        <div className="flex items-center gap-2 mt-0.5">
          <h3 className="font-headline-md text-headline-md text-on-surface font-bold">{value}</h3>
          {badge && (
            <span className={`px-2 py-0.5 rounded-full font-label-sm text-[10px] ${badge.cls}`}>{badge.label}</span>
          )}
        </div>
        {sub && <p className="font-body-sm text-[11px] text-on-surface-variant mt-0.5 truncate">{sub}</p>}
      </div>
    </div>
  );
}
