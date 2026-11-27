exports.up = async function (knex) {
  await knex.schema.createTable("course_publications", function (table) {
    table.integer("folder_id").primary().references("id").inTable("drive_nodes").onDelete("CASCADE");
    table.string("slug", 160).notNullable().unique();
    table.string("title", 255).notNullable();
    table.boolean("published").notNullable().defaultTo(false);
    table.timestamp("approved_at").notNullable().defaultTo(knex.fn.now());
  });

  await knex.schema.createTable("course_publication_items", function (table) {
    table.integer("folder_id").notNullable().references("folder_id").inTable("course_publications").onDelete("CASCADE");
    table.integer("file_id").notNullable().references("id").inTable("drive_nodes").onDelete("CASCADE");
    table.uuid("item_key").notNullable().unique();
    table.string("title", 255).notNullable();
    table.text("unit_label");
    table.string("category", 20).notNullable();
    table.string("file_type", 10).notNullable();
    table.primary(["folder_id", "file_id"]);
    table.index("file_id");
  });
};

exports.down = async function (knex) {
  await knex.schema.dropTable("course_publication_items");
  await knex.schema.dropTable("course_publications");
};
