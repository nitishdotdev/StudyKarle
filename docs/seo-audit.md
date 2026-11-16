# StudyKarle SEO/AEO/GEO audit

## Findings before implementation

- StudyKarle is a React 18/Vite 2 single-page client deployed from `client/`,
  with an Express/Knex API in `server/`. The Vercel catch-all currently serves
  `index.html` for every non-API path, so route-specific metadata is not
  available in the initial response.
- Public, crawl-safe product pages are currently `/`, `/features`,
  `/how-it-works`, `/about`, `/contact`, `/privacy`, and `/terms`. Library
  browsing, file previews/downloads, notes, search, accounts, payments, and
  admin routes are protected or user-specific and must not enter a sitemap.
- The canonical academic hierarchy is the recursively synced
  `drive_nodes` table (`drive_id`, `parent_drive_id`, `name`, `kind`, `path`,
  `modified_time`). The API intentionally requires authentication for this
  tree and applies payment/material gates before file access, so protected
  Drive content cannot safely become public SEO pages without a separate
  approved-public-content flag.
- There is no existing `robots.txt`, sitemap, canonical metadata, structured
  data, or route-aware social metadata. The existing homepage also contains
  marketing stats/testimonials that are not backed by repository data and
  should not be expanded into SEO claims.
- Existing performance foundations are reasonable: route-level lazy loading,
  compressed API responses, and a small Vite client. The main technical SEO
  limitation is initial HTML, not JavaScript bundle loading.

## Implementation boundary

This change adds route-aware static HTML shells for the existing public
informational pages, shared metadata/schema utilities, crawl controls, a
dynamic sitemap for only those verified public pages, and an optional
`llms.txt` directory. It does not weaken authentication/payment checks or
expose the private Drive hierarchy. Resource-level discovery remains deferred
until the data model has an explicit approved-public-content signal.
