# StudyKarle — Known Issues

> Keep confirmed root causes separate from hypotheses.
> Record symptoms, reproduction steps, affected component, attempts, and status.
> Never mark an issue fixed without evidence (CI pass, confirmed in prod, or current source).

---

## RESOLVED issues (kept for historical reference)

### I-001 — Mobile / incognito authentication failure [RESOLVED — current code inspected]

**Symptom (historical)**: Users on mobile browsers or in incognito mode were logged out
or could not log in.

**Affected component**: JWT cookie auth; Vercel `/api` rewrite.

**Current code (verified 2026-10-21)**:
- Auth cookie `studykarle_token` is HttpOnly (`server/src/services/tokenService.js`).
- Production: `SameSite=None; Secure; Partitioned`.
- Non-production: `SameSite=Lax`.
- CSRF cookie uses the same production `none` / non-production `lax` split
  (`server/src/middleware/csrfProtection.js`).
- `client/vercel.json` rewrites `/api/*` to `https://studykarle-backend.onrender.com/api/$1`.

**Correction**: Earlier memory claimed the production fix was `sameSite: lax`.
That does **not** match current production cookie flags.

**Status**: RESOLVED in current source. Do not revert the Vercel rewrite or
cookie flags without an explicit auth review.

---

### I-002 — PDF preview failure on mobile [RESOLVED]

**Symptom**: PDFs failed to render in some mobile browsers.

**Affected component**: Frontend PDF viewer.

**Current code (verified)**: `client/src/components/notes/PdfPreview.jsx` uses
`react-pdf` (`Document` / `Page`) and `pdfjs-dist` 3.11 with worker
`/pdf.worker.min.js`. No iframe in `client/src`.

**Historical cause** (iframe + blob URL) is **not** in this shallow clone;
the current renderer is the evidence that the iframe path is gone.

**Status**: RESOLVED. Do not revert to iframe blob URLs.

---

### I-003 — Drive sync uniqueness [RESOLVED — schema inspected]

**Symptom (historical)**: Drive sync failed when two folders shared a name under
different parents.

**Affected component**: Drive sync; `drive_nodes` / `units`.

**Current schema (verified)**:
- `drive_nodes.drive_id` is unique. `name` is not unique.
- Duplicate names under different parents are allowed.
- `units` dropped constraint `units_subject_id_name_unique` and uses unique
  `drive_folder_id` where present
  (`server/src/db/migrations/20260808000001_create_drive_sync_tables.js`).

**Correction**: Earlier memory claimed uniqueness was `(name, parent_id)`.
That is **not** the current `drive_nodes` schema.

**Status**: RESOLVED in current schema. See `DECISIONS.md` D-001 and D-004.

---

## OPEN issues

### I-004 — Remote ai-memory service not yet deployed [BLOCKED — owner action]

**Symptom**: Cross-agent MCP handoffs cannot run. Layer A (`docs/ai-memory/`)
is the only memory that exists in git.

**Affected component**: ai-memory infrastructure (dev tooling only).

**Status**: BLOCKED. See `docs/ai-memory/SETUP.md` owner checklist.

**Next step**: Owner provisions a persistent host, sets `AI_MEMORY_AUTH_TOKEN`
in that host's secret store, and registers the profile **locally** in each
coding environment. Do not commit URL or token. Do not add `server =` to
`.ai-memory.toml`.

---

### I-005 — MonkeyCode uses Layer A only [CONFIRMED in this runtime]

**Date**: 2026-10-21

**Symptom**: MonkeyCode is not in the upstream ai-memory support matrix.

**This runtime (MonkeyCode session on 2026-10-21)**:
1. `AGENTS.md` **is** injected as agent instructions. Confirmed.
2. No `memory_*` MCP tools are available. Confirmed.
3. `ai-memory`, `claude`, and `codex` CLIs are **not** installed. Confirmed.
4. Outbound HTTPS to a memory service URL was **not** tested because no
   remote service is deployed (I-004).

**Fallback**: Read and update `docs/ai-memory/` (Layer A). Never claim a
remote MCP handoff succeeded from MonkeyCode in this environment.

**Next step**: Re-test only after I-004 is done **and** the platform exposes
MCP. Until then, treat MonkeyCode as Layer A only.

---

### I-006 — Duplicate marker files [OPEN]

**Symptom**: Both `.ai-memory.toml` and `ai-memory.toml` exist at the repo
root with the same contents.

**Affected component**: ai-memory marker resolution.

**Fact**: Official docs use `.ai-memory.toml`. The undotted `ai-memory.toml`
is extra. Whether the 2.0.2 CLI also reads the undotted name is
`[UNVERIFIED]` here (CLI not installed).

**Next step**: Keep both files identical until the owner deletes one.
Do not add a `server` key to either.

---

*Add new issues above this line with the next sequential ID (I-007, ...).*
*Move resolved issues to the RESOLVED section with evidence.*
