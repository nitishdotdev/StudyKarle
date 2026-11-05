import { formatRelativeTime } from "./formatDate.js";
import { paymentAccessPath } from "./paymentRedirect.js";

export function shouldShowContinueStudying(user) {
  return !!(user && user.role === "student");
}

export function resourceHref(item) {
  if (!item) {
    return "/dashboard";
  }
  if (item.canPreview === false) {
    return paymentAccessPath(item.accessCode);
  }
  if (item.href) {
    return item.href;
  }
  if (item.resourceType === "note") {
    return "/notes/" + encodeURIComponent(item.resourceId);
  }
  return "/drive/file/" + encodeURIComponent(item.resourceId);
}

export function resumeAction(item, page) {
  if (!item || item.canPreview === false) {
    return "Unlock access";
  }
  const pageNumber = Number(page);
  if (Number.isInteger(pageNumber) && pageNumber > 1) {
    return "Resume · Page " + pageNumber;
  }
  return "Continue reading";
}

export function lastOpenedLabel(value) {
  if (!value) {
    return "Last opened recently";
  }
  const date = new Date(value);
  const diffMs = Date.now() - date.getTime();
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  if (!Number.isFinite(diffHours) || diffHours < 24) {
    return "Last opened recently";
  }
  return "Last opened " + formatRelativeTime(value);
}
