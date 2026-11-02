import React, { useEffect, useState } from "react";
import AppShell from "../components/layout/AppShell";
import NoteListItem from "../components/notes/NoteListItem";
import SavedFileItem from "../components/notes/SavedFileItem";
import Skeleton from "../components/common/Skeleton";
import ErrorState from "../components/common/ErrorState";
import EmptyState from "../components/common/EmptyState";
import SlowLoadNotice from "../components/common/SlowLoadNotice";
import RefreshErrorBanner from "../components/common/RefreshErrorBanner";
import Button from "../components/common/Button";
import { Link } from "react-router-dom";
import useFetch from "../hooks/useFetch";
import useAuth from "../hooks/useAuth";
import useDelayedFlag from "../hooks/useDelayedFlag";
import { fetchSavedNotes } from "../api/savedApi";
import { classifyLoadState, LOAD_STATES } from "../utils/uiState";
import {
  describeDataFreshness,
  putCachedNotes,
  readCachedNotes,
} from "../utils/offlineNoteCache";

export default function SavedNotesPage() {
  const { user } = useAuth();
  const userId = user && user.id;
  const { data, loading, error, errorStatus, errorDetails, reload, refreshing } = useFetch(fetchSavedNotes, []);
  const [cached, setCached] = useState(function () {
    return readCachedNotes(user && user.id);
  });
  const showSkeleton = useDelayedFlag(loading && !data && !cached, 200);

  useEffect(
    function () {
      setCached(readCachedNotes(userId));
    },
    [userId]
  );

  useEffect(
    function () {
      if (!data || !userId) {
        return;
      }
      putCachedNotes(userId, data);
      setCached(null);
    },
    [data, userId]
  );

  const display = data || cached;
  const source = data ? "live" : cached ? "cached" : "live";
  const freshness = describeDataFreshness({ source: source });
  const notes = display ? display.notes || [] : [];
  const files = display ? display.files || [] : [];
  const state = classifyLoadState({
    loading: loading,
    error: error,
    hasData: !!display,
    isEmpty: notes.length === 0 && files.length === 0,
    refreshing: refreshing,
  });

  return (
    <AppShell>
      <div className="mb-stack-lg">
        <h2 className="font-headline-lg text-headline-lg text-text-primary mb-1">Saved</h2>
        <p className="text-body-md text-text-secondary">Everything you have saved for later.</p>
      </div>

      <SlowLoadNotice active={loading && !display} onRetry={reload} />
      {freshness.label ? (
        <p className="mb-4 text-body-sm text-text-secondary" role="status">
          {freshness.label} New pages, search, and downloads still need a connection.
        </p>
      ) : null}
      {error && display ? (
        <RefreshErrorBanner message="Couldn't refresh your saved files." onRetry={reload} />
      ) : null}

      {state === LOAD_STATES.LOADING && showSkeleton ? (
        <Skeleton type="row" count={4} label="Loading saved files" />
      ) : state === LOAD_STATES.LOADING ? (
        <div className="min-h-[12rem]" aria-busy="true" />
      ) : state === LOAD_STATES.ERROR ? (
        <ErrorState
          title="Couldn't load your saved files"
          error={{ status: errorStatus, message: error, details: errorDetails }}
          onRetry={reload}
          preserveHint={display ? "Your previously saved files are still on screen." : undefined}
        />
      ) : state === LOAD_STATES.EMPTY ? (
        <EmptyState
          icon="bookmark"
          title="Your study library is empty"
          description="Save useful notes here so you can find them quickly during revision."
          action={
            <Link to="/dashboard">
              <Button icon="dashboard">Explore notes</Button>
            </Link>
          }
        />
      ) : (
        <div className="space-y-4">
          {notes.map(function (note) {
            return <NoteListItem key={"note-" + note.id} note={note} />;
          })}
          {files.map(function (file) {
            return <SavedFileItem key={"file-" + file.driveId} file={file} />;
          })}
        </div>
      )}
    </AppShell>
  );
}
