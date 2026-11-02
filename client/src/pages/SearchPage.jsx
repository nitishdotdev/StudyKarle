import React, { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import AppShell from "../components/layout/AppShell";
import NoteListItem from "../components/notes/NoteListItem";
import Pagination from "../components/common/Pagination";
import Skeleton from "../components/common/Skeleton";
import ErrorState from "../components/common/ErrorState";
import EmptyState from "../components/common/EmptyState";
import Input from "../components/common/Input";
import Button from "../components/common/Button";
import SlowLoadNotice from "../components/common/SlowLoadNotice";
import RefreshErrorBanner from "../components/common/RefreshErrorBanner";
import useDebounce from "../hooks/useDebounce";
import useDelayedFlag from "../hooks/useDelayedFlag";
import { searchNotes } from "../api/notesApi";
import {
  classifySearchState,
  SEARCH_STATES,
  SEARCH_TOPICS,
  suggestCorrection,
} from "../utils/searchSuggest";

export default function SearchPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const initialQuery = searchParams.get("q") || "";
  const [inputValue, setInputValue] = useState(initialQuery);
  const debouncedQuery = useDebounce(inputValue, 400);
  const [page, setPage] = useState(1);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [errorStatus, setErrorStatus] = useState(null);
  const showSkeleton = useDelayedFlag(loading && !result, 200);

  useEffect(
    function () {
      if (!debouncedQuery.trim()) {
        setResult(null);
        setError(null);
        setSearchParams({});
        return;
      }
      setSearchParams({ q: debouncedQuery });
      setPage(1);
      // eslint-disable-next-line react-hooks/exhaustive-deps
    },
    [debouncedQuery]
  );

  useEffect(
    function () {
      const query = debouncedQuery.trim();
      if (!query) {
        return;
      }
      const controller = new AbortController();
      setLoading(true);
      setError(null);
      setErrorStatus(null);
      searchNotes(query, page, controller.signal)
        .then(function (data) {
          if (controller.signal.aborted) return;
          setResult(Object.assign({}, data, { query: query }));
        })
        .catch(function (err) {
          if (controller.signal.aborted) return;
          setError(err.message || "Couldn't search notes");
          setErrorStatus(err.status || 0);
        })
        .finally(function () {
          if (!controller.signal.aborted) {
            setLoading(false);
          }
        });
      return function () {
        controller.abort();
      };
    },
    [debouncedQuery, page]
  );

  const state = classifySearchState({
    query: debouncedQuery,
    loading: loading,
    error: error,
    results: result,
  });
  const suggestion = useMemo(
    function () {
      if (state !== SEARCH_STATES.NO_RESULTS) {
        return null;
      }
      return suggestCorrection(debouncedQuery, SEARCH_TOPICS);
    },
    [state, debouncedQuery]
  );

  function retrySearch() {
    const query = debouncedQuery.trim();
    if (!query) {
      return;
    }
    setError(null);
    setLoading(true);
    searchNotes(query, page)
      .then(function (data) {
        setResult(Object.assign({}, data, { query: query }));
      })
      .catch(function (err) {
        setError(err.message || "Couldn't search notes");
        setErrorStatus(err.status || 0);
      })
      .finally(function () {
        setLoading(false);
      });
  }

  return (
    <AppShell>
      <div className="mb-stack-lg">
        <h2 className="font-headline-lg text-headline-lg text-text-primary mb-1">Search Notes</h2>
        <p className="text-body-md text-text-secondary">
          Search across all notes, subjects and topics.
        </p>
      </div>

      <Input
        id="search-input"
        icon="search"
        label="Search notes and subjects"
        placeholder="Search notes, subjects..."
        value={inputValue}
        onChange={function (e) {
          setInputValue(e.target.value);
        }}
        className="max-w-xl mb-stack-lg"
      />

      <SlowLoadNotice active={loading && !result} onRetry={retrySearch} />
      {error &&
      result &&
      result.query === debouncedQuery.trim() &&
      result.notes &&
      result.notes.length ? (
        <RefreshErrorBanner message="Couldn't refresh search results." onRetry={retrySearch} />
      ) : null}

      {state === SEARCH_STATES.IDLE ? (
        <EmptyState
          icon="search"
          title="Start typing to search"
          description="Find notes by title, subject, or description. You can also browse the library if you prefer to look around."
          actionTo="/dashboard"
          actionLabel="Browse library"
        />
      ) : state === SEARCH_STATES.LOADING && showSkeleton ? (
        <Skeleton type="row" count={4} label="Searching notes" />
      ) : state === SEARCH_STATES.LOADING ? (
        <div className="min-h-[8rem]" aria-busy="true" />
      ) : state === SEARCH_STATES.ERROR ? (
        <ErrorState
          title="Couldn't search notes"
          error={{ status: errorStatus, message: error }}
          onRetry={retrySearch}
          preserveHint={
            result && result.query === debouncedQuery.trim()
              ? "Previous search results are still on screen."
              : undefined
          }
        />
      ) : state === SEARCH_STATES.NO_RESULTS ? (
        <EmptyState
          icon="search_off"
          title={'No exact matches for "' + debouncedQuery + '"'}
          description="Try a shorter phrase, check the spelling, or browse the library."
          action={
            <div className="flex flex-col items-center gap-3">
              {suggestion ? (
                <Button
                  icon="search"
                  onClick={function () {
                    setInputValue(suggestion);
                  }}
                >
                  Search for {suggestion}
                </Button>
              ) : null}
              <Button
                variant="secondary"
                onClick={function () {
                  setInputValue("");
                }}
              >
                Clear search
              </Button>
              <Button
                variant="ghost"
                icon="folder_open"
                onClick={function () {
                  navigate("/dashboard");
                }}
              >
                Browse library
              </Button>
            </div>
          }
        />
      ) : (
        <React.Fragment>
          <p className="text-body-md text-text-secondary mb-4">
            {result.meta.total} results found for "{debouncedQuery}"
          </p>
          <div className="space-y-4">
            {result.notes.map(function (note) {
              return <NoteListItem key={note.id} note={note} />;
            })}
          </div>
          <Pagination page={page} totalPages={result.meta.totalPages} onChange={setPage} />
        </React.Fragment>
      )}
    </AppShell>
  );
}
