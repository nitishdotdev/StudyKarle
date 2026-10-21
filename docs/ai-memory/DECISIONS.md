# StudyKarle — Engineering Decisions

Each entry records a significant decision, the context behind it, alternatives considered,
and the outcome. Mark entries `[CURRENT]`, `[SUPERSEDED]`, or `[UNVERIFIED]`.

---

## D-006 — Committed `.ai-memory.toml` must not contain `server` [CURRENT]

**Date**: 2026-10-21

**Context**:
Official marker docs allow `server = "<profile-name>"` so hooks route capture to a
locally registered profile. That profile exists only on machines where
`ai-memory server add` has been run. MonkeyCode, fresh cloud containers, and
teammate checkouts do not have that profile. A committed `server` key fail-closes
hooks on those machines (unknown profile → no capture, no handoff).

**Decision**:
Keep the committed marker to `workspace` + `project` + `[capture].ignore_paths`.
Register `studykarle-memory` per environment; do not commit `server`.

**Alternatives considered**:
- Commit `server = "studykarle-memory"` after owner deploys (rejected: breaks
  environments that have not registered the profile; SETUP originally recommended this)
- Per-checkout untracked overlay (unnecessary if hooks use the install-default server)

**Reason**:
Layer A must work in any clone. Profile routing is machine-local.

**Verification**: Official `docs/marker-file.md` — marker can only choose among
servers the operator registered; unknown profile fail-closes.

---

## D-001 — Drive sync: flexible `drive_nodes` table [CURRENT]

**Date**: 2026-08-08 (migration `20260808000001_create_drive_sync_tables.js`)

**Context**:
The original architecture used a rigid four-level folder hierarchy for Google Drive sync.
This broke when content had more or fewer nesting levels than expected.

**Decision**:
Replace the rigid hierarchy with a flexible `drive_nodes` table that supports arbitrary
nesting depth using a parent-child adjacency model (`parent_drive_id`).

**Alternatives considered**:
- Normalize to four levels by truncating/expanding paths (rejected: data loss, complexity)
- Nested set model (rejected: expensive updates on large trees)

**Reason**:
Eliminates structural assumptions about Drive folder depth; accommodates any user's
real Drive organization.

**Trade-offs**:
- Recursive queries needed for tree traversal (handle with CTEs or application-level recursion)
- Slightly more complex migration from the old schema

**Verification**: Confirmed in `server/src/db/migrations/20260808000001_create_drive_sync_tables.js`
and `README.md` architecture section.

---

## D-002 — Cookie auth: production CHIPS cookies + Vercel `/api` rewrite [CURRENT]

**Date**: verified 2026-10-21 in `server/src/services/tokenService.js`

**Context**:
The SPA is on Vercel (`www.studykarle.me`) and the API is on Render
(`studykarle-backend.onrender.com`). Cross-site cookies are blocked unless they
are `SameSite=None; Secure` and, under CHIPS, `Partitioned`. An earlier note that
production cookies are Lax-only is wrong.

**Decision**:
- Production auth and CSRF cookies: `SameSite=None; Secure; Partitioned`
- Local cookies: `SameSite=Lax`
- `client/vercel.json` rewrites `/api/*` to the Render backend so relative `/api`
  calls can stay on the frontend origin when `VITE_API_URL` is unset

**Alternatives considered**:
- Switch to token-based auth (JWT in localStorage) — rejected: scope too large, XSS risk
- Production `SameSite=Lax` only — rejected: Lax cookies are not sent on cross-site
  XHR/fetch to the Render host
- Serve API on Vercel serverless — rejected: Express + Drive + Postgres is a long-running Node service

**Reason**:
Preserves HTTP-only cookie sessions across two production hosts; CHIPS `Partitioned`
is required as third-party cookies are phased out.

**Trade-offs**:
Removing `Partitioned`, `Secure`, or the Vercel rewrite can silently break mobile /
incognito / Chrome auth.

**Verification**: `server/src/services/tokenService.js`, `server/src/middleware/csrfProtection.js`,
`client/vercel.json`.

---

## D-003 — PDF preview: `pdfjs-dist` canvas renderer [CURRENT]

**Date**: [UNVERIFIED exact commit — present in `client/package.json`]

**Context**:
The original PDF preview used `<iframe src="blob:...">` URLs. This approach fails on
mobile Safari and some other mobile browsers due to blob URL security restrictions.

**Decision**:
Replace the iframe with a `pdfjs-dist` / `react-pdf` canvas-based renderer that renders
PDF pages directly onto HTML canvas elements.

**Alternatives considered**:
- Direct `<iframe src="https://drive.google.com/...">` — rejected: requires public Drive
  links; breaks with private files
- Google Docs viewer embed — rejected: same public link requirement

**Reason**:
Works on mobile; works with authenticated Drive URLs; avoids blob URL restrictions.

**Trade-offs**:
- Larger bundle size due to `pdfjs-dist`
- Canvas rendering is slightly more complex to implement scroll/zoom

**Verification**: `client/package.json` depends on `pdfjs-dist` and `react-pdf`.

---

## D-004 — Drive sync: uniqueness by Drive id, not folder name [CURRENT]

**Date**: 2026-08-08 (migration `20260808000001_create_drive_sync_tables.js`)

**Context**:
The Drive sync process crashed when it encountered folders with the same name under
different parent nodes. A DB constraint was violated because uniqueness was on name.

**Decision**:
`drive_nodes.drive_id` is unique. Duplicate folder names under different parents are
distinct nodes. Units dropped `(subject_id, name)` uniqueness in favor of Drive folder id.

**Alternatives considered**:
- Rename duplicate folders during sync (rejected: modifies Drive data)
- Skip duplicates silently (rejected: data loss)
- Unique on `(name, parent_id)` only (weaker than Drive id; names can still collide on moves)

**Reason**:
Drive file ids are the stable identity. Real Drive folders can share names at different paths.

**Trade-offs**: None material.

**Verification**: `drive_nodes.drive_id` unique in `20260808000001_create_drive_sync_tables.js`.

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
  Not Vercel serverless (no persistent filesystem).
- **Layer C** (agent integrations): `CLAUDE.md` + `AGENTS.md` routing blocks; MCP registration;
  lifecycle hooks for Claude Code and Codex. MonkeyCode stays on Layer A until MCP is proven.

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

**Verification**: Architecture implemented in-repo (`d96ff40` / PR #21); remote service
deployment still requires owner action. See `SETUP.md` → Owner-only checklist.

---

*Add new decisions above this line. Oldest entries at the bottom.*
