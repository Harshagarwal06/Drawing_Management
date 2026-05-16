const PURPOSE_COLOR = {
  "For Construction":     { dot: "bg-emerald-500", text: "text-emerald-700", bg: "bg-emerald-50 border-emerald-200"  },
  "For Approval":         { dot: "bg-amber-500",   text: "text-amber-700",   bg: "bg-amber-50 border-amber-200"     },
  "For Information":      { dot: "bg-blue-500",    text: "text-blue-700",    bg: "bg-blue-50 border-blue-200"       },
  "For Review & Comment": { dot: "bg-purple-500",  text: "text-purple-700",  bg: "bg-purple-50 border-purple-200"   },
  "For Tender":           { dot: "bg-orange-500",  text: "text-orange-700",  bg: "bg-orange-50 border-orange-200"   },
};

export default function TransmittalsView({ transmittals = [], drawings = [] }) {
  const drawingMap = Object.fromEntries(drawings.map(d => [d.id, d]));

  return (
    <div className="flex flex-col gap-6 max-w-full mx-auto w-full">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h2 className="font-headline-lg text-headline-lg font-bold text-on-surface tracking-tight mb-1">Transmittals</h2>
          <p className="font-body-md text-body-md text-on-surface-variant max-w-2xl">All issued document transmittals for this project.</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="font-label-sm text-label-sm text-on-surface-variant bg-surface-container border border-outline-variant px-3 py-1 rounded-full">
            {transmittals.length} issued
          </span>
        </div>
      </div>

      {transmittals.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-64 gap-4 text-on-surface-variant bg-surface border border-outline-variant rounded-xl shadow-card">
          <div className="w-16 h-16 rounded-2xl bg-surface-container border border-outline-variant flex items-center justify-center">
            <span className="material-symbols-outlined text-[32px] text-outline">send_and_archive</span>
          </div>
          <p className="font-body-md text-body-md text-on-surface-variant">No transmittals issued yet.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {transmittals.map(t => {
            const colors = PURPOSE_COLOR[t.purpose] || { dot: "bg-outline", text: "text-on-surface-variant", bg: "bg-surface-container border-outline-variant" };
            const includedDrawings = (t.drawingIds || []).map(id => drawingMap[id]).filter(Boolean);

            return (
              <div key={t.id} className="bg-surface border border-outline-variant rounded-xl p-5 shadow-card hover:shadow-card-md transition-shadow">
                <div className="flex flex-col md:flex-row md:items-start gap-4">
                  {/* Left: number + purpose */}
                  <div className="shrink-0 flex flex-col gap-2 min-w-[160px]">
                    <span className="font-mono font-bold text-on-surface text-sm">{t.number}</span>
                    <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border w-fit ${colors.bg} ${colors.text}`}>
                      <div className={`w-1.5 h-1.5 rounded-full ${colors.dot}`} />
                      <span className="text-[11px] font-medium">{t.purpose}</span>
                    </div>
                    <span className="font-label-sm text-label-sm text-on-surface-variant">{t.issuedAt}</span>
                  </div>

                  {/* Middle: drawings list */}
                  <div className="flex-1">
                    <p className="font-label-sm text-label-sm text-outline mb-2 uppercase tracking-wider">
                      {includedDrawings.length} Drawing{includedDrawings.length !== 1 ? "s" : ""}
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {includedDrawings.map(d => (
                        <span key={d.id} className="px-2 py-1 rounded bg-surface-container border border-outline-variant text-on-surface-variant text-[11px] font-mono">
                          {d.number} Rev {d.rev}
                        </span>
                      ))}
                      {(t.drawingIds?.length || 0) > includedDrawings.length && (
                        <span className="px-2 py-1 rounded bg-surface-container border border-outline-variant text-outline text-[11px]">
                          +{t.drawingIds.length - includedDrawings.length} more
                        </span>
                      )}
                    </div>
                    {t.remarks && (
                      <p className="font-body-sm text-[12px] text-on-surface-variant mt-3 italic">"{t.remarks}"</p>
                    )}
                  </div>

                  {/* Right: recipients */}
                  <div className="shrink-0 min-w-[180px]">
                    <p className="font-label-sm text-label-sm text-outline mb-2 uppercase tracking-wider">Recipients</p>
                    <div className="flex flex-col gap-1">
                      {(t.recipients || []).map((r, i) => (
                        <div key={i} className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded-full bg-primary flex items-center justify-center text-on-primary text-[10px] font-bold shrink-0">
                            {r.charAt(0).toUpperCase()}
                          </div>
                          <span className="font-body-sm text-[12px] text-on-surface-variant truncate">{r}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
