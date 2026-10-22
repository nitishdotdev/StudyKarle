import React, { lazy, Suspense, useEffect, useState } from "react";
import { Navigate, useNavigate, useParams } from "react-router-dom";
import AppShell from "../components/layout/AppShell";
import Button from "../components/common/Button";
import Skeleton from "../components/common/Skeleton";
import ErrorState from "../components/common/ErrorState";
import Badge from "../components/common/Badge";
import PageLoader from "../components/common/PageLoader";
import { formatBytes } from "../utils/formatBytes";
import { formatDate } from "../utils/formatDate";
import useFetch from "../hooks/useFetch";
import { fetchNote, downloadNoteFile } from "../api/notesApi";
import { saveNote, unsaveNote } from "../api/savedApi";
import { useToast } from "../context/ToastContext";
import useAuth from "../hooks/useAuth";
import { paymentAccessPath, paymentAccessPathFromError } from "../utils/paymentRedirect";

// pdf.js is heavy — only load it on this page, and only once the user is
// actually looking at the note preview (the PDF itself starts loading
// immediately while this chunk downloads).
const PdfPreview = lazy(function () {
  return import("../components/notes/PdfPreview");
});

export default function NotePreviewPage() {
  const { noteId } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const { isAdmin } = useAuth();
  const {
    data: note,
    loading,
    error,
    errorStatus,
    errorDetails,
    reload,
  } = useFetch(
    function () {
      return fetchNote(noteId);
    },
    [noteId]
  );

  const [saved, setSaved] = useState(false);
  const [savingBusy, setSavingBusy] = useState(false);
  const [downloadBusy, setDownloadBusy] = useState(false);

  useEffect(
    function () {
      setSaved(false);
    },
    [noteId]
  );

  function handleToggleSave() {
    setSavingBusy(true);
    const action = saved ? unsaveNote(noteId) : saveNote(noteId);
    action
      .then(function () {
        setSaved(!saved);
        toast.success(saved ? "Removed from saved notes" : "Saved for later");
      })
      .catch(function (err) {
        toast.error(err.message);
      })
      .finally(function () {
        setSavingBusy(false);
      });
  }

  function handleDownload() {
    if (!note) return;
    setDownloadBusy(true);
    downloadNoteFile(note.id)
      .then(function (result) {
        toast.success("Downloading " + (result.filename || "file"));
      })
      .catch(function (err) {
        if (err.status === 402) {
          navigate(paymentAccessPathFromError(err), { replace: true });
          return;
        }
        toast.error(err.message);
      })
      .finally(function () {
        setDownloadBusy(false);
      });
  }

  function handleShare() {
    const shareUrl = window.location.href;
    if (navigator.share) {
      navigator
        .share({ title: note ? note.title : "StudyKarle Note", url: shareUrl })
        .catch(function () {});
    } else {
      navigator.clipboard.writeText(shareUrl);
      toast.success("Link copied to clipboard");
    }
  }

  if (errorStatus === 402) {
    return (
      <Navigate
        to={paymentAccessPathFromError({ status: errorStatus, details: errorDetails })}
        replace
      />
    );
  }

  const canDownload = !!(isAdmin && note && note.canDownload);
  const isProtected = note ? !!note.protected : false;
  const canPreview = note ? note.canPreview !== false : true;

  if (note && isProtected && !canPreview) {
    return <Navigate to={paymentAccessPath(note.accessCode)} replace />;
  }

  return (
    <AppShell>
      <div className="flex items-center gap-3 mb-4">
        <button
          type="button"
          onClick={function () {
            navigate(-1);
          }}
          aria-label="Go back"
          className="shrink-0 w-9 h-9 rounded-lg border border-border-subtle bg-white flex items-center justify-center text-text-secondary hover:bg-surface-low transition-colors"
        >
          <span className="material-symbols-outlined text-[20px]" aria-hidden="true">
            arrow_back
          </span>
        </button>
        <div className="flex-1 min-w-0">
          <h2 className="font-headline-md text-headline-md text-text-primary truncate">
            {loading ? "..." : note ? note.title : "Note"}
          </h2>
        </div>
      </div>

      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
        <div className="min-w-0">
          {loading ? (
            <div className="space-y-2">
              <Skeleton type="row" count={1} />
            </div>
          ) : note ? (
            <React.Fragment>
              <h1 className="font-headline-lg text-headline-lg text-text-primary break-words">
                {note.title}
              </h1>
              <div className="flex items-center gap-3 mt-2">
                <Badge variant="primary">PDF</Badge>
                <Badge variant="success">Secure Preview</Badge>
              </div>
            </React.Fragment>
          ) : null}
        </div>
        <div className="flex flex-wrap gap-3 w-full md:w-auto">
          {!isProtected ? (
            <Button
              variant="secondary"
              icon="share"
              onClick={handleShare}
              disabled={!note}
              className="flex-1 md:flex-none"
            >
              Share
            </Button>
          ) : null}
          <Button
            variant="secondary"
            icon="bookmark"
            onClick={handleToggleSave}
            loading={savingBusy}
            disabled={!note}
            className="flex-1 md:flex-none"
          >
            {saved ? "Saved" : "Save"}
          </Button>
          {canDownload ? (
            <Button
              icon="download"
              onClick={handleDownload}
              loading={downloadBusy}
              disabled={!note}
              className="w-full md:w-auto"
            >
              Download
            </Button>
          ) : null}
        </div>
      </div>

      {error ? (
        <ErrorState message={error} onRetry={reload} />
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-8 items-start">
          {/* min-w-0 prevents the grid column from refusing to shrink on mobile */}
          <div className="xl:col-span-8 min-w-0">
            <Suspense fallback={<PageLoader label="Loading PDF viewer..." />}>
              <PdfPreview
                noteId={noteId}
                title={note ? note.title : "Note"}
                onAccessDenied={function (err) {
                  navigate(paymentAccessPathFromError(err), { replace: true });
                }}
              />
            </Suspense>
          </div>

          <div className="xl:col-span-4 space-y-gutter">
            {loading ? (
              <Skeleton type="row" count={4} />
            ) : note ? (
              <React.Fragment>
                <div className="bg-white rounded-xl border border-border-subtle p-stack-md">
                  <h3 className="text-label-md text-text-muted uppercase tracking-wider mb-6">
                    File Details
                  </h3>
                  <dl className="space-y-4">
                    <div className="flex justify-between items-center py-2 border-b border-border-subtle">
                      <dt className="text-body-sm text-text-secondary">
                        Subject
                      </dt>
                      <dd className="font-label-md text-label-md text-text-primary">
                        {note.subject_name}
                      </dd>
                    </div>
                    <div className="flex justify-between items-center py-2 border-b border-border-subtle">
                      <dt className="text-body-sm text-text-secondary">
                        Semester
                      </dt>
                      <dd className="font-label-md text-label-md text-text-primary">
                        {note.semester_label}
                      </dd>
                    </div>
                    <div className="flex justify-between items-center py-2 border-b border-border-subtle">
                      <dt className="text-body-sm text-text-secondary">
                        Uploaded on
                      </dt>
                      <dd className="font-label-md text-label-md text-text-primary">
                        {formatDate(note.created_at)}
                      </dd>
                    </div>
                    <div className="flex justify-between items-center py-2">
                      <dt className="text-body-sm text-text-secondary">Size</dt>
                      <dd className="font-label-md text-label-md text-text-primary">
                        {formatBytes(note.size_bytes)}
                      </dd>
                    </div>
                  </dl>
                </div>

                {note.description ? (
                  <div className="bg-white rounded-xl border border-border-subtle p-stack-md">
                    <h3 className="text-label-md text-text-muted uppercase tracking-wider mb-3">
                      Description
                    </h3>
                    <p className="text-body-sm text-text-secondary leading-relaxed">
                      {note.description}
                    </p>
                  </div>
                ) : null}
              </React.Fragment>
            ) : null}
          </div>
        </div>
      )}
    </AppShell>
  );
}
