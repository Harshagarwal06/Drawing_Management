import { Capacitor } from "@capacitor/core";
import { App } from "@capacitor/app";
import { Browser } from "@capacitor/browser";
import { Filesystem, Directory } from "@capacitor/filesystem";
import { Share } from "@capacitor/share";

export const isNative = () => Capacitor.isNativePlatform();

/* Register Android/iOS lifecycle listeners. No-op on web.
   - back button: navigate back through history, exit the app at the root
   - resume: let the caller re-validate the session (token may have expired
     while the app was backgrounded)
   Returns an async cleanup function that removes the listeners. */
export function registerAppListeners({ onResume } = {}) {
  if (!isNative()) return () => {};

  const handles = [];

  handles.push(
    App.addListener("backButton", ({ canGoBack }) => {
      if (canGoBack && window.history.length > 1) window.history.back();
      else App.exitApp();
    }),
  );

  if (onResume) {
    handles.push(
      App.addListener("appStateChange", ({ isActive }) => {
        if (isActive) onResume();
      }),
    );
  }

  return async () => {
    for (const h of handles) (await h).remove();
  };
}

/* Open a file/URL — new tab on web, SFSafariViewController on iOS */
export function openExternal(url) {
  if (!url) return;
  if (isNative()) Browser.open({ url });
  else window.open(url, "_blank", "noopener");
}

/* onClick for <a target="_blank" / download> anchors — keeps normal web
   behaviour, routes through the in-app browser on iOS where WKWebView
   can't open new tabs or save anchor downloads */
export const anchorClick = url => e => {
  e.stopPropagation();
  if (isNative()) {
    e.preventDefault();
    openExternal(url);
  }
};

/* Save a generated Blob — anchor download on web, share sheet on iOS */
export async function saveBlob(filename, blob) {
  if (!isNative()) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
    return;
  }
  const data = await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(",")[1]);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
  const { uri } = await Filesystem.writeFile({ path: filename, data, directory: Directory.Cache });
  await Share.share({ title: filename, url: uri });
}
