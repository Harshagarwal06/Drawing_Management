import { Preferences } from "@capacitor/preferences";
import { SecureStoragePlugin } from "capacitor-secure-storage-plugin";
import { isNative } from "./native";

/* Async key/value store for the session blob.

   - Web: plain localStorage (unchanged behaviour — the web app is unaffected).
   - Native (Capacitor): the value lives in Keystore-backed encrypted storage
     (AndroidKeyStore-encrypted SharedPreferences on Android, Keychain on iOS)
     so the token is unreadable even on a rooted / forensically imaged device.

   On native, getStored migrates from older storage locations exactly once:
   Preferences (previous release) and WebView localStorage (release before
   that). A found value is copied into secure storage and removed from its
   old home, so existing logged-in users aren't forced to log in again. */

async function secureGet(key) {
  try {
    const { value } = await SecureStoragePlugin.get({ key });
    return value ?? null;
  } catch {
    return null; // the plugin rejects when the key doesn't exist
  }
}

export async function getStored(key) {
  if (!isNative()) return localStorage.getItem(key);

  const secure = await secureGet(key);
  if (secure != null) return secure;

  const { value: pref } = await Preferences.get({ key });
  if (pref != null) {
    await SecureStoragePlugin.set({ key, value: pref });
    await Preferences.remove({ key });
    return pref;
  }

  const legacy = localStorage.getItem(key);
  if (legacy != null) {
    await SecureStoragePlugin.set({ key, value: legacy });
    localStorage.removeItem(key);
    return legacy;
  }
  return null;
}

export async function setStored(key, value) {
  if (!isNative()) {
    localStorage.setItem(key, value);
    return;
  }
  await SecureStoragePlugin.set({ key, value });
}

export async function removeStored(key) {
  if (!isNative()) {
    localStorage.removeItem(key);
    return;
  }
  try {
    await SecureStoragePlugin.remove({ key });
  } catch {
    // the plugin rejects when the key is already absent — that's fine
  }
}
