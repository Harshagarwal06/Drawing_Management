export default function Dashboard({ totalDrawings, totalTransmittals, latestRevisions, overdueItems, drawings }) {
  return (
    <div className="max-w-[1600px] mx-auto space-y-8">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="font-display-lg text-display-lg text-on-surface tracking-tight">Dashboard</h1>
          <p className="font-body-md text-body-md text-on-surface-variant mt-1">Project Status & Activity</p>
        </div>
        <div className="flex items-center gap-3">
          <button className="px-4 py-2 rounded-lg bg-white/5 border border-white/10 font-label-md text-label-md text-on-surface hover:bg-white/10 transition-colors flex items-center gap-2 backdrop-blur-sm">
            <span className="material-symbols-outlined text-[18px]">calendar_today</span>
            Last 30 Days
          </button>
          <button className="px-4 py-2 rounded-lg bg-white/5 border border-white/10 font-label-md text-label-md text-on-surface hover:bg-white/10 transition-colors flex items-center gap-2 backdrop-blur-sm">
            <span className="material-symbols-outlined text-[18px]">filter_list</span>
            Filter
          </button>
        </div>
      </div>

      {/* Metric Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <MetricCard title="Total Drawings" icon="architecture" value={totalDrawings} subValue="+5.2% this month" color="primary" />
        <MetricCard title="Issued Transmittals" icon="send_and_archive" value={totalTransmittals} subValue="3 pending approval" color="tertiary" />
        <MetricCard title="Latest Revisions" icon="update" value={latestRevisions} subValue="New today" color="primary-container" />
        <MetricCard title="Overdue Items" icon="warning" value={overdueItems} subValue="Requires attention" color="rose" />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="xl:col-span-2 space-y-6">
          <div className="bg-slate-900/70 dark:bg-white/5 backdrop-blur-xl border border-white/10 rounded-xl p-6 shadow-[0_20px_25px_-5px_rgba(0,0,0,0.5)] h-96 flex items-center justify-center">
            <p className="text-on-surface-variant">Drawing Revision Trends Chart Placeholder</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {drawings.slice(0, 2).map((dwg) => (
              <div key={dwg.id} className="bg-slate-900/70 dark:bg-white/5 backdrop-blur-xl border border-white/10 rounded-xl p-5 shadow-[0_20px_25px_-5px_rgba(0,0,0,0.5)] hover:bg-white/10 transition-colors cursor-pointer group">
                <div className="flex gap-4">
                  <div className="w-16 h-20 bg-surface-container-high rounded border border-white/10 overflow-hidden shrink-0 relative flex items-center justify-center text-primary-container text-[10px] font-mono">
                    PDF
                  </div>
                  <div className="flex-1 flex flex-col justify-center">
                    <h3 className="font-label-md text-label-md text-on-surface font-semibold group-hover:text-primary transition-colors line-clamp-1">{dwg.title || dwg.number}</h3>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-surface-container-high border border-white/10 text-[10px] text-on-surface-variant">{dwg.rev}</span>
                      <span className="font-body-sm text-[12px] text-on-surface-variant">Updated recently</span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="xl:col-span-1">
          <div className="bg-slate-900/70 dark:bg-white/5 backdrop-blur-xl border border-white/10 rounded-xl p-6 shadow-[0_20px_25px_-5px_rgba(0,0,0,0.5)] h-full flex flex-col">
            <div className="flex items-center justify-between mb-6 shrink-0">
              <h2 className="font-headline-sm text-headline-sm text-on-surface font-semibold">Activity Feed</h2>
              <a className="font-label-sm text-label-sm text-primary hover:text-primary-fixed transition-colors" href="#">View All</a>
            </div>
            <div className="flex-1 overflow-y-auto pr-2 space-y-6 custom-scrollbar">
              <div className="relative pl-6">
                <div className="absolute left-1.5 top-2 bottom-[-24px] w-px bg-white/10"></div>
                <div className="absolute left-0 top-1.5 w-3.5 h-3.5 rounded-full bg-primary border-2 border-surface shadow-[0_0_8px_rgba(195,192,255,0.5)]"></div>
                <div className="flex flex-col gap-1">
                  <div className="flex justify-between items-start">
                    <span className="font-label-md text-label-md text-on-surface">System Update</span>
                    <span className="font-label-sm text-label-sm text-on-surface-variant/70">1d ago</span>
                  </div>
                  <p className="font-body-sm text-[13px] text-on-surface-variant leading-tight">Project baseline synchronized with central server.</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function MetricCard({ title, icon, value, subValue, color }) {
  const colorMap = {
    "primary": "bg-primary text-primary",
    "tertiary": "bg-tertiary text-tertiary",
    "primary-container": "bg-primary-container text-primary-container",
    "rose": "bg-rose-500 text-rose-500",
  };
  const colorClass = colorMap[color] || "bg-primary text-primary";
  const glowMap = {
    "primary": "bg-primary/10 group-hover:bg-primary/20",
    "tertiary": "bg-tertiary/10 group-hover:bg-tertiary/20",
    "primary-container": "bg-primary-container/10 group-hover:bg-primary-container/20",
    "rose": "bg-rose-500/10 group-hover:bg-rose-500/20",
  };
  const glowClass = glowMap[color] || "bg-primary/10 group-hover:bg-primary/20";
  
  return (
    <div className={`relative overflow-hidden rounded-xl bg-slate-900/70 dark:bg-white/5 backdrop-blur-xl border ${color === 'rose' ? 'border-rose-500/20' : 'border-white/10'} p-6 shadow-[0_20px_25px_-5px_rgba(0,0,0,0.5)] group hover:-translate-y-1 transition-transform duration-300`}>
      <div className={`absolute top-0 right-0 w-32 h-32 rounded-full blur-3xl -mr-10 -mt-10 transition-colors ${glowClass}`}></div>
      <div className="relative z-10 flex flex-col h-full justify-between gap-4">
        <div className="flex items-start justify-between">
          <span className={`font-label-sm text-label-sm uppercase tracking-wider ${color === 'rose' ? 'text-rose-400' : 'text-on-surface-variant'}`}>{title}</span>
          <div className={`w-8 h-8 rounded-full flex items-center justify-center ${colorClass} bg-opacity-10`}>
            <span className="material-symbols-outlined text-[18px]">{icon}</span>
          </div>
        </div>
        <div>
          <div className="font-headline-lg text-headline-lg text-on-surface font-bold">{value}</div>
          <div className={`flex items-center gap-1 mt-1 font-body-sm text-body-sm ${color === 'rose' ? 'text-rose-400' : 'text-emerald-400'}`}>
            <span className="material-symbols-outlined text-[14px]">info</span>
            <span>{subValue}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
