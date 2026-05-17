require('dotenv').config();

const express   = require('express');
const multer    = require('multer');
const cors      = require('cors');
const fs        = require('fs');
const path      = require('path');
const bcrypt    = require('bcrypt');
const jwt       = require('jsonwebtoken');
const rateLimit = require('express-rate-limit');
const Database  = require('better-sqlite3');

const app         = express();
const PORT        = process.env.PORT        || 3000;
const JWT_SECRET  = process.env.JWT_SECRET  || 'dev-secret-change-in-production';
const CORS_ORIGIN = process.env.CORS_ORIGIN || 'http://localhost:5173';
const DB_PATH     = process.env.DB_PATH     || path.join(__dirname, 'dms.db');

/* ── Middleware ─────────────────────────────────────────────────── */
app.use(cors({ origin: CORS_ORIGIN }));
app.use(express.json());

/* ── Uploads folder ─────────────────────────────────────────────── */
const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir);
app.use('/uploads', express.static(uploadDir));

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

// Add columns if upgrading from an older schema
try { db.exec('ALTER TABLE drawings ADD COLUMN project_id INTEGER DEFAULT 1;');     } catch {}
try { db.exec("ALTER TABLE drawings ADD COLUMN folder_path TEXT DEFAULT '';");       } catch {}
try { db.exec('ALTER TABLE transmittals ADD COLUMN project_id INTEGER DEFAULT 1;'); } catch {}
try { db.exec("ALTER TABLE users ADD COLUMN allowed_projects TEXT DEFAULT '*';");   } catch {}

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

/* ── Seed users (hashed passwords) ─────────────────────────────── */
const SALT_ROUNDS = 10;

// Always ensure the 3 canonical demo accounts exist (INSERT OR IGNORE = safe to run every boot)
const ensureUser = db.prepare('INSERT OR IGNORE INTO users (username, password, name, role, avatar, allowed_projects) VALUES (?, ?, ?, ?, ?, ?)');
ensureUser.run('director',  bcrypt.hashSync('director123', SALT_ROUNDS), 'Harsh Agarwal', 'Director',           'HA', '*');
ensureUser.run('architect', bcrypt.hashSync('arch123',     SALT_ROUNDS), 'Priya Sharma',  'In House Architect', 'PS', '*');
ensureUser.run('team',      bcrypt.hashSync('team123',     SALT_ROUNDS), 'Carlos Mendez', 'Project Team',       'CM', '[1]');

/* ── Migrate any remaining plaintext passwords ──────────────────── */
const plainUsers = db.prepare("SELECT id, password FROM users WHERE password NOT LIKE '$2b$%'").all();
for (const u of plainUsers) {
  db.prepare('UPDATE users SET password = ? WHERE id = ?').run(bcrypt.hashSync(u.password, SALT_ROUNDS), u.id);
  console.log(`✅ Migrated password for user id=${u.id}`);
}

console.log('✅ SQLite database ready');

/* ── Multer — file type + size validation ────────────────────────── */
const ALLOWED_EXTENSIONS = new Set(['.pdf','.dwg','.dxf','.ifc','.rvt','.nwd','.jpg','.jpeg','.png','.tif','.tiff']);

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename:    (req, file, cb) => cb(null, `${Date.now()}-${file.originalname}`),
});
const upload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 }, // 50 MB
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
  const projectId = parseInt(req.query.projectId || req.body?.projectId || 1, 10);
  try {
    const ids = JSON.parse(allowed || '[]');
    if (ids.includes(projectId)) return next();
    return res.status(403).json({ error: 'Access denied — you do not have access to this project.' });
  } catch {
    return res.status(403).json({ error: 'Invalid project access configuration.' });
  }
}

/* ── Login rate limiter — max 10 attempts per 15 min ────────────── */
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many login attempts — please try again in 15 minutes.' },
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
app.get('/api/activity', (req, res) => {
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
app.post('/api/upload', requireWriteAccess, upload.single('drawingFile'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded.' });

  const { drawingNumber, title, discipline, originator, revision, status, projectId, folderPath } = req.body;
  const pId      = projectId || 1;
  const fPath    = folderPath || '';
  const filePath = `/uploads/${req.file.filename}`;
  const today    = new Date().toISOString().split('T')[0];

  try {
    const existing = db.prepare('SELECT id FROM drawings WHERE number = ?').get(drawingNumber);
    if (existing) {
      db.prepare(`UPDATE drawings SET title=?, discipline=?, rev=?, status=?, issue_date=?, originator=?, path=?, project_id=?, folder_path=? WHERE number=?`)
        .run(title, discipline, revision, status, today, originator, filePath, pId, fPath, drawingNumber);
      console.log(`✅ Updated drawing ${drawingNumber} → Rev ${revision}`);
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
    console.error('❌ POST /api/upload error:', err);
    res.status(500).json({ error: 'Failed to save drawing.' });
  }
});

/* ── GET /api/transmittals ──────────────────────────────────────── */
app.get('/api/transmittals', requireProjectAccess, (req, res) => {
  const projectId = req.query.projectId || 1;
  try {
    const rows = db.prepare('SELECT * FROM transmittals WHERE project_id = ? ORDER BY id DESC').all(projectId);
    res.json(rows.map(r => ({
      id:         r.id,
      number:     r.number,
      drawingIds: JSON.parse(r.drawing_ids),
      recipients: JSON.parse(r.recipients),
      purpose:    r.purpose,
      remarks:    r.remarks,
      issuedAt:   r.issued_at,
    })));
  } catch (err) {
    console.error('❌ GET /api/transmittals error:', err);
    res.status(500).json({ error: 'Failed to fetch transmittals.' });
  }
});

/* ── POST /api/transmittals ─────────────────────────────────────── */
app.post('/api/transmittals', requireWriteAccess, (req, res) => {
  const { number, drawingIds, recipients, purpose, remarks, issuedAt, projectId } = req.body;
  const pId = projectId || 1;
  if (!drawingIds?.length || !recipients?.length || !purpose)
    return res.status(400).json({ error: 'drawingIds, recipients, and purpose are required.' });
  try {
    const result = db.prepare(`INSERT INTO transmittals (number,drawing_ids,recipients,purpose,remarks,issued_at,project_id) VALUES (?,?,?,?,?,?,?)`)
      .run(number, JSON.stringify(drawingIds), JSON.stringify(recipients), purpose, remarks || '', issuedAt || new Date().toISOString().split('T')[0], pId);
    const updateCount = db.prepare('UPDATE drawings SET transmittals = transmittals + 1 WHERE id = ?');
    for (const id of drawingIds) updateCount.run(id);
    db.prepare('INSERT INTO activity_log (project_id,type,title,detail,created_at) VALUES (?,?,?,?,?)')
      .run(pId, 'transmittal', `${number} issued`, `${drawingIds.length} drawing(s) — ${purpose}`, new Date().toISOString());
    console.log(`✅ Transmittal ${number} saved`);
    res.status(201).json({ id: result.lastInsertRowid, number });
  } catch (err) {
    console.error('❌ POST /api/transmittals error:', err);
    res.status(500).json({ error: 'Failed to save transmittal.' });
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

/* ── GET /api/users ─────────────────────────────────────────────── */
app.get('/api/users', requireDirector, (req, res) => {
  try {
    const rows = db.prepare('SELECT id, username, name, role, avatar, allowed_projects FROM users ORDER BY id ASC').all();
    res.json(rows.map(u => ({ ...u, allowedProjects: u.allowed_projects })));
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
