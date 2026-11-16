import React from "react";
import { Link } from "react-router-dom";
import { lastOpenedLabel, resourceHref, resumeAction } from "../../utils/continueStudying";
import { readPdfPosition } from "../../utils/pdfPositionStore";

function isPdf(item) {
  if (!item) return true;
  if (item.fileType === "pdf") return true;
  const mime = String(item.mimeType || "").toLowerCase();
  return mime.indexOf("pdf") !== -1;
}

function displayTitle(title) {
  return String(title || "").replace(/\.pdf$/i, "");
}

export default function ContinueStudyingCard({ item, userId }) {
  const pdf = isPdf(item);
  const page = readPdfPosition(userId, item.resourceId);
  const action = resumeAction(item, page);
  const href = resourceHref(item);

  return (
    <Link
      to={href}
      className="group flex min-h-[44px] flex-col overflow-hidden rounded-xl border border-border-subtle bg-white"
    >
      <div
        className={
          "flex aspect-[16/7] flex-col items-center justify-center " +
          (pdf ? "bg-error/10 text-error" : "bg-indigo-50 text-indigo-600")
        }
      >
        <span className="material-symbols-outlined text-[32px]" aria-hidden="true">
          {pdf ? "picture_as_pdf" : "description"}
        </span>
        <span className="mt-1 text-label-sm font-semibold uppercase tracking-wide">
          {pdf ? "PDF" : "FILE"}
        </span>
      </div>
      <div className="flex flex-1 flex-col px-4 pt-3 pb-2">
        <h4 className="font-headline-md text-headline-md text-text-primary line-clamp-1">
          {displayTitle(item.title)}
        </h4>
        {item.context ? (
          <p className="mt-0.5 text-body-sm text-text-secondary line-clamp-1">{item.context}</p>
        ) : null}
        <p className="mt-0.5 text-body-sm text-text-muted">{lastOpenedLabel(item.lastOpenedAt)}</p>
      </div>
      <div className="border-t border-border-subtle bg-primary/10 px-4 py-2.5 text-label-md font-semibold text-primary">
        {action}
      </div>
    </Link>
  );
}
