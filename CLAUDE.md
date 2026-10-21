# StudyKarle — Claude Code Instructions

## Stack (read package.json for the authoritative list)
- **Frontend**: React 18 + Vite 2, JavaScript (not TypeScript) in `client/`
- **Backend**: Node.js / Express in `server/`
- **Database**: PostgreSQL via Neon; Knex migrations in `server/src/db/migrations`
- **Storage**: Google Drive API (PDFs)
- **Auth**: JWT in HTTP-only cookies. Production: `SameSite=None; Secure; Partitioned`.
  Local: `SameSite=Lax`. CSRF double-submit (`csrf` cookie + `X-CSRF-Token`).
- **Hosting**: Vercel (`client/`) + Render backend
  (`https://studykarle-backend.onrender.com`). Neon for the database.
- **Production**: https://www.studykarle.me

## Key commands (verify against package.json before running)
```bash
# Frontend (client/)
npm run dev
npm run build
npm run preview

# Backend (server/)
npm run dev
npm start
npm test
npm run migrate
```

## Architecture notes
- Drive sync uses a flexible `drive_nodes` layer supporting arbitrary nesting depth
  (replaced an older rigid four-level hierarchy). Nodes are unique by Drive id.
- PDF preview uses `pdfjs-dist` / `react-pdf` canvas renderer — not iframe blob URLs
  (mobile/Safari compatibility fix).
- `client/vercel.json` rewrites `/api/*` to the Render backend so the browser can
  treat API calls as same-site via `/api` when `VITE_API_URL` is unset; production
  cookies still use `SameSite=None; Secure; Partitioned` because the API host is
  cross-site when the client talks to Render directly.
- Google Sign-In (`GOOGLE_OAUTH_*`) is distinct from Drive API (`GOOGLE_CLIENT_*`).
  Production requires an explicit HTTPS `GOOGLE_OAUTH_REDIRECT_URI`.

## Boundaries
- Do NOT modify auth, payments, user data, or production DB schema without explicit approval.
- Do NOT merge PRs or deploy production changes without explicit approval.
- Do NOT commit `.env` files or credentials.

<!-- ai-memory:start -->
## Long-term memory (ai-memory)

Read `workspace` and `project` from the nearest `.ai-memory.toml` (`nitishdotdev` / `StudyKarle`).
Do not commit a `server` key in that marker.

**Session start** — before reading files or writing code, call `memory_handoff_list` (or
`memory_briefing`) to load the latest project state, open tasks, and recent decisions.
If the remote server is unreachable, read `docs/ai-memory/HANDOFF.md` and
`docs/ai-memory/KNOWN_ISSUES.md` from the repository instead.

**During work** — before repeating a debugging approach or architectural decision, call
`memory_query` to check prior attempts. Record significant findings with a targeted MCP write;
update `docs/ai-memory/KNOWN_ISSUES.md` when new evidence changes the known status of a bug.

**Session end** — call `memory_handoff_begin` to create a cross-agent handoff.
If the remote write fails, update `docs/ai-memory/HANDOFF.md` manually and commit it.
Report any remote-memory failure honestly; do not claim success when none occurred.

Never claim to have read, written, or retrieved remote memory without a successful tool call.
<!-- ai-memory:end -->
