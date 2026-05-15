export default function Sidebar({ activeProject }) {
  return (
    <aside className="hidden md:flex flex-col h-screen py-6 px-4 bg-surface/80 dark:bg-surface/80 backdrop-blur-xl w-64 fixed left-0 top-0 bg-surface-container-low dark:bg-surface-container-low/50 border-r border-white/10 shadow-[20px_0_25px_-5px_rgba(0,0,0,0.3)] z-50">
      <div className="flex items-center gap-3 mb-8">
        <div className="w-10 h-10 rounded-lg overflow-hidden shrink-0 border border-white/10 bg-gradient-to-br from-primary-container to-primary flex items-center justify-center text-on-primary-container shadow-[0_0_15px_rgba(79,70,229,0.3)]">
          <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>architecture</span>
        </div>
        <div className="flex flex-col">
          <span className="font-headline-sm text-headline-sm font-bold text-primary dark:text-primary tracking-tight">DrawVault</span>
          <span className="font-label-md text-label-md text-on-surface-variant truncate w-36" title={activeProject?.name}>{activeProject?.name || "No Project"}</span>
        </div>
      </div>
      
      <nav className="flex-1 space-y-2 mt-4">
        <a href="#" className="flex items-center gap-3 px-3 py-2 rounded-lg font-label-md text-label-md text-primary dark:text-primary bg-primary/10 border-r-2 border-primary active:scale-[0.98] transition-transform">
          <span className="material-symbols-outlined text-[20px]">dashboard</span>
          <span>Dashboard</span>
        </a>
        <a href="#" className="flex items-center gap-3 px-3 py-2 rounded-lg font-label-md text-label-md text-on-surface-variant dark:text-on-surface-variant hover:text-on-surface hover:bg-white/5 transition-colors duration-200 active:scale-[0.98]">
          <span className="material-symbols-outlined text-[20px]">architecture</span>
          <span>Drawing Register</span>
        </a>
        <a href="#" className="flex items-center gap-3 px-3 py-2 rounded-lg font-label-md text-label-md text-on-surface-variant dark:text-on-surface-variant hover:text-on-surface hover:bg-white/5 transition-colors duration-200 active:scale-[0.98]">
          <span className="material-symbols-outlined text-[20px]">send_and_archive</span>
          <span>Transmittals</span>
        </a>
        <a href="#" className="flex items-center gap-3 px-3 py-2 rounded-lg font-label-md text-label-md text-on-surface-variant dark:text-on-surface-variant hover:text-on-surface hover:bg-white/5 transition-colors duration-200 active:scale-[0.98]">
          <span className="material-symbols-outlined text-[20px]">folder_open</span>
          <span>Documents</span>
        </a>
        <a href="#" className="flex items-center gap-3 px-3 py-2 rounded-lg font-label-md text-label-md text-on-surface-variant dark:text-on-surface-variant hover:text-on-surface hover:bg-white/5 transition-colors duration-200 active:scale-[0.98]">
          <span className="material-symbols-outlined text-[20px]">insights</span>
          <span>Analytics</span>
        </a>
      </nav>

      <div className="mt-auto pt-6 border-t border-white/5 space-y-4">
        <div className="space-y-1">
          <a href="#" className="flex items-center gap-3 px-3 py-2 rounded-lg font-label-md text-label-md text-on-surface-variant dark:text-on-surface-variant hover:text-on-surface hover:bg-white/5 transition-colors duration-200 active:scale-[0.98]">
            <span className="material-symbols-outlined text-[20px]">settings</span>
            <span>Settings</span>
          </a>
          <a href="#" className="flex items-center gap-3 px-3 py-2 rounded-lg font-label-md text-label-md text-on-surface-variant dark:text-on-surface-variant hover:text-on-surface hover:bg-white/5 transition-colors duration-200 active:scale-[0.98]">
            <span className="material-symbols-outlined text-[20px]">help_outline</span>
            <span>Support</span>
          </a>
        </div>
      </div>
    </aside>
  );
}
