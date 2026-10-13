/**
 * Google Drive sync service.
 *
 * The linked Google Drive folder is the single source of truth for StudyKarle
 * content. This service mirrors the Drive folder tree (metadata only) into the
 * `drive_nodes` table, which is the canonical representation of the synced
 * content:
 *
 *   Google Drive
 *       ↓
 *   Drive Sync
 *       ↓
 *   Canonical Drive Node Tree  (drive_nodes)
 *       ↓
 *   StudyKarle APIs             (/api/drive*)
 *       ↓
 *   StudyKarle Folder/File UI
 *       ↓
 *   PDF/File Viewer
 *
 * The mirror preserves the exact parent/child hierarchy at ANY depth, keeps
 * duplicate folder names distinct (they are identified by their Drive id), and
 * records mixed folders + files exactly where they live in Drive.
 *
 * The legacy `years` / `semesters` / `subjects` / `units` / `notes` tables are
 * intentionally NOT written by the sync. They remain for legacy and
 * manually-managed StudyKarle content and never control, constrain, flatten,
 * or distort the Drive hierarchy. This also removes the historical
 * `units_subject_id_name_key` collision, because Drive folders are no longer
 * forced into the legacy Unit model.
 *
 * Idempotency: every write is keyed on the stable Drive id (unique constraint
 * + ON CONFLICT upsert), so running sync repeatedly never duplicates nodes.
 *
 * Deletions/moves: nodes that were mirrored before but are absent from a full,
 * error-free walk are removed, reflecting Drive deletions. Renames/moves are
 * captured because the upsert compares name + parent on the same Drive id.
 *
 * Concurrency: the run is protected by a PostgreSQL advisory lock so scheduler
 * + admin-triggered runs never overlap.
 */

const db = require("../config/db");
const env = require("../config/env");
const driveService = require("./driveService");
const logger = require("../utils/logger");
const {
  formatGoogleOAuthError,
} = require("../utils/googleOAuthError");

// Arbitrary fixed key identifying the StudyKarle sync lock.
const SYNC_LOCK_KEY = 0x53594e43544f4c; // "SYNCTOL"

async function getState() {
  const row = await db("drive_sync_state").where({ id: 1 }).first();
  if (row) return row;
  await db("drive_sync_state").insert({ id: 1, status: "idle" });
  return db("drive_sync_state").where({ id: 1 }).first();
}

async function setState(patch) {
  await db("drive_sync_state")
    .where({ id: 1 })
    .update(Object.assign({ updated_at: db.fn.now() }, patch));
}

function isConfigured() {
  return Boolean(
    env.google.driveFolderId &&
      env.google.refreshToken &&
      env.google.clientId &&
      env.google.clientSecret
  );
}

function timeEqual(a, b) {
  const ta = a ? new Date(a).getTime() : null;
  const tb = b ? new Date(b).getTime() : null;
  return ta === tb;
}

function nodeUnchanged(existing, node, position) {
  return (
    existing &&
    existing.name === node.name &&
    (existing.parent_drive_id || null) === (node.parentDriveId || null) &&
    existing.mime_type === node.mimeType &&
    existing.kind === node.kind &&
    existing.depth === node.depth &&
    existing.path === node.path &&
    existing.position === position &&
    String(existing.size_bytes || "") === String(node.sizeBytes || "") &&
    timeEqual(existing.created_time, node.createdTime) &&
    timeEqual(existing.modified_time, node.modifiedTime)
  );
}

// Acquire the advisory lock on a dedicated connection. Returns a release
// function (or null when another sync already holds the lock).
async function acquireLock() {
  const conn = await db.client.acquireConnection();
  try {
    const res = await conn.query(
      "SELECT pg_try_advisory_lock($1) AS locked",
      [SYNC_LOCK_KEY]
    );
    if (res.rows[0].locked) {
      return async function release() {
        try {
          await conn.query("SELECT pg_advisory_unlock($1)", [SYNC_LOCK_KEY]);
        } catch (err) {
          logger.error("Failed to release Drive sync lock", err);
        } finally {
          db.client.releaseConnection(conn);
        }
      };
    }
    db.client.releaseConnection(conn);
    return null;
  } catch (err) {
    db.client.releaseConnection(conn);
    throw err;
  }
}

// ---------------------------------------------------------------------------
// Mirror: drive tree -> drive_nodes (the canonical representation)
// ---------------------------------------------------------------------------

// Nodes arrive breadth-first (parents always precede their children) and each
// parent's children are consecutive, so the position counter below reproduces
// Drive's per-folder ordering (folders and files interleaved by name).
async function mirrorTree(nodes) {
  const existing = await db("drive_nodes").select("*");
  const byDrive = {};
  existing.forEach(function (n) {
    byDrive[n.drive_id] = n;
  });

  const seen = new Set();
  const parentCounters = {};
  let changed = 0;

  for (let i = 0; i < nodes.length; i++) {
    const node = nodes[i];
    seen.add(node.driveId);

    const parentKey = node.parentDriveId || "root";
    if (!(parentKey in parentCounters)) parentCounters[parentKey] = 0;
    const position = parentCounters[parentKey]++;

    if (nodeUnchanged(byDrive[node.driveId], node, position)) {
      continue;
    }

    changed++;
    await db("drive_nodes")
      .insert({
        drive_id: node.driveId,
        parent_drive_id: node.parentDriveId || null,
        name: node.name,
        mime_type: node.mimeType,
        kind: node.kind,
        depth: node.depth,
        path: node.path,
        position: position,
        size_bytes: node.sizeBytes,
        created_time: node.createdTime,
        modified_time: node.modifiedTime,
        last_synced_at: db.fn.now(),
      })
      .onConflict("drive_id")
      .merge({
        parent_drive_id: node.parentDriveId || null,
        name: node.name,
        mime_type: node.mimeType,
        kind: node.kind,
        depth: node.depth,
        path: node.path,
        position: position,
        size_bytes: node.sizeBytes,
        created_time: node.createdTime,
        modified_time: node.modifiedTime,
        last_synced_at: db.fn.now(),
      });
  }

  // A node that was mirrored before but is absent now was deleted (or moved
  // outside the synced tree) in Drive. Only prune after a full, error-free
  // walk so a partial read can never wipe valid rows.
  const stale = existing
    .filter(function (n) {
      return !seen.has(n.drive_id);
    })
    .map(function (n) {
      return n.drive_id;
    });
  if (stale.length) {
    await db("drive_nodes").whereIn("drive_id", stale).del();
  }

  logger.info("[drive-sync] mirror updated: " + changed + " changed nodes");
  return { changed: changed, staleDriveIds: stale };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

async function runSync() {
  if (!isConfigured()) {
    logger.warn(
      "[drive-sync] Google Drive is not configured; skipping sync"
    );
    return { status: "unconfigured" };
  }

  const release = await acquireLock();
  if (!release) {
    logger.warn("[drive-sync] another sync is already running; skipping");
    return { status: "already-running" };
  }

  try {
    await setState({
      status: "syncing",
      last_attempt_at: db.fn.now(),
      last_error: null,
    });

    const rootFolderId = env.google.driveFolderId;

    // Root display name (best effort — the walk must not be blocked by it).
    let rootName = "Drive";
    try {
      const rootMeta = await driveService.getFileMetadata(rootFolderId);
      if (rootMeta && rootMeta.name) rootName = rootMeta.name;
    } catch (err) {
      logger.warn(
        "[drive-sync] could not fetch root folder name: " + err.message
      );
      // Same sanitized provider diagnostic as the main failure path: the root
      // metadata call can fail with an OAuth refresh error too (invalid_client
      // / invalid_grant). Only provider status/code/description are surfaced;
      // credentials are redacted and the raw response is never logged.
      logger.warn(
        "[drive-sync] provider (root folder): " +
          formatGoogleOAuthError(err, [
            env.google.clientSecret,
            env.google.refreshToken,
          ])
      );
    }

    const nodes = await driveService.walkTree(rootFolderId);

    await mirrorTree(nodes);

    const folders = nodes.filter(function (n) {
      return n.kind === "folder";
    }).length;
    const files = nodes.filter(function (n) {
      return n.kind === "file";
    }).length;

    await setState({
      status: "idle",
      last_synced_at: db.fn.now(),
      root_name: rootName,
      folders_count: folders,
      files_count: files,
    });

    logger.info(
      "[drive-sync] complete: " + folders + " folders, " + files + " files"
    );
    return { status: "success", counts: { folders: folders, files: files } };
  } catch (err) {
    logger.error("[drive-sync] failed", err);
    // Google reports the useful cause (invalid_client / invalid_grant /
    // deleted_client ...) only on the token response body, which the default
    // error message discards. Surface it sanitized so credentials are never
    // logged. See src/utils/googleOAuthError.js.
    logger.error(
      "[drive-sync] provider: " +
        formatGoogleOAuthError(err, [
          env.google.clientSecret,
          env.google.refreshToken,
        ])
    );
    await setState({
      status: "error",
      last_attempt_at: db.fn.now(),
      last_error: err.message,
    });
    return { status: "error", error: err.message };
  } finally {
    await release();
  }
}

function startScheduledSync(options) {
  const intervalMs = options && options.intervalMs ? options.intervalMs : 0;
  const initialDelayMs =
    options && options.initialDelayMs !== undefined
      ? options.initialDelayMs
      : 5000;

  if (!isConfigured()) {
    logger.warn(
      "[drive-sync] scheduler disabled: Google Drive not configured"
    );
    return null;
  }

  const run = function () {
    runSync().catch(function (err) {
      logger.error("[drive-sync] scheduled run crashed", err);
    });
  };

  const timer = setTimeout(run, initialDelayMs);
  let interval = null;
  if (intervalMs > 0) {
    interval = setInterval(run, intervalMs);
  }

  logger.info(
    "[drive-sync] scheduler started (initial delay " +
      initialDelayMs +
      "ms, interval " +
      (intervalMs || "off") +
      ")"
  );

  return {
    stop: function () {
      clearTimeout(timer);
      if (interval) clearInterval(interval);
    },
  };
}

async function getSyncStatus() {
  const state = await getState();
  return Object.assign({}, state, {
    configured: isConfigured(),
    rootFolderId: env.google.driveFolderId || null,
  });
}

module.exports = {
  runSync,
  startScheduledSync,
  getSyncStatus,
};
