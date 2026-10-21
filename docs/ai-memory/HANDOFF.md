# StudyKarle — Session Handoff

> **This is the critical cross-session document.**
> Update it at the end of any session that materially changes project state.
> The incoming agent must verify the recorded SHA against `git log` before trusting any note.
> Source code and CI results take precedence over notes here.

---

## Current session status

**Last updated**: 2026-10-21
**Updated by**: MonkeyCode (ai-memory audit / Layer A correction)
**Last verified commit SHA**: `30f7b22eed3e9a063569a7e77aeac3699e306bd6`
(`30f7b22` — Merge pull request #21 from nitishdotdev/feat/studykarle-ai-memory)
**Branch**: `261021-chore-ai-memory-sync` (from `origin/main` @ `30f7b22`; Layer A corrections committed on this branch)

Remote ai-memory MCP was **not** used. Layer A files only.

---

## High-level objective

Audit PR #21 AI-memory against the current StudyKarle tree, fix stale and privacy-risk
notes, and leave a sustainable Claude / Codex / MonkeyCode sync workflow.
Do **not** merge, deploy the memory service, or change production infrastructure.

---

## What was completed this session

- Fact-checked Layer A docs against `client/`, `server/`, migrations, `vercel.json`,
  `.env.example`, CI, and official ai-memory marker / support-matrix / v2.0.2 release notes.
- Corrected `AGENTS.md`, `CLAUDE.md`, `PROJECT_CONTEXT.md`, `DECISIONS.md`,
  `KNOWN_ISSUES.md`, `SETUP.md`, `OPERATIONS.md`.
- Tightened `.ai-memory.toml` capture `ignore_paths` (root + nested `.env` forms,
  credential filenames, `.claude/mcp.json`). No unknown `[capture]` keys.
- Replaced duplicate `ai-memory.toml` contents with a pointer (official lookup is
  `.ai-memory.toml` only). Did not commit a `server` key.
- Fixed linux/amd64 tarball SHA typo `…4db42823` → `…4da31a23` in
  `deploy/ai-memory/docker-compose.yml` and `OPERATIONS.md` (v2.0.2 release checksum).
- Restored `deploy/ai-memory/.env.example` (names only) and added `.gitignore`
  exceptions `!.env.example` / `!**/.env.example` so `.env.*` no longer hides the template.
- `scripts/ai-memory/validate.sh`: PASS 25, FAIL 0, WARN 3 (no docker compose; no CLI).

## What was NOT completed

- Remote ai-memory service has NOT been deployed (owner action — see SETUP.md).
- Claude Code MCP + hooks: NOT configured in this environment (owner action).
- Codex MCP + hooks: NOT configured (owner action).
- MonkeyCode MCP: NOT available this session. `AGENTS.md` **is** read (confirmed).
  Do not claim cross-agent sync until a real handoff round-trip succeeds.
- These Layer A edits are on `261021-chore-ai-memory-sync` for review; do not merge without owner approval.

---

## Changes made (this session)

- `AGENTS.md` — stack, hosting, cookies, CSRF, Google linking, commands, no `server` key
- `CLAUDE.md` — JavaScript not TypeScript; Render backend; CHIPS cookies
- `.ai-memory.toml` — capture ignores tightened
- `ai-memory.toml` — pointer only (not a second marker)
- `docs/ai-memory/PROJECT_CONTEXT.md` — verified architecture
- `docs/ai-memory/DECISIONS.md` — D-002 corrected; D-006 no committed `server` key
- `docs/ai-memory/HANDOFF.md` — this file
- `docs/ai-memory/KNOWN_ISSUES.md` — I-001 cookie flags; I-005 MonkeyCode evidence; I-006 marker
- `docs/ai-memory/SETUP.md` — do not commit `server`
- `docs/ai-memory/OPERATIONS.md` — SHA + no committed `server`
- `deploy/ai-memory/docker-compose.yml` — SHA comment
- `scripts/ai-memory/validate.sh` — reject committed `server` key; pointer-file check
- `.gitignore` — un-ignore `**/.env.example`
- `deploy/ai-memory/.env.example` — NEW (placeholders only; was gitignored by `.env.*`)

No application code, schema, auth, or production config was modified.

---

## Commands run and results

- `git submodule` check: no `.gitmodules`
- `git status` / `git log`: clean tree at `30f7b22` before edits
- Official docs fetched: marker-file.md, support-matrix.md, v2.0.2 release, deploy.md
- Source inspected: `client/package.json`, `server/package.json`, `server/.env.example`,
  `client/.env.example`, `client/vercel.json`, `server/src/services/tokenService.js`,
  `server/src/config/env.js`, `server/src/middleware/csrfProtection.js`,
  `server/knexfile.js`, `server/src/db/migrations/20260808000001_create_drive_sync_tables.js`,
  `.github/workflows/ci.yml`, `README.md`
- `bash scripts/ai-memory/validate.sh` — run after these edits (see session notes)

No `npm test` / `npm run build` this session (docs/marker only).

---

## Immediate next steps (in priority order)

1. Owner reviews the PR from `261021-chore-ai-memory-sync` and merges if they agree.
2. Owner follows `docs/ai-memory/SETUP.md` to deploy Layer B (persistent Docker host,
   not Vercel). Register `studykarle-memory` per environment; do not commit `server`.
3. Owner installs Claude Code and Codex MCP + hooks once the URL and token exist.
4. After Layer B is up, test `memory_handoff_begin` in one agent and
   `memory_handoff_list` in another. Record the result in KNOWN_ISSUES I-004 / I-005.
5. Incoming agents: `git log --oneline -5` and `git status` before trusting this file.

---

## Blockers

- Remote service deployment requires the owner's hosting-platform account access.
- MCP registration requires the owner to enter the server URL and auth token.
- Neither is something an agent can do unilaterally.

---

## Hypotheses not yet tested

- Whether MonkeyCode can call a remote ai-memory MCP server once one exists.
- Whether MonkeyCode outbound HTTPS to a future memory URL is allowed.
- End-to-end Claude ↔ Codex handoff (blocked on Layer B).

Confirmed this session: MonkeyCode loads `AGENTS.md`; remote MCP tools are absent here.

---

*Next incoming agent: read this, then run `git log --oneline -5` and `git status` to*
*verify state before acting. Do not trust this document over actual code.*
