import { useState, useMemo, useEffect } from "react";
import Sidebar from "./components/Sidebar";
import Dashboard from "./components/Dashboard";
import UploadModal from "./components/UploadModal";
import TransmittalModal from "./components/TransmittalModal";
import ProjectModal from "./components/ProjectModal";
import MasterRegisterTable from "./components/MasterRegisterTable";
import TransmittalsView from "./components/TransmittalsView";
import ProjectSelector from "./components/ProjectSelector";
import Toast from "./components/Toast";
import LoginPage from "./components/LoginPage";

import { ROLES, OVERDUE_PURPOSES, MS_30_DAYS } from "./constants";

const API = "http://localhost:3000";
const PER_PAGE = 8;

async function fetchProjects() {
  const res = await fetch(`${API}/api/projects`);
  if (!res.ok) throw new Error("projects fetch failed");
  return res.json();
}

async function fetchDrawings(projectId) {
  const res = await fetch(`${API}/api/drawings?projectId=${projectId}`);
  if (!res.ok) throw new Error("drawings fetch failed");
  return res.json();
}

async function fetchTransmittals(projectId) {
  const res = await fetch(`${API}/api/transmittals?projectId=${projectId}`);
  if (!res.ok) throw new Error("transmittals fetch failed");
  return res.json();
}

export default function App() {
  const [currentTab,      setCurrentTab]      = useState("dashboard");
  const [projects,        setProjects]        = useState([]);
  const [activeProject,   setActiveProject]   = useState(null);
  const [showProjectModal,setShowProjectModal] = useState(false);
  const [drawings,        setDrawings]        = useState([]);
  const [transmittals,    setTransmittals]    = useState([]);
  const [showModal,       setShowModal]       = useState(false);
  const [showTransmittal, setShowTransmittal] = useState(false);
  const [toast,           setToast]           = useState(null);
  const [currentUser,     setCurrentUser]     = useState(null);
  const [search,          setSearch]          = useState("");
  const [filterDisc,      setFilterDisc]      = useState("All");
  const [filterStat,      setFilterStat]      = useState("All");
  const [sortKey,         setSortKey]         = useState("number");
  const [sortDir,         setSortDir]         = useState("asc");
  const [page,            setPage]            = useState(1);
  const [activeTab,       setActiveTab]       = useState("Dashboard");

  const activeRole = currentUser?.role || "Read-Only";
  const isRestricted = activeRole === "Subcontractor" || activeRole === "Read-Only";

  /* ── Session persistence ── */
  useEffect(() => {
    try {
      const saved = localStorage.getItem("dms_user");
      if (saved) setCurrentUser(JSON.parse(saved));
    } catch {}
  }, []);

  useEffect(() => {
    if (currentUser) localStorage.setItem("dms_user", JSON.stringify(currentUser));
    else localStorage.removeItem("dms_user");
  }, [currentUser]);

  /* ── Bootstrap: load projects ── */
  useEffect(() => {
    if (!currentUser) return;
    fetchProjects().then(data => {
      setProjects(data);
      if (data.length > 0) setActiveProject(data[0]);
    }).catch(() => {});
  }, [currentUser]);

  /* ── Load collections when project changes ── */
  useEffect(() => {
    if (!activeProject) return;
    fetchDrawings(activeProject.id).then(setDrawings).catch(() => {});
    fetchTransmittals(activeProject.id).then(setTransmittals).catch(() => {});
  }, [activeProject]);

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
    fd.append("projectId",     activeProject.id);

    try {
      const res = await fetch(`${API}/api/upload`, { method: "POST", body: fd });
      if (!res.ok) throw new Error(`Server responded ${res.status}`);
      await res.json();
      setDrawings(await fetchDrawings(activeProject.id));
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
          projectId:  activeProject.id,
        }),
      });
      if (!res.ok) throw new Error(`Server responded ${res.status}`);

      /* Re-fetch both so transmittal counts on drawings update too */
      const [freshDrawings, freshTransmittals] = await Promise.all([
        fetchDrawings(activeProject.id),
        fetchTransmittals(activeProject.id),
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

  /* ── Void/Supersede a drawing ── */
  const handleVoid = async (id) => {
    try {
      const res = await fetch(`${API}/api/drawings/${id}/void`, { method: "PATCH" });
      if (!res.ok) throw new Error();
      setDrawings(await fetchDrawings(activeProject.id));
      setToast({ msg: "Drawing voided successfully.", type: "success" });
    } catch {
      setToast({ msg: "Failed to void drawing.", type: "error" });
    }
  };

  if (!currentUser) {
    return <LoginPage onLogin={setCurrentUser} />;
  }

  return (
    <div className="flex min-h-screen bg-background overflow-x-hidden selection:bg-primary/30 selection:text-primary">
      <Sidebar activeProject={activeProject} onTabChange={setCurrentTab} currentTab={currentTab} />

      {/* TopNavBar */}
      <header className="hidden md:flex fixed top-0 right-0 h-16 bg-surface/60 dark:bg-surface/60 backdrop-blur-md border-b border-white/5 bg-surface-container-lowest/30 items-center justify-between pl-72 pr-10 w-full z-40">
        <div className="flex items-center gap-6">
          <nav className="flex gap-6 h-full items-center">
            <button 
              onClick={() => setCurrentTab('dashboard')} 
              className={`font-body-md text-body-md h-full flex items-center pt-[2px] ${currentTab === 'dashboard' ? 'text-primary font-bold border-b-2 border-primary' : 'text-on-surface-variant hover:text-on-surface transition-colors border-b-2 border-transparent'}`}
            >
              Project Overview
            </button>
            <button 
              onClick={() => setCurrentTab('register')}
              className={`font-body-md text-body-md h-full flex items-center pt-[2px] ${currentTab === 'register' ? 'text-primary font-bold border-b-2 border-primary' : 'text-on-surface-variant hover:text-on-surface transition-colors border-b-2 border-transparent'}`}
            >
              Drawing Register
            </button>
          </nav>
        </div>
        <div className="flex items-center gap-4">
          <div className="relative focus-within:ring-2 focus-within:ring-primary/50 rounded-full hidden lg:block">
            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant text-sm">search</span>
            <input className="bg-surface-container-highest/50 border border-white/10 rounded-full pl-9 pr-4 py-1.5 text-sm text-on-surface placeholder:text-on-surface-variant focus:outline-none focus:bg-surface-container-high w-64 transition-all" placeholder="Search..." type="text" value={search} onChange={e => handleSearch(e.target.value)} />
          </div>
          <ProjectSelector
            projects={projects}
            activeProject={activeProject}
            onChange={setActiveProject}
            onNew={() => setShowProjectModal(true)}
            isRestricted={isRestricted}
          />
          <button onClick={() => setCurrentUser(null)} className="p-1.5 hover:bg-white/5 rounded-md text-on-surface-variant hover:text-error transition-colors ml-2" title="Sign out">
             <span className="material-symbols-outlined text-[18px]">logout</span>
          </button>
          <div className="w-8 h-8 rounded-full bg-surface-container-highest border border-white/10 overflow-hidden ml-2 cursor-pointer relative" title={currentUser.name}>
            <div className="w-full h-full flex items-center justify-center bg-primary text-on-primary font-bold">{currentUser.name.charAt(0).toUpperCase()}</div>
          </div>
        </div>
      </header>

      {/* Main Canvas */}
      <main className="flex-1 w-full pt-20 pb-10 md:pl-72 pr-4 md:pr-10 min-h-screen">
        {currentTab === 'dashboard' ? (
          <Dashboard
            totalDrawings={totalDrawings}
            totalTransmittals={totalTransmittals}
            latestRevisions={pendingReviews}
            overdueItems={overdueTransmit}
            drawings={drawings}
            activeProjectId={activeProject?.id}
          />
        ) : currentTab === 'register' ? (
          <MasterRegisterTable
            drawings={pageRows}
            allDrawings={drawings}
            total={filtered.length}
            page={page}
            totalPages={totalPages}
            search={search}
            filterStat={filterStat}
            filterDisc={filterDisc}
            sortKey={sortKey}
            sortDir={sortDir}
            onPageChange={setPage}
            onSearch={handleSearch}
            onFilterStat={handleFilterStat}
            onFilterDisc={handleFilterDisc}
            onSort={handleSort}
            onNewEntry={() => setShowModal(true)}
            onVoid={handleVoid}
          />
        ) : currentTab === 'transmittals' ? (
          <TransmittalsView transmittals={transmittals} drawings={drawings} />
        ) : (
          <PlaceholderView tab={currentTab} />
        )}
      </main>

      {/* Action Floating Buttons */}
      {!isRestricted && (
        <div className="fixed bottom-6 right-6 flex gap-3 z-50">
          <button onClick={() => setShowTransmittal(true)} className="flex items-center gap-2 bg-surface-container-highest text-on-surface px-4 py-2.5 rounded-full shadow-[0_10px_25px_-5px_rgba(0,0,0,0.5)] border border-white/10 hover:bg-white/10 transition-all">
            <span className="material-symbols-outlined text-[18px]">send</span>
            <span className="font-label-md text-label-md">Transmittal</span>
          </button>
          <button onClick={() => setShowModal(true)} className="flex items-center gap-2 bg-primary text-on-primary px-4 py-2.5 rounded-full shadow-[0_10px_25px_-5px_rgba(195,192,255,0.3)] hover:bg-primary/90 transition-all">
            <span className="material-symbols-outlined text-[18px]">upload</span>
            <span className="font-label-md text-label-md">Upload</span>
          </button>
        </div>
      )}

      {/* Modals & Toasts */}
      {showModal && (
        <UploadModal 
          onClose={() => setShowModal(false)}
          onSubmit={handleUpload}
        />
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
      {showProjectModal && (
        <ProjectModal
          onClose={() => setShowProjectModal(false)}
          onSubmit={async (data) => {
            const res = await fetch(`${API}/api/projects`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(data),
            });
            if (res.ok) {
              const newProj = await res.json();
              const allProjs = await fetchProjects();
              setProjects(allProjs);
              setActiveProject(newProj);
              setShowProjectModal(false);
              setToast({ msg: `Project ${data.code} created.`, type: "success" });
            } else {
              setToast({ msg: "Failed to create project.", type: "error" });
            }
          }}
        />
      )}
    </div>
  );
}

function PlaceholderView({ tab }) {
  const iconMap = { documents: "folder_open", analytics: "insights" };
  return (
    <div className="flex flex-col items-center justify-center h-[60vh] gap-4 text-on-surface-variant">
      <span className="material-symbols-outlined text-[64px] opacity-30">{iconMap[tab] || "construction"}</span>
      <p className="font-headline-sm text-headline-sm capitalize">{tab}</p>
      <p className="font-body-md text-body-md">This section is coming soon.</p>
    </div>
  );
}
