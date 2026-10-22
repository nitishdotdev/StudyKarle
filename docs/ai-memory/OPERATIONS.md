# ai-memory Service — Operations

Service for workspace `nitishdotdev`, project `StudyKarle`.
This runbook covers deployment, configuration, maintenance, and recovery.

---

## Architecture

```
Claude Code / Codex (MCP, only after owner deploy + local profile)
MonkeyCode          (Layer A files only in this runtime; see I-005)
       │
       │  MCP HTTPS + bearer (Claude/Codex)  |  git files (MonkeyCode)
       ▼
nginx reverse proxy  (port 443 / TLS)   [VPS Compose only]
       │
       ▼
ai-memory server     (port 49374)
       │
       ▼
SQLite + markdown wiki  (persistent volume /data)
```

Render deploy is a single container plus disk. nginx and the backup
profile exist only in the VPS Compose file.

The service runs in a Docker container on a persistent container host
(Render.com recommended; see `SETUP.md` for deployment instructions).
It is completely separate from StudyKarle's customer-facing application.

---

## Configuration

### Required environment variables

Set these in your hosting platform's secret/environment configuration.
**Never put these values into tracked files.**

| Variable | Required | Description |
|----------|---------|-------------|
| `AI_MEMORY_AUTH_TOKEN` | Yes | High-entropy bearer token. Generate with `openssl rand -hex 32`. Used by all agents to authenticate. |
| `AI_MEMORY_LLM_PROVIDER` | No | LLM provider for consolidation (`anthropic`, `openai`, etc.). Omit for zero-LLM mode. |
| `ANTHROPIC_API_KEY` | If LLM used | API key for Anthropic LLM features. |
| `OPENAI_API_KEY` | If LLM used | API key for OpenAI LLM features. |

### Non-secret configuration (in docker-compose.yml)

- Port: 49374 (internal; not published to the internet)
- Data path: `/data` (mapped to a persistent volume)
- TLS termination: nginx reverse proxy on port 443

### Server profile registration (per coding environment)

After the service is live, register it on each machine/environment:

```bash
# Register the server profile (one time per environment)
ai-memory server add studykarle-memory \
  --url https://YOUR_MEMORY_SERVICE_DOMAIN \
  --root /path/to/StudyKarle/checkout \
  --auth-token-stdin
# Paste the token when prompted; it is stored at 0600 under <data_dir>/auth-tokens/

# Verify connectivity
ai-memory status --server studykarle-memory
```

The committed `.ai-memory.toml` marker does NOT store a URL, token, or
`server` profile name. Register `studykarle-memory` locally in each
environment. A committed `server` key would fail closed on machines that
do not have that profile.

---

## Health check

```bash
# From any environment with the CLI installed
ai-memory status

# From the server itself
curl -sf http://localhost:49374/health   # should return 200

# With authentication
curl -H "Authorization: Bearer $AI_MEMORY_AUTH_TOKEN" \
     https://YOUR_MEMORY_SERVICE_DOMAIN/health
```

---

## Backup

### Automated (recommended)

The Docker Compose file includes a `backup` service that runs `ai-memory backup snapshot`
on a schedule. Backups land in the `ai-memory-backups` volume.

### Manual backup

```bash
# On the host running the container
docker exec ai-memory ai-memory backup snapshot --output /data/backup-$(date +%Y%m%d).tar.gz

# Copy to a safe location
docker cp ai-memory:/data/backup-$(date +%Y%m%d).tar.gz ./backup-$(date +%Y%m%d).tar.gz
```

### What is backed up

- SQLite database (`/data/*.db`)
- Markdown wiki tree (`/data/wiki/`)
- Server configuration (`/data/config.toml`)

---

## Restore

```bash
# Stop the service
docker compose down

# Extract backup onto the volume (adjust path as needed)
docker run --rm \
  -v ai-memory-data:/data \
  -v $(pwd):/backup \
  alpine tar xzf /backup/backup-YYYYMMDD.tar.gz -C /data

# Restart
docker compose up -d

# Verify
ai-memory status
```

---

## Upgrade

```bash
# On the host
cd /path/to/deploy/ai-memory

# Pull the new image (edit the version in docker-compose.yml first)
docker compose pull

# Restart with zero-downtime update
docker compose up -d

# Verify
ai-memory status
docker compose logs --tail=50 ai-memory
```

Always pin an explicit version in `docker-compose.yml`. Never use `latest` in production.
Check the [releases page](https://github.com/akitaonrails/ai-memory/releases) for the
current stable release before upgrading.

### Version pinned in this repository

`akitaonrails/ai-memory:2.0.2`
SHA-256 (`ai-memory-linux-x86_64.tar.gz`, official v2.0.2):
`3c39d8d9afad57a34747e6c52a13036b7411de95e4a2b1bbcd11976f4da31a23`
SHA-256 (`ai-memory-wrapper`):
`4b2e5736195f0ac4cd38adf62f25b294922ebf81f5f4802a07803e1abbf9f72d`

Do not retag to 3.x without an owner decision (see `DECISIONS.md` D-006).
A first deploy on Render is **one** container plus a persistent disk, not
the multi-service Compose file (nginx + backup). Compose is for a VPS.

---

## Rollback

```bash
# Edit docker-compose.yml to restore the previous version tag, then
docker compose up -d
```

If the database schema changed incompatibly, restore from backup before rolling back.

---

## Rotating the auth token

1. Generate a new token: `openssl rand -hex 32`
2. Update `AI_MEMORY_AUTH_TOKEN` in the hosting platform's secret store.
3. Restart the container: `docker compose restart ai-memory`
4. Re-register the server profile in each coding environment:
   ```bash
   ai-memory server remove studykarle-memory
   ai-memory server add studykarle-memory \
     --url https://YOUR_MEMORY_SERVICE_DOMAIN \
     --root /path/to/StudyKarle/checkout \
     --auth-token-stdin
   ```
5. Update the MCP registration in Claude Code and Codex with the new token.

---

## Troubleshooting

### Agent cannot connect to memory server

```bash
ai-memory status           # check server URL and reachability
curl -I https://YOUR_MEMORY_SERVICE_DOMAIN/health   # test HTTPS
docker compose logs ai-memory --tail=100            # server-side errors
```

Common causes:
- `AI_MEMORY_AUTH_TOKEN` mismatch between server and client
- nginx TLS certificate expired
- Persistent volume not mounted correctly

### Memory not captured during session

- Verify lifecycle hooks are installed: `ai-memory install-hooks --agent claude-code --dry-run`
- Check that `ignore_paths` in `.ai-memory.toml` is not too broad
- Hooks must be re-installed if the ai-memory binary is upgraded

### Wrong project scope

- Confirm `.ai-memory.toml` is at the repository root: `workspace = "nitishdotdev"`, `project = "StudyKarle"`
- Check for a conflicting marker in a parent directory: `find ~ -maxdepth 5 -name '.ai-memory.toml'`

---

## Decommissioning

1. Take a final backup (see Backup section above).
2. Stop and remove the container: `docker compose down -v` (**warning: `-v` removes volumes**)
   — do not use `-v` if you want to keep the data volume.
3. Remove server profile registrations from each environment:
   `ai-memory server remove studykarle-memory`
4. Remove MCP registrations from Claude Code and Codex.
5. Remove lifecycle hooks from each environment.
6. Archive the `deploy/ai-memory/` directory from the repository if desired.
7. The `docs/ai-memory/` files and `.ai-memory.toml` can remain in the repo as documentation.
