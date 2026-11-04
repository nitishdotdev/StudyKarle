import React from "react";
import { Link } from "react-router-dom";
import { formatBytes } from "../../utils/formatBytes";
import { formatDate } from "../../utils/formatDate";
import Button from "../common/Button";
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
    <div
      data-search-key={resultKey(item)}
      className="bg-white rounded-xl p-5 border border-border-subtle shadow-sm hover:shadow-md transition-all flex flex-col md:flex-row items-center gap-6"
    >
      <div
        className={
          "w-16 h-20 rounded-lg flex flex-col items-center justify-center shrink-0 " +
          (isFolder ? "bg-indigo-50 text-indigo-600" : "bg-error-container/30")
        }
      >
        <span
          className={
            "material-symbols-outlined text-4xl " + (isFolder ? "" : "text-error")
          }
          aria-hidden="true"
        >
          {isFolder ? "folder" : "picture_as_pdf"}
        </span>
        <span
          className={
            "text-[10px] font-bold mt-1 " + (isFolder ? "text-indigo-600" : "text-error")
          }
        >
          {isFolder ? "DIR" : "PDF"}
        </span>
      </div>

      <div className="flex-1 text-center md:text-left min-w-0">
        <h3 className="font-headline-md text-headline-md text-text-primary mb-1 truncate">
          {item.title}
        </h3>
        {pathLabel ? (
          <p className="text-body-sm text-text-muted mb-2 truncate">{pathLabel}</p>
        ) : null}
        <div className="flex flex-wrap items-center justify-center md:justify-start gap-y-2 gap-x-4">
          {item.page_count ? (
            <div className="flex items-center text-body-sm text-text-muted">
              <span className="material-symbols-outlined text-[18px] mr-1" aria-hidden="true">
                history_edu
              </span>
              {item.page_count} Pages
            </div>
          ) : null}
          {!isFolder ? (
            <div className="flex items-center text-body-sm text-text-muted">
              <span className="material-symbols-outlined text-[18px] mr-1" aria-hidden="true">
                save
              </span>
              {formatBytes(size)}
            </div>
          ) : null}
          {when ? (
            <div className="flex items-center text-body-sm text-text-muted">
              <span className="material-symbols-outlined text-[18px] mr-1" aria-hidden="true">
                event
              </span>
              {formatDate(when)}
            </div>
          ) : null}
        </div>
      </div>

      <div className="shrink-0">
        <Link to={resultHref(item)}>
          <Button variant="primary" size="md">
            {locked ? "Unlock" : isFolder ? "Open folder" : "Preview"}
          </Button>
        </Link>
      </div>
    </div>
  );
}
