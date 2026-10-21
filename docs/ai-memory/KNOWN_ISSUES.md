# StudyKarle — Known Issues

> Keep confirmed root causes separate from hypotheses.
> Record symptoms, reproduction steps, affected component, attempts made, and current status.
> Never record an issue as fixed unless there is verified evidence (CI pass, confirmed in prod).

---

## RESOLVED issues (kept for historical reference)

### I-001 — Mobile / incognito authentication failure [RESOLVED]

**Symptom**: Users on mobile browsers or in incognito mode were logged out unexpectedly
or could not log in at all.

**Affected component**: Cookie-based session auth; Vercel deployment configuration.

**Root cause (confirmed)**: Session cookies were blocked by third-party cookie restrictions
on mobile browsers. The original `sameSite` setting combined with cross-origin delivery
caused cookies to be rejected.

**Fix applied**: `sameSite: lax` cookie configuration + Vercel rewrite rules to deliver
the API same-origin from the client's perspective.

**Status**: RESOLVED. Do not revert the rewrite rules or cookie config.

---

### I-002 — PDF preview failure on mobile [RESOLVED]

**Symptom**: PDFs failed to render in mobile browsers.

**Affected component**: Frontend PDF viewer component.

**Root cause (confirmed)**: `<iframe src="blob:...">` URLs are blocked on mobile Safari
and some other mobile browsers due to security restrictions on blob URLs in iframes.

**Fix applied**: Replaced iframe with `pdfjs-dist` canvas renderer.

**Status**: RESOLVED. Do not revert to iframe blob URLs.

---

### I-003 — Drive sync crash on duplicate folder names [RESOLVED]

**Symptom**: Google Drive sync crashed when two folders had the same name but different
parent folders.

**Affected component**: Drive sync service; `drive_nodes` (or equivalent) database table.

**Root cause (confirmed)**: Uniqueness constraint on folder name alone (not scoped to
parent), causing constraint violation when syncing Drive folders with shared names
under different parents.

**Fix applied**: Updated uniqueness constraint to scope to `(name, parent_id)` or
equivalent. Drive sync rewritten to use flexible `drive_nodes` hierarchy.

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

---

### I-005 — MonkeyCode ai-memory integration unverified [INVESTIGATING]

**Symptom**: MonkeyCode is not in the ai-memory support matrix. It is unknown whether
MonkeyCode reads AGENTS.md automatically, supports outbound HTTP to the remote service,
or allows custom MCP configuration.

**Affected component**: MonkeyCode coding environment.

**Attempts so far**:
- None yet — requires a MonkeyCode session to test.

**Current best fallback**: AGENTS.md (Layer A) and repository memory files.

**Next step**: In a MonkeyCode session, verify:
1. Whether `AGENTS.md` is read at session start.
2. Whether outbound HTTPS to the memory service URL succeeds.
3. Whether MCP tool calls resolve correctly.

---

*Add new issues above this line with the next sequential ID (I-006, I-007, ...).*
*Move resolved issues to the RESOLVED section with the resolution evidence.*
