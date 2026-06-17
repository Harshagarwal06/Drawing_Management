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
  mobileNavOpen,
  setMobileNavOpen,
  onProjectChange,
  onNewProject,
  onRefresh,
}) {
  const { pathname } = useLocation();
  const isDocuments  = pathname === "/documents";

  const MOBILE_TITLES = {
    "/dashboard":    "Dashboard",
    "/documents":    "Documents",
    "/register":     "Drawing Register",
    "/transmittals": "Transmittals",
    "/analytics":    "Analytics",
    "/settings":     "Settings",
  };
  const mobileTitle = MOBILE_TITLES[pathname] ?? "";

  return (
    <div className="bg-background text-on-surface font-outfit min-h-screen flex">

      <Sidebar
        isDirector={isDirector}
        mobileOpen={mobileNavOpen}
        onMobileClose={() => setMobileNavOpen(false)}
      />

      {/* ── Right column ── */}
      <div className="flex flex-col flex-1 min-w-0 md:ml-[280px]">

        {/* ── Top App Bar ── */}
        <header className="bg-glass-surface/80 backdrop-blur-md border-b border-border-slate sticky top-0 z-40 h-topbar-safe pt-safe flex items-center justify-between px-4 md:px-10 gap-4 md:gap-6">

          {/* Hamburger — mobile only */}
          <button
            onClick={() => setMobileNavOpen(true)}
            className="md:hidden p-2 -ml-1 text-on-surface-variant hover:bg-surface-container rounded-lg transition-colors shrink-0"
            aria-label="Open navigation"
          >
            <span className="material-symbols-outlined text-[24px]">menu</span>
          </button>

          {/* Page title — mobile only; desktop views render their own headers */}
          <h1 className="md:hidden text-[15px] font-semibold text-on-surface truncate">{mobileTitle}</h1>

          {/* Spacer — page-level views provide their own scoped search */}
          <div className="flex-1" />

          {/* Project chip — mobile only (desktop shows it in the utility row;
              /documents has its own workspace bar so skip it there) */}
          {!isDocuments && activeProject && (
            <span className="md:hidden inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-full bg-surface-container-low border border-outline-variant shrink-0">
              <span className="w-[7px] h-[7px] rounded-full bg-primary shrink-0" />
              <span className="font-mono text-[11px] font-bold text-primary leading-none">{activeProject?.code ?? "—"}</span>
            </span>
          )}

          {/* Utility icons */}
          <div className="flex items-center gap-1 shrink-0">

            {/* Project selector — hidden on /documents (workspace bar handles it there) */}
            {!isDocuments && (
              <div className="hidden md:flex">
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
        <main className="flex-1 p-4 pb-24 md:p-[40px] md:pb-[40px] overflow-x-hidden">
          <PullToRefresh onRefresh={onRefresh}>
            <ErrorBoundary>
              <Outlet />
            </ErrorBoundary>
          </PullToRefresh>
        </main>
      </div>

      <BottomNav isDirector={isDirector} />
    </div>
  );
}
