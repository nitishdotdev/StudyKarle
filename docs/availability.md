# StudyKarle availability

This document describes the keep-alive workaround, session-retry behavior, and the paid always-on option. It does not claim that the Free Render service will never sleep or never return HTTP 429.

## Verified backend health URL

Production backend origin (from `client/vercel.json` and `server/.env.example`):

- Health (preferred keep-alive target): `https://studykarle-backend.onrender.com/health`
- Compatibility alias: `https://studykarle-backend.onrender.com/api/health`
- Local: `http://localhost:5000/health` and `http://localhost:5000/api/health`

Both routes are public `GET` handlers. They return HTTP 200 and:

```json
{ "success": true, "data": { "status": "ok" } }
```

They do not require authentication, cookies, or API keys. They do not query the database or send email.

Do not use `/api/auth/me`, login, signup, OTP, or password-reset routes for keep-alive.

## Root cause of idle failures

Render Free web services spin down after about 15 minutes without inbound traffic. The next request waits about a minute for spin-up. Platform routing during that window can return HTTP 429 with `x-render-routing: hibernate-rate-limited` (and an `rndr-id`). That response is from Render, not from StudyKarle's `express-rate-limit` middleware.

The application also has its own 429s for login/OTP abuse. Those are separate, remain enabled, and must not be raised blindly.

An in-process `setInterval` cannot wake a sleeping Free instance. Keep-alive must come from outside Render.

## GitHub Actions keep-alive

Workflow: `.github/workflows/keep-alive.yml`

- Schedule: every 10 minutes at minute offsets 7, 17, 27, 37, 47, 57 (`cron: "7,17,27,37,47,57 * * * *"`).
- Manual run: Actions > Keep-alive > Run workflow (`workflow_dispatch`).
- Runner: `ubuntu-latest`.
- Permissions: `contents: read` only.
- Request: HTTPS GET to the public health URL, User-Agent `StudyKarle-KeepAlive`, connect timeout 10s, total timeout 45s.
- Retries: up to 4 attempts on curl failures, HTTP 429, and HTTP 5xx, with 8s / 16s / 32s delays. No infinite retry.
- Logs: HTTP status and attempt number only. Response bodies are discarded.

Optional override: repository variable `KEEP_ALIVE_URL` (Settings > Secrets and variables > Actions > Variables). Leave unset to use the default production health URL. No secret is required.

Scheduled workflows run only from the default branch after this file is merged there. GitHub may delay cron jobs, skip them on inactive public repositories, or miss a run. This is a best-effort workaround, not an uptime SLA.

### Enable and test

1. Merge the workflow onto the repository default branch (`main`).
2. Open GitHub > Actions > Keep-alive > Run workflow.
3. Confirm the log line `health_ok attempt=N status=200`.
4. Confirm the job did not call `/api/auth/*`.
5. After merge, wait for a scheduled run and inspect the same log line.

If the job fails with `health_failed`, check Render dashboard that the existing `studykarle-backend` service is running, then inspect GitHub Actions for the last HTTP status (000 = network, 429 = platform or app limit, 5xx = application or platform error). Do not dump response bodies.

## Frontend session resilience

`GET /api/auth/me` runs as a single, shared in-flight check per application
initialization. Concurrent consumers (the provider mount, route guards, a
manual retry) reuse the same promise, so one page load issues one request.

- A single logical session check performs **one** request. HTTP 429 is treated
  as a transient failure, is **not** retried automatically, and never clears a
  valid session or cookies. Retrying the platform `hibernate-rate-limited` 429
  only multiplies the burst, so it is deliberately excluded from retries.
- Only transient 5xx (502/503/504) and network errors are retried, with bounded
  exponential backoff and jitter (up to 4 attempts, max wait 8s). `Retry-After`
  is respected up to that cap.
- A documented HTTP 401 follows the unauthenticated flow.
- An initial load whose session status is unknown shows a retry UI instead of
  bouncing to `/login`; the public homepage stays usable.
- Login, signup, OTP, and password-reset POSTs are not retried automatically.
- Aborted/cancelled requests are never retried, and a response that arrives
  after the provider unmounts does not set state.

## Limitations

- Render Free still spins down if keep-alive misses a window, GitHub disables the workflow, or monthly Free instance hours are exhausted (750 hours/month; a process kept awake consumes those hours).
- Platform `hibernate-rate-limited` 429s can still appear during spin-up.
- Application rate limits on auth routes are unchanged.
- Deploys, Render maintenance, database failures, and network issues can still cause downtime on any plan.
- Keep-alive is not always-on hosting.

## Paid always-on option (manual)

Do not purchase or change billing from this repository. To remove Free-plan idle spin-down on the **existing** web service (do not create a second service):

1. Open [Render Dashboard](https://dashboard.render.com) and select the existing backend web service (`studykarle-backend`).
2. Open the service **Compute** page.
3. Under **Compute**, click **Edit**.
4. Select a paid web-service plan (lowest always-on option is `0.5c-512mb`, 0.5 CPU / 512 MB, listed at $7/month on [Render pricing](https://render.com/pricing#compute)).
5. Click **Save**. Render triggers a deploy; the new plan applies after the first successful deploy.
6. Confirm the service is no longer on the Free compute plan.

Official references:

- [Changing a service's compute plan](https://render.com/docs/compute-plans#changing-a-services-compute-plan)
- [Free instance limitations](https://render.com/docs/free)
- [Pricing](https://render.com/pricing)

Upgrading the **workspace** plan does not remove Free compute spin-down. Changing the **service** compute plan removes idle spin-down for that service. It does not guarantee zero downtime from deploys, maintenance, outages, or database failures.

## Deployment and rollback checklist

Before deploying:

- **This feature includes a required database migration:** `20261010000001_auth_google_and_password_reset.js`. The new auth code expects the new `users` columns and OTP/reset/OAuth tables. Do not deploy the new backend code to production without ensuring this migration completes.
- **Google account linking also requires** `20261013000001_create_google_link_challenges.js`. Password login and `GET /api/auth/me` do not need this table. Do not enable production Google linking until this migration has been applied. This repository has no `render.yaml`; confirm in the Render dashboard that `npm run migrate` runs before `npm start` (Build Command on Free, or Pre-Deploy on paid). Do not run production migrate from this checkout.
- Confirm production `NODE_ENV=production` and database connection variables (`DATABASE_URL`, or the configured `DB_*` variables) are available to the migration command.
- If the Render service's root directory is `server`, for a Free service set the Build Command to `npm ci && NODE_ENV=production npm run migrate` and the Start Command to `npm start`. If the root directory is the repository root, use `cd server && npm ci && NODE_ENV=production npm run migrate` as the Build Command and `cd server && npm start` as the Start Command. Preserve any existing required install/build steps and verify the actual root-directory setting before changing commands.
- A paid Render service can use the dedicated pre-deploy command `npm run migrate` when its root directory is `server`; Render does not offer pre-deploy commands or shell access on Free web services. Running the migration in the build command allows a failed migration to stop the deployment before the new code goes live.
- The migration is designed to expand the current schema (new columns/tables and relaxed constraints). Review the Render deploy log and confirm the migration completed before testing the new auth flows.
- Confirm `/health` returns 200 after deployment.
- Confirm GitHub Actions workflow YAML is on the default branch before expecting cron.
- Do not raise auth rate-limit env vars.

Rollback:

- Revert the frontend session-retry and route-guard changes if session checks misbehave.
- Disable or delete `.github/workflows/keep-alive.yml` on the default branch to stop pings.
- Health routes are additive; leaving them in place is safe.
