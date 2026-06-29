import { describe, it, expect, vi, beforeEach } from "vitest";

// isNative is mutable per test so we can exercise both web and native paths.
const isNativeMock = vi.fn(() => false);
vi.mock("./native", () => ({ isNative: () => isNativeMock() }));

// In-memory stand-in for the native Preferences plugin.
const prefStore = new Map();
const prefGet = vi.fn(async ({ key }) => ({ value: prefStore.has(key) ? prefStore.get(key) : null }));
const prefSet = vi.fn(async ({ key, value }) => { prefStore.set(key, value); });
const prefRemove = vi.fn(async ({ key }) => { prefStore.delete(key); });
vi.mock("@capacitor/preferences", () => ({
  Preferences: { get: (a) => prefGet(a), set: (a) => prefSet(a), remove: (a) => prefRemove(a) },
}));

import { getStored, setStored, removeStored } from "./tokenStore";

beforeEach(() => {
  isNativeMock.mockReturnValue(false);
  localStorage.clear();
  prefStore.clear();
  vi.clearAllMocks();
});

describe("tokenStore on web", () => {
  it("stores and reads through localStorage", async () => {
    await setStored("dms_user", "abc");
    expect(localStorage.getItem("dms_user")).toBe("abc");
    expect(await getStored("dms_user")).toBe("abc");
  });

  it("removes through localStorage", async () => {
    localStorage.setItem("dms_user", "abc");
    await removeStored("dms_user");
    expect(localStorage.getItem("dms_user")).toBeNull();
  });

  it("never touches native Preferences on web", async () => {
    await setStored("dms_user", "abc");
    await getStored("dms_user");
    expect(prefSet).not.toHaveBeenCalled();
    expect(prefGet).not.toHaveBeenCalled();
  });
});

describe("tokenStore on native", () => {
  beforeEach(() => isNativeMock.mockReturnValue(true));

  it("reads from Preferences when a value is present", async () => {
    prefStore.set("dms_user", "native-val");
    expect(await getStored("dms_user")).toBe("native-val");
  });

  it("writes to Preferences, not localStorage", async () => {
    await setStored("dms_user", "v");
    expect(prefStore.get("dms_user")).toBe("v");
    expect(localStorage.getItem("dms_user")).toBeNull();
  });

  it("migrates an existing localStorage value into Preferences and clears it", async () => {
    localStorage.setItem("dms_user", "legacy");
    const val = await getStored("dms_user");
    expect(val).toBe("legacy");
    expect(prefStore.get("dms_user")).toBe("legacy");
    expect(localStorage.getItem("dms_user")).toBeNull();
  });

  it("returns null when neither store has a value", async () => {
    expect(await getStored("dms_user")).toBeNull();
  });

  it("removes from Preferences", async () => {
    prefStore.set("dms_user", "v");
    await removeStored("dms_user");
    expect(prefStore.has("dms_user")).toBe(false);
  });
});
