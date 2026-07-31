import { useEffect, useRef } from "react";
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
  const closeRef = useRef(null);
  const panelRef = useRef(null);
  const openerRef = useRef(null);

  useEffect(() => {
    if (!mobileOpen) return undefined;
    openerRef.current = document.activeElement;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeRef.current?.focus();
    const onKeyDown = event => {
      if (event.key === "Escape") {
        onMobileClose();
        return;
      }
      if (event.key !== "Tab") return;
      const focusable = [...(panelRef.current?.querySelectorAll(
        'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])'
      ) ?? [])];
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
      openerRef.current?.focus();
    };
  }, [mobileOpen, onMobileClose]);

  return (
    <>
      {/* ── Mobile backdrop — z-50 so it covers the bottom nav ── */}
      {mobileOpen && (
        <div
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 md:hidden"
          onClick={onMobileClose}
          aria-hidden="true"
        />
      )}

      {/* ── Sidebar panel ── */}
      <aside
        ref={panelRef}
        className={`
          flex flex-col h-[100dvh] bg-surface border-r border-border-slate w-[280px]
          fixed left-0 top-0 z-[400] p-4 gap-2 safe-top safe-bottom
          transition-transform duration-300
          ${mobileOpen ? "visible translate-x-0" : "invisible -translate-x-full"}
          md:visible md:translate-x-0
        `}
      >
        {/* Logo + close button on mobile */}
        <div className="flex items-center justify-between pb-3">
          <img
            src="/logo.png"
            alt="Unique Properties"
            className="w-[160px] h-auto object-contain object-left"
          />
          {/* Close button — mobile only */}
          <button
            ref={closeRef}
            onClick={onMobileClose}
            className="mobile-touch-target md:hidden grid place-items-center rounded-lg text-on-surface-variant hover:bg-surface-container transition-colors shrink-0"
            aria-label="Close navigation"
          >
            <span className="material-symbols-outlined text-[20px]" aria-hidden="true">close</span>
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
                `w-full min-h-11 flex items-center gap-3 px-4 py-3 rounded-lg text-[14px] transition-colors duration-200 text-left no-underline ${
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
                    aria-hidden="true"
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
          <div className="px-4 pb-2 flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-status-emerald-text shrink-0" />
            <span className="text-[10px] font-semibold text-on-surface-variant/50 uppercase tracking-widest">Unique Drawings</span>
          </div>
          <NavLink
            to="/settings"
            onClick={onMobileClose}
            className={({ isActive }) =>
              `w-full min-h-11 flex items-center gap-3 px-4 py-3 rounded-lg text-[14px] transition-colors no-underline ${
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
                  aria-hidden="true"
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
