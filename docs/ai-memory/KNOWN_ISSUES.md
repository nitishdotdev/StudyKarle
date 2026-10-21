# StudyKarle — Known Issues

> Keep confirmed root causes separate from hypotheses.
> Record symptoms, reproduction steps, affected component, attempts made, and current status.
> Never record an issue as fixed unless there is verified evidence (CI pass, confirmed in prod).

---

## RESOLVED issues (kept for historical reference)

### I-001 — Mobile / incognito authentication failure [RESOLVED]

**Symptom**: Users on mobile browsers or in incognito mode were logged out unexpectedly
or could not log in at all.

**Affected component**: Cookie-based session auth; split Vercel frontend / Render backend.

**Root cause (confirmed)**: Session cookies were blocked by third-party cookie restrictions
when the SPA origin and API origin differed.

**Fix applied**: Production auth and CSRF cookies are `SameSite=None; Secure; Partitioned`
(`server/src/services/tokenService.js`, `server/src/middleware/csrfProtection.js`).
`client/vercel.json` rewrites `/api/*` to `https://studykarle-backend.onrender.com`.
Local cookies remain `SameSite=Lax`.

**Status**: RESOLVED in code. Do not revert cookie flags or the rewrite.
Earlier memory notes that claimed production `sameSite: lax` are stale.

---

### I-002 — PDF preview failure on mobile [RESOLVED]

**Symptom**: PDFs failed to render in mobile browsers.

**Affected component**: Frontend PDF viewer component.

**Root cause (confirmed)**: `<iframe src="blob:...">` URLs are blocked on mobile Safari
and some other mobile browsers due to security restrictions on blob URLs in iframes.

**Fix applied**: Replaced iframe with `pdfjs-dist` / `react-pdf` canvas renderer.

**Status**: RESOLVED. Do not revert to iframe blob URLs.

---

### I-003 — Drive sync crash on duplicate folder names [RESOLVED]

**Symptom**: Google Drive sync crashed when two folders had the same name but different
parent folders.

**Affected component**: Drive sync service; `drive_nodes` table.

**Root cause (confirmed)**: Uniqueness constraint on folder name alone (not scoped to
parent or Drive id).

**Fix applied**: `drive_nodes.drive_id` is unique. Duplicate names under different
parents are allowed. See migration `20260808000001_create_drive_sync_tables.js`.

**Status**: RESOLVED. Architecture note in `DECISIONS.md` D-001 and D-004.

---

## OPEN issues

### I-004 — Remote ai-memory service not yet deployed [BLOCKED — owner action required]

**Symptom**: Cross-agent handoffs rely on the Layer A (repository files) fallback only.
Automatic capture and MCP-based memory retrieval are unavailable.

**Affected component**: ai-memory infrastructure (dev tooling only; does not affect
the StudyKarle application for users).

**Status**: BLOCKED. See `docs/ai-memory/SETUP.md` → Owner-only checklist.

**Next step**: Owner must provision the remote service on a persistent container host,
set the auth token, and register the server profile in each coding environment.
Do not commit `server` into `.ai-memory.toml`.

---

### I-005 — MonkeyCode ai-memory integration unverified [INVESTIGATING]

**Symptom**: MonkeyCode is not in the ai-memory v2.0.2 support matrix. It is unknown whether
MonkeyCode can call remote MCP tools or reach an owner-deployed memory URL.

**Affected component**: MonkeyCode coding environment.

**Attempts so far**:
- This MonkeyCode session reads `AGENTS.md` (confirmed: agent instructions from `/workspace/AGENTS.md`).
- Remote MCP tools (`memory_handoff_list`, `memory_briefing`) are not available in this session.
- Outbound HTTPS to GitHub raw docs succeeded; no memory service URL exists to probe.

**Current best fallback**: AGENTS.md (Layer A) and repository memory files.
Do not claim cross-agent sync from MonkeyCode until a real handoff round-trip succeeds.

**Next step**: After the owner deploys Layer B, retry MCP from a MonkeyCode session and
record whether `memory_handoff_list` resolves.

---

### I-006 — Duplicate root marker `ai-memory.toml` [RESOLVED in this change set]

**Symptom**: Repo root had both `.ai-memory.toml` (the official marker name) and
`ai-memory.toml` with identical contents. Official docs only search for `.ai-memory.toml`.
The un-dotted file is unused and can drift.

**Affected component**: ai-memory marker / capture policy.

**Fix applied**: Keep `.ai-memory.toml` as the only real marker. Replace
`ai-memory.toml` with a pointer comment (no `workspace` / `project` / `server`
keys) so it cannot be mistaken for a second marker.

**Status**: RESOLVED in this change set. Owner may delete the pointer
file later if desired.

---

*Add new issues above this line with the next sequential ID (I-007, I-008, ...).*
*Move resolved issues to the RESOLVED section with the resolution evidence.*
