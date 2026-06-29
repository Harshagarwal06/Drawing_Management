require('dotenv').config();
// v2
const express      = require('express');
const multer       = require('multer');
const cors         = require('cors');
const fs           = require('fs');
const path         = require('path');
const bcrypt       = require('bcrypt');
const jwt          = require('jsonwebtoken');
const rateLimit    = require('express-rate-limit');
const Database     = require('better-sqlite3');
const PDFDocument  = require('pdfkit');
const nodemailer   = require('nodemailer');
const crypto       = require('crypto');
const { URL }      = require('url');
const { S3Client, PutObjectCommand, DeleteObjectCommand, GetObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const helmet       = require('helmet');

const app         = express();
const DEFAULT_JWT_SECRET = 'dev-secret-change-in-production';
const PORT        = process.env.PORT        || 3000;
const JWT_SECRET  = process.env.JWT_SECRET  || DEFAULT_JWT_SECRET;
if (process.env.NODE_ENV === 'production' && JWT_SECRET === DEFAULT_JWT_SECRET) {
  throw new Error('JWT_SECRET must be set to a strong production secret before starting DrawVault.');
}
const CORS_ORIGIN = process.env.CORS_ORIGIN || 'http://localhost:5173';
// Support comma-separated origins in CORS_ORIGIN env var for multiple deployments.
// capacitor://localhost is the iOS WKWebView origin; https://localhost is the Android WebView origin.
const CORS_ORIGINS = [
  ...CORS_ORIGIN.split(',').map(o => o.trim()),
  'capacitor://localhost',
  'https://localhost',
  'http://localhost:5174',
];
// Also allow Vercel preview deployments (any *.vercel.app subdomain).
const VERCEL_PREVIEW_RE = /^https:\/\/[a-z0-9][a-z0-9-]*\.vercel\.app$/;
const DB_PATH     = process.env.DB_PATH     || path.join(__dirname, 'dms.db');
const UPLOAD_DIR  = process.env.UPLOAD_DIR  || path.join(__dirname, 'uploads');

// ── DB persistence diagnostic ────────────────────────────────────────
console.log(`📂 DB_PATH          : ${DB_PATH}`);
console.log(`📂 DB file exists   : ${fs.existsSync(DB_PATH)}`);
console.log(`📂 DB_PATH env var  : ${process.env.DB_PATH || '(not set — using default)'}`);
// If "DB file exists: false" on every boot → volume is not persisting or DB_PATH is wrong

/* ── Cloudflare R2 client ────────────────────────────────────────── */
const R2_BUCKET          = process.env.R2_BUCKET_NAME;
const R2_PUBLIC_URL      = (process.env.R2_PUBLIC_URL || '').replace(/\/+$/, ''); // strip trailing slash
const CLOUDFLARE_ACCT_ID = process.env.CLOUDFLARE_ACCOUNT_ID;
const R2_KEY_ID          = process.env.R2_ACCESS_KEY_ID;
const R2_SECRET          = process.env.R2_SECRET_ACCESS_KEY;
const R2_SIGNED_URL_TTL_SECONDS = Math.max(60, parseInt(process.env.R2_SIGNED_URL_TTL_SECONDS || '300', 10));

const R2_CONFIGURED = !!(R2_BUCKET && CLOUDFLARE_ACCT_ID && R2_KEY_ID && R2_SECRET);

// ── Startup validation ──────────────────────────────────────────────
console.log('');
console.log('=== DrawVault Storage Configuration ===');
console.log(`  R2_BUCKET_NAME        : ${R2_BUCKET        ? '✅ set' : '❌ NOT SET'}`);
console.log(`  R2_PUBLIC_URL         : ${R2_PUBLIC_URL     ? '✅ set (legacy URL parsing)' : 'optional for signed URLs'}`);
console.log(`  CLOUDFLARE_ACCOUNT_ID : ${CLOUDFLARE_ACCT_ID ? '✅ set' : '❌ NOT SET'}`);
console.log(`  R2_ACCESS_KEY_ID      : ${R2_KEY_ID         ? '✅ set' : '❌ NOT SET'}`);
console.log(`  R2_SECRET_ACCESS_KEY  : ${R2_SECRET         ? '✅ set' : '❌ NOT SET'}`);
console.log(`  Storage mode          : ${R2_CONFIGURED ? `☁️  Cloudflare R2 (signed URLs, ${R2_SIGNED_URL_TTL_SECONDS}s TTL)` : '⛔ UNCONFIGURED — uploads will be rejected'}`);
console.log('=======================================');
console.log('');

const r2 = R2_CONFIGURED ? new S3Client({
  region:   'auto',
  endpoint: `https://${CLOUDFLARE_ACCT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId:     R2_KEY_ID,
    secretAccessKey: R2_SECRET,
  },
}) : null;

/* ── R2 object helpers ───────────────────────────────────────────── */
function extractR2Key(filePath) {
  if (!filePath) return '';
  const raw = String(filePath).trim();
  if (!raw) return '';

  if (R2_PUBLIC_URL && raw.startsWith(`${R2_PUBLIC_URL}/`)) {
    return decodeURIComponent(raw.slice(R2_PUBLIC_URL.length + 1).replace(/^\/+/, ''));
  }

  try {
    const url = new URL(raw);
    return decodeURIComponent(url.pathname.replace(/^\/+/, ''));
  } catch {
    return raw.replace(/^\/+/, '');
  }
}

function fileNameFromPath(filePath) {
  const key = extractR2Key(filePath);
  const name = key.split('/').filter(Boolean).pop() || 'drawing-file';
  try {
    return decodeURIComponent(name);
  } catch {
    return name;
  }
}

function normalizeFileMode(mode) {
  return mode === 'download' ? 'download' : 'view';
}

function contentDispositionFor(mode, filename) {
  const disposition = normalizeFileMode(mode) === 'download' ? 'attachment' : 'inline';
  const safeName = String(filename || 'drawing-file').replace(/[\r\n"]/g, '_');
  return `${disposition}; filename="${safeName}"`;
}

async function createSignedR2Url(filePath, mode = 'view') {
  if (!r2) {
    const err = new Error('File storage is not configured.');
    err.status = 503;
    throw err;
  }
  const key = extractR2Key(filePath);
  if (!key) {
    const err = new Error('File is not available.');
    err.status = 404;
    throw err;
  }

  const filename = fileNameFromPath(filePath);
  const command = new GetObjectCommand({
    Bucket: R2_BUCKET,
    Key: key,
    ResponseContentDisposition: contentDispositionFor(mode, filename),
  });
  const url = await getSignedUrl(r2, command, { expiresIn: R2_SIGNED_URL_TTL_SECONDS });
  return {
    url,
    filename,
    expiresAt: new Date(Date.now() + R2_SIGNED_URL_TTL_SECONDS * 1000).toISOString(),
  };
}

async function deleteFromR2(filePath) {
  if (!r2 || !filePath) return;
  const key = extractR2Key(filePath);
  if (!key) return;
  try {
    await r2.send(new DeleteObjectCommand({ Bucket: R2_BUCKET, Key: key }));
    console.log(`🗑️  R2 deleted: ${key}`);
  } catch (err) {
    console.warn(`⚠️  R2 delete failed for ${filePath}:`, err.message);
    // Non-fatal — DB row is already deleted
  }
}

/* ── Nodemailer transporter ─────────────────────────────────────── */
const SMTP_CONFIGURED = !!(process.env.SMTP_HOST);
const mailer = SMTP_CONFIGURED ? nodemailer.createTransport({
  host:   process.env.SMTP_HOST,
  port:   parseInt(process.env.SMTP_PORT || '587', 10),
  secure: process.env.SMTP_PORT === '465',
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
}) : null;

if (SMTP_CONFIGURED) {
  console.log(`📧 SMTP configured → ${process.env.SMTP_HOST}:${process.env.SMTP_PORT || 587}`);
} else {
  console.log('📧 SMTP not configured — email delivery disabled (set SMTP_HOST to enable)');
}

/* ── Slack notifications (per-project incoming webhooks) ─────────── */
// Only genuine Slack webhook URLs are accepted — guards against SSRF.
const SLACK_WEBHOOK_PREFIX = 'https://hooks.slack.com/';
function isValidSlackWebhook(url) {
  return typeof url === 'string' && url.startsWith(SLACK_WEBHOOK_PREFIX);
}

// Fire-and-forget: posts a message to a project's Slack channel if one is
// configured. Never throws and never blocks the API response — mirrors the
// async-email pattern used for transmittals.
async function postToSlack(projectId, text) {
  try {
    const proj = db.prepare('SELECT slack_webhook_url FROM projects WHERE id = ?').get(projectId);
    const url  = proj?.slack_webhook_url;
    if (!isValidSlackWebhook(url)) return;          // not configured / invalid → skip silently
    const resp = await fetch(url, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ text }),
    });
    if (!resp.ok) console.error(`⚠️  Slack post failed: ${resp.status} ${resp.statusText}`);
  } catch (err) {
    console.error('⚠️  Slack post failed:', err.message);
  }
}

/* ── Public-URL + HTML helpers (transmittal acknowledgments) ─────── */
// Base URL recipients reach this server on. PUBLIC_BASE_URL (Railway URL)
// wins; otherwise derived from the request (trust proxy makes this honest).
function publicBaseUrl(req) {
  return (process.env.PUBLIC_BASE_URL || `${req.protocol}://${req.get('host')}`).replace(/\/+$/, '');
}

// Recipient names are free-typed — escape anything interpolated into HTML.
function escapeHtml(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

/* ── Middleware ─────────────────────────────────────────────────── */
app.set('trust proxy', 1); // Railway / Vercel sit behind a reverse proxy
app.use(helmet());
app.use(cors({
  origin: (origin, cb) => {
    if (!origin || CORS_ORIGINS.includes(origin) || VERCEL_PREVIEW_RE.test(origin)) {
      cb(null, true);
    } else {
      cb(new Error(`CORS: origin '${origin}' not allowed`));
    }
  },
  credentials: true,
  exposedHeaders: ['X-Total-Count'],
}));
app.use(express.json());

/* ── Uploads folder ─────────────────────────────────────────────── */
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });
app.use('/uploads', express.static(UPLOAD_DIR));

/* ── SQLite setup ───────────────────────────────────────────────── */
const db = new Database(DB_PATH);
db.pragma('foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS activity_log (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id INTEGER NOT NULL DEFAULT 1,
    type       TEXT NOT NULL,
    title      TEXT NOT NULL,
    detail     TEXT,
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS drawings (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    number       TEXT    NOT NULL UNIQUE,
    title        TEXT    NOT NULL,
    discipline   TEXT,
    rev          TEXT,
    status       TEXT    DEFAULT 'S1',
    issue_date   TEXT,
    originator   TEXT,
    transmittals INTEGER DEFAULT 0,
    path         TEXT,
    folder_path  TEXT    DEFAULT ''
  );

  CREATE TABLE IF NOT EXISTS transmittals (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    number      TEXT NOT NULL,
    drawing_ids TEXT NOT NULL,
    recipients  TEXT NOT NULL,
    purpose     TEXT,
    remarks     TEXT,
    issued_at   TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS users (
    id       INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    name     TEXT NOT NULL,
    role     TEXT NOT NULL,
    avatar   TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS projects (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    name        TEXT NOT NULL,
    code        TEXT NOT NULL UNIQUE,
    created_at  TEXT NOT NULL
  );
`);

// ── Migrate drawings table: drop global UNIQUE on number (now per-project) ──
try {
  const schema = db.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='drawings'").get()?.sql || '';
  if (schema.includes('UNIQUE')) {
    // Detect which optional columns already exist so the INSERT doesn't fail
    const existingCols = db.prepare("PRAGMA table_info(drawings)").all().map(c => c.name);
    const pidSel = existingCols.includes('project_id') ? 'COALESCE(project_id,1)' : '1';
    const fldSel = existingCols.includes('folder_path') ? 'folder_path'           : "''";
    db.exec(`
      PRAGMA foreign_keys=OFF;
      BEGIN;
      CREATE TABLE drawings_v2 (
        id           INTEGER PRIMARY KEY AUTOINCREMENT,
        number       TEXT    NOT NULL,
        title        TEXT    NOT NULL,
        discipline   TEXT,
        rev          TEXT,
        status       TEXT    DEFAULT 'S1',
        issue_date   TEXT,
        originator   TEXT,
        transmittals INTEGER DEFAULT 0,
        path         TEXT,
        folder_path  TEXT    DEFAULT '',
        project_id   INTEGER DEFAULT 1
      );
      INSERT INTO drawings_v2 SELECT id,number,title,discipline,rev,status,issue_date,originator,transmittals,path,${fldSel},${pidSel} FROM drawings;
      DROP TABLE drawings;
      ALTER TABLE drawings_v2 RENAME TO drawings;
      COMMIT;
      PRAGMA foreign_keys=ON;
    `);
    console.log('✅ Migrated drawings: removed global UNIQUE constraint on number');
  }
} catch (e) {
  console.warn('drawings migration note:', e.message);
  // CRITICAL: roll back any open transaction so subsequent writes are not swallowed
  try { db.exec('ROLLBACK'); } catch {}
}

// Add columns if upgrading from an older schema
try { db.exec('ALTER TABLE drawings ADD COLUMN project_id INTEGER DEFAULT 1;');     } catch {}
try { db.exec("ALTER TABLE drawings ADD COLUMN folder_path TEXT DEFAULT '';");       } catch {}
try { db.exec('ALTER TABLE transmittals ADD COLUMN project_id INTEGER DEFAULT 1;'); } catch {}
try { db.exec("ALTER TABLE projects ADD COLUMN slack_webhook_url TEXT DEFAULT '';"); } catch {}

// ── Drawing Revisions table ──────────────────────────────────────────
// Each row is a snapshot of a drawing at the moment it was superseded.
// The `drawings` table always holds the CURRENT (latest) revision.
db.exec(`
  CREATE TABLE IF NOT EXISTS drawing_revisions (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    drawing_id  INTEGER NOT NULL,
    rev         TEXT,
    status      TEXT,
    title       TEXT,
    discipline  TEXT,
    originator  TEXT,
    path        TEXT,
    uploaded_by TEXT,
    created_at  TEXT NOT NULL
  );
`);

// ── Transmittal acknowledgments ──────────────────────────────────────
// One row per recipient per transmittal; acked_at NULL until the recipient
// confirms receipt via their tokenized public link (/ack/:token).
db.exec(`
  CREATE TABLE IF NOT EXISTS transmittal_acks (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    transmittal_id  INTEGER NOT NULL,
    recipient_name  TEXT NOT NULL,
    recipient_email TEXT DEFAULT '',
    token           TEXT NOT NULL UNIQUE,
    acked_at        TEXT,
    created_at      TEXT NOT NULL
  );
`);

// Performance indexes (safe to run every boot — IF NOT EXISTS)
try {
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_drawings_project_id          ON drawings(project_id);
    CREATE INDEX IF NOT EXISTS idx_drawings_status              ON drawings(status);
    CREATE INDEX IF NOT EXISTS idx_transmittals_project_id      ON transmittals(project_id);
    CREATE INDEX IF NOT EXISTS idx_activity_project_id          ON activity_log(project_id);
    CREATE INDEX IF NOT EXISTS idx_drawing_revisions_drawing_id ON drawing_revisions(drawing_id);
    CREATE INDEX IF NOT EXISTS idx_transmittal_acks_tid         ON transmittal_acks(transmittal_id);
  `);
} catch (e) { console.warn('Index creation note:', e.message); }
try { db.exec("ALTER TABLE users ADD COLUMN allowed_projects TEXT DEFAULT '*';");   } catch {}
try { db.exec("ALTER TABLE users ADD COLUMN active INTEGER DEFAULT 1;");            } catch {}
try {
  db.exec(`
    CREATE TABLE IF NOT EXISTS project_folder_trees (
      project_id INTEGER PRIMARY KEY,
      tree_json  TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
  `);
} catch (e) { console.warn('folder_trees table note:', e.message); }

// ── Migrate legacy role names → 3-role system ──────────────────────────────
try {
  db.prepare("UPDATE users SET role = 'Director'          WHERE role = 'Document Controller'").run();
  db.prepare("UPDATE users SET role = 'In House Architect' WHERE role IN ('Project Manager','Internal User')").run();
  db.prepare("UPDATE users SET role = 'Project Team'       WHERE role IN ('Subcontractor','Read-Only')").run();
  // Give Project Team members limited access (first project) if they still have wildcard
  db.prepare("UPDATE users SET allowed_projects = '[1]' WHERE role = 'Project Team' AND allowed_projects = '*'").run();
} catch (e) { console.log('Role migration note:', e.message); }

/* ── Seed projects ──────────────────────────────────────────────── */
const insertProject = db.prepare('INSERT OR IGNORE INTO projects (name, code, created_at) VALUES (?, ?, ?)');
const now = new Date().toISOString();
insertProject.run('QUE 154 — Punawale',             'QUE-154',   now);
insertProject.run('UNI 89 — KP Annexe',              'UNI-89',    now);
insertProject.run('Unique Sky Links — Baner Annexe', 'SKY-LINKS', now);
insertProject.run('QUE-914 — Keshavnagar',           'QUE-914',   now);
insertProject.run('Unique Youtopia — Kharadi',        'YOUTOPIA',  now);

console.log(`📊 Drawings in DB   : ${db.prepare('SELECT COUNT(*) as n FROM drawings').get().n}`);

/* ── Seed users (hashed passwords) ─────────────────────────────── */
const SALT_ROUNDS = 10;

// Always ensure the 3 canonical accounts exist (INSERT OR IGNORE = safe to run every boot)
const ensureUser = db.prepare('INSERT OR IGNORE INTO users (username, password, name, role, avatar, allowed_projects) VALUES (?, ?, ?, ?, ?, ?)');
ensureUser.run('director',  bcrypt.hashSync('Unique123!', SALT_ROUNDS), 'Harsh Agarwal', 'Director',           'HA', '*');
ensureUser.run('architect', bcrypt.hashSync('arch123',    SALT_ROUNDS), 'Priya Sharma',  'In House Architect', 'PS', '*');
ensureUser.run('team',      bcrypt.hashSync('team123',    SALT_ROUNDS), 'Carlos Mendez', 'Project Team',       'CM', '[1]');

/* ── Migrate any remaining plaintext passwords ──────────────────── */
const plainUsers = db.prepare("SELECT id, password FROM users WHERE password NOT LIKE '$2b$%'").all();
for (const u of plainUsers) {
  db.prepare('UPDATE users SET password = ? WHERE id = ?').run(bcrypt.hashSync(u.password, SALT_ROUNDS), u.id);
  console.log(`✅ Migrated password for user id=${u.id}`);
}

console.log('✅ SQLite database ready');

/* ── Multer — memory storage, file type + size validation ───────── */
const ALLOWED_EXTENSIONS = new Set(['.pdf','.dwg','.dxf','.ifc','.rvt','.nwd','.jpg','.jpeg','.png','.tif','.tiff','.doc','.docx','.xls','.xlsx']);

const upload = multer({
  storage: multer.memoryStorage(),
  limits:  { fileSize: 50 * 1024 * 1024 }, // 50 MB
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (ALLOWED_EXTENSIONS.has(ext)) return cb(null, true);
    cb(new Error('File type not allowed. Accepted: PDF, DWG, DXF, IFC, RVT, NWD, JPG, PNG, TIF, DOC, DOCX, XLS, XLSX'));
  },
});

/* ── JWT auth middleware ─────────────────────────────────────────── */
function verifyToken(req, res, next) {
  const auth = req.headers.authorization;
  if (!auth?.startsWith('Bearer ')) return res.status(401).json({ error: 'Unauthorized — no token provided' });
  try {
    req.user = jwt.verify(auth.slice(7), JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ error: 'Invalid or expired token — please log in again' });
  }
}

/* ── JWT auth for PDF download (accepts ?token= query param) ─────── */
function verifyTokenForDownload(req, res, next) {
  const auth = req.headers.authorization;
  const tokenStr = auth?.startsWith('Bearer ') ? auth.slice(7) : req.query.token;
  if (!tokenStr) return res.status(401).json({ error: 'Unauthorized — no token provided' });
  try {
    req.user = jwt.verify(tokenStr, JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ error: 'Invalid or expired token — please log in again' });
  }
}

/* ── RBAC: block Project Team from write operations ─────────────── */
function requireWriteAccess(req, res, next) {
  if (req.user?.role === 'Project Team') {
    return res.status(403).json({ error: 'Access denied — Project Team members have read-only access.' });
  }
  next();
}

/* ── RBAC: Director-only actions ────────────────────────────────── */
function requireDirector(req, res, next) {
  if (req.user?.role !== 'Director') {
    return res.status(403).json({ error: 'Access denied — Directors only.' });
  }
  next();
}

function parseProjectId(value) {
  const id = Number.parseInt(value, 10);
  return Number.isInteger(id) && id > 0 ? id : null;
}

function parseAllowedProjects(user) {
  const allowed = user?.allowedProjects ?? user?.allowed_projects;
  if (allowed === '*') return '*';
  if (Array.isArray(allowed)) return allowed.map(Number).filter(Number.isInteger);
  try {
    const parsed = JSON.parse(allowed || '[]');
    return Array.isArray(parsed) ? parsed.map(Number).filter(Number.isInteger) : [];
  } catch {
    return null;
  }
}

function userCanAccessProject(user, projectId) {
  const allowed = parseAllowedProjects(user);
  if (allowed === '*') return true;
  if (!allowed) return false;
  return allowed.includes(Number(projectId));
}

function ensureProjectAccess(req, res, projectId) {
  const id = parseProjectId(projectId);
  if (!id) {
    res.status(400).json({ error: 'Valid projectId is required.' });
    return false;
  }
  const allowed = parseAllowedProjects(req.user);
  if (!allowed) {
    res.status(403).json({ error: 'Invalid project access configuration.' });
    return false;
  }
  if (userCanAccessProject(req.user, id)) return true;
  res.status(403).json({ error: 'Access denied — you do not have access to this project.' });
  return false;
}

/* ── RBAC: check user has access to the requested project ───────── */
function requireProjectAccess(req, res, next) {
  const projectId = parseProjectId(req.params.id ?? req.query.projectId ?? req.body?.projectId) || 1;
  if (!ensureProjectAccess(req, res, projectId)) return;
  req.projectId = projectId;
  next();
}

function loadDrawingForRequest(req, res, id) {
  const drawing = db.prepare('SELECT * FROM drawings WHERE id = ?').get(id);
  if (!drawing) {
    res.status(404).json({ error: 'Drawing not found.' });
    return null;
  }
  if (!ensureProjectAccess(req, res, drawing.project_id)) return null;
  return drawing;
}

function loadRevisionForRequest(req, res, id) {
  const revision = db.prepare(`
    SELECT r.*, d.project_id, d.number AS drawing_number
    FROM drawing_revisions r
    JOIN drawings d ON d.id = r.drawing_id
    WHERE r.id = ?
  `).get(id);
  if (!revision) {
    res.status(404).json({ error: 'Revision not found.' });
    return null;
  }
  if (!ensureProjectAccess(req, res, revision.project_id)) return null;
  return revision;
}

/* ── Upload rate limiter — max 20 uploads per 15 min per IP ─────── */
const uploadLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many uploads — please wait 15 minutes before uploading again.' },
});

/* ── Login limiter — max 10 failed attempts per 15 min per IP ───── */
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  skipSuccessfulRequests: true,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many failed login attempts — please wait 15 minutes before trying again.' },
});

/* Apply verifyToken to all /api/* routes except login, health, and tokenized PDF downloads */
app.use('/api', (req, res, next) => {
  if (req.path === '/login'  && req.method === 'POST') return next();
  if (req.path === '/health' && (req.method === 'GET' || req.method === 'HEAD')) return next();
  if (/^\/transmittals\/\d+\/pdf$/.test(req.path) && req.method === 'GET' && req.query.token) return next();
  verifyToken(req, res, next);
});

/* ── GET /api/health ────────────────────────────────────────────── */
app.get('/api/health', (req, res) => {
  try {
    db.prepare('SELECT 1').get();
    res.json({ status: 'ok', db: 'connected', timestamp: new Date().toISOString() });
  } catch {
    res.status(503).json({ status: 'error', db: 'disconnected' });
  }
});

/* ── GET /api/activity ──────────────────────────────────────────── */
app.get('/api/activity', requireProjectAccess, (req, res) => {
  const projectId = req.query.projectId || 1;
  try {
    const rows = db.prepare('SELECT * FROM activity_log WHERE project_id = ? ORDER BY id DESC LIMIT 30').all(projectId);
    res.json(rows);
  } catch (err) {
    console.error('❌ GET /api/activity error:', err);
    res.status(500).json({ error: 'Failed to fetch activity.' });
  }
});

/* ── GET /api/projects — filtered by user's allowed projects ─────── */
app.get('/api/projects', (req, res) => {
  try {
    // Never expose the raw webhook secret — return a boolean flag instead.
    const cols = `id, name, code, created_at,
      CASE WHEN slack_webhook_url IS NOT NULL AND slack_webhook_url != '' THEN 1 ELSE 0 END AS slackConfigured`;
    const allowed = req.user?.allowedProjects;
    if (allowed === '*') {
      return res.json(db.prepare(`SELECT ${cols} FROM projects ORDER BY id ASC`).all());
    }
    const ids = JSON.parse(allowed || '[]');
    if (ids.length === 0) return res.json([]);
    const placeholders = ids.map(() => '?').join(',');
    res.json(db.prepare(`SELECT ${cols} FROM projects WHERE id IN (${placeholders}) ORDER BY id ASC`).all(ids));
  } catch (err) {
    console.error('❌ GET /api/projects error:', err);
    res.status(500).json({ error: 'Failed to fetch projects.' });
  }
});

/* ── POST /api/projects ─────────────────────────────────────────── */
app.post('/api/projects', requireDirector, (req, res) => {
  const { name, code } = req.body;
  if (!name || !code) return res.status(400).json({ error: 'Name and code required.' });
  try {
    const result = db.prepare('INSERT INTO projects (name, code, created_at) VALUES (?, ?, ?)').run(name, code, new Date().toISOString());
    res.status(201).json({ id: result.lastInsertRowid, name, code });
  } catch (err) {
    console.error('❌ POST /api/projects error:', err);
    res.status(500).json({ error: 'Failed to create project.' });
  }
});

/* ── PATCH /api/projects/:id — rename a project (Director only) ── */
app.patch('/api/projects/:id', requireDirector, (req, res) => {
  const { name, code } = req.body;
  if (!name && !code) return res.status(400).json({ error: 'name or code is required.' });
  try {
    const existing = db.prepare('SELECT * FROM projects WHERE id = ?').get(req.params.id);
    if (!existing) return res.status(404).json({ error: 'Project not found.' });
    const newName = name ?? existing.name;
    const newCode = code ?? existing.code;
    db.prepare('UPDATE projects SET name = ?, code = ? WHERE id = ?').run(newName, newCode, req.params.id);
    console.log(`✅ Project ${req.params.id} renamed → ${newCode} / ${newName}`);
    res.json({ id: Number(req.params.id), name: newName, code: newCode });
  } catch (err) {
    console.error('❌ PATCH /api/projects/:id error:', err);
    res.status(500).json({ error: 'Failed to rename project.' });
  }
});

/* ── PATCH /api/projects/:id/slack — set/clear Slack webhook (Director) ── */
app.patch('/api/projects/:id/slack', requireDirector, (req, res) => {
  const { slackWebhookUrl } = req.body;
  const url = (slackWebhookUrl || '').trim();
  // Empty string clears the webhook; otherwise must be a genuine Slack URL.
  if (url && !isValidSlackWebhook(url)) {
    return res.status(400).json({ error: 'Webhook URL must start with https://hooks.slack.com/' });
  }
  try {
    const existing = db.prepare('SELECT id FROM projects WHERE id = ?').get(req.params.id);
    if (!existing) return res.status(404).json({ error: 'Project not found.' });
    db.prepare('UPDATE projects SET slack_webhook_url = ? WHERE id = ?').run(url, req.params.id);
    console.log(`✅ Project ${req.params.id} Slack webhook ${url ? 'set' : 'cleared'}`);
    res.json({ id: Number(req.params.id), slackConfigured: !!url });
  } catch (err) {
    console.error('❌ PATCH /api/projects/:id/slack error:', err);
    res.status(500).json({ error: 'Failed to update Slack webhook.' });
  }
});

/* ── POST /api/projects/:id/slack/test — send a test message (Director) ── */
app.post('/api/projects/:id/slack/test', requireDirector, async (req, res) => {
  try {
    const proj = db.prepare('SELECT code, slack_webhook_url FROM projects WHERE id = ?').get(req.params.id);
    if (!proj) return res.status(404).json({ error: 'Project not found.' });
    if (!isValidSlackWebhook(proj.slack_webhook_url)) {
      return res.status(400).json({ error: 'No Slack webhook configured for this project.' });
    }
    const tag = proj.code ? ` · ${proj.code}` : '';
    await postToSlack(req.params.id, `✅ DrawVault test message${tag} — Slack is connected.`);
    res.json({ sent: true });
  } catch (err) {
    console.error('❌ POST /api/projects/:id/slack/test error:', err);
    res.status(500).json({ error: 'Failed to send test message.' });
  }
});

/* ── GET /api/projects/:id/folders ─────────────────────────────── */
app.get('/api/projects/:id/folders', requireProjectAccess, (req, res) => {
  try {
    const row = db.prepare('SELECT tree_json FROM project_folder_trees WHERE project_id = ?').get(req.params.id);
    if (!row) return res.status(404).json({ tree: null });
    res.json({ tree: JSON.parse(row.tree_json) });
  } catch (err) {
    console.error('❌ GET /api/projects/:id/folders error:', err);
    res.status(500).json({ error: 'Failed to fetch folder tree.' });
  }
});

/* ── PUT /api/projects/:id/folders ─────────────────────────────── */
app.put('/api/projects/:id/folders', requireWriteAccess, requireProjectAccess, (req, res) => {
  const { tree } = req.body;
  if (!tree) return res.status(400).json({ error: 'tree is required.' });
  try {
    db.prepare(`
      INSERT INTO project_folder_trees (project_id, tree_json, updated_at)
      VALUES (?, ?, ?)
      ON CONFLICT(project_id) DO UPDATE SET tree_json = excluded.tree_json, updated_at = excluded.updated_at
    `).run(req.params.id, JSON.stringify(tree), new Date().toISOString());
    res.json({ ok: true });
  } catch (err) {
    console.error('❌ PUT /api/projects/:id/folders error:', err);
    res.status(500).json({ error: 'Failed to save folder tree.' });
  }
});

/* ── POST /api/projects/:id/folders/rename ───────────────────────── */
app.post('/api/projects/:id/folders/rename', requireWriteAccess, requireProjectAccess, (req, res) => {
  const { oldPath, newPath } = req.body;
  if (!oldPath || !newPath) return res.status(400).json({ error: 'oldPath and newPath are required.' });
  try {
    db.transaction(() => {
      // 1. Update exact matching paths
      db.prepare(`
        UPDATE drawings 
        SET folder_path = ? 
        WHERE project_id = ? AND folder_path = ?
      `).run(newPath, req.params.id, oldPath);

      // 2. Update all nested subfolder paths recursively
      db.prepare(`
        UPDATE drawings 
        SET folder_path = ? || SUBSTR(folder_path, ?) 
        WHERE project_id = ? AND folder_path LIKE ? || '/%'
      `).run(newPath, oldPath.length + 1, req.params.id, oldPath);
    })();
    res.json({ ok: true });
  } catch (err) {
    console.error('❌ POST /api/projects/:id/folders/rename error:', err);
    res.status(500).json({ error: 'Failed to update drawing folder paths.' });
  }
});

/* ── POST /api/projects/:id/folders/delete ───────────────────────── */
app.post('/api/projects/:id/folders/delete', requireWriteAccess, requireProjectAccess, (req, res) => {
  const { folderPath, parentPath } = req.body;
  if (!folderPath) return res.status(400).json({ error: 'folderPath is required.' });
  
  const targetParent = parentPath || '';
  try {
    db.transaction(() => {
      // Move all drawings in the deleted folder to the parent folder
      db.prepare(`
        UPDATE drawings 
        SET folder_path = ? 
        WHERE project_id = ? AND folder_path = ?
      `).run(targetParent, req.params.id, folderPath);

      // Bubble up drawings in nested subfolders to the parent folder
      db.prepare(`
        UPDATE drawings 
        SET folder_path = ? 
        WHERE project_id = ? AND folder_path LIKE ? || '/%'
      `).run(targetParent, req.params.id, folderPath);
    })();
    res.json({ ok: true });
  } catch (err) {
    console.error('❌ POST /api/projects/:id/folders/delete error:', err);
    res.status(500).json({ error: 'Failed to bubble up drawing folder paths.' });
  }
});

/* ── POST /api/projects/:id/folders/move ────────────────────────── */
app.post('/api/projects/:id/folders/move', requireWriteAccess, requireProjectAccess, (req, res) => {
  const { oldPath, newPath } = req.body;
  if (!oldPath || !newPath) return res.status(400).json({ error: 'oldPath and newPath are required.' });
  try {
    db.transaction(() => {
      // 1. Update drawings in the moved folder exactly
      db.prepare(`
        UPDATE drawings
        SET folder_path = ?
        WHERE project_id = ? AND folder_path = ?
      `).run(newPath, req.params.id, oldPath);
      // 2. Update drawings in any nested subfolder recursively
      db.prepare(`
        UPDATE drawings
        SET folder_path = ? || SUBSTR(folder_path, ?)
        WHERE project_id = ? AND folder_path LIKE ? || '/%'
      `).run(newPath, oldPath.length + 1, req.params.id, oldPath);
    })();
    res.json({ ok: true });
  } catch (err) {
    console.error('❌ POST /api/projects/:id/folders/move error:', err);
    res.status(500).json({ error: 'Failed to move folder paths.' });
  }
});

/* ── GET /api/drawings ──────────────────────────────────────────── */
app.get('/api/drawings', requireProjectAccess, (req, res) => {
  const projectId = req.query.projectId || 1;
  const limit     = Math.min(parseInt(req.query.limit)  || 500, 2000);
  const offset    = Math.max(parseInt(req.query.offset)  || 0, 0);
  try {
    const total = db.prepare('SELECT COUNT(*) as n FROM drawings WHERE project_id = ?').get(projectId).n;
    const rows  = db.prepare('SELECT * FROM drawings WHERE project_id = ? ORDER BY id DESC LIMIT ? OFFSET ?').all(projectId, limit, offset);
    const data = rows.map(r => ({
      id:           r.id,
      number:       r.number,
      title:        r.title,
      discipline:   r.discipline,
      rev:          r.rev,
      status:       r.status,
      issueDate:    r.issue_date,
      originator:   r.originator,
      transmittals: r.transmittals,
      path:         r.path ? extractR2Key(r.path) : null,
      fileName:     r.path ? fileNameFromPath(r.path) : null,
      folderPath:   r.folder_path || '',
    }));
    res.set('X-Total-Count', String(total));
    res.json(data);
  } catch (err) {
    console.error('❌ GET /api/drawings error:', err);
    res.status(500).json({ error: 'Failed to fetch drawings.' });
  }
});

/* ── POST /api/upload ───────────────────────────────────────────── */
app.post('/api/upload', requireWriteAccess, uploadLimiter, upload.single('drawingFile'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded.' });

  const { drawingNumber, title, discipline, originator, revision, status, projectId, folderPath } = req.body;
  const pId = parseProjectId(projectId) || 1;
  if (!ensureProjectAccess(req, res, pId)) return;

  /* ── Guard: reject before storage writes if R2 is not configured ── */
  if (!R2_CONFIGURED) {
    console.error('❌ Upload rejected — Cloudflare R2 environment variables are not configured.');
    return res.status(503).json({
      error: 'File storage is not configured. Contact the administrator.',
      detail: 'R2_BUCKET_NAME, CLOUDFLARE_ACCOUNT_ID, R2_ACCESS_KEY_ID, and R2_SECRET_ACCESS_KEY must all be set.',
    });
  }

  const fPath = folderPath || '';
  const today = new Date().toISOString().split('T')[0];

  /* ── Build a safe, unique R2 object key ── */
  const safeName = req.file.originalname
    .replace(/\s+/g, '-')
    .replace(/[^a-zA-Z0-9.\-_]/g, '');
  const r2Key = `${Date.now()}-${safeName}`;

  console.log(`⬆️  Uploading to R2: bucket=${R2_BUCKET} key=${r2Key} size=${req.file.size} type=${req.file.mimetype}`);

  try {
    /* ── Upload buffer to Cloudflare R2 ── */
    await r2.send(new PutObjectCommand({
      Bucket:      R2_BUCKET,
      Key:         r2Key,
      Body:        req.file.buffer,
      ContentType: req.file.mimetype,
    }));

    const filePath = r2Key;
    console.log(`✅ R2 upload succeeded → ${filePath}`);

    /* ── Persist to SQLite ── */
    const existing = db.prepare('SELECT * FROM drawings WHERE number = ? AND project_id = ?').get(drawingNumber, pId);
    if (existing) {
      /* Archive the current revision before overwriting */
      db.prepare(
        `INSERT INTO drawing_revisions (drawing_id, rev, status, title, discipline, originator, path, uploaded_by, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).run(
        existing.id, existing.rev, existing.status, existing.title,
        existing.discipline, existing.originator, existing.path,
        req.user?.name || 'Unknown',
        existing.issue_date || new Date().toISOString()
      );
      db.prepare(`UPDATE drawings SET title=?, discipline=?, rev=?, status=?, issue_date=?, originator=?, path=?, project_id=?, folder_path=? WHERE number=? AND project_id=?`)
        .run(title, discipline, revision, status, today, originator, filePath, pId, fPath, drawingNumber, pId);
      console.log(`✅ Updated drawing ${drawingNumber} → Rev ${revision} (previous Rev ${existing.rev} archived)`);
    } else {
      db.prepare(`INSERT INTO drawings (number,title,discipline,rev,status,issue_date,originator,transmittals,path,project_id,folder_path) VALUES (?,?,?,?,?,?,?,0,?,?,?)`)
        .run(drawingNumber, title || 'Untitled', discipline, revision, status || 'S1', today, originator, filePath, pId, fPath);
      console.log(`✅ Registered drawing ${drawingNumber} Rev ${revision}`);
    }

    db.prepare('INSERT INTO activity_log (project_id,type,title,detail,created_at) VALUES (?,?,?,?,?)')
      .run(pId, existing ? 'revision' : 'upload',
           existing ? `${drawingNumber} revised to Rev ${revision}` : `${drawingNumber} registered`,
           title, new Date().toISOString());

    res.json({ message: 'Drawing saved successfully.', path: extractR2Key(filePath), fileName: fileNameFromPath(filePath) });

    // ── Async Slack notification (metadata only — never the file link) ──
    setImmediate(() => {
      const proj = db.prepare('SELECT code FROM projects WHERE id = ?').get(pId);
      const tag  = proj?.code ? ` · ${proj.code}` : '';
      const msg  = existing
        ? `⚠️ *${drawingNumber}* updated to Rev ${revision}${tag}`
        : `📄 *${drawingNumber}* registered (Rev ${revision})${tag}`;
      postToSlack(pId, msg);
    });
  } catch (err) {
    console.error('❌ R2 upload failed:', err.message || err);
    res.status(500).json({ error: 'Failed to upload file to cloud storage. Check server logs.' });
  }
});

/* ── GET /api/drawings/:id/revisions ───────────────────────────── */
app.get('/api/drawings/:id/revisions', (req, res) => {
  const { id } = req.params;
  try {
    const drawing = loadDrawingForRequest(req, res, id);
    if (!drawing) return;

    // Archived past revisions (oldest first)
    const past = db.prepare(
      'SELECT id, rev, status, title, discipline, originator, path, uploaded_by, created_at FROM drawing_revisions WHERE drawing_id = ? ORDER BY id ASC'
    ).all(id).map(r => ({
      ...r,
      path: r.path ? extractR2Key(r.path) : null,
      fileName: r.path ? fileNameFromPath(r.path) : null,
    }));

    // Current revision = what's in the drawings table now
    const current = {
      id:         null,
      rev:        drawing.rev,
      status:     drawing.status,
      title:      drawing.title,
      discipline: drawing.discipline,
      originator: drawing.originator,
      path:       drawing.path ? extractR2Key(drawing.path) : null,
      fileName:   drawing.path ? fileNameFromPath(drawing.path) : null,
      uploaded_by: null,
      created_at: drawing.issue_date,
      current:    true,
    };

    // Return chronological list: past revisions + current at end
    res.json([...past, current]);
  } catch (err) {
    console.error('❌ GET /api/drawings/:id/revisions error:', err);
    res.status(500).json({ error: 'Failed to fetch revisions.' });
  }
});

/* ── GET /api/drawings/:id/file-url ─────────────────────────────── */
app.get('/api/drawings/:id/file-url', async (req, res) => {
  try {
    const drawing = loadDrawingForRequest(req, res, req.params.id);
    if (!drawing) return;
    res.json(await createSignedR2Url(drawing.path, normalizeFileMode(req.query.mode)));
  } catch (err) {
    console.error('❌ GET /api/drawings/:id/file-url error:', err);
    res.status(err.status || 500).json({ error: err.status ? err.message : 'Failed to create file URL.' });
  }
});

/* ── GET /api/drawing-revisions/:id/file-url ────────────────────── */
app.get('/api/drawing-revisions/:id/file-url', async (req, res) => {
  try {
    const revision = loadRevisionForRequest(req, res, req.params.id);
    if (!revision) return;
    res.json(await createSignedR2Url(revision.path, normalizeFileMode(req.query.mode)));
  } catch (err) {
    console.error('❌ GET /api/drawing-revisions/:id/file-url error:', err);
    res.status(err.status || 500).json({ error: err.status ? err.message : 'Failed to create file URL.' });
  }
});

/* ── GET /api/transmittals ──────────────────────────────────────── */
app.get('/api/transmittals', requireProjectAccess, (req, res) => {
  const projectId = req.query.projectId || 1;
  const limit     = Math.min(parseInt(req.query.limit)  || 200, 1000);
  const offset    = Math.max(parseInt(req.query.offset)  || 0, 0);
  try {
    const total = db.prepare('SELECT COUNT(*) as n FROM transmittals WHERE project_id = ?').get(projectId).n;
    const rows  = db.prepare('SELECT * FROM transmittals WHERE project_id = ? ORDER BY id DESC LIMIT ? OFFSET ?').all(projectId, limit, offset);

    // Per-recipient acknowledgment state, batched (old transmittals → [])
    const ackMap = {};
    if (rows.length > 0) {
      const ids  = rows.map(r => r.id);
      const acks = db.prepare(`SELECT * FROM transmittal_acks WHERE transmittal_id IN (${ids.map(() => '?').join(',')})`).all(ids);
      const base = publicBaseUrl(req);
      for (const a of acks) {
        (ackMap[a.transmittal_id] ||= []).push({
          name:    a.recipient_name,
          email:   a.recipient_email,
          ackedAt: a.acked_at,
          ackUrl:  `${base}/ack/${a.token}`,
        });
      }
    }

    const data = rows.map(r => {
      let drawingIds = [], recipients = [];
      try { drawingIds = JSON.parse(r.drawing_ids); } catch {}
      try { recipients = JSON.parse(r.recipients);  } catch {}
      return { id: r.id, number: r.number, drawingIds, recipients, purpose: r.purpose, remarks: r.remarks, issuedAt: r.issued_at, acks: ackMap[r.id] || [] };
    });
    res.set('X-Total-Count', String(total));
    res.json(data);
  } catch (err) {
    console.error('❌ GET /api/transmittals error:', err);
    res.status(500).json({ error: 'Failed to fetch transmittals.' });
  }
});

/* ── POST /api/transmittals ─────────────────────────────────────── */
app.post('/api/transmittals', requireWriteAccess, (req, res) => {
  const { drawingIds, recipients, purpose, remarks, issuedAt, projectId } = req.body;
  const pId = parseProjectId(projectId) || 1;
  const drawingIdList = Array.isArray(drawingIds)
    ? drawingIds.map(id => Number.parseInt(id, 10)).filter(Number.isInteger)
    : [];
  if (!drawingIdList.length || !recipients?.length || !purpose)
    return res.status(400).json({ error: 'drawingIds, recipients, and purpose are required.' });
  if (!Array.isArray(drawingIds) || drawingIdList.length !== drawingIds.length)
    return res.status(400).json({ error: 'drawingIds must be valid drawing IDs.' });
  if (!ensureProjectAccess(req, res, pId)) return;
  try {
    const placeholdersForValidation = drawingIdList.map(() => '?').join(',');
    const validDrawingIds = db.prepare(
      `SELECT id FROM drawings WHERE project_id = ? AND id IN (${placeholdersForValidation})`
    ).all(pId, ...drawingIdList).map(r => r.id);
    if (validDrawingIds.length !== drawingIdList.length) {
      return res.status(400).json({ error: 'All drawingIds must belong to the selected project.' });
    }
    // Auto-generate TRN number (per-project sequential)
    const count = db.prepare('SELECT COUNT(*) as n FROM transmittals WHERE project_id = ?').get(pId).n;
    const number = `TRN-${String(count + 1).padStart(3, '0')}`;

    const today = issuedAt || new Date().toISOString().split('T')[0];
    const result = db.prepare(`INSERT INTO transmittals (number,drawing_ids,recipients,purpose,remarks,issued_at,project_id) VALUES (?,?,?,?,?,?,?)`)
      .run(number, JSON.stringify(drawingIdList), JSON.stringify(recipients), purpose, remarks || '', today, pId);
    // Single bulk UPDATE instead of N+1 loop
    if (drawingIdList.length > 0) {
      const placeholders = drawingIdList.map(() => '?').join(',');
      db.prepare(`UPDATE drawings SET transmittals = transmittals + 1 WHERE id IN (${placeholders})`).run(...drawingIdList);
    }
    db.prepare('INSERT INTO activity_log (project_id,type,title,detail,created_at) VALUES (?,?,?,?,?)')
      .run(pId, 'transmittal', `${number} issued`, `${drawingIdList.length} drawing(s) — ${purpose}`, new Date().toISOString());
    console.log(`✅ Transmittal ${number} saved`);

    const trnId = result.lastInsertRowid;

    // One acknowledgment token per recipient (index-aligned with `recipients`)
    const base = publicBaseUrl(req);
    const ackRows = recipients.map(r => ({
      name:  typeof r === 'string' ? r : (r.name  || ''),
      email: typeof r === 'string' ? '' : (r.email || ''),
      token: crypto.randomBytes(24).toString('hex'),
    }));
    const insAck = db.prepare('INSERT INTO transmittal_acks (transmittal_id,recipient_name,recipient_email,token,created_at) VALUES (?,?,?,?,?)');
    for (const a of ackRows) insAck.run(trnId, a.name, a.email, a.token, new Date().toISOString());

    res.status(201).json({ id: trnId, number });

    // ── Async Slack notification (independent of email config) ──
    setImmediate(() => {
      const proj = db.prepare('SELECT code FROM projects WHERE id = ?').get(pId);
      const tag  = proj?.code ? ` · ${proj.code}` : '';
      postToSlack(pId, `📋 *${number}* issued — ${drawingIdList.length} drawing(s), "${purpose}"${tag}`);
    });

    // ── Async: generate PDF and send emails (don't block response) ──
    if (SMTP_CONFIGURED && recipients.length > 0) {
      setImmediate(async () => {
        try {
          const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(pId);
          const drws = drawingIdList.length > 0
            ? db.prepare(`SELECT * FROM drawings WHERE id IN (${drawingIdList.map(() => '?').join(',')})`).all(...drawingIdList)
            : [];

          // Build PDF buffer
          const pdfBuffer = await new Promise((resolve, reject) => {
            const doc = new PDFDocument({ size: 'A4', margin: 50 });
            const chunks = [];
            doc.on('data', c => chunks.push(c));
            doc.on('end',  () => resolve(Buffer.concat(chunks)));
            doc.on('error', reject);
            buildTransmittalPdf(doc, { number, purpose, today, project, recipients, drws, remarks });
            doc.end();
          });

          // Send to each recipient (ackRows[i] matches recipients[i])
          for (let i = 0; i < recipients.length; i++) {
            const { name, email, token } = ackRows[i];
            if (!email) { console.log(`⚠️  No email for recipient "${name}" — skipping`); continue; }
            await mailer.sendMail({
              from:    process.env.SMTP_FROM || process.env.SMTP_USER,
              to:      `${name} <${email}>`,
              subject: `Transmittal ${number} — ${purpose} | ${project?.code || 'Project'}`,
              html: buildEmailHtml({ number, purpose, today, project, recipients, drws, remarks, ackUrl: `${base}/ack/${token}` }),
              attachments: [{ filename: `${number}.pdf`, content: pdfBuffer, contentType: 'application/pdf' }],
            });
            console.log(`✅ Email sent to ${email}`);
          }
        } catch (mailErr) {
          console.error('❌ Email delivery failed:', mailErr.message);
        }
      });
    } else if (!SMTP_CONFIGURED) {
      console.log('⚠️  SMTP not configured — email not sent');
    }
  } catch (err) {
    console.error('❌ POST /api/transmittals error:', err);
    res.status(500).json({ error: 'Failed to save transmittal.' });
  }
});

/* ── PDF / Email helpers ────────────────────────────────────────── */
function buildTransmittalPdf(doc, { number, purpose, today, project, recipients, drws, remarks }) {
  const BLUE   = '#1B3A6B';
  const GOLD   = '#F4A223';
  const GRAY   = '#64748B';
  const LIGHT  = '#F8FAFC';
  const LINE   = '#E2E8F0';
  const W      = 495; // usable width (A4 595 - 50*2 margins)

  // ── Header band ──
  doc.rect(50, 40, W, 60).fill(BLUE);
  doc.fontSize(18).font('Helvetica-Bold').fillColor('#FFFFFF')
    .text('TRANSMITTAL COVER SHEET', 60, 52, { width: W - 20 });
  doc.fontSize(10).font('Helvetica').fillColor(GOLD)
    .text('Unique Properties — Enterprise Drawing Management', 60, 76, { width: W - 20 });

  // ── Meta grid ──
  doc.rect(50, 110, W, 70).fill(LIGHT).stroke(LINE);
  const metaY = 120;
  const col2  = 310;
  doc.fontSize(8).font('Helvetica-Bold').fillColor(GRAY);
  doc.text('TRANSMITTAL NO.',   60,  metaY);
  doc.text('DATE',              col2, metaY);
  doc.text('PURPOSE',           60,  metaY + 22);
  doc.text('PROJECT',           col2, metaY + 22);

  doc.fontSize(11).font('Helvetica-Bold').fillColor('#0F172A');
  doc.text(number,              60,  metaY + 10);
  doc.text(today,               col2, metaY + 10);
  doc.fontSize(10).font('Helvetica').fillColor('#0F172A');
  doc.text(purpose,             60,  metaY + 32);
  doc.text(project ? `${project.code} — ${project.name}` : '—', col2, metaY + 32, { width: W - col2 + 50 - 10 });

  // ── Recipients ──
  let y = 198;
  doc.fontSize(9).font('Helvetica-Bold').fillColor(BLUE).text('TO:', 50, y);
  doc.moveTo(50, y + 11).lineTo(545, y + 11).stroke(LINE);
  y += 16;
  for (const r of recipients) {
    const name  = typeof r === 'string' ? r : (r.name  || '');
    const email = typeof r === 'string' ? '' : (r.email || '');
    doc.fontSize(10).font('Helvetica').fillColor('#0F172A')
      .text(`${name}${email ? `  <${email}>` : ''}`, 60, y);
    y += 15;
  }

  // ── Drawings table ──
  y += 8;
  doc.fontSize(9).font('Helvetica-Bold').fillColor(BLUE).text('DRAWINGS ISSUED:', 50, y);
  y += 12;
  doc.rect(50, y, W, 16).fill(BLUE);
  doc.fontSize(8).font('Helvetica-Bold').fillColor('#FFFFFF');
  doc.text('Drawing No.',  56, y + 4, { width: 120 });
  doc.text('Title',       182, y + 4, { width: 180 });
  doc.text('Rev',         368, y + 4, { width: 30 });
  doc.text('Status',      404, y + 4, { width: 50 });
  doc.text('Discipline',  460, y + 4, { width: 80 });
  y += 16;

  drws.forEach((d, i) => {
    doc.rect(50, y, W, 15).fill(i % 2 === 0 ? '#FFFFFF' : LIGHT);
    doc.fontSize(8).font('Helvetica').fillColor('#0F172A');
    doc.text(d.number      || '—',  56, y + 3, { width: 120 });
    doc.text(d.title       || '—', 182, y + 3, { width: 180 });
    doc.text(d.rev         || '—', 368, y + 3, { width: 30 });
    doc.text(d.status      || '—', 404, y + 3, { width: 50 });
    doc.text(d.discipline  || '—', 460, y + 3, { width: 80 });
    y += 15;
    if (y > 750) { doc.addPage(); y = 50; }
  });

  // ── Remarks ──
  if (remarks) {
    y += 10;
    doc.fontSize(9).font('Helvetica-Bold').fillColor(BLUE).text('REMARKS:', 50, y);
    y += 12;
    doc.fontSize(10).font('Helvetica').fillColor('#334155')
      .text(remarks, 60, y, { width: W - 10 });
    y += doc.heightOfString(remarks, { width: W - 10 }) + 4;
  }

  // ── Footer ──
  doc.fontSize(7).font('Helvetica').fillColor(GRAY)
    .text('This document is computer-generated by Unique Properties DMS. Unauthorised reproduction is prohibited.',
      50, 810, { width: W, align: 'center' });
}

function buildEmailHtml({ number, purpose, today, project, recipients, drws, remarks, ackUrl }) {
  const rows = drws.map(d =>
    `<tr><td style="padding:4px 8px;border-bottom:1px solid #e2e8f0">${d.number}</td>
         <td style="padding:4px 8px;border-bottom:1px solid #e2e8f0">${d.title}</td>
         <td style="padding:4px 8px;border-bottom:1px solid #e2e8f0">Rev ${d.rev}</td>
         <td style="padding:4px 8px;border-bottom:1px solid #e2e8f0">${d.status}</td></tr>`
  ).join('');
  return `
<html><body style="font-family:Arial,sans-serif;color:#0f172a;max-width:600px;margin:auto">
  <div style="background:#1B3A6B;padding:20px;border-radius:8px 8px 0 0">
    <h2 style="color:#fff;margin:0">Transmittal ${number}</h2>
    <p style="color:#F4A223;margin:4px 0 0">Unique Properties — Enterprise Drawing Management</p>
  </div>
  <div style="background:#f8fafc;padding:20px;border:1px solid #e2e8f0">
    <table style="width:100%;margin-bottom:16px">
      <tr><td style="color:#64748b;font-size:12px">PROJECT</td><td><strong>${project ? project.code + ' — ' + project.name : '—'}</strong></td></tr>
      <tr><td style="color:#64748b;font-size:12px">DATE</td><td>${today}</td></tr>
      <tr><td style="color:#64748b;font-size:12px">PURPOSE</td><td>${purpose}</td></tr>
      <tr><td style="color:#64748b;font-size:12px">RECIPIENTS</td><td>${recipients.map(r => typeof r === 'string' ? r : r.name).join(', ')}</td></tr>
    </table>
    ${ackUrl ? `
    <table role="presentation" style="margin:20px auto"><tr><td style="border-radius:8px;background:#16a34a">
      <a href="${ackUrl}" style="display:inline-block;padding:14px 36px;font-family:Arial,sans-serif;font-size:15px;font-weight:bold;color:#ffffff;text-decoration:none;border-radius:8px">
        &#10003; Acknowledge Receipt
      </a>
    </td></tr></table>
    <p style="text-align:center;color:#64748b;font-size:12px;margin:0 0 8px">
      Please click above to confirm you received this transmittal.
    </p>` : ''}
    <h3 style="color:#1B3A6B;border-bottom:2px solid #1B3A6B;padding-bottom:4px">Drawings Issued (${drws.length})</h3>
    <table style="width:100%;border-collapse:collapse;font-size:13px">
      <thead><tr style="background:#1B3A6B;color:#fff">
        <th style="padding:6px 8px;text-align:left">Drawing No.</th>
        <th style="padding:6px 8px;text-align:left">Title</th>
        <th style="padding:6px 8px;text-align:left">Rev</th>
        <th style="padding:6px 8px;text-align:left">Status</th>
      </tr></thead>
      <tbody>${rows}</tbody>
    </table>
    ${remarks ? `<div style="margin-top:16px;padding:12px;background:#fff;border-left:4px solid #F4A223"><strong>Remarks:</strong><br>${remarks}</div>` : ''}
    <p style="color:#94a3b8;font-size:11px;margin-top:24px">
      The PDF cover sheet is attached to this email.<br>
      This message was generated automatically by Unique Properties DMS.
    </p>
  </div>
</body></html>`;
}

/* ── Public acknowledgment pages (no login — tokenized links) ────── */
// Lives OUTSIDE /api so the verifyToken gate never applies. Helmet's default
// CSP blocks inline <script>, so the confirm step is a plain form POST.
const ackLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: 'Too many requests — please try again later.',
});

function getAckByToken(token) {
  return db.prepare(`
    SELECT a.*, t.number AS trn_number, t.project_id, t.purpose, t.issued_at
    FROM transmittal_acks a
    LEFT JOIN transmittals t ON t.id = a.transmittal_id
    WHERE a.token = ?
  `).get(token);
}

function renderAckPage(res, status, { heading, message, detailRows = [], form = '' }) {
  const rows = detailRows
    .map(([k, v]) => `<tr><td style="padding:6px 12px;color:#64748b;font-size:12px;text-transform:uppercase;letter-spacing:.05em">${escapeHtml(k)}</td><td style="padding:6px 12px;font-weight:600">${escapeHtml(v)}</td></tr>`)
    .join('');
  res.status(status).send(`<!doctype html>
<html lang="en"><head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Transmittal Acknowledgment — DrawVault</title>
</head>
<body style="margin:0;font-family:Arial,Helvetica,sans-serif;background:#f1f5f9;color:#0f172a">
  <div style="max-width:480px;margin:48px auto;padding:0 16px">
    <div style="background:#1B3A6B;padding:24px;border-radius:12px 12px 0 0">
      <h1 style="color:#fff;margin:0;font-size:20px">Unique Properties</h1>
      <p style="color:#F4A223;margin:6px 0 0;font-size:13px">Enterprise Drawing Management</p>
    </div>
    <div style="background:#fff;border:1px solid #e2e8f0;border-top:0;border-radius:0 0 12px 12px;padding:28px;text-align:center">
      <h2 style="margin:0 0 8px;font-size:18px">${heading}</h2>
      <p style="color:#64748b;font-size:14px;margin:0 0 20px">${message}</p>
      ${rows ? `<table style="margin:0 auto 20px;border-collapse:collapse;text-align:left">${rows}</table>` : ''}
      ${form}
      <p style="color:#94a3b8;font-size:11px;margin:24px 0 0">This page was generated automatically by Unique Properties DMS.</p>
    </div>
  </div>
</body></html>`);
}

// GET — render only, zero side effects (email scanners prefetch links)
app.get('/ack/:token', ackLimiter, (req, res) => {
  const row = getAckByToken(req.params.token);
  if (!row || !row.trn_number) {
    return renderAckPage(res, 404, {
      heading: 'Link not available',
      message: 'This acknowledgment link is invalid or no longer available.',
    });
  }
  if (row.acked_at) {
    return renderAckPage(res, 200, {
      heading: '&#10003; Already acknowledged',
      message: `This transmittal was acknowledged on ${escapeHtml(row.acked_at.slice(0, 10))}.`,
      detailRows: [['Transmittal', row.trn_number], ['Recipient', row.recipient_name]],
    });
  }
  renderAckPage(res, 200, {
    heading: `Transmittal ${escapeHtml(row.trn_number)}`,
    message: `Hello ${escapeHtml(row.recipient_name)} — please confirm you received this transmittal.`,
    detailRows: [
      ['Transmittal', row.trn_number],
      ['Purpose',     row.purpose || '—'],
      ['Issued',      row.issued_at || '—'],
    ],
    form: `<form method="POST" action="/ack/${escapeHtml(req.params.token)}">
      <button type="submit" style="background:#16a34a;color:#fff;border:0;border-radius:8px;padding:14px 36px;font-size:15px;font-weight:bold;cursor:pointer">&#10003; Acknowledge Receipt</button>
    </form>`,
  });
});

// POST — idempotent state flip; side effects only on the first ack
app.post('/ack/:token', ackLimiter, (req, res) => {
  const row = getAckByToken(req.params.token);
  if (!row || !row.trn_number) {
    return renderAckPage(res, 404, {
      heading: 'Link not available',
      message: 'This acknowledgment link is invalid or no longer available.',
    });
  }
  const now  = new Date().toISOString();
  const info = db.prepare('UPDATE transmittal_acks SET acked_at = ? WHERE token = ? AND acked_at IS NULL')
    .run(now, req.params.token);
  if (info.changes === 0) {
    return renderAckPage(res, 200, {
      heading: '&#10003; Already acknowledged',
      message: `This transmittal was acknowledged on ${escapeHtml((row.acked_at || now).slice(0, 10))}.`,
      detailRows: [['Transmittal', row.trn_number], ['Recipient', row.recipient_name]],
    });
  }
  renderAckPage(res, 200, {
    heading: '&#10003; Receipt acknowledged',
    message: `Thank you, ${escapeHtml(row.recipient_name)} — your acknowledgment has been recorded.`,
    detailRows: [['Transmittal', row.trn_number], ['Acknowledged', now.slice(0, 10)]],
  });
  setImmediate(() => {
    postToSlack(row.project_id, `✅ ${row.recipient_name} acknowledged *${row.trn_number}*`);
    try {
      db.prepare('INSERT INTO activity_log (project_id,type,title,detail,created_at) VALUES (?,?,?,?,?)')
        .run(row.project_id, 'ack', `${row.trn_number} acknowledged`, `by ${row.recipient_name}`, now);
    } catch (e) { console.warn('ack activity_log note:', e.message); }
  });
});

/* ── GET /api/transmittals/:id/pdf ───────────────────────────────── */
app.get('/api/transmittals/:id/pdf', verifyTokenForDownload, (req, res) => {
  try {
    const t = db.prepare('SELECT * FROM transmittals WHERE id = ?').get(req.params.id);
    if (!t) return res.status(404).json({ error: 'Transmittal not found.' });

    if (!ensureProjectAccess(req, res, t.project_id)) return;

    let drawingIds = [], recipients = [];
    try { drawingIds = JSON.parse(t.drawing_ids); } catch {}
    try { recipients = JSON.parse(t.recipients);  } catch {}

    const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(t.project_id) || null;
    const drws = drawingIds.length > 0
      ? db.prepare(`SELECT * FROM drawings WHERE id IN (${drawingIds.map(() => '?').join(',')})`).all(drawingIds)
      : [];

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${t.number}.pdf"`);

    const doc = new PDFDocument({ size: 'A4', margin: 50 });
    doc.pipe(res);
    buildTransmittalPdf(doc, {
      number:     t.number,
      purpose:    t.purpose,
      today:      t.issued_at,
      project,
      recipients,
      drws,
      remarks:    t.remarks,
    });
    doc.end();
  } catch (err) {
    console.error('❌ GET /api/transmittals/:id/pdf error:', err);
    if (!res.headersSent) res.status(500).json({ error: 'Failed to generate PDF.' });
  }
});

/* ── PATCH /api/drawings/:id/void ───────────────────────────────── */
app.patch('/api/drawings/:id/void', requireWriteAccess, (req, res) => {
  const { id } = req.params;
  try {
    const drawing = loadDrawingForRequest(req, res, id);
    if (!drawing) return;
    db.prepare("UPDATE drawings SET status = 'VOID' WHERE id = ?").run(id);
    db.prepare('INSERT INTO activity_log (project_id,type,title,detail,created_at) VALUES (?,?,?,?,?)')
      .run(drawing.project_id, 'void', `${drawing.number} voided`, 'Drawing superseded / voided', new Date().toISOString());
    console.log(`✅ Drawing ${drawing.number} voided`);
    res.json({ id, status: 'VOID' });
  } catch (err) {
    console.error('❌ PATCH /api/drawings/:id/void error:', err);
    res.status(500).json({ error: 'Failed to void drawing.' });
  }
});

/* ── DELETE /api/drawings/:id ───────────────────────────────────── */
app.delete('/api/drawings/:id', requireWriteAccess, (req, res) => {
  const { id } = req.params;
  try {
    const drawing = loadDrawingForRequest(req, res, id);
    if (!drawing) return;
    const revisions = db.prepare('SELECT path FROM drawing_revisions WHERE drawing_id = ?').all(id);

    // Delete DB rows (synchronous)
    db.prepare('DELETE FROM drawing_revisions WHERE drawing_id = ?').run(id);
    db.prepare('DELETE FROM drawings WHERE id = ?').run(id);
    db.prepare('INSERT INTO activity_log (project_id,type,title,detail,created_at) VALUES (?,?,?,?,?)')
      .run(drawing.project_id, 'delete', `${drawing.number} deleted`, 'Drawing permanently removed', new Date().toISOString());
    console.log(`✅ Drawing ${drawing.number} deleted`);

    // Fire-and-forget R2 cleanup (non-blocking)
    const paths = [drawing.path, ...revisions.map(r => r.path)].filter(Boolean);
    paths.forEach(p => deleteFromR2(p));

    res.json({ id, deleted: true });
  } catch (err) {
    console.error('❌ DELETE /api/drawings/:id error:', err);
    res.status(500).json({ error: 'Failed to delete drawing.' });
  }
});

/* ── PATCH /api/drawings/:id ─────────────────────────────────────── */
app.patch('/api/drawings/:id', requireWriteAccess, (req, res) => {
  const { id } = req.params;
  try {
    const drawing = loadDrawingForRequest(req, res, id);
    if (!drawing) return;

    const {
      number     = drawing.number,
      title      = drawing.title,
      discipline = drawing.discipline,
      revision   = drawing.rev,
      originator = drawing.originator,
      status     = drawing.status,
      folderPath = drawing.folder_path,
    } = req.body;

    // Conflict check if number is changing
    if (number !== drawing.number) {
      const conflict = db.prepare(
        'SELECT id FROM drawings WHERE number=? AND project_id=? AND id!=?'
      ).get(number, drawing.project_id, id);
      if (conflict) return res.status(409).json({ error: `Drawing number "${number}" already exists in this project.` });
    }

    db.prepare(
      `UPDATE drawings SET number=?, title=?, discipline=?, rev=?, originator=?, status=?, folder_path=? WHERE id=?`
    ).run(number, title, discipline, revision, originator, status, folderPath, id);

    const updated = db.prepare(
      `SELECT id, number, title, discipline, rev, status,
              issue_date as issueDate, originator, transmittals, path,
              folder_path as folderPath, project_id as projectId
       FROM drawings WHERE id=?`
    ).get(id);

    try {
      db.prepare('INSERT INTO activity_log (project_id,type,title,detail,created_at) VALUES (?,?,?,?,?)')
        .run(drawing.project_id, 'update', `${updated.number} updated`, 'Drawing metadata updated', new Date().toISOString());
    } catch {}

    if (updated?.path) {
      updated.fileName = fileNameFromPath(updated.path);
      updated.path = extractR2Key(updated.path);
    }

    res.json(updated);
  } catch (err) {
    console.error('❌ PATCH /api/drawings/:id error:', err);
    res.status(500).json({ error: 'Failed to update drawing.' });
  }
});

/* ── GET /api/users ─────────────────────────────────────────────── */
app.get('/api/users', requireDirector, (req, res) => {
  try {
    const rows = db.prepare('SELECT id, username, name, role, avatar, allowed_projects, active FROM users ORDER BY id ASC').all();
    res.json(rows.map(u => ({ ...u, allowedProjects: u.allowed_projects, active: u.active ?? 1 })));
  } catch (err) {
    console.error('❌ GET /api/users error:', err);
    res.status(500).json({ error: 'Failed to fetch users.' });
  }
});

/* ── POST /api/users ─────────────────────────────────────────────── */
const VALID_ROLES = ['Director', 'In House Architect', 'Project Team'];

app.post('/api/users', requireDirector, async (req, res) => {
  const { username, password, name, role, allowedProjects } = req.body;
  if (!username || !password || !name || !role) return res.status(400).json({ error: 'username, password, name, and role are required.' });
  if (!VALID_ROLES.includes(role)) return res.status(400).json({ error: `Invalid role. Must be one of: ${VALID_ROLES.join(', ')}` });
  const ap = role === 'Director' ? '*' : (allowedProjects || '*');
  try {
    const avatar = name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
    const hashed = await bcrypt.hash(password, SALT_ROUNDS);
    const result = db.prepare('INSERT INTO users (username, password, name, role, avatar, allowed_projects) VALUES (?, ?, ?, ?, ?, ?)').run(username, hashed, name, role, avatar, ap);
    res.status(201).json({ id: result.lastInsertRowid, username, name, role, avatar, allowedProjects: ap });
  } catch (err) {
    if (err.message?.includes('UNIQUE constraint')) return res.status(409).json({ error: `Username "${username}" is already taken.` });
    console.error('❌ POST /api/users error:', err);
    res.status(500).json({ error: 'Failed to create user.' });
  }
});

/* ── PATCH /api/users/:id — update role + allowed_projects ─────── */
app.patch('/api/users/:id/role', requireDirector, (req, res) => {
  const { role, allowedProjects } = req.body;
  if (!VALID_ROLES.includes(role)) return res.status(400).json({ error: 'Invalid role.' });
  const ap = role === 'Director' ? '*' : (allowedProjects ?? '*');
  try {
    const info = db.prepare('UPDATE users SET role = ?, allowed_projects = ? WHERE id = ?').run(role, ap, req.params.id);
    if (info.changes === 0) return res.status(404).json({ error: 'User not found.' });
    res.json({ id: req.params.id, role, allowedProjects: ap });
  } catch (err) {
    console.error('❌ PATCH /api/users/:id/role error:', err);
    res.status(500).json({ error: 'Failed to update user.' });
  }
});

/* ── PATCH /api/users/:id/reset-password (Director only) ───────── */
app.patch('/api/users/:id/reset-password', requireDirector, async (req, res) => {
  const { newPassword } = req.body;
  if (!newPassword || newPassword.length < 6)
    return res.status(400).json({ error: 'New password must be at least 6 characters.' });
  try {
    const user = db.prepare('SELECT id FROM users WHERE id = ?').get(req.params.id);
    if (!user) return res.status(404).json({ error: 'User not found.' });
    const hashed = await bcrypt.hash(newPassword, SALT_ROUNDS);
    db.prepare('UPDATE users SET password = ? WHERE id = ?').run(hashed, req.params.id);
    console.log(`✅ Director reset password for user id=${req.params.id}`);
    res.json({ message: 'Password reset successfully.' });
  } catch (err) {
    console.error('❌ PATCH /api/users/:id/reset-password error:', err);
    res.status(500).json({ error: 'Failed to reset password.' });
  }
});

/* ── PATCH /api/users/:id/deactivate — toggle active status ────── */
app.patch('/api/users/:id/deactivate', requireDirector, (req, res) => {
  try {
    const user = db.prepare('SELECT id, active FROM users WHERE id = ?').get(req.params.id);
    if (!user) return res.status(404).json({ error: 'User not found.' });
    if (user.id === req.user.id) return res.status(400).json({ error: 'You cannot deactivate your own account.' });
    const newActive = user.active === 0 ? 1 : 0;
    db.prepare('UPDATE users SET active = ? WHERE id = ?').run(newActive, req.params.id);
    console.log(`✅ Director ${newActive ? 'reactivated' : 'deactivated'} user id=${req.params.id}`);
    res.json({ id: user.id, active: newActive });
  } catch (err) {
    console.error('❌ PATCH /api/users/:id/deactivate error:', err);
    res.status(500).json({ error: 'Failed to update user status.' });
  }
});

/* ── DELETE /api/users/:id — permanently remove a user ───────────── */
app.delete('/api/users/:id', requireDirector, (req, res) => {
  try {
    if (parseInt(req.params.id) === req.user.id) return res.status(400).json({ error: 'You cannot delete your own account.' });
    const info = db.prepare('DELETE FROM users WHERE id = ?').run(req.params.id);
    if (info.changes === 0) return res.status(404).json({ error: 'User not found.' });
    console.log(`✅ Director deleted user id=${req.params.id}`);
    res.json({ message: 'User removed successfully.' });
  } catch (err) {
    console.error('❌ DELETE /api/users/:id error:', err);
    res.status(500).json({ error: 'Failed to remove user.' });
  }
});

/* ── PATCH /api/users/me/password ───────────────────────────────── */
app.patch('/api/users/me/password', async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  if (!currentPassword || !newPassword) return res.status(400).json({ error: 'currentPassword and newPassword are required.' });
  if (newPassword.length < 6) return res.status(400).json({ error: 'New password must be at least 6 characters.' });
  try {
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
    if (!user) return res.status(404).json({ error: 'User not found.' });
    const match = await bcrypt.compare(currentPassword, user.password);
    if (!match) return res.status(401).json({ error: 'Current password is incorrect.' });
    const hashed = await bcrypt.hash(newPassword, SALT_ROUNDS);
    db.prepare('UPDATE users SET password = ? WHERE id = ?').run(hashed, req.user.id);
    res.json({ message: 'Password updated successfully.' });
  } catch (err) {
    console.error('❌ PATCH /api/users/me/password error:', err);
    res.status(500).json({ error: 'Failed to update password.' });
  }
});

/* ── POST /api/login ────────────────────────────────────────────── */
app.post('/api/login', loginLimiter, async (req, res) => {
  const { username, password } = req.body;
  try {
    const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username);
    if (!user) return res.status(401).json({ error: 'Invalid username or password' });
    if (user.active === 0) return res.status(403).json({ error: 'Account deactivated — contact your administrator.' });
    const match = await bcrypt.compare(password, user.password);
    if (!match) return res.status(401).json({ error: 'Invalid username or password' });
    const allowedProjects = user.allowed_projects ?? '*';
    const token = jwt.sign(
      { id: user.id, username: user.username, name: user.name, role: user.role, avatar: user.avatar, allowedProjects },
      JWT_SECRET,
      { expiresIn: '7d' }
    );
    res.json({ id: user.id, username: user.username, name: user.name, role: user.role, avatar: user.avatar, allowedProjects, token });
  } catch (err) {
    console.error('❌ POST /api/login error:', err);
    res.status(500).json({ error: 'Login failed' });
  }
});

/* ── Global error handler (catches Multer errors cleanly) ────────── */
app.use((err, req, res, _next) => {
  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(400).json({ error: 'File too large — maximum size is 50 MB.' });
  }
  if (err.message?.startsWith('File type not allowed')) {
    return res.status(400).json({ error: err.message });
  }
  console.error('❌ Unhandled error:', err.message);
  res.status(500).json({ error: 'Internal server error.' });
});

/* ── Start ──────────────────────────────────────────────────────── */
if (process.env.NODE_ENV !== 'test') {
  app.listen(PORT, () => {
    console.log(`\n🚀 DMS Backend running → http://localhost:${PORT}`);
    console.log(`   CORS origin: ${CORS_ORIGIN}\n`);
  });
}

module.exports = { app, db };
