# StudyKarle — Agent Instructions

## Project
Full-stack study notes platform at https://www.studykarle.me

**Stack**: React + Vite (frontend), Node.js / Express (backend),
PostgreSQL via Neon, Google Drive API for PDF storage, Vercel hosting.

## Key facts
- Drive sync uses a flexible `drive_nodes` table (arbitrary nesting depth).
- PDF preview: `pdfjs-dist` canvas renderer (not iframe blob URLs).
- Auth cookies: `sameSite: lax` via Vercel rewrite rules (mobile/incognito fix).

## Commands (verify against package.json)
```bash
npm run dev     # local development
npm run build   # production build
npm run lint    # linting
npm test        # tests, if configured
```

## Boundaries
- Do NOT modify auth, payments, user data, or production DB without explicit approval.
- Do NOT merge PRs or push to production without explicit approval.
- Do NOT commit `.env` files or credentials of any kind.
- Prefer minimal, targeted changes; do not refactor unrelated code.

## Memory protocol (ai-memory)

Read `workspace = "nitishdotdev"` and `project = "StudyKarle"` from the root
`.ai-memory.toml` marker. If the remote ai-memory server is configured and reachable:

1. **Session start**: call `memory_handoff_list` to retrieve the latest handoff before
   reading files or writing code. Also call `memory_briefing` for structured project counts.
2. **During work**: call `memory_query` before repeating a debugging approach.
   Write significant findings (decisions, failed experiments, root causes) to memory.
3. **Session end**: call `memory_handoff_begin` to create a cross-agent handoff.

If the remote server is unavailable:
- Read `docs/ai-memory/HANDOFF.md` and `docs/ai-memory/KNOWN_ISSUES.md` from the repository.
- Update those files manually when the work affects future sessions.
- Do not claim remote memory succeeded when it did not.

See `docs/ai-memory/` for full project context, architecture decisions, and issue history.
