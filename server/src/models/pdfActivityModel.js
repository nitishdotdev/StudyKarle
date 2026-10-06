const db = require("../config/db");

const TABLE = "pdf_activity";

const ACTIVITY_TYPES = ["pdf_opened", "pdf_downloaded", "pdf_shared"];
const RESOURCE_TYPES = ["drive", "note"];

const DEFAULT_OPEN_DEDUP_WINDOW_MINUTES = 60;

module.exports = {
  ACTIVITY_TYPES: ACTIVITY_TYPES.slice(),
  RESOURCE_TYPES: RESOURCE_TYPES.slice(),
  DEFAULT_OPEN_DEDUP_WINDOW_MINUTES,

  /**
   * Insert one activity row. Returns true when a row was inserted and false
   * when it was skipped (invalid input, missing user/pdf, or — for
   * `pdf_opened` — an open already recorded inside the dedup window).
   *
   * `pdf_opened` runs inside a transaction guarded by a per-user+PDF advisory
   * lock so the dedup check and the insert are atomic. React re-renders,
   * component remounts, viewer state changes, and the multiple Range requests
   * pdf.js issues for one page all collapse into a single open event, while a
   * genuine re-open after the window still records a new event.
   */
  async record(data) {
    const activityType = String(data.activityType || "").toLowerCase();
    const resourceType = String(data.resourceType || "").toLowerCase();
    if (ACTIVITY_TYPES.indexOf(activityType) === -1) return false;
    if (RESOURCE_TYPES.indexOf(resourceType) === -1) return false;
    if (!data.userId || !data.pdfId) return false;

    const pdfId = String(data.pdfId);
    const pdfName = String(data.pdfName || "").slice(0, 255);

    if (activityType === "pdf_opened") {
      // `|| DEFAULT` would swallow an explicit 0 (falsy) window, so check for
      // undefined/null explicitly. A 0 window means "always record" and is
      // used to simulate a genuine re-open after the window.
      const rawWindow = data.dedupWindowMinutes;
      const windowMinutes =
        rawWindow === undefined || rawWindow === null
          ? DEFAULT_OPEN_DEDUP_WINDOW_MINUTES
          : Number(rawWindow);
      const cutoff = new Date(Date.now() - windowMinutes * 60 * 1000);
      const lockKey = advisoryLockKey(data.userId, resourceType, pdfId);

      return db.transaction(async function (trx) {
        await trx.raw("select pg_advisory_xact_lock(?)", [lockKey]);

        const recent = await trx(TABLE)
          .where({
            user_id: data.userId,
            resource_type: resourceType,
            pdf_id: pdfId,
            activity_type: "pdf_opened",
          })
          .andWhere("created_at", ">", cutoff)
          .first("id");
        if (recent) return false;

        const inserted = await trx(TABLE)
          .insert({
            user_id: data.userId,
            activity_type: activityType,
            resource_type: resourceType,
            pdf_id: pdfId,
            pdf_name: pdfName,
          })
          .returning("id");
        return Array.isArray(inserted) && inserted.length > 0;
      });
    }

    const inserted = await db(TABLE)
      .insert({
        user_id: data.userId,
        activity_type: activityType,
        resource_type: resourceType,
        pdf_id: pdfId,
        pdf_name: pdfName,
      })
      .returning("id");
    return Array.isArray(inserted) && inserted.length > 0;
  },

  /**
   * Newest-first activity for the admin dashboard, joined with the acting
   * user's name. Users are LEFT JOINed so deleted users render as "Unknown
   * user" instead of dropping the row. PDF existence is resolved with two
   * bulk lookups (one per resource type) — never N+1 — so the frontend can
   * render a live preview link only when the resource still exists and
   * otherwise fall back to the historical `pdf_name` snapshot.
   */
  async recent(limit) {
    const query = db(TABLE)
      .leftJoin("users", "users.id", "pdf_activity.user_id")
      .select(
        "pdf_activity.id",
        "pdf_activity.user_id",
        "pdf_activity.activity_type",
        "pdf_activity.resource_type",
        "pdf_activity.pdf_id",
        "pdf_activity.pdf_name",
        "pdf_activity.created_at",
        "users.name as user_name"
      )
      .orderBy("pdf_activity.created_at", "desc");

    const parsed = Number(limit);
    if (Number.isFinite(parsed) && parsed > 0) {
      query.limit(parsed);
    }

    const rows = await query;

    if (!rows.length) return [];

    const driveIds = [];
    const noteIds = [];
    rows.forEach(function (row) {
      if (row.resource_type === "drive") driveIds.push(row.pdf_id);
      else noteIds.push(Number(row.pdf_id));
    });

    const existingDrive = new Set();
    if (driveIds.length) {
      const found = await db("drive_nodes")
        .whereIn("drive_id", driveIds)
        .select("drive_id");
      found.forEach(function (r) {
        existingDrive.add(r.drive_id);
      });
    }

    const existingNote = new Set();
    if (noteIds.length) {
      const found = await db("notes").whereIn("id", noteIds).select("id");
      found.forEach(function (r) {
        existingNote.add(String(r.id));
      });
    }

    return rows.map(function (row) {
      const pdfExists =
        row.resource_type === "drive"
          ? existingDrive.has(row.pdf_id)
          : existingNote.has(row.pdf_id);
      return {
        id: row.id,
        userId: row.user_id,
        userName: row.user_name || null,
        activityType: row.activity_type,
        resourceType: row.resource_type,
        pdfId: row.pdf_id,
        pdfName: row.pdf_name,
        pdfExists: pdfExists,
        createdAt: row.created_at,
      };
    });
  },

  // Deletes every row in the PDF-activity table. Returns the number of rows
  // removed. Scoped to this table only — security/audit logs (admin_activity,
  // view_history, drive_shares) are never touched.
  async clear() {
    return db(TABLE).del();
  },
};

// Deterministic positive bigint used as a pg advisory-lock key for the open
// dedup. Keys are per (user, resource type, pdf) so unrelated opens never
// contend, while concurrent opens of the SAME pdf by the SAME user serialize.
function advisoryLockKey(userId, resourceType, pdfId) {
  const input = String(userId) + ":" + resourceType + ":" + pdfId;
  // FNV-1a 64-bit, then cleared to stay inside PostgreSQL's signed bigint.
  let hash = 0xcbf29ce484222325n;
  const prime = 0x100000001b3n;
  for (let i = 0; i < input.length; i++) {
    hash ^= BigInt(input.charCodeAt(i));
    hash = BigInt.asUintN(64, hash * prime);
  }
  const signed = BigInt.asIntN(64, hash);
  return signed < 0n ? -signed : signed;
}
