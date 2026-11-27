const db = require("../config/db");

const TABLE = "course_analytics_events";

module.exports = {
  async record(entry, trx) {
    const conn = trx || db;
    const rows = await conn(TABLE).insert(entry).returning("*");
    return rows[0] || null;
  },

  async summarizeByCourse(sinceDate) {
    const query = db(TABLE)
      .select("course_slug", "event_type")
      .count("* as total")
      .groupBy("course_slug", "event_type");

    if (sinceDate) {
      query.where("created_at", ">=", sinceDate);
    }

    return query;
  },
};
