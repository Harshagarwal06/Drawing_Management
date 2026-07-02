import { describe, it, expect, vi, beforeEach } from "vitest";

// isNative is mutable per test so we can exercise both web and native paths.
const isNativeMock = vi.fn(() => false);
vi.mock("./native", () => ({ isNative: () => isNativeMock() }));

// In-memory stand-in for the secure storage plugin. Mirrors the real API:
// get/remove REJECT when the key is absent.
const secureStore = new Map();
const secureGet = vi.fn(async ({ key }) => {
  if (!secureStore.has(key)) throw new Error("Item with given key does not exist");
  return { value: secureStore.get(key) };
});
const secureSet = vi.fn(async ({ key, value }) => { secureStore.set(key, value); return { value: true }; });
const secureRemove = vi.fn(async ({ key }) => {
  if (!secureStore.has(key)) throw new Error("Item with given key does not exist");
  secureStore.delete(key);
  return { value: true };
});
vi.mock("capacitor-secure-storage-plugin", () => ({
  SecureStoragePlugin: { get: (a) => secureGet(a), set: (a) => secureSet(a), remove: (a) => secureRemove(a) },
}));

// In-memory stand-in for the legacy Preferences plugin (migration source).
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
  secureStore.clear();
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

  it("never touches native stores on web", async () => {
    await setStored("dms_user", "abc");
    await getStored("dms_user");
    expect(secureSet).not.toHaveBeenCalled();
    expect(secureGet).not.toHaveBeenCalled();
    expect(prefGet).not.toHaveBeenCalled();
  });
});

describe("tokenStore on native", () => {
  beforeEach(() => isNativeMock.mockReturnValue(true));

  it("reads from secure storage when a value is present", async () => {
    secureStore.set("dms_user", "secure-val");
    expect(await getStored("dms_user")).toBe("secure-val");
  });

  it("writes to secure storage, not Preferences or localStorage", async () => {
    await setStored("dms_user", "v");
    expect(secureStore.get("dms_user")).toBe("v");
    expect(prefStore.has("dms_user")).toBe(false);
    expect(localStorage.getItem("dms_user")).toBeNull();
  });

  it("migrates a Preferences value into secure storage and clears it", async () => {
    prefStore.set("dms_user", "pref-legacy");
    expect(await getStored("dms_user")).toBe("pref-legacy");
    expect(secureStore.get("dms_user")).toBe("pref-legacy");
    expect(prefStore.has("dms_user")).toBe(false);
  });

  it("migrates an old localStorage value into secure storage and clears it", async () => {
    localStorage.setItem("dms_user", "ls-legacy");
    expect(await getStored("dms_user")).toBe("ls-legacy");
    expect(secureStore.get("dms_user")).toBe("ls-legacy");
    expect(localStorage.getItem("dms_user")).toBeNull();
  });

  it("prefers secure storage over both legacy locations", async () => {
    secureStore.set("dms_user", "newest");
    prefStore.set("dms_user", "older");
    localStorage.setItem("dms_user", "oldest");
    expect(await getStored("dms_user")).toBe("newest");
  });

  it("returns null when no store has a value", async () => {
    expect(await getStored("dms_user")).toBeNull();
  });

  it("removes from secure storage, tolerating a missing key", async () => {
    secureStore.set("dms_user", "v");
    await removeStored("dms_user");
    expect(secureStore.has("dms_user")).toBe(false);
    await expect(removeStored("dms_user")).resolves.toBeUndefined(); // second call must not throw
  });
});
