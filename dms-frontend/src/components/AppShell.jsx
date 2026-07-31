import { useEffect, useRef, useState } from "react";
import { Outlet, useLocation } from "react-router-dom";
import ErrorBoundary from "./ErrorBoundary";
import MobileBottomNav from "./MobileBottomNav";
import Sidebar from "./Sidebar";
import ProjectSelector from "./ProjectSelector";

const MOBILE_TITLES = {
  "/dashboard": "Dashboard",
  "/documents": "Documents",
  "/register": "Drawing Register",
  "/transmittals": "Transmittals",
  "/analytics": "Analytics",
  "/settings": "Settings",
};

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
}) {
  const { pathname } = useLocation();
  const isDocuments  = pathname === "/documents";

  return (
    <div className="workspace-shell bg-background text-on-surface font-outfit min-h-[100dvh] flex">

      <Sidebar
        isDirector={isDirector}
        mobileOpen={mobileNavOpen}
        onMobileClose={() => setMobileNavOpen(false)}
      />

      {/* ── Right column ── */}
      <div className="flex flex-col flex-1 min-w-0 md:ml-[280px]">

        <MobileTopBar
          title={MOBILE_TITLES[pathname] ?? "DrawVault"}
          activeProject={activeProject}
          projects={projects}
          onProjectChange={onProjectChange}
          onMenu={() => setMobileNavOpen(true)}
          canSwitch={!isProjectTeam && projects.length > 1}
        />

        {/* ── Desktop Top App Bar ── */}
        <header className="hidden md:flex bg-glass-surface backdrop-blur-md border-b border-border-slate sticky top-0 z-40 h-16 items-center justify-between px-10 gap-6">
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
        <main className="workspace-main flex-1 min-w-0 p-4 mobile-page-bottom md:p-[40px] md:pb-[40px]">
          <ErrorBoundary>
            <Outlet />
          </ErrorBoundary>
        </main>
      </div>

      <MobileBottomNav isDirector={isDirector} onLogout={onLogout} />
    </div>
  );
}

function MobileTopBar({ title, activeProject, projects, onProjectChange, onMenu, canSwitch }) {
  const [open, setOpen] = useState(false);
  const regionRef = useRef(null);
  const triggerRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const onPointerDown = event => {
      if (!regionRef.current?.contains(event.target)) setOpen(false);
    };
    const onKeyDown = event => {
      if (event.key === "Escape") {
        setOpen(false);
        triggerRef.current?.focus();
      }
    };
    document.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  const projectName = activeProject?.name?.split("—")[1]?.trim() ?? activeProject?.name ?? "No project selected";

  return (
    <header ref={regionRef} className="md:hidden sticky top-0 z-[200] safe-top border-b border-border-slate bg-surface/95 backdrop-blur">
      <div className="min-h-[64px] flex items-center gap-2 px-2 py-2">
        <button type="button" onClick={onMenu} className="mobile-touch-target grid place-items-center rounded-full text-on-surface-variant" aria-label="Open navigation">
          <span className="material-symbols-outlined text-[24px]" aria-hidden="true">menu</span>
        </button>
        <div className="flex-1 min-w-0">
          <h1 className="workspace-heading text-[19px] leading-tight truncate">{title}</h1>
          {activeProject && (
            <button
              ref={triggerRef}
              type="button"
              disabled={!canSwitch}
              onClick={() => setOpen(value => !value)}
              className="mt-0.5 min-h-11 max-w-full inline-flex items-center gap-1.5 rounded-md text-left text-primary disabled:text-on-surface-variant"
              aria-haspopup={canSwitch ? "menu" : undefined}
              aria-expanded={canSwitch ? open : undefined}
              aria-label={canSwitch ? `Switch project. Current project ${activeProject.code}, ${projectName}` : `Current project ${activeProject.code}, ${projectName}`}
            >
              <span className="h-2 w-2 rounded-full bg-primary shrink-0" />
              <span className="font-mono text-[12px] font-semibold shrink-0">{activeProject.code}</span>
              <span className="text-[12px] truncate text-on-surface-variant">{projectName}</span>
              {canSwitch && <span className="material-symbols-outlined text-[17px] shrink-0" aria-hidden="true">expand_more</span>}
            </button>
          )}
        </div>
      </div>

      {open && (
        <div className="absolute left-3 right-3 top-full mt-1 max-h-[min(60dvh,24rem)] overflow-y-auto rounded-xl border border-border-slate bg-surface p-1 shadow-card-lg" role="menu" aria-label="Choose project">
          {projects.map(project => {
            const selected = project.id === activeProject?.id;
            return (
              <button
                key={project.id}
                type="button"
                role="menuitemradio"
                aria-checked={selected}
                onClick={() => { onProjectChange(project); setOpen(false); triggerRef.current?.focus(); }}
                className={`w-full min-h-[52px] flex items-center gap-3 rounded-lg px-3 py-2 text-left ${selected ? "bg-primary-fixed" : ""}`}
              >
                <span className="font-mono text-[12px] font-semibold text-primary shrink-0">{project.code}</span>
                <span className="flex-1 min-w-0 text-[13px] text-on-surface truncate">{project.name}</span>
                {selected && <span className="material-symbols-outlined text-[18px] text-primary" aria-hidden="true">check</span>}
              </button>
            );
          })}
        </div>
      )}
    </header>
  );
}
