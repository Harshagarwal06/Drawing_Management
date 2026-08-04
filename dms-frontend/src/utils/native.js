import { Capacitor } from "@capacitor/core";
import { App } from "@capacitor/app";
import { Browser } from "@capacitor/browser";
import { Filesystem, Directory } from "@capacitor/filesystem";
import { FileOpener } from "@capacitor-community/file-opener";
import { Share } from "@capacitor/share";

export const isNative = () => Capacitor.isNativePlatform();
export const isAndroid = () => Capacitor.getPlatform() === "android";

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

/* Android only. Documents must not go through the in-app browser there:
   Chrome Custom Tabs has no inline PDF viewer (it falls back to a download
   prompt) and no browser renders CAD formats at all, so a DWG tap did
   nothing. Instead we cache the bytes and hand them to the OS via
   ACTION_VIEW, which lets the user's own PDF/DWG app take over. iOS keeps
   using openExternal, where SFSafariViewController renders PDFs natively. */
const MIME_TYPES = {
  pdf:  "application/pdf",
  jpg:  "image/jpeg",
  jpeg: "image/jpeg",
  png:  "image/png",
  tif:  "image/tiff",
  tiff: "image/tiff",
  doc:  "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xls:  "application/vnd.ms-excel",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  // CAD viewers register these exact types. Verified against DWG FastView
  // (com.gstarmc.android) with `cmd package query-activities`.
  dwg:  "image/vnd.dwg",
  dxf:  "image/vnd.dxf",
  ifc:  "application/ifc",
  rvt:  "application/rvt",
  nwd:  "application/nwd",
};

// Never dispatch the wildcard type: it resolves to ZERO activities, so the
// chooser opens with "no application can perform this action" even when a
// capable app is installed. application/octet-stream is the generic binary
// type that real viewers do register for.
export const FALLBACK_MIME = "application/octet-stream";

export function mimeTypeFor(filename) {
  const ext = String(filename || "").toLowerCase().split(".").pop();
  return MIME_TYPES[ext] || FALLBACK_MIME;
}

/* Strip directory separators so a server-supplied name can't escape the
   cache directory it is written into. */
function safeCacheName(filename) {
  const base = String(filename || "").split(/[\\/]/).pop().trim();
  if (!base || base === "." || base === "..") return "drawing-file";
  return base;
}

/* Fetch a signed file URL into the cache directory and resolve its file://
   URI. getUri is asked for the location explicitly rather than trusting the
   shape of downloadFile's return value, which differs by platform. */
async function downloadToCache(url, name) {
  await Filesystem.downloadFile({ url, path: name, directory: Directory.Cache });
  const { uri } = await Filesystem.getUri({ path: name, directory: Directory.Cache });
  if (!uri) throw new Error("Could not save the file to open it.");
  return uri;
}

/* Download a signed file URL to the cache, then open it in a native viewer. */
export async function openFileNative(url, filename) {
  const name = safeCacheName(filename);
  const contentType = mimeTypeFor(name);
  const uri = await downloadToCache(url, name);
  await FileOpener.open({
    filePath: uri,
    contentType,
    // A known type opens straight in the default viewer; the wildcard has no
    // sensible default, so always let the user pick.
    openWithDefault: contentType !== FALLBACK_MIME,
  });
  return uri;
}

/* Download a signed file URL to the cache, then offer the native share sheet
   so the file can be saved out of the app. */
export async function shareFileNative(url, filename) {
  const name = safeCacheName(filename);
  const uri = await downloadToCache(url, name);
  await Share.share({ title: name, url: uri });
  return uri;
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
