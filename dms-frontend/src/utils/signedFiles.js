import { API } from "../components/documents/constants";
import { isNative, openExternal } from "./native";

export function fileNameFromPath(path = "") {
  const raw = String(path || "");
  const last = raw.split("?")[0].split("/").filter(Boolean).pop() || "";
  try {
    return decodeURIComponent(last);
  } catch {
    return last;
  }
}

async function fetchSignedFileUrl(endpoint, token) {
  const res = await fetch(`${API}${endpoint}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || "Could not create a secure file link.");
  }
  return res.json();
}

async function openSignedFile(endpoint, token) {
  let popup = null;
  if (!isNative()) popup = window.open("about:blank", "_blank", "noopener");
  try {
    const { url } = await fetchSignedFileUrl(endpoint, token);
    if (isNative()) {
      openExternal(url);
    } else if (popup) {
      popup.location.href = url;
    } else {
      openExternal(url);
    }
    return url;
  } catch (err) {
    if (popup) popup.close();
    throw err;
  }
}

export function drawingFileEndpoint(drawing, mode = "view") {
  return `/api/drawings/${drawing.id}/file-url?mode=${mode === "download" ? "download" : "view"}`;
}

export function revisionFileEndpoint(drawing, revision, mode = "view") {
  const safeMode = mode === "download" ? "download" : "view";
  if (revision.current || revision.id == null) {
    return `/api/drawings/${drawing.id}/file-url?mode=${safeMode}`;
  }
  return `/api/drawing-revisions/${revision.id}/file-url?mode=${safeMode}`;
}

export function openSignedDrawingFile(drawing, token, mode = "view") {
  return openSignedFile(drawingFileEndpoint(drawing, mode), token);
}

export function openSignedRevisionFile(drawing, revision, token, mode = "view") {
  return openSignedFile(revisionFileEndpoint(drawing, revision, mode), token);
}

export function transmittalPdfEndpoint(transmittal) {
  return `/api/transmittals/${transmittal.id}/pdf-url`;
}

export function openTransmittalPdf(transmittal, token) {
  return openSignedFile(transmittalPdfEndpoint(transmittal), token);
}
