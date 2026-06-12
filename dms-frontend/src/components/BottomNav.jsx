import { NavLink } from "react-router-dom";

const DIRECTOR_TABS = [
  { path: "/dashboard",    icon: "dashboard",     label: "Dashboard"    },
  { path: "/documents",    icon: "description",   label: "Documents"    },
  { path: "/register",     icon: "architecture",  label: "Register"     },
  { path: "/transmittals", icon: "move_to_inbox", label: "Transmittals" },
  { path: "/analytics",    icon: "analytics",     label: "Analytics"    },
];

const RESTRICTED_TABS = [
  { path: "/documents", icon: "description", label: "Documents" },
  { path: "/settings",  icon: "settings",    label: "Settings"  },
];

/* Mobile-only bottom tab bar — desktop keeps the sidebar. Settings stays
   reachable for directors via the hamburger sidebar. */
export default function BottomNav({ isDirector = false }) {
  const tabs = isDirector ? DIRECTOR_TABS : RESTRICTED_TABS;

  return (
    <nav className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-surface border-t border-border-slate pb-safe-bottom">
      <div className="flex">
        {tabs.map(({ path, icon, label }) => (
          <NavLink
            key={path}
            to={path}
            className={({ isActive }) =>
              `flex-1 flex flex-col items-center justify-center gap-0.5 h-14 no-underline transition-colors ${
                isActive ? "text-primary" : "text-on-surface-variant"
              }`
            }
          >
            {({ isActive }) => (
              <>
                <span
                  className="material-symbols-outlined text-[22px]"
                  style={isActive ? { fontVariationSettings: "'FILL' 1" } : undefined}
                >
                  {icon}
                </span>
                <span className={`text-[10px] leading-none ${isActive ? "font-bold" : "font-medium"}`}>
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
