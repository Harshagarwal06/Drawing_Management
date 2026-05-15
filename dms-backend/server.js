const express  = require('express');
const multer   = require('multer');
const cors     = require('cors');
const fs       = require('fs');
const path     = require('path');
const Database = require('better-sqlite3');

const app  = express();
const PORT = 3000;

/* ── Middleware ─────────────────────────────────────────────────── */
app.use(cors());
app.use(express.json());

/* ── Uploads folder ─────────────────────────────────────────────── */
const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir);
app.use('/uploads', express.static(uploadDir));

/* ── SQLite setup ───────────────────────────────────────────────── */
const db = new Database(path.join(__dirname, 'dms.db'));

db.exec(`
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
`);

console.log('✅ SQLite database ready (dms.db)');

/* ── Multer ─────────────────────────────────────────────────────── */
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename:    (req, file, cb) => cb(null, `${Date.now()}-${file.originalname}`),
});
const upload = multer({ storage });

/* ── GET /api/drawings ──────────────────────────────────────────── */
app.get('/api/drawings', (req, res) => {
  try {
    const rows = db.prepare('SELECT * FROM drawings ORDER BY id DESC').all();
    const drawings = rows.map(r => ({
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
    }));
    res.json(drawings);
  } catch (err) {
    console.error('❌ GET /api/drawings error:', err);
    res.status(500).json({ error: 'Failed to fetch drawings.' });
  }
});

/* ── POST /api/upload ───────────────────────────────────────────── */
app.post('/api/upload', upload.single('drawingFile'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded.' });
  }

  const { drawingNumber, title, discipline, originator, revision, status } = req.body;
  const filePath = `/uploads/${req.file.filename}`;
  const today    = new Date().toISOString().split('T')[0];

  try {
    const existing = db.prepare('SELECT id FROM drawings WHERE number = ?').get(drawingNumber);

    if (existing) {
      db.prepare(`
        UPDATE drawings
        SET title = ?, discipline = ?, rev = ?, status = ?, issue_date = ?, originator = ?, path = ?
        WHERE number = ?
      `).run(title, discipline, revision, status, today, originator, filePath, drawingNumber);
      console.log(`✅ Updated drawing ${drawingNumber} → Rev ${revision}`);
    } else {
      db.prepare(`
        INSERT INTO drawings (number, title, discipline, rev, status, issue_date, originator, transmittals, path)
        VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?)
      `).run(drawingNumber, title || 'Untitled', discipline, revision, status || 'S1', today, originator, filePath);
      console.log(`✅ Registered new drawing ${drawingNumber} Rev ${revision}`);
    }

    res.json({ message: 'Drawing saved successfully.', path: filePath });
  } catch (err) {
    console.error('❌ POST /api/upload error:', err);
    res.status(500).json({ error: 'Failed to save drawing.' });
  }
});

/* ── GET /api/transmittals ──────────────────────────────────────── */
app.get('/api/transmittals', (req, res) => {
  try {
    const rows = db.prepare('SELECT * FROM transmittals ORDER BY id DESC').all();
    const transmittals = rows.map(r => ({
      id:         r.id,
      number:     r.number,
      drawingIds: JSON.parse(r.drawing_ids),
      recipients: JSON.parse(r.recipients),
      purpose:    r.purpose,
      remarks:    r.remarks,
      issuedAt:   r.issued_at,
    }));
    res.json(transmittals);
  } catch (err) {
    console.error('❌ GET /api/transmittals error:', err);
    res.status(500).json({ error: 'Failed to fetch transmittals.' });
  }
});

/* ── POST /api/transmittals ─────────────────────────────────────── */
app.post('/api/transmittals', (req, res) => {
  const { number, drawingIds, recipients, purpose, remarks, issuedAt } = req.body;

  if (!drawingIds?.length || !recipients?.length || !purpose) {
    return res.status(400).json({ error: 'drawingIds, recipients, and purpose are required.' });
  }

  try {
    const result = db.prepare(`
      INSERT INTO transmittals (number, drawing_ids, recipients, purpose, remarks, issued_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(
      number,
      JSON.stringify(drawingIds),
      JSON.stringify(recipients),
      purpose,
      remarks || '',
      issuedAt || new Date().toISOString().split('T')[0],
    );

    /* Increment transmittal count on each drawing included */
    const updateCount = db.prepare(
      'UPDATE drawings SET transmittals = transmittals + 1 WHERE id = ?'
    );
    for (const id of drawingIds) updateCount.run(id);

    console.log(`✅ Transmittal ${number} saved (${drawingIds.length} drawings)`);
    res.status(201).json({ id: result.lastInsertRowid, number });
  } catch (err) {
    console.error('❌ POST /api/transmittals error:', err);
    res.status(500).json({ error: 'Failed to save transmittal.' });
  }
});

/* ── Start ──────────────────────────────────────────────────────── */
app.listen(PORT, () => {
  console.log(`\n🚀 DMS Backend running → http://localhost:${PORT}\n`);
});
