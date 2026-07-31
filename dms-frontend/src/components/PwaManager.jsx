import { useCallback, useEffect, useRef, useState } from "react";
import { useRegisterSW } from "virtual:pwa-register/react";
import { isIosDevice, isStandaloneMode } from "../pwa/install";

const INSTALL_DISMISSED_KEY = "drawvault_install_prompt_dismissed";

export default function PwaManager() {
  const [isOnline, setIsOnline] = useState(() => typeof navigator === "undefined" || navigator.onLine);
  const [installEvent, setInstallEvent] = useState(null);
  const [installOpen, setInstallOpen] = useState(false);
  const [suggestInstall, setSuggestInstall] = useState(false);
  const [installing, setInstalling] = useState(false);
  const closeInstall = useCallback(() => setInstallOpen(false), []);

  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    immediate: true,
    onRegisterError(error) {
      console.error("DrawVault service worker registration failed", error);
    },
  });

  useEffect(() => {
    const online = () => setIsOnline(true);
    const offline = () => setIsOnline(false);
    const beforeInstall = event => {
      event.preventDefault();
      setInstallEvent(event);
      if (!isStandaloneMode() && localStorage.getItem(INSTALL_DISMISSED_KEY) !== "1") setSuggestInstall(true);
    };
    const showInstall = () => setInstallOpen(true);

    window.addEventListener("online", online);
    window.addEventListener("offline", offline);
    window.addEventListener("beforeinstallprompt", beforeInstall);
    window.addEventListener("drawvault:show-install", showInstall);

    const timer = window.setTimeout(() => {
      if (!isStandaloneMode() && isIosDevice() && localStorage.getItem(INSTALL_DISMISSED_KEY) !== "1") setSuggestInstall(true);
    }, 1800);

    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("online", online);
      window.removeEventListener("offline", offline);
      window.removeEventListener("beforeinstallprompt", beforeInstall);
      window.removeEventListener("drawvault:show-install", showInstall);
    };
  }, []);

  const dismissSuggestion = () => {
    localStorage.setItem(INSTALL_DISMISSED_KEY, "1");
    setSuggestInstall(false);
  };

  const install = async () => {
    if (!installEvent) {
      setInstallOpen(true);
      return;
    }
    setInstalling(true);
    await installEvent.prompt();
    await installEvent.userChoice;
    setInstalling(false);
    setInstallEvent(null);
    setInstallOpen(false);
    setSuggestInstall(false);
  };

  return (
    <>
      {!isOnline && (
        <div className="pwa-banner fixed top-0 inset-x-0 z-[500] safe-top px-3 py-2 shadow-card" role="status" aria-live="polite">
          <div className="mx-auto flex max-w-3xl items-center justify-center gap-2 text-[13px]">
            <span className="material-symbols-outlined text-[18px]" aria-hidden="true">cloud_off</span>
            <span className="flex-1 sm:flex-none">You’re offline. Live drawings and project data are unavailable.</span>
            <button type="button" onClick={() => window.location.reload()} className="min-h-11 px-3 rounded-md border border-current font-semibold whitespace-nowrap">Retry</button>
          </div>
        </div>
      )}

      {needRefresh && (
        <ActionBanner
          icon="system_update"
          title="DrawVault update ready"
          detail="Update when you are not uploading or editing a form."
          primary="Update now"
          onPrimary={() => updateServiceWorker(true)}
          onDismiss={() => setNeedRefresh(false)}
        />
      )}

      {suggestInstall && !needRefresh && !isStandaloneMode() && (
        <ActionBanner
          icon="install_mobile"
          title="Install DrawVault"
          detail="Open projects from your home screen without installing an iOS app."
          primary={installEvent ? "Install" : "View steps"}
          onPrimary={install}
          onDismiss={dismissSuggestion}
        />
      )}

      {installOpen && (
        <InstallGuide
          canPrompt={Boolean(installEvent)}
          installing={installing}
          onInstall={install}
          onClose={closeInstall}
        />
      )}
    </>
  );
}

function ActionBanner({ icon, title, detail, primary, onPrimary, onDismiss }) {
  return (
    <aside className="fixed z-[500] left-3 right-3 bottom-[calc(4.75rem+env(safe-area-inset-bottom,0px))] md:left-auto md:right-5 md:bottom-5 md:w-[25rem] rounded-xl border border-border-slate bg-surface p-4 shadow-card-lg" aria-live="polite">
      <div className="flex gap-3">
        <span className="material-symbols-outlined text-primary text-[22px] shrink-0" aria-hidden="true">{icon}</span>
        <div className="flex-1 min-w-0">
          <p className="text-[14px] font-semibold text-on-surface">{title}</p>
          <p className="mt-1 text-[13px] leading-5 text-on-surface-variant">{detail}</p>
          <div className="mt-3 flex items-center gap-2">
            <button type="button" onClick={onPrimary} className="min-h-11 px-4 rounded-md bg-primary text-on-primary font-semibold text-[13px] whitespace-nowrap">{primary}</button>
            <button type="button" onClick={onDismiss} className="min-h-11 px-3 rounded-md text-on-surface-variant font-semibold text-[13px] whitespace-nowrap">Not now</button>
          </div>
        </div>
      </div>
    </aside>
  );
}

function InstallGuide({ canPrompt, installing, onInstall, onClose }) {
  const closeRef = useRef(null);
  const panelRef = useRef(null);
  const ios = isIosDevice();

  useEffect(() => {
    const previousActive = document.activeElement;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeRef.current?.focus();
    const onKeyDown = event => {
      if (event.key === "Escape") {
        onClose();
        return;
      }
      if (event.key !== "Tab") return;
      const focusable = [...(panelRef.current?.querySelectorAll(
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
      previousActive?.focus?.();
    };
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-[500] flex items-end md:items-center md:justify-center md:p-6" style={{ background: "var(--color-scrim)" }} onMouseDown={event => { if (event.target === event.currentTarget) onClose(); }}>
      <section ref={panelRef} className="mobile-sheet md:max-w-md md:rounded-xl w-full overflow-y-auto" role="dialog" aria-modal="true" aria-labelledby="install-guide-title">
        <div className="sticky top-0 flex items-center justify-between gap-4 border-b border-border-slate bg-surface px-5 py-4">
          <div>
            <h2 id="install-guide-title" className="workspace-heading text-[21px]">Install DrawVault</h2>
            <p className="mt-1 text-[13px] text-on-surface-variant">Home-screen access to the mobile website.</p>
          </div>
          <button ref={closeRef} type="button" onClick={onClose} className="mobile-touch-target grid place-items-center rounded-full text-on-surface-variant" aria-label="Close install guide">
            <span className="material-symbols-outlined" aria-hidden="true">close</span>
          </button>
        </div>

        <div className="p-5">
          {canPrompt ? (
            <>
              <p className="text-[14px] leading-6 text-on-surface-variant">Your browser can install DrawVault now. It opens in its own window and stays connected to the same secure website.</p>
              <button type="button" disabled={installing} onClick={onInstall} className="mt-5 w-full min-h-12 rounded-md bg-primary px-4 text-on-primary font-semibold disabled:cursor-not-allowed disabled:opacity-60">
                {installing ? "Opening install prompt…" : "Install DrawVault"}
              </button>
            </>
          ) : ios ? (
            <ol className="space-y-4 text-[14px] leading-6 text-on-surface">
              <InstallStep number="1" title="Open in Safari" detail="Installation from other iOS browsers may not show the Home Screen option." />
              <InstallStep number="2" title="Tap Share" detail="Use the Share button in Safari’s toolbar." />
              <InstallStep number="3" title="Choose Add to Home Screen" detail="Confirm the DrawVault name and tap Add." />
            </ol>
          ) : (
            <ol className="space-y-4 text-[14px] leading-6 text-on-surface">
              <InstallStep number="1" title="Open the browser menu" detail="Use the menu beside the address bar." />
              <InstallStep number="2" title="Choose Install app" detail="Some browsers call this Add to Home screen." />
              <InstallStep number="3" title="Confirm installation" detail="DrawVault will open as a standalone website." />
            </ol>
          )}
          <p className="mt-6 border-t border-border-slate pt-4 text-[12px] leading-5 text-on-surface-variant">Only the DrawVault interface is available offline. Drawings, transmittals, user information, and project data always require a live connection.</p>
        </div>
      </section>
    </div>
  );
}

function InstallStep({ number, title, detail }) {
  return (
    <li className="flex gap-3">
      <span className="h-8 w-8 rounded-md border border-primary/30 bg-primary-fixed text-primary font-mono text-[13px] font-semibold grid place-items-center shrink-0">{number}</span>
      <span><strong className="block font-semibold">{title}</strong><span className="text-on-surface-variant">{detail}</span></span>
    </li>
  );
}
