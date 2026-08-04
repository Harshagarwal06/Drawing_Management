import { describe, it, expect, vi } from "vitest";

vi.mock("@capacitor/core", () => ({
  Capacitor: { isNativePlatform: () => false, getPlatform: () => "web" },
}));
vi.mock("@capacitor/app", () => ({ App: { addListener: vi.fn(), exitApp: vi.fn() } }));
vi.mock("@capacitor/browser", () => ({ Browser: { open: vi.fn() } }));
vi.mock("@capacitor/filesystem", () => ({
  Filesystem: { downloadFile: vi.fn(), getUri: vi.fn(), writeFile: vi.fn() },
  Directory: { Cache: "CACHE" },
}));
vi.mock("@capacitor-community/file-opener", () => ({ FileOpener: { open: vi.fn() } }));
vi.mock("@capacitor/share", () => ({ Share: { share: vi.fn() } }));

const { mimeTypeFor, FALLBACK_MIME } = await import("./native");

describe("mimeTypeFor", () => {
  it("maps types Android can open directly", () => {
    expect(mimeTypeFor("plan.pdf")).toBe("application/pdf");
    expect(mimeTypeFor("photo.JPG")).toBe("image/jpeg");
    expect(mimeTypeFor("sheet.xlsx")).toBe(
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    );
  });

  // These are the exact types CAD viewers register for — verified against DWG
  // FastView (com.gstarmc.android) with `cmd package query-activities`.
  it("maps CAD formats to the types CAD viewers register", () => {
    expect(mimeTypeFor("site.dwg")).toBe("image/vnd.dwg");
    expect(mimeTypeFor("site.DXF")).toBe("image/vnd.dxf");
    expect(mimeTypeFor("model.ifc")).toBe("application/ifc");
    expect(mimeTypeFor("model.rvt")).toBe("application/rvt");
    expect(mimeTypeFor("model.nwd")).toBe("application/nwd");
  });

  it("falls back to a real binary type for missing or extensionless names", () => {
    expect(mimeTypeFor("")).toBe(FALLBACK_MIME);
    expect(mimeTypeFor(undefined)).toBe(FALLBACK_MIME);
    expect(mimeTypeFor("drawing")).toBe(FALLBACK_MIME);
  });

  // The regression guard that matters: "*/*" resolves to zero activities on
  // Android, which is what hid DWG FastView from the chooser.
  it("never returns the wildcard type", () => {
    const names = [
      "a.dwg", "a.dxf", "a.ifc", "a.rvt", "a.nwd", "a.pdf", "a.png", "a.docx",
      "a.unknown", "noextension", "", undefined, null, "a.", ".dwg",
    ];
    for (const name of names) expect(mimeTypeFor(name)).not.toBe("*/*");
  });
});
