import React from "react";
import { useNavigate, useParams } from "react-router-dom";
import AppShell from "../components/layout/AppShell";
import Breadcrumbs from "../components/common/Breadcrumbs";
import Skeleton from "../components/common/Skeleton";
import ErrorState from "../components/common/ErrorState";
import EmptyState from "../components/common/EmptyState";
import NotFoundState from "../components/common/NotFoundState";
import SlowLoadNotice from "../components/common/SlowLoadNotice";
import RefreshErrorBanner from "../components/common/RefreshErrorBanner";
import Button from "../components/common/Button";
import FolderGrid from "../components/drive/FolderGrid";
import MaterialGrid from "../components/drive/MaterialGrid";
import useFetch from "../hooks/useFetch";
import useDelayedFlag from "../hooks/useDelayedFlag";
import { fetchDriveRoot, fetchDriveFolder } from "../api/driveApi";
import { classifyLoadState, LOAD_STATES } from "../utils/uiState";

export default function DriveBrowsePage() {
  const { nodeId } = useParams();
  const navigate = useNavigate();
  const isRoot = !nodeId;

  const { data, loading, error, errorStatus, errorDetails, reload, refreshing } = useFetch(function () {
    return isRoot ? fetchDriveRoot() : fetchDriveFolder(nodeId);
  }, [nodeId]);
  const showSkeleton = useDelayedFlag(loading && !data, 200);

  const node = data && data.node;
  const parent = data && data.parent;
  const ancestors = (data && data.ancestors) || [];
  const folders = (data && data.folders) || [];
  const files = (data && data.files) || [];
  const state = classifyLoadState({
    loading: loading,
    error: error,
    hasData: !!data,
    isEmpty: folders.length === 0 && files.length === 0,
    refreshing: refreshing,
  });

  function handleBack() {
    if (parent) {
      navigate("/drive/folder/" + parent.nodeId);
    } else {
      navigate("/drive");
    }
  }

  const breadcrumbs = [{ label: "Library", to: isRoot ? undefined : "/drive" }]
    .concat(
      ancestors.map(function (a) {
        return { label: a.name, to: "/drive/folder/" + a.nodeId };
      })
    )
    .concat([{ label: node ? node.name : "..." }]);

  return (
    <AppShell>
      <div className="flex items-center gap-3 mb-4">
        {!isRoot ? (
          <button
            type="button"
            onClick={handleBack}
            aria-label="Back to parent folder"
            className="shrink-0 w-11 h-11 rounded-lg border border-border-subtle bg-white flex items-center justify-center text-text-secondary hover:bg-surface-low transition-colors"
          >
            <span className="material-symbols-outlined text-[20px]" aria-hidden="true">
              arrow_back
            </span>
          </button>
        ) : null}
        <div className="flex-1 min-w-0">
          <Breadcrumbs items={breadcrumbs} />
        </div>
      </div>

      <div className="mb-stack-lg">
        <h2 className="font-headline-lg text-headline-lg text-text-primary mb-1 break-words">
          {node ? node.name : isRoot ? "Library" : "Folder"}
        </h2>
        <p className="text-body-md text-text-secondary">Browse the files available in this folder.</p>
      </div>

      <SlowLoadNotice active={loading && !data} onRetry={reload} />
      {error && data ? (
        <RefreshErrorBanner message="Couldn't refresh this folder." onRetry={reload} />
      ) : null}

      {state === LOAD_STATES.LOADING && showSkeleton ? (
        <div className="space-y-4">
          <Skeleton type="row" count={1} label="Loading folder" />
          <Skeleton type="card" count={4} />
        </div>
      ) : state === LOAD_STATES.LOADING ? (
        <div className="min-h-[12rem]" aria-busy="true" />
      ) : state === LOAD_STATES.ERROR ? (
        errorStatus === 404 ? (
          <NotFoundState title="Folder not found" message={error} />
        ) : (
          <ErrorState
            error={{ status: errorStatus, message: error, details: errorDetails }}
            onRetry={reload}
            onBack={handleBack}
            preserveHint={data ? "This folder's previous contents are still visible." : undefined}
          />
        )
      ) : state === LOAD_STATES.EMPTY ? (
        <EmptyState
          icon="folder_open"
          title={isRoot ? "This library has no content yet" : "This folder is empty"}
          description={
            isRoot
              ? "When administrators add folders and files, they will appear here."
              : "Nothing has been published in this folder yet. Go back and try another folder."
          }
          action={
            isRoot ? (
              <Button icon="search" onClick={function () { navigate("/search"); }}>
                Search notes
              </Button>
            ) : (
              <Button variant="secondary" icon="arrow_back" onClick={handleBack}>
                Go back
              </Button>
            )
          }
        />
      ) : (
        <div className="space-y-8">
          {folders.length > 0 ? (
            <div>
              <h3 className="font-headline-sm text-headline-sm text-text-primary mb-4">Folders</h3>
              <FolderGrid folders={folders} />
            </div>
          ) : null}
          {files.length > 0 ? (
            <div>
              <h3 className="font-headline-sm text-headline-sm text-text-primary mb-4">Files</h3>
              <MaterialGrid files={files} />
            </div>
          ) : null}
        </div>
      )}
    </AppShell>
  );
}
