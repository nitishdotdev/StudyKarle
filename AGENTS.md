# StudyKarle — Agent Instructions

## Project
Full-stack study notes platform at https://www.studykarle.me

**Stack**: React 18 + Vite 2 (JavaScript/JSX, `client/`), Node.js / Express
(`server/`), PostgreSQL via Knex, Google Drive API, Vercel frontend + Render backend.

There is no root `package.json`. Neon is **not** referenced in application source.

## Key facts
- Drive sync: `drive_nodes` with unique `drive_id` (arbitrary depth). Names are not unique.
- PDF preview: `react-pdf` / `pdfjs-dist` canvas (`PdfPreview.jsx`), not iframe blob URLs.
- Auth: JWT in HttpOnly cookie `studykarle_token`. Production `SameSite=None; Secure; Partitioned`; local `SameSite=Lax`. Vercel rewrites `/api/*` to Render.

## Commands (run in the package directory)
```bash
cd server && npm run dev
cd client && npm run dev
cd server && npm test
cd client && npm run build
cd server && npm run migrate
```

No root `npm run lint` / `npm test`. Client has no lint or test script.

## Boundaries
- Do NOT modify auth, payments, user data, or production DB without explicit approval.
- Do NOT merge PRs or push to production without explicit approval.
- Do NOT commit `.env` files or credentials of any kind.
- Prefer minimal, targeted changes; do not refactor unrelated code.

## Memory protocol (ai-memory)

Read `workspace = "nitishdotdev"` and `project = "StudyKarle"` from `.ai-memory.toml`.
Do not add a `server` key to that file.

**MonkeyCode (this class of runtime)**: there are no `memory_*` MCP tools.
Use Layer A only:

1. Session start: read `docs/ai-memory/HANDOFF.md` and `docs/ai-memory/KNOWN_ISSUES.md`.
2. During work: read those files before repeating a debugging approach. Update them
   when a finding should survive this session.
3. Session end: update `docs/ai-memory/HANDOFF.md`. Do not claim remote memory ran.

**Claude Code / Codex** (only if MCP tools actually exist in *this* session):

1. Session start: `memory_handoff_list` then `memory_briefing`. If the call fails,
   fall back to Layer A and say so.
2. During work: `memory_query` before repeating an approach. Write significant findings.
3. Session end: `memory_handoff_begin`. If the write fails, update `HANDOFF.md`.

Never claim remote memory succeeded without a successful tool call.
On conflict, trust current source and CI over any memory note.

See `docs/ai-memory/` for architecture, decisions, and issue history.
