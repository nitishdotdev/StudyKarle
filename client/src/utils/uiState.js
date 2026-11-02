export const LOAD_STATES = {
  LOADING: "loading",
  ERROR: "error",
  EMPTY: "empty",
  READY: "ready",
};

export function classifyLoadState(input) {
  const loading = !!(input && input.loading);
  const error = input && input.error;
  const hasData = !!(input && input.hasData);
  const isEmpty = !!(input && input.isEmpty);
  const refreshing = !!(input && input.refreshing);

  if (error && !loading && !hasData) {
    return LOAD_STATES.ERROR;
  }
  if (loading && hasData && (refreshing || !isEmpty)) {
    return LOAD_STATES.READY;
  }
  if (loading) {
    return LOAD_STATES.LOADING;
  }
  if (hasData && isEmpty) {
    return LOAD_STATES.EMPTY;
  }
  if (hasData) {
    return LOAD_STATES.READY;
  }
  return LOAD_STATES.LOADING;
}

export function shouldShowSkeleton(input) {
  const loading = !!(input && input.loading);
  const hasData = !!(input && input.hasData);
  const elapsedMs = Number(input && input.elapsedMs) || 0;
  const minDelayMs = Number(input && input.minDelayMs);
  const delay = Number.isFinite(minDelayMs) ? minDelayMs : 200;
  if (!loading || hasData) {
    return false;
  }
  return elapsedMs >= delay;
}

function safeMessage(error) {
  if (!error) {
    return "The request failed. Please try again.";
  }
  const raw = typeof error.message === "string" ? error.message : "";
  if (!raw) {
    return "The request failed. Please try again.";
  }
  if (raw.length > 240) {
    return "The request failed. Please try again.";
  }
  if (/stack|token|secret|password|at\s+\S+\.js:\d+/i.test(raw)) {
    return "The request failed. Please try again.";
  }
  return raw;
}

function paymentMessage(code) {
  if (code === "PAYMENT_PENDING") {
    return "Payment verification is in progress. Year 1 and Year 2 notes stay locked until an administrator approves your screenshot.";
  }
  if (code === "PAYMENT_REJECTED") {
    return "This payment was not approved. You can submit a clearer screenshot from the access page.";
  }
  if (code === "PAYMENT_EXPIRED") {
    return "Your previous semester access has ended. Pay ₹9 again for the current semester.";
  }
  return "Pay ₹9 once to unlock Year 1 and Year 2 notes for the current semester.";
}

export function describeRequestError(error, options) {
  const status = error && typeof error.status === "number" ? error.status : 0;
  const online = !(options && options.online === false);
  const code = error && error.details && error.details.code;

  if (!online) {
    return {
      kind: "offline",
      title: "You're offline",
      message: "Connect to the internet to load new content. Anything already on this page stays available.",
      canRetry: true,
    };
  }
  if (status === 401) {
    return {
      kind: "unauthenticated",
      title: "Sign in again",
      message: "Your session ended. Sign in to continue.",
      canRetry: false,
      actionTo: "/login",
      actionLabel: "Sign in again",
    };
  }
  if (status === 402) {
    const reason = typeof code === "string" ? code : "PAYMENT_REQUIRED";
    return {
      kind: "payment",
      title: "Semester access needed",
      message: paymentMessage(reason),
      canRetry: false,
      actionTo: "/access?reason=" + encodeURIComponent(reason),
      actionLabel: "View access options",
    };
  }
  if (status === 403) {
    return {
      kind: "forbidden",
      title: "You don't have access",
      message: "This content isn't available for your account. You can keep browsing notes you already have access to.",
      canRetry: false,
      actionTo: "/dashboard",
      actionLabel: "Browse library",
    };
  }
  if (status === 404) {
    return {
      kind: "not_found",
      title: "Not found",
      message: safeMessage(error),
      canRetry: false,
    };
  }
  return {
    kind: "unavailable",
    title: "Couldn't load this content",
    message: safeMessage(error),
    canRetry: true,
  };
}
