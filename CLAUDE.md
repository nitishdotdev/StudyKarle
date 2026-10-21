# StudyKarle — Claude Code Instructions

## Stack (read package.json for the authoritative list)
- **Frontend**: React + Vite, TypeScript
- **Backend**: Node.js / Express
- **Database**: PostgreSQL via Neon (serverless)
- **Storage**: Google Drive API (PDFs)
- **Auth**: Session-based; `sameSite: lax` cookies via Vercel rewrites to fix mobile/incognito
- **Hosting**: Vercel (frontend + API), Neon (database)
- **Production**: https://www.studykarle.me

## Key commands (verify against package.json before running)
```bash
# Frontend (likely in /client or root)
npm run dev        # local dev
npm run build      # production build
npm run lint       # ESLint

# Backend (likely in /server or /api)
npm run dev        # nodemon
npm test           # tests (if configured)
```

## Architecture notes
- Drive sync uses a flexible `drive_nodes` layer supporting arbitrary nesting depth
  (replaced an older rigid four-level hierarchy).
- PDF preview uses `pdfjs-dist` canvas renderer — not iframe blob URLs
  (mobile/Safari compatibility fix).
- Cookie auth uses Vercel rewrite rules to avoid third-party cookie blocking.

## Boundaries
- Do NOT modify auth, payments, user data, or production DB schema without explicit approval.
- Do NOT merge PRs or deploy production changes without explicit approval.
- Do NOT commit `.env` files or credentials.

<!-- ai-memory:start -->
## Long-term memory (ai-memory)

Read `workspace` and `project` from the nearest `.ai-memory.toml` (`nitishdotdev` / `StudyKarle`).

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
