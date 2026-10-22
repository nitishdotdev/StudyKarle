# StudyKarle — Session Handoff

> Cross-session state. Incoming agents must verify the SHA with `git log`
> before trusting notes. Source code and CI outrank this file.
> Do not commit, push, or merge solely to keep this file current.

---

## Current session status

**Last updated**: 2026-10-21
**Updated by**: MonkeyCode (post-merge ai-memory compatibility audit)
**Last verified commit SHA**: `30f7b22eed3e9a063569a7e77aeac3699e306bd6`
**Branch at audit start**: `main` (clean, tracking `origin/main`)
**Working branch for this audit**: `261021-fix-ai-memory-compatibility`
**Remote memory**: not configured in this runtime (no `ai-memory` CLI, no `memory_*` tools)

---

## High-level objective

Make the PR #21 ai-memory files match the real StudyKarle codebase and define
a sync protocol that works for Claude Code, Codex, and MonkeyCode without
leaking secrets.

---

## What was completed this session

- Verified git: `main` @ `30f7b22` = merge of PR #21 (`feat/studykarle-ai-memory`).
  Shallow clone (`rev-list --count` = 1); `gh` PR/CI listing failed.
- Audited application layout, auth cookies, Drive schema, PDF preview, CI,
  env *names* in tracked examples (no secret values printed).
- Compared pin `akitaonrails/ai-memory:2.0.2` with upstream latest `v3.1.2`.
- Left the 2.0.2 pin in place (D-006). Corrected the linux/amd64 tarball SHA
  comment to the official v2.0.2 checksum.
- Synchronized Layer A docs with code. Tightened `[capture] ignore_paths`.
- Added missing `deploy/ai-memory/.env.example` (placeholders only).
- Recorded MonkeyCode capabilities from this runtime (I-005).

## What was NOT completed

- Remote ai-memory service: not deployed (owner).
- Claude Code / Codex MCP and hooks: not configured (owner).
- Cross-agent remote handoff test: not run (no server). **Do not claim it works.**
- Image tag not moved to 3.x.
- Application business logic unchanged.
- No merge, push, or production change.

---

## Immediate next steps

1. Owner reviews this branch; merge only with explicit approval.
2. Owner decides 2.0.2 vs 3.1.2 *before* first remote deploy (see D-006).
3. Owner follows `SETUP.md` on a persistent host (Render = **one** container,
   not the multi-service Compose file).
4. Owner registers MCP/hooks in Claude Code and Codex locally; never commit tokens.
5. After a real server exists, run a Claude → Codex handoff test and record
   the result in this file.

---

## Blockers

- Remote Layer B needs the owner's host, token, and TLS.
- This MonkeyCode runtime has no MCP memory tools (I-005).
- Shallow git history cannot date D-001–D-004.

---

## Tests this session

- `bash -n` on `validate.sh`, `bootstrap.sh`, `status.sh`, `handoff-prep.sh`: OK.
- `bash scripts/ai-memory/validate.sh`: exit 0, PASS 24, FAIL 0, WARN 3
  (no docker compose; no ai-memory CLI — expected here).
- Secret-pattern scan of this session's changed files: no hits.
- Application `npm test` / `npm run build` not run (doc/config only).

---

*Verify `git log -1` and `git status` before acting.*
