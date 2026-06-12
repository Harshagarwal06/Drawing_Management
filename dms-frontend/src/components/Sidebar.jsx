import { NavLink } from "react-router-dom";

const DIRECTOR_NAV = [
  { path: "/dashboard",    icon: "dashboard",     label: "Dashboard"        },
  { path: "/documents",    icon: "description",   label: "Documents"        },
  { path: "/register",     icon: "architecture",  label: "Drawing Register" },
  { path: "/transmittals", icon: "move_to_inbox", label: "Transmittals"     },
  { path: "/analytics",    icon: "analytics",     label: "Analytics"        },
];

const RESTRICTED_NAV = [
  { path: "/documents", icon: "description", label: "Documents" },
];

export default function Sidebar({
  isDirector    = false,
  mobileOpen    = false,
  onMobileClose = () => {},
}) {
  const navItems = isDirector ? DIRECTOR_NAV : RESTRICTED_NAV;

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
          fixed left-0 top-0 z-50 p-4 gap-2 sidebar-safe
          transition-transform duration-300 ease-in-out
          ${mobileOpen ? "translate-x-0" : "-translate-x-full"}
          md:translate-x-0
        `}
      >
        {/* Logo + close button on mobile */}
        <div className="flex items-center justify-between px-5 pt-4 pb-4">
          <img
            src="/logo.png"
            alt="Unique Properties"
            className="w-[160px] h-auto object-contain object-left"
          />
          {/* Close button — mobile only */}
          <button
            onClick={onMobileClose}
            className="md:hidden p-1.5 rounded-lg text-on-surface-variant hover:bg-surface-container transition-colors shrink-0"
            aria-label="Close navigation"
          >
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>

        {/* Nav */}
        <nav className="flex flex-col gap-1 flex-1">
          {navItems.map(({ path, icon, label }) => (
            <NavLink
              key={path}
              to={path}
              onClick={onMobileClose}
              className={({ isActive }) =>
                `w-full flex items-center gap-3 px-4 py-3 rounded-lg text-[14px] transition-all duration-200 text-left no-underline ${
                  isActive
                    ? "text-primary font-bold bg-primary/10"
                    : "text-on-surface-variant font-medium hover:bg-surface-container"
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <span
                    className="material-symbols-outlined text-[20px]"
                    style={isActive ? { fontVariationSettings: "'FILL' 1" } : undefined}
                  >
                    {icon}
                  </span>
                  {label}
                </>
              )}
            </NavLink>
          ))}
        </nav>

        {/* Footer */}
        <div className="mt-auto pt-4 border-t border-border-slate space-y-1">
          <NavLink
            to="/settings"
            onClick={onMobileClose}
            className={({ isActive }) =>
              `w-full flex items-center gap-3 px-4 py-3 rounded-lg text-[14px] transition-all no-underline ${
                isActive
                  ? "text-primary font-bold bg-primary/10"
                  : "text-on-surface-variant font-medium hover:bg-surface-container"
              }`
            }
          >
            {({ isActive }) => (
              <>
                <span
                  className="material-symbols-outlined text-[20px]"
                  style={isActive ? { fontVariationSettings: "'FILL' 1" } : undefined}
                >
                  settings
                </span>
                Settings
              </>
            )}
          </NavLink>
        </div>
      </aside>
    </>
  );
}
