import { useEffect, useRef, useState } from "react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";

const DIRECTOR_ITEMS = [
  { path: "/dashboard", icon: "space_dashboard", label: "Home" },
  { path: "/documents", icon: "folder_open", label: "Documents" },
  { path: "/register", icon: "table_rows", label: "Register" },
  { path: "/transmittals", icon: "outgoing_mail", label: "Transmittals" },
];

const TEAM_ITEMS = [
  { path: "/documents", icon: "folder_open", label: "Documents" },
  { path: "/settings", icon: "settings", label: "Settings" },
];

export default function MobileBottomNav({ isDirector, onLogout }) {
  const [moreOpen, setMoreOpen] = useState(false);
  const triggerRef = useRef(null);
  const firstItemRef = useRef(null);
  const sheetRef = useRef(null);
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const items = isDirector ? DIRECTOR_ITEMS : TEAM_ITEMS;
  const moreActive = pathname === "/analytics" || pathname === "/settings";

  useEffect(() => {
    if (!moreOpen) return undefined;
    const previousOverflow = document.body.style.overflow;
    const trigger = triggerRef.current;
    document.body.style.overflow = "hidden";
    firstItemRef.current?.focus();
    const onKeyDown = event => {
      if (event.key === "Escape") {
        setMoreOpen(false);
        return;
      }
      if (event.key !== "Tab") return;
      const focusable = [...(sheetRef.current?.querySelectorAll(
        'button:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])'
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
      trigger?.focus();
    };
  }, [moreOpen]);

  const go = path => {
    setMoreOpen(false);
    navigate(path);
  };

  return (
    <>
      <nav
        aria-label="Mobile navigation"
        className="md:hidden fixed inset-x-0 bottom-0 z-[200] border-t border-border-slate bg-surface/95 backdrop-blur safe-bottom"
      >
        <div className={`grid ${isDirector ? "grid-cols-5" : "grid-cols-3 max-w-sm mx-auto"}`}>
          {items.map(item => (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) => `min-w-0 min-h-[60px] px-1 py-2 flex flex-col items-center justify-center gap-1 no-underline whitespace-nowrap ${
                isActive ? "text-primary" : "text-on-surface-variant"
              }`}
            >
              {({ isActive }) => (
                <>
                  <span
                    className={`material-symbols-outlined text-[22px] ${isActive ? "bg-primary-fixed px-4 rounded-full" : ""}`}
                    style={isActive ? { fontVariationSettings: "'FILL' 1" } : undefined}
                    aria-hidden="true"
                  >
                    {item.icon}
                  </span>
                  <span className="text-[10px] leading-none font-semibold truncate max-w-full">{item.label}</span>
                </>
              )}
            </NavLink>
          ))}

          <button
            ref={triggerRef}
            type="button"
            onClick={() => setMoreOpen(true)}
            aria-haspopup="dialog"
            aria-expanded={moreOpen}
            className={`min-w-0 min-h-[60px] px-1 py-2 flex flex-col items-center justify-center gap-1 whitespace-nowrap ${
              moreActive ? "text-primary" : "text-on-surface-variant"
            }`}
          >
            <span className={`material-symbols-outlined text-[22px] ${moreActive ? "bg-primary-fixed px-4 rounded-full" : ""}`} aria-hidden="true">more_horiz</span>
            <span className="text-[10px] leading-none font-semibold">More</span>
          </button>
        </div>
      </nav>

      {moreOpen && (
        <div
          className="md:hidden fixed inset-0 z-[400] flex items-end"
          style={{ background: "var(--color-scrim)" }}
          onMouseDown={event => { if (event.target === event.currentTarget) setMoreOpen(false); }}
        >
          <section ref={sheetRef} className="mobile-sheet w-full overflow-y-auto" role="dialog" aria-modal="true" aria-labelledby="mobile-more-title">
            <div className="sticky top-0 bg-surface px-5 pt-3 pb-4 border-b border-border-slate">
              <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-outline-variant" aria-hidden="true" />
              <div className="flex items-center justify-between gap-4">
                <h2 id="mobile-more-title" className="workspace-heading text-[20px]">More</h2>
                <button type="button" onClick={() => setMoreOpen(false)} className="mobile-touch-target grid place-items-center rounded-full text-on-surface-variant" aria-label="Close more menu">
                  <span className="material-symbols-outlined" aria-hidden="true">close</span>
                </button>
              </div>
            </div>
            <div className="p-3">
              {isDirector && <SheetAction ref={firstItemRef} icon="monitoring" label="Analytics" detail="Project status and exports" onClick={() => go("/analytics")} />}
              {isDirector && <SheetAction icon="settings" label="Settings" detail="Account, users, and installation" onClick={() => go("/settings")} />}
              <SheetAction ref={isDirector ? undefined : firstItemRef} icon="install_mobile" label="Install DrawVault" detail="Add the website to this device" onClick={() => { setMoreOpen(false); window.dispatchEvent(new CustomEvent("drawvault:show-install")); }} />
              <div className="my-2 border-t border-border-slate" />
              <SheetAction icon="logout" label="Sign out" detail="End this DrawVault session" danger onClick={() => { setMoreOpen(false); onLogout(); }} />
            </div>
          </section>
        </div>
      )}
    </>
  );
}

function SheetAction({ icon, label, detail, danger = false, onClick, ref }) {
  return (
    <button
      ref={ref}
      type="button"
      onClick={onClick}
      className={`w-full min-h-[60px] flex items-center gap-3 rounded-lg px-3 py-2 text-left ${danger ? "text-status-rose-text" : "text-on-surface"}`}
    >
      <span className="material-symbols-outlined text-[22px] shrink-0" aria-hidden="true">{icon}</span>
      <span className="flex-1 min-w-0">
        <span className="block text-[14px] font-semibold">{label}</span>
        <span className="block text-[12px] text-on-surface-variant">{detail}</span>
      </span>
      <span className="material-symbols-outlined text-[18px] text-outline" aria-hidden="true">chevron_right</span>
    </button>
  );
}
