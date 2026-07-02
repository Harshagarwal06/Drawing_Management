import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { transmittalPdfEndpoint, openTransmittalPdf } from "../signedFiles";

describe("signed transmittal PDF helpers", () => {
  let popup;

  beforeEach(() => {
    popup = { location: { href: "" }, close: vi.fn() };
    vi.stubGlobal("fetch", vi.fn(async () => ({
      ok: true,
      json: async () => ({ url: "https://signed.example/trn.pdf?sig=abc" }),
    })));
    vi.spyOn(window, "open").mockReturnValue(popup);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("builds the transmittal pdf-url endpoint", () => {
    expect(transmittalPdfEndpoint({ id: 9 })).toBe("/api/transmittals/9/pdf-url");
  });

  it("fetches a signed PDF link with auth, pre-opening a popup", async () => {
    await openTransmittalPdf({ id: 9 }, "token-123");
    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining("/api/transmittals/9/pdf-url"),
      { headers: { Authorization: "Bearer token-123" } },
    );
    expect(window.open).toHaveBeenCalledWith("about:blank", "_blank", "noopener");
    expect(popup.location.href).toBe("https://signed.example/trn.pdf?sig=abc");
  });

  it("closes the popup and rethrows when the link fetch fails", async () => {
    fetch.mockResolvedValueOnce({ ok: false, json: async () => ({ error: "Access denied" }) });
    await expect(openTransmittalPdf({ id: 9 }, "token-123")).rejects.toThrow("Access denied");
    expect(popup.close).toHaveBeenCalled();
  });
});
