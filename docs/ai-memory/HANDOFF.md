# StudyKarle — Session Handoff

> **This is the critical cross-session document.**
> Update it at the end of any session that materially changes project state.
> The incoming agent must verify the recorded SHA against `git log` before trusting any note.
> Source code and CI results take precedence over notes here.

---

## Current session status

**Last updated**: 2026-10-21
**Updated by**: Claude (initial bootstrap — ai-memory infrastructure setup)
**Last verified commit SHA**: [NOT YET COMMITTED — changes are staged locally]
**Branch**: `feat/studykarle-ai-memory` (proposed; confirm on checkout)

---

## High-level objective

Implement persistent AI coding memory infrastructure for StudyKarle so that work started
in Claude Code, Codex, or MonkeyCode can be resumed in any of those environments
without losing architectural context, failed-fix history, or task state.

---

## What was completed this session

- Created `docs/ai-memory/` directory with all required memory documents:
  `README.md`, `PROJECT_CONTEXT.md`, `DECISIONS.md`, `HANDOFF.md` (this file),
  `KNOWN_ISSUES.md`, `OPERATIONS.md`, `SETUP.md`
- Created `.ai-memory.toml` root marker pinning workspace/project scope
- Created `CLAUDE.md` with project context and ai-memory routing block
- Created `AGENTS.md` with project context and ai-memory routing block
- Created `deploy/ai-memory/` with Docker Compose, nginx config, and `.env.example`
- Created `scripts/ai-memory/` with `bootstrap.sh`, `validate.sh`, `status.sh`,
  and `handoff-prep.sh`
- Created `deploy/ai-memory/README.md` with deployment runbook

## What was NOT completed

- Remote ai-memory service has NOT been deployed (requires owner action — see SETUP.md)
- Claude Code MCP registration: NOT configured in cloud workspace (requires owner action)
- Codex MCP registration: NOT configured (requires owner action)
- MonkeyCode integration: NOT verifiable (platform not in ai-memory support matrix;
  falls back to Layer A / AGENTS.md)
- Cross-agent handoff end-to-end test: BLOCKED pending remote service deployment
- Existing `CLAUDE.md` and `AGENTS.md`: [UNVERIFIED — if they already exist in the repo,
  they must be merged rather than replaced; check before pushing]
- Existing `docs/` structure: [UNVERIFIED — adapt file locations if the repo uses
  a different documentation convention]

---

## Changes made (uncommitted)

- `.ai-memory.toml` — NEW
- `CLAUDE.md` — NEW (merge if existing)
- `AGENTS.md` — NEW (merge if existing)
- `docs/ai-memory/README.md` — NEW
- `docs/ai-memory/PROJECT_CONTEXT.md` — NEW
- `docs/ai-memory/DECISIONS.md` — NEW
- `docs/ai-memory/HANDOFF.md` — NEW (this file)
- `docs/ai-memory/KNOWN_ISSUES.md` — NEW
- `docs/ai-memory/OPERATIONS.md` — NEW
- `docs/ai-memory/SETUP.md` — NEW
- `deploy/ai-memory/docker-compose.yml` — NEW
- `deploy/ai-memory/.env.example` — NEW
- `deploy/ai-memory/nginx.conf` — NEW
- `deploy/ai-memory/README.md` — NEW
- `scripts/ai-memory/bootstrap.sh` — NEW
- `scripts/ai-memory/validate.sh` — NEW
- `scripts/ai-memory/status.sh` — NEW
- `scripts/ai-memory/handoff-prep.sh` — NEW
- `.gitignore` — UPDATE needed (add ai-memory data exclusions)

---

## Commands run and results

No application commands were run this session. All work was file-creation only.
No application code, database schema, or production configuration was modified.

---

## Immediate next steps (in priority order)

1. **Inspect the repo** before committing:
   - Does `CLAUDE.md` or `AGENTS.md` already exist? If yes, merge ai-memory blocks.
   - Does a `docs/` directory exist? Confirm `docs/ai-memory/` fits the convention.
   - Does `.gitignore` already exclude `.env` files? Add ai-memory data exclusions.
   - What is the exact directory structure for frontend/backend?
2. **Create a feature branch** (`feat/studykarle-ai-memory`) and commit the new files.
3. **Follow the owner-only checklist** in `docs/ai-memory/SETUP.md` to deploy the remote service.
4. **Register the MCP server** in Claude Code once the remote URL and token are available.
5. **Register the MCP server** in Codex once the remote URL and token are available.
6. **Run `scripts/ai-memory/validate.sh`** to confirm no credentials leaked into tracked files.

---

## Blockers

- Remote service deployment requires the owner's hosting-platform account access.
- MCP registration requires the owner to enter the server URL and auth token.
- Neither is something an agent can do unilaterally.

---

## Hypotheses not yet tested

- Whether MonkeyCode reads `AGENTS.md` automatically (likely yes, but unverified).
- Whether MonkeyCode supports outbound HTTP to the remote ai-memory service.
- Exact directory layout of the StudyKarle repository (memory provides the stack;
  exact file paths require repo inspection).

---

*Next incoming agent: read this, then run `git log --oneline -5` and `git status` to*
*verify state before acting. Do not trust this document over actual code.*
