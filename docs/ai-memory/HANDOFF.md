# StudyKarle — Session Handoff

> Cross-session state. Incoming agents must verify the SHA with `git log`
> before trusting notes. Source code and CI outrank this file.
> Do not commit, push, or merge solely to keep this file current.

---

## Current session status

**Last updated**: 2026-11-16
**Updated by**: Copilot (SEO/AEO/GEO implementation)
**Working branch**: current checkout
**Remote memory**: not configured (Layer A only)

---

## High-level objective

Implement a consistent student UI state system: empty, skeleton, error, offline
hint, search recovery, inline form validation, drafts, and session return path.
Safe user-scoped offline note *metadata* cache is in place. Do not claim full
offline PDF/library/search/download (no service worker).

---

## Audit fixes in this session

- User-scoped `localStorage` note metadata cache (`offlineNoteCache.js`): saved
  list + single-note details survive reload; no passwords/tokens/otp; cached vs
  live label. PDFs/search/downloads still need a network.
- PDF reading position persisted per user+note (`pdfPositionStore.js`) and
  restored in `PdfPreview` (authenticated pages only; public shares skipped).
- Session return uses `sessionReturn.js` (in-app paths only; blocks `//`,
  `javascript:`, `/login`).
- `shouldRestoreDraft` keeps local profile drafts across auth redirect and
  refuses to overwrite newer server fields.
- Browser camera/mic/notification permission UX is **N/A** (no such APIs).
  `navigator.share` `NotAllowedError` already falls back to clipboard.

## Verification (2026-11-02, pre-commit)

- `cd server && npm test`: **291 pass, 0 fail**.
- `cd client && npm run build`: **exit 0** (235 modules).
- `git diff --check`: clean.
- Client has no lint or test scripts.
- Browser/manual UI was **not** run: no Chrome/Firefox/`DISPLAY`, no Postgres,
  no `server/.env` or `client/.env`, no process on :5000/:5173/:5432. All six
  requested browser scenarios remain **NOT TESTED**. Do not treat helper-unit
  tests as live UI evidence.
- `origin/main` advanced to `bc93286` (login activity PR #25). This branch
  rebases onto that commit before push.

## Immediate next steps

1. Owner reviews the student UX PR. Do not merge without explicit approval.
2. Browser-verify the six scenarios if a real browser + DB + `.env` exist.
3. Login PR deploy still needs `cd server && npm run migrate` on target Postgres.

## SEO/AEO/GEO implementation (2026-11-16)

- Added route-specific prerendered HTML for the seven existing public
  informational pages, shared runtime metadata/JSON-LD, canonical URLs, and
  social metadata.
- Added `robots.txt`, `llms.txt`, a 1200x630 `social-preview.png`, Vercel
  route rewrites, private-route `X-Robots-Tag` headers, and a backend sitemap
  containing only public informational URLs.
- The Drive hierarchy remains protected and is intentionally not indexed:
  `drive_nodes` has no approved-public-content flag and its API/file access is
  authenticated and payment/material-gated. Resource-level SEO pages require
  an explicit approved-public data model before implementation.
- Verification: client build passed; backend test suite passed (340 tests);
  sitemap HTTP response returned 200 valid XML; live production curl was
  blocked by DNS resolution in this environment.
- Pre-merge audit tightened `robots.txt` so private UI routes remain crawlable
  for `X-Robots-Tag: noindex`, exposed both `/sitemap.xml` and
  `/seo/sitemap.xml` through Vercel, and replaced the SPA catch-all with
  explicit application-route rewrites so unknown URLs can return genuine 404s.

## SEO production cleanup (2026-11-16)

- Commit `2e65bb2` fixes the About page H1, makes prerender/runtime JSON-LD
  share the stable `studykarle-schema` script, removes the unsupported logo
  property, and removes unverifiable homepage statistics/testimonials.
- Client build passed and generated all seven public pages with one H1 and one
  valid Organization/WebSite/WebPage JSON-LD script each. Backend tests passed
  340/340.
- Production DNS resolution was unavailable, so live noindex headers, 404s,
  metadata, sitemap/robots, and auth/payment/Drive flows remain unverified.

---

*Verify `git log -1` and `git status` before acting.*
