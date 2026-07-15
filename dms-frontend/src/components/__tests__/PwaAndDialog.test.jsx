import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import PwaManager from "../PwaManager";
import UploadModal from "../UploadModal";

const sw = vi.hoisted(() => ({ needRefresh: false, update: vi.fn(), clear: vi.fn() }));

vi.mock("virtual:pwa-register/react", () => ({
  useRegisterSW: () => ({
    needRefresh: [sw.needRefresh, sw.clear],
    updateServiceWorker: sw.update,
  }),
}));

describe("PWA status and install UX", () => {
  beforeEach(() => {
    sw.needRefresh = false;
    sw.update.mockReset();
    sw.clear.mockReset();
    localStorage.clear();
    window.matchMedia = vi.fn().mockReturnValue({ matches: false });
    Object.defineProperty(navigator, "onLine", { configurable: true, value: true });
    Object.defineProperty(navigator, "userAgent", { configurable: true, value: "Mozilla/5.0 Chrome/140" });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("shows an honest offline banner with retry", () => {
    Object.defineProperty(navigator, "onLine", { configurable: true, value: false });
    render(<PwaManager />);
    expect(screen.getByRole("status")).toHaveTextContent("Live drawings and project data are unavailable");
    expect(screen.getByRole("button", { name: "Retry" })).toBeInTheDocument();
  });

  it("opens installation guidance on demand", () => {
    render(<PwaManager />);
    act(() => window.dispatchEvent(new CustomEvent("drawvault:show-install")));
    expect(screen.getByRole("dialog", { name: /Install DrawVault/ })).toBeInTheDocument();
    expect(screen.getByText("Open the browser menu")).toBeInTheDocument();
    expect(screen.getByText(/drawings, transmittals, user information, and project data always require a live connection/i)).toBeInTheDocument();
  });

  it("prompts before activating a waiting service worker", () => {
    sw.needRefresh = true;
    render(<PwaManager />);
    expect(screen.getByText("DrawVault update ready")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Update now" }));
    expect(sw.update).toHaveBeenCalledWith(true);
  });
});

describe("dialog accessibility", () => {
  it("labels the upload dialog, locks background scroll, and closes on Escape", async () => {
    const onClose = vi.fn();
    render(<UploadModal onClose={onClose} onSubmit={vi.fn()} initialFolder="Architecture" />);
    expect(screen.getByRole("dialog", { name: "Upload drawing" })).toBeInTheDocument();
    expect(document.body.style.overflow).toBe("hidden");
    await waitFor(() => expect(screen.getByRole("button", { name: "Close" })).toHaveFocus());
    fireEvent.keyDown(document, { key: "Escape" });
    expect(onClose).toHaveBeenCalled();
  });
});

