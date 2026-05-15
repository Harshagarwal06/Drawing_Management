const PURPOSE_COLOR = {
  "For Construction":      { dot: "bg-emerald-400", text: "text-emerald-400", bg: "bg-emerald-500/10 border-emerald-500/20" },
  "For Approval":          { dot: "bg-amber-400",   text: "text-amber-400",   bg: "bg-amber-500/10 border-amber-500/20"   },
  "For Information":       { dot: "bg-blue-400",    text: "text-blue-400",    bg: "bg-blue-500/10 border-blue-500/20"     },
  "For Review & Comment":  { dot: "bg-purple-400",  text: "text-purple-400",  bg: "bg-purple-500/10 border-purple-500/20" },
  "For Tender":            { dot: "bg-orange-400",  text: "text-orange-400",  bg: "bg-orange-500/10 border-orange-500/20" },
};

export default function TransmittalsView({ transmittals = [], drawings = [] }) {
  const drawingMap = Object.fromEntries(drawings.map(d => [d.id, d]));

  return (
    <div className="flex flex-col gap-6 max-w-full mx-auto w-full">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h2 className="font-headline-lg text-headline-lg font-bold text-on-surface tracking-tight mb-2">Transmittals</h2>
          <p className="font-body-md text-body-md text-on-surface-variant max-w-2xl">All issued document transmittals for this project.</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="font-label-sm text-label-sm text-on-surface-variant bg-surface-container border border-white/10 px-3 py-1 rounded-full">
            {transmittals.length} issued
          </span>
        </div>
      </div>

      {transmittals.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-64 gap-4 text-on-surface-variant bg-surface-container-low/50 rounded-xl border border-white/5">
          <span className="material-symbols-outlined text-[48px] opacity-30">send_and_archive</span>
          <p className="font-body-md text-body-md">No transmittals issued yet.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {transmittals.map(t => {
            const colors = PURPOSE_COLOR[t.purpose] || { dot: "bg-on-surface-variant", text: "text-on-surface-variant", bg: "bg-surface-container-highest border-white/5" };
            const includedDrawings = (t.drawingIds || []).map(id => drawingMap[id]).filter(Boolean);

            return (
              <div key={t.id} className="bg-surface-container-low/50 backdrop-blur-xl border border-white/5 rounded-xl p-5 shadow-[0_10px_25px_-5px_rgba(0,0,0,0.4)] hover:bg-white/[0.03] transition-colors">
                <div className="flex flex-col md:flex-row md:items-start gap-4">
                  {/* Left: number + purpose */}
                  <div className="shrink-0 flex flex-col gap-2 min-w-[160px]">
                    <span className="font-mono font-bold text-on-surface text-sm">{t.number}</span>
                    <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border w-fit ${colors.bg} ${colors.text}`}>
                      <div className={`w-1.5 h-1.5 rounded-full ${colors.dot}`}></div>
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
                        <span key={d.id} className="px-2 py-1 rounded bg-surface-container-highest border border-white/5 text-on-surface-variant text-[11px] font-mono">
                          {d.number} Rev {d.rev}
                        </span>
                      ))}
                      {(t.drawingIds?.length || 0) > includedDrawings.length && (
                        <span className="px-2 py-1 rounded bg-surface-container-highest border border-white/5 text-outline text-[11px]">
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
                          <div className="w-6 h-6 rounded-full bg-primary/20 border border-primary/30 flex items-center justify-center text-primary text-[10px] font-bold shrink-0">
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
