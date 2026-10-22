import React from "react";
import { Link } from "react-router-dom";
import { formatBytes } from "../../utils/formatBytes";
import useAuthenticatedImage from "../../hooks/useAuthenticatedImage";
import { paymentAccessPath } from "../../utils/paymentRedirect";

export default function MaterialCard({ file }) {
  const locked = !!file.protected && !file.canPreview;
  const to = locked
    ? paymentAccessPath(file.accessCode)
    : "/drive/file/" + file.nodeId;
  const { src, failed } = useAuthenticatedImage(
    file.nodeId ? "/drive/files/" + encodeURIComponent(file.nodeId) + "/thumbnail" : null
  );

  return (
    <Link
      to={to}
      className="group bg-white rounded-xl border border-border-subtle shadow-sm hover:shadow-md transition-all overflow-hidden flex flex-col"
    >
      <div className="relative bg-surface-low aspect-[3/4] overflow-hidden">
        {failed || !src ? (
          <div className="w-full h-full flex flex-col items-center justify-center gap-2 text-primary">
            <span className="material-symbols-outlined text-[36px]" aria-hidden="true">
              picture_as_pdf
            </span>
            <span className="text-label-sm font-semibold uppercase tracking-wide">PDF</span>
          </div>
        ) : (
          <img
            src={src}
            alt=""
            width="320"
            height="420"
            className="w-full h-full object-cover"
          />
        )}
        {locked ? (
          <div className="absolute inset-0 bg-slate-900/45 flex items-center justify-center">
            <span className="inline-flex items-center gap-1 rounded-full bg-white px-3 py-1 text-label-sm font-semibold text-text-primary">
              <span className="material-symbols-outlined text-[16px]" aria-hidden="true">
                lock
              </span>
              Unlock with access
            </span>
          </div>
        ) : null}
      </div>
      <div className="p-4 flex-1 flex flex-col gap-1">
        <h4 className="font-headline-sm text-headline-sm text-text-primary group-hover:text-primary transition-colors line-clamp-2">
          {file.name}
        </h4>
        <p className="text-body-sm text-text-muted">
          {file.path || file.parentName || "Library"}
        </p>
        <p className="text-body-sm text-text-muted mt-auto">
          {formatBytes(file.sizeBytes)}
        </p>
      </div>
    </Link>
  );
}
