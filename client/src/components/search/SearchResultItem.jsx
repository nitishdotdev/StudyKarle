import React from "react";
import { Link } from "react-router-dom";
import { formatBytes } from "../../utils/formatBytes";
import { formatDate } from "../../utils/formatDate";
import { paymentAccessPath } from "../../utils/paymentRedirect";

function resultHref(item) {
  if (item.protected && !item.canPreview) {
    return paymentAccessPath(item.accessCode);
  }
  if (item.href) return item.href;
  if (item.source === "drive") {
    return item.kind === "folder"
      ? "/drive/folder/" + item.nodeId
      : "/drive/file/" + item.nodeId;
  }
  return "/notes/" + item.id;
}

function resultKey(item) {
  if (item.source === "drive") return "drive-" + item.nodeId;
  return "note-" + item.id;
}

export default function SearchResultItem({ item }) {
  const isFolder = item.kind === "folder";
  const locked = item.protected && !item.canPreview;
  const pathLabel = item.path || item.subjectName || "";
  const size = item.sizeBytes != null ? item.sizeBytes : item.size_bytes;
  const when = item.modifiedTime || item.created_at;

  return (
    <article
      data-search-key={resultKey(item)}
      className="flex min-w-0 items-start gap-3 rounded-xl border border-border-subtle bg-white p-3 sm:items-center sm:p-4"
    >
      <span
        aria-hidden="true"
        className={"material-symbols-outlined shrink-0 rounded-lg p-2 " +
          (isFolder ? "bg-indigo-50 text-indigo-600" : "bg-error-container/30 text-error")}
      >
        {isFolder ? "folder" : "picture_as_pdf"}
      </span>

      <div className="min-w-0 flex-1">
        <h3 className="break-words font-semibold text-text-primary">{item.title}</h3>
        {pathLabel ? <p className="break-words text-body-sm text-text-secondary">{pathLabel}</p> : null}
        <p className="mt-1 text-body-sm text-text-muted">
          {[item.page_count && item.page_count + " pages", !isFolder && size != null && formatBytes(size), when && formatDate(when)]
            .filter(Boolean).join(" · ")}
        </p>
        <Link
          to={resultHref(item)}
          className="inline-flex min-h-[44px] items-center font-semibold text-primary hover:underline"
          aria-label={(locked ? "Unlock " : isFolder ? "Open folder " : "Preview ") + item.title}
        >
          {locked ? "Unlock" : isFolder ? "Open folder" : "Preview"}
        </Link>
      </div>
    </article>
  );
}
