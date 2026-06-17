import { useState } from "react";
import { openExternal } from "../utils/native";

const TRUNCATE_AT = 5; // show first N drawings, rest behind "+X more"

const PURPOSE_COLOR = {
  "For Construction":     { dot: "bg-emerald-500", text: "text-emerald-700", bg: "bg-emerald-50 border-emerald-200"  },
  "For Approval":         { dot: "bg-amber-500",   text: "text-amber-700",   bg: "bg-amber-50 border-amber-200"     },
  "For Information":      { dot: "bg-blue-500",    text: "text-blue-700",    bg: "bg-blue-50 border-blue-200"       },
  "For Review & Comment": { dot: "bg-purple-500",  text: "text-purple-700",  bg: "bg-purple-50 border-purple-200"   },
  "For Tender":           { dot: "bg-orange-500",  text: "text-orange-700",  bg: "bg-orange-50 border-orange-200"   },
};

/* ── Skeleton card ── */
function SkeletonCard() {
  return (
    <div className="bg-surface border border-outline-variant rounded-xl p-5 animate-pulse">
      <div className="flex flex-col md:flex-row gap-4">
        <div className="shrink-0 flex flex-col gap-2 min-w-[160px]">
          <div className="h-4 w-24 rounded bg-surface-container" />
          <div className="h-6 w-28 rounded-full bg-surface-container" />
          <div className="h-3 w-20 rounded bg-surface-container" />
        </div>
        <div className="flex-1 flex flex-col gap-2">
          <div className="h-3 w-16 rounded bg-surface-container" />
          <div className="flex flex-wrap gap-2">
            {[1,2,3].map(i => <div key={i} className="h-6 w-20 rounded bg-surface-container" />)}
          </div>
        </div>
        <div className="shrink-0 min-w-[180px] flex flex-col gap-2">
          <div className="h-3 w-16 rounded bg-surface-container" />
          {[1,2].map(i => <div key={i} className="h-6 w-32 rounded-full bg-surface-container" />)}
        </div>
      </div>
    </div>
  );
}

const API = import.meta.env.VITE_API_URL;

export default function TransmittalsView({ transmittals = [], drawings = [], loading = false, token = "" }) {
  const drawingMap = Object.fromEntries(drawings.map(d => [d.id, d]));
  // Track which transmittal cards are expanded (showing all drawings)
  const [expandedIds, setExpandedIds] = useState(new Set());
  // Which ack link was just copied — flips the copy icon to a check briefly
  const [copiedUrl, setCopiedUrl] = useState(null);

  const toggleExpand = id => {
    setExpandedIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const copyLink = url => {
    navigator.clipboard?.writeText(url).then(() => {
      setCopiedUrl(url);
      setTimeout(() => setCopiedUrl(null), 1500);
    }).catch(() => {});
  };

  return (
    <div className="flex flex-col gap-6 max-w-full mx-auto w-full">
      {/* Header — desktop only (mobile shows the title in the app bar) */}
      <div className="hidden md:flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h2 className="font-headline-lg text-headline-lg font-bold text-on-surface tracking-tight mb-1">Transmittals</h2>
          <p className="font-body-md text-body-md text-on-surface-variant max-w-2xl">All issued document transmittals for this project.</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="font-label-sm text-label-sm text-on-surface-variant bg-surface-container border border-outline-variant px-3 py-1 rounded-full">
            {loading ? "—" : `${transmittals.length} issued`}
          </span>
        </div>
      </div>

      {/* Loading state */}
      {loading ? (
        <div className="flex flex-col gap-3">
          {[1,2,3].map(i => <SkeletonCard key={i} />)}
        </div>
      ) : transmittals.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-64 gap-4 text-on-surface-variant bg-surface border border-outline-variant rounded-xl shadow-card">
          <div className="w-16 h-16 rounded-2xl bg-surface-container border border-outline-variant flex items-center justify-center">
            <span className="material-symbols-outlined text-[32px] text-outline">send_and_archive</span>
          </div>
          <p className="font-body-md text-body-md text-on-surface-variant">No transmittals issued yet.</p>
        </div>
      ) : (
        <>
        {/* ── Mobile (Material 3) transmittals ── */}
        <MobileTransmittals transmittals={transmittals} drawingMap={drawingMap} token={token} />

        {/* ── Desktop transmittals ── */}
        <div className="hidden md:flex flex-col gap-3">
          {transmittals.map(t => {
            const colors = PURPOSE_COLOR[t.purpose] || { dot: "bg-outline", text: "text-on-surface-variant", bg: "bg-surface-container border-outline-variant" };
            const allDrawings  = (t.drawingIds || []).map(id => drawingMap[id]).filter(Boolean);
            const acks = t.acks || [];
            const findAck = r => {
              const name  = typeof r === "string" ? r : (r.name || "");
              const email = typeof r === "string" ? "" : (r.email || "");
              return acks.find(a => (email && a.email === email) || (!email && a.name === name));
            };
            const ackedCount = acks.filter(a => a.ackedAt).length;
            const isExpanded   = expandedIds.has(t.id);
            const visibleDrawings = isExpanded ? allDrawings : allDrawings.slice(0, TRUNCATE_AT);
            const hiddenCount    = allDrawings.length - TRUNCATE_AT;

            return (
              <div key={t.id} className="bg-surface border border-outline-variant rounded-xl p-5 shadow-card hover:shadow-card-md transition-shadow">
                <div className="flex flex-col md:flex-row md:items-start gap-4">

                  {/* Left: number + purpose + date */}
                  <div className="shrink-0 flex flex-col gap-2 min-w-[160px]">
                    <span className="font-mono font-bold text-on-surface text-sm">{t.number}</span>
                    <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border w-fit ${colors.bg} ${colors.text}`}>
                      <div className={`w-1.5 h-1.5 rounded-full ${colors.dot}`} />
                      <span className="text-[11px] font-medium">{t.purpose}</span>
                    </div>
                    <span className="font-label-sm text-label-sm text-on-surface-variant">{t.issuedAt}</span>
                    {acks.length > 0 && (
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border w-fit text-[11px] font-medium ${
                        ackedCount === acks.length
                          ? "bg-emerald-50 border-emerald-200 text-emerald-700"
                          : "bg-amber-50 border-amber-200 text-amber-700"
                      }`}>
                        {ackedCount}/{acks.length} acknowledged
                      </span>
                    )}
                  </div>

                  {/* Middle: drawings list */}
                  <div className="flex-1 min-w-0">
                    <p className="font-label-sm text-label-sm text-outline mb-2 uppercase tracking-wider">
                      {allDrawings.length} Drawing{allDrawings.length !== 1 ? "s" : ""}
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {visibleDrawings.map(d => (
                        <span key={d.id} className="px-2 py-1 rounded bg-surface-container border border-outline-variant text-on-surface-variant text-[11px] font-mono break-all">
                          {d.number} Rev {d.rev}
                        </span>
                      ))}

                      {/* "+X more" — expandable button */}
                      {!isExpanded && hiddenCount > 0 && (
                        <button
                          onClick={() => toggleExpand(t.id)}
                          className="px-2 py-1 rounded bg-primary/10 border border-primary/20 text-primary text-[11px] font-medium hover:bg-primary/20 transition-colors"
                        >
                          +{hiddenCount} more
                        </button>
                      )}

                      {/* Collapse button when expanded */}
                      {isExpanded && allDrawings.length > TRUNCATE_AT && (
                        <button
                          onClick={() => toggleExpand(t.id)}
                          className="px-2 py-1 rounded bg-surface-container border border-outline-variant text-on-surface-variant text-[11px] font-medium hover:bg-surface-container-high transition-colors"
                        >
                          Show less
                        </button>
                      )}
                    </div>
                    {t.remarks && (
                      <p className="font-body-sm text-[12px] text-on-surface-variant mt-3 italic">"{t.remarks}"</p>
                    )}
                  </div>

                  {/* Right: recipients + PDF download */}
                  <div className="shrink-0 min-w-[180px] flex flex-col gap-2">
                    <p className="font-label-sm text-label-sm text-outline uppercase tracking-wider">Recipients</p>
                    <div className="flex flex-col gap-1">
                      {(t.recipients || []).map((r, i) => {
                        const name = typeof r === "string" ? r : (r.name || "");
                        const initial = name.charAt(0).toUpperCase();
                        const ack = findAck(r);
                        return (
                          <div key={i} className="flex items-center gap-2">
                            <div className="w-6 h-6 rounded-full bg-primary flex items-center justify-center text-on-primary text-[10px] font-bold shrink-0">
                              {initial}
                            </div>
                            <span className="font-body-sm text-[12px] text-on-surface-variant truncate">{name}</span>
                            {ack && (ack.ackedAt ? (
                              <span className="shrink-0 px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-emerald-50 border border-emerald-200 text-emerald-700">
                                ✓ {ack.ackedAt.slice(0, 10)}
                              </span>
                            ) : (
                              <>
                                <span className="shrink-0 px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-amber-50 border border-amber-200 text-amber-700">
                                  Pending
                                </span>
                                <button
                                  onClick={() => copyLink(ack.ackUrl)}
                                  className="shrink-0 p-1 rounded-md text-on-surface-variant hover:text-primary hover:bg-surface-container transition-colors"
                                  title="Copy acknowledgment link"
                                  aria-label={`Copy acknowledgment link for ${name}`}
                                >
                                  <span className="material-symbols-outlined text-[13px]">
                                    {copiedUrl === ack.ackUrl ? "check" : "content_copy"}
                                  </span>
                                </button>
                              </>
                            ))}
                          </div>
                        );
                      })}
                    </div>
                    <button
                      onClick={() => openExternal(`${API}/api/transmittals/${t.id}/pdf?token=${token}`)}
                      className="mt-1 inline-flex items-center gap-1.5 text-[11px] font-medium text-primary hover:underline w-fit"
                    >
                      <span className="material-symbols-outlined text-[14px]">download</span>
                      Download PDF
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
        </>
      )}
    </div>
  );
}

/* ── Mobile (Material 3) transmittals list ── */
function MobileTransmittals({ transmittals, drawingMap, token }) {
  return (
    <div className="md:hidden flex flex-col gap-3">
      {transmittals.map(t => {
        const dr = (t.drawingIds || []).map(id => drawingMap[id]).filter(Boolean);
        const acks = t.acks || [];
        const ackedCount = acks.filter(a => a.ackedAt).length;
        const total = acks.length;
        const allAcked = total > 0 && ackedCount === total;
        const recipients = t.recipients || [];
        const dot = PURPOSE_COLOR[t.purpose]?.dot || "bg-outline";
        return (
          <div key={t.id} className="bg-surface rounded-[20px] shadow-card overflow-hidden">
            {/* Header */}
            <div className="flex items-center gap-2.5 p-[14px] border-b border-surface-container">
              <span className="w-10 h-10 rounded-xl bg-primary-fixed text-primary grid place-items-center shrink-0">
                <span className="material-symbols-outlined text-[20px]" style={{ fontVariationSettings: "'FILL' 1" }}>outgoing_mail</span>
              </span>
              <div className="flex-1 min-w-0">
                <div className="font-mono font-bold text-[14px] text-on-surface">{t.number}</div>
                <div className="inline-flex items-center gap-1.5 text-[11px] text-on-surface-variant mt-px">
                  <span className={`w-1.5 h-1.5 rounded-full ${dot}`} />{t.purpose}
                </div>
              </div>
              {total > 0 ? (
                <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold shrink-0 ${allAcked ? "bg-status-emerald-bg text-status-emerald-text" : "bg-status-amber-bg text-status-amber-text"}`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${allAcked ? "bg-[#10b981]" : "bg-[#f59e0b]"}`} />{ackedCount}/{total}
                </span>
              ) : (
                <span className="px-2.5 py-1 rounded-full text-[11px] font-semibold bg-surface-container text-on-surface-variant shrink-0">{recipients.length} rec.</span>
              )}
            </div>
            {/* Body */}
            <div className="p-[14px] flex flex-col gap-3">
              <div className="flex flex-wrap gap-1.5">
                {dr.length > 0
                  ? dr.map(d => <span key={d.id} className="px-2 py-1 rounded-lg bg-surface-container font-mono text-[10.5px] text-on-surface-variant">{d.number} Rev {d.rev}</span>)
                  : <span className="text-[11px] text-on-surface-variant">No drawings linked</span>}
              </div>
              <div className="flex items-center gap-2.5 pt-2.5 border-t border-surface-container">
                <div className="flex">
                  {recipients.slice(0, 4).map((r, i) => {
                    const name = typeof r === "string" ? r : (r.name || "");
                    return (
                      <span key={i} className={`w-7 h-7 rounded-full bg-primary text-white text-[10px] font-bold grid place-items-center border-2 border-surface ${i ? "-ml-2" : ""}`}>
                        {name.charAt(0).toUpperCase()}
                      </span>
                    );
                  })}
                </div>
                <span className="flex-1 text-[11.5px] text-on-surface-variant truncate">
                  {recipients.map(r => (typeof r === "string" ? r : r.name)).join(", ")}
                </span>
                <button
                  onClick={() => openExternal(`${API}/api/transmittals/${t.id}/pdf?token=${token}`)}
                  className="inline-flex items-center gap-1 text-[12px] font-semibold text-primary shrink-0"
                >
                  <span className="material-symbols-outlined text-[16px]">picture_as_pdf</span>PDF
                </button>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
