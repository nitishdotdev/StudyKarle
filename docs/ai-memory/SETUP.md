# AI Memory — Setup Guide

This guide explains how to deploy and connect the full three-layer memory infrastructure
for StudyKarle. Work through the sections in order.

---

## Architecture summary

### Layer A — GitHub-native (always available)
Repository files in `docs/ai-memory/`. No external service required.
Works in any fresh cloud workspace the moment the repo is cloned.

### Layer B — Remote ai-memory service
`akitaonrails/ai-memory:2.0.2` running in a persistent Docker container.
Provides automatic session capture, FTS search, and cross-agent handoffs.
Must run on a host with a persistent filesystem — **not** Vercel serverless.

**Recommended host**: Render.com Web Service with Persistent Disk
(alternative: Railway, DigitalOcean, Fly.io, any VPS with Docker)

### Layer C — Coding-agent integrations
MCP server registration + lifecycle hooks wired into Claude Code and Codex.
MonkeyCode uses Layer A only (see MonkeyCode section below).

---

## What is automatic vs. manual

| Step | Automatic | Manual (owner) |
|------|-----------|----------------|
| Layer A (repo memory files) | ✅ In repo | — |
| `.ai-memory.toml` marker | ✅ In repo | — |
| `CLAUDE.md` / `AGENTS.md` routing | ✅ In repo | — |
| Remote service deployment | — | ✅ Owner provisions host |
| Auth token generation | — | ✅ Owner generates + sets |
| TLS / domain setup | — | ✅ Owner configures |
| Server profile registration | — | ✅ Per coding environment |
| Claude Code MCP + hooks | — | ✅ Per environment |
| Codex MCP + hooks | — | ✅ Per environment |
| MonkeyCode MCP | — | ⚠️ Verify manually; fallback to Layer A |

---

## Owner-only checklist (execute in order)

### Step 1 — Generate an auth token

On any machine:
```bash
openssl rand -hex 32
# Copy the output — this is AI_MEMORY_AUTH_TOKEN
```

Never share this token in chat, in tracked files, or in issue comments.

---

### Step 2 — Deploy the remote service

**Option A: Render.com (recommended)**

1. In your Render dashboard, create a new **Web Service**.
2. Choose **Deploy an existing image** and enter:
   ```
   docker.io/akitaonrails/ai-memory:2.0.2
   ```
3. Set the **Start Command** to:
   ```
   ai-memory serve --bind 0.0.0.0:49374
   ```
4. Under **Environment**, add:
   ```
   AI_MEMORY_AUTH_TOKEN = <your token from Step 1>
   ```
   (Add LLM keys here too if you want consolidation features.)
5. Under **Disks**, add a **Persistent Disk** mounted at `/data`, minimum 1 GB.
6. Set the port to `49374`.
7. Deploy. Note the service URL (e.g., `https://studykarle-memory.onrender.com`).

> Render's free tier spins down after inactivity. Use a paid instance ($7/mo Starter)
> to keep the service always-on, or accept the cold-start delay.

**Option B: Docker Compose on a VPS / Railway / Fly.io**

Copy `deploy/ai-memory/` to your host and follow `deploy/ai-memory/README.md`.
Key requirement: the `/data` volume must be persistent across container restarts.

---

### Step 3 — Verify the remote service is reachable

```bash
# Replace with your actual service URL
curl -sf -H "Authorization: Bearer YOUR_TOKEN" \
     https://YOUR_SERVICE_URL/health
# Should return 200 and a JSON status block
```

---

### Step 4 — Install the ai-memory CLI in your coding environment

In each coding environment (Claude Code terminal, Codex environment, etc.):

```bash
# Install the wrapper (checks SHA-256 before installing)
mkdir -p ~/.local/bin
curl -fsSL \
  https://github.com/akitaonrails/ai-memory/releases/download/v2.0.2/ai-memory-wrapper \
  -o /tmp/ai-memory-wrapper

curl -fsSL \
  https://github.com/akitaonrails/ai-memory/releases/download/v2.0.2/ai-memory-wrapper.sha256 \
  -o /tmp/ai-memory-wrapper.sha256

# Verify checksum (Linux)
sha256sum --check /tmp/ai-memory-wrapper.sha256

install -m 0755 /tmp/ai-memory-wrapper ~/.local/bin/ai-memory

# Start the local relay (if not using a remote-only setup)
# Or point directly at the remote server (see Step 5)
```

> If the cloud environment discards `~/.local/bin` between sessions, use the
> `scripts/ai-memory/bootstrap.sh` script — it re-installs idempotently.

---

### Step 5 — Register the remote server profile

In each coding environment:

```bash
# Register the remote server (one time per environment)
ai-memory server add studykarle-memory \
  --url https://YOUR_SERVICE_URL \
  --root /path/to/StudyKarle/checkout \
  --auth-token-stdin
# Type or paste your token, then press Enter + Ctrl-D

# Verify
ai-memory status --server studykarle-memory
```

Do **not** add `server = "studykarle-memory"` to the committed `.ai-memory.toml`.
That key is machine-local: a shared marker that names a profile missing on
another checkout fails closed (no capture, no handoff). Register the profile
in each environment; leave the committed marker as `workspace` + `project` only.

---

### Step 6 — Install Claude Code integration

In the Claude Code terminal (cloud or local):

```bash
# Install MCP server registration
ai-memory install-mcp --client claude-code --apply

# Install lifecycle hooks
ai-memory install-hooks --agent claude-code --apply

# Verify
ai-memory status
claude mcp list   # should include the ai-memory MCP server
```

If the cloud environment resets configuration between sessions, run
`scripts/ai-memory/bootstrap.sh` at the start of each session, or configure
the MCP server via Claude Code's project-level `.mcp.json` with the server URL
and auth token injected from environment variables.

**Project-level MCP (portable, non-secret configuration)**:

In `.claude/mcp.json` (not committed — add to `.gitignore`):
```json
{
  "mcpServers": {
    "ai-memory": {
      "url": "https://YOUR_SERVICE_URL/mcp",
      "headers": {
        "Authorization": "Bearer ${AI_MEMORY_AUTH_TOKEN}"
      }
    }
  }
}
```

Store `AI_MEMORY_AUTH_TOKEN` in the environment, not in the file.

---

### Step 7 — Install Codex integration

In the Codex environment:

```bash
# Install MCP server
ai-memory install-mcp --client codex --apply

# Install lifecycle hooks
ai-memory install-hooks --agent codex --apply

# Verify
ai-memory status
```

Codex MCP configuration is in `~/.codex/config.toml` (or `$CODEX_HOME/config.toml`).
If `CODEX_HOME` is set in your environment, the hooks installer uses that path.

---

### Step 8 — MonkeyCode

MonkeyCode is **not** in ai-memory's support matrix as of v2.0.2.
Findings from a MonkeyCode session on 2026-10-21 are in `KNOWN_ISSUES.md` I-005:

- `AGENTS.md` **is** injected as agent instructions.
- No `memory_*` MCP tools exist in that runtime.
- `ai-memory` / `claude` / `codex` CLIs were not installed.
- Outbound HTTPS to a memory URL was not tested (no remote service; I-004).

**Required approach**: Layer A only (`docs/ai-memory/`). Do not instruct
MonkeyCode to call MCP tools that are not present. Re-test MCP only after
I-004 and after the platform actually exposes those tools.

---

### Step 9 — Test end-to-end

```bash
# Run the validation script
bash scripts/ai-memory/validate.sh

# Test memory write and retrieval
ai-memory memory write "test: bootstrap complete for StudyKarle" \
  --workspace nitishdotdev --project StudyKarle

ai-memory memory query "bootstrap" \
  --workspace nitishdotdev --project StudyKarle

# Test handoff creation (from Claude Code session)
# memory_handoff_begin via MCP tools, then retrieve from Codex session
```

---

## Testing retrieval and cross-agent handoffs

1. In Claude Code: call `memory_handoff_begin` at end of a test session.
2. In a new Codex session: call `memory_handoff_list` — verify the handoff appears.
3. Confirm the handoff scope is `workspace=nitishdotdev project=StudyKarle`.
4. In a separate project checkout (different repo): confirm you cannot retrieve
   StudyKarle's handoffs without specifying `global=true`.

---

## Diagnosing failures

```bash
# Run the status script
bash scripts/ai-memory/status.sh

# Common checks
ai-memory status
docker compose -f deploy/ai-memory/docker-compose.yml ps
docker compose -f deploy/ai-memory/docker-compose.yml logs ai-memory --tail=100
```

See `OPERATIONS.md` for detailed troubleshooting.

---

## Security notes

- The auth token is the only credential protecting the MCP endpoint.
  Use a 32-byte (64 hex character) random token.
- TLS is required for remote access. The nginx config in `deploy/ai-memory/nginx.conf`
  handles TLS termination.
- The `.ai-memory.toml` marker is committed; it contains only workspace/project
  names and capture exclusions — no credentials and no `server` key.
- `deploy/ai-memory/.env.example` contains only variable names, no values.
- `.claude/mcp.json` is gitignored; it may contain the server URL (non-secret) but
  the token is injected from the environment.
- If an agent ever writes a token or credential to a memory page, call
  `ai-memory memory delete-page <path>` immediately and rotate the token.
