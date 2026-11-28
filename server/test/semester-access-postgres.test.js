const assert = require("node:assert/strict");
const test = require("node:test");

if (process.env.DATABASE_URL || !/^studykarle_course_test_[a-z0-9_]+$/i.test(process.env.DB_NAME || "")) {
  throw new Error("Run against a dedicated studykarle_course_test_ database");
}

const db = require("../src/config/db");
const access = require("../src/models/semesterAccessModel");
const payments = require("../src/models/paymentRequestModel");
const { getEntitlementState } = require("../src/services/accessEntitlementService");
const { authorizeMaterial } = require("../src/services/materialAccessService");

test("admin revocation and restoration preserve payment data and affect protected material", async () => {
  const prefix = require("node:crypto").randomUUID();
  const email = prefix + "@example.com";
  let student, admin, pass;
  try {
    [student, admin] = await db("users").insert([
      { email, name: "Fixture Student", role: "student" },
      { email: "admin-" + email, name: "Fixture Admin", role: "admin" },
    ]).returning("*");
    const payment = await payments.create({
      user_id: student.id, amount_rupees: 9, payment_reference: "SK-" + prefix.slice(0,8),
      status: "approved", source_course_slug: "fixture-course",
    });
    assert.equal(payment.source_course_slug, "fixture-course");
    pass = await access.upsertForUser(student.id, {
      payment_request_id: payment.id,
      ends_at: new Date(Date.now() + 3600000),
    });
    const filter = { email, page: 1, limit: 25 };
    const active = await access.listForAdmin({...filter, status: "active"});
    assert.equal(active.items[0].email, email);
    assert.equal(active.items[0].paymentReference, payment.payment_reference);
    assert.equal((await payments.list({email, status:"approved"}))[0].id, payment.id);
    assert.equal((await getEntitlementState(student.id)).hasAccess, true);

    await access.setRevoked(pass.id, true, admin.id);
    await access.setRevoked(pass.id, true, admin.id);
    const denied = await getEntitlementState(student.id);
    assert.equal(denied.status, "revoked");
    assert.equal(authorizeMaterial(student, { kind: "file", path: "Year 1/Test.pdf" }, denied).code, "PAYMENT_REVOKED");
    assert.equal((await access.listForAdmin({...filter, status:"revoked"})).items[0].status, "revoked");
    assert.equal((await payments.findById(payment.id)).status, "approved");

    await access.setRevoked(pass.id, false, admin.id);
    assert.equal((await getEntitlementState(student.id)).hasAccess, true);
    assert.deepEqual((await db("admin_activity").where({admin_id: admin.id, entity_id: pass.id})
      .orderBy("id").pluck("action")), ["access_revoked", "access_restored"]);
    await access.setRevoked(pass.id, true, admin.id);
    await db("semester_access").where("id", pass.id).update({ ends_at: new Date(0) });
    await assert.rejects(access.setRevoked(pass.id, false, admin.id), /expired/);
  } finally {
    if (admin) await db("admin_activity").where("admin_id", admin.id).del();
    const ids = [student?.id, admin?.id].filter(Boolean);
    if (ids.length) await db("users").whereIn("id", ids).del();
    await db.destroy();
  }
});
