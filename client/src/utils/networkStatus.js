export const CONNECTIVITY = {
  ONLINE: "online",
  OFFLINE_HINT: "offline_hint",
  UNREACHABLE: "unreachable",
  SERVER: "server",
};

export function classifyConnectivity(input) {
  const browserOnline = !(input && input.browserOnline === false);
  const status = input && input.lastErrorStatus;
  if (!browserOnline) {
    return CONNECTIVITY.OFFLINE_HINT;
  }
  if (status === 0) {
    return CONNECTIVITY.UNREACHABLE;
  }
  if (status === 502 || status === 503 || status === 504 || status === 500) {
    return CONNECTIVITY.SERVER;
  }
  return CONNECTIVITY.ONLINE;
}

export function getBrowserOnline() {
  if (typeof navigator === "undefined") {
    return true;
  }
  return navigator.onLine !== false;
}
