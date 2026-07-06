# What this project is

DrawVault — a production Document Management System for Unique Properties. Manages construction
drawings, transmittals, folder trees, and revision history across multiple projects.

**Production deploys automatically from `main`:** frontend → Vercel
(https://drawing-management-delta.vercel.app), backend → Railway. A push to `main` is a deploy.

# Stack

React 19 + Vite + Tailwind (`dms-frontend`) · Node/Express + better-sqlite3 (`dms-backend`) ·
Cloudflare R2 for files · JWT auth. Plain JavaScript throughout — no TypeScript.

# Structure

- `dms-backend/` — Express API (`server.js`), SQLite DB, jest tests in `__tests__/`
- `dms-frontend/` — React SPA (`src/`), Capacitor `ios/`/`android/` shells (untracked on main)
- `docs/` — `ARCHITECTURE.md` (API/schema/env reference), `RESTORE.md` (backup restore runbook)
- `src/` at repo root — **legacy copy of the frontend, dead since the initial commit.
  Never edit it; the live code is `dms-frontend/src`.**
- `dms-dashboard.html`, `stitch-screens/`, `artifacts/`, `design_handoff_*` — prototypes only

# Commands

- Backend dev: `cd dms-backend && npm run dev` (nodemon, port 3000)
- Frontend dev: `cd dms-frontend && npm run dev` (port 5174 — not 5173)
- Tests: `npm test` in each app (backend: jest, frontend: vitest)
- Lint: `npm run lint` in each app
- Frontend build: `cd dms-frontend && npm run build`

# Rules for this repo

- **Branch discipline: website/backend changes → `main`; Android app work → `android-app`.**
  Check the active branch before editing. The branches have diverged — port backend changes
  surgically, never merge wholesale.
- Three roles: Director (everything), In House Architect (documents + write), Project Team
  (read-only documents). Every new endpoint needs the right middleware (`requireDirector`,
  `requireWriteAccess`, `requireProjectAccess`); every new UI action needs the matching role gate.
- Re-fetch drawings/transmittals after every mutation — never optimistic append.
- Never commit: `dms.db`, `uploads/`, `.env`, `dist/`, build artifacts.
- Never expose secrets outward: `GET /api/projects` returns a `slackConfigured` boolean, never
  the webhook URL; Slack messages carry metadata only, never R2 file links.

# Gotchas

- Folder trees are one JSON blob per project (`project_folder_trees`), replaced atomically.
- `allowed_projects`: `'*'` = all projects, or a JSON array string like `'[1,3]'`.
- Daily DB backups run at 02:00 Dubai → private R2 bucket; restore runbook: `docs/RESTORE.md`.

# Reference

Full API endpoint tables, DB schema, middleware, env vars, Slack/email/R2 details, and
feature-by-feature frontend architecture live in **`docs/ARCHITECTURE.md`**. Read the relevant
section before touching auth, transmittals, or the upload path.
