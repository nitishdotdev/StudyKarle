# StudyKarle — Project Context

> **Audience**: AI coding agents starting a new session.
> Read this once; consult `HANDOFF.md` for the current task state.

---

## Purpose

StudyKarle is a full-stack study notes platform hosted at https://www.studykarle.me.
It lets students organize and access study materials, stored as PDFs in Google Drive,
organized through a flexible folder hierarchy.

---

## Repository

- **Remote**: https://github.com/nitishdotdev/StudyKarle
- **GitHub handle**: NitishSolves / nitishdotdev
- **Default branch**: `main`

---

## Application components

### Frontend

| Property | Value |
|----------|-------|
| Framework | React 18 + Vite 2 |
| Language | JavaScript (no TypeScript sources in the repo) |
| Location | `client/` |
| Build command | `npm run build` (in `client/`) |
| Dev command | `npm run dev` (in `client/`, Vite on port 5173) |
| API client | Axios `withCredentials`; `VITE_API_URL` or default `/api` |

### Backend / API

| Property | Value |
|----------|-------|
| Runtime | Node.js 18+ (CI and `.nvmrc` pin 20) |
| Framework | Express 4 |
| Location | `server/` |
| Dev command | `npm run dev` (nodemon) |
| Start command | `npm start` |
| Tests | `npm test` (`node --test` in `server/`) |
| API base | `/api/*` |
| Production host | `https://studykarle-backend.onrender.com` |

### Database

| Property | Value |
|----------|-------|
| Engine | PostgreSQL |
| Provider | Neon (serverless) in production |
| Connection | `DATABASE_URL` in production; `DB_HOST` / `DB_PORT` / `DB_NAME` / `DB_USER` / `DB_PASSWORD` locally |
| Schema | Knex migrations in `server/src/db/migrations` |
| Migrate | `npm run migrate` in `server/` |

Key tables:
- `drive_nodes` — flexible arbitrary-depth folder/file hierarchy for Google Drive sync
  (unique on `drive_id`; parent via `parent_drive_id`)
- `google_link_challenges` — Google account linking tickets
  (`20261013000001_create_google_link_challenges.js`)
- Existing academic tables (`users`, `years`, `semesters`, `subjects`, `units`, `notes`, …)

### Storage

| Property | Value |
|----------|-------|
| Service | Google Drive API |
| Purpose | PDF storage and organization |
| Auth | Drive OAuth / refresh token via `GOOGLE_CLIENT_*` env vars (distinct from Google Sign-In) |

### Authentication

JWT in an HTTP-only cookie (`COOKIE_NAME`, default `studykarle_token`).

Cookie flags (`server/src/services/tokenService.js`):
- Production: `SameSite=None; Secure; Partitioned`
- Development: `SameSite=Lax`

CSRF (`server/src/middleware/csrfProtection.js`):
- Mutating requests need `X-Requested-With: XMLHttpRequest`
- Signed double-submit: `csrf` cookie must match `X-CSRF-Token`
- CSRF cookie is also `SameSite=None; Secure; Partitioned` in production

Google Sign-In (`GOOGLE_OAUTH_*`) is separate from Drive API credentials.
`NODE_ENV=production` requires an explicit HTTPS `GOOGLE_OAUTH_REDIRECT_URI`
(no localhost fallback). Production callback:
`https://studykarle-backend.onrender.com/api/auth/google/callback`

### Hosting / Deployment

| Layer | Provider | Notes |
|-------|---------|-------|
| Frontend | Vercel | Deploy `client/`. `client/vercel.json` rewrites `/api/*` to the Render backend and SPA-fallbacks to `index.html` |
| Backend | Render (`studykarle-backend`) | Express on `https://studykarle-backend.onrender.com` |
| Database | Neon | Serverless PostgreSQL (`DATABASE_URL`) |
| PDF storage | Google Drive | Via API |
| Keep-alive | GitHub Actions | See `docs/availability.md` and `.github/workflows/keep-alive.yml` |
| AI memory | Not deployed | Layer B is a separate Docker host, never Vercel serverless |

CI (`.github/workflows/ci.yml`): backend `npm test` and frontend `npm run build` on Node 20.

---

## Environment variables

Never put actual values here. Record only the variable name and purpose.
Source of truth: `server/.env.example` and `client/.env.example`.

| Variable | Required | Purpose |
|----------|---------|---------|
| `NODE_ENV` | Yes | `production` in deployed environments |
| `PORT` | Backend | API port (default 5000) |
| `CLIENT_URL` | Backend | Frontend origin |
| `CORS_ORIGINS` | Backend | Comma-separated credentialed CORS allowlist (never `*`) |
| `DATABASE_URL` | Prod | Neon PostgreSQL connection string |
| `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD` | Local | PostgreSQL connection |
| `JWT_SECRET` | Yes | JWT signing key |
| `JWT_EXPIRES_IN` | No | Token lifetime (default `7d`) |
| `COOKIE_NAME` | No | Auth cookie name (default `studykarle_token`) |
| `GOOGLE_CLIENT_ID` | Drive | Drive API OAuth client ID |
| `GOOGLE_CLIENT_SECRET` | Drive | Drive API OAuth client secret |
| `GOOGLE_REFRESH_TOKEN` | Drive | Drive API refresh token |
| `GOOGLE_REDIRECT_URI` | Drive | Drive OAuth callback |
| `GOOGLE_DRIVE_FOLDER_ID` | Drive | Root folder of the content library |
| `GOOGLE_OAUTH_CLIENT_ID` | Sign-In | Google Sign-In client ID |
| `GOOGLE_OAUTH_CLIENT_SECRET` | Sign-In | Google Sign-In client secret |
| `GOOGLE_OAUTH_REDIRECT_URI` | Sign-In | Backend Sign-In callback; production must be explicit HTTPS |
| `DRIVE_SYNC_INTERVAL_MS` | No | Periodic Drive sync; `0` disables |
| `DRIVE_SYNC_ON_START` | No | Initial sync on boot |
| `RESEND_API_KEY` | Email | OTP email delivery |
| `EMAIL_FROM` | Email | From address |
| `TRUST_PROXY_HOPS` | No | Trusted reverse-proxy hops for `req.ip` (default 1) |
| `VITE_API_URL` | Frontend | Axios base URL (local example: `http://localhost:5000/api`) |

Rate-limit window/max names live in `server/.env.example` (`AUTH_*`, `OTP_*`, `SESSION_*`, `SENSITIVE_*`).

---

## Key architecture constraints

1. **Drive sync must handle arbitrary nesting**: the `drive_nodes` table supports
   any folder depth. Do not reintroduce a fixed-depth hierarchy.

2. **PDF preview**: use `pdfjs-dist` / `react-pdf` canvas renderer. Do not revert
   to iframe blob URLs — they break on mobile Safari.

3. **Cookie auth**: production cookies are `SameSite=None; Secure; Partitioned`
   because the SPA on Vercel and API on Render are different sites. Local cookies
   are `SameSite=Lax`. Do not drop `Partitioned` or switch production to Lax-only
   without understanding CHIPS / third-party cookie blocking.

4. **Drive node identity**: `drive_nodes.drive_id` is unique. Duplicate folder
   names under different parents are allowed. Do not add a name-only unique
   constraint.

5. **Google Sign-In vs Drive API**: do not reuse Drive `GOOGLE_CLIENT_*` as the
   Sign-In client. Production must set HTTPS `GOOGLE_OAUTH_REDIRECT_URI`.

6. **ai-memory service is separate** from StudyKarle's runtime. Memory failures must
   never affect study-notes functionality, builds, or deployments.

---

## Build / test / deployment commands

There is no root `package.json`. Run commands in `client/` or `server/`.

```bash
# Frontend
cd client
npm install
npm run dev
npm run build

# Backend
cd server
npm install
npm run dev
npm test
npm run migrate
npm run seed
```

---

## Known third-party integrations

- **Google Drive API**: Drive sync and PDF storage
- **Google Sign-In**: account login / linking
- **Neon**: database
- **Vercel**: frontend hosting and `/api/*` rewrites to Render
- **Render**: backend hosting
- **Resend**: OTP email
- **pdfjs-dist / react-pdf**: client-side PDF rendering

---

*Last verified: 2026-10-21 against `client/package.json`, `server/package.json`,
`server/.env.example`, `client/.env.example`, `client/vercel.json`,
`server/src/services/tokenService.js`, `server/src/config/env.js`,
`server/src/db/migrations`, `.github/workflows/ci.yml`, and `README.md`.*
*Mark any outdated section `[STALE]` rather than silently deleting it.*
