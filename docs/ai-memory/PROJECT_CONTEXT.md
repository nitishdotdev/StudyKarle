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
- **Default branch**: `main` [VERIFY on checkout — branch policies may have changed]

---

## Application components

### Frontend

| Property | Value |
|----------|-------|
| Framework | React + Vite |
| Language | TypeScript |
| Location | `/client` or project root [VERIFY — inspect actual directory] |
| Build command | `npm run build` |
| Dev command | `npm run dev` |

### Backend / API

| Property | Value |
|----------|-------|
| Runtime | Node.js |
| Framework | Express |
| Location | `/server` or `/api` [VERIFY — inspect actual directory] |
| Dev command | `npm run dev` (with nodemon) |
| API base | `/api/*` (Vercel rewrites proxy to backend) |

### Database

| Property | Value |
|----------|-------|
| Engine | PostgreSQL |
| Provider | Neon (serverless) |
| Connection | `DATABASE_URL` env var |
| Schema | Migrations managed in repo [VERIFY location] |

Key tables (confirmed from known issues):
- `drive_nodes` — flexible arbitrary-depth folder/file hierarchy for Google Drive sync
  (replaced rigid four-level structure; see `DECISIONS.md`)

### Storage

| Property | Value |
|----------|-------|
| Service | Google Drive API |
| Purpose | PDF storage and organization |
| Auth | Service account or OAuth credentials via env vars |

### Authentication

Session-based cookie auth.

Critical fix in place:
- `sameSite: lax` cookies delivered via Vercel rewrite rules to avoid third-party
  cookie blocking on mobile / incognito browsers.
- **Do not remove or change this pattern** without understanding the mobile auth consequences.

### Hosting / Deployment

| Layer | Provider | Notes |
|-------|---------|-------|
| Frontend + API gateway | Vercel | Rewrite rules proxy `/api/*` to backend |
| Backend (if separate) | Render or Vercel serverless | [VERIFY current deployment] |
| Database | Neon | Serverless PostgreSQL |
| PDF storage | Google Drive | Via API |

---

## Environment variables

Never put actual values here. Record only the variable name and purpose.

| Variable | Required | Purpose |
|----------|---------|---------|
| `DATABASE_URL` | Yes | Neon PostgreSQL connection string |
| `GOOGLE_CLIENT_ID` | Yes | Google OAuth / Drive API client ID |
| `GOOGLE_CLIENT_SECRET` | Yes | Google OAuth / Drive API client secret |
| `GOOGLE_REDIRECT_URI` | Yes | OAuth callback URL |
| `SESSION_SECRET` | Yes | Express session signing key |
| `NODE_ENV` | Yes | `production` in deployed environments |
| `VITE_API_BASE_URL` | Frontend | Base URL for API calls in Vite build |

> [UNVERIFIED — inspect `.env.example` or the actual repository for the full list]

---

## Key architecture constraints

1. **Drive sync must handle arbitrary nesting**: the `drive_nodes` table supports
   any folder depth. Do not reintroduce a fixed-depth hierarchy.

2. **PDF preview**: use `pdfjs-dist` canvas renderer. Do not revert to iframe blob URLs —
   they break on mobile Safari.

3. **Cookie auth**: `sameSite: lax` + Vercel rewrites. Changing cookie policy or proxy
   configuration can silently break mobile / incognito auth.

4. **Drive sync deduplication**: duplicate folder names under different parents previously
   caused DB constraint crashes. The current schema handles this — do not regress it.

5. **ai-memory service is separate** from StudyKarle's runtime. Memory failures must
   never affect study-notes functionality, builds, or deployments.

---

## Build / test / deployment commands

```bash
# Install (verify package manager — npm assumed)
npm install

# Development
npm run dev          # starts dev server(s)

# Production build
npm run build        # compiles frontend + any server transpilation

# Linting
npm run lint         # ESLint

# Tests
npm test             # [VERIFY — may not be configured]

# Database migrations
# [VERIFY — location and command unknown; look for Knex, Prisma, or raw SQL scripts]
```

---

## Known third-party integrations

- **Google Drive API**: Drive sync and PDF storage
- **Neon**: database
- **Vercel**: hosting and edge rewrites
- **pdfjs-dist**: client-side PDF rendering

---

*Last verified: bootstrapped from repository memory and git history on 2026-10-21.*
*Mark any outdated section `[STALE]` rather than silently deleting it.*
