import React from "react";
import { Link } from "react-router-dom";
import AppShell from "../components/layout/AppShell";
import FolderGrid from "../components/drive/FolderGrid";
import MaterialGrid from "../components/drive/MaterialGrid";
import Skeleton from "../components/common/Skeleton";
import ErrorState from "../components/common/ErrorState";
import EmptyState from "../components/common/EmptyState";
import NotFoundState from "../components/common/NotFoundState";
import useFetch from "../hooks/useFetch";
import useAuth from "../hooks/useAuth";
import { fetchDriveRoot } from "../api/driveApi";

function Icon({ name, className = "" }) {
  return (
    <span
      aria-hidden="true"
      className={`material-symbols-outlined leading-none ${className}`}
    >
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

// The Dashboard is a live mirror of the canonical content tree root. It reads
// the exact root children (folders + files) from /api/drive and links every
// folder/file by its stable node id, so the tree renders exactly as it exists —
// no flattening, guessing, or fixed academic structure.
export default function DashboardPage() {
  const { user } = useAuth();
  const { data, loading, error, errorStatus, reload } = useFetch(
    fetchDriveRoot,
    []
  );

  const folders = data ? data.folders || [] : [];
  const files = data ? data.files || [] : [];

  return (
    <AppShell>
      {/* Welcome Header */}
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
            <p className="mt-2 text-body-lg text-text-secondary">
              What will you learn today?
            </p>
          </div>

          <Link
            to="/search"
            className="inline-flex shrink-0 items-center gap-2 self-start rounded-lg border border-border-subtle bg-white px-5 py-2.5 font-label-md text-label-md text-text-primary shadow-sm transition-all hover:bg-surface-container-low sm:self-auto"
          >
            <Icon name="search" className="text-[18px]" />
            Search resources
          </Link>
        </div>
      </section>

      {/* Library — exact root content from the canonical tree */}
      <section>
        <div className="mb-6 flex items-end justify-between gap-4">
          <div>
            <h2 className="font-headline-lg text-headline-lg text-text-primary">
              Browse Library
            </h2>
            <p className="mt-1 text-body-md text-text-secondary">
              Explore the folders and files in your library.
            </p>
          </div>
        </div>

        {loading ? (
          <div className="space-y-8">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-gutter">
              <Skeleton type="card" count={4} />
            </div>
          </div>
        ) : error ? (
          errorStatus === 404 ? (
            <NotFoundState title="Library not found" message={error} />
          ) : (
            <ErrorState message={error} onRetry={reload} />
          )
        ) : folders.length === 0 && files.length === 0 ? (
          <EmptyState
            icon="folder_open"
            title="Your library is empty"
            description="Folders and files added to your library will appear here."
            action={
              <Link to="/search">
                <button
                  type="button"
                  className="inline-flex items-center gap-2 rounded-lg bg-primary px-6 py-2.5 font-label-md text-label-md text-white transition-all hover:bg-primary-container"
                >
                  <Icon name="search" className="text-[18px]" />
                  Search resources
                </button>
              </Link>
            }
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
      </section>
    </AppShell>
  );
}
