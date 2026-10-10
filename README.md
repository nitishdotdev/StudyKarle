# StudyKarle

> StudyKarle is a centralized academic resource platform for engineering students. It brings scattered study material — PDFs, notes, and files that usually live across WhatsApp groups, random websites, and broken links — into one organized, trustworthy place.

**This repository is the final StudyKarle v1 release.**

---

## What StudyKarle Is

StudyKarle solves one problem: students waste time hunting for reliable study material. StudyKarle gives every student a single, structured library that is:

- **easy to access** — a fast, responsive web app on any device
- **easy to organize** — content is mirrored exactly as it exists in Google Drive, so the structure always matches the real library
- **easy to trust** — content is managed and moderated by administrators
- **easy to use** — search, save, preview, and download without friction

## Main Features

### For Students

- **Library dashboard** — the Dashboard is a live mirror of the root of the content library, showing real folders and files exactly as they exist
- **Folder/file browsing** — navigate the full content tree at any depth; folders and files are addressed by stable node IDs, so navigation and "Back" always work correctly
- **Search** — full-text search across notes, subjects, and topics with debounced, paginated results
- **PDF preview & download** — fast, range-request streaming with caching, so large PDFs load page-by-page
- **Saved files** — bookmark files for later and manage them from the Saved page
- **Accounts & security** — email-OTP signup, secure login, profile management, and password change

### For Admins

- **Overview** — platform stats, recent uploads, activity log, and Drive sync status with a "Refresh Now" trigger
- **Content library sync** — pull the canonical Google Drive tree into the database on demand or on a schedule
- **Notes management** — upload (single or bulk), edit, and delete notes
- **Subject management** — create and organize subjects
- **User management** — manage users and roles
- **Analytics & view history** — monitor activity and recently viewed materials

## Tech Stack

### Backend (`server/`)

- **Node.js 20** · **Express 4**
- **PostgreSQL** with **Knex** query builder and migrations
- **Google Drive API** (content sync)
- JWT auth with HTTP-only cookies · bcrypt · rate limiting · express-validator
- **Resend** for OTP emails

### Frontend (`client/`)

- **React 18** · **Vite 2**
- **React Router 6** · **Tailwind CSS 3**
- **Axios** · **react-pdf** (pdf.js) for previews

## Architecture

```
Google Drive
    ↓  Drive Sync (recursive, idempotent)
Canonical Content Tree (drive_nodes)
    ↓  /api/drive*  +  /api/admin/drive-sync*
StudyKarle REST API (Express)
    ↓  /api/drive*, /api/notes*, /api/search, /api/saved*, /api/admin*
StudyKarle React client (Vite)
    ↓
Dashboard · Browse · Search · Saved · Preview · Admin
```

The content library is the **single source of truth**. A sync walks the linked Google Drive folder recursively and upserts every node into the `drive_nodes` table, keyed by the stable Drive ID. There are **no fixed depth rules**: folders can nest arbitrarily deep, folders can contain both subfolders and files, and duplicate names at different locations stay distinct. Nothing is flattened, renamed, or forced into a fixed academic structure.

## Getting Started

### Prerequisites

- Node.js 18+ (`.nvmrc` pins 20)
- PostgreSQL 11+
- A Google Cloud project with the Drive API enabled and OAuth credentials
- A Resend API key for OTP emails

### Install

```bash
git clone <repository-url>
cd studykarle

# Backend
cd server
npm install

# Frontend
cd ../client
npm install
```

### Environment Variables

Copy the examples and fill in real values:

```bash
cp server/.env.example server/.env
cp client/.env.example client/.env
```

**`server/.env`** — the complete variable list is documented in `server/.env.example`. Key variables:

| Variable | Purpose |
| --- | --- |
| `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD` | PostgreSQL connection |
| `JWT_SECRET`, `JWT_EXPIRES_IN`, `COOKIE_NAME` | Session signing and cookie name |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REFRESH_TOKEN` | Google Drive API auth |
| `GOOGLE_DRIVE_FOLDER_ID` | Root folder of the content library |
| `DRIVE_SYNC_INTERVAL_MS`, `DRIVE_SYNC_ON_START` | Drive sync scheduler (interval `0` disables the periodic run) |
| `RESEND_API_KEY`, `EMAIL_FROM` | OTP email delivery |
| `AUTH_RATE_LIMIT_WINDOW_MS`, `AUTH_RATE_LIMIT_MAX` | Login/signup failures per IP+email (default 8 / 15 min) |
| `AUTH_IP_RATE_LIMIT_WINDOW_MS`, `AUTH_IP_RATE_LIMIT_MAX` | Login/signup failures per IP across emails (default 40 / 15 min) |
| `OTP_REQUEST_RATE_LIMIT_WINDOW_MS`, `OTP_REQUEST_RATE_LIMIT_MAX` | OTP sends per IP+email (default 5 / 15 min; successes count) |
| `OTP_IP_RATE_LIMIT_WINDOW_MS`, `OTP_IP_RATE_LIMIT_MAX` | OTP sends per IP (default 20 / hour) |
| `SESSION_RATE_LIMIT_WINDOW_MS`, `SESSION_RATE_LIMIT_MAX` | `GET /api/auth/me` (default 120 / 60 s, cookie-hash or IP) |
| `TRUST_PROXY_HOPS` | Trusted proxy hops for `req.ip` (default 1; raise only after proxy-diag) |

**`client/.env`**

```env
VITE_API_URL=http://localhost:5000/api
```

### Database Setup

```bash
cd server
npm run migrate   # applies migrations (baselines existing tables when present)
npm run seed      # seeds baseline year/semester/subject data for admin
```

### Run Locally

```bash
# Backend — http://localhost:5000
cd server
npm run dev

# Frontend — http://localhost:5173
cd ../client
npm run dev
```

- Frontend: `http://localhost:5173`
- Backend API: `http://localhost:5000/api`
- Health check: `http://localhost:5000/api/health`

## Deployment

### Frontend (Vercel)

The `client/` folder includes `vercel.json` with an SPA rewrite and a proxy of `/api/*` to the backend host. Set `VITE_API_URL` to the deployed backend URL and deploy the `client/` directory.

### Backend (Render or any Node host)

1. Provision a PostgreSQL instance and run migrations: `npm run migrate`
2. Set every variable from `server/.env.example` as environment variables (especially `JWT_SECRET`, `GOOGLE_*`, `RESEND_API_KEY`, and the database settings)
3. Start the service: `npm start`

## Important Notes

- **The Drive tree is canonical.** The library UI renders exactly what the sync mirrored — never a manual or hard-coded structure.
- **Drive IDs are authoritative.** Renames, moves, edits, and new files in Drive are reflected on the next sync; deletions are pruned only after a full, error-free walk.
- A PostgreSQL advisory lock ensures only one sync runs at a time.
- Preview/download streaming is cache-aware (ETag + `Content-Range`), so updated files are re-fetched instead of serving stale copies.
- Admin-only endpoints (stats, sync, notes, subjects, users) require an admin account.

## API Overview

- **Auth:** `POST /api/auth/request-otp`, `/verify-otp`, `/resend-otp`, `/login`, `/logout` · `GET /api/auth/me`
- **Content library:** `GET /api/drive` · `GET /api/drive/nodes/:nodeId` · `GET /api/drive/files/:nodeId` (+ `/preview`, `/download`)
- **Notes:** `GET /api/notes/:noteId` (+ `/preview`, `/download`)
- **Search:** `GET /api/search`
- **Saved:** `GET /api/saved` · `GET|POST|DELETE /api/saved/drive/:nodeId` · `POST|DELETE /api/saved/:noteId`
- **User:** `GET|PATCH /api/users/me` · `PATCH /api/users/me/password`
- **Admin:** `GET|POST /api/admin/drive-sync(/status)` · `/api/admin/stats`, `/activity`, `/view-history`, `/notes`, `/subjects`, `/users`
- **Admin support:** `GET /api/years` · `GET /api/years/:yearId/semesters` · `GET /api/subjects/:subjectId/units`

## Scripts

### Backend (`server/`)

- `npm start` — production mode
- `npm run dev` — development mode (nodemon)
- `npm run migrate` — apply pending migrations
- `npm run migrate:rollback` — roll back the last batch
- `npm run seed` — seed baseline data

### Frontend (`client/`)

- `npm run dev` — start the Vite dev server
- `npm run build` — production build
- `npm run preview` — preview the production build

## License

This project is open source. Add your preferred license file at the repository root.

---

**StudyKarle — Organize. Verify. Empower.**
