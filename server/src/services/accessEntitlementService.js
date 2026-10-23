const paymentRequestModel = require("../models/paymentRequestModel");
const semesterAccessModel = require("../models/semesterAccessModel");

function isFuture(date) {
  if (!date) return false;
  return new Date(date).getTime() > Date.now();
}

async function getEntitlementState(userId) {
  const access = await semesterAccessModel.findByUserId(userId);
  const latest = await paymentRequestModel.findLatestByUser(userId);

  if (access && isFuture(access.ends_at)) {
    return {
      hasAccess: true,
      status: "approved",
      endsAt: access.ends_at,
      payment: latest,
    };
  }

  if (access && !isFuture(access.ends_at)) {
    return {
      hasAccess: false,
      status: "expired",
      endsAt: access.ends_at,
      payment: latest,
    };
  }

  if (latest && latest.status === "pending") {
    return {
      hasAccess: false,
      status: "pending",
      endsAt: null,
      payment: latest,
    };
  }

  if (latest && latest.status === "rejected") {
    return {
      hasAccess: false,
      status: "rejected",
      endsAt: null,
      payment: latest,
    };
  }

  if (latest && latest.status === "approved") {
    return {
      hasAccess: false,
      status: "expired",
      endsAt: access ? access.ends_at : null,
      payment: latest,
    };
  }

  return {
    hasAccess: false,
    status: "unpaid",
    endsAt: null,
    payment: latest,
  };
}

module.exports = {
  getEntitlementState,
};
