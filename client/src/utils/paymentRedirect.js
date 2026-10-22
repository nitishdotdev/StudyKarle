export function paymentAccessPath(code) {
  const params = new URLSearchParams();
  if (code) params.set("reason", code);
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

export function paymentAccessPathFromError(err) {
  const code = err && err.details && err.details.code;
  return paymentAccessPath(code);
}

export function paymentAccessPathFromDetails(details) {
  return paymentAccessPath(details && details.code);
}
