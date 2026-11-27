import axiosClient, { API_URL } from "./axiosClient";
import downloadFromApi from "../utils/download";

// Google Drive is the single source of truth. These endpoints browse the
// canonical Drive node tree (drive_nodes) by stable Drive file id, so the
// hierarchy is preserved exactly at any depth.

export function fetchDriveRoot() {
  return axiosClient.get("/drive").then(function (res) {
    return res.data.data;
  });
}

export function fetchDriveFolder(nodeId) {
  return axiosClient
    .get("/drive/nodes/" + encodeURIComponent(nodeId))
    .then(function (res) {
      return res.data.data;
    });
}

export function fetchDriveFile(nodeId) {
  return axiosClient
    .get("/drive/files/" + encodeURIComponent(nodeId), { skipCache: true })
    .then(function (res) {
      return res.data.data;
    });
}

// Preview is loaded by pdf.js through an authenticated XHR (withCredentials),
// never as the browser's top-level destination.
export function getDrivePreviewUrl(nodeId) {
  return API_URL + "/drive/files/" + encodeURIComponent(nodeId) + "/preview";
}

// Download goes through the authenticated API layer (blob fetch) so the
// session cookie is always attached and the protected backend URL is never the
// browser's destination.
export function downloadDriveFile(nodeId) {
  return downloadFromApi(
    "/drive/files/" + encodeURIComponent(nodeId) + "/download"
  );
}

// ------------------------------------------------------------------
// Secure sharing. Tokens are cryptographically random and unrelated to the
// Drive id; permissions are enforced server-side on every public request.
// ------------------------------------------------------------------
export function listDriveShares(nodeId) {
  return axiosClient
    .get("/drive/files/" + encodeURIComponent(nodeId) + "/share")
    .then(function (res) {
      return res.data.data;
    });
}

export function createDriveShare(nodeId, payload) {
  return axiosClient
    .post("/drive/files/" + encodeURIComponent(nodeId) + "/share", payload)
    .then(function (res) {
      return res.data.data;
    });
}

export function updateDriveShare(nodeId, shareId, payload) {
  return axiosClient
    .patch(
      "/drive/files/" + encodeURIComponent(nodeId) + "/share/" + shareId,
      payload
    )
    .then(function (res) {
      return res.data.data;
    });
}

export function revokeDriveShare(nodeId, shareId) {
  return axiosClient
    .delete("/drive/files/" + encodeURIComponent(nodeId) + "/share/" + shareId)
    .then(function (res) {
      return res.data.data;
    });
}

export function getDriveSharePreviewUrl(token) {
  return API_URL + "/drive/shares/" + encodeURIComponent(token) + "/preview";
}

export function fetchDriveShare(token) {
  return axiosClient
    .get("/drive/shares/" + encodeURIComponent(token))
    .then(function (res) {
      return res.data.data;
    });
}

export function downloadSharedDriveFile(token) {
  return downloadFromApi("/drive/shares/" + encodeURIComponent(token) + "/download");
}

export function checkDriveFileSaved(nodeId) {
  return axiosClient
    .get("/saved/drive/" + encodeURIComponent(nodeId) + "/status")
    .then(function (res) {
      return res.data.data;
    });
}

export function saveDriveFile(nodeId) {
  return axiosClient
    .post("/saved/drive/" + encodeURIComponent(nodeId))
    .then(function (res) {
      return res.data.data;
    });
}

export function unsaveDriveFile(nodeId) {
  return axiosClient
    .delete("/saved/drive/" + encodeURIComponent(nodeId))
    .then(function (res) {
      return res.data.data;
    });
}
