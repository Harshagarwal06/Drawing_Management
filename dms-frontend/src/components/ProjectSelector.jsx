import { useState, useRef, useEffect } from "react";

const PALETTE = ["#3525cd", "#2563eb", "#059669", "#d97706", "#9333ea"];
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
        className="flex items-center gap-3 bg-surface-container-low hover:bg-surface-container border border-outline-variant rounded-xl px-4 py-2.5 transition-all focus:outline-none focus:ring-2 focus:ring-primary/20 min-w-[200px]"
      >
        <span
          className="w-3 h-3 rounded-full shrink-0"
          style={{ backgroundColor: dot(activeIdx) }}
        />
        <div className="flex flex-col items-start min-w-0 text-left flex-1">
          <span className="font-mono text-[12px] font-bold text-primary leading-none tracking-wide">
            {activeProject?.code ?? "—"}
          </span>
          <span className="text-[11px] text-on-surface-variant leading-none mt-1 truncate max-w-[180px]">
            {shortName(activeProject?.name)}
          </span>
        </div>
        <span className={`material-symbols-outlined text-[18px] text-on-surface-variant transition-transform duration-200 ${open ? "rotate-180" : ""}`}>
          expand_more
        </span>
      </button>

      {/* Dropdown */}
      {open && (
        <div className="absolute right-0 top-full mt-2 w-72 bg-surface border border-outline-variant rounded-xl shadow-card-lg overflow-hidden z-[60]">
          <div className="px-4 pt-3 pb-2 border-b border-outline-variant">
            <p className="font-label-sm text-[10px] text-outline uppercase tracking-widest">Switch Project</p>
          </div>

          <div className="py-1 max-h-64 overflow-y-auto custom-scrollbar">
            {projects.map((p, idx) => {
              const isActive = p.id === activeProject?.id;
              return (
                <button
                  key={p.id}
                  onClick={() => { onChange(p); setOpen(false); }}
                  className={`w-full flex items-center gap-3 px-4 py-3 transition-colors text-left ${
                    isActive ? "bg-primary/10" : "hover:bg-surface-container-low"
                  }`}
                >
                  <span
                    className="w-2.5 h-2.5 rounded-full shrink-0"
                    style={{ backgroundColor: dot(idx) }}
                  />
                  <div className="flex-1 min-w-0">
                    <p className={`font-mono text-[12px] font-bold leading-tight ${isActive ? "text-primary" : "text-on-surface"}`}>
                      {p.code}
                    </p>
                    <p className="text-[11px] text-on-surface-variant leading-tight mt-0.5 truncate">{p.name}</p>
                  </div>
                  {isActive && (
                    <span className="material-symbols-outlined text-[16px] text-primary shrink-0">check_circle</span>
                  )}
                </button>
              );
            })}
          </div>

          {!isRestricted && (
            <div className="px-2 py-2 border-t border-outline-variant">
              <button
                onClick={() => { onNew(); setOpen(false); }}
                className="w-full flex items-center gap-2 px-3 py-2.5 rounded-lg hover:bg-primary/10 transition-colors text-primary font-label-sm text-label-sm"
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
