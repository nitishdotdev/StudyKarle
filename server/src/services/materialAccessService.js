const yearScope = require("./yearScopeService");

function authorizeMaterial(user, node, entitlement) {
  const protectedNode = yearScope.isProtectedNode(node);
  const role = user && user.role;
  if (role === "admin") {
    return {
      protected: protectedNode,
      canPreview: true,
      canDownload: true,
      bypassReason: "admin",
      code: null,
    };
  }

  if (!protectedNode) {
    return {
      protected: false,
      canPreview: true,
      canDownload: false,
      bypassReason: null,
      code: "DOWNLOAD_DISABLED",
    };
  }

  const status = entitlement && entitlement.status ? entitlement.status : "unpaid";
  const hasAccess = !!(entitlement && entitlement.hasAccess);

  if (hasAccess && status === "approved") {
    return {
      protected: true,
      canPreview: true,
      canDownload: false,
      bypassReason: null,
      code: "DOWNLOAD_DISABLED",
    };
  }

  let code = "PAYMENT_REQUIRED";
  if (status === "pending") code = "PAYMENT_PENDING";
  else if (status === "rejected") code = "PAYMENT_REJECTED";
  else if (status === "expired") code = "PAYMENT_EXPIRED";

  return {
    protected: true,
    canPreview: false,
    canDownload: false,
    bypassReason: null,
    code: code,
  };
}

module.exports = {
  authorizeMaterial,
};
