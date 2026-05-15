require('dotenv').config();

const express  = require('express');
const multer   = require('multer');
const cors     = require('cors');
const fs       = require('fs');
const path     = require('path');
const bcrypt   = require('bcrypt');
const jwt      = require('jsonwebtoken');
const Database = require('better-sqlite3');

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
    path         TEXT
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

// Add project_id columns if upgrading from an older schema
try { db.exec('ALTER TABLE drawings ADD COLUMN project_id INTEGER DEFAULT 1;');     } catch {}
try { db.exec('ALTER TABLE transmittals ADD COLUMN project_id INTEGER DEFAULT 1;'); } catch {}

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
const userCount = db.prepare('SELECT COUNT(*) as count FROM users').get().count;
if (userCount === 0) {
  const ins = db.prepare('INSERT INTO users (username, password, name, role, avatar) VALUES (?, ?, ?, ?, ?)');
  ins.run('admin',  bcrypt.hashSync('admin123',  SALT_ROUNDS), 'Harsh Agarwal',  'Document Controller', 'HA');
  ins.run('pm',     bcrypt.hashSync('pm123',     SALT_ROUNDS), 'James Whitfield', 'Project Manager',     'JW');
  ins.run('sub',    bcrypt.hashSync('sub123',    SALT_ROUNDS), 'Carlos Mendez',   'Subcontractor',       'CM');
  ins.run('viewer', bcrypt.hashSync('viewer123', SALT_ROUNDS), 'Client Board',    'Read-Only',           'CB');
}

/* ── Migrate any remaining plaintext passwords ──────────────────── */
const plainUsers = db.prepare("SELECT id, password FROM users WHERE password NOT LIKE '$2b$%'").all();
for (const u of plainUsers) {
  db.prepare('UPDATE users SET password = ? WHERE id = ?').run(bcrypt.hashSync(u.password, SALT_ROUNDS), u.id);
  console.log(`✅ Migrated password for user id=${u.id}`);
}

console.log('✅ SQLite database ready');

/* ── Multer ─────────────────────────────────────────────────────── */
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename:    (req, file, cb) => cb(null, `${Date.now()}-${file.originalname}`),
});
const upload = multer({ storage });

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

/* Apply verifyToken to all /api/* routes except POST /api/login */
app.use('/api', (req, res, next) => {
  if (req.path === '/login' && req.method === 'POST') return next();
  verifyToken(req, res, next);
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

/* ── GET /api/projects ──────────────────────────────────────────── */
app.get('/api/projects', (req, res) => {
  try {
    res.json(db.prepare('SELECT * FROM projects ORDER BY id ASC').all());
  } catch (err) {
    console.error('❌ GET /api/projects error:', err);
    res.status(500).json({ error: 'Failed to fetch projects.' });
  }
});

/* ── POST /api/projects ─────────────────────────────────────────── */
app.post('/api/projects', (req, res) => {
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
app.get('/api/drawings', (req, res) => {
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
    })));
  } catch (err) {
    console.error('❌ GET /api/drawings error:', err);
    res.status(500).json({ error: 'Failed to fetch drawings.' });
  }
});

/* ── POST /api/upload ───────────────────────────────────────────── */
app.post('/api/upload', upload.single('drawingFile'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded.' });

  const { drawingNumber, title, discipline, originator, revision, status, projectId } = req.body;
  const pId      = projectId || 1;
  const filePath = `/uploads/${req.file.filename}`;
  const today    = new Date().toISOString().split('T')[0];

  try {
    const existing = db.prepare('SELECT id FROM drawings WHERE number = ?').get(drawingNumber);
    if (existing) {
      db.prepare(`UPDATE drawings SET title=?, discipline=?, rev=?, status=?, issue_date=?, originator=?, path=?, project_id=? WHERE number=?`)
        .run(title, discipline, revision, status, today, originator, filePath, pId, drawingNumber);
      console.log(`✅ Updated drawing ${drawingNumber} → Rev ${revision}`);
    } else {
      db.prepare(`INSERT INTO drawings (number,title,discipline,rev,status,issue_date,originator,transmittals,path,project_id) VALUES (?,?,?,?,?,?,?,0,?,?)`)
        .run(drawingNumber, title || 'Untitled', discipline, revision, status || 'S1', today, originator, filePath, pId);
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
app.get('/api/transmittals', (req, res) => {
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
app.post('/api/transmittals', (req, res) => {
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
app.patch('/api/drawings/:id/void', (req, res) => {
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

/* ── POST /api/login ────────────────────────────────────────────── */
app.post('/api/login', async (req, res) => {
  const { username, password } = req.body;
  try {
    const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username);
    if (!user) return res.status(401).json({ error: 'Invalid username or password' });
    const match = await bcrypt.compare(password, user.password);
    if (!match) return res.status(401).json({ error: 'Invalid username or password' });
    const token = jwt.sign(
      { id: user.id, username: user.username, name: user.name, role: user.role, avatar: user.avatar },
      JWT_SECRET,
      { expiresIn: '7d' }
    );
    res.json({ id: user.id, username: user.username, name: user.name, role: user.role, avatar: user.avatar, token });
  } catch (err) {
    console.error('❌ POST /api/login error:', err);
    res.status(500).json({ error: 'Login failed' });
  }
});

/* ── Start ──────────────────────────────────────────────────────── */
app.listen(PORT, () => {
  console.log(`\n🚀 DMS Backend running → http://localhost:${PORT}`);
  console.log(`   CORS origin: ${CORS_ORIGIN}\n`);
});
