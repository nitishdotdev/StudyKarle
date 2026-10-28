// Login events reuse pdf_activity (Admin → Overview → Recent Activity).
// PDF rows still populate resource_type / pdf_id / pdf_name; user_login rows
// leave those columns null because they are not tied to a file.

exports.up = async function (knex) {
  const hasTable = await knex.schema.hasTable("pdf_activity");
  if (!hasTable) return;

  await knex.raw(
    "ALTER TABLE pdf_activity ALTER COLUMN resource_type DROP NOT NULL"
  );
  await knex.raw("ALTER TABLE pdf_activity ALTER COLUMN pdf_id DROP NOT NULL");
  await knex.raw(
    "ALTER TABLE pdf_activity ALTER COLUMN pdf_name DROP NOT NULL"
  );
};

exports.down = async function (knex) {
  const hasTable = await knex.schema.hasTable("pdf_activity");
  if (!hasTable) return;

  await knex("pdf_activity")
    .where({ activity_type: "user_login" })
    .update({
      resource_type: "drive",
      pdf_id: "login",
      pdf_name: "login",
    });

  await knex.raw(
    "ALTER TABLE pdf_activity ALTER COLUMN resource_type SET NOT NULL"
  );
  await knex.raw("ALTER TABLE pdf_activity ALTER COLUMN pdf_id SET NOT NULL");
  await knex.raw("ALTER TABLE pdf_activity ALTER COLUMN pdf_name SET NOT NULL");
};
