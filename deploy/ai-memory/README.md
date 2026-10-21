# ai-memory — Deployment

StudyKarle memory service deployment artifacts.

**Pinned version**: `akitaonrails/ai-memory:2.0.2`
**Default port**: 49374 (internal; nginx handles public TLS on 443)

## Quick start (Docker Compose on a VPS)

```bash
# 1. Clone or copy this directory to your VPS
# 2. Set environment variables
cp .env.example .env
# Edit .env — fill in AI_MEMORY_AUTH_TOKEN at minimum

# 3. Configure nginx.conf — replace YOUR_DOMAIN with your actual domain

# 4. Obtain TLS certificate (Let's Encrypt)
certbot certonly --standalone -d YOUR_DOMAIN

# 5. Start
docker compose up -d

# 6. Verify
docker compose ps
curl -sf https://YOUR_DOMAIN/health
```

## Render.com (recommended for Nitish's stack)

1. **New Web Service** → **Deploy existing image** → `docker.io/akitaonrails/ai-memory:2.0.2`
2. **Start command**: `ai-memory serve --bind 0.0.0.0:49374`
3. **Port**: 49374
4. **Persistent Disk**: mount at `/data` (minimum 1 GB)
5. **Environment variables** (set in Render dashboard — never commit):
   - `AI_MEMORY_AUTH_TOKEN` = 64 hex chars from `openssl rand -hex 32`
   - (optional) `AI_MEMORY_LLM_PROVIDER`, `ANTHROPIC_API_KEY`
6. Note the `.onrender.com` URL — you'll need it for agent configuration.

> Render's free tier spins down after 15 min inactivity. Use the $7/mo Starter
> instance for always-on behavior.

## Files in this directory

| File | Purpose |
|------|---------|
| `docker-compose.yml` | Service definition (ai-memory + nginx + backup) |
| `.env.example` | Variable names and safe placeholders |
| `nginx.conf` | TLS reverse proxy configuration |
| `README.md` | This file |

## Upgrading

1. Check [releases](https://github.com/akitaonrails/ai-memory/releases) for the latest version.
2. Update the image tag in `docker-compose.yml`.
3. `docker compose pull && docker compose up -d`

Always back up before upgrading — see `docs/ai-memory/OPERATIONS.md`.

## Security

- `AI_MEMORY_AUTH_TOKEN` must be kept secret; it is the sole credential protecting the MCP endpoint.
- ai-memory binds to `127.0.0.1:49374` internally; nginx handles public TLS.
- The `Authorization: Bearer ...` check in nginx is defence-in-depth; ai-memory enforces auth internally.
- All sensitive files are excluded from the StudyKarle repository via `.gitignore`.
