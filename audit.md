# StudyKarle audit

## The five biggest hierarchy and density problems

1. **Course detail buried the material list.** Counts, pricing cards, and a three-step sales panel came before the files. The material list and filters now lead. The pass is summarized below them.
2. **The dashboard spent its first screen on a greeting.** Decorative space and a second search entry pushed the library and Continue Studying down. A single Study library heading now leads directly into the folders and files.
3. **Mobile search made each result a large card.** A tall file icon, a repeated format label, separate metadata icons, and a nested button took up more space than the result title. Results now use compact rows with one accessible preview link per item.
4. **PDF screens repeated the same heading and navigation.** Drive and note viewers showed the file name twice. The shared viewer also rendered two site headers. The duplicate chrome is removed so the document starts higher.
5. **The home page led with an abstract pitch.** The headline and calls to action gave little indication what students could browse. The lead now names the materials and links to the course catalog. Sign-in remains available beside it.

## Other changes verified

- The public catalog distinguishes an unpublished library from a search with no matches. Course detail distinguishes a missing course from a temporary error and explains empty material categories.
- Search follows the URL when a student submits a new query from the top bar, goes back, or changes filters. Retries use the same request path and cancel stale requests.
- The library root shows one Library breadcrumb. App-shell branding no longer takes the page heading position.
- Mobile admins can reach all nine admin destinations from one picker. The prior navigation rendered only the first five.
- Contact has a working email link. The How It Works page describes the PDF viewer without promising downloads for protected materials.
- Removed the unused FileList module, unused landing-page arrays and state, and the duplicate remote icon-font stylesheet. The app loads the packaged icon font.

## Review queue

| Priority | Finding | Decision or verification needed |
|---|---|---|
| High | Production-dependency audit reported 11 advisories in the client (1 critical, 10 high) and 18 in the server (1 critical, 6 high). Direct dependencies reported at high severity or above include client Axios, PDF.js, React-PDF and React Router, and server Express, Compression and Nodemailer. | Plan compatible upgrades and verify PDF rendering, cookies, upload/email handling, and deployment. These counts come from the registry audit and do not establish exploitability in StudyKarle. |
| High | Student search exposes only Year 1 and Year 2 filters, although the library supports later years. The service also caps each candidate source at 200 before applying all filters and paginating. | Decide which years and hierarchies should be filterable. Test completeness and ranking with realistic late-year and broad-query data before changing the query. |
| High | Search decorates results serially. The gate can reload student entitlement for each hit and look up ancestry. The public catalog also walks published folders and builds item detail when only counts or a slug lookup are needed. | Measure query counts and latency on a realistic library. Reuse one entitlement lookup per request and validate narrower catalog queries before optimizing. |
| Medium | Continue Studying can still sit below a long library list. The same slot shows recent history or recommendations, which serve different purposes. | Decide whether real study history should come first for returning students and keep recommendations secondary for new students. |
| Medium | The dashboard and library root repeat browsing. Admin Overview and Analytics repeat the same headline metrics. | Review route usage and dependencies before consolidating or retiring a page. Preserve deep links where needed. |
| Medium | Access repeats the offer and policy in separate cards. Mobile admin history stacks metrics before the table, and course publication presents a single long checklist for large folders. | Review dense queue states with real-scale synthetic data before choosing changes. Use the existing approval and payment rules when changing presentation. |
| Medium | The public course browser uses an SPA shell while the crawler uses an SSR route. A missing course can therefore have different HTTP status by client. | Decide whether proper browser-side HTTP 404s justify changing deployment routing. Keep the existing noindex behavior. |
| Review | The homepage contains hard-coded numbers and testimonials explicitly asserted by the SEO checks. There is no evidence of their provenance in the source reviewed here. | Confirm the numbers and attribution with the owner before removing or replacing them. The footer and the Features, About, and How It Works pages also contain overlapping copy suitable for a separate content pass. |
| Review | The local icon font is about 1.1 MB. Legacy uploaded notes and the Drive tree use separate models. | Measure the font request before subsetting. Check use of older notes before deleting routes, data models, or migrations. |

## Verification and coverage

- Opened all 35 React routes with sample public, student, and admin data. Captured 45 baseline screenshots in Chromium and 46 final screenshots in Google Chrome for Testing 158. Desktop captures use a 1440-pixel viewport. Selected mobile captures use a 390-pixel viewport. Parameterized pages use representative fixtures.
- Google completion has a transient loading screen. The screenshot holds that screen briefly before redirect. Google account linking was opened with a local fixture challenge.
- Verified course content order, empty and unavailable states, mailto, shared and signed-in PDFs, search navigation and Back, filters, the library breadcrumb, mobile admin navigation, and use of the packaged icon font. The browser pass used a local HTTPS proxy, synthetic records, and fixture integrations.
- Backend suite passed 389 tests. The production frontend build and eight SEO checks passed. Source and documentation changes are local to the workspace.
