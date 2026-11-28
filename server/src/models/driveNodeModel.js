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

  async findFilesByIds(ids) {
    const list = (ids || []).filter(Boolean);
    if (!list.length) return [];
    return db(TABLE).whereIn("drive_id", list).andWhere({ kind: "file" });
  },

  async findRecommendedPdfFiles(preferredYear) {
    const yearPattern =
      "(^|/)(year[[:space:]_-]*1|1st[[:space:]_-]*year|first[[:space:]_-]*year|y1|year[[:space:]_-]*2|2nd[[:space:]_-]*year|second[[:space:]_-]*year|y2)(/|$)";
    const preferredPattern =
      Number(preferredYear) === 1
        ? "(^|/)(year[[:space:]_-]*1|1st[[:space:]_-]*year|first[[:space:]_-]*year|y1)(/|$)"
        : Number(preferredYear) === 2
          ? "(^|/)(year[[:space:]_-]*2|2nd[[:space:]_-]*year|second[[:space:]_-]*year|y2)(/|$)"
          : null;

    const query = db(TABLE)
      .select(
        "drive_id",
        "name",
        "mime_type",
        "kind",
        "path",
        "created_time",
        "modified_time"
      )
      .where("kind", "file")
      .andWhere(function () {
        this.whereILike("mime_type", "%pdf%").orWhereILike("name", "%.pdf");
      })
      .andWhereRaw("path ~* ?", [yearPattern]);

    if (preferredPattern) {
      query.orderByRaw("CASE WHEN path ~* ? THEN 0 ELSE 1 END", [preferredPattern]);
    }
    return query
      .orderByRaw("modified_time DESC NULLS LAST")
      .orderByRaw("created_time DESC NULLS LAST")
      .orderBy("drive_id", "asc")
      .limit(12);
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

  async findAncestorsForNodes(nodes) {
    const parents = new Map();
    let frontier = new Set(nodes.map((node) => node.parentDriveId).filter(Boolean));
    while (frontier.size) {
      const ids = [...frontier];
      for (const id of ids) parents.set(id, null);
      const rows = await db(TABLE).whereIn("drive_id", ids)
        .select("drive_id", "parent_drive_id", "name");
      for (const row of rows) parents.set(row.drive_id, row);
      frontier = new Set(rows.map((row) => row.parent_drive_id)
        .filter((id) => id && !parents.has(id)));
    }

    return new Map(nodes.map(function (node) {
      const ancestors = [];
      const seen = new Set([node.nodeId]);
      let parent = parents.get(node.parentDriveId);
      while (parent && !seen.has(parent.drive_id)) {
        seen.add(parent.drive_id);
        ancestors.unshift({ nodeId: parent.drive_id, name: parent.name });
        parent = parents.get(parent.parent_drive_id);
      }
      return [node.nodeId, ancestors];
    }));
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
    builder.orderBy("name", "asc").orderBy("drive_id", "asc");
    if (params && params.limit) {
      builder.limit(params.limit).offset(params.offset || 0);
    }
    return builder;
  },
};
