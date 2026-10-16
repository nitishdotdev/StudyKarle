import axiosClient from "../api/axiosClient";

// Download a protected file through the authenticated API layer instead of
// navigating the browser to a protected backend URL.
//
// Why this matters: StudyKarle's auth cookie is a partitioned cross-site
// cookie. A top-level browser navigation to the backend origin
// (https://studykarle-backend.onrender.com/api/...) lands in a different
// cookie partition (or a browser that ignores partitioning), so the session
// is not attached and the request is rejected. Fetching through axios (which
// always sends credentials in the same partition as the SPA) keeps the file
// protected AND makes downloads work on every device/browser. The bytes are
// streamed server-side; the client only reassembles a local object URL.

function filenameFromDisposition(disposition) {
  if (!disposition) return null;
  const encoded = disposition.match(/filename\*=UTF-8''([^;]+)/i);
  if (encoded && encoded[1]) {
    try {
      return decodeURIComponent(encoded[1]);
    } catch (e) {
      // fall through to the plain filename
    }
  }
  const plain = disposition.match(/filename="?([^";]+)"?/i);
  return plain && plain[1] ? plain[1].trim() : null;
}

function fallbackName(path) {
  const parts = String(path || "").split("/");
  const last = parts[parts.length - 1];
  if (!last || last === "download" || last === "preview") {
    return "download.pdf";
  }
  return last;
}

// `path` is relative to the axios baseURL (e.g. "/drive/files/abc/download").
export default function downloadFromApi(path) {
  return axiosClient
    .get(path, { responseType: "blob", skipCache: true })
    .then(function (res) {
      const disposition = res.headers && res.headers["content-disposition"];
      const filename = filenameFromDisposition(disposition) || fallbackName(path);
      const objectUrl = URL.createObjectURL(res.data);

      const link = document.createElement("a");
      link.href = objectUrl;
      link.download = filename;
      link.rel = "noopener";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.setTimeout(function () {
        URL.revokeObjectURL(objectUrl);
      }, 1000);

      return { filename: filename, size: res.data ? res.data.size : 0 };
    });
}
