import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { drawingFileEndpoint, revisionFileEndpoint, openSignedDrawingFile, transmittalPdfEndpoint, openTransmittalPdf } from "./signedFiles";

const isNativeMock = vi.fn(() => false);
const isAndroidMock = vi.fn(() => false);
const openExternalMock = vi.fn();
const openFileNativeMock = vi.fn();
const shareFileNativeMock = vi.fn();
vi.mock("./native", () => ({
  isNative: () => isNativeMock(),
  isAndroid: () => isAndroidMock(),
  openExternal: (url) => openExternalMock(url),
  openFileNative: (url, name) => openFileNativeMock(url, name),
  shareFileNative: (url, name) => shareFileNativeMock(url, name),
}));

beforeEach(() => {
  isNativeMock.mockReturnValue(false);
  isAndroidMock.mockReturnValue(false);
  openExternalMock.mockClear();
  openFileNativeMock.mockClear();
  shareFileNativeMock.mockClear();
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

describe("signed file helpers", () => {
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

describe("signed file helpers on android", () => {
  beforeEach(() => {
    isNativeMock.mockReturnValue(true);
    isAndroidMock.mockReturnValue(true);
  });

  // Chrome Custom Tabs cannot render PDFs or CAD files, so Android opens must
  // go to a viewer app instead of Browser.open.
  it("opens files in a native viewer, not the in-app browser", async () => {
    await openTransmittalPdf({ id: 9 }, "token-123");
    expect(openFileNativeMock).toHaveBeenCalledWith("https://signed.example/file.pdf", "file.pdf");
    expect(openExternalMock).not.toHaveBeenCalled();
    expect(window.open).not.toHaveBeenCalled();
  });

  it("routes download mode to the share sheet", async () => {
    await openSignedDrawingFile({ id: 42 }, "token-123", "download");
    expect(shareFileNativeMock).toHaveBeenCalledWith("https://signed.example/file.pdf", "file.pdf");
    expect(openFileNativeMock).not.toHaveBeenCalled();
  });

  it("propagates native open failures so callers can surface them", async () => {
    openFileNativeMock.mockRejectedValueOnce(new Error("Activity not found"));
    await expect(openSignedDrawingFile({ id: 42 }, "token-123", "view")).rejects.toThrow("Activity not found");
  });
});

describe("signed file helpers on ios", () => {
  // iOS is deliberately untouched: SFSafariViewController renders PDFs, so it
  // keeps using the in-app browser rather than the Android file-opener path.
  beforeEach(() => {
    isNativeMock.mockReturnValue(true);
    isAndroidMock.mockReturnValue(false);
  });

  it("still opens the signed URL via the in-app browser", async () => {
    await openTransmittalPdf({ id: 9 }, "token-123");
    expect(openExternalMock).toHaveBeenCalledWith("https://signed.example/file.pdf");
    expect(openFileNativeMock).not.toHaveBeenCalled();
    expect(shareFileNativeMock).not.toHaveBeenCalled();
    expect(window.open).not.toHaveBeenCalled();
  });
});
