import axiosClient, { API_URL } from "./axiosClient";

export function fetchPaymentOffer() {
  return axiosClient.get("/payments/offer").then(function (res) {
    return res.data.data;
  });
}

export function fetchPaymentAccess() {
  return axiosClient.get("/payments/access", { skipCache: true }).then(function (res) {
    return res.data.data;
  });
}

export function startCheckout() {
  return axiosClient.post("/payments/checkout", {}).then(function (res) {
    return res.data.data;
  });
}

export function submitPaymentProof(formData) {
  return axiosClient
    .post("/payments/submit", formData, {
      headers: { "Content-Type": "multipart/form-data" },
    })
    .then(function (res) {
      return res.data.data;
    });
}

export function fetchMyPayments() {
  return axiosClient.get("/payments/me", { skipCache: true }).then(function (res) {
    return res.data.data;
  });
}

export function getDriveThumbnailUrl(nodeId) {
  return API_URL + "/drive/files/" + encodeURIComponent(nodeId) + "/thumbnail";
}

export function fetchAdminPayments(params) {
  return axiosClient
    .get("/admin/payments", { params: params || {}, skipCache: true })
    .then(function (res) {
      return res.data.data;
    });
}

export function fetchAdminPayment(id) {
  return axiosClient.get("/admin/payments/" + id, { skipCache: true }).then(function (res) {
    return res.data.data;
  });
}

export function getAdminPaymentScreenshotUrl(id) {
  return API_URL + "/admin/payments/" + encodeURIComponent(id) + "/screenshot";
}

export function approveAdminPayment(id) {
  return axiosClient.post("/admin/payments/" + id + "/approve", {}).then(function (res) {
    return res.data.data;
  });
}

export function rejectAdminPayment(id, note) {
  return axiosClient
    .post("/admin/payments/" + id + "/reject", { note: note || "" })
    .then(function (res) {
      return res.data.data;
    });
}

export function isPaymentRequiredStatus(status) {
  return status === 402;
}
