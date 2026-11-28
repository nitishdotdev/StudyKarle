import React, { useEffect, useRef, useState } from "react";
import workerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import * as pdfjs from "pdfjs-dist/build/pdf.mjs";
import {
  canFetchPdfThumbnail,
  isPdfResource,
  pdfThumbnailUrl,
} from "../../utils/pdfThumbnail";

pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;

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
  const [loading, setLoading] = useState(true);
  const canvasRef = useRef(null);
  const isPdf = isPdfResource(item);
  const accessible = canFetchPdfThumbnail(item);
  const url = pdfThumbnailUrl(item);

  useEffect(
    function () {
      setFailed(false);
      setLoading(true);
    },
    [item && item.resourceId, item && item.resourceType]
  );

  useEffect(
    function () {
      if (!canFetchPdfThumbnail(item) || !url) return undefined;

      let active = true;
      let loadingTask = null;
      let renderTask = null;

      async function renderFirstPage() {
        try {
          loadingTask = pdfjs.getDocument({
            url: url,
            withCredentials: true,
          });
          const documentProxy = await loadingTask.promise;
          const page = await documentProxy.getPage(1);
          if (!active || !canvasRef.current) {
            page.cleanup();
            await documentProxy.destroy();
            return;
          }

          const viewport = page.getViewport({ scale: 1 });
          const canvas = canvasRef.current;
          const scale = Math.min(280 / viewport.width, 1);
          const scaledViewport = page.getViewport({ scale: scale });
          canvas.width = scaledViewport.width;
          canvas.height = scaledViewport.height;
          canvas.style.width = "100%";
          canvas.style.height = "auto";
          renderTask = page.render({
            canvasContext: canvas.getContext("2d"),
            viewport: scaledViewport,
          });
          await renderTask.promise;
          page.cleanup();
          await documentProxy.destroy();
          if (active) setLoading(false);
        } catch (error) {
          if (active) {
            setFailed(true);
            setLoading(false);
          }
        }
      }

      renderFirstPage();

      return function () {
        active = false;
        if (renderTask) renderTask.cancel();
        if (loadingTask) loadingTask.destroy();
      };
    },
    [item, url]
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
      {loading ? (
        <div className="h-full w-full animate-pulse bg-surface-high" />
      ) : null}
      <canvas
        ref={canvasRef}
        className={loading ? "hidden" : "block max-h-full max-w-full"}
        aria-label="PDF first-page preview"
      />
    </div>
  );
}
