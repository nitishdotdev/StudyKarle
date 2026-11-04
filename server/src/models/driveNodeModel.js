/**
 * Accessors for the `drive_nodes` mirror — the canonical representation of the
 * linked Google Drive folder tree. StudyKarle's folder/file UI reads all of its
 * hierarchy from this table, never from the legacy years/semesters/subjects/
 * units/notes tables.
 */

const db = require("../config/db");

const TABLE = "drive_nodes";

module.exports = {
  async findById(nodeId) {
    return db(TABLE).where({ drive_id: nodeId }).first();
  },

  async findFolderById(nodeId) {
    return db(TABLE).where({ drive_id: nodeId, kind: "folder" }).first();
  },

  async findFileById(nodeId) {
    return db(TABLE).where({ drive_id: nodeId, kind: "file" }).first();
  },

  // Direct children of a Drive folder, in the order Drive returned them
  // (folders and files interleaved by name, as Google Drive displays them).
  async findChildren(parentDriveId) {
    return db(TABLE)
      .where({ parent_drive_id: parentDriveId })
      .orderBy("position", "asc")
      .orderBy("name", "asc");
  },

  // Folders from the root down to (but excluding) the given node. Used to
  // rebuild breadcrumbs on deep links / refreshes without parsing the URL.
  async findAncestors(nodeId) {
    const ancestors = [];
    const seen = new Set();
    let current = await this.findById(nodeId);

    while (
      current &&
      current.parent_drive_id &&
      !seen.has(current.parent_drive_id)
    ) {
      seen.add(current.parent_drive_id);
      const parent = await this.findById(current.parent_drive_id);
      if (!parent) break;
      ancestors.unshift({ nodeId: parent.drive_id, name: parent.name });
      current = parent;
    }

    return ancestors;
  },

  async countAll() {
    const result = await db(TABLE).count("id as count").first();
    return Number(result.count);
  },

  async countByKind(kind) {
    const result = await db(TABLE).where({ kind: kind }).count("id as count").first();
    return Number(result.count);
  },

  async search(query, params) {
    const like = "%" + String(query || "").replace(/[%_]/g, " ") + "%";
    const builder = db(TABLE)
      .select(
        "drive_id",
        "parent_drive_id",
        "name",
        "mime_type",
        "kind",
        "depth",
        "path",
        "size_bytes",
        "created_time",
        "modified_time"
      )
      .where(function () {
        this.whereILike("name", like).orWhereILike("path", like);
      });

    if (params && params.kind) {
      builder.andWhere("kind", params.kind);
    }
    builder.orderBy("name", "asc");
    if (params && params.limit) {
      builder.limit(params.limit);
    }
    return builder;
  },
};
