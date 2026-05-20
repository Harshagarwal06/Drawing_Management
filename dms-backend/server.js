require('dotenv').config();

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
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');

const app         = express();
const PORT        = process.env.PORT        || 3000;
const JWT_SECRET  = process.env.JWT_SECRET  || 'dev-secret-change-in-production';
const CORS_ORIGIN = process.env.CORS_ORIGIN || 'http://localhost:5173';
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

const R2_CONFIGURED = !!(R2_BUCKET && R2_PUBLIC_URL && CLOUDFLARE_ACCT_ID && R2_KEY_ID && R2_SECRET);

// ── Startup validation ──────────────────────────────────────────────
console.log('');
console.log('=== DrawVault Storage Configuration ===');
console.log(`  R2_BUCKET_NAME        : ${R2_BUCKET        || '❌ NOT SET'}`);
console.log(`  R2_PUBLIC_URL         : ${R2_PUBLIC_URL     || '❌ NOT SET'}`);
console.log(`  CLOUDFLARE_ACCOUNT_ID : ${CLOUDFLARE_ACCT_ID || '❌ NOT SET'}`);
console.log(`  R2_ACCESS_KEY_ID      : ${R2_KEY_ID ? '✅ set (' + R2_KEY_ID.slice(0, 6) + '…)' : '❌ NOT SET'}`);
console.log(`  R2_SECRET_ACCESS_KEY  : ${R2_SECRET ? '✅ set'          : '❌ NOT SET'}`);
console.log(`  Storage mode          : ${R2_CONFIGURED ? '☁️  Cloudflare R2' : '⛔ UNCONFIGURED — uploads will be rejected'}`);
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

/* ── Middleware ─────────────────────────────────────────────────── */
app.set('trust proxy', 1); // Railway / Vercel sit behind a reverse proxy
app.use(cors({ origin: CORS_ORIGIN, credentials: true }));
app.use(express.json());

/* ── Uploads folder ─────────────────────────────────────────────── */
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });
app.use('/uploads', express.static(UPLOAD_DIR));

/* ── SQLite setup ───────────────────────────────────────────────── */
const db = new Database(DB_PATH);

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

// Performance indexes (safe to run every boot — IF NOT EXISTS)
try {
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_drawings_project_id          ON drawings(project_id);
    CREATE INDEX IF NOT EXISTS idx_drawings_status              ON drawings(status);
    CREATE INDEX IF NOT EXISTS idx_transmittals_project_id      ON transmittals(project_id);
    CREATE INDEX IF NOT EXISTS idx_activity_project_id          ON activity_log(project_id);
    CREATE INDEX IF NOT EXISTS idx_drawing_revisions_drawing_id ON drawing_revisions(drawing_id);
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

// ── Force director password to Unique123! on every boot ──────────────
try {
  db.prepare("UPDATE users SET password = ? WHERE username = 'director'")
    .run(bcrypt.hashSync('Unique123!', SALT_ROUNDS));
  console.log('✅ Director password enforced → Unique123!');
} catch (e) { console.warn('Director password enforcement note:', e.message); }

/* ── Migrate any remaining plaintext passwords ──────────────────── */
const plainUsers = db.prepare("SELECT id, password FROM users WHERE password NOT LIKE '$2b$%'").all();
for (const u of plainUsers) {
  db.prepare('UPDATE users SET password = ? WHERE id = ?').run(bcrypt.hashSync(u.password, SALT_ROUNDS), u.id);
  console.log(`✅ Migrated password for user id=${u.id}`);
}

console.log('✅ SQLite database ready');

/* ── Multer — memory storage, file type + size validation ───────── */
const ALLOWED_EXTENSIONS = new Set(['.pdf','.dwg','.dxf','.ifc','.rvt','.nwd','.jpg','.jpeg','.png','.tif','.tiff']);

const upload = multer({
  storage: multer.memoryStorage(),
  limits:  { fileSize: 50 * 1024 * 1024 }, // 50 MB
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (ALLOWED_EXTENSIONS.has(ext)) return cb(null, true);
    cb(new Error('File type not allowed. Accepted: PDF, DWG, DXF, IFC, RVT, NWD, JPG, PNG, TIF'));
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

/* ── RBAC: check user has access to the requested project ───────── */
function requireProjectAccess(req, res, next) {
  const allowed   = req.user?.allowedProjects;
  if (allowed === '*') return next();
  const projectId = parseInt(req.params.id || req.query.projectId || req.body?.projectId || 1, 10);
  try {
    const ids = JSON.parse(allowed || '[]');
    if (ids.includes(projectId)) return next();
    return res.status(403).json({ error: 'Access denied — you do not have access to this project.' });
  } catch {
    return res.status(403).json({ error: 'Invalid project access configuration.' });
  }
}

/* ── Upload rate limiter — max 20 uploads per 15 min per IP ─────── */
const uploadLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many uploads — please wait 15 minutes before uploading again.' },
});

/* Apply verifyToken to all /api/* routes except POST /api/login and GET /api/health */
app.use('/api', (req, res, next) => {
  if (req.path === '/login'  && req.method === 'POST') return next();
  if (req.path === '/health' && req.method === 'GET')  return next();
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
    const allowed = req.user?.allowedProjects;
    if (allowed === '*') {
      return res.json(db.prepare('SELECT * FROM projects ORDER BY id ASC').all());
    }
    const ids = JSON.parse(allowed || '[]');
    if (ids.length === 0) return res.json([]);
    const placeholders = ids.map(() => '?').join(',');
    res.json(db.prepare(`SELECT * FROM projects WHERE id IN (${placeholders}) ORDER BY id ASC`).all(ids));
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
app.put('/api/projects/:id/folders', requireProjectAccess, (req, res) => {
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

/* ── GET /api/drawings ──────────────────────────────────────────── */
app.get('/api/drawings', requireProjectAccess, (req, res) => {
  const projectId = req.query.projectId || 1;
  try {
    const rows = db.prepare('SELECT * FROM drawings WHERE project_id = ? ORDER BY id DESC').all(projectId);
    res.json(rows.map(r => ({
      id:           r.id,
      number:       r.number,
      title:        r.title,
      discipline:   r.discipline,
      rev:          r.rev,
      status:       r.status,
      issueDate:    r.issue_date,
      originator:   r.originator,
      transmittals: r.transmittals,
      path:         r.path,
      folderPath:   r.folder_path || '',
    })));
  } catch (err) {
    console.error('❌ GET /api/drawings error:', err);
    res.status(500).json({ error: 'Failed to fetch drawings.' });
  }
});

/* ── POST /api/upload ───────────────────────────────────────────── */
app.post('/api/upload', requireWriteAccess, uploadLimiter, upload.single('drawingFile'), async (req, res) => {
  /* ── Guard: reject immediately if R2 is not configured ── */
  if (!R2_CONFIGURED) {
    console.error('❌ Upload rejected — Cloudflare R2 environment variables are not configured.');
    return res.status(503).json({
      error: 'File storage is not configured. Contact the administrator.',
      detail: 'R2_BUCKET_NAME, R2_PUBLIC_URL, CLOUDFLARE_ACCOUNT_ID, R2_ACCESS_KEY_ID, and R2_SECRET_ACCESS_KEY must all be set.',
    });
  }

  if (!req.file) return res.status(400).json({ error: 'No file uploaded.' });

  const { drawingNumber, title, discipline, originator, revision, status, projectId, folderPath } = req.body;
  const pId  = parseInt(projectId) || 1;
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

    const filePath = `${R2_PUBLIC_URL}/${r2Key}`;
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
      db.prepare(`UPDATE drawings SET title=?, discipline=?, rev=?, status=?, issue_date=?, originator=?, path=?, project_id=?, folder_path=? WHERE number=?`)
        .run(title, discipline, revision, status, today, originator, filePath, pId, fPath, drawingNumber);
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

    res.json({ message: 'Drawing saved successfully.', path: filePath });
  } catch (err) {
    console.error('❌ R2 upload failed:', err.message || err);
    console.error('   Bucket:', R2_BUCKET, '| Key:', r2Key, '| Endpoint:', `https://${CLOUDFLARE_ACCT_ID}.r2.cloudflarestorage.com`);
    res.status(500).json({ error: 'Failed to upload file to cloud storage. Check server logs.' });
  }
});

/* ── GET /api/drawings/:id/revisions ───────────────────────────── */
app.get('/api/drawings/:id/revisions', (req, res) => {
  const { id } = req.params;
  try {
    const drawing = db.prepare('SELECT * FROM drawings WHERE id = ?').get(id);
    if (!drawing) return res.status(404).json({ error: 'Drawing not found.' });

    // Archived past revisions (oldest first)
    const past = db.prepare(
      'SELECT id, rev, status, title, discipline, originator, path, uploaded_by, created_at FROM drawing_revisions WHERE drawing_id = ? ORDER BY id ASC'
    ).all(id);

    // Current revision = what's in the drawings table now
    const current = {
      id:         null,
      rev:        drawing.rev,
      status:     drawing.status,
      title:      drawing.title,
      discipline: drawing.discipline,
      originator: drawing.originator,
      path:       drawing.path,
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

/* ── GET /api/transmittals ──────────────────────────────────────── */
app.get('/api/transmittals', requireProjectAccess, (req, res) => {
  const projectId = req.query.projectId || 1;
  try {
    const rows = db.prepare('SELECT * FROM transmittals WHERE project_id = ? ORDER BY id DESC').all(projectId);
    res.json(rows.map(r => {
      let drawingIds = [], recipients = [];
      try { drawingIds = JSON.parse(r.drawing_ids); } catch {}
      try { recipients = JSON.parse(r.recipients);  } catch {}
      return { id: r.id, number: r.number, drawingIds, recipients, purpose: r.purpose, remarks: r.remarks, issuedAt: r.issued_at };
    }));
  } catch (err) {
    console.error('❌ GET /api/transmittals error:', err);
    res.status(500).json({ error: 'Failed to fetch transmittals.' });
  }
});

/* ── POST /api/transmittals ─────────────────────────────────────── */
app.post('/api/transmittals', requireWriteAccess, (req, res) => {
  const { drawingIds, recipients, purpose, remarks, issuedAt, projectId } = req.body;
  const pId = parseInt(projectId, 10) || 1;
  if (!drawingIds?.length || !recipients?.length || !purpose)
    return res.status(400).json({ error: 'drawingIds, recipients, and purpose are required.' });
  try {
    // Auto-generate TRN number (per-project sequential)
    const count = db.prepare('SELECT COUNT(*) as n FROM transmittals WHERE project_id = ?').get(pId).n;
    const number = `TRN-${String(count + 1).padStart(3, '0')}`;

    const today = issuedAt || new Date().toISOString().split('T')[0];
    const result = db.prepare(`INSERT INTO transmittals (number,drawing_ids,recipients,purpose,remarks,issued_at,project_id) VALUES (?,?,?,?,?,?,?)`)
      .run(number, JSON.stringify(drawingIds), JSON.stringify(recipients), purpose, remarks || '', today, pId);
    // Single bulk UPDATE instead of N+1 loop
    if (drawingIds.length > 0) {
      const placeholders = drawingIds.map(() => '?').join(',');
      db.prepare(`UPDATE drawings SET transmittals = transmittals + 1 WHERE id IN (${placeholders})`).run(drawingIds);
    }
    db.prepare('INSERT INTO activity_log (project_id,type,title,detail,created_at) VALUES (?,?,?,?,?)')
      .run(pId, 'transmittal', `${number} issued`, `${drawingIds.length} drawing(s) — ${purpose}`, new Date().toISOString());
    console.log(`✅ Transmittal ${number} saved`);

    const trnId = result.lastInsertRowid;
    res.status(201).json({ id: trnId, number });

    // ── Async: generate PDF and send emails (don't block response) ──
    if (SMTP_CONFIGURED && recipients.length > 0) {
      setImmediate(async () => {
        try {
          const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(pId);
          const drws = drawingIds.length > 0
            ? db.prepare(`SELECT * FROM drawings WHERE id IN (${drawingIds.map(() => '?').join(',')})`).all(drawingIds)
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

          // Send to each recipient
          for (const r of recipients) {
            const name  = typeof r === 'string' ? r : (r.name  || '');
            const email = typeof r === 'string' ? '' : (r.email || '');
            if (!email) { console.log(`⚠️  No email for recipient "${name}" — skipping`); continue; }
            await mailer.sendMail({
              from:    process.env.SMTP_FROM || process.env.SMTP_USER,
              to:      `${name} <${email}>`,
              subject: `Transmittal ${number} — ${purpose} | ${project?.code || 'Project'}`,
              html: buildEmailHtml({ number, purpose, today, project, recipients, drws, remarks }),
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

function buildEmailHtml({ number, purpose, today, project, recipients, drws, remarks }) {
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

/* ── GET /api/transmittals/:id/pdf ───────────────────────────────── */
app.get('/api/transmittals/:id/pdf', verifyTokenForDownload, (req, res) => {
  try {
    const t = db.prepare('SELECT * FROM transmittals WHERE id = ?').get(req.params.id);
    if (!t) return res.status(404).json({ error: 'Transmittal not found.' });

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
    const drawing = db.prepare('SELECT number, project_id FROM drawings WHERE id = ?').get(id);
    if (!drawing) return res.status(404).json({ error: 'Drawing not found.' });
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
    const drawing = db.prepare('SELECT number, project_id FROM drawings WHERE id = ?').get(id);
    if (!drawing) return res.status(404).json({ error: 'Drawing not found.' });
    db.prepare('DELETE FROM drawings WHERE id = ?').run(id);
    db.prepare('INSERT INTO activity_log (project_id,type,title,detail,created_at) VALUES (?,?,?,?,?)')
      .run(drawing.project_id, 'delete', `${drawing.number} deleted`, 'Drawing permanently removed', new Date().toISOString());
    console.log(`✅ Drawing ${drawing.number} deleted`);
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
    const drawing = db.prepare('SELECT * FROM drawings WHERE id = ?').get(id);
    if (!drawing) return res.status(404).json({ error: 'Drawing not found.' });

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
app.post('/api/login', async (req, res) => {
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
app.use((err, req, res, next) => {
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
app.listen(PORT, () => {
  console.log(`\n🚀 DMS Backend running → http://localhost:${PORT}`);
  console.log(`   CORS origin: ${CORS_ORIGIN}\n`);
});
