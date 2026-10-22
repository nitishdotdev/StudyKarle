# StudyKarle — Project Context

> **Audience**: AI coding agents starting a new session.
> Read this once; consult `HANDOFF.md` for the current task state.
> Prefer current source, git, and CI over this file when they disagree.

---

## Purpose

StudyKarle is a study-notes platform at https://www.studykarle.me.
Students browse a Google Drive library mirrored into PostgreSQL, then
preview, search, save, and download PDFs.

---

## Repository

- **Remote (verified `git remote`)**: https://github.com/NitishSolves/StudyKarle
- **Default branch**: `main`
- **PR that added this memory layer**: #21, merged as `30f7b22`

`nitishdotdev` is the ai-memory *workspace* name in `.ai-memory.toml`.
It is also the GitHub user on the merged feature-branch fork. It is not
the `origin` org (`NitishSolves`).

---

## Layout

There is **no root `package.json`**. Two packages:

| Path | Role |
|------|------|
| `client/` | React 18 + Vite 2 frontend (JavaScript / JSX, not TypeScript) |
| `server/` | Node.js 20 + Express 4 API |

Also: `docs/`, `deploy/ai-memory/`, `scripts/ai-memory/`, `.github/workflows/`.

---

## Frontend (`client/`)

- React 18, React Router 6, Tailwind 3, Axios
- Vite 2.9, `client/vite.config.js` (no `tsconfig`)
- PDF preview: `react-pdf` wrapping `pdfjs-dist` 3.11 (canvas `Page`, not iframe blob URLs) in `client/src/components/notes/PdfPreview.jsx`
- Dev: `cd client && npm run dev` (port 5173; proxies `/api` to `http://localhost:5000`)
- Build: `cd client && npm run build`
- No `lint` or `test` script in `client/package.json`

Production host: **Vercel**, `client/vercel.json`:

- `/api/*` rewrites to `https://studykarle-backend.onrender.com/api/$1`
- SPA fallback to `/index.html`

---

## Backend (`server/`)

- Express 4, Knex 2, `pg`, JWT (`jsonwebtoken`) in an HTTP-only cookie
- Google Drive API (`googleapis`) for library sync
- Google Sign-In (separate from Drive) plus email-OTP signup (Resend)
- CSRF (`csrf-csrf`), Helmet, rate limits
- Dev: `cd server && npm run dev` (nodemon, port 5000)
- Start: `cd server && npm start`
- Migrate / seed: `cd server && npm run migrate` / `npm run seed`
- Tests: `cd server && npm test` (`node --test`; listed in `server/package.json`)
- Health: `GET /health` and `GET /api/health` (public JSON `{ success, data: { status: "ok" } }`)

Production host: **Render** web service `studykarle-backend.onrender.com`.
Keep-alive: `.github/workflows/keep-alive.yml` (see `docs/availability.md`).

---

## Database

- PostgreSQL via Knex migrations in `server/src/db/migrations/`
- Connection: split `DB_*` variables and, in production, optional `DATABASE_URL`
  (see `server/.env.example` and `server/knexfile.js`). Do not copy values here.
- **Neon is not referenced in application source.** Earlier notes that named
  Neon as the provider are unverified hosting detail, not code.

### `drive_nodes`

Authoritative Drive mirror. Unique key is **`drive_id`**
(`server/src/db/migrations/20260808000001_create_drive_sync_tables.js`).
Parent/child via `parent_drive_id`. Arbitrary depth. Duplicate folder
*names* under different parents are allowed because uniqueness is the
Drive id, not `(name, parent)`.

---

## Authentication

JWT in cookie `COOKIE_NAME` (default `studykarle_token`), HttpOnly.

Production cookie flags (`server/src/services/tokenService.js`):
`SameSite=None; Secure; Partitioned`. Non-production: `SameSite=Lax`.

CSRF cookie follows the same production `none` / non-production `lax` split
(`server/src/middleware/csrfProtection.js`).

Vercel `/api` rewrites keep browser calls same-origin on `www.studykarle.me`.
Do not change cookie flags or the rewrite without understanding mobile auth.

There is **no payments implementation** in this repository.

---

## CI

`.github/workflows/ci.yml` on `push`/`pull_request` to `main`:

- `server-tests`: Node 20.20.2, `cd server && npm ci && npm test`
- `frontend-build`: Node 20.20.2, `cd client && npm ci && npm run build`

No lint job. This environment could not list GitHub Actions run results.

---

## Sensitive configuration

Secrets are supplied through each host's secret store (Vercel, Render, local
`.env` files that are gitignored). Do not copy values into memory documents,
commits, or remote memory.

Tracked name lists (values are placeholders only): `server/.env.example`,
`client/.env.example`. Client public name: `VITE_API_URL`.

---

## ai-memory (dev tooling only)

Separate from the StudyKarle runtime. Failures here must not affect the
notes app, builds, or production deploys.

- Marker: `.ai-memory.toml` (`workspace = "nitishdotdev"`, `project = "StudyKarle"`)
- Layer A (authoritative in git): `docs/ai-memory/`
- Layer B (optional remote): `akitaonrails/ai-memory:2.0.2` — **not deployed**
- Layer C: `AGENTS.md` / `CLAUDE.md` protocol. Claude Code and Codex MCP/hooks
  are owner-only. MonkeyCode uses Layer A (see `KNOWN_ISSUES.md` I-005).

---

## Commands cheat-sheet

```bash
cd server && npm run dev
cd client && npm run dev
cd server && npm test
cd client && npm run build
cd server && npm run migrate
bash scripts/ai-memory/validate.sh
```

There is no root `npm run lint` / `npm test`.

---

*Last verified against the checkout at `30f7b22` on 2026-10-21.*
