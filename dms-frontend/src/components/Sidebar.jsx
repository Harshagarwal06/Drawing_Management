const NAV_ITEMS = [
  { tab: "dashboard",    icon: "dashboard",     label: "Dashboard"        },
  { tab: "documents",    icon: "description",   label: "Documents"        },
  { tab: "register",     icon: "architecture",  label: "Drawing Register" },
  { tab: "transmittals", icon: "move_to_inbox", label: "Transmittals"     },
  { tab: "analytics",   icon: "analytics",      label: "Analytics"        },
];

export default function Sidebar({
  activeProject,
  currentTab,
  onTabChange,
  onNewDrawing,
  mobileOpen    = false,
  onMobileClose = () => {},
}) {
  const handleNav = tab => {
    onTabChange(tab);
    onMobileClose(); // close drawer on mobile after navigation
  };

  return (
    <>
      {/* ── Mobile backdrop ── */}
      {mobileOpen && (
        <div
          className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40 md:hidden"
          onClick={onMobileClose}
        />
      )}

      {/* ── Sidebar panel ── */}
      <aside
        className={`
          flex flex-col h-screen bg-surface border-r border-border-slate w-[280px]
          fixed left-0 top-0 z-50 p-4 gap-2
          transition-transform duration-300 ease-in-out
          ${mobileOpen ? "translate-x-0" : "-translate-x-full"}
          md:translate-x-0
        `}
      >
        {/* Logo + close button on mobile */}
        <div className="flex items-center gap-3 mb-8 px-2">
          <img src="/logo.png" alt="Unique Properties" className="h-9 w-auto object-contain shrink-0" />
          <div className="flex-1 min-w-0">
            <h1
              className="text-[18px] font-bold leading-tight"
              style={{
                background: "linear-gradient(90deg, #F4A223 0%, #C9A06A 50%, #1B6ABF 100%)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                backgroundClip: "text",
              }}
            >
              Unique Properties
            </h1>
            <p className="text-[12px] text-on-surface-variant">Enterprise Management</p>
          </div>
          {/* Close button — mobile only */}
          <button
            onClick={onMobileClose}
            className="md:hidden p-1.5 rounded-lg text-on-surface-variant hover:bg-surface-container transition-colors shrink-0"
            aria-label="Close navigation"
          >
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>

        {/* New Drawing CTA */}
        {onNewDrawing && (
          <button
            onClick={() => { onNewDrawing(); onMobileClose(); }}
            className="w-full bg-primary text-white py-3 rounded-xl text-[14px] font-medium flex items-center justify-center gap-2 mb-6 hover:bg-primary-container transition-colors active:scale-[0.98]"
          >
            <span className="material-symbols-outlined text-[20px]">add</span>
            New Drawing
          </button>
        )}

        {/* Nav */}
        <nav className="flex flex-col gap-1 flex-1">
          {NAV_ITEMS.map(({ tab, icon, label }) => (
            <button
              key={tab}
              onClick={() => handleNav(tab)}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-[14px] transition-all duration-200 text-left ${
                tab === currentTab
                  ? "text-primary font-bold bg-primary/10"
                  : "text-on-surface-variant font-medium hover:bg-surface-container"
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
            onClick={() => handleNav("settings")}
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
    </>
  );
}
