export const SEARCH_TOPICS = [
  "binary tree",
  "linked list",
  "data structures",
  "operating systems",
  "computer networks",
  "database management",
  "digital electronics",
  "engineering mathematics",
  "thermodynamics",
  "fluid mechanics",
  "strength of materials",
  "object oriented programming",
  "compiler design",
  "theory of computation",
  "microprocessors",
  "software engineering",
];

export const SEARCH_STATES = {
  IDLE: "idle",
  LOADING: "loading",
  ERROR: "error",
  NO_RESULTS: "no_results",
  RESULTS: "results",
};

function resultsMatchQuery(results, query) {
  if (!results) {
    return false;
  }
  const resultQuery = results.query;
  if (resultQuery == null) {
    return true;
  }
  return String(resultQuery).trim() === query;
}

export function classifySearchState(input) {
  const query = String((input && input.query) || "").trim();
  if (!query) {
    return SEARCH_STATES.IDLE;
  }
  const results = input && input.results;
  const items = (results && (results.items || results.notes)) || null;
  const matchesQuery = resultsMatchQuery(results, query);
  if (input && input.loading) {
    if (matchesQuery && items && items.length) {
      return SEARCH_STATES.RESULTS;
    }
    return SEARCH_STATES.LOADING;
  }
  if (input && input.error) {
    if (matchesQuery && items && items.length) {
      return SEARCH_STATES.RESULTS;
    }
    return SEARCH_STATES.ERROR;
  }
  if (!matchesQuery) {
    return SEARCH_STATES.LOADING;
  }
  if (!items) {
    return SEARCH_STATES.LOADING;
  }
  if (!items.length) {
    return SEARCH_STATES.NO_RESULTS;
  }
  return SEARCH_STATES.RESULTS;
}

function normalize(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokens(value) {
  return normalize(value).split(" ").filter(Boolean);
}

function levenshtein(a, b) {
  if (a === b) {
    return 0;
  }
  if (!a.length) {
    return b.length;
  }
  if (!b.length) {
    return a.length;
  }
  const rows = [];
  for (let i = 0; i <= b.length; i++) {
    rows[i] = [i];
  }
  for (let j = 0; j <= a.length; j++) {
    rows[0][j] = j;
  }
  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      const cost = a[j - 1] === b[i - 1] ? 0 : 1;
      rows[i][j] = Math.min(
        rows[i - 1][j] + 1,
        rows[i][j - 1] + 1,
        rows[i - 1][j - 1] + cost
      );
    }
  }
  return rows[b.length][a.length];
}

export function suggestCorrection(query, corpus) {
  const q = normalize(query);
  if (!q || !Array.isArray(corpus) || !corpus.length) {
    return null;
  }
  if (q.length <= 3) {
    return null;
  }
  let best = null;
  let bestScore = Infinity;
  for (let i = 0; i < corpus.length; i++) {
    const candidate = String(corpus[i] || "").trim();
    const n = normalize(candidate);
    if (!n || n === q) {
      continue;
    }
    const distance = levenshtein(q, n);
    const tokenOverlap = tokens(q).filter(function (t) {
      return n.indexOf(t) !== -1 || tokens(n).some(function (ct) {
        return levenshtein(t, ct) <= 1;
      });
    }).length;
    const maxLen = Math.max(q.length, n.length);
    const allowed = maxLen <= 12 ? 2 : 3;
    if (distance === 0 || distance > allowed) {
      continue;
    }
    const score = distance - tokenOverlap * 0.25;
    if (score < bestScore) {
      bestScore = score;
      best = candidate;
    }
  }
  return best;
}

export function topicSuggestions(query, corpus, limit) {
  const q = normalize(query);
  const rows = Array.isArray(corpus) ? corpus : [];
  if (!q) {
    return rows.slice(0, limit || 6);
  }
  const scored = [];
  for (let i = 0; i < rows.length; i++) {
    const candidate = String(rows[i] || "").trim();
    const n = normalize(candidate);
    if (!n || n === q) {
      continue;
    }
    let rank = 0;
    if (n.startsWith(q)) rank = 3;
    else if (n.indexOf(q) !== -1) rank = 2;
    else if (tokens(q).every(function (t) {
      return n.indexOf(t) !== -1;
    })) rank = 1;
    if (rank) {
      scored.push({ candidate: candidate, rank: rank, length: n.length });
    }
  }
  scored.sort(function (a, b) {
    if (b.rank !== a.rank) return b.rank - a.rank;
    return a.length - b.length;
  });
  return scored.slice(0, limit || 6).map(function (row) {
    return row.candidate;
  });
}
