const Database = require('better-sqlite3');
const path = require('path');

const db = new Database(path.join(__dirname, 'dms.db'));

const MOCK_DRAWINGS = [
  { number: "ARC-GF-001", title: "Ground Floor Plan", discipline: "Architecture", rev: "C", status: "S3", issueDate: "2025-04-02", originator: "HDA Architects", transmittals: 4, path: null },
  { number: "ARC-RF-002", title: "Roof Plan & Details", discipline: "Architecture", rev: "B", status: "S2", issueDate: "2025-03-18", originator: "HDA Architects", transmittals: 2, path: null },
  { number: "STR-FD-001", title: "Foundation Layout", discipline: "Structure", rev: "D", status: "S3", issueDate: "2025-04-10", originator: "Turner Eng.", transmittals: 6, path: null },
  { number: "STR-FD-002", title: "Pile Cap Details", discipline: "Structure", rev: "A", status: "S1", issueDate: "2025-05-01", originator: "Turner Eng.", transmittals: 1, path: null },
  { number: "MEP-AC-001", title: "HVAC Schematic - Level 1", discipline: "MEP", rev: "B", status: "S3", issueDate: "2025-03-25", originator: "AirFlow MEP", transmittals: 3, path: null },
];

try {
  const insert = db.prepare(`
    INSERT INTO drawings (number, title, discipline, rev, status, issue_date, originator, transmittals, path)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  for (const d of MOCK_DRAWINGS) {
    // Only insert if it doesn't exist
    const existing = db.prepare('SELECT id FROM drawings WHERE number = ?').get(d.number);
    if (!existing) {
      insert.run(d.number, d.title, d.discipline, d.rev, d.status, d.issueDate, d.originator, d.transmittals, d.path);
    }
  }
  console.log("Database seeded successfully.");
} catch (err) {
  console.error("Error seeding database:", err);
}
