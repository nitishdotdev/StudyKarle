import React, { lazy, Suspense, useEffect, useState } from "react";
import { Navigate, useNavigate, useParams } from "react-router-dom";
import AppShell from "../components/layout/AppShell";
import Button from "../components/common/Button";
import Skeleton from "../components/common/Skeleton";
import ErrorState from "../components/common/ErrorState";
import Badge from "../components/common/Badge";
import NotFoundState from "../components/common/NotFoundState";
import PageLoader from "../components/common/PageLoader";
import { formatBytes } from "../utils/formatBytes";
import { formatDate } from "../utils/formatDate";
import useFetch from "../hooks/useFetch";
import { useToast } from "../context/ToastContext";
import useAuth from "../hooks/useAuth";
import ShareModal from "../components/drive/ShareModal";
import {
  fetchDriveFile,
  downloadDriveFile,
  getDrivePreviewUrl,
  checkDriveFileSaved,
  saveDriveFile,
  unsaveDriveFile,
} from "../api/driveApi";
import { paymentAccessPath, paymentAccessPathFromError } from "../utils/paymentRedirect";

const PdfPreview = lazy(function () {
  return import("../components/notes/PdfPreview");
});

export default function DriveFilePage() {
  const { nodeId } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const { isAdmin } = useAuth();
  const { data, loading, error, errorStatus, errorDetails, reload } = useFetch(
    function () {
      return fetchDriveFile(nodeId);
    },
    [nodeId]
  );

  const [saved, setSaved] = useState(false);
  const [savingBusy, setSavingBusy] = useState(false);
  const [savedChecked, setSavedChecked] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [downloadBusy, setDownloadBusy] = useState(false);

  useEffect(
    function () {
      let cancelled = false;
      setSaved(false);
      setSavedChecked(false);
      checkDriveFileSaved(nodeId)
        .then(function (res) {
          if (!cancelled) {
            setSaved(!!res.saved);
            setSavedChecked(true);
          }
        })
        .catch(function () {
          if (!cancelled) setSavedChecked(true);
        });
      return function () {
        cancelled = true;
      };
    },
    [nodeId]
  );

  if (loading) {
    return (
      <AppShell>
        <div className="space-y-4">
          <Skeleton type="row" count={1} />
          <Skeleton type="row" count={3} />
        </div>
      </AppShell>
    );
  }

  if (error) {
    if (errorStatus === 402) {
      return <Navigate to={paymentAccessPathFromError({ status: errorStatus, details: errorDetails })} replace />;
    }
    if (errorStatus === 404) {
      return (
        <AppShell>
          <NotFoundState title="File not found" message={error} />
        </AppShell>
      );
    }
    return (
      <AppShell>
        <ErrorState message={error} onRetry={reload} />
      </AppShell>
    );
  }

  const node = data.node;
  const access = data.access || {};
  const canPreview = node.canPreview !== false && access.canPreview !== false;
  const canDownload = !!(isAdmin && (node.canDownload || access.canDownload));
  const isProtected = !!(node.protected || access.protected);

  if (isProtected && !canPreview) {
    return (
      <Navigate
        to={paymentAccessPath(node.accessCode || access.code)}
        replace
      />
    );
  }

  function handleToggleSave() {
    setSavingBusy(true);
    const action = saved ? unsaveDriveFile(nodeId) : saveDriveFile(nodeId);
    action
      .then(function () {
        setSaved(!saved);
        toast.success(saved ? "Removed from saved files" : "Saved for later");
      })
      .catch(function (err) {
        toast.error(err.message);
      })
      .finally(function () {
        setSavingBusy(false);
      });
  }

  function handleDownload() {
    setDownloadBusy(true);
    downloadDriveFile(nodeId)
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

  return (
    <AppShell>
      {!isProtected ? (
        <ShareModal
          open={shareOpen}
          onClose={function () {
            setShareOpen(false);
          }}
          nodeId={nodeId}
          fileName={node.name}
        />
      ) : null}
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
            {node.name}
          </h2>
        </div>
      </div>

      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
        <div className="min-w-0">
          <h1 className="font-headline-lg text-headline-lg text-text-primary break-words">
            {node.name}
          </h1>
          <div className="flex items-center gap-3 mt-2">
            <Badge variant="primary">PDF</Badge>
          </div>
        </div>
        <div className="flex flex-wrap gap-3 w-full md:w-auto">
          {!isProtected ? (
            <Button
              variant="secondary"
              icon="share"
              onClick={function () {
                setShareOpen(true);
              }}
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
            disabled={!savedChecked}
            className="flex-1 md:flex-none"
          >
            {saved ? "Saved" : "Save"}
          </Button>
          {canDownload ? (
            <Button
              icon="download"
              onClick={handleDownload}
              loading={downloadBusy}
              className="flex-1 md:flex-none"
            >
              Download
            </Button>
          ) : null}
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-8 items-start">
        <div className="xl:col-span-8 min-w-0">
          <Suspense fallback={<PageLoader label="Loading PDF viewer..." />}>
            <PdfPreview
              noteId={nodeId}
              title={node.name}
              previewUrl={getDrivePreviewUrl(nodeId)}
              fallbackUrl={"/drive/files/" + nodeId + "/preview"}
              onAccessDenied={function (err) {
                navigate(paymentAccessPathFromError(err), { replace: true });
              }}
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
            </dl>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
