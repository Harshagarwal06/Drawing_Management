import { useState, useRef, useEffect } from "react";

const PALETTE = ["#c3c0ff", "#93c5fd", "#86efac", "#fcd34d", "#f9a8d4"];
const dot = (idx) => PALETTE[idx % PALETTE.length];

export default function ProjectSelector({ projects, activeProject, onChange, onNew, isRestricted }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const close = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  const activeIdx = projects.findIndex(p => p.id === activeProject?.id);
  const shortName = (name) => name?.split("—")[1]?.trim() ?? name ?? "Select project";

  return (
    <div className="relative" ref={ref}>
      {/* Trigger */}
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-2.5 bg-surface-container-highest/60 hover:bg-white/10 border border-white/10 rounded-xl px-3 py-2 transition-all group focus:outline-none focus:ring-1 focus:ring-primary/50"
      >
        <span
          className="w-2 h-2 rounded-full shrink-0 ring-2 ring-black/30"
          style={{ backgroundColor: dot(activeIdx) }}
        />
        <div className="flex flex-col items-start min-w-0 text-left">
          <span className="font-mono text-[11px] font-bold text-primary leading-none tracking-wide">
            {activeProject?.code ?? "—"}
          </span>
          <span className="text-[10px] text-on-surface-variant leading-none mt-[3px] truncate max-w-[120px]">
            {shortName(activeProject?.name)}
          </span>
        </div>
        <span
          className={`material-symbols-outlined text-[16px] text-on-surface-variant transition-transform duration-200 ml-0.5 ${open ? "rotate-180" : ""}`}
        >
          expand_more
        </span>
      </button>

      {/* Dropdown */}
      {open && (
        <div className="absolute right-0 top-full mt-2 w-72 bg-surface-container backdrop-blur-2xl border border-white/10 rounded-2xl shadow-[0_24px_48px_-8px_rgba(0,0,0,0.9)] overflow-hidden z-[60]">
          {/* Header */}
          <div className="px-4 pt-3 pb-2 border-b border-white/5">
            <p className="font-label-sm text-[10px] text-outline uppercase tracking-widest">Switch Project</p>
          </div>

          {/* List */}
          <div className="py-1 max-h-64 overflow-y-auto custom-scrollbar">
            {projects.map((p, idx) => {
              const isActive = p.id === activeProject?.id;
              return (
                <button
                  key={p.id}
                  onClick={() => { onChange(p); setOpen(false); }}
                  className={`w-full flex items-center gap-3 px-4 py-3 transition-colors text-left ${
                    isActive ? "bg-primary/10" : "hover:bg-white/5"
                  }`}
                >
                  {/* Color dot */}
                  <span
                    className="w-2.5 h-2.5 rounded-full shrink-0 ring-2 ring-black/30"
                    style={{ backgroundColor: dot(idx) }}
                  />
                  {/* Text */}
                  <div className="flex-1 min-w-0">
                    <p className={`font-mono text-[12px] font-bold leading-tight ${isActive ? "text-primary" : "text-on-surface"}`}>
                      {p.code}
                    </p>
                    <p className="text-[11px] text-on-surface-variant leading-tight mt-0.5 truncate">{p.name}</p>
                  </div>
                  {/* Active check */}
                  {isActive && (
                    <span className="material-symbols-outlined text-[16px] text-primary shrink-0">check_circle</span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Footer: new project */}
          {!isRestricted && (
            <div className="px-2 py-2 border-t border-white/5">
              <button
                onClick={() => { onNew(); setOpen(false); }}
                className="w-full flex items-center gap-2 px-3 py-2.5 rounded-xl hover:bg-primary/10 transition-colors text-primary font-label-sm text-label-sm"
              >
                <span className="material-symbols-outlined text-[16px]">add_circle</span>
                Create New Project
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
