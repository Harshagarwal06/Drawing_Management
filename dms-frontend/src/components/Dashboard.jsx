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
  ack:         { icon: "task_alt",         bgCls: "bg-status-emerald-bg",    textCls: "text-status-emerald-text"  },
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
  drawings, activeProjectId, token, userName,
}) {
  const navigate = useNavigate();
  const [activity, setActivity] = useState([]);
  /* Project whose activity fetch failed — derived flag clears as soon as the project changes */
  const [activityErrorId, setActivityErrorId] = useState(null);
  const activityError = activityErrorId !== null && activityErrorId === activeProjectId;

  useEffect(() => {
    if (!activeProjectId || !token) return;
    fetch(`${API}/api/activity?projectId=${activeProjectId}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(r => r.ok ? r.json() : Promise.reject())
      .then(data => { setActivity(data); setActivityErrorId(null); })
      .catch(() => setActivityErrorId(activeProjectId));
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
    <>
      {/* ── Mobile (Material 3) dashboard ── */}
      <MobileDashboard
        drawings={drawings}
        totalDrawings={totalDrawings}
        totalTransmittals={totalTransmittals}
        pending={latestRevisions}
        overdue={overdueItems}
        activity={activity}
        activityError={activityError}
        userName={userName}
        onNavigate={navigate}
      />

      {/* ── Desktop dashboard ── */}
      <div className="hidden md:block space-y-8">
      {/* Page Header */}
      <div>
        <h2 className="font-space-grotesk font-semibold text-headline-lg text-on-surface">Project Dashboard</h2>
        <p className="font-body-md text-on-surface-variant mt-1">Real-time status overview of project documentation and delivery.</p>
      </div>

      {/* Metric Cards — hero spans left 2×2 block; Transmittals+Pending fill row-1 right; Overdue fills row-2 right */}
      <div className="grid grid-cols-2 lg:grid-cols-4 lg:grid-rows-2 gap-3 md:gap-4">

        {/* Hero: Total Drawings — spans 2 cols × 2 rows on desktop */}
        <div
          className="col-span-2 lg:col-span-2 lg:row-span-2 bg-surface border border-border-slate rounded-xl p-5 hover:shadow-md transition-shadow cursor-pointer group focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 outline-none"
          onClick={() => navigate("/register")}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") navigate("/register"); }}
        >
          <div className="flex items-start justify-between mb-4">
            <div className="p-2.5 rounded-lg bg-primary/5">
              <span className="material-symbols-outlined text-[22px] text-primary" style={{ fontVariationSettings: "'FILL' 0" }}>architecture</span>
            </div>
            <span className="material-symbols-outlined text-[16px] text-on-surface-variant group-hover:text-primary transition-colors">arrow_forward</span>
          </div>
          <p className="text-[11px] text-on-surface-variant uppercase tracking-wider mb-1">Total Drawings</p>
          <h3 className="font-space-grotesk text-[52px] font-bold leading-none tracking-[-0.02em] text-on-surface">{totalDrawings}</h3>
          <p className="text-[12px] text-on-surface-variant mt-2">{drawings.filter(d => d.status === "S3").length} for construction</p>
          {totalDrawings > 0 && (
            <div className="mt-4 flex h-1.5 rounded-full overflow-hidden gap-px">
              {[
                { code: "S3", color: "#059669" },
                { code: "S2", color: "#d97706" },
                { code: "S1", color: "#2563eb" },
                { code: "VOID", color: "#dc2626" },
              ].map(({ code, color }) => {
                const count = drawings.filter(d => d.status === code).length;
                return count > 0 ? (
                  <div key={code} className="h-full" style={{ width: `${(count / totalDrawings) * 100}%`, backgroundColor: color }} />
                ) : null;
              })}
            </div>
          )}
        </div>

        <MetricCard
          icon="move_to_inbox"
          title="TRANSMITTALS"
          value={totalTransmittals}
          sub="Sent to recipients"
          iconBg="bg-primary/5"
          iconColor="text-primary"
          mobileTileBg="bg-status-emerald-bg"
          mobileIconBg="bg-status-emerald-text/10"
          mobileIconColor="text-status-emerald-text"
          mobileValueColor="text-status-emerald-text"
          mobileLabelColor="text-status-emerald-text/70"
          onClick={() => navigate("/transmittals")}
        />
        <MetricCard
          icon="update"
          title="PENDING"
          value={latestRevisions}
          sub="Awaiting review"
          iconBg="bg-primary/5"
          iconColor="text-primary"
          mobileTileBg="bg-status-amber-bg"
          mobileIconBg="bg-status-amber-text/10"
          mobileIconColor="text-status-amber-text"
          mobileValueColor="text-status-amber-text"
          mobileLabelColor="text-status-amber-text/70"
          onClick={() => navigate("/register", { state: { filterStat: "S2" } })}
        />
        <MetricCard
          icon="warning"
          title="OVERDUE"
          value={overdueItems}
          sub={overdueItems > 0 ? "Needs attention" : "Nothing overdue"}
          badge={overdueItems > 0 ? { label: "Critical", cls: "text-status-rose-text bg-status-rose-bg" } : undefined}
          iconBg={overdueItems > 0 ? "bg-status-rose-bg" : "bg-status-emerald-bg"}
          iconColor={overdueItems > 0 ? "text-status-rose-text" : "text-status-emerald-text"}
          mobileTileBg="bg-status-rose-bg"
          mobileIconBg="bg-status-rose-text/10"
          mobileIconColor="text-status-rose-text"
          mobileValueColor="text-status-rose-text"
          mobileLabelColor="text-status-rose-text/70"
          onClick={() => navigate("/transmittals")}
          className="col-span-2 lg:col-start-3 lg:col-span-2"
        />
      </div>

      {/* Chart + Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 md:gap-8">

        {/* Chart (Discipline Breakdown) */}
        <div className="lg:col-span-8 bg-surface border border-border-slate rounded-xl p-5 md:p-8 flex flex-col lg:h-[460px]">
          <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-3 mb-6 md:mb-8">
            <div>
              <h4 className="font-headline-md text-headline-md text-on-surface">Drawings by Discipline</h4>
              <p className="font-body-sm text-on-surface-variant">Status breakdown per drawing type.</p>
            </div>
            <div className="flex gap-x-3 gap-y-1.5 flex-wrap md:justify-end">
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
                  <span className="font-label-sm text-[12px] text-on-surface-variant w-20 md:w-32 shrink-0 truncate" title={disc}>{disc}</span>
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

        {/* Activity Feed — timeline style (desktop) / compact list (mobile) */}
        <div className="lg:col-span-4 bg-surface border border-border-slate rounded-xl flex flex-col lg:h-[460px]">
          <div className="p-4 md:p-6 border-b border-border-slate">
            <h4 className="font-headline-md text-headline-md text-on-surface">Activity Feed</h4>
            <p className="hidden md:block font-body-sm text-on-surface-variant">Recent project events and updates.</p>
          </div>

          {/* Mobile compact list (hidden on md+) */}
          <div className="md:hidden flex-1 min-h-0 divide-y divide-border-slate">
            {activityError ? (
              <div className="flex items-center gap-3 px-4 py-3 text-on-surface-variant">
                <span className="material-symbols-outlined text-[18px] opacity-40">wifi_off</span>
                <p className="text-[12px] text-status-rose-text">Could not load activity.</p>
              </div>
            ) : activity.length === 0 ? (
              <div className="flex items-center gap-3 px-4 py-3 text-on-surface-variant">
                <span className="material-symbols-outlined text-[18px] opacity-40">notifications_none</span>
                <p className="text-[12px]">No activity yet.</p>
              </div>
            ) : (
              activity.slice(0, 4).map((item) => {
                const meta = ACTIVITY_ICONS[item.type] || ACTIVITY_ICONS.upload;
                return (
                  <div key={item.id} className="flex items-center gap-3 px-4 py-2.5">
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 ${meta.bgCls}`}>
                      <span className={`material-symbols-outlined text-[14px] ${meta.textCls}`}>{meta.icon}</span>
                    </div>
                    <p className="flex-1 text-[12px] text-on-surface truncate">{item.title}</p>
                    <span className="text-[11px] text-on-surface-variant shrink-0">{timeAgo(item.created_at)}</span>
                  </div>
                );
              })
            )}
          </div>

          {/* Desktop timeline list (hidden below md) */}
          <div className="hidden md:flex flex-col flex-1 min-h-0">
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
                      <div className="min-w-0 flex-1">
                        <p className="font-body-md text-on-surface text-[13px] leading-snug break-words">{item.title}</p>
                        {item.detail && (
                          <p className="font-label-sm text-[11px] text-on-surface-variant mt-1 break-words">{item.detail} · {timeAgo(item.created_at)}</p>
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
      <div className="bg-surface border border-border-slate rounded-xl overflow-hidden">
        <div className="p-5 md:p-6 border-b border-border-slate flex justify-between items-center gap-3">
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
                    <th key={h} className="px-4 md:px-6 py-3 md:py-4 font-label-sm text-on-surface-variant uppercase tracking-wider text-[11px] whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border-slate">
                {latestDrawings.map(d => {
                  const s = STATUS_DISPLAY[d.status] || { label: d.status, textCls: "text-on-surface-variant", bgCls: "bg-surface-container" };
                  return (
                    <tr key={d.id} className="hover:bg-surface-container-low transition-colors">
                      <td className="px-4 md:px-6 py-3 md:py-4 font-body-md font-bold text-primary text-[13px] max-w-[160px] truncate" title={d.number}>{d.number}</td>
                      <td className="px-4 md:px-6 py-3 md:py-4 font-body-md text-on-surface text-[13px] max-w-[260px] truncate">{d.title || "Untitled"}</td>
                      <td className="px-4 md:px-6 py-3 md:py-4 font-body-md text-[13px]">Rev {d.rev}</td>
                      <td className="px-4 md:px-6 py-3 md:py-4 font-body-md text-on-surface-variant text-[13px]">{d.issueDate ?? "—"}</td>
                      <td className="px-4 md:px-6 py-3 md:py-4">
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
    </>
  );
}

function MetricCard({
  icon, badge, title, value, sub, iconBg, iconColor, onClick,
  mobileTileBg, mobileIconBg, mobileIconColor, mobileValueColor, mobileLabelColor,
  className = "",
}) {
  return (
    <div
      className={`${mobileTileBg || "bg-surface"} md:bg-surface border border-border-slate p-3.5 md:p-5 rounded-xl hover:shadow-md transition-shadow flex flex-col md:flex-row items-start gap-2.5 md:gap-4 ${onClick ? "cursor-pointer" : ""} ${className}`}
      onClick={onClick}
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={onClick ? (e) => { if (e.key === "Enter" || e.key === " ") onClick(); } : undefined}
    >
      <div className={`p-2 md:p-2.5 rounded-lg shrink-0 ${mobileIconBg || iconBg} md:${iconBg} ${mobileIconColor || iconColor} md:${iconColor}`}>
        <span className="material-symbols-outlined text-[18px] md:text-[22px]" style={{ fontVariationSettings: "'FILL' 0" }}>{icon}</span>
      </div>
      <div className="min-w-0">
        <p className={`font-label-sm text-[10px] md:text-[11px] ${mobileLabelColor || "text-on-surface-variant"} md:text-on-surface-variant uppercase tracking-wider truncate`}>{title}</p>
        <div className="flex items-center gap-2 mt-0.5">
          <h3 className={`font-headline-md text-headline-md ${mobileValueColor || "text-on-surface"} md:text-on-surface font-bold`}>{value}</h3>
          {badge && (
            <span className={`px-2 py-0.5 rounded-full font-label-sm text-[10px] ${badge.cls}`}>{badge.label}</span>
          )}
        </div>
        {sub && <p className={`font-body-sm text-[11px] ${mobileLabelColor || "text-on-surface-variant"} md:text-on-surface-variant mt-0.5 truncate`}>{sub}</p>}
      </div>
    </div>
  );
}

/* ── Material 3 mobile dashboard ─────────────────────────────────────────── */
const STATUS_DOT = {
  S3: { color: "#10b981", label: "For Construction" },
  S2: { color: "#f59e0b", label: "For Approval" },
  S1: { color: "#3b82f6", label: "For Information" },
  VOID: { color: "#f43f5e", label: "Void" },
};

function MobileKpi({ icon, label, value, sub, fg, soft, onClick, trendUp = false, urgent = false }) {
  return (
    <button
      onClick={onClick}
      className="bg-surface rounded-2xl p-3 shadow-card flex flex-col gap-2 text-left active:scale-[0.97] transition-transform"
    >
      <div className="flex items-center justify-between">
        <span className="w-9 h-9 rounded-xl grid place-items-center shrink-0" style={{ background: soft, color: fg }}>
          <span className="material-symbols-outlined text-[20px]">{icon}</span>
        </span>
        {sub && (
          <span className={`inline-flex items-center gap-0.5 text-[10px] font-semibold ${trendUp ? "text-status-emerald-text" : "text-on-surface-variant"}`}>
            {sub}
          </span>
        )}
      </div>
      <div>
        <div className={`text-[24px] font-bold leading-none tracking-[-0.02em] ${urgent ? "text-status-rose-text" : "text-on-surface"}`}>{value}</div>
        <div className="flex items-center justify-between mt-[3px]">
          <div className="text-[11.5px] text-on-surface-variant leading-tight">{label}</div>
          {onClick && <span className="material-symbols-outlined text-[13px] text-outline">arrow_forward</span>}
        </div>
      </div>
    </button>
  );
}

function MobileDashboard({ drawings, totalDrawings, totalTransmittals, pending, overdue, activity, activityError, userName, onNavigate }) {
  const h = new Date().getHours();
  const tod = h < 12 ? "morning" : h < 17 ? "afternoon" : "evening";
  const firstName = (userName || "").split(" ")[0] || "there";

  const counts = { S1: 0, S2: 0, S3: 0, VOID: 0 };
  drawings.forEach((d) => { if (counts[d.status] !== undefined) counts[d.status]++; });
  const s3 = counts.S3;

  return (
    <div className="md:hidden flex flex-col gap-3">
      {/* Greeting — compact */}
      <div>
        <div className="text-[12px] text-on-surface-variant">Good {tod}, <span className="font-semibold text-on-surface">{firstName}</span></div>
        <div className="text-[11px] text-on-surface-variant mt-0.5">Here's your project overview</div>
      </div>

      {/* KPI grid */}
      <div className="grid grid-cols-2 gap-2.5">
        <MobileKpi icon="architecture"    label="Total Drawings"   value={totalDrawings}     sub={s3 > 0 ? `${s3} for construction` : undefined} trendUp fg="#3525cd" soft="rgba(53,37,205,0.10)" onClick={() => onNavigate("/register")} />
        <MobileKpi icon="move_to_inbox"   label="Transmittals"     value={totalTransmittals} sub={totalTransmittals > 0 ? "total issued" : undefined} trendUp fg="#059669" soft="#ecfdf5"    onClick={() => onNavigate("/transmittals")} />
        <MobileKpi icon="pending_actions" label="Pending Approval" value={pending}           sub={pending > 0 ? "awaiting review" : undefined}                fg="#d97706" soft="#fffbeb"    onClick={() => onNavigate("/register", { state: { filterStat: "S2" } })} />
        <MobileKpi icon="warning"         label="Overdue Items"    value={overdue}           sub={overdue > 0 ? "needs attention" : "none overdue"} urgent={overdue > 0} fg="#e11d48" soft="#fff1f2" onClick={() => onNavigate("/transmittals")} />
      </div>

      {/* Recent Activity — shown before status so it's visible sooner */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between px-0.5">
          <h3 className="text-[14px] font-semibold text-on-surface">Recent Activity</h3>
          <button onClick={() => onNavigate("/register")} className="inline-flex items-center gap-0.5 min-h-[44px] pl-2.5 pr-1 text-[13px] font-semibold text-primary active:opacity-70">
            See all
            <span className="material-symbols-outlined text-[16px]">chevron_right</span>
          </button>
        </div>
        <div className="bg-surface rounded-2xl shadow-card overflow-hidden">
          {activityError ? (
            <div className="flex items-center gap-3 px-4 py-3.5 text-on-surface-variant">
              <span className="material-symbols-outlined text-[18px] opacity-40">wifi_off</span>
              <p className="text-[12px] text-status-rose-text">Could not load activity.</p>
            </div>
          ) : activity.length === 0 ? (
            <div className="flex items-center gap-3 px-4 py-3.5 text-on-surface-variant">
              <span className="material-symbols-outlined text-[18px] opacity-40">notifications_none</span>
              <p className="text-[12px]">No activity yet.</p>
            </div>
          ) : (
            activity.slice(0, 5).map((item, i) => {
              const meta = ACTIVITY_ICONS[item.type] || ACTIVITY_ICONS.upload;
              return (
                <div key={item.id} className={`flex items-center gap-3 px-4 py-3 ${i < Math.min(activity.length, 5) - 1 ? "border-b border-surface-container" : ""}`}>
                  <span className={`w-8 h-8 rounded-lg grid place-items-center shrink-0 ${meta.bgCls}`}>
                    <span className={`material-symbols-outlined text-[17px] ${meta.textCls}`}>{meta.icon}</span>
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="text-[12px] text-on-surface leading-snug truncate">{item.title}</div>
                    <div className="text-[11px] text-on-surface-variant mt-0.5 truncate">{item.detail ? `${item.detail} · ` : ""}{timeAgo(item.created_at)}</div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Drawing Status — simple list, no ambiguous bar */}
      <div className="bg-surface rounded-2xl p-4 shadow-card">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-[14px] font-semibold text-on-surface">Drawing Status</h3>
          <span className="text-[11px] text-on-surface-variant">{totalDrawings} total</span>
        </div>
        <div className="flex flex-col gap-2">
          {["S3", "S2", "S1", "VOID"].map((k) => (
            <div key={k} className="flex items-center gap-2.5">
              <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: STATUS_DOT[k].color }} />
              <span className="text-[12px] text-on-surface-variant flex-1">{STATUS_DOT[k].label}</span>
              <span className={`font-mono text-[12px] font-bold ${counts[k] > 0 ? "text-on-surface" : "text-on-surface-variant/50"}`}>{counts[k]}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
