# StudyKarle AI Memory

This directory holds persistent project memory for coding-agent sessions.
It serves as the **Layer A fallback** — always available in any fresh checkout,
even before the remote ai-memory service is deployed or reachable.

## Files

| File | Purpose | Update when |
|------|---------|-------------|
| `PROJECT_CONTEXT.md` | Stable architecture facts — stack, layout, env vars, commands | Architecture changes, new integrations |
| `DECISIONS.md` | Significant engineering decisions with rationale | A non-obvious technical decision is made |
| `HANDOFF.md` | ⚡ Cross-session handoff — current task, last SHA, blockers, next steps | Any session that changes meaningful state |
| `KNOWN_ISSUES.md` | Evidence-backed bugs and their investigation history | New evidence about a bug appears |
| `OPERATIONS.md` | ai-memory service: deploy, config, backup, troubleshoot | Service configuration changes |
| `SETUP.md` | Full setup guide — architecture, deployment, agent wiring | First-time setup or procedure changes |

## Rules for agents

- **Read `HANDOFF.md` first** when starting substantial work. Verify the recorded SHA
  against `git log` — do not trust handoff notes over actual source code.
- **Update `HANDOFF.md`** at a natural stopping point when state has changed meaningfully.
- **Do not copy raw source files** into these documents. Write concise, navigable context.
- **Mark gaps explicitly** — unknown information is filed as `[UNVERIFIED]` or
  `[NOT INSPECTED]`, never fabricated.
- **Remote memory takes precedence over these files** when both are available and consistent.
  When they conflict, trust the newer actual source code and CI results over any note.

## Remote memory service

When the remote ai-memory service is running:
- Workspace: `nitishdotdev`
- Project: `StudyKarle`
- These files remain the git-auditable fallback.

MonkeyCode in this class of runtime has no `memory_*` tools (I-005).
Use these files. Do not claim a remote handoff from MonkeyCode.

See `SETUP.md` and `OPERATIONS.md`. Pin stays `2.0.2` until the owner
chooses otherwise (D-006).
