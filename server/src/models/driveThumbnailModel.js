const db = require("../config/db");

const TABLE = "drive_thumbnails";

module.exports = {
  async findByDriveId(driveId) {
    return db(TABLE).where({ drive_id: driveId }).first();
  },

  async upsert(data) {
    const existing = await this.findByDriveId(data.drive_id);
    if (existing) {
      const rows = await db(TABLE)
        .where({ drive_id: data.drive_id })
        .update({
          mime_type: data.mime_type,
          bytes: data.bytes,
          source_modified_time: data.source_modified_time || null,
          generated_at: new Date(),
        })
        .returning("*");
      return rows[0];
    }
    const rows = await db(TABLE)
      .insert({
        drive_id: data.drive_id,
        mime_type: data.mime_type,
        bytes: data.bytes,
        source_modified_time: data.source_modified_time || null,
      })
      .returning("*");
    return rows[0];
  },
};
