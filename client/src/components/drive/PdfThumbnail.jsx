import React, { useEffect, useState } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import {
  canFetchPdfThumbnail,
  isPdfResource,
  pdfThumbnailUrl,
} from "../../utils/pdfThumbnail";

pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.js";

const PDF_OPTIONS = { withCredentials: true };

function Placeholder({ locked, label }) {
  return (
    <div
      className={
        "flex h-full w-full flex-col items-center justify-center " +
        (locked ? "bg-surface-low text-text-muted" : "bg-error/10 text-error")
      }
      role="img"
      aria-label={label}
    >
      <span className="material-symbols-outlined text-[32px]" aria-hidden="true">
        {locked ? "lock" : "picture_as_pdf"}
      </span>
      <span className="mt-1 text-label-sm font-semibold uppercase tracking-wide">
        {locked ? "Locked" : "PDF"}
      </span>
    </div>
  );
}

export default function PdfThumbnail({ item }) {
  const [failed, setFailed] = useState(false);
  const isPdf = isPdfResource(item);
  const accessible = canFetchPdfThumbnail(item);
  const url = pdfThumbnailUrl(item);

  useEffect(
    function () {
      setFailed(false);
    },
    [item && item.resourceId, item && item.resourceType]
  );

  if (!item || !isPdf) {
    return (
      <div className="flex h-full w-full flex-col items-center justify-center bg-indigo-50 text-indigo-600">
        <span className="material-symbols-outlined text-[32px]" aria-hidden="true">
          description
        </span>
        <span className="mt-1 text-label-sm font-semibold uppercase tracking-wide">
          FILE
        </span>
      </div>
    );
  }

  if (!accessible) {
    return <Placeholder locked label="Locked document" />;
  }

  if (failed) {
    return <Placeholder label="PDF document" />;
  }

  return (
    <div className="flex h-full w-full items-center justify-center overflow-hidden bg-surface-low">
      <Document
        file={url}
        options={PDF_OPTIONS}
        loading={<div className="h-full w-full animate-pulse bg-surface-high" />}
        error={<Placeholder label="PDF document" />}
        onLoadError={function () {
          setFailed(true);
        }}
        onSourceError={function () {
          setFailed(true);
        }}
      >
        <Page
          pageNumber={1}
          width={280}
          renderTextLayer={false}
          renderAnnotationLayer={false}
          onRenderError={function () {
            setFailed(true);
          }}
        />
      </Document>
    </div>
  );
}
