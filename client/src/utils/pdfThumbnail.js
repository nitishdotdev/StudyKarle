import { getDrivePreviewUrl } from "../api/driveApi";
import { getPreviewUrl } from "../api/notesApi";

export function isPdfResource(item) {
  if (!item) return false;
  return (
    item.fileType === "pdf" ||
    String(item.mimeType || "").toLowerCase().indexOf("pdf") !== -1
  );
}

export function canFetchPdfThumbnail(item) {
  return isPdfResource(item) && item.canPreview !== false;
}

export function pdfThumbnailUrl(item) {
  if (!canFetchPdfThumbnail(item)) return null;
  return item.resourceType === "drive"
    ? getDrivePreviewUrl(item.resourceId)
    : getPreviewUrl(item.resourceId);
}
