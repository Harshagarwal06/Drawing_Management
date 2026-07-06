# DrawVault — Architecture Reference

Deep reference for the DrawVault DMS. Rules and commands live in the repo-root `CLAUDE.md`;
this file holds the detail: API endpoints, DB schema, middleware, env vars, and
feature-by-feature architecture.

---

## Repository structure

```
summer_project/
├── dms-backend/
│   ├── server.js           Node/Express API + SQLite + Cloudflare R2
│   ├── package.json
│   └── dms.db              SQLite database (persisted via Railway volume)
├── dms-frontend/
│   ├── src/
│   │   ├── App.jsx                   Root — routing, auth, state, data fetching
│   │   ├── main.jsx                  BrowserRouter entry point
│   │   ├── constants.js              OVERDUE_PURPOSES, MS_30_DAYS, MEP_SUBTYPES
│   │   └── components/
│   │       ├── AppShell.jsx          Layout: sidebar + header + <Outlet />
│   │       ├── Sidebar.jsx           Nav — DIRECTOR_NAV vs RESTRICTED_NAV
│   │       ├── LoginPage.jsx         JWT login form
│   │       ├── ProtectedRoute.jsx    Redirects unauthenticated users to /login
│   │       ├── Dashboard.jsx         Director-only KPI cards + activity feed
│   │       ├── DocumentsView.jsx     Folder tree + file cards + all modals
│   │       ├── MasterRegisterTable.jsx  Paginated drawing register (Director)
│   │       ├── TransmittalsView.jsx  Transmittal cards + PDF download
│   │       ├── AnalyticsView.jsx     Charts + CSV export
│   │       ├── SettingsView.jsx      Profile, password, user mgmt, project rename
│   │       ├── UploadModal.jsx       File upload (drag-and-drop)
│   │       ├── TransmittalModal.jsx  Create transmittal with free-type recipients
│   │       ├── ProjectModal.jsx      Create new project
│   │       ├── Toast.jsx             Success/error notifications
│   │       └── Field.jsx             Reusable form field wrapper
│   ├── .env                          VITE_API_URL (set in Vercel env vars for prod)
│   ├── vercel.json                   SPA rewrite: all routes → index.html
│   ├── tailwind.config.js
│   └── vite.config.js
└── dms-dashboard.html      Original HTML prototype — reference only
```

---

## Tech stack

| Layer     | Technology |
|-----------|------------|
| Frontend  | React 19, Vite, Tailwind CSS, lucide-react, React Router v6 |
| Backend   | Node.js, Express, better-sqlite3, multer, bcrypt, jsonwebtoken |
| File storage | Cloudflare R2 (S3-compatible) — files served via R2 public URL |
| Email     | Nodemailer (SMTP) — async on transmittal issue |
| PDF       | pdfkit — transmittal cover sheet |
| Database  | SQLite via better-sqlite3 (synchronous), persisted on Railway volume |
| Auth      | JWT (7-day expiry), stored in localStorage, decoded on mount |

---

## Authentication & RBAC

### Roles
| Role | Access |
|------|--------|
| **Director** | Everything: dashboard, register, transmittals, analytics, settings, all file actions, project rename |
| **In House Architect** | Documents only: upload files, edit/rename/delete/move files, upload new revisions |
| **Project Team** | Documents only: view and download files only. Cannot upload, edit, rename, delete, or manage folders |

### Key flags (App.jsx)
```js
const isRestricted  = activeRole === "Project Team";   // read-only
const isDirector    = activeRole === "Director";
const isProjectTeam = activeRole === "Project Team";
```

### Route guards
- Non-directors are redirected from `/dashboard`, `/register`, `/transmittals`, `/analytics` → `/documents`
- Unauthenticated users are redirected to `/login` by `ProtectedRoute`
- Root `/` redirects: Director → `/dashboard`, others → `/documents`

### JWT flow
1. `POST /api/login` returns `{ token, role, allowedProjects, ... }`
2. Token stored in `localStorage` as `dms_user`
3. On mount, token `exp` is checked — expired tokens are cleared immediately
4. All API calls send `Authorization: Bearer <token>`
5. `verifyToken` middleware decodes token and sets `req.user`

---

## Backend middleware

| Middleware | Purpose |
|------------|---------|
| `verifyToken` | Decodes JWT, sets `req.user` — applied to all `/api/*` except login/health |
| `requireDirector` | Blocks non-Directors (403) |
| `requireWriteAccess` | Blocks Project Team only (403) — allows Director + In House Architect |
| `requireProjectAccess` | Checks `req.params.id \|\| req.query.projectId \|\| req.body.projectId` against `req.user.allowedProjects` |

---

## Key backend API endpoints

### Auth
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `POST` | `/api/login` | Public | Returns JWT + user info |
| `GET`  | `/api/health` | Public | DB connectivity check |

### Projects
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `GET`    | `/api/projects` | Any | Returns projects filtered by `allowedProjects` |
| `POST`   | `/api/projects` | Director | Create project |
| `PATCH`  | `/api/projects/:id` | Director | Rename project (name + code) |
| `GET`    | `/api/projects/:id/folders` | Project access | Fetch folder tree JSON |
| `PUT`    | `/api/projects/:id/folders` | Project access | Save folder tree JSON (UPSERT) |

### Drawings
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `GET`    | `/api/drawings` | Project access | All drawings for `?projectId=` |
| `POST`   | `/api/upload` | Write access | Upload file to R2, register drawing |
| `PATCH`  | `/api/drawings/:id` | Write access | Edit metadata |
| `PATCH`  | `/api/drawings/:id/void` | Write access | Mark as VOID |
| `DELETE` | `/api/drawings/:id` | Director | Delete drawing |
| `GET`    | `/api/drawings/:id/revisions` | Project access | Full revision history |
| `POST`   | `/api/drawings/:id/revisions` | Write access | Upload new revision |

### Transmittals
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `GET`  | `/api/transmittals` | Project access | All transmittals for project (each includes `acks: [{name, email, ackedAt, ackUrl}]`) |
| `POST` | `/api/transmittals` | Write access | Create transmittal (auto-numbers TRN-NNN, creates ack tokens per recipient, sends email async) |
| `GET`  | `/api/transmittals/:id/pdf` | Token (query param) | Stream PDF cover sheet |
| `GET`  | `/ack/:token` | Public | Branded acknowledgment page (render only — no side effects, scanner-safe) |
| `POST` | `/ack/:token` | Public | Mark recipient acknowledgment (idempotent; fires Slack + activity_log on first ack) |

### Users
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `GET`    | `/api/users` | Director | List all users |
| `POST`   | `/api/users` | Director | Create user |
| `PATCH`  | `/api/users/:id/role` | Director | Update role + allowedProjects |
| `PATCH`  | `/api/users/:id/deactivate` | Director | Toggle active/inactive |
| `PATCH`  | `/api/users/:id/reset-password` | Director | Reset password |
| `DELETE` | `/api/users/:id` | Director | Remove user (cannot delete self) |
| `PATCH`  | `/api/login` (self) | Any | Change own password |

### Admin
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `GET`  | `/api/admin/backup-status` | Director | Backup health: newest backup, count, last error. Daily DB backup to private R2 bucket at 02:00 Dubai, 30-day retention. Restore: see `docs/RESTORE.md` |

---

## Database schema (SQLite)

```sql
users               (id, username, password, name, role, avatar, allowed_projects, active)
projects            (id, name, code, created_at, slack_webhook_url)
drawings            (id, number, title, discipline, rev, status, issue_date, originator,
                     transmittals, path, folder_path, project_id)
drawing_revisions   (id, drawing_id, rev, title, discipline, status, originator,
                     path, uploaded_by, created_at)
transmittals        (id, number, drawing_ids, recipients, purpose, remarks,
                     issued_at, project_id)
transmittal_acks    (id, transmittal_id, recipient_name, recipient_email,
                     token UNIQUE, acked_at, created_at)
project_folder_trees (project_id PK, tree_json, updated_at)
activity_log        (id, project_id, type, title, detail, created_at)
```

### Key schema notes
- `allowed_projects`: `'*'` = all projects; `'[1,3]'` = specific project IDs (JSON string)
- `active`: `1` = active, `0` = deactivated (login rejected for `active = 0`)
- `drawing_revisions`: every "Upload New Revision" appends a row; drawings table holds current
- Folder trees: one JSON blob per project, replaced atomically on every change

---

## File storage (Cloudflare R2)

Files are uploaded to R2 via `@aws-sdk/client-s3`. The R2 public URL is used for View/Download.

Required env vars on Railway:
```
R2_BUCKET_NAME
R2_PUBLIC_URL          # e.g. https://pub-xxx.r2.dev
CLOUDFLARE_ACCOUNT_ID
R2_ACCESS_KEY_ID
R2_SECRET_ACCESS_KEY
```

If R2 is not configured, uploads are rejected (not silently swallowed).

Allowed file types: `.pdf .dwg .dxf .ifc .rvt .nwd .jpg .jpeg .png .tif .tiff .doc .docx .xls .xlsx`
Max file size: 50 MB

---

## Email (Nodemailer)

On transmittal issue, emails are sent **asynchronously** (does not block the API response).
Each recipient gets an HTML summary + PDF attachment.

Required env vars (optional — email skipped if not set):
```
SMTP_HOST
SMTP_PORT    (default 587)
SMTP_USER
SMTP_PASS
SMTP_FROM
```

---

## Slack notifications (per-project incoming webhooks)

Each project can have its own Slack channel via an **Incoming Webhook**. Events are posted
**asynchronously** (fire-and-forget via `setImmediate`) so they never block or break API responses.

**Events posted** (metadata only — never the file/R2 link):
| Event | Trigger | Example message |
|-------|---------|-----------------|
| Transmittal issued | `POST /api/transmittals` | `📋 *TRN-014* issued — 3 drawing(s), "For Construction" · QUE-154` |
| Transmittal acknowledged | `POST /ack/:token` | `✅ John Smith acknowledged *TRN-014*` |
| New revision | `POST /api/upload` (existing drawing) | `⚠️ *A-101* updated to Rev C · QUE-154` |
| New drawing | `POST /api/upload` (new drawing) | `📄 *A-205* registered (Rev A) · QUE-154` |

**Config** (Director only, via Settings → Projects → Slack):
| Method | Endpoint | Description |
|--------|----------|-------------|
| `PATCH` | `/api/projects/:id/slack` | Set/clear webhook (`slackWebhookUrl`; empty string clears) |
| `POST`  | `/api/projects/:id/slack/test` | Send a test message to confirm wiring |

**Security**
- Webhook URL stored in `projects.slack_webhook_url` (added via migration). Must start with
  `https://hooks.slack.com/` — anything else is rejected (SSRF guard).
- `GET /api/projects` returns a `slackConfigured` boolean, **never the raw webhook secret**.
- No global env var — config is entirely per-project in the DB. `helpers`: `postToSlack(projectId, text)`.

---

## Frontend state architecture (App.jsx)

```
projects[]        — fetched on login, filtered server-side by allowedProjects
activeProject     — first project by default; user can switch (if >1 project)
drawings[]        — fetched when activeProject changes
transmittals[]    — fetched when activeProject changes
currentUser       — { id, username, name, role, avatar, allowedProjects, token }
```

- Re-fetch drawings/transmittals after every mutation (never optimistic append)
- `sessionLoading` blocks render until localStorage is checked (prevents flash)
- Project switcher hidden when user has access to exactly 1 project

---

## DocumentsView — key architecture

- **Folder tree**: stored in `project_folder_trees` DB table (not localStorage). Fetched via
  `GET /api/projects/:id/folders`. Saved via `PUT /api/projects/:id/folders` in background.
- **File actions**: all gated on `onDeleteDrawing` prop being defined.
  - Director: `onDeleteDrawing = handleDeleteDrawing` → all actions shown
  - In House Architect: same (`!isRestricted` check)
  - Project Team: `onDeleteDrawing = undefined` → no action menu shown
- **Folder actions** (rename/delete/add subfolder): hidden for Project Team via `isProjectTeam` prop
- **Upload date**: shown on every file card using `d.issueDate`
- **Revision History drawer**: slides in from right, shows newest revision first.
  Latest revision: green "✓ Current" badge. Older: amber "Superseded" + warning banner.

---

## UploadModal

- Drawing number auto-generated from filename (strip extension) — no user input needed
- Originator field removed — always sent as empty string
- Status field removed — hardcoded to `S3` (For Construction)
- Fields shown: File (drag/drop), Title, Drawing Type (discipline), Revision, Notes

---

## Settings (Director only features)

- **User Management**: list, add, deactivate/reactivate, remove users; edit role + project access
- **Projects**: list all projects with Rename button → modal to edit code + name
- **Add User**: project checkboxes start unchecked — must select ≥1 project (validation enforced)

---

## Sidebar navigation

Directors see: Dashboard · Documents · Register · Transmittals · Analytics
All others see: Documents only
Settings always visible in footer for all roles.

---

## Design tokens (Tailwind)

Key custom colours used throughout:
- `bg-primary` / `text-primary` — brand blue
- `bg-surface-container-low` / `bg-surface-container` — card backgrounds
- `border-border-slate` — standard border colour
- `text-on-surface` / `text-on-surface-variant` — text hierarchy
- `bg-status-emerald-*` / `bg-status-amber-*` / `bg-status-rose-*` — status colours

---

## Environment variables

### Railway (backend)
```
JWT_SECRET
CORS_ORIGIN          # Vercel frontend URL
DB_PATH              # Path to SQLite file on Railway volume
R2_BUCKET_NAME
R2_PUBLIC_URL
CLOUDFLARE_ACCOUNT_ID
R2_ACCESS_KEY_ID
R2_SECRET_ACCESS_KEY
R2_BACKUP_BUCKET     # Private R2 bucket for daily DB backups (backups disabled if unset)
SMTP_HOST            # Optional
SMTP_PORT
SMTP_USER
SMTP_PASS
SMTP_FROM
PUBLIC_BASE_URL      # Optional — Railway URL used in transmittal ack links (falls back to request host)
```

### Vercel (frontend)
```
VITE_API_URL         # Railway backend URL, e.g. https://your-app.railway.app
```

---

## Credentials

Credentials are managed through environment variables or the admin onboarding process.
Never commit real passwords or secrets. Additional users are created by the Director via
Settings → User Management.
