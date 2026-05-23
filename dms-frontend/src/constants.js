export const LS_KEYS = { transmittals: "dv_transmittals" };

export const MOCK_DRAWINGS = [
  { id: 1,  number: "ARC-GF-001", title: "Ground Floor Plan",            discipline: "Architecture", rev: "C",  status: "S3",  issueDate: "2025-04-02", originator: "HDA Architects",  transmittals: 4 },
  { id: 2,  number: "ARC-RF-002", title: "Roof Plan & Details",           discipline: "Architecture", rev: "B",  status: "S2",  issueDate: "2025-03-18", originator: "HDA Architects",  transmittals: 2 },
  { id: 3,  number: "STR-FD-001", title: "Foundation Layout",             discipline: "Structure",    rev: "D",  status: "S3",  issueDate: "2025-04-10", originator: "Turner Eng.",     transmittals: 6 },
  { id: 4,  number: "STR-FD-002", title: "Pile Cap Details",              discipline: "Structure",    rev: "A",  status: "S1",  issueDate: "2025-05-01", originator: "Turner Eng.",     transmittals: 1 },
  { id: 5,  number: "MEP-AC-001", title: "HVAC Schematic - Level 1",      discipline: "MEP",          rev: "B",  status: "S3",  issueDate: "2025-03-25", originator: "AirFlow MEP",     transmittals: 3 },
  { id: 6,  number: "MEP-EL-001", title: "Electrical Single Line Diag.",  discipline: "MEP",          rev: "A",  status: "S1",  issueDate: "2025-05-05", originator: "AirFlow MEP",     transmittals: 1 },
  { id: 7,  number: "CIV-SD-001", title: "Site Drainage Plan",            discipline: "Civil",        rev: "C",  status: "S3",  issueDate: "2025-02-14", originator: "Terrain Civil",   transmittals: 5 },
  { id: 8,  number: "CIV-RD-001", title: "Road Pavement Design",          discipline: "Civil",        rev: "B",  status: "S2",  issueDate: "2025-03-30", originator: "Terrain Civil",   transmittals: 2 },
  { id: 9,  number: "INT-LB-001", title: "Lobby Interior Elevations",     discipline: "Interior",     rev: "A",  status: "S1",  issueDate: "2025-05-08", originator: "Spatial Studio",  transmittals: 0 },
  { id: 10, number: "INT-OF-001", title: "Open Plan Office Layout",       discipline: "Interior",     rev: "B",  status: "S2",  issueDate: "2025-04-20", originator: "Spatial Studio",  transmittals: 2 },
  { id: 11, number: "STR-CL-003", title: "Column Schedule",               discipline: "Structure",    rev: "A",  status: "VOID",issueDate: "2025-01-10", originator: "Turner Eng.",     transmittals: 3 },
  { id: 12, number: "ARC-FA-003", title: "Facade Cladding System",        discipline: "Architecture", rev: "E",  status: "S3",  issueDate: "2025-04-28", originator: "HDA Architects",  transmittals: 7 },
  { id: 13, number: "MEP-PL-002", title: "Plumbing Isometrics - L2",      discipline: "MEP",          rev: "A",  status: "S1",  issueDate: "2025-05-11", originator: "AirFlow MEP",     transmittals: 0 },
  { id: 14, number: "CIV-LS-001", title: "Landscape Masterplan",          discipline: "Civil",        rev: "B",  status: "S2",  issueDate: "2025-04-05", originator: "GreenAxis",       transmittals: 2 },
  { id: 15, number: "STR-BM-004", title: "Beam Connection Details",       discipline: "Structure",    rev: "C",  status: "S3",  issueDate: "2025-03-12", originator: "Turner Eng.",     transmittals: 4 },
];

export const MOCK_TRANSMITTALS = [
  {
    id: 1, number: "TRN-001",
    drawingIds: [1, 3, 5],
    recipients: [{ id: "r1", name: "James Whitfield", role: "Project Manager", avatar: "JW" }],
    purpose: "For Construction", remarks: "Issued for site commencement.",
    issuedAt: "2025-04-10",
  },
  {
    id: 2, number: "TRN-002",
    drawingIds: [2, 8, 10],
    recipients: [{ id: "r2", name: "Priya Nair", role: "Structural Engineer", avatar: "PN" }],
    purpose: "For Approval", remarks: "Please review and return comments by end of month.",
    issuedAt: "2025-03-22",
  },
  {
    id: 3, number: "TRN-003",
    drawingIds: [7, 14],
    recipients: [{ id: "r9", name: "Client Review Board", role: "Group", avatar: "CR" }],
    purpose: "For Review & Comment", remarks: "Drainage and landscape drawings for client review.",
    issuedAt: "2025-03-30",
  },
  {
    id: 4, number: "TRN-004",
    drawingIds: [12, 1],
    recipients: [
      { id: "r4", name: "Aisha Al-Farsi", role: "Architect", avatar: "AA" },
      { id: "r6", name: "Sophie Leclerc", role: "Design Manager", avatar: "SL" },
    ],
    purpose: "For Review & Comment", remarks: "Facade package — awaiting design manager sign-off.",
    issuedAt: "2025-04-01",
  },
  {
    id: 5, number: "TRN-005",
    drawingIds: [15, 3, 11],
    recipients: [{ id: "r10", name: "Main Contractor", role: "Group", avatar: "MC" }],
    purpose: "For Construction", remarks: "Structural package for subcontractor coordination.",
    issuedAt: "2025-04-15",
  },
];

export const STATUS_META = {
  S1:   { label: "S1 – For Information",  bg: "bg-blue-100",    text: "text-blue-700",   dot: "bg-blue-400"    },
  S2:   { label: "S2 – For Approval",     bg: "bg-amber-100",   text: "text-amber-700",  dot: "bg-amber-400"   },
  S3:   { label: "S3 – For Construction", bg: "bg-emerald-100", text: "text-emerald-700",dot: "bg-emerald-500" },
  VOID: { label: "Void",                  bg: "bg-red-100",     text: "text-red-600",    dot: "bg-red-400"     },
};

export const DISCIPLINE_COLORS = {
  Architecture: "bg-violet-100 text-violet-700",
  Structure:    "bg-orange-100 text-orange-700",
  Electrical:   "bg-cyan-100 text-cyan-700",
  Plumbing:     "bg-sky-100 text-sky-700",
  Fire:         "bg-red-100 text-red-700",
  Civil:        "bg-teal-100 text-teal-700",
  Interior:     "bg-pink-100 text-pink-700",
};

export const DISCIPLINES  = ["Architecture", "Structure", "MEP", "Electrical", "Plumbing", "Fire", "HVAC", "Civil", "Interior"];
export const MEP_SUBTYPES = ["Electrical", "Plumbing", "Fire", "HVAC"];
export const STATUSES     = ["S1", "S2", "S3", "VOID"];
export const ORIGINATORS  = ["HDA Architects", "Turner Eng.", "AirFlow MEP", "Terrain Civil", "Spatial Studio", "GreenAxis"];
export const ROLES        = ["Director", "In House Architect", "Project Team"];

export const MOCK_RECIPIENTS = [
  { id: "r1",  name: "James Whitfield",     role: "Project Manager",     avatar: "JW" },
  { id: "r2",  name: "Priya Nair",          role: "Structural Engineer", avatar: "PN" },
  { id: "r3",  name: "Carlos Mendez",       role: "MEP Coordinator",     avatar: "CM" },
  { id: "r4",  name: "Aisha Al-Farsi",      role: "Architect",           avatar: "AA" },
  { id: "r5",  name: "Thomas Bergmann",     role: "Quantity Surveyor",   avatar: "TB" },
  { id: "r6",  name: "Sophie Leclerc",      role: "Design Manager",      avatar: "SL" },
  { id: "r7",  name: "Raj Patel",           role: "Civil Engineer",      avatar: "RP" },
  { id: "r8",  name: "Orion QA Team",       role: "Group",               avatar: "QA" },
  { id: "r9",  name: "Client Review Board", role: "Group",               avatar: "CR" },
  { id: "r10", name: "Main Contractor",     role: "Group",               avatar: "MC" },
];

export const TRANSMITTAL_PURPOSES = [
  "For Review & Comment",
  "For Approval",
  "For Construction",
  "For Information",
  "For Tender",
  "As-Built",
];

export const OVERDUE_PURPOSES = new Set(["For Review & Comment", "For Approval"]);
export const MS_30_DAYS = 30 * 24 * 60 * 60 * 1000;
