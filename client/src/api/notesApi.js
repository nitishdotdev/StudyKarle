import axiosClient, { API_URL } from "./axiosClient";
import downloadFromApi from "../utils/download";

export function fetchNote(noteId) {
  return axiosClient.get("/notes/" + noteId).then(function (res) {
    return res.data.data;
  });
}

// Lightweight warm-up used when hovering a note link. The response is served
// from the axios cache when the preview page mounts, so navigation feels
// instant. Failures are intentionally swallowed.
export function prefetchNote(noteId) {
  axiosClient.get("/notes/" + noteId).catch(function () {});
}

export function getPreviewUrl(noteId) {
  return API_URL + "/notes/" + noteId + "/preview";
}

// Download goes through the authenticated API layer (blob fetch) so the
// session cookie is always attached and the protected backend URL is never the
// browser's destination.
export function downloadNoteFile(noteId) {
  return downloadFromApi("/notes/" + noteId + "/download");
}

export function searchNotes(query, page, signal, filters) {
  const params = { q: query, page: page || 1 };
  if (filters && filters.kind) params.kind = filters.kind;
  if (filters && filters.year) params.year = filters.year;
  if (filters && filters.type) params.type = filters.type;
  if (filters && filters.limit) params.limit = filters.limit;
  return axiosClient.get("/search", { params: params, signal: signal }).then(function (res) {
    const items = res.data.data;
    return {
      notes: items,
      items: items,
      meta: res.data.meta,
      query: query,
    };
  });
}
