import { afterEach, describe, expect, it, vi } from "vitest";
import { isIosDevice, isStandaloneMode } from "../install";

describe("PWA device detection", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("detects standalone display mode", () => {
    window.matchMedia = vi.fn().mockReturnValue({ matches: true });
    expect(isStandaloneMode()).toBe(true);
  });

  it("detects an iOS user agent", () => {
    Object.defineProperty(navigator, "userAgent", { configurable: true, value: "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)" });
    expect(isIosDevice()).toBe(true);
  });
});

