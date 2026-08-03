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

const { mimeTypeFor, WILDCARD_MIME } = await import("./native");

describe("mimeTypeFor", () => {
  it("maps types Android can open directly", () => {
    expect(mimeTypeFor("plan.pdf")).toBe("application/pdf");
    expect(mimeTypeFor("photo.JPG")).toBe("image/jpeg");
    expect(mimeTypeFor("sheet.xlsx")).toBe(
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    );
  });

  // CAD files have no MIME type Android maps to an installed app; the
  // wildcard forces the chooser so the user's DWG viewer is offered.
  it("falls back to the wildcard for CAD formats", () => {
    for (const name of ["site.dwg", "site.dxf", "model.ifc", "model.rvt", "model.nwd"]) {
      expect(mimeTypeFor(name)).toBe(WILDCARD_MIME);
    }
  });

  it("falls back to the wildcard for missing or extensionless names", () => {
    expect(mimeTypeFor("")).toBe(WILDCARD_MIME);
    expect(mimeTypeFor(undefined)).toBe(WILDCARD_MIME);
    expect(mimeTypeFor("drawing")).toBe(WILDCARD_MIME);
  });
});
