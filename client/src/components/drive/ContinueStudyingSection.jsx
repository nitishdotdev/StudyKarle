import React from "react";
import { Link } from "react-router-dom";
import Button from "../common/Button";
import ContinueStudyingCard from "./ContinueStudyingCard";
import useAuth from "../../hooks/useAuth";
import useFetch from "../../hooks/useFetch";
import useDelayedFlag from "../../hooks/useDelayedFlag";
import { fetchContinueStudying } from "../../api/userApi";
import { classifyLoadState, LOAD_STATES } from "../../utils/uiState";
import { shouldShowContinueStudying } from "../../utils/continueStudying";

function CardSkeleton() {
  return (
    <div className="overflow-hidden rounded-xl border border-border-subtle bg-white" aria-hidden="true">
      <div className="aspect-[16/7] bg-surface-high motion-safe:animate-pulse" />
      <div className="space-y-2 px-4 py-3">
        <div className="h-4 w-3/4 rounded bg-surface-high motion-safe:animate-pulse" />
        <div className="h-3 w-1/2 rounded bg-surface-high motion-safe:animate-pulse" />
        <div className="h-3 w-2/5 rounded bg-surface-high motion-safe:animate-pulse" />
      </div>
      <div className="h-10 bg-surface-low motion-safe:animate-pulse" />
    </div>
  );
}

function ContinueStudyingPanel({ user }) {
  const userId = user && user.id;
  const { data, loading, error, reload } = useFetch(fetchContinueStudying, []);
  const items = data && Array.isArray(data.items) ? data.items.slice(0, 2) : [];
  const showSkeleton = useDelayedFlag(loading && !data, 200);
  const state = classifyLoadState({
    loading: loading,
    error: error,
    hasData: !!data,
    isEmpty: items.length === 0,
  });

  return (
    <section className="mt-10 rounded-[1.75rem] border border-border-subtle bg-white p-6 sm:p-8">
      <div className="mb-5">
        <h2 className="font-headline-lg text-headline-lg text-text-primary">Continue Studying</h2>
        <p className="mt-1 text-body-md text-text-secondary">Pick up right where you left off.</p>
      </div>

      {state === LOAD_STATES.LOADING && showSkeleton ? (
        <div
          className="grid grid-cols-1 gap-4 sm:grid-cols-2"
          role="status"
          aria-live="polite"
          aria-busy="true"
        >
          <span className="sr-only">Loading continue studying</span>
          <CardSkeleton />
          <CardSkeleton />
        </div>
      ) : state === LOAD_STATES.LOADING ? (
        <div className="min-h-[10rem]" aria-busy="true" />
      ) : state === LOAD_STATES.ERROR ? (
        <div
          role="alert"
          className="flex flex-col gap-3 rounded-lg border border-error/30 bg-error-container px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
        >
          <p className="text-body-sm text-text-primary">
            Couldn't load your recent study resources.
          </p>
          <Button variant="secondary" size="sm" icon="refresh" onClick={reload}>
            Retry
          </Button>
        </div>
      ) : state === LOAD_STATES.EMPTY ? (
        <div className="flex flex-col items-start gap-3 py-2">
          <h3 className="font-headline-md text-headline-md text-text-primary">
            Nothing to continue yet
          </h3>
          <p className="max-w-md text-body-sm text-text-muted">
            Open a study resource and it will appear here so you can pick up where you left off.
          </p>
          <Link to="/dashboard">
            <Button variant="secondary" size="sm">
              Browse Library
            </Button>
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {items.map(function (item) {
            return (
              <ContinueStudyingCard
                key={item.resourceType + ":" + item.resourceId}
                item={item}
                userId={userId}
              />
            );
          })}
        </div>
      )}
    </section>
  );
}

export default function ContinueStudyingSection() {
  const { user } = useAuth();
  if (!shouldShowContinueStudying(user)) {
    return null;
  }
  return <ContinueStudyingPanel user={user} />;
}
