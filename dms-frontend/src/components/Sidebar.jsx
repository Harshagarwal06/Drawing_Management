const NAV_ITEMS = [
  { tab: "dashboard",    icon: "dashboard",     label: "Dashboard"        },
  { tab: "register",     icon: "architecture",  label: "Drawing Register" },
  { tab: "transmittals", icon: "move_to_inbox", label: "Transmittals"     },
  { tab: "documents",    icon: "description",   label: "Documents"        },
  { tab: "analytics",   icon: "analytics",      label: "Analytics"        },
];

export default function Sidebar({ activeProject, currentTab, onTabChange, onNewDrawing }) {
  return (
    /* Rule 3: w-[280px], bg-surface border-r border-slate */
    <aside className="hidden md:flex flex-col h-screen bg-surface border-r border-border-slate w-[280px] fixed left-0 top-0 z-50 p-4 gap-2">

      {/* Logo */}
      <div className="flex items-center gap-3 mb-8 px-2">
        <div className="w-10 h-10 bg-primary rounded-lg flex items-center justify-center text-white shrink-0">
          <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>architecture</span>
        </div>
        <div>
          <h1 className="text-[20px] font-bold text-primary leading-tight">DrawVault</h1>
          <p className="text-[12px] text-on-surface-variant">Enterprise Management</p>
        </div>
      </div>

      {/* New Drawing CTA */}
      {onNewDrawing && (
        <button
          onClick={onNewDrawing}
          className="w-full bg-primary text-white py-3 rounded-xl text-[14px] font-medium flex items-center justify-center gap-2 mb-6 hover:bg-primary-container transition-colors active:scale-[0.98]"
        >
          <span className="material-symbols-outlined text-[20px]">add</span>
          New Drawing
        </button>
      )}

      {/* Nav — Rule 3 active/inactive */}
      <nav className="flex flex-col gap-1 flex-1">
        {NAV_ITEMS.map(({ tab, icon, label }) => (
          <button
            key={tab}
            onClick={() => onTabChange(tab)}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-[14px] transition-all duration-200 text-left ${
              tab === currentTab
                ? "text-primary font-bold bg-primary/10"          /* Active: Rule 3 */
                : "text-on-surface-variant font-medium hover:bg-surface-container" /* Inactive: Rule 3 */
            }`}
          >
            <span
              className="material-symbols-outlined text-[20px]"
              style={tab === currentTab ? { fontVariationSettings: "'FILL' 1" } : undefined}
            >
              {icon}
            </span>
            {label}
          </button>
        ))}
      </nav>

      {/* Footer */}
      <div className="mt-auto pt-4 border-t border-border-slate space-y-1">
        <button
          onClick={() => onTabChange("settings")}
          className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-[14px] transition-all ${
            currentTab === "settings"
              ? "text-primary font-bold bg-primary/10"
              : "text-on-surface-variant font-medium hover:bg-surface-container"
          }`}
        >
          <span className="material-symbols-outlined text-[20px]">settings</span>
          Settings
        </button>

        {/* Active project chip */}
        {activeProject && (
          <div className="flex items-center gap-3 px-2 py-2 mt-1">
            <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center text-white text-[12px] font-bold shrink-0">
              {activeProject.code?.charAt(0) ?? "P"}
            </div>
            <div className="overflow-hidden">
              <p className="text-[13px] font-bold text-on-surface truncate">{activeProject.code}</p>
              <p className="text-[11px] text-on-surface-variant truncate">
                {activeProject.name?.split("—")[1]?.trim() ?? activeProject.name}
              </p>
            </div>
          </div>
        )}
      </div>
    </aside>
  );
}
