import React from "react";
import { useNavigate, useParams } from "react-router-dom";
import AppShell from "../components/layout/AppShell";
import Breadcrumbs from "../components/common/Breadcrumbs";
import Skeleton from "../components/common/Skeleton";
import ErrorState from "../components/common/ErrorState";
import EmptyState from "../components/common/EmptyState";
import NotFoundState from "../components/common/NotFoundState";
import FolderGrid from "../components/drive/FolderGrid";
import MaterialGrid from "../components/drive/MaterialGrid";
import useFetch from "../hooks/useFetch";
import { fetchDriveRoot, fetchDriveFolder } from "../api/driveApi";

// Mirrors a Google Drive folder one-to-one. Serves BOTH the root listing
// (/drive) and any folder at arbitrary depth (/drive/folder/:nodeId) from the
// canonical drive_nodes tree. Each node is identified by its stable Drive id,
// so duplicate folder names at different locations stay distinct and mixed
// folders+files render exactly where they live in Drive.
export default function DriveBrowsePage() {
  const { nodeId } = useParams();
  const navigate = useNavigate();
  const isRoot = !nodeId;

  const { data, loading, error, errorStatus, reload } = useFetch(
    function () {
      return isRoot ? fetchDriveRoot() : fetchDriveFolder(nodeId);
    },
    [nodeId]
  );

  if (loading) {
    return (
      <AppShell>
        <div className="space-y-4">
          <Skeleton type="row" count={1} />
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-gutter">
            <Skeleton type="card" count={4} />
          </div>
        </div>
      </AppShell>
    );
  }

  if (error) {
    if (errorStatus === 404) {
      return (
        <AppShell>
          <NotFoundState title="Folder not found" message={error} />
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
  const parent = data.parent;
  const ancestors = data.ancestors || [];
  const folders = data.folders || [];
  const files = data.files || [];

  function handleBack() {
    // Navigate to the ACTUAL parent node returned by the API — never a
    // reconstruction of the path from the URL string.
    if (parent) {
      navigate("/drive/folder/" + parent.nodeId);
    } else {
      navigate("/drive");
    }
  }

  const breadcrumbs = [
    { label: "Library", to: isRoot ? undefined : "/drive" },
  ]
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
            className="shrink-0 w-9 h-9 rounded-lg border border-border-subtle bg-white flex items-center justify-center text-text-secondary hover:bg-surface-low transition-colors"
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
          {node.name}
        </h2>
        <p className="text-body-md text-text-secondary">
          Browse the files available in this folder.
        </p>
      </div>

      {folders.length === 0 && files.length === 0 ? (
        <EmptyState
          icon="folder_open"
          title="Empty folder"
          description="This folder has no content yet."
        />
      ) : (
        <div className="space-y-8">
          {folders.length > 0 && (
            <div>
              <h3 className="font-headline-sm text-headline-sm text-text-primary mb-4">
                Folders
              </h3>
              <FolderGrid folders={folders} />
            </div>
          )}

          {files.length > 0 && (
            <div>
              <h3 className="font-headline-sm text-headline-sm text-text-primary mb-4">
                Files
              </h3>
              <MaterialGrid files={files} />
            </div>
          )}
        </div>
      )}
    </AppShell>
  );
}
