exports.up = async function (knex) {
  const hasEvents = await knex.schema.hasTable("course_analytics_events");
  if (!hasEvents) {
    await knex.schema.createTable("course_analytics_events", function (table) {
      table.bigIncrements("id").primary();
      table.string("event_type", 40).notNullable();
      table.string("course_slug", 160).notNullable();
      table
        .integer("user_id")
        .unsigned()
        .nullable()
        .references("id")
        .inTable("users")
        .onDelete("SET NULL");
      table.string("visitor_hash", 64).nullable();
      table.string("referrer_host", 255).nullable();
      table.timestamp("created_at", { useTz: true }).notNullable().defaultTo(knex.fn.now());

      table.index(["course_slug", "event_type"], "idx_course_analytics_slug_type");
      table.index(["event_type", "created_at"], "idx_course_analytics_type_created");
      table.index(["user_id"], "idx_course_analytics_user");
    });
  }

  const hasPaymentRequests = await knex.schema.hasTable("payment_requests");
  if (hasPaymentRequests) {
    const hasSourceSlug = await knex.schema.hasColumn(
      "payment_requests",
      "source_course_slug"
    );
    if (!hasSourceSlug) {
      await knex.schema.alterTable("payment_requests", function (table) {
        table.string("source_course_slug", 160).nullable();
        table.index(["source_course_slug"], "idx_payment_requests_source_course_slug");
      });
    }
  }
};

exports.down = async function (knex) {
  const hasPaymentRequests = await knex.schema.hasTable("payment_requests");
  if (hasPaymentRequests) {
    const hasSourceSlug = await knex.schema.hasColumn(
      "payment_requests",
      "source_course_slug"
    );
    if (hasSourceSlug) {
      await knex.schema.alterTable("payment_requests", function (table) {
        table.dropIndex(["source_course_slug"], "idx_payment_requests_source_course_slug");
        table.dropColumn("source_course_slug");
      });
    }
  }

  await knex.schema.dropTableIfExists("course_analytics_events");
};
