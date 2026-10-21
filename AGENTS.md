# StudyKarle — Agent Instructions

## Project
Full-stack study notes platform at https://www.studykarle.me

**Stack**: React 18 + Vite 2 (JavaScript) in `client/`, Node.js / Express in
`server/`, PostgreSQL via Neon (Knex migrations), Google Drive API for PDF
storage. Frontend on Vercel; backend on Render
(`https://studykarle-backend.onrender.com`).

## Key facts
- Drive sync uses a flexible `drive_nodes` table (arbitrary nesting depth;
  uniqueness is `drive_id`, not folder name).
- PDF preview: `pdfjs-dist` / `react-pdf` canvas renderer (not iframe blob URLs).
- Auth cookies: production `SameSite=None; Secure; Partitioned`; local
  `SameSite=Lax`. Vercel rewrites `/api/*` to the Render backend.
- CSRF: `X-Requested-With: XMLHttpRequest` plus signed double-submit
  `csrf` cookie / `X-CSRF-Token` header.
- Google Sign-In OAuth is distinct from Drive API credentials.
  Production `GOOGLE_OAUTH_REDIRECT_URI` must be explicit HTTPS (no localhost
  fallback). Linking uses `google_link_challenges`
  (`20261013000001_create_google_link_challenges.js`).

## Commands (no root package.json — run in `client/` or `server/`)
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

## Boundaries
- Do NOT modify auth, payments, user data, or production DB without explicit approval.
- Do NOT merge PRs or push to production without explicit approval.
- Do NOT commit `.env` files or credentials of any kind.
- Prefer minimal, targeted changes; do not refactor unrelated code.

## Memory protocol (ai-memory)

Read `workspace = "nitishdotdev"` and `project = "StudyKarle"` from the root
`.ai-memory.toml` marker. Do not add a `server` key to that committed marker.

If the remote ai-memory server is configured and reachable:

1. **Session start**: call `memory_handoff_list` to retrieve the latest handoff before
   reading files or writing code. Also call `memory_briefing` for structured project counts.
2. **During work**: call `memory_query` before repeating a debugging approach.
   Write significant findings (decisions, failed experiments, root causes) to memory.
3. **Session end**: call `memory_handoff_begin` to create a cross-agent handoff.

If the remote server is unavailable (MonkeyCode default until MCP is proven):
- Read `docs/ai-memory/HANDOFF.md` and `docs/ai-memory/KNOWN_ISSUES.md` from the repository.
- Update those files manually when the work affects future sessions.
- Do not claim remote memory succeeded when it did not.

See `docs/ai-memory/` for full project context, architecture decisions, and issue history.
