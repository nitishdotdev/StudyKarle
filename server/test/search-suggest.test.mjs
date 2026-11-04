import test from "node:test";
import assert from "node:assert/strict";
import {
  classifySearchState,
  suggestCorrection,
  topicSuggestions,
  SEARCH_STATES,
} from "../../client/src/utils/searchSuggest.js";

test("classifySearchState keeps idle, loading, error, empty, and results distinct", () => {
  assert.equal(
    classifySearchState({ query: "", loading: false, error: null, results: null }),
    SEARCH_STATES.IDLE
  );
  assert.equal(
    classifySearchState({ query: "trees", loading: true, error: null, results: null }),
    SEARCH_STATES.LOADING
  );
  assert.equal(
    classifySearchState({
      query: "trees",
      loading: false,
      error: "Couldn't search",
      results: null,
    }),
    SEARCH_STATES.ERROR
  );
  assert.equal(
    classifySearchState({
      query: "trees",
      loading: false,
      error: null,
      results: { notes: [], meta: { total: 0 } },
    }),
    SEARCH_STATES.NO_RESULTS
  );
  assert.equal(
    classifySearchState({
      query: "trees",
      loading: false,
      error: null,
      results: { notes: [{ id: 1 }], meta: { total: 1 } },
    }),
    SEARCH_STATES.RESULTS
  );
});

test("classifySearchState keeps previous results when a refresh fails", () => {
  assert.equal(
    classifySearchState({
      query: "trees",
      loading: false,
      error: "Couldn't search",
      results: { notes: [{ id: 1 }], meta: { total: 1 } },
    }),
    SEARCH_STATES.RESULTS
  );
});

test("classifySearchState does not treat a failed search as no results", () => {
  assert.notEqual(
    classifySearchState({
      query: "trees",
      loading: false,
      error: "Couldn't search",
      results: { notes: [], meta: { total: 0 } },
    }),
    SEARCH_STATES.NO_RESULTS
  );
});

test("classifySearchState does not label a previous query's hits as the current query", () => {
  assert.equal(
    classifySearchState({
      query: "operating systems",
      loading: true,
      error: null,
      results: {
        query: "trees",
        notes: [{ id: 1 }],
        meta: { total: 1 },
      },
    }),
    SEARCH_STATES.LOADING
  );
  assert.equal(
    classifySearchState({
      query: "operating systems",
      loading: false,
      error: null,
      results: {
        query: "trees",
        notes: [{ id: 1 }],
        meta: { total: 1 },
      },
    }),
    SEARCH_STATES.LOADING
  );
});

test("suggestCorrection offers a close corpus match without silently replacing the query", () => {
  const suggestion = suggestCorrection("binarry tree", [
    "binary tree",
    "linked list",
    "operating systems",
  ]);
  assert.equal(suggestion, "binary tree");
});

test("suggestCorrection does not rewrite short abbreviations or exact matches", () => {
  assert.equal(suggestCorrection("os", ["operating systems", "os"]), null);
  assert.equal(suggestCorrection("DSA", ["data structures"]), null);
  assert.equal(suggestCorrection("binary tree", ["binary tree"]), null);
});

test("suggestCorrection returns null when nothing reliable is close", () => {
  assert.equal(
    suggestCorrection("quantum chromodynamics homework", ["binary tree", "calculus"]),
    null
  );
});

test("classifySearchState accepts items as well as notes", () => {
  assert.equal(
    classifySearchState({
      query: "os",
      loading: false,
      error: null,
      results: { query: "os", items: [{ nodeId: "os-pdf" }], meta: { total: 1 } },
    }),
    SEARCH_STATES.RESULTS
  );
});

test("topicSuggestions ranks prefix matches and never silently replaces the query", () => {
  const rows = topicSuggestions("oper", ["operating systems", "computer networks", "thermodynamics"], 4);
  assert.equal(rows[0], "operating systems");
  assert.equal(rows.indexOf("oper"), -1);
});
