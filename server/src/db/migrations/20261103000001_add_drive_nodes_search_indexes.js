exports.up = async function (knex) {
  await knex.raw(
    'CREATE INDEX IF NOT EXISTS "drive_nodes_name_idx" ON "drive_nodes" ("name")'
  );
  await knex.raw(
    'CREATE INDEX IF NOT EXISTS "drive_nodes_path_idx" ON "drive_nodes" ("path")'
  );
  await knex.raw(
    'CREATE INDEX IF NOT EXISTS "drive_nodes_kind_name_idx" ON "drive_nodes" ("kind", "name")'
  );
};

exports.down = async function (knex) {
  await knex.raw('DROP INDEX IF EXISTS "drive_nodes_kind_name_idx"');
  await knex.raw('DROP INDEX IF EXISTS "drive_nodes_path_idx"');
  await knex.raw('DROP INDEX IF EXISTS "drive_nodes_name_idx"');
};
