import { useState } from "react";

export default function MasterRegisterTable({ drawings }) {
  return (
    <div className="flex flex-col gap-6 max-w-full mx-auto w-full">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h2 className="font-headline-lg text-headline-lg font-bold text-on-surface tracking-tight mb-2">Master Drawing Register</h2>
          <p className="font-body-md text-body-md text-on-surface-variant max-w-2xl">Central repository for all project architectural, structural, and MEP documentation. Monitor status and revisions in real-time.</p>
        </div>
        <div className="flex items-center gap-3">
          <button className="px-4 py-2 rounded-lg bg-surface-container border border-white/10 text-on-surface hover:bg-white/5 transition-colors flex items-center gap-2 font-label-md text-label-md">
            <span className="material-symbols-outlined text-[18px]">ios_share</span>
            Export Log
          </button>
          <button className="px-4 py-2 rounded-lg bg-primary text-on-primary hover:bg-primary/90 transition-colors flex items-center gap-2 font-label-md text-label-md shadow-[0_0_15px_rgba(195,192,255,0.3)]">
            <span className="material-symbols-outlined text-[18px]">add</span>
            New Entry
          </button>
        </div>
      </div>

      {/* Toolbar & Filters */}
      <div className="bg-surface-container-low border border-white/5 rounded-xl p-4 flex flex-col md:flex-row gap-4 items-center justify-between backdrop-blur-md shadow-lg">
        <div className="flex items-center gap-3 w-full md:w-auto">
          <div className="relative w-full md:w-80 group">
            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant group-focus-within:text-primary transition-colors">search</span>
            <input className="w-full bg-surface-container-lowest border border-white/10 rounded-lg pl-10 pr-4 py-2 text-on-surface font-body-sm text-body-sm placeholder:text-on-surface-variant focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/50 transition-all shadow-inner" placeholder="Search drawings, titles, or authors..." type="text" />
          </div>
          <button className="p-2 rounded-lg bg-surface-container-lowest border border-white/10 text-on-surface-variant hover:text-on-surface hover:bg-white/5 transition-colors hidden md:flex items-center justify-center" title="Advanced Filters">
            <span className="material-symbols-outlined">tune</span>
          </button>
        </div>
        <div className="flex flex-wrap items-center gap-2 w-full md:w-auto overflow-x-auto pb-1 md:pb-0 scrollbar-hide">
          <span className="font-label-sm text-label-sm text-outline px-2">STATUS:</span>
          <button className="px-3 py-1.5 rounded-full bg-primary/10 border border-primary/20 text-primary font-label-sm text-label-sm flex items-center gap-1.5 whitespace-nowrap">
            <div className="w-1.5 h-1.5 rounded-full bg-primary"></div>
            All Active
          </button>
          <button className="px-3 py-1.5 rounded-full bg-surface-container-highest border border-white/5 text-on-surface-variant hover:text-on-surface hover:bg-white/5 transition-colors font-label-sm text-label-sm flex items-center gap-1.5 whitespace-nowrap">
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500"></div>
            For Construction
          </button>
          <button className="px-3 py-1.5 rounded-full bg-surface-container-highest border border-white/5 text-on-surface-variant hover:text-on-surface hover:bg-white/5 transition-colors font-label-sm text-label-sm flex items-center gap-1.5 whitespace-nowrap">
            <div className="w-1.5 h-1.5 rounded-full bg-amber-500"></div>
            For Approval
          </button>
        </div>
      </div>

      {/* Data Table Container */}
      <div className="bg-surface-container-low/50 backdrop-blur-xl border border-white/5 rounded-xl shadow-[0_20px_25px_-5px_rgba(0,0,0,0.5)] overflow-hidden flex flex-col relative w-full">
        <div className="overflow-x-auto w-full">
          <table className="w-full text-left border-collapse min-w-[1000px]">
            <thead className="bg-surface-container border-b border-surface-variant sticky top-0 z-10">
              <tr>
                <th className="py-3 px-4 font-label-sm text-label-sm text-outline-variant uppercase tracking-wider w-12 text-center">
                  <input className="rounded border-outline-variant bg-surface-container-lowest text-primary focus:ring-primary/50 focus:ring-offset-surface-container focus:ring-offset-2" type="checkbox" />
                </th>
                <th className="py-3 px-4 font-label-sm text-label-sm text-outline-variant uppercase tracking-wider cursor-pointer hover:text-on-surface transition-colors">
                  <div className="flex items-center gap-1">
                    Drawing No.
                    <span className="material-symbols-outlined text-[14px]">arrow_downward</span>
                  </div>
                </th>
                <th className="py-3 px-4 font-label-sm text-label-sm text-outline-variant uppercase tracking-wider">Title & Type</th>
                <th className="py-3 px-4 font-label-sm text-label-sm text-outline-variant uppercase tracking-wider">Discipline</th>
                <th className="py-3 px-4 font-label-sm text-label-sm text-outline-variant uppercase tracking-wider">Rev</th>
                <th className="py-3 px-4 font-label-sm text-label-sm text-outline-variant uppercase tracking-wider">Status</th>
                <th className="py-3 px-4 font-label-sm text-label-sm text-outline-variant uppercase tracking-wider">Date</th>
                <th className="py-3 px-4 font-label-sm text-label-sm text-outline-variant uppercase tracking-wider text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-variant font-body-sm text-body-sm">
              {drawings.length === 0 ? (
                <tr>
                  <td colSpan="8" className="text-center py-8 text-on-surface-variant font-body-sm text-body-sm">
                    No drawings uploaded yet.
                  </td>
                </tr>
              ) : (
                drawings.map(d => {
                  let statusColor = "text-on-surface-variant";
                  let bgGlow = "bg-surface-container-highest";
                  let dotColor = "bg-on-surface-variant";
                  
                  if (d.status === "For Construction") {
                    statusColor = "text-emerald-400";
                    bgGlow = "bg-emerald-500/10 border-emerald-500/20";
                    dotColor = "bg-emerald-400 shadow-[0_0_5px_rgba(52,211,153,0.5)]";
                  } else if (d.status === "For Approval") {
                    statusColor = "text-amber-400";
                    bgGlow = "bg-amber-500/10 border-amber-500/20";
                    dotColor = "bg-amber-400 shadow-[0_0_5px_rgba(251,191,36,0.5)]";
                  }

                  return (
                    <tr key={d.id} className="group hover:bg-white/[0.02] transition-all duration-200 hover:shadow-[inset_2px_0_0_0_#c3c0ff]">
                      <td className="py-3 px-4 text-center">
                        <input className="rounded border-outline-variant bg-surface-container-lowest text-primary focus:ring-primary/50 focus:ring-offset-surface focus:ring-offset-2 opacity-50 group-hover:opacity-100 transition-opacity" type="checkbox" />
                      </td>
                      <td className="py-3 px-4">
                        <span className="font-mono text-on-surface font-medium">{d.drawingNumber}</span>
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded bg-error-container/20 text-error flex items-center justify-center border border-error/20 shrink-0">
                            <span className="font-label-sm text-[10px] font-bold">PDF</span>
                          </div>
                          <div>
                            <p className="text-on-surface font-medium group-hover:text-primary transition-colors truncate max-w-[250px]">{d.title || "Untitled"}</p>
                            <p className="text-outline text-[12px]">{d.originator} • {d.transmittalCount || 0} Tx</p>
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <span className="px-2 py-1 rounded bg-surface-container-highest text-on-surface-variant text-[11px] font-medium border border-white/5">{d.discipline}</span>
                      </td>
                      <td className="py-3 px-4 text-on-surface">{d.revision}</td>
                      <td className="py-3 px-4">
                        <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border ${bgGlow} ${statusColor}`}>
                          <div className={`w-1.5 h-1.5 rounded-full ${dotColor}`}></div>
                          <span className="text-[11px] font-medium">{d.status}</span>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-on-surface-variant">{d.createdAt ? new Date(d.createdAt).toLocaleDateString('en-GB', {day: 'numeric', month: 'short', year: 'numeric'}) : "N/A"}</td>
                      <td className="py-3 px-4">
                        <div className="flex items-center justify-end gap-1 opacity-40 group-hover:opacity-100 transition-opacity">
                          <button className="p-1.5 text-on-surface-variant hover:text-primary hover:bg-primary/10 rounded-md transition-colors" title="View">
                            <span className="material-symbols-outlined text-[18px]">visibility</span>
                          </button>
                          <button className="p-1.5 text-on-surface-variant hover:text-primary hover:bg-primary/10 rounded-md transition-colors" title="Download">
                            <span className="material-symbols-outlined text-[18px]">download</span>
                          </button>
                          <button className="p-1.5 text-on-surface-variant hover:text-error hover:bg-error/10 rounded-md transition-colors" title="Supersede">
                            <span className="material-symbols-outlined text-[18px]">block</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
        
        {/* Table Footer / Pagination */}
        <div className="bg-surface-container border-t border-surface-variant px-4 py-3 flex items-center justify-between">
          <p className="font-label-sm text-label-sm text-outline">Showing {drawings.length} entries</p>
          <div className="flex items-center gap-2">
            <button className="w-8 h-8 rounded flex items-center justify-center bg-surface-container-highest border border-white/5 text-on-surface-variant hover:text-on-surface hover:bg-white/5 disabled:opacity-50" disabled>
              <span className="material-symbols-outlined text-[18px]">chevron_left</span>
            </button>
            <button className="w-8 h-8 rounded flex items-center justify-center bg-primary text-on-primary font-label-md">1</button>
            <button className="w-8 h-8 rounded flex items-center justify-center bg-surface-container-highest border border-white/5 text-on-surface-variant hover:text-on-surface hover:bg-white/5">
              <span className="material-symbols-outlined text-[18px]">chevron_right</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
