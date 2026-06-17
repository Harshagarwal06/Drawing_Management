import { NavLink } from "react-router-dom";

/* Material 3 destinations — filled icon + pill indicator when active. */
const DIRECTOR_TABS = [
  { path: "/dashboard",    icon: "space_dashboard", label: "Home"     },
  { path: "/documents",    icon: "folder_open",     label: "Docs"     },
  { path: "/register",     icon: "table_rows",      label: "Register" },
  { path: "/transmittals", icon: "outgoing_mail",   label: "Issue"    },
  { path: "/analytics",    icon: "monitoring",      label: "Stats"    },
];

const RESTRICTED_TABS = [
  { path: "/documents", icon: "folder_open", label: "Documents" },
  { path: "/settings",  icon: "settings",    label: "Settings"  },
];

/* Mobile-only M3 bottom navigation bar — desktop keeps the sidebar. */
export default function BottomNav({ isDirector = false }) {
  const tabs = isDirector ? DIRECTOR_TABS : RESTRICTED_TABS;

  return (
    <nav className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-surface border-t border-outline-variant shadow-[0_-1px_8px_rgba(16,24,40,0.04)] pb-safe-bottom">
      <div className="flex px-1 pt-2 pb-1.5">
        {tabs.map(({ path, icon, label }) => (
          <NavLink
            key={path}
            to={path}
            className="flex-1 flex flex-col items-center gap-1 no-underline active:bg-primary/10 rounded-2xl transition-colors"
          >
            {({ isActive }) => (
              <>
                {/* Active indicator pill (64×32) */}
                <span className="relative w-16 h-8 grid place-items-center">
                  <span
                    className={`absolute inset-0 rounded-2xl transition-colors duration-200 ${
                      isActive ? "bg-primary-fixed" : "bg-transparent"
                    }`}
                    style={{ transitionTimingFunction: "cubic-bezier(0.2,0,0,1)" }}
                  />
                  <span
                    className={`material-symbols-outlined text-[23px] relative ${
                      isActive ? "text-primary" : "text-on-surface-variant"
                    }`}
                    style={isActive ? { fontVariationSettings: "'FILL' 1" } : undefined}
                  >
                    {icon}
                  </span>
                </span>
                <span
                  className={`text-[11px] leading-none ${
                    isActive ? "font-bold text-on-surface" : "font-medium text-on-surface-variant"
                  }`}
                >
                  {label}
                </span>
              </>
            )}
          </NavLink>
        ))}
      </div>
    </nav>
  );
}
