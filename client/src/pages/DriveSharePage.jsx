import React, { lazy, Suspense } from "react";
import { useParams, Link } from "react-router-dom";
import Button from "../components/common/Button";
import Badge from "../components/common/Badge";
import Skeleton from "../components/common/Skeleton";
import ErrorState from "../components/common/ErrorState";
import NotFoundState from "../components/common/NotFoundState";
import PageLoader from "../components/common/PageLoader";
import { formatBytes } from "../utils/formatBytes";
import { formatDate } from "../utils/formatDate";
import useFetch from "../hooks/useFetch";
import {
  fetchDriveShare,
  getDriveSharePreviewUrl,
} from "../api/driveApi";

// Public share viewer. Access is gated by the cryptographically random share
// token in the URL, not by a login — this is the explicit sharing model, kept
// separate from the authenticated /drive/file/:id pages.
const PdfPreview = lazy(function () {
  return import("../components/notes/PdfPreview");
});

export default function DriveSharePage() {
  const { token } = useParams();
  const { data, loading, error, errorStatus } = useFetch(
    function () {
      return fetchDriveShare(token);
    },
    [token]
  );

  if (loading) {
    return (
      <div className="min-h-screen bg-background px-4 py-8">
        <div className="max-w-container mx-auto space-y-4">
          <Skeleton type="row" count={2} />
          <Skeleton type="row" count={4} />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-background px-4 py-8">
        <div className="max-w-container mx-auto">
          {errorStatus === 404 ? (
            <NotFoundState
              title="Share link not found"
              message="This share link is invalid, has expired, or was revoked."
            />
          ) : (
            <ErrorState message={error} />
          )}
          <div className="mt-6 text-center">
            <Link to="/">
              <Button variant="secondary">Back to StudyKarle</Button>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const node = data.node;

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-20 bg-white/90 backdrop-blur border-b border-border-subtle">
        <div className="max-w-container mx-auto px-4 sm:px-6 lg:px-8 py-3 flex items-center justify-between gap-4">
          <Link to="/" className="flex items-center gap-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <span className="material-symbols-outlined" aria-hidden="true">
                school
              </span>
            </span>
            <span className="font-headline-md text-headline-md font-semibold tracking-tight text-primary">
              StudyKarle
            </span>
          </Link>
          <div className="flex items-center gap-2">
            <span className="text-body-sm text-text-muted hidden sm:block">
              Shared with you
            </span>
            <Link to="/login">
              <Button variant="secondary" size="sm">
                Sign in
              </Button>
            </Link>
          </div>
        </div>
      </header>

      <main className="max-w-container mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
          <div className="min-w-0">
            <h1 className="font-headline-lg text-headline-lg text-text-primary break-words">
              {node.name}
            </h1>
            <div className="flex items-center gap-3 mt-2">
              <Badge variant="primary">PDF</Badge>
              <Badge variant="neutral">Preview only</Badge>
            </div>
          </div>
          <span className="text-body-sm text-text-muted">
            Downloads are disabled on shared links
          </span>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-12 gap-8 items-start">
          <div className="xl:col-span-8 min-w-0">
            <Suspense fallback={<PageLoader label="Loading PDF viewer..." />}>
              <PdfPreview
                noteId={token}
                title={node.name}
                previewUrl={getDriveSharePreviewUrl(token)}
                fallbackUrl={"/drive/shares/" + token + "/preview"}
              />
            </Suspense>
          </div>

          <div className="xl:col-span-4 space-y-gutter">
            <div className="bg-white rounded-xl border border-border-subtle p-stack-md">
              <h3 className="text-label-md text-text-muted uppercase tracking-wider mb-6">
                File Details
              </h3>
              <dl className="space-y-4">
                <div className="flex justify-between items-center py-2 border-b border-border-subtle">
                  <dt className="text-body-sm text-text-secondary">Modified</dt>
                  <dd className="font-label-md text-label-md text-text-primary">
                    {node.modifiedTime ? formatDate(node.modifiedTime) : "—"}
                  </dd>
                </div>
                <div className="flex justify-between items-center py-2">
                  <dt className="text-body-sm text-text-secondary">Size</dt>
                  <dd className="font-label-md text-label-md text-text-primary">
                    {formatBytes(node.sizeBytes)}
                  </dd>
                </div>
                {data.expiresAt ? (
                  <div className="flex justify-between items-center py-2">
                    <dt className="text-body-sm text-text-secondary">
                      Link expires
                    </dt>
                    <dd className="font-label-md text-label-md text-text-primary">
                      {formatDate(data.expiresAt)}
                    </dd>
                  </div>
                ) : null}
              </dl>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
