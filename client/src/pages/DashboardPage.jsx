import React from "react";
import { Link } from "react-router-dom";
import AppShell from "../components/layout/AppShell";
import FolderGrid from "../components/drive/FolderGrid";
import MaterialGrid from "../components/drive/MaterialGrid";
import Skeleton from "../components/common/Skeleton";
import ErrorState from "../components/common/ErrorState";
import EmptyState from "../components/common/EmptyState";
import NotFoundState from "../components/common/NotFoundState";
import SlowLoadNotice from "../components/common/SlowLoadNotice";
import RefreshErrorBanner from "../components/common/RefreshErrorBanner";
import Button from "../components/common/Button";
import useFetch from "../hooks/useFetch";
import useAuth from "../hooks/useAuth";
import useDelayedFlag from "../hooks/useDelayedFlag";
import { fetchDriveRoot } from "../api/driveApi";
import { classifyLoadState, LOAD_STATES } from "../utils/uiState";

function Icon({ name, className = "" }) {
  return (
    <span aria-hidden="true" className={`material-symbols-outlined leading-none ${className}`}>
      {name}
    </span>
  );
}

function getGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

export default function DashboardPage() {
  const { user } = useAuth();
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
      <section className="relative mb-10 overflow-hidden rounded-[1.75rem] border border-border-subtle bg-white p-7 sm:p-9">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-primary/10 blur-3xl"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -bottom-20 left-1/3 h-48 w-48 rounded-full bg-secondary/10 blur-3xl"
        />

        <div className="relative z-10 flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-label-sm font-semibold uppercase tracking-[0.14em] text-primary">
              {getGreeting()}
            </p>
            <h1 className="mt-2 font-headline-xl text-headline-xl text-text-primary">
              Welcome back{user ? `, ${user.name.split(" ")[0]}` : ""}!
            </h1>
            <p className="mt-2 text-body-lg text-text-secondary">What will you learn today?</p>
          </div>

          <Link
            to="/search"
            className="inline-flex min-h-[44px] shrink-0 items-center gap-2 self-start rounded-lg border border-border-subtle bg-white px-5 py-2.5 font-label-md text-label-md text-text-primary shadow-sm transition-all hover:bg-surface-container-low sm:self-auto"
          >
            <Icon name="search" className="text-[18px]" />
            Search resources
          </Link>
        </div>
      </section>

      <section>
        <div className="mb-6 flex items-end justify-between gap-4">
          <div>
            <h2 className="font-headline-lg text-headline-lg text-text-primary">Browse Library</h2>
            <p className="mt-1 text-body-md text-text-secondary">
              Explore the folders and files in your library.
            </p>
          </div>
        </div>

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
    </AppShell>
  );
}
