import { useState, useRef, useEffect } from "react";
import { Outlet, useLocation } from "react-router-dom";
import ErrorBoundary from "./ErrorBoundary";
import Sidebar from "./Sidebar";
import BottomNav from "./BottomNav";
import PullToRefresh from "./PullToRefresh";
import ProjectSelector from "./ProjectSelector";

export default function AppShell({
  currentUser,
  onLogout,
  activeProject,
  projects,
  isDirector,
  isProjectTeam,
  isRestricted,
  mobileNavOpen,
  setMobileNavOpen,
  onProjectChange,
  onNewProject,
  onNewTransmittal,
  onRefresh,
}) {
  const { pathname } = useLocation();
  const isDocuments  = pathname === "/documents";

  /* Extended FAB hides on scroll-down, reappears on scroll-up (M3, v2 spec). */
  const [fabVisible, setFabVisible] = useState(true);
  const lastScrollY = useRef(0);
  useEffect(() => {
    const onScroll = () => {
      const y = window.scrollY;
      if (y < 60) { setFabVisible(true); lastScrollY.current = y; return; }
      const goingUp = y < lastScrollY.current;
      setFabVisible(goingUp);
      lastScrollY.current = y;
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const MOBILE_TITLES = {
    "/dashboard":    "Dashboard",
    "/documents":    "Documents",
    "/register":     "Drawing Register",
    "/transmittals": "Transmittals",
    "/analytics":    "Analytics",
    "/settings":     "Settings",
  };
  const mobileTitle = MOBILE_TITLES[pathname] ?? "";

  /* Contextual extended FAB — only "New Transmittal" on the Issue screen.
     (Upload is reached from the Documents toolbar; no floating upload button.) */
  const FAB_BY_ROUTE = {
    "/transmittals": { icon: "add", label: "New Transmittal", onClick: onNewTransmittal },
  };
  const fab = !isRestricted ? FAB_BY_ROUTE[pathname] : undefined;

  return (
    <div className="bg-background text-on-surface font-outfit min-h-screen flex">

      <Sidebar
        isDirector={isDirector}
        mobileOpen={mobileNavOpen}
        onMobileClose={() => setMobileNavOpen(false)}
      />

      {/* ── Right column ── */}
      <div className="flex flex-col flex-1 min-w-0 md:ml-[280px]">

        {/* ── Mobile M3 Top App Bar ── */}
        <MobileTopBar
          title={mobileTitle}
          activeProject={activeProject}
          projects={projects}
          onProjectChange={onProjectChange}
          onMenu={() => setMobileNavOpen(true)}
          onLogout={onLogout}
          currentUser={currentUser}
          canSwitch={!isProjectTeam && projects.length > 1}
        />

        {/* ── Desktop Top App Bar ── */}
        <header className="hidden md:flex bg-glass-surface/80 backdrop-blur-md border-b border-border-slate sticky top-0 z-40 h-topbar-safe pt-safe items-center justify-between px-10 gap-6">

          {/* Spacer — page-level views provide their own scoped search */}
          <div className="flex-1" />

          {/* Utility icons */}
          <div className="flex items-center gap-1 shrink-0">

            {/* Project selector — hidden on /documents (workspace bar handles it there) */}
            {!isDocuments && (
              <div className="flex">
              {(isProjectTeam || projects.length <= 1) ? (
                <div className="flex items-center gap-3 bg-surface-container-low border border-outline-variant rounded-xl px-4 py-2.5 min-w-[200px]">
                  <span className="w-3 h-3 rounded-full shrink-0 bg-primary" />
                  <div className="flex flex-col items-start min-w-0 text-left flex-1">
                    <span className="font-mono text-[12px] font-bold text-primary leading-none tracking-wide">{activeProject?.code ?? "—"}</span>
                    <span className="text-[11px] text-on-surface-variant leading-none mt-1 truncate max-w-[180px]">
                      {activeProject?.name?.split("—")[1]?.trim() ?? activeProject?.name ?? ""}
                    </span>
                  </div>
                </div>
              ) : (
                <ProjectSelector
                  projects={projects}
                  activeProject={activeProject}
                  onChange={onProjectChange}
                  onNew={onNewProject}
                  isRestricted={!isDirector}
                />
              )}
              </div>
            )}

            <div className="h-6 w-px bg-border-slate mx-1" />

            <button
              onClick={onLogout}
              className="p-2 text-on-surface-variant hover:bg-status-rose-bg hover:text-status-rose-text rounded-full transition-colors"
              title="Sign out"
              aria-label="Sign out"
            >
              <span className="material-symbols-outlined text-[20px]">logout</span>
            </button>

            <div
              className="w-8 h-8 rounded-full bg-primary flex items-center justify-center text-white text-[13px] font-bold cursor-pointer border border-border-slate ml-1"
              title={currentUser.name}
            >
              {currentUser.name.charAt(0).toUpperCase()}
            </div>
          </div>
        </header>

        {/* ── Page content rendered by child route ── */}
        {/* pb-24 clears the mobile bottom nav; desktop resets to 40px */}
        <main className="flex-1 p-4 pb-24 md:p-[40px] md:pb-[40px] overflow-x-hidden bg-surface-container-low md:bg-transparent">
          <PullToRefresh onRefresh={onRefresh}>
            <ErrorBoundary>
              <Outlet />
            </ErrorBoundary>
          </PullToRefresh>
        </main>
      </div>

      {/* Contextual extended FAB (mobile) */}
      {fab && fab.onClick && (
        <button
          onClick={fab.onClick}
          className={`md:hidden fixed right-4 bottom-20 z-40 inline-flex items-center gap-2 h-[52px] px-[18px] rounded-2xl bg-primary text-white text-[14px] font-semibold shadow-[0_6px_16px_rgba(53,37,205,0.34),0_2px_4px_rgba(16,24,40,0.10)] active:scale-[0.97] active:shadow-card transition-[transform,opacity] duration-200 ${
            fabVisible ? "opacity-100 translate-y-0 pointer-events-auto" : "opacity-0 translate-y-2 pointer-events-none"
          }`}
        >
          <span className="material-symbols-outlined text-[20px]">{fab.icon}</span>
          {fab.label}
        </button>
      )}

      <BottomNav isDirector={isDirector} />
    </div>
  );
}

/* Material 3 mobile top app bar: menu · two-line title (with tappable project
   switcher) · search · notifications · avatar (account menu with Sign out).
   Search & notifications are visual per the M3 spec — no backing feature yet. */
const PROJECT_DOTS = ["#3525cd", "#2563eb", "#059669", "#d97706", "#9333ea"];

function MobileTopBar({ title, activeProject, projects, onProjectChange, onMenu, onLogout, currentUser, canSwitch }) {
  const [menu, setMenu] = useState(null); // 'project' | 'account' | null
  const ref = useRef(null);

  useEffect(() => {
    const close = (e) => { if (ref.current && !ref.current.contains(e.target)) setMenu(null); };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  const shortName = activeProject?.name?.split("—")[1]?.trim() ?? activeProject?.name ?? "";

  return (
    <header ref={ref} className="md:hidden bg-surface border-b border-outline-variant sticky top-0 z-40 pt-safe">
      <div className="flex items-center gap-1.5 pl-1.5 pr-2 py-2 min-h-[60px]">
        {/* Menu */}
        <button onClick={onMenu} aria-label="Open navigation"
          className="w-11 h-11 grid place-items-center rounded-full text-on-surface-variant active:bg-black/5 shrink-0">
          <span className="material-symbols-outlined text-[24px]">menu</span>
        </button>

        {/* Title block */}
        <div className="flex-1 min-w-0">
          <div className="text-[19px] font-semibold text-on-surface tracking-[-0.01em] leading-tight truncate">{title}</div>
          {activeProject && (
            canSwitch ? (
              <button
                onClick={() => setMenu(m => m === "project" ? null : "project")}
                aria-label={`Switch project — current ${activeProject.code}`}
                aria-haspopup="menu"
                aria-expanded={menu === "project"}
                className="mt-1 inline-flex items-center gap-1.5 max-w-full rounded-full bg-primary/10 border border-primary/20 pl-2 pr-1.5 py-1 active:bg-primary/20 transition-colors outline-none focus-visible:ring-2 focus-visible:ring-primary"
              >
                <span className="w-2 h-2 rounded-full bg-primary shrink-0" />
                <span className="font-mono text-[12.5px] font-bold text-primary leading-none shrink-0">{activeProject.code}</span>
                {shortName && <span className="text-[11px] text-on-surface-variant leading-none truncate">· {shortName}</span>}
                <span className={`material-symbols-outlined text-[18px] text-primary shrink-0 transition-transform duration-200 ${menu === "project" ? "rotate-180" : ""}`}>
                  expand_more
                </span>
              </button>
            ) : (
              <span className="mt-1 inline-flex items-center gap-1.5 max-w-full rounded-full bg-surface-container-low border border-outline-variant pl-2 pr-2.5 py-1">
                <span className="w-2 h-2 rounded-full bg-primary shrink-0" />
                <span className="font-mono text-[12.5px] font-bold text-primary leading-none shrink-0">{activeProject.code}</span>
                {shortName && <span className="text-[11px] text-on-surface-variant leading-none truncate">· {shortName}</span>}
              </span>
            )
          )}
        </div>

        {/* Avatar / account */}
        <button
          onClick={() => setMenu(m => m === "account" ? null : "account")}
          title={currentUser?.name}
          aria-label={`Account menu for ${currentUser?.name}`}
          aria-haspopup="menu"
          aria-expanded={menu === "account"}
          className="w-8 h-8 rounded-full bg-primary text-white text-[13px] font-bold grid place-items-center shrink-0 ml-0.5 outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
        >
          {(currentUser?.name || "?").charAt(0).toUpperCase()}
        </button>
      </div>

      {/* Project switcher dropdown */}
      {menu === "project" && (
        <div className="absolute left-3 top-full mt-1 w-[min(18rem,calc(100vw-2rem))] bg-surface border border-outline-variant rounded-xl shadow-card-lg z-[60] overflow-hidden">
          <div className="px-4 pt-3 pb-2 border-b border-border-slate">
            <p className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest">Switch Project</p>
          </div>
          <div className="py-1 max-h-60 overflow-y-auto custom-scrollbar">
            {projects.map((p, idx) => {
              const isActive = p.id === activeProject?.id;
              return (
                <button
                  key={p.id}
                  onClick={() => { onProjectChange(p); setMenu(null); }}
                  className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors ${isActive ? "bg-primary/10" : "active:bg-surface-container-low"}`}
                >
                  <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: PROJECT_DOTS[idx % PROJECT_DOTS.length] }} />
                  <div className="flex-1 min-w-0">
                    <p className={`font-mono text-[12px] font-bold leading-tight ${isActive ? "text-primary" : "text-on-surface"}`}>{p.code}</p>
                    <p className="text-[11px] text-on-surface-variant truncate mt-0.5">{p.name?.split("—")[1]?.trim() ?? p.name}</p>
                  </div>
                  {isActive && <span className="material-symbols-outlined text-[16px] text-primary shrink-0">check_circle</span>}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Account menu */}
      {menu === "account" && (
        <div className="absolute right-2 top-full mt-1 w-56 bg-surface border border-outline-variant rounded-xl shadow-card-lg z-[60] overflow-hidden">
          <div className="px-4 py-3 border-b border-border-slate">
            <p className="text-[13px] font-semibold text-on-surface truncate">{currentUser?.name}</p>
            <p className="text-[11px] text-on-surface-variant truncate">{currentUser?.role}</p>
          </div>
          <button
            onClick={() => { setMenu(null); onLogout(); }}
            className="w-full flex items-center gap-2 px-4 py-3 text-left text-status-rose-text active:bg-status-rose-bg"
          >
            <span className="material-symbols-outlined text-[18px]">logout</span>
            <span className="text-[13px] font-medium">Sign out</span>
          </button>
        </div>
      )}
    </header>
  );
}
