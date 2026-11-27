# StudyKarle — Session Handoff

> Cross-session state. Incoming agents must verify the SHA with `git log`
> before trusting notes. Source code and CI outrank this file.
> Do not commit, push, or merge solely to keep this file current.

---

## Route and UI audit (2026-11-27)

- Put course materials before the access offer, trimmed the dashboard and PDF headers, and compacted student search results. Search now tracks URL changes. Mobile admins can navigate to all nine admin pages.
- Verified all 35 routes in an isolated Chrome run with fixture data. Local backend suite passed 389 tests and the frontend build passed eight SEO checks.
- Dependency advisories, search query fan-out, and possible route consolidation need separate review. The screenshot archive and review notes are in the workspace outside the checkout.

## Public course release (2026-11-27)

- PR #40 uses admin-approved course and preview metadata. Course slugs stay attached to the synced folder identity. The initial public catalog is empty.
- Material links resolve behind authentication and inherit the existing viewer and semester entitlement checks. Course and material context survive auth and checkout.
- Production `npm start` runs migrations first. The SQL coverage in CI runs on a dedicated PostgreSQL database after the normal backend suite.

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

## Private-route noindex cleanup (2026-11-16)

- PR #31 adds client-side `noindex, nofollow` handling to `AuthLayout`,
  marks `/drive/share/*` sensitive, replaces the broad Vercel header matcher
  with explicit exact/wildcard rules, and adds `client/scripts/validate-seo.mjs`.
- Local validation passed: frontend build plus seven-page SEO validator,
  backend tests 340/340, route coverage check, and React Router checks for
  private/share/public robots transitions.
- PR CI initially showed `action_required` with zero jobs; an authorized
  rerun provisioned both jobs and passed. CodeQL and Vercel Preview also pass.
- Preview and production HTTP checks remain unverified because this runtime
  cannot resolve the Vercel or `www.studykarle.me` hostnames. Do not merge or
  declare production readiness until those checks run from a resolvable network.

## Continue Studying audit (2026-11-16)

- PR #28 head `78c8601ac2c05f8426bd0dbeb6487de6e0b3c4cd` replaces the fixed
  50-row activity window with a PostgreSQL window-function query that filters
  existing Drive files and published notes before selecting the latest two
  unique `(resource_type, pdf_id)` resources, ordered by timestamp and ID.
- PDF reading-position keys now include resource type, preventing Drive and
  legacy-note IDs from colliding for the same user. Added regression coverage
  for more than 50 repeated opens and resource-type isolation.
- Local verification: backend tests 359/359, frontend production build plus
  seven-page SEO validator passed, and `git diff --check` passed. PR CI,
  CodeQL, and Vercel Preview checks passed after rerunning CI.
- Preview and production HTTP/browser verification remain **NOT VERIFIED**
  because DNS resolution is unavailable in this runtime. PR #28 is clean and
  open; owner review/merge is still required.

## Continue Studying unverified visibility (2026-11-17)

- PR #33 head `889f5d4aecf6ede808458cae26e83ace8bc4089b` keeps valid recent
  resources visible for students in unpaid, pending, rejected, and expired
  entitlement states. The API continues returning only metadata and access
  flags; locked thumbnails do not fetch PDF bytes.
- Locked cards now navigate through the existing Drive/note viewer routes so
  backend authorization performs the established redirect to `/access`.
- Verification: backend tests 360/360, targeted Continue Studying tests 19/19,
  frontend build plus SEO validator passed, and `git diff --check` passed.
  Preview deployment matches the exact head. Browser verification was
  attempted but blocked by DNS/client network restrictions; production remains
  **NOT VERIFIED**.

## Continue Studying recommendation fallback (2026-11-17)

- Follow-up PR #34 is based on merged PR #33/main. Implementation commit:
  `5cfe2e3c337fd4ba02779c7a6e5c669de7c078b8`.
- `continueStudyingService` now preserves genuine latest-two history first,
  then falls back only for unapproved students with no valid history to a
  bounded `drive_nodes` PDF query scoped by the shared Year 1/Year 2
  classification. Candidates are ordered by preferred profile year when
  available, then `modified_time DESC NULLS LAST`, `created_time DESC NULLS
  LAST`, and `drive_id`.
- Recommendations are authorized through `materialGate`, return only safe
  metadata with `source: recommendation`, and never create `pdf_opened`
  activity. Approved students receive no locked fallback. The frontend clears
  and refetches by authenticated user ID and labels recommendations
  “Recently updated”.
- Validation: backend tests 363/363, targeted Continue Studying tests 22/22,
  frontend build plus SEO validator passed, and `git diff --check` passed.
  PR #34 CI, CodeQL, and Vercel Preview checks passed. Preview/browser account
  verification remains **NOT VERIFIED** because the browser returned
  `ERR_BLOCKED_BY_CLIENT` and direct DNS/HTTP access was unavailable.

---

*Verify `git log -1` and `git status` before acting.*
