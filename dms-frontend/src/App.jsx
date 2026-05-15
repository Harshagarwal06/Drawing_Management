import { useState, useMemo, useEffect } from "react";
import { Bell, User, ChevronDown, Send, Upload } from "lucide-react";

import MetricCard from "./components/MetricCard";
import UploadModal from "./components/UploadModal";
import TransmittalModal from "./components/TransmittalModal";
import MasterRegisterTable from "./components/MasterRegisterTable";
import Toast from "./components/Toast";

import { ROLES, OVERDUE_PURPOSES, MS_30_DAYS } from "./constants";

const API = "http://localhost:3000";
const PER_PAGE = 8;

async function fetchDrawings() {
  const res = await fetch(`${API}/api/drawings`);
  if (!res.ok) throw new Error("drawings fetch failed");
  return res.json();
}

async function fetchTransmittals() {
  const res = await fetch(`${API}/api/transmittals`);
  if (!res.ok) throw new Error("transmittals fetch failed");
  return res.json();
}

export default function App() {
  const [drawings,        setDrawings]        = useState([]);
  const [transmittals,    setTransmittals]    = useState([]);
  const [showModal,       setShowModal]       = useState(false);
  const [showTransmittal, setShowTransmittal] = useState(false);
  const [toast,           setToast]           = useState(null);
  const [activeRole,      setActiveRole]      = useState("Document Controller");
  const [search,          setSearch]          = useState("");
  const [filterDisc,      setFilterDisc]      = useState("All");
  const [filterStat,      setFilterStat]      = useState("All");
  const [sortKey,         setSortKey]         = useState("number");
  const [sortDir,         setSortDir]         = useState("asc");
  const [page,            setPage]            = useState(1);
  const [activeTab,       setActiveTab]       = useState("Dashboard");

  const isRestricted = activeRole === "Subcontractor" || activeRole === "Read-Only";

  /* ── Bootstrap: load both collections from backend ── */
  useEffect(() => {
    fetchDrawings().then(setDrawings).catch(() => {});
    fetchTransmittals().then(setTransmittals).catch(() => {});
  }, []);

  /* ── Derived metrics ── */
  const totalDrawings     = drawings.length;
  const forConstruction   = drawings.filter(d => d.status === "S3").length;
  const pendingReviews    = drawings.filter(d => d.status === "S2").length;
  const disciplineCount   = new Set(drawings.map(d => d.discipline)).size;
  const totalTransmittals = transmittals.length;
  const overdueTransmit   = transmittals.filter(t =>
    OVERDUE_PURPOSES.has(t.purpose) &&
    (Date.now() - new Date(t.issuedAt).getTime()) > MS_30_DAYS
  ).length;

  const nextTrnNumber = `TRN-${String(transmittals.length + 1).padStart(3, "0")}`;

  /* ── Filter + sort ── */
  const filtered = useMemo(() => {
    let d = drawings.filter(row => {
      const q = search.toLowerCase();
      const matchQ = !q ||
        row.number.toLowerCase().includes(q) ||
        row.title.toLowerCase().includes(q) ||
        row.originator.toLowerCase().includes(q);
      const matchD = filterDisc === "All" || row.discipline === filterDisc;
      const matchS = filterStat === "All" || row.status     === filterStat;
      return matchQ && matchD && matchS;
    });
    return [...d].sort((a, b) => {
      let va = a[sortKey] ?? "", vb = b[sortKey] ?? "";
      if (typeof va === "string") { va = va.toLowerCase(); vb = vb.toLowerCase(); }
      if (va < vb) return sortDir === "asc" ? -1 :  1;
      if (va > vb) return sortDir === "asc" ?  1 : -1;
      return 0;
    });
  }, [drawings, search, filterDisc, filterStat, sortKey, sortDir]);

  const totalPages = Math.ceil(filtered.length / PER_PAGE);
  const pageRows   = filtered.slice((page - 1) * PER_PAGE, page * PER_PAGE);

  const handleSort = (key) => {
    if (sortKey === key) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortKey(key); setSortDir("asc"); }
    setPage(1);
  };

  const handleSearch     = (v) => { setSearch(v);     setPage(1); };
  const handleFilterDisc = (v) => { setFilterDisc(v); setPage(1); };
  const handleFilterStat = (v) => { setFilterStat(v); setPage(1); };

  /* ── Upload: POST file, then re-fetch drawings ── */
  const handleUpload = async (form, file) => {
    const fd = new FormData();
    fd.append("drawingFile",   file);
    fd.append("drawingNumber", form.drawingNumber);
    fd.append("title",         form.title);
    fd.append("discipline",    form.discipline);
    fd.append("revision",      form.revision);
    fd.append("originator",    form.originator);
    fd.append("status",        form.status);
    fd.append("notes",         form.notes || "");

    try {
      const res = await fetch(`${API}/api/upload`, { method: "POST", body: fd });
      if (!res.ok) throw new Error(`Server responded ${res.status}`);
      await res.json();
      setDrawings(await fetchDrawings());
      setShowModal(false);
      setToast({ msg: `"${form.drawingNumber}" registered successfully.`, type: "success" });
    } catch {
      setShowModal(false);
      setToast({ msg: "Upload failed — is the backend server running?", type: "error" });
    }
  };

  /* ── Transmittal: POST to backend, then re-fetch both collections ── */
  const handleTransmittal = async (formData) => {
    try {
      const res = await fetch(`${API}/api/transmittals`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({
          number:     nextTrnNumber,
          drawingIds: formData.drawingIds,
          recipients: formData.recipients,
          purpose:    formData.purpose,
          remarks:    formData.remarks,
          issuedAt:   new Date().toISOString().split("T")[0],
        }),
      });
      if (!res.ok) throw new Error(`Server responded ${res.status}`);

      /* Re-fetch both so transmittal counts on drawings update too */
      const [freshDrawings, freshTransmittals] = await Promise.all([
        fetchDrawings(),
        fetchTransmittals(),
      ]);
      setDrawings(freshDrawings);
      setTransmittals(freshTransmittals);
      setShowTransmittal(false);
      setToast({ msg: `Transmittal ${nextTrnNumber} issued successfully.`, type: "success" });
    } catch {
      setShowTransmittal(false);
      setToast({ msg: "Could not save transmittal — is the backend running?", type: "error" });
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">

      {/* Top nav */}
      <header className="sticky top-0 z-40 bg-slate-900 border-b border-slate-800 px-6 py-0 flex items-center h-14 gap-6">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-blue-500 flex items-center justify-center text-white text-xs font-bold shrink-0">DV</div>
          <span className="text-white font-semibold text-sm tracking-tight">DrawVault</span>
          <span className="text-slate-600 text-sm hidden sm:block">/ Enterprise DMS</span>
        </div>
        <nav className="hidden md:flex items-center gap-1 ml-4">
          {["Dashboard", "Drawings", "Transmittals", "Packages", "Reports"].map((n) => (
            <button
              key={n}
              onClick={() => setActiveTab(n)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition ${
                activeTab === n ? "bg-blue-600 text-white" : "text-slate-400 hover:text-white hover:bg-slate-800"
              }`}
            >
              {n}
            </button>
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-3">
          <button className="relative p-2 text-slate-400 hover:text-white transition rounded-lg hover:bg-slate-800">
            <Bell className="w-5 h-5" />
            <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full border-2 border-slate-900" />
          </button>

          {/* Role selector */}
          <div className="flex items-center gap-1.5 border border-slate-700 rounded-lg px-2.5 py-1.5 bg-slate-800 hover:border-slate-600 transition">
            <User className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <span className="text-slate-400 text-xs hidden sm:block">Viewing as:</span>
            <select
              value={activeRole}
              onChange={e => setActiveRole(e.target.value)}
              className="bg-transparent text-xs font-semibold text-white outline-none cursor-pointer max-w-[130px]"
              style={{ WebkitAppearance: "none" }}
            >
              {ROLES.map(r => (
                <option key={r} value={r} className="bg-slate-800 text-white">{r}</option>
              ))}
            </select>
            <ChevronDown className="w-3 h-3 text-slate-500 shrink-0 pointer-events-none" />
          </div>

          <div className="w-7 h-7 rounded-full bg-blue-600 flex items-center justify-center text-white text-xs font-semibold">HA</div>
        </div>
      </header>

      {/* Project bar */}
      <div className="bg-white border-b border-slate-200 px-6 py-3 flex items-center justify-between">
        <div>
          <p className="text-xs text-slate-400 mb-0.5">
            Project — <span className="text-slate-600 font-medium">Orion Tower, Dubai (ORI-2024)</span>
          </p>
          <h1 className="text-lg font-bold text-slate-900">Drawing Management</h1>
        </div>
        <div className="flex items-center gap-2">
          <span className="hidden sm:flex items-center gap-1.5 text-xs text-slate-500 bg-slate-100 px-3 py-1.5 rounded-full">
            <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" />
            Live sync active
          </span>
          {!isRestricted && (
            <button
              onClick={() => setShowTransmittal(true)}
              className="flex items-center gap-2 text-sm font-semibold px-4 py-2 rounded-lg transition border border-indigo-200 text-indigo-700 bg-indigo-50 hover:bg-indigo-100 hover:border-indigo-300"
            >
              <Send className="w-4 h-4" />
              Create Transmittal
            </button>
          )}
          {!isRestricted && (
            <button
              onClick={() => setShowModal(true)}
              className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold px-4 py-2 rounded-lg transition shadow-sm shadow-blue-200"
            >
              <Upload className="w-4 h-4" />
              Upload Drawing
            </button>
          )}
        </div>
      </div>

      <main className="flex-1 px-6 py-6 space-y-6 max-w-screen-xl mx-auto w-full">
        {activeTab === "Dashboard" ? (
          <>
            {/* Metrics */}
        <section>
          <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-3">Project Overview</h2>
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
            <MetricCard label="Total Drawings"     value={totalDrawings}     sub={`Across ${disciplineCount} disciplines`} icon="📐" accent="blue"    />
            <MetricCard label="For Construction"   value={forConstruction}   sub="Status S3 issued"                        icon="🏗️" accent="emerald"  />
            <MetricCard label="Pending Reviews"    value={pendingReviews}    sub="Awaiting S2 approval"                    icon="🔍" accent="amber"   />
            <MetricCard label="Overdue Transmit."  value={overdueTransmit}   sub="Unresolved > 30 days"                   icon="⚠️" accent="red"     />
            <MetricCard label="Total Transmittals" value={totalTransmittals} sub="Packages issued to date"                 icon="📦" accent="violet"  />
          </div>
        </section>

        <MasterRegisterTable
          drawings={drawings}
          filtered={filtered}
          pageRows={pageRows}
          page={page}
          totalPages={totalPages}
          search={search}
          filterDisc={filterDisc}
          filterStat={filterStat}
          sortKey={sortKey}
          sortDir={sortDir}
          isRestricted={isRestricted}
          onSearch={handleSearch}
          onFilterDisc={handleFilterDisc}
          onFilterStat={handleFilterStat}
          onSort={handleSort}
          onPageChange={setPage}
        />
          </>
        ) : (
          <div className="flex flex-col items-center justify-center h-64 text-slate-400">
            <p className="text-lg font-medium">{activeTab} coming soon...</p>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-200 bg-white px-6 py-3 text-xs text-slate-400 flex items-center justify-between">
        <span>DrawVault Enterprise DMS — Orion Tower, Dubai (ORI-2024)</span>
        <span>© 2025 DrawVault Technologies</span>
      </footer>

      {showModal && (
        <UploadModal onClose={() => setShowModal(false)} onSubmit={handleUpload} />
      )}
      {showTransmittal && (
        <TransmittalModal
          drawings={drawings}
          onClose={() => setShowTransmittal(false)}
          onSubmit={handleTransmittal}
          trnNumber={nextTrnNumber}
        />
      )}
      {toast && (
        <Toast msg={toast.msg} type={toast.type} onDone={() => setToast(null)} />
      )}
    </div>
  );
}
