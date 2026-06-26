const STATUS_META = {
  S3:   { label: 'For Construction', color: '#34d399' },
  S2:   { label: 'For Approval',     color: '#fbbf24' },
  S1:   { label: 'For Information',  color: '#60a5fa' },
  VOID: { label: 'Void',             color: '#f87171' },
};

function exportCSV(drawings) {
  const headers = ["Number", "Title", "Discipline", "Revision", "Status", "Issue Date", "Originator"];
  const rows = drawings.map(d => [
    d.number, d.title, d.discipline, d.rev, d.status, d.issueDate ?? "", d.originator,
  ]);
  const csv = [headers, ...rows]
    .map(r => r.map(v => `"${String(v ?? "").replace(/"/g, '""')}"`).join(","))
    .join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `drawings-export-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export default function AnalyticsView({ drawings, transmittals }) {
  /* ── Status breakdown ── */
  const statusCounts = { S3: 0, S2: 0, S1: 0, VOID: 0 };
  drawings.forEach(d => { if (statusCounts[d.status] !== undefined) statusCounts[d.status]++; });
  const total = drawings.length || 1;

  /* ── Discipline breakdown ── */
  const byDisc = {};
  drawings.forEach(d => {
    if (!byDisc[d.discipline]) byDisc[d.discipline] = { S3: 0, S2: 0, S1: 0, VOID: 0, total: 0 };
    byDisc[d.discipline][d.status] = (byDisc[d.discipline][d.status] || 0) + 1;
    byDisc[d.discipline].total++;
  });
  const discEntries = Object.entries(byDisc).sort((a, b) => b[1].total - a[1].total);
  const maxTotal = Math.max(...discEntries.map(([, v]) => v.total), 1);

  /* ── Transmittal timeline (last 12 months) ── */
  const now = new Date();
  const months = Array.from({ length: 12 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - (11 - i), 1);
    return { label: d.toLocaleDateString('en-GB', { month: 'short', year: '2-digit' }), key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`, count: 0 };
  });
  transmittals.forEach(t => {
    const key = (t.issuedAt || '').slice(0, 7);
    const m = months.find(m => m.key === key);
    if (m) m.count++;
  });
  const maxCount = Math.max(...months.map(m => m.count), 1);

  return (
    <>
    {/* ── Mobile (Material 3) analytics ── */}
    <MobileAnalytics drawings={drawings} transmittals={transmittals} />

    {/* ── Desktop analytics ── */}
    <div className="hidden md:block max-w-[1400px] mx-auto space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display-lg text-display-lg text-on-surface tracking-tight">Analytics</h1>
          <p className="font-body-md text-body-md text-on-surface-variant mt-1">Project-level metrics and breakdowns</p>
        </div>
        {drawings.length > 0 && (
          <button
            onClick={() => exportCSV(drawings)}
            className="flex items-center gap-1.5 px-4 py-2.5 bg-surface border border-border-slate rounded-xl text-on-surface font-medium text-[13px] hover:bg-surface-container-low transition-colors shadow-sm"
          >
            <span className="material-symbols-outlined text-[18px]">download</span>
            Export CSV
          </button>
        )}
      </div>

      {/* KPI row — S3 hero spans 2 cols, secondary stats take 1 each */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        {/* Hero: For Construction */}
        <div className="col-span-2 lg:col-span-2 bg-surface border border-border-slate rounded-xl p-5">
          <div className="flex items-center gap-2 mb-3">
            <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: STATUS_META.S3.color }} />
            <span className="font-label-sm text-[10px] text-on-surface-variant uppercase tracking-wide">{STATUS_META.S3.label}</span>
          </div>
          <p className="font-space-grotesk text-[52px] font-bold leading-none tracking-[-0.02em] text-on-surface">{statusCounts.S3}</p>
          <p className="text-[12px] text-on-surface-variant mt-2">
            {drawings.length ? `${Math.round((statusCounts.S3 / total) * 100)}%` : '—'} of total drawings
          </p>
        </div>
        {/* Secondary status cards */}
        {[['S2', STATUS_META.S2], ['S1', STATUS_META.S1], ['VOID', STATUS_META.VOID]].map(([code, { label, color }]) => (
          <div key={code} className="bg-surface border border-border-slate rounded-xl p-5">
            <div className="flex items-center gap-2 mb-1">
              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: color }} />
              <span className="font-label-sm text-[10px] text-on-surface-variant uppercase tracking-wide">{label}</span>
            </div>
            <p className="font-headline-lg text-headline-lg text-on-surface font-bold">{statusCounts[code]}</p>
            <p className="font-body-sm text-[11px] text-on-surface-variant mt-0.5">
              {drawings.length ? `${Math.round((statusCounts[code] / total) * 100)}%` : '—'} of total
            </p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* Status donut-style bar */}
        <Card title="Status Breakdown" icon="pie_chart">
          {drawings.length === 0 ? <EmptyState icon="pie_chart" msg="No drawings in this project yet." /> : (
            <div className="space-y-4">
              {/* Stacked bar */}
              <div className="flex h-7 rounded-lg overflow-hidden">
                {Object.entries(STATUS_META).map(([code, { color }]) =>
                  statusCounts[code] > 0 ? (
                    <div
                      key={code}
                      title={`${STATUS_META[code].label}: ${statusCounts[code]}`}
                      className="h-full transition-all"
                      style={{ width: `${(statusCounts[code] / total) * 100}%`, backgroundColor: color }}
                    />
                  ) : null
                )}
              </div>
              {/* Legend */}
              <div className="space-y-2">
                {Object.entries(STATUS_META).map(([code, { label, color }]) => (
                  <div key={code} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: color }} />
                      <span className="font-body-sm text-[12px] text-on-surface-variant">{label}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="w-24 h-1.5 bg-surface-container rounded-full overflow-hidden">
                        <div className="h-full rounded-full" style={{ width: `${(statusCounts[code] / total) * 100}%`, backgroundColor: color }} />
                      </div>
                      <span className="font-mono text-[12px] text-on-surface w-6 text-right">{statusCounts[code]}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </Card>

        {/* Transmittal timeline */}
        <Card title="Transmittal Activity (12 months)" icon="timeline">
          {transmittals.length === 0 ? <EmptyState icon="send_and_archive" msg="No transmittals issued yet." /> : (
            <div>
              <div className="flex items-end gap-1 h-32">
                {months.map(m => (
                  <div key={m.key} className="flex-1 flex flex-col items-center gap-1 group">
                    <span className="font-mono text-[9px] text-on-surface-variant opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity">{m.count || ''}</span>
                    <div
                      className="w-full rounded-t-sm bg-primary/60 group-hover:bg-primary transition-colors"
                      style={{ height: `${(m.count / maxCount) * 100}%`, minHeight: m.count > 0 ? '4px' : '0' }}
                      title={`${m.label}: ${m.count}`}
                    />
                  </div>
                ))}
              </div>
              <div className="flex gap-1 mt-2">
                {months.map(m => (
                  <div key={m.key} className="flex-1 text-center font-label-sm text-[8px] text-on-surface-variant truncate">{m.label}</div>
                ))}
              </div>
            </div>
          )}
        </Card>
      </div>

      {/* Discipline breakdown table */}
      <Card title="Drawings by Discipline" icon="bar_chart">
        {discEntries.length === 0 ? <EmptyState icon="bar_chart" msg="Upload drawings to see the discipline breakdown." /> : (
          <div className="space-y-3">
            {/* Legend */}
            <div className="flex items-center gap-4 mb-4">
              {Object.entries(STATUS_META).map(([code, { label, color }]) => (
                <div key={code} className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full" style={{ backgroundColor: color }} />
                  <span className="font-label-sm text-[10px] text-on-surface-variant">{label}</span>
                </div>
              ))}
            </div>
            {discEntries.map(([disc, counts]) => (
              <div key={disc} className="flex items-center gap-4">
                <span className="font-label-sm text-[11px] text-on-surface-variant w-32 shrink-0 truncate" title={disc}>{disc}</span>
                <div className="flex-1 flex h-5 rounded-md overflow-hidden bg-surface-container">
                  {Object.entries(STATUS_META).map(([code, { color }]) =>
                    counts[code] > 0 ? (
                      <div
                        key={code}
                        title={`${STATUS_META[code].label}: ${counts[code]}`}
                        className="h-full transition-all"
                        style={{ width: `${(counts[code] / maxTotal) * 100}%`, backgroundColor: color + 'b3' }}
                      />
                    ) : null
                  )}
                </div>
                <span className="font-mono text-[11px] text-on-surface-variant w-6 text-right shrink-0">{counts.total}</span>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
    </>
  );
}

/* ── Mobile (Material 3) analytics: compliance ring, discipline bars, status grid ── */
const M_DISC = {
  Architecture: ["#7c3aed", "#f3e8ff"], Structure: ["#ea580c", "#ffedd5"],
  MEP: ["#0891b2", "#cffafe"], Electrical: ["#0891b2", "#cffafe"], Plumbing: ["#0891b2", "#cffafe"], Fire: ["#0891b2", "#cffafe"],
  Civil: ["#0d9488", "#ccfbf1"], Interior: ["#db2777", "#fce7f3"],
};
const mDisc = (d) => M_DISC[d] || ["#3525cd", "#e0deff"];

const M_STATUS_CARDS = [
  { key: "S3",   label: "Construction", bgCls: "bg-status-emerald-bg", textCls: "text-status-emerald-text" },
  { key: "S2",   label: "For Approval", bgCls: "bg-status-amber-bg",   textCls: "text-status-amber-text"   },
  { key: "S1",   label: "For Info",     bgCls: "bg-blue-50",           textCls: "text-blue-700"            },
  { key: "VOID", label: "Void",         bgCls: "bg-status-rose-bg",    textCls: "text-status-rose-text"    },
];

function MobileAnalytics({ drawings, transmittals }) {
  /* Transmittal compliance from per-recipient acks */
  let totalRecips = 0, totalAcked = 0;
  transmittals.forEach((t) => {
    const acks = t.acks || [];
    totalRecips += acks.length;
    totalAcked  += acks.filter((a) => a.ackedAt).length;
  });
  const compliance = totalRecips ? Math.round((totalAcked / totalRecips) * 100) : 0;
  const R = 32, circ = 2 * Math.PI * R;

  /* Drawings by discipline */
  const byDisc = {};
  drawings.forEach((d) => { byDisc[d.discipline] = (byDisc[d.discipline] || 0) + 1; });
  const discEntries = Object.entries(byDisc).sort((a, b) => b[1] - a[1]);
  const discMax = Math.max(...discEntries.map(([, v]) => v), 1);

  /* Status counts */
  const counts = { S1: 0, S2: 0, S3: 0, VOID: 0 };
  drawings.forEach((d) => { if (counts[d.status] !== undefined) counts[d.status]++; });

  return (
    <div className="md:hidden flex flex-col gap-5">
      {/* Compliance ring */}
      <div className="bg-surface rounded-[20px] p-5 shadow-card flex items-center gap-5">
        <div className="relative w-20 h-20 shrink-0">
          <svg width="80" height="80" viewBox="0 0 80 80" style={{ transform: "rotate(-90deg)" }}>
            <circle cx="40" cy="40" r={R} fill="none" stroke="var(--surface-container, #f1f3f5)" strokeWidth="8" />
            <circle cx="40" cy="40" r={R} fill="none" stroke="#10b981" strokeWidth="8" strokeLinecap="round"
              strokeDasharray={`${(circ * compliance) / 100} ${circ}`} />
          </svg>
          <div className="absolute inset-0 grid place-items-center">
            <span className="text-[17px] font-bold text-on-surface leading-none">{compliance}%</span>
          </div>
        </div>
        <div>
          <div className="text-[14px] font-semibold text-on-surface">Transmittal Compliance</div>
          <div className="text-[12px] text-on-surface-variant mt-1">
            {totalAcked} of {totalRecips} recipient{totalRecips !== 1 ? "s" : ""} acknowledged
          </div>
          <div className={`inline-flex items-center gap-1 mt-2.5 rounded-lg px-2.5 py-1 text-[12px] font-semibold ${compliance >= 80 ? "bg-status-emerald-bg text-status-emerald-text" : "bg-status-amber-bg text-status-amber-text"}`}>
            <span className="material-symbols-outlined text-[13px]" style={{ fontVariationSettings: "'FILL' 1" }}>
              {compliance >= 80 ? "check_circle" : "schedule"}
            </span>
            {compliance >= 80 ? "On track" : "Needs follow-up"}
          </div>
        </div>
      </div>

      {/* Drawings by discipline */}
      <div className="bg-surface rounded-[20px] p-[18px] shadow-card flex flex-col gap-4">
        <h3 className="text-[15px] font-semibold text-on-surface">Drawings by Discipline</h3>
        {discEntries.length === 0 ? (
          <p className="text-[13px] text-on-surface-variant">Upload drawings to see the breakdown.</p>
        ) : discEntries.map(([disc, count]) => {
          const [fg, bg] = mDisc(disc);
          return (
            <div key={disc}>
              <div className="flex items-center justify-between mb-[7px]">
                <div className="flex items-center gap-2">
                  <span className="inline-flex w-[22px] h-[22px] rounded-md items-center justify-center shrink-0" style={{ background: bg }}>
                    <span className="w-2 h-2 rounded-sm" style={{ background: fg }} />
                  </span>
                  <span className="text-[13px] text-on-surface">{disc}</span>
                </div>
                <span className="font-mono text-[12px] font-bold text-on-surface-variant">{count}</span>
              </div>
              <div className="h-2 rounded bg-surface-container overflow-hidden">
                <div className="h-full rounded transition-all duration-500" style={{ background: fg, width: `${(count / discMax) * 100}%` }} />
              </div>
            </div>
          );
        })}
      </div>

      {/* Status breakdown */}
      <div className="bg-surface rounded-[20px] p-[18px] shadow-card flex flex-col gap-3">
        <h3 className="text-[15px] font-semibold text-on-surface">Status Breakdown</h3>
        <div className="grid grid-cols-2 gap-2.5">
          {M_STATUS_CARDS.map(({ key, label, bgCls, textCls }) => (
            <div key={key} className={`rounded-[14px] p-3.5 ${bgCls}`}>
              <div className={`text-[24px] font-bold leading-none tracking-[-0.01em] ${textCls}`}>{counts[key]}</div>
              <div className={`text-[11.5px] mt-1 opacity-85 ${textCls}`}>{label}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function Card({ title, icon, children }) {
  return (
    <div className="bg-surface border border-border-slate rounded-xl p-6 shadow-sm">
      <div className="flex items-center gap-2 mb-5">
        <span className="material-symbols-outlined text-primary text-[20px]">{icon}</span>
        <h2 className="font-headline-sm text-headline-sm text-on-surface font-semibold">{title}</h2>
      </div>
      {children}
    </div>
  );
}

function EmptyState({ icon, msg }) {
  return (
    <div className="flex flex-col items-center justify-center h-32 gap-3 text-on-surface-variant">
      <span className="material-symbols-outlined text-[36px] opacity-30">{icon}</span>
      <p className="font-body-sm text-body-sm">{msg}</p>
    </div>
  );
}
