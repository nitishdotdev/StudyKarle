import React from "react";
import { Link } from "react-router-dom";
import { activityLabel, resourceHref, resumeAction } from "../../utils/continueStudying";
import { readPdfPosition } from "../../utils/pdfPositionStore";
import PdfThumbnail from "./PdfThumbnail";

function displayTitle(title) {
  return String(title || "").replace(/\.pdf$/i, "");
}

export default function ContinueStudyingCard({ item, userId }) {
  const page = readPdfPosition(userId, item.resourceId, {
    resourceType: item.resourceType,
  });
  const action = resumeAction(item, page);
  const href = resourceHref(item);

  return (
    <Link
      to={href}
      className="group flex min-h-[44px] flex-col overflow-hidden rounded-xl border border-border-subtle bg-white"
    >
      <div
        className="aspect-[16/7]"
      >
        <PdfThumbnail item={item} />
      </div>
      <div className="flex flex-1 flex-col px-4 pt-3 pb-2">
        <h3 className="font-headline-md text-headline-md text-text-primary line-clamp-1">
          {displayTitle(item.title)}
        </h3>
        {item.context ? (
          <p className="mt-0.5 text-body-sm text-text-secondary line-clamp-1">{item.context}</p>
        ) : null}
        <p className="mt-0.5 text-body-sm text-text-muted">{activityLabel(item)}</p>
      </div>
      <div className="border-t border-border-subtle bg-primary/10 px-4 py-2.5 text-label-md font-semibold text-primary">
        {action}
      </div>
    </Link>
  );
}
