/**
 * HTTP handlers for the canonical Google Drive tree.
 *
 * The UI browses folders and opens PDFs exclusively through these endpoints,
 * keyed on the stable Drive file id. Node existence/type is validated against
 * the `drive_nodes` mirror so invalid routes return a controlled 404 instead
 * of an internal validation failure.
 *
 * Every protected handler follows the same sequence:
 *   authenticate -> find resource -> authorize -> return/stream.
 * Authentication is enforced by the `authenticate` middleware on the router;
 * the explicit authorize helpers below keep the server-side authorization
 * step visible and testable so the security boundary never lives only in the
 * frontend.
 */

const driveNodeService = require("../services/driveNodeService");
const driveNodeModel = require("../models/driveNodeModel");
const driveShareModel = require("../models/driveShareModel");
const driveShareService = require("../services/driveShareService");
const driveService = require("../services/driveService");
const pdfActivityService = require("../services/pdfActivityService");
const materialGate = require("../services/materialGateService");
const thumbnailService = require("../services/thumbnailService");
const asyncHandler = require("../middleware/asyncHandler");
const ApiResponse = require("../utils/ApiResponse");
const ApiError = require("../utils/ApiError");

module.exports = {
  listRoot: asyncHandler(async function (req, res) {
    const data = await driveNodeService.listRoot();
    await decorateListing(req.user, data);
    return ApiResponse.ok(res, data);
  }),

  listFolder: asyncHandler(async function (req, res) {
    const data = await driveNodeService.listFolder(req.params.nodeId);
    await decorateListing(req.user, data);
    return ApiResponse.ok(res, data);
  }),

  getFile: asyncHandler(async function (req, res) {
    const node = await requireLibraryFile(req);
    const data = await driveNodeService.getFile(req.params.nodeId);
    const decision = await materialGate.authorizeDriveNode(req.user, node);
    data.access = toAccessView(decision);
    if (data.node) {
      data.node.protected = decision.protected;
      data.node.canPreview = decision.canPreview;
      data.node.canDownload = decision.canDownload;
    }
    return ApiResponse.ok(res, data);
  }),

  thumbnail: asyncHandler(async function (req, res) {
    const node = await requireLibraryFile(req);
    const thumb = await thumbnailService.getThumbnail(node);
    res.setHeader("Content-Type", thumb.mimeType);
    res.setHeader("Cache-Control", "private, max-age=3600");
    res.setHeader("Content-Disposition", "inline");
    return res.status(200).end(thumb.bytes);
  }),

  preview: asyncHandler(async function (req, res) {
    const node = await requireLibraryFile(req);
    await materialGate.assertDrivePreview(req.user, node);
    await streamFileNode(node, res, req, "inline");
    // Record AFTER the stream completes (or a cached 304 is served) so the
    // event reflects a real open. The service never rejects, so a logging
    // failure can never break the preview.
    await pdfActivityService.recordOpen(req.user.id, "drive", node.drive_id, node.name);
  }),

  download: asyncHandler(async function (req, res) {
    const node = await requireLibraryFile(req);
    await materialGate.assertDriveDownload(req.user, node);
    await streamFileNode(node, res, req, "attachment");
    // Only record once the download stream succeeded. If the Drive stream
    // throws, the error handler responds 500 and no download event is written.
    await pdfActivityService.recordDownload(req.user.id, "drive", node.drive_id, node.name);
  }),

  // ----------------------------------------------------------------
  // Share management (authenticated + owner/admin authorized)
  // ----------------------------------------------------------------
  listShares: asyncHandler(async function (req, res) {
    await requireLibraryFile(req);
    const isAdmin = req.user.role === "admin";
    const shares = await driveShareModel.findManageableByDriveId(
      req.params.nodeId,
      req.user.id,
      isAdmin
    );
    return ApiResponse.ok(res, {
      shares: shares.map(toShareView),
    });
  }),

  createShare: asyncHandler(async function (req, res) {
    const node = await requireLibraryFile(req);
    if (await materialGate.classifyDriveNode(node)) {
      materialGate.denyProtectedShare();
    }

    const permission = req.body && req.body.permission;
    if (permission !== undefined && ["preview", "download"].indexOf(permission) === -1) {
      throw ApiError.badRequest("permission must be 'preview' or 'download'");
    }
    const resolvedPermission = permission || "download";
    if (req.user.role !== "admin" && resolvedPermission === "download") {
      throw ApiError.forbidden("Students cannot create downloadable share links.");
    }

    let expiresInDays = null;
    if (req.body && req.body.expiresInDays !== undefined && req.body.expiresInDays !== null && req.body.expiresInDays !== "") {
      expiresInDays = Number(req.body.expiresInDays);
      if (!Number.isFinite(expiresInDays) || expiresInDays <= 0) {
        throw ApiError.badRequest("expiresInDays must be a positive number");
      }
    }

    const share = await driveShareService.createShare({
      driveId: req.params.nodeId,
      createdBy: req.user.id,
      permission: resolvedPermission,
      expiresInDays: expiresInDays,
    });

    // Only after the share link is actually created — opening the share
    // dialog is not a share.
    await pdfActivityService.recordShare(req.user.id, "drive", node.drive_id, node.name);

    return ApiResponse.created(res, share);
  }),

  updateShare: asyncHandler(async function (req, res) {
    await requireLibraryFile(req);
    const share = await requireManageableShare(req);
    if (!share) {
      throw ApiError.notFound("Share not found");
    }

    const permission = req.body && req.body.permission;
    if (permission !== undefined && ["preview", "download"].indexOf(permission) === -1) {
      throw ApiError.badRequest("permission must be 'preview' or 'download'");
    }
    if (permission === "download" && req.user.role !== "admin") {
      throw ApiError.forbidden("Students cannot create downloadable share links.");
    }

    const patch = {};
    if (permission !== undefined) patch.permission = permission;
    if (req.body && req.body.expiresInDays !== undefined && req.body.expiresInDays !== null && req.body.expiresInDays !== "") {
      const days = Number(req.body.expiresInDays);
      if (!Number.isFinite(days) || days <= 0) {
        throw ApiError.badRequest("expiresInDays must be a positive number");
      }
      patch.expiresAt = new Date(Date.now() + (days > 90 ? 90 : days) * 24 * 60 * 60 * 1000).toISOString();
    }

    const updated =
      Object.keys(patch).length > 0
        ? await driveShareModel.update(share.id, patch)
        : share;

    return ApiResponse.ok(res, toShareView(updated));
  }),

  revokeShare: asyncHandler(async function (req, res) {
    await requireLibraryFile(req);
    const share = await requireManageableShare(req);
    if (!share) {
      throw ApiError.notFound("Share not found");
    }
    await driveShareModel.remove(share.id);
    return ApiResponse.ok(res, { revoked: true, shareId: share.id });
  }),

  // ----------------------------------------------------------------
  // Public share access (token-gated, permission-enforced)
  // ----------------------------------------------------------------
  getSharedFile: asyncHandler(async function (req, res) {
    const share = await driveShareService.resolveActiveToken(req.params.token);
    const node = await findFileOrThrow(share.drive_id);
    await denyProtectedPublicShare(node);
    return ApiResponse.ok(res, {
      node: {
        nodeId: node.drive_id,
        name: node.name,
        mimeType: node.mime_type,
        sizeBytes: node.size_bytes ? Number(node.size_bytes) : null,
        modifiedTime: node.modified_time ? new Date(node.modified_time) : null,
      },
      permission: share.permission,
      expiresAt: share.expires_at,
    });
  }),

  previewShared: asyncHandler(async function (req, res) {
    const share = await driveShareService.resolveActiveToken(req.params.token);
    const node = await findFileOrThrow(share.drive_id);
    await denyProtectedPublicShare(node);
    return streamFileNode(node, res, req, "inline");
  }),

  downloadShared: asyncHandler(async function (req, res) {
    await driveShareService.resolveActiveToken(req.params.token);
    throw ApiError.forbidden("Public share links cannot download files.");
  }),
};

// ------------------------------------------------------------------
// Authorization + resource lookup helpers
// ------------------------------------------------------------------

// StudyKarle's content library is shared by every authenticated member, so any
// authenticated user is authorized to read any library file. This explicit
// check keeps the authorize step on the server (never the frontend) and gives
// per-file restrictions a single place to live if they are added later.
function assertLibraryMember(user) {
  if (!user) {
    throw ApiError.unauthorized("Authentication required");
  }
}

async function requireLibraryFile(req) {
  assertLibraryMember(req.user);
  const node = await findFileOrThrow(req.params.nodeId);
  return node;
}

// The requesting user may manage this share only when they created it, or when
// they are an admin. Changing the file id in the URL can never escalate to
// managing another user's share because the query is scoped by created_by.
async function requireManageableShare(req) {
  const isAdmin = req.user.role === "admin";
  return driveShareModel.findManageableByDriveIdAndId(
    req.params.nodeId,
    req.params.shareId,
    req.user.id,
    isAdmin
  );
}

async function denyProtectedPublicShare(node) {
  if (await materialGate.classifyDriveNode(node)) {
    throw ApiError.notFound("Share link is invalid or has expired");
  }
}

function toAccessView(decision) {
  return {
    protected: !!decision.protected,
    canPreview: !!decision.canPreview,
    canDownload: !!decision.canDownload,
    code: decision.code || null,
  };
}

async function decorateListing(user, data) {
  const items = []
    .concat(data.folders || [])
    .concat(data.files || []);
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    const raw = await driveNodeModel.findById(item.nodeId);
    if (!raw) continue;
    raw.ancestors = data.ancestors || [];
    if (data.node) {
      raw.ancestors = (data.ancestors || []).concat([
        { name: data.node.name, nodeId: data.node.nodeId },
      ]);
    }
    const decision = await materialGate.authorizeDriveNode(user, raw);
    item.protected = decision.protected;
    item.canPreview = decision.canPreview;
    item.canDownload = decision.canDownload;
    item.accessCode = decision.code || null;
  }
  return data;
}

async function findFileOrThrow(nodeId) {
  const node = await driveNodeModel.findFileById(nodeId);
  if (!node) {
    throw ApiError.notFound("File not found");
  }
  return node;
}

function toShareView(share) {
  return {
    shareId: share.id,
    permission: share.permission,
    expiresAt: share.expires_at,
    revokedAt: share.revoked_at,
    createdAt: share.created_at,
    // Token is only returned to the creator/admin (the caller) so the
    // authenticated share-management view can construct the share URL.
    token: share.token,
  };
}

// Version tag = Drive file id + Drive modified time, so a file updated in
// Drive produces a fresh ETag and the browser re-fetches the new bytes
// instead of serving a stale, long-cached copy.
function driveVersion(node) {
  if (node.modified_time) {
    return Date.parse(node.modified_time) || "v";
  }
  return "v";
}

async function streamFileNode(node, res, req, disposition) {
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader(
    "Content-Disposition",
    disposition + '; filename="' + node.name + '"'
  );
  res.setHeader("Cache-Control", "private, max-age=300, must-revalidate");
  res.setHeader("Accept-Ranges", "bytes");
  res.setHeader("ETag", '"' + node.drive_id + ":" + driveVersion(node) + '"');

  if (req.headers["if-none-match"] === res.getHeader("ETag")) {
    return res.status(304).end();
  }

  await driveService.streamFile(node.drive_id, res, req.headers.range);
}
