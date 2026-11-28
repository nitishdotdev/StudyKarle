import React, { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import AppShell from "../components/layout/AppShell";
import SearchResultItem from "../components/search/SearchResultItem";
import Pagination from "../components/common/Pagination";
import Skeleton from "../components/common/Skeleton";
import ErrorState from "../components/common/ErrorState";
import EmptyState from "../components/common/EmptyState";
import Input from "../components/common/Input";
import Button from "../components/common/Button";
import SlowLoadNotice from "../components/common/SlowLoadNotice";
import RefreshErrorBanner from "../components/common/RefreshErrorBanner";
import useDelayedFlag from "../hooks/useDelayedFlag";
import { searchNotes } from "../api/notesApi";
import {
  classifySearchState,
  SEARCH_STATES,
  SEARCH_TOPICS,
  suggestCorrection,
  topicSuggestions,
} from "../utils/searchSuggest";

function readFilters(params) {
  const kind = params.get("kind") === "file" || params.get("kind") === "folder" ? params.get("kind") : "";
  const year = params.get("year") === "1" || params.get("year") === "2" ? params.get("year") : "";
  const type = params.get("type") === "pdf" ? "pdf" : "";
  return { kind: kind, year: year, type: type };
}

function toSearchParams(query, page, filters) {
  const next = { q: query };
  if (page && page > 1) next.page = String(page);
  if (filters.kind) next.kind = filters.kind;
  if (filters.year) next.year = filters.year;
  if (filters.type) next.type = filters.type;
  return next;
}

export default function SearchPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const query = (searchParams.get("q") || "").trim();
  const page = Math.max(1, parseInt(searchParams.get("page"), 10) || 1);
  const filters = readFilters(searchParams);
  const [inputValue, setInputValue] = useState(query);
  const pendingInput = useRef(null);
  const [attempt, setAttempt] = useState(0);
  const requestKey = toSearchParams(query, page, filters);
  const resultKey = new URLSearchParams(requestKey).toString();
  const [lastResult, setResult] = useState(null);
  const result = lastResult?.key === resultKey ? lastResult : null;
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [errorStatus, setErrorStatus] = useState(null);
  const [highlight, setHighlight] = useState(-1);
  const [showSuggest, setShowSuggest] = useState(false);
  const showSkeleton = useDelayedFlag(loading && !result, 200);

  const keyboardSuggestions = useMemo(
    function () {
      return topicSuggestions(inputValue, SEARCH_TOPICS, 6);
    },
    [inputValue]
  );

  useEffect(function () {
    setInputValue(query);
    return function () { window.clearTimeout(pendingInput.current); };
  }, [searchParams]);

  useEffect(
    function () {
      if (!query) {
        setResult(null);
        setError(null);
        setLoading(false);
        return;
      }
      const controller = new AbortController();
      setLoading(true);
      setError(null);
      setErrorStatus(null);
      searchNotes(query, page, controller.signal, filters)
        .then(function (data) {
          if (controller.signal.aborted) return;
          setResult({ ...data, key: resultKey });
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
    [resultKey, attempt]
  );

  const items = (result && (result.items || result.notes)) || [];
  const state = classifySearchState({
    query: query,
    loading: loading,
    error: error,
    results: result,
  });
  const serverSuggestion = result && result.meta && result.meta.suggestion;
  const suggestion = useMemo(
    function () {
      if (state !== SEARCH_STATES.NO_RESULTS) {
        return null;
      }
      return serverSuggestion || suggestCorrection(query, SEARCH_TOPICS);
    },
    [state, query, serverSuggestion]
  );

  function retrySearch() {
    setAttempt((previous) => previous + 1);
  }

  function submitQuery(value, replace = false) {
    window.clearTimeout(pendingInput.current);
    setInputValue(value);
    setSearchParams(toSearchParams(value.trim(), 1, filters), { replace });
  }

  function editQuery(value) {
    window.clearTimeout(pendingInput.current);
    setInputValue(value);
    if (value.trim() !== query) {
      pendingInput.current = window.setTimeout(function () {
        submitQuery(value, true);
      }, 400);
    }
  }

  function applyFilter(key, value) {
    window.clearTimeout(pendingInput.current);
    const next = { ...filters, [key]: filters[key] === value ? "" : value };
    setSearchParams(toSearchParams(inputValue.trim(), 1, next));
  }

  function onSearchKeyDown(event) {
    if (!showSuggest || !keyboardSuggestions.length) {
      if (event.key === "Escape") setShowSuggest(false);
      if (event.key === "Enter") submitQuery(inputValue);
      return;
    }
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setHighlight(function (i) {
        return Math.min(i + 1, keyboardSuggestions.length - 1);
      });
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setHighlight(function (i) {
        return Math.max(i - 1, 0);
      });
    } else if (event.key === "Enter") {
      event.preventDefault();
      submitQuery(keyboardSuggestions[highlight] || inputValue);
      setShowSuggest(false);
      setHighlight(-1);
    } else if (event.key === "Escape") {
      setShowSuggest(false);
      setHighlight(-1);
    }
  }

  function filterChip(active) {
    return (
      "min-h-[36px] px-3 rounded-full border text-body-sm font-medium transition-colors " +
      (active
        ? "bg-primary text-white border-primary"
        : "bg-white text-text-secondary border-border-subtle hover:bg-surface-low")
    );
  }

  return (
    <AppShell>
      <h1 className="mb-4 font-headline-lg text-headline-lg text-text-primary">Search library</h1>

      <div className="relative max-w-xl mb-4">
        <Input
          id="search-input"
          icon="search"
          aria-label="Search notes, files, and folders"
          placeholder="Search notes, files, folders..."
          value={inputValue}
          autoComplete="off"
          role="combobox"
          aria-expanded={showSuggest && keyboardSuggestions.length > 0}
          aria-controls="search-suggest-list"
          aria-activedescendant={
            highlight >= 0 ? "search-suggest-" + highlight : undefined
          }
          onFocus={function () {
            setShowSuggest(true);
          }}
          onBlur={function () {
            window.setTimeout(function () {
              setShowSuggest(false);
            }, 120);
          }}
          onKeyDown={onSearchKeyDown}
          onChange={function (e) {
            editQuery(e.target.value);
            setShowSuggest(true);
            setHighlight(-1);
          }}
        />
        {showSuggest && keyboardSuggestions.length ? (
          <ul
            id="search-suggest-list"
            role="listbox"
            className="absolute z-20 mt-1 w-full bg-white border border-border-subtle rounded-lg shadow-md overflow-hidden"
          >
            {keyboardSuggestions.map(function (topic, index) {
              return (
                <li key={topic} role="option" id={"search-suggest-" + index} aria-selected={index === highlight}>
                  <button
                    type="button"
                    className={
                      "w-full text-left px-4 py-2.5 text-body-sm " +
                      (index === highlight ? "bg-surface-low text-primary" : "text-text-primary")
                    }
                    onMouseDown={function (event) {
                      event.preventDefault();
                      submitQuery(topic);
                      setShowSuggest(false);
                      setHighlight(-1);
                    }}
                  >
                    {topic}
                  </button>
                </li>
              );
            })}
          </ul>
        ) : null}
      </div>

      <div className="flex flex-wrap gap-2 mb-stack-lg" aria-label="Search filters">
        <button type="button" aria-pressed={filters.kind === "file"} className={filterChip(filters.kind === "file")} onClick={function () { applyFilter("kind", "file"); }}>
          Files
        </button>
        <button type="button" aria-pressed={filters.kind === "folder"} className={filterChip(filters.kind === "folder")} onClick={function () { applyFilter("kind", "folder"); }}>
          Folders
        </button>
        <button type="button" aria-pressed={filters.year === "1"} className={filterChip(filters.year === "1")} onClick={function () { applyFilter("year", "1"); }}>
          Year 1
        </button>
        <button type="button" aria-pressed={filters.year === "2"} className={filterChip(filters.year === "2")} onClick={function () { applyFilter("year", "2"); }}>
          Year 2
        </button>
        <button type="button" aria-pressed={filters.type === "pdf"} className={filterChip(filters.type === "pdf")} onClick={function () { applyFilter("type", "pdf"); }}>
          PDF
        </button>
      </div>

      <SlowLoadNotice active={loading && !result} onRetry={retrySearch} />
      {error && result && result.query === query && items.length ? (
        <RefreshErrorBanner message="Couldn't refresh search results." onRetry={retrySearch} />
      ) : null}

      {state === SEARCH_STATES.IDLE ? (
        <EmptyState
          icon="search"
          title="Start typing to search"
          description="Find Drive files, folders, and published notes. You can also browse the library if you prefer to look around."
          actionTo="/drive"
          actionLabel="Browse library"
        />
      ) : state === SEARCH_STATES.LOADING && showSkeleton ? (
        <Skeleton type="row" count={4} label="Searching library" />
      ) : state === SEARCH_STATES.LOADING ? (
        <div className="min-h-[8rem]" aria-busy="true" />
      ) : state === SEARCH_STATES.ERROR ? (
        <ErrorState
          title="Couldn't search the library"
          error={{ status: errorStatus, message: error }}
          onRetry={retrySearch}
          preserveHint={
            result && result.query === query.trim()
              ? "Previous search results are still on screen."
              : undefined
          }
        />
      ) : state === SEARCH_STATES.NO_RESULTS ? (
        <EmptyState
          icon="search_off"
          title={'No exact matches for "' + query + '"'}
          description="Try a shorter phrase, check the spelling, or browse the library."
          action={
            <div className="flex flex-col items-center gap-3">
              {suggestion ? (
                <Button
                  icon="search"
                  onClick={function () {
                    submitQuery(suggestion);
                  }}
                >
                  Did you mean {suggestion}
                </Button>
              ) : null}
              <Button
                variant="secondary"
                onClick={function () {
                  submitQuery("");
                }}
              >
                Clear search
              </Button>
              <Button
                variant="ghost"
                icon="folder_open"
                onClick={function () {
                  navigate("/drive");
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
            {result.meta.total} results found for "{query}"
          </p>
          <div className="space-y-4">
            {items.map(function (item) {
              const key = item.source === "drive" ? "drive-" + item.nodeId : "note-" + item.id;
              return <SearchResultItem key={key} item={item} />;
            })}
          </div>
          <Pagination page={page} totalPages={result.meta.totalPages} onChange={(nextPage) => setSearchParams(toSearchParams(query, nextPage, filters))} />
        </React.Fragment>
      )}
    </AppShell>
  );
}
