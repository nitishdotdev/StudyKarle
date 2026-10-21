# StudyKarle — Claude Code Instructions

## Stack (read each package.json; there is no root package.json)
- **Frontend**: React 18 + Vite 2, JavaScript/JSX in `client/` (not TypeScript)
- **Backend**: Node.js / Express in `server/`
- **Database**: PostgreSQL via Knex (`DB_*` and optional production `DATABASE_URL`)
- **Storage**: Google Drive API
- **Auth**: JWT in HttpOnly cookie `studykarle_token`. Production `SameSite=None; Secure; Partitioned`; local `SameSite=Lax`. Vercel `/api` rewrite to Render.
- **Hosting**: Vercel (`client/`) + Render (`studykarle-backend.onrender.com`)
- **Production**: https://www.studykarle.me

Neon is not referenced in application source.

## Key commands
```bash
cd client && npm run dev
cd client && npm run build
cd server && npm run dev
cd server && npm test
cd server && npm run migrate
```

Client has no lint or test script.

## Architecture notes
- Drive sync: `drive_nodes` unique on `drive_id`, arbitrary depth.
- PDF preview: `react-pdf` / `pdfjs-dist` canvas — not iframe blob URLs.
- Do not change cookie flags or the Vercel rewrite without an auth review.

## Boundaries
- Do NOT modify auth, payments, user data, or production DB schema without explicit approval.
- Do NOT merge PRs or deploy production changes without explicit approval.
- Do NOT commit `.env` files or credentials.

<!-- ai-memory:start -->
## Long-term memory (ai-memory)

Read `workspace` and `project` from `.ai-memory.toml` (`nitishdotdev` / `StudyKarle`).
Do not add a `server` key there.

**Session start** — if MCP tools `memory_handoff_list` / `memory_briefing` exist,
call them before writing code. If they are missing or the remote server fails,
read `docs/ai-memory/HANDOFF.md` and `docs/ai-memory/KNOWN_ISSUES.md` and say so.

**During work** — if `memory_query` exists, call it before repeating a debugging
approach. Always update `docs/ai-memory/KNOWN_ISSUES.md` when evidence changes.

**Session end** — if `memory_handoff_begin` exists, call it. On failure or if the
tool is absent, update `docs/ai-memory/HANDOFF.md` in git.

Never claim remote memory succeeded without a successful tool call.
On conflict, trust current source and CI over any memory note.
<!-- ai-memory:end -->
