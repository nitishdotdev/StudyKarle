import axiosClient from "./axiosClient";

export function signup(payload) {
  return axiosClient.post("/auth/signup", payload).then(function (res) {
    return res.data.data;
  });
}

export function requestOtp(payload) {
  return axiosClient.post("/auth/request-otp", payload).then(function (res) {
    return res.data.data;
  });
}

export function verifyOtp(payload) {
  return axiosClient.post("/auth/verify-otp", payload).then(function (res) {
    return res.data.data;
  });
}

export function resendOtp(payload) {
  return axiosClient.post("/auth/resend-otp", payload).then(function (res) {
    return res.data.data;
  });
}

export function login(payload) {
  return axiosClient.post("/auth/login", payload).then(function (res) {
    return res.data.data;
  });
}

export function logout() {
  return axiosClient.post("/auth/logout").then(function (res) {
    return res.data.data;
  });
}

let inFlightCurrentUser = null;

export function fetchCurrentUser() {
  if (inFlightCurrentUser) {
    return inFlightCurrentUser;
  }
  inFlightCurrentUser = axiosClient
    .get("/auth/me")
    .then(function (res) {
      return res.data.data;
    })
    .finally(function () {
      inFlightCurrentUser = null;
    });
  return inFlightCurrentUser;
}

export function requestPasswordReset(payload) {
  return axiosClient.post("/auth/forgot-password", payload).then(function (res) {
    return res.data.data;
  });
}

export function resendPasswordReset(payload) {
  return axiosClient
    .post("/auth/forgot-password/resend", payload)
    .then(function (res) {
      return res.data.data;
    });
}

export function verifyPasswordResetOtp(payload) {
  return axiosClient
    .post("/auth/forgot-password/verify", payload)
    .then(function (res) {
      return res.data.data;
    });
}

export function resetPassword(payload) {
  return axiosClient.post("/auth/reset-password", payload).then(function (res) {
    return res.data.data;
  });
}

export function completeGoogleLogin(payload) {
  return axiosClient.post("/auth/google/complete", payload).then(function (res) {
    return res.data.data;
  });
}

// Google account linking (existing email/password or password-less account).
// The ticket is opaque and single-use; the linked email/destination stay
// server-side and are fetched by ticket, never passed in the URL.
export function googleLinkInfo(payload) {
  return axiosClient.post("/auth/google/link/info", payload).then(function (res) {
    return res.data.data;
  });
}

export function googleLinkVerify(payload) {
  return axiosClient.post("/auth/google/link/verify", payload).then(function (res) {
    return res.data.data;
  });
}

export function googleLinkRecoveryRequest(payload) {
  return axiosClient
    .post("/auth/google/link/recovery/request", payload)
    .then(function (res) {
      return res.data.data;
    });
}

export function googleLinkRecoveryVerify(payload) {
  return axiosClient
    .post("/auth/google/link/recovery/verify", payload)
    .then(function (res) {
      return res.data.data;
    });
}
