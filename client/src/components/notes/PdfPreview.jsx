import React, { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";
import axiosClient from '../../api/axiosClient';
import { getPreviewUrl } from '../../api/notesApi';
import Spinner from '../common/Spinner';
import ErrorState from '../common/ErrorState';

// ------------------------------------------------------------------
// PDF.js worker
// ------------------------------------------------------------------
// Production worker copied into client/public (matches pdfjs-dist 3.11.174).
pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.js";

// Stable options reference — react-pdf warns (and reloads the document) if
// this object's identity changes between renders.
const PDF_OPTIONS = { withCredentials: true };

// Memoized single page. Only re-renders when its own slice of props changes
// (visibility, width, aspect), not when sibling pages render.
const PdfPage = React.memo(function PdfPage({
  pageNum,
  pageWidth,
  isVisible,
  aspect,
  onRenderSuccess,
}) {
  const placeholderHeight = aspect && pageWidth
    ? Math.round(pageWidth * aspect)
    : pageWidth
      ? Math.round(pageWidth * 1.414) // A4 fallback
      : 400;

  if (isVisible && pageWidth > 0) {
    return (
      <div className="shadow-sm rounded-sm overflow-hidden">
        <Page
          pageNumber={pageNum}
          width={pageWidth}
          renderTextLayer={true}
          renderAnnotationLayer={true}
          onRenderSuccess={onRenderSuccess}
          loading={
            <div
              className="flex items-center justify-center bg-surface-high rounded-lg"
              style={{ width: pageWidth, height: placeholderHeight }}
            >
              <Spinner size="sm" />
            </div>
          }
        />
      </div>
    );
  }

  return (
    <div
      className="bg-surface-high rounded-lg animate-pulse"
      style={{ width: pageWidth || '100%', height: placeholderHeight }}
    />
  );
});

export default function PdfPreview({ noteId, title, previewUrl, fallbackUrl, onAccessDenied }) {
  const [file, setFile] = useState(function () {
    return previewUrl || getPreviewUrl(noteId);
  });
  const [error, setError] = useState(null);
  const [numPages, setNumPages] = useState(null);
  const [visiblePages, setVisiblePages] = useState(new Set());
  const [pageAspects, setPageAspects] = useState({});
  const [activePage, setActivePage] = useState(1);
  const [loadProgress, setLoadProgress] = useState(0);

  const containerRef = useRef(null);
  const scrollRef = useRef(null);
  const pageRefs = useRef({});
  const visiblePagesRef = useRef(new Set());
  const pageAspectsRef = useRef({});
  const fallbackTriedRef = useRef(false);
  const [containerWidth, setContainerWidth] = useState(0);

  // Reset state when the note changes.
  useEffect(
    function () {
      setFile(previewUrl || getPreviewUrl(noteId));
      setError(null);
      setNumPages(null);
      setVisiblePages(new Set());
      visiblePagesRef.current = new Set();
      pageAspectsRef.current = {};
      setPageAspects({});
      setActivePage(1);
      pageRefs.current = {};
      fallbackTriedRef.current = false;
      setLoadProgress(0);
    },
    [noteId, previewUrl]
  );

  // ----------------------------------------------------------------
  // 1. Measure container width in real time
  // ----------------------------------------------------------------
  useEffect(function () {
    const el = containerRef.current;
    if (!el) return;

    const update = function () {
      const rect = el.getBoundingClientRect();
      setContainerWidth(Math.max(Math.floor(rect.width) - 32, 0));
    };

    update();

    let ro;
    if (typeof ResizeObserver !== 'undefined') {
      ro = new ResizeObserver(update);
      ro.observe(el);
    } else {
      window.addEventListener('resize', update);
    }

    return function () {
      if (ro) ro.disconnect();
      else window.removeEventListener('resize', update);
    };
  }, []);

  // ----------------------------------------------------------------
  // 2. IntersectionObserver: lazy render + scroll spy
  // ----------------------------------------------------------------
  useEffect(
    function () {
      if (!numPages || !scrollRef.current) return;

      const observer = new IntersectionObserver(
        function (entries) {
          let bestPage = activePage;
          let bestRatio = -1;
          const nextVisible = new Set(visiblePagesRef.current);

          entries.forEach(function (entry) {
            const page = Number(entry.target.dataset.pageNumber);
            if (entry.isIntersecting) {
              nextVisible.add(page);
              if (entry.intersectionRatio > bestRatio) {
                bestRatio = entry.intersectionRatio;
                bestPage = page;
              }
            } else {
              nextVisible.delete(page);
            }
          });

          // Only trigger a re-render when the visible set actually changed.
          let changed = nextVisible.size !== visiblePagesRef.current.size;
          if (!changed) {
            for (const p of nextVisible) {
              if (!visiblePagesRef.current.has(p)) {
                changed = true;
                break;
              }
            }
          }

          visiblePagesRef.current = nextVisible;
          if (changed) setVisiblePages(nextVisible);
          if (bestRatio >= 0) setActivePage(bestPage);
        },
        {
          root: scrollRef.current,
          rootMargin: '150% 0px',
          threshold: [0, 0.25, 0.5, 0.75, 1],
        }
      );

      Object.values(pageRefs.current).forEach(function (el) {
        if (el) observer.observe(el);
      });

      return function () {
        observer.disconnect();
      };
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [numPages]
  );

  const onDocumentLoadSuccess = useCallback(function ({ numPages: np }) {
    setNumPages(np);
    const initial = new Set();
    for (let i = 1; i <= Math.min(np, 3); i++) initial.add(i);
    visiblePagesRef.current = initial;
    setVisiblePages(initial);
  }, []);

  const onDocumentLoadError = useCallback(
    function (err) {
      if (!fallbackTriedRef.current) {
        // Range/streaming load failed (e.g. proxy without Range support) —
        // fall back to downloading the full file as an ArrayBuffer, which is
        // the previous behaviour and always works.
        fallbackTriedRef.current = true;
        axiosClient
          .get(fallbackUrl || "/notes/" + noteId + "/preview", {
            responseType: "arraybuffer",
            skipCache: true,
          })
          .then(function (res) {
            setError(null);
            setNumPages(null);
            setFile({ data: new Uint8Array(res.data) });
          })
          .catch(function (fallbackErr) {
            if (fallbackErr && fallbackErr.status === 402 && onAccessDenied) {
              onAccessDenied(fallbackErr);
              return;
            }
            setError((fallbackErr && fallbackErr.message) || err.message || 'Failed to load preview');
          });
        return;
      }
      setError(err.message || 'Failed to render PDF');
    },
    [noteId, fallbackUrl, onAccessDenied]
  );

  const handlePageRenderSuccess = useCallback(function (page) {
    const pageNum = page.pageNumber;
    const aspect = page.originalHeight / page.originalWidth;
    if (pageAspectsRef.current[pageNum] === aspect) return;
    pageAspectsRef.current[pageNum] = aspect;
    setPageAspects(Object.assign({}, pageAspectsRef.current));
  }, []);

  const handleLoadProgress = useCallback(
    function (progressData) {
      if (!progressData || !progressData.total) return;
      const percent = Math.round((progressData.loaded * 100) / progressData.total);
      setLoadProgress(function (prev) {
        return Math.abs(percent - prev) >= 2 ? percent : prev;
      });
    },
    []
  );

  const pageWidth = containerWidth
    ? Math.min(Math.max(containerWidth, 280), 1200)
    : 0;

  return (
    <div
      ref={containerRef}
      className="relative bg-surface-high rounded-xl overflow-hidden border border-border-subtle"
    >
      {error ? (
        <div className="flex items-center justify-center bg-white min-h-[300px] md:min-h-[500px]">
          <ErrorState message={error} />
        </div>
      ) : (
        <div className="relative bg-white">
          <div
            ref={scrollRef}
            className="overflow-y-auto overflow-x-hidden max-h-[70vh] lg:max-h-[750px] px-2 py-4"
            style={{ overscrollBehavior: 'contain' }}
          >
            <Document
              file={file}
              options={PDF_OPTIONS}
              onLoadSuccess={onDocumentLoadSuccess}
              onLoadError={onDocumentLoadError}
              onLoadProgress={handleLoadProgress}
              loading={
                <div className="flex items-center justify-center py-12">
                  <Spinner
                    size="lg"
                    label={
                      loadProgress > 0
                        ? 'Loading preview... ' + loadProgress + '%'
                        : 'Loading preview...'
                    }
                  />
                </div>
              }
              error={
                <div className="flex items-center justify-center py-12">
                  <ErrorState message="Failed to render PDF document." />
                </div>
              }
            >
              {numPages &&
                Array.from({ length: numPages }, function (_, i) {
                  return i + 1;
                }).map(function (pageNum) {
                  return (
                    <div
                      key={pageNum}
                      ref={function (el) {
                        pageRefs.current[pageNum] = el;
                      }}
                      data-page-number={pageNum}
                      className="flex justify-center mb-4 last:mb-0"
                    >
                      <PdfPage
                        pageNum={pageNum}
                        pageWidth={pageWidth}
                        isVisible={visiblePages.has(pageNum)}
                        aspect={pageAspects[pageNum]}
                        onRenderSuccess={handlePageRenderSuccess}
                      />
                    </div>
                  );
                })}
            </Document>
          </div>

          {numPages > 1 && (
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-text-primary/90 text-white text-xs font-medium px-3 py-1.5 rounded-full shadow-lg pointer-events-none select-none z-10">
              Page {activePage} of {numPages}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
