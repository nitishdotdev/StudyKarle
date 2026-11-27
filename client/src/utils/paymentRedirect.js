export function paymentAccessPath(code, course) {
  const params = new URLSearchParams();
  if (code) params.set("reason", code);
  if (course?.courseSlug) params.set("course", course.courseSlug);
  if (course?.courseItemKey) params.set("item", course.courseItemKey);
  const query = params.toString();
  return "/access" + (query ? "?" + query : "");
}

export function shouldRedirectToAccess(err) {
  if (!err) return false;
  if (err.status === 402) return true;
  const code = err.details && err.details.code;
  return (
    code === "PAYMENT_REQUIRED" ||
    code === "PAYMENT_PENDING" ||
    code === "PAYMENT_REJECTED" ||
    code === "PAYMENT_EXPIRED"
  );
}

export function paymentAccessPathFromError(err, course) {
  const code = err && err.details && err.details.code;
  return paymentAccessPath(code, course);
}

export function paymentAccessPathFromDetails(details) {
  return paymentAccessPath(details && details.code);
}


export function courseMaterialPath(slug, itemKey) {
  return "/drive/course/" + encodeURIComponent(slug) + "/" + encodeURIComponent(itemKey);
}
