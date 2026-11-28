import React from "react";
import { Link } from "react-router-dom";
import AppShell from "../components/layout/AppShell";
import FolderGrid from "../components/drive/FolderGrid";
import MaterialGrid from "../components/drive/MaterialGrid";
import ContinueStudyingSection from "../components/drive/ContinueStudyingSection";
import Skeleton from "../components/common/Skeleton";
import ErrorState from "../components/common/ErrorState";
import EmptyState from "../components/common/EmptyState";
import NotFoundState from "../components/common/NotFoundState";
import SlowLoadNotice from "../components/common/SlowLoadNotice";
import RefreshErrorBanner from "../components/common/RefreshErrorBanner";
import Button from "../components/common/Button";
import useFetch from "../hooks/useFetch";
import useDelayedFlag from "../hooks/useDelayedFlag";
import { fetchDriveRoot } from "../api/driveApi";
import { classifyLoadState, LOAD_STATES } from "../utils/uiState";

export default function DashboardPage() {
  const { data, loading, error, errorStatus, errorDetails, reload, refreshing } = useFetch(fetchDriveRoot, []);
  const showSkeleton = useDelayedFlag(loading && !data, 200);
  const folders = data ? data.folders || [] : [];
  const files = data ? data.files || [] : [];
  const state = classifyLoadState({
    loading: loading,
    error: error,
    hasData: !!data,
    isEmpty: folders.length === 0 && files.length === 0,
    refreshing: refreshing,
  });

  return (
    <AppShell>
      <section>
        <h1 className="mb-5 font-headline-lg text-headline-lg text-text-primary">Study library</h1>

        <SlowLoadNotice active={loading && !data} onRetry={reload} />
        {error && data ? (
          <RefreshErrorBanner message="Couldn't refresh your library." onRetry={reload} />
        ) : null}

        {state === LOAD_STATES.LOADING && showSkeleton ? (
          <Skeleton type="card" count={4} label="Loading your library" />
        ) : state === LOAD_STATES.LOADING ? (
          <div className="min-h-[12rem]" aria-busy="true" />
        ) : state === LOAD_STATES.ERROR ? (
          errorStatus === 404 ? (
            <NotFoundState title="Library not found" message={error} />
          ) : (
            <ErrorState
              error={{ status: errorStatus, message: error, details: errorDetails }}
              onRetry={reload}
              preserveHint={data ? "Your previously loaded library is still on screen." : undefined}
            />
          )
        ) : state === LOAD_STATES.EMPTY ? (
          <EmptyState
            icon="folder_open"
            title="Your study library is empty"
            description="Folders and files added by your administrators will appear here. Search if you already know a topic name."
            action={
              <Link to="/search">
                <Button icon="search">Explore notes</Button>
              </Link>
            }
          />
        ) : (
          <div className="space-y-8">
            {refreshing ? (
              <p className="sr-only" aria-live="polite">
                Refreshing library
              </p>
            ) : null}
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
      </section>

      <ContinueStudyingSection />
    </AppShell>
  );
}
