const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validateEmail(value) {
  const email = String(value || "").trim();
  if (!email) {
    return "Enter your email address";
  }
  if (!EMAIL_PATTERN.test(email)) {
    return "Enter a valid email address";
  }
  return null;
}

export function validateLogin(form) {
  const next = {};
  const emailError = validateEmail(form && form.email);
  if (emailError) {
    next.email = emailError;
  }
  if (!String((form && form.password) || "")) {
    next.password = "Enter your password";
  }
  return next;
}

export function validateSignup(form) {
  const next = {};
  const name = String((form && form.name) || "").trim();
  if (name.length < 2) {
    next.name = "Name must be at least 2 characters";
  }
  const emailError = validateEmail(form && form.email);
  if (emailError) {
    next.email = emailError;
  }
  const password = String((form && form.password) || "");
  if (password.length < 8) {
    next.password = "Password must be at least 8 characters";
  } else if (!/\d/.test(password)) {
    next.password = "Password must contain at least one number";
  }
  return next;
}

export function validatePasswordChange(form) {
  const next = {};
  if (!String((form && form.currentPassword) || "")) {
    next.currentPassword = "Enter your current password";
  }
  const password = String((form && form.newPassword) || "");
  if (password.length < 8) {
    next.newPassword = "New password must be at least 8 characters";
  } else if (!/\d/.test(password)) {
    next.newPassword = "New password must contain at least one number";
  }
  return next;
}

const PAYMENT_PROOF_TYPES = {
  "image/jpeg": true,
  "image/png": true,
  "image/webp": true,
};
const PAYMENT_PROOF_MAX_BYTES = 5 * 1024 * 1024;

export function validatePaymentProof(input) {
  const next = {};
  const file = input && input.file;
  if (!file) {
    next.screenshot = "Upload a payment screenshot first.";
    return next;
  }
  const type = String(file.type || "").toLowerCase();
  if (!PAYMENT_PROOF_TYPES[type]) {
    next.screenshot = "Use a JPEG, PNG, or WEBP image.";
    return next;
  }
  if (Number(file.size) > PAYMENT_PROOF_MAX_BYTES) {
    next.screenshot = "Screenshot must be 5MB or smaller.";
  }
  return next;
}

export function firstInvalidField(errors) {
  const keys = ["name", "email", "password", "currentPassword", "newPassword", "otp", "confirmPassword", "screenshot"];
  for (let i = 0; i < keys.length; i++) {
    if (errors && errors[keys[i]]) {
      return keys[i];
    }
  }
  if (!errors) {
    return null;
  }
  const rest = Object.keys(errors);
  return rest.length ? rest[0] : null;
}

export function mergeServerFieldErrors(current, payload) {
  const next = Object.assign({}, current || {});
  const details = payload && payload.details;
  if (!details || typeof details !== "object") {
    return next;
  }
  Object.keys(details).forEach(function (key) {
    const value = details[key];
    if (typeof value === "string" && value) {
      next[key] = value;
    }
  });
  return next;
}

export function focusField(id) {
  if (typeof document === "undefined" || !id) {
    return;
  }
  const node = document.getElementById(id);
  if (node && typeof node.focus === "function") {
    node.focus();
  }
}
