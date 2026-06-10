import { Capacitor } from "@capacitor/core";
import { Browser } from "@capacitor/browser";
import { Filesystem, Directory } from "@capacitor/filesystem";
import { Share } from "@capacitor/share";

export const isNative = () => Capacitor.isNativePlatform();

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
