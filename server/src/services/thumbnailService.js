const driveThumbnailModel = require("../models/driveThumbnailModel");
const driveService = require("./driveService");
const logger = require("../utils/logger");

const PLACEHOLDER_SVG = Buffer.from(
  '<svg xmlns="http://www.w3.org/2000/svg" width="320" height="420" viewBox="0 0 320 420">' +
    '<rect width="320" height="420" fill="#F8FAFC"/>' +
    '<rect x="36" y="40" width="248" height="340" rx="8" fill="#FFFFFF" stroke="#E2E8F0"/>' +
    '<rect x="60" y="72" width="200" height="12" rx="6" fill="#CBD5E1"/>' +
    '<rect x="60" y="100" width="160" height="12" rx="6" fill="#E2E8F0"/>' +
    '<rect x="60" y="128" width="180" height="12" rx="6" fill="#E2E8F0"/>' +
    '<text x="160" y="250" text-anchor="middle" font-family="Inter, Arial, sans-serif" font-size="14" fill="#004AC6">PDF</text>' +
    "</svg>"
);

function cacheFresh(row, node) {
  if (!row) return false;
  if (!node || !node.modified_time || !row.source_modified_time) return true;
  return String(row.source_modified_time) === String(node.modified_time);
}

async function getThumbnail(node) {
  try {
    const cached = await driveThumbnailModel.findByDriveId(node.drive_id);
    if (cacheFresh(cached, node)) {
      return {
        mimeType: cached.mime_type,
        bytes: cached.bytes,
      };
    }
  } catch (err) {
    logger.error("Thumbnail cache read failed for " + node.drive_id, err);
  }

  if (typeof driveService.getThumbnail === "function") {
    try {
      const fetched = await driveService.getThumbnail(node.drive_id);
      if (fetched && fetched.buffer) {
        try {
          await driveThumbnailModel.upsert({
            drive_id: node.drive_id,
            mime_type: fetched.mimeType || "image/png",
            bytes: fetched.buffer,
            source_modified_time: node.modified_time || null,
          });
        } catch (err) {
          logger.error("Thumbnail cache write failed", err);
        }
        return {
          mimeType: fetched.mimeType || "image/png",
          bytes: fetched.buffer,
        };
      }
    } catch (err) {
      logger.error("Drive thumbnail fetch failed for " + node.drive_id, err);
    }
  }

  return {
    mimeType: "image/svg+xml",
    bytes: PLACEHOLDER_SVG,
  };
}

module.exports = {
  getThumbnail,
  PLACEHOLDER_SVG,
};
