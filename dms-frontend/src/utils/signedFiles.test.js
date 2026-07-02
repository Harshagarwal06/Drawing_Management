import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { drawingFileEndpoint, revisionFileEndpoint, openSignedDrawingFile, transmittalPdfEndpoint, openTransmittalPdf } from "./signedFiles";

vi.mock("./native", () => ({
  isNative: () => false,
  openExternal: vi.fn(),
}));

describe("signed file helpers", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn(async () => ({
      ok: true,
      json: async () => ({ url: "https://signed.example/file.pdf", filename: "file.pdf", expiresAt: "2026-06-27T00:05:00.000Z" }),
    })));
    vi.spyOn(window, "open").mockReturnValue({ location: { href: "" }, close: vi.fn() });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("builds drawing and revision signed-url endpoints", () => {
    expect(drawingFileEndpoint({ id: 42 }, "download")).toBe("/api/drawings/42/file-url?mode=download");
    expect(revisionFileEndpoint({ id: 42 }, { id: 7 }, "view")).toBe("/api/drawing-revisions/7/file-url?mode=view");
    expect(revisionFileEndpoint({ id: 42 }, { current: true }, "download")).toBe("/api/drawings/42/file-url?mode=download");
  });

  it("fetches a signed URL with auth before opening it", async () => {
    await openSignedDrawingFile({ id: 42 }, "token-123", "view");
    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining("/api/drawings/42/file-url?mode=view"),
      { headers: { Authorization: "Bearer token-123" } },
    );
    expect(window.open).toHaveBeenCalledWith("about:blank", "_blank", "noopener");
  });

  it("builds the transmittal pdf-url endpoint", () => {
    expect(transmittalPdfEndpoint({ id: 9 })).toBe("/api/transmittals/9/pdf-url");
  });

  it("fetches a signed PDF link with auth before opening it", async () => {
    await openTransmittalPdf({ id: 9 }, "token-123");
    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining("/api/transmittals/9/pdf-url"),
      { headers: { Authorization: "Bearer token-123" } },
    );
    expect(window.open).toHaveBeenCalledWith("about:blank", "_blank", "noopener");
  });
});
