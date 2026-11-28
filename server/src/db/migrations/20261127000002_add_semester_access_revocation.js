exports.up = async function (knex) {
  await knex.schema.alterTable("semester_access", function (table) {
    table.timestamp("revoked_at").nullable();
    table.integer("revoked_by").nullable().references("id").inTable("users").onDelete("SET NULL");
  });
};

exports.down = async function (knex) {
  await knex.schema.alterTable("semester_access", function (table) {
    table.dropColumn("revoked_by");
    table.dropColumn("revoked_at");
  });
};
