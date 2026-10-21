# StudyKarle — Engineering Decisions

Each entry records a significant decision, the context behind it, alternatives considered,
and the outcome. Mark entries `[CURRENT]`, `[SUPERSEDED]`, or `[UNVERIFIED]`.

Do not invent historical reasoning from the mere existence of code.

---

## D-006 — Keep ai-memory pin at 2.0.2 until an owner-approved first deploy [CURRENT]

**Date**: 2026-10-21

**Context**:
PR #21 pinned `akitaonrails/ai-memory:2.0.2`. Upstream latest at audit time is
`v3.1.2`. 3.0 is a major release: schema migrations V77–V80, removal of 1.x
user-token commands, forward-only data directories
(https://github.com/akitaonrails/ai-memory/blob/main/docs/upgrading-to-3.0.md).
No remote service is deployed yet, so this would be a first install, not an
in-place upgrade.

**Decision**:
Leave the repository pin at **2.0.2**. Do not retag Compose or install scripts
to 3.x without an explicit owner choice. Document that a greenfield deploy
may start on 3.1.2 instead; that is an owner action.

**Reason**:
Changing the pin without a live compatibility test would mix unproven 3.x
server/client/hook behavior into docs that currently describe 2.0.2 artifacts.

**Evidence**: `deploy/ai-memory/docker-compose.yml`; GitHub releases for
v2.0.2 (2026-09-03) and v3.1.2 (2026-10-20).

---

## D-002 — Auth cookie flags and Vercel `/api` rewrite [CURRENT]

**Date**: [code inspected 2026-10-21; original change date not in this shallow clone]

**Context**:
The browser origin is Vercel (`www.studykarle.me`); the API host is Render.
`client/vercel.json` rewrites `/api/*` to the Render backend so the browser
treats API calls as same-origin.

**Decision (current code)**:
- Production auth cookie: `SameSite=None; Secure; Partitioned`
  (`server/src/services/tokenService.js`).
- Non-production auth cookie: `SameSite=Lax`.
- CSRF cookie uses the same production `none` / non-production `lax` split.

**Supersedes**: the earlier memory claim that production used `sameSite: lax`
and that `sameSite: none` had been rejected.

**Verification**: current `tokenService.js` and `csrfProtection.js`. Why the
code moved from whatever came before is **not** recorded in this shallow
history (`git rev-list --count HEAD` is 1).

---

## D-001 — Drive sync: flexible `drive_nodes` table [CURRENT]

**Date**: [UNVERIFIED — this checkout is a shallow clone of the merge commit]

**Context**:
The library UI mirrors Google Drive. A fixed-depth academic hierarchy cannot
represent arbitrary Drive trees.

**Decision**:
Store the tree in `drive_nodes` with parent-child `parent_drive_id` and
**unique `drive_id`**. No fixed depth.

**Verification**:
`server/src/db/migrations/20260808000001_create_drive_sync_tables.js`.
Root `README.md` describes the same model.

**Not verified here**: the narrative that a four-level schema was rewritten
in a specific incident. That story is consistent with comments in the
migration (`units` dropped `(subject_id, name)` uniqueness) but the old
production incident itself is not in this git history.

---

## D-003 — PDF preview: `react-pdf` / `pdfjs-dist` canvas [CURRENT]

**Date**: [UNVERIFIED]

**Context**:
iframe + blob URLs fail on some mobile browsers.

**Decision**:
Render with `react-pdf` (`Document` / `Page`) and a `pdfjs-dist` 3.11 worker
at `/pdf.worker.min.js`. No iframe in `client/src`.

**Verification**: `client/src/components/notes/PdfPreview.jsx`,
`client/package.json`.

---

## D-004 — Drive node identity is Drive id, not folder name [CURRENT]

**Date**: [UNVERIFIED]

**Context**:
Earlier memory claimed a uniqueness fix on `(name, parent_id)`.

**Decision (current schema)**:
`drive_nodes.drive_id` is unique. `name` is not unique. Duplicate names under
different parents are distinct nodes because they have different Drive ids.

**Verification**: `20260808000001_create_drive_sync_tables.js` — unique on
`drive_id` only. There is **no** unique constraint on `(name, parent_drive_id)`.

The `(name, parent_id)` wording is therefore **not** the current schema.
Whether an older table used name uniqueness is not evidenced in this clone.

---

## D-005 — AI memory infrastructure: hybrid three-layer architecture [CURRENT]

**Date**: 2026-10-21

**Context**:
Work happens in Claude Code, Codex, and MonkeyCode. Sessions are ephemeral.

**Decision**:
- **Layer A** (GitHub-native, **authoritative**): `docs/ai-memory/`.
- **Layer B** (optional remote): `akitaonrails/ai-memory` v2.0.2 on a
  persistent host. Not deployed.
- **Layer C**: `CLAUDE.md` + `AGENTS.md` protocol. MCP/hooks only where the
  agent actually supports them.

Remote summaries must not overwrite Layer A. If remote is down, say so and
use Layer A.

**Trade-offs**:
- Layer B needs owner hosting and tokens.
- MonkeyCode is not in the upstream support matrix; this runtime has no
  `memory_*` MCP tools (see I-005).

---

*Add new decisions above this line. Oldest entries toward the bottom.*
