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
    <div className="max-w-[1400px] mx-auto space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display-lg text-display-lg text-on-surface tracking-tight">Analytics</h1>
          <p className="font-body-md text-body-md text-on-surface-variant mt-1">Project-level metrics and breakdowns</p>
        </div>
        {drawings.length > 0 && (
          <button
            onClick={() => exportCSV(drawings)}
            className="flex items-center gap-1.5 px-4 py-2.5 bg-white border border-border-slate rounded-xl text-on-surface font-medium text-[13px] hover:bg-surface-container-low transition-colors shadow-sm"
          >
            <span className="material-symbols-outlined text-[18px]">download</span>
            Export CSV
          </button>
        )}
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {Object.entries(STATUS_META).map(([code, { label, color }]) => (
          <div key={code} className="bg-white border border-border-slate rounded-xl p-5 shadow-sm">
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
                    <span className="font-mono text-[9px] text-on-surface-variant opacity-0 group-hover:opacity-100 transition-opacity">{m.count || ''}</span>
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
  );
}

function Card({ title, icon, children }) {
  return (
    <div className="bg-white border border-border-slate rounded-xl p-6 shadow-sm">
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
