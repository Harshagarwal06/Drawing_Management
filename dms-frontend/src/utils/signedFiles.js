const API = import.meta.env.VITE_API_URL;

/* Transmittal PDFs open in a new tab, where no Authorization header can be
   sent. Instead of embedding the 7-day session JWT in the URL (it leaks into
   browser history and server access logs), fetch a short-lived single-purpose
   signed link from the backend and open that.

   The popup is opened synchronously (before the await) so popup blockers
   allow it, then redirected once the signed URL arrives. */

export function transmittalPdfEndpoint(transmittal) {
  return `/api/transmittals/${transmittal.id}/pdf-url`;
}

export async function openTransmittalPdf(transmittal, token) {
  const popup = window.open("about:blank", "_blank", "noopener");
  try {
    const res = await fetch(`${API}${transmittalPdfEndpoint(transmittal)}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || "Could not create a secure file link.");
    }
    const { url } = await res.json();
    if (popup) popup.location.href = url;
    else window.open(url, "_blank", "noopener");
    return url;
  } catch (err) {
    if (popup) popup.close();
    throw err;
  }
}
