import React, { useEffect, useMemo, useState } from "react";
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
import useDebounce from "../hooks/useDebounce";
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
  const initialQuery = searchParams.get("q") || "";
  const initialPage = Math.max(1, parseInt(searchParams.get("page"), 10) || 1);
  const [inputValue, setInputValue] = useState(initialQuery);
  const debouncedQuery = useDebounce(inputValue, 400);
  const [page, setPage] = useState(initialPage);
  const [filters, setFilters] = useState(function () {
    return readFilters(searchParams);
  });
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [errorStatus, setErrorStatus] = useState(null);
  const [highlight, setHighlight] = useState(-1);
  const [showSuggest, setShowSuggest] = useState(false);
  const lastQueryRef = React.useRef(initialQuery.trim());
  const showSkeleton = useDelayedFlag(loading && !result, 200);

  const keyboardSuggestions = useMemo(
    function () {
      return topicSuggestions(inputValue, SEARCH_TOPICS, 6);
    },
    [inputValue]
  );

  useEffect(
    function () {
      const query = debouncedQuery.trim();
      if (!query) {
        lastQueryRef.current = "";
        setResult(null);
        setError(null);
        setPage(1);
        setSearchParams({});
        return;
      }
      let pageToUse = page;
      if (lastQueryRef.current !== query) {
        lastQueryRef.current = query;
        pageToUse = 1;
        if (page !== 1) setPage(1);
      }
      setSearchParams(toSearchParams(query, pageToUse, filters));
      const controller = new AbortController();
      setLoading(true);
      setError(null);
      setErrorStatus(null);
      searchNotes(query, pageToUse, controller.signal, filters)
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
    [debouncedQuery, page, filters.kind, filters.year, filters.type]
  );

  const items = (result && (result.items || result.notes)) || [];
  const state = classifySearchState({
    query: debouncedQuery,
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
      return serverSuggestion || suggestCorrection(debouncedQuery, SEARCH_TOPICS);
    },
    [state, debouncedQuery, serverSuggestion]
  );

  function retrySearch() {
    const query = debouncedQuery.trim();
    if (!query) {
      return;
    }
    setError(null);
    setLoading(true);
    searchNotes(query, page, undefined, filters)
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

  function applyFilter(key, value) {
    setFilters(function (prev) {
      const next = Object.assign({}, prev);
      next[key] = prev[key] === value ? "" : value;
      return next;
    });
    setPage(1);
  }

  function onSearchKeyDown(event) {
    if (!showSuggest || !keyboardSuggestions.length) {
      if (event.key === "Escape") setShowSuggest(false);
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
    } else if (event.key === "Enter" && highlight >= 0) {
      event.preventDefault();
      setInputValue(keyboardSuggestions[highlight]);
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
      <div className="mb-stack-lg">
        <h2 className="font-headline-lg text-headline-lg text-text-primary mb-1">Search library</h2>
        <p className="text-body-md text-text-secondary">
          Search Drive files, folders, and published notes.
        </p>
      </div>

      <div className="relative max-w-xl mb-4">
        <Input
          id="search-input"
          icon="search"
          label="Search notes, files, and folders"
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
            setInputValue(e.target.value);
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
                      setInputValue(topic);
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
        <button type="button" className={filterChip(filters.kind === "file")} onClick={function () { applyFilter("kind", "file"); }}>
          Files
        </button>
        <button type="button" className={filterChip(filters.kind === "folder")} onClick={function () { applyFilter("kind", "folder"); }}>
          Folders
        </button>
        <button type="button" className={filterChip(filters.year === "1")} onClick={function () { applyFilter("year", "1"); }}>
          Year 1
        </button>
        <button type="button" className={filterChip(filters.year === "2")} onClick={function () { applyFilter("year", "2"); }}>
          Year 2
        </button>
        <button type="button" className={filterChip(filters.type === "pdf")} onClick={function () { applyFilter("type", "pdf"); }}>
          PDF
        </button>
      </div>

      <SlowLoadNotice active={loading && !result} onRetry={retrySearch} />
      {error && result && result.query === debouncedQuery.trim() && items.length ? (
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
                  Did you mean {suggestion}
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
            {result.meta.total} results found for "{debouncedQuery}"
          </p>
          <div className="space-y-4">
            {items.map(function (item) {
              const key = item.source === "drive" ? "drive-" + item.nodeId : "note-" + item.id;
              return <SearchResultItem key={key} item={item} />;
            })}
          </div>
          <Pagination page={page} totalPages={result.meta.totalPages} onChange={setPage} />
        </React.Fragment>
      )}
    </AppShell>
  );
}
