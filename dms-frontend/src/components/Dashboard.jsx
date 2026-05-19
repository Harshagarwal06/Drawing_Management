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
        <h2 className="font-headline-lg text-headline-lg text-on-surface">Project Dashboard</h2>
        <p className="font-body-md text-on-surface-variant mt-1">Real-time status overview of project documentation and delivery.</p>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <MetricCard
          icon="architecture"
          badge={{ label: `${drawings.filter(d=>d.status==="S3").length} issued`, cls: "text-status-emerald-text bg-status-emerald-bg" }}
          title="TOTAL DRAWINGS"
          value={totalDrawings}
          iconBg="bg-primary/5"
          iconColor="text-primary"
          onClick={() => navigate("/register")}
        />
        <MetricCard
          icon="move_to_inbox"
          badge={{ label: "+recent", cls: "text-status-emerald-text bg-status-emerald-bg" }}
          title="ISSUED TRANSMITTALS"
          value={totalTransmittals}
          iconBg="bg-primary/5"
          iconColor="text-primary"
          onClick={() => navigate("/transmittals")}
        />
        <MetricCard
          icon="update"
          badge={{ label: "Active", cls: "text-status-amber-text bg-status-amber-bg" }}
          title="PENDING APPROVAL"
          value={latestRevisions}
          iconBg="bg-primary/5"
          iconColor="text-primary"
          onClick={() => navigate("/register", { state: { filterStat: "S2" } })}
        />
        <MetricCard
          icon="warning"
          badge={{ label: overdueItems > 0 ? "Critical" : "On Track", cls: overdueItems > 0 ? "text-status-rose-text bg-status-rose-bg" : "text-status-emerald-text bg-status-emerald-bg" }}
          title="OVERDUE ITEMS"
          value={overdueItems}
          iconBg={overdueItems > 0 ? "bg-status-rose-bg" : "bg-status-emerald-bg"}
          iconColor={overdueItems > 0 ? "text-status-rose-text" : "text-status-emerald-text"}
          onClick={() => navigate("/transmittals")}
        />
      </div>

      {/* Chart + Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">

        {/* Chart (Discipline Breakdown) */}
        <div className="lg:col-span-8 bg-white border border-border-slate rounded-xl p-8 flex flex-col">
          <div className="flex justify-between items-center mb-8">
            <div>
              <h4 className="font-headline-md text-headline-md text-on-surface">Drawings by Discipline</h4>
              <p className="font-body-sm text-on-surface-variant">Status breakdown per drawing type.</p>
            </div>
            <div className="flex gap-4">
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
            <div className="flex-1 flex items-end gap-3 h-52 w-full">
              {discEntries.slice(0, 8).map(([disc, counts]) => (
                <div key={disc} className="flex-1 flex flex-col justify-end items-center gap-1 h-full">
                  <div className="w-full flex flex-col justify-end gap-0.5 flex-1">
                    {Object.entries(STATUS_META).map(([code, { color }]) =>
                      counts[code] > 0 ? (
                        <div
                          key={code}
                          title={`${STATUS_META[code].label}: ${counts[code]}`}
                          className="w-full rounded-t-sm transition-all"
                          style={{
                            height: `${(counts[code] / maxTotal) * 160}px`,
                            backgroundColor: color,
                            opacity: 0.85,
                          }}
                        />
                      ) : null
                    )}
                  </div>
                  <span className="text-center font-label-sm text-[10px] text-on-surface-variant mt-2 truncate w-full text-center">{disc.slice(0,4)}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Activity Feed — timeline style */}
        <div className="lg:col-span-4 bg-white border border-border-slate rounded-xl flex flex-col">
          <div className="p-6 border-b border-border-slate">
            <h4 className="font-headline-md text-headline-md text-on-surface">Activity Feed</h4>
            <p className="font-body-sm text-on-surface-variant">Recent project events and updates.</p>
          </div>
          <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar">
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

function MetricCard({ icon, badge, title, value, iconBg, iconColor, onClick }) {
  return (
    <div
      className={`bg-white border border-border-slate p-6 rounded-xl hover:shadow-md transition-shadow ${onClick ? "cursor-pointer" : ""}`}
      onClick={onClick}
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={onClick ? (e) => { if (e.key === "Enter" || e.key === " ") onClick(); } : undefined}
    >
      <div className="flex justify-between items-start mb-4">
        <div className={`p-2 rounded-lg ${iconBg} ${iconColor}`}>
          <span className="material-symbols-outlined text-[22px]" style={{ fontVariationSettings: "'FILL' 0" }}>{icon}</span>
        </div>
        <span className={`px-2 py-1 rounded-full font-label-sm text-[10px] ${badge.cls}`}>{badge.label}</span>
      </div>
      <p className="font-label-sm text-on-surface-variant mb-1 uppercase tracking-wider">{title}</p>
      <h3 className="font-headline-md text-headline-md text-on-surface font-bold">{value}</h3>
    </div>
  );
}
