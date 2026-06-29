import { Preferences } from "@capacitor/preferences";
import { isNative } from "./native";

/* Async key/value store for the session blob.

   - Web: plain localStorage (unchanged behaviour — the web app is unaffected).
   - Native (Capacitor): the value lives in the OS-level Preferences store
     (app-private SharedPreferences on Android) instead of the WebView's
     localStorage, so injected page scripts can't read it directly.

   On native, getStored also performs a one-time migration: if a value is still
   sitting in the old localStorage location (an existing logged-in app session),
   it's copied into Preferences and removed from localStorage so the user isn't
   forced to log in again after upgrading. */

export async function getStored(key) {
  if (!isNative()) return localStorage.getItem(key);

  const { value } = await Preferences.get({ key });
  if (value != null) return value;

  const legacy = localStorage.getItem(key);
  if (legacy != null) {
    await Preferences.set({ key, value: legacy });
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
  await Preferences.set({ key, value });
}

export async function removeStored(key) {
  if (!isNative()) {
    localStorage.removeItem(key);
    return;
  }
  await Preferences.remove({ key });
}
