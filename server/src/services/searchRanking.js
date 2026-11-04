const yearScope = require("./yearScopeService");

function normalizeSearchText(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[_-]+/g, " ")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokens(value) {
  return normalizeSearchText(value).split(" ").filter(Boolean);
}

const MAX_LEVENSHTEIN_CHARS = 48;

function clippedLength(value) {
  let n = 0;
  for (let i = 0; i < MAX_LEVENSHTEIN_CHARS; i++) {
    if (value.charAt(i) === "") break;
    n = i + 1;
  }
  return n;
}

function levenshtein(a, b) {
  const left = String(a || "");
  const right = String(b || "");
  if (left === right) return 0;
  const prev = [];
  const curr = [];
  for (let j = 0; j <= MAX_LEVENSHTEIN_CHARS; j++) {
    prev[j] = j;
    curr[j] = 0;
  }
  for (let i = 1; i <= MAX_LEVENSHTEIN_CHARS; i++) {
    const rb = right.charAt(i - 1);
    if (rb === "") {
      return prev[clippedLength(left)];
    }
    curr[0] = i;
    for (let j = 1; j <= MAX_LEVENSHTEIN_CHARS; j++) {
      const la = left.charAt(j - 1);
      const cost = la === rb ? 0 : 1;
      curr[j] = Math.min(
        prev[j] + 1,
        curr[j - 1] + 1,
        prev[j - 1] + cost
      );
    }
    for (let j = 0; j <= MAX_LEVENSHTEIN_CHARS; j++) {
      prev[j] = curr[j];
    }
  }
  return prev[clippedLength(left)];
}

function acronym(value) {
  return tokens(value)
    .map(function (part) {
      return part.charAt(0);
    })
    .join("");
}

function scoreSearchHit(query, hit) {
  const q = normalizeSearchText(query);
  const title = normalizeSearchText(hit && hit.title);
  const path = normalizeSearchText(hit && hit.path);
  const description = normalizeSearchText(hit && hit.description);
  if (!q || !hit) {
    return { rank: 0, reason: null };
  }

  if (title === q) {
    return {
      rank: hit.kind === "folder" ? 100 : 95,
      reason: "exact",
    };
  }
  if (title.startsWith(q + " ") || title.startsWith(q)) {
    return { rank: 80, reason: "prefix" };
  }
  if (title.indexOf(q) !== -1) {
    return { rank: 60, reason: "contains" };
  }
  if (acronym(title) === q) {
    return { rank: 50, reason: "acronym" };
  }
  if (path.indexOf(q) !== -1 || description.indexOf(q) !== -1) {
    return { rank: 40, reason: "path" };
  }

  const distance = levenshtein(q, title);
  const maxLen = Math.max(q.length, title.length);
  const allowed = maxLen <= 12 ? 2 : 3;
  if (distance > 0 && distance <= allowed) {
    return { rank: 25, reason: "fuzzy" };
  }

  const qTokens = tokens(q);
  const titleTokens = tokens(title);
  const overlap = qTokens.filter(function (qt) {
    return titleTokens.some(function (tt) {
      return tt === qt || levenshtein(qt, tt) <= 1;
    });
  }).length;
  if (overlap && overlap === qTokens.length && qTokens.length > 0) {
    return { rank: 20, reason: "tokens" };
  }

  return { rank: 0, reason: null };
}

function sortSearchHits(hits, query) {
  const rows = Array.isArray(hits) ? hits.slice() : [];
  rows.sort(function (a, b) {
    const sa = scoreSearchHit(query, a).rank;
    const sb = scoreSearchHit(query, b).rank;
    if (sb !== sa) return sb - sa;
    const la = String(a.title || "").length;
    const lb = String(b.title || "").length;
    if (la !== lb) return la - lb;
    return String(a.title || "").localeCompare(String(b.title || ""));
  });
  return rows.filter(function (hit) {
    return scoreSearchHit(query, hit).rank > 0;
  });
}

function dedupeSearchHits(driveHits, noteHits) {
  const drive = Array.isArray(driveHits) ? driveHits.slice() : [];
  const seen = {};
  drive.forEach(function (hit) {
    if (hit && hit.nodeId) seen[String(hit.nodeId)] = true;
  });
  const notes = (Array.isArray(noteHits) ? noteHits : []).filter(function (hit) {
    const driveId = hit && (hit.driveFileId || hit.drive_file_id);
    if (!driveId) return true;
    return !seen[String(driveId)];
  });
  return drive.concat(notes);
}

function academicYearFromPath(path, kind, folderName) {
  if (kind === "folder" && folderName) {
    const fromName = yearScope.classifyYearFolder(folderName);
    if (fromName) return fromName;
  }
  const parts = String(path || "").split("/").filter(Boolean);
  if (kind === "file" && parts.length > 0) {
    parts.pop();
  }
  for (let i = 0; i < parts.length; i++) {
    const year = yearScope.classifyYearFolder(parts[i]);
    if (year) return year;
  }
  return null;
}

function isPdfHit(hit) {
  const mime = String((hit && hit.mimeType) || "").toLowerCase();
  const title = String((hit && hit.title) || "").toLowerCase();
  const fileType = String((hit && hit.fileType) || (hit && hit.file_type) || "").toLowerCase();
  return mime.indexOf("pdf") !== -1 || fileType === "pdf" || /\.pdf$/.test(title);
}

function applySearchFilters(hits, filters) {
  const rows = Array.isArray(hits) ? hits : [];
  const kind = filters && filters.kind;
  const year = filters && filters.year != null && filters.year !== "" ? Number(filters.year) : null;
  const type = filters && filters.type;
  return rows.filter(function (hit) {
    if (kind && hit.kind !== kind) return false;
    if (year === 1 || year === 2) {
      const hitYear =
        hit.academicYear != null
          ? Number(hit.academicYear)
          : academicYearFromPath(hit.path, hit.kind, hit.title);
      if (hitYear !== year) return false;
    }
    if (type === "pdf" && !isPdfHit(hit)) return false;
    return true;
  });
}

function paginateSearchHits(hits, params) {
  const rows = Array.isArray(hits) ? hits : [];
  const page = Math.max(1, (params && params.page) || 1);
  const limit = Math.max(1, (params && params.limit) || 12);
  const total = rows.length;
  const offset = (page - 1) * limit;
  return {
    items: rows.slice(offset, offset + limit),
    total: total,
    page: page,
    limit: limit,
    totalPages: Math.max(1, Math.ceil(total / limit)),
  };
}

function suggestCorrection(query, corpus) {
  const q = normalizeSearchText(query);
  if (!q || q.length <= 3 || !Array.isArray(corpus) || !corpus.length) {
    return null;
  }
  let best = null;
  let bestScore = Infinity;
  for (let i = 0; i < corpus.length; i++) {
    const candidate = String(corpus[i] || "").trim();
    const n = normalizeSearchText(candidate);
    if (!n || n === q) continue;
    const distance = levenshtein(q, n);
    const maxLen = Math.max(q.length, n.length);
    const allowed = maxLen <= 12 ? 2 : 3;
    if (distance === 0 || distance > allowed) continue;
    const tokenOverlap = tokens(q).filter(function (t) {
      return n.indexOf(t) !== -1;
    }).length;
    const score = distance - tokenOverlap * 0.25;
    if (score < bestScore) {
      bestScore = score;
      best = candidate;
    }
  }
  return best;
}

module.exports = {
  normalizeSearchText,
  scoreSearchHit,
  sortSearchHits,
  dedupeSearchHits,
  academicYearFromPath,
  applySearchFilters,
  paginateSearchHits,
  suggestCorrection,
};
