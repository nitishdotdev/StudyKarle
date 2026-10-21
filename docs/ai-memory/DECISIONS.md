# StudyKarle — Engineering Decisions

Each entry records a significant decision, the context behind it, alternatives considered,
and the outcome. Mark entries `[CURRENT]`, `[SUPERSEDED]`, or `[UNVERIFIED]`.

---

## D-001 — Drive sync: flexible `drive_nodes` table [CURRENT]

**Date**: [UNVERIFIED — inspect git log for the commit]

**Context**:  
The original architecture used a rigid four-level folder hierarchy for Google Drive sync.
This broke when content had more or fewer nesting levels than expected.

**Decision**:  
Replace the rigid hierarchy with a flexible `drive_nodes` table that supports arbitrary
nesting depth using a parent-child adjacency model.

**Alternatives considered**:  
- Normalize to four levels by truncating/expanding paths (rejected: data loss, complexity)
- Nested set model (rejected: expensive updates on large trees)

**Reason**:  
Eliminates structural assumptions about Drive folder depth; accommodates any user's
real Drive organization.

**Trade-offs**:  
- Recursive queries needed for tree traversal (handle with CTEs or application-level recursion)
- Slightly more complex migration from the old schema

**Verification**: Confirmed via repository memory — this architectural rewrite resolved
Drive sync crashes.

---

## D-002 — Cookie auth: `sameSite: lax` via Vercel rewrite rules [CURRENT]

**Date**: [UNVERIFIED — inspect git log]

**Context**:  
Session cookies with `sameSite: strict` or cross-origin delivery caused authentication
failures on mobile browsers and in incognito mode due to third-party cookie blocking.

**Decision**:  
Set cookies with `sameSite: lax` and route API calls through Vercel rewrite rules so that
the cookie is always delivered same-origin from the client's perspective.

**Alternatives considered**:  
- Switch to token-based auth (JWT in localStorage) — rejected: scope too large, CSRF risk
- `sameSite: none` + `Secure` — rejected: requires HTTPS everywhere and still blocked
  by some browsers when third-party context is detected

**Reason**:  
Minimal change; preserves session-based auth; fixes mobile and incognito behavior.

**Trade-offs**:  
Vercel rewrites are a deployment concern — removing or changing them silently breaks auth.

**Verification**: Confirmed via repository memory as a resolved issue.

---

## D-003 — PDF preview: `pdfjs-dist` canvas renderer [CURRENT]

**Date**: [UNVERIFIED — inspect git log]

**Context**:  
The original PDF preview used `<iframe src="blob:...">` URLs. This approach fails on
mobile Safari and some other mobile browsers due to blob URL security restrictions.

**Decision**:  
Replace the iframe with a `pdfjs-dist` canvas-based renderer that renders PDF pages
directly onto HTML canvas elements.

**Alternatives considered**:  
- Direct `<iframe src="https://drive.google.com/...">` — rejected: requires public Drive
  links; breaks with private files
- Google Docs viewer embed — rejected: same public link requirement

**Reason**:  
Works on mobile; works with authenticated Drive URLs; avoids blob URL restrictions.

**Trade-offs**:  
- Larger bundle size due to `pdfjs-dist`
- Canvas rendering is slightly more complex to implement scroll/zoom

**Verification**: Confirmed via repository memory as a resolved issue.

---

## D-004 — Drive sync: duplicate folder deduplication [CURRENT]

**Date**: [UNVERIFIED — inspect git log]

**Context**:  
The Drive sync process crashed when it encountered folders with the same name under
different parent nodes. A DB constraint was violated because the uniqueness key was
on name alone rather than on (name, parent_id).

**Decision**:  
Fix the uniqueness constraint to scope by `(name, parent_id)` — or equivalent — so that
duplicate folder names under different parents are accepted as distinct nodes.

**Alternatives considered**:  
- Rename duplicate folders during sync (rejected: modifies Drive data)
- Skip duplicates silently (rejected: data loss)

**Reason**:  
Correct data model; real Drive folders can share names at different paths.

**Trade-offs**: None material.

**Verification**: Confirmed via repository memory as a resolved production constraint bug.

---

## D-005 — AI memory infrastructure: hybrid three-layer architecture [CURRENT]

**Date**: 2026-10-21

**Context**:  
Development happens across Claude Code, Codex, and MonkeyCode in ephemeral cloud workspaces.
Each session loses all context from previous sessions.

**Decision**:  
Implement three layers:
- **Layer A** (GitHub-native): `docs/ai-memory/` markdown files committed to the repo.
  Always available; no external dependency.
- **Layer B** (remote service): `akitaonrails/ai-memory` v2.0.2 Docker image on a persistent
  container host (Render.com recommended). Provides automated capture and cross-agent handoffs.
- **Layer C** (agent integrations): `CLAUDE.md` + `AGENTS.md` routing blocks; MCP registration;
  lifecycle hooks for Claude Code and Codex.

**Alternatives considered**:  
- Manual copy-paste of context between sessions (rejected: error-prone, tedious)
- Vercel serverless for the memory service (rejected: no persistent filesystem)
- Embedding memory service inside StudyKarle's API (rejected: couples dev tooling to
  production app; memory failure could affect users)

**Reason**:  
Layer A always works in fresh containers. Layer B gives automated capture when deployed.
Layer C wires each agent to the same scope without requiring a local machine.

**Trade-offs**:  
- Layer B requires a separate persistent container host and one-time manual setup by the owner.
- MonkeyCode is not in ai-memory's support matrix; it falls back to Layer A only.

**Verification**: Architecture implemented; remote service deployment requires owner action.
See `SETUP.md` → Owner-only checklist.

---

*Add new decisions above this line. Oldest entries at the bottom.*
