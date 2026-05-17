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
import DocumentsView from "./components/DocumentsView";
import AnalyticsView from "./components/AnalyticsView";
import SettingsView from "./components/SettingsView";

import { ROLES, OVERDUE_PURPOSES, MS_30_DAYS, MEP_SUBTYPES } from "./constants";

const API = import.meta.env.VITE_API_URL;
const PER_PAGE = 8;

function authHeaders(token) {
  return { Authorization: `Bearer ${token}` };
}

async function fetchProjects(token) {
  const res = await fetch(`${API}/api/projects`, { headers: authHeaders(token) });
  if (res.status === 401) throw Object.assign(new Error("Unauthorized"), { status: 401 });
  if (!res.ok) throw new Error("projects fetch failed");
  return res.json();
}

async function fetchDrawings(projectId, token) {
  const res = await fetch(`${API}/api/drawings?projectId=${projectId}`, { headers: authHeaders(token) });
  if (res.status === 401) throw Object.assign(new Error("Unauthorized"), { status: 401 });
  if (!res.ok) throw new Error("drawings fetch failed");
  return res.json();
}

async function fetchTransmittals(projectId, token) {
  const res = await fetch(`${API}/api/transmittals?projectId=${projectId}`, { headers: authHeaders(token) });
  if (res.status === 401) throw Object.assign(new Error("Unauthorized"), { status: 401 });
  if (!res.ok) throw new Error("transmittals fetch failed");
  return res.json();
}

export default function App() {
  const [currentTab,       setCurrentTab]       = useState("dashboard");
  const [projects,         setProjects]         = useState([]);
  const [activeProject,    setActiveProject]    = useState(null);
  const [showProjectModal, setShowProjectModal] = useState(false);
  const [drawings,         setDrawings]         = useState([]);
  const [transmittals,     setTransmittals]     = useState([]);
  const [showModal,        setShowModal]        = useState(false);
  const [modalFolder,      setModalFolder]      = useState("");
  const [showTransmittal,  setShowTransmittal]  = useState(false);
  const [toast,            setToast]            = useState(null);
  const [currentUser,      setCurrentUser]      = useState(null);
  const [search,           setSearch]           = useState("");
  const [filterDisc,       setFilterDisc]       = useState("All");
  const [filterStat,       setFilterStat]       = useState("All");
  const [sortKey,          setSortKey]          = useState("number");
  const [sortDir,          setSortDir]          = useState("asc");
  const [page,             setPage]             = useState(1);

  const activeRole   = currentUser?.role || "Project Team";
  const isRestricted = activeRole === "Project Team";
  const isDirector   = activeRole === "Director";

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

  const handleUnauthorized = () => {
    setCurrentUser(null);
    setToast({ msg: "Session expired — please log in again.", type: "error" });
  };

  /* ── Bootstrap projects ── */
  useEffect(() => {
    if (!currentUser) return;
    fetchProjects(currentUser.token)
      .then(data => { setProjects(data); if (data.length > 0) setActiveProject(data[0]); })
      .catch(err => { if (err.status === 401) handleUnauthorized(); });
  }, [currentUser]);

  /* ── Load drawings + transmittals when project changes ── */
  useEffect(() => {
    if (!activeProject || !currentUser) return;
    fetchDrawings(activeProject.id, currentUser.token)
      .then(setDrawings)
      .catch(err => { if (err.status === 401) handleUnauthorized(); });
    fetchTransmittals(activeProject.id, currentUser.token)
      .then(setTransmittals)
      .catch(err => { if (err.status === 401) handleUnauthorized(); });
  }, [activeProject]);

  /* ── Derived metrics ── */
  const totalDrawings     = drawings.length;
  const pendingReviews    = drawings.filter(d => d.status === "S2").length;
  const totalTransmittals = transmittals.length;
  const overdueTransmit   = transmittals.filter(t =>
    OVERDUE_PURPOSES.has(t.purpose) &&
    (Date.now() - new Date(t.issuedAt).getTime()) > MS_30_DAYS
  ).length;

  const nextTrnNumber = `TRN-${String(transmittals.length + 1).padStart(3, "0")}`;

  /* ── Filter + sort ── */
  const filtered = useMemo(() => {
    let d = drawings.filter(row => {
      const q      = search.toLowerCase();
      const matchQ = !q ||
        row.number.toLowerCase().includes(q) ||
        row.title.toLowerCase().includes(q) ||
        row.originator.toLowerCase().includes(q);
      const matchD = filterDisc === "All" ||
        (filterDisc === "MEP" ? MEP_SUBTYPES.includes(row.discipline) : row.discipline === filterDisc);
      const matchS = filterStat === "All" || row.status === filterStat;
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

  const handleSort      = key => {
    if (sortKey === key) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortKey(key); setSortDir("asc"); }
    setPage(1);
  };
  const handleSearch     = v => { setSearch(v);     setPage(1); };
  const handleFilterDisc = v => { setFilterDisc(v); setPage(1); };
  const handleFilterStat = v => { setFilterStat(v); setPage(1); };

  /* ── Upload ── */
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
    fd.append("folderPath",    form.folderPath || "");
    try {
      const res = await fetch(`${API}/api/upload`, { method: "POST", body: fd, headers: authHeaders(currentUser.token) });
      if (res.status === 401) { handleUnauthorized(); return; }
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `Server responded ${res.status}`);
      }
      await res.json();
      setDrawings(await fetchDrawings(activeProject.id, currentUser.token));
      setShowModal(false);
      setToast({ msg: `"${form.drawingNumber}" registered successfully.`, type: "success" });
    } catch (err) {
      setShowModal(false);
      setToast({ msg: err.message || "Upload failed — is the backend server running?", type: "error" });
    }
  };

  /* ── Transmittal ── */
  const handleTransmittal = async (formData) => {
    try {
      const res = await fetch(`${API}/api/transmittals`, {
        method:  "POST",
        headers: { "Content-Type": "application/json", ...authHeaders(currentUser.token) },
        body: JSON.stringify({
          number:     nextTrnNumber,
          drawingIds: formData.drawingIds,
          recipients: formData.recipients,
          purpose:    formData.purpose,
          remarks:    formData.remarks,
          issuedAt:   new Date().toISOString().split("T")[0],
          projectId:  activeProject.id,
        }),
      });
      if (res.status === 401) { handleUnauthorized(); return; }
      if (!res.ok) throw new Error(`Server responded ${res.status}`);
      const [freshDrawings, freshTransmittals] = await Promise.all([
        fetchDrawings(activeProject.id, currentUser.token),
        fetchTransmittals(activeProject.id, currentUser.token),
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

  /* ── Void ── */
  const handleVoid = async (id) => {
    try {
      const res = await fetch(`${API}/api/drawings/${id}/void`, { method: "PATCH", headers: authHeaders(currentUser.token) });
      if (!res.ok) throw new Error();
      setDrawings(await fetchDrawings(activeProject.id, currentUser.token));
      setToast({ msg: "Drawing voided successfully.", type: "success" });
    } catch {
      setToast({ msg: "Failed to void drawing.", type: "error" });
    }
  };

  if (!currentUser) return <LoginPage onLogin={setCurrentUser} />;

  return (
    <div className="bg-background text-on-surface font-outfit min-h-screen flex">

      <Sidebar
        activeProject={activeProject}
        onTabChange={setCurrentTab}
        currentTab={currentTab}
        currentUser={currentUser}
        /* New Drawing CTA removed — upload lives in the contextual action bar */
      />

      {/* ── Right column ── */}
      <div className="flex flex-col flex-1" style={{ marginLeft: "280px" }}>

        {/* ── Top App Bar — search only + utility icons ── */}
        <header className="bg-glass-surface/80 backdrop-blur-md border-b border-border-slate sticky top-0 z-40 h-16 flex items-center justify-between px-10 gap-6">

          {/* Search — left */}
          <div className="relative w-full max-w-md">
            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant text-[20px]">search</span>
            <input
              type="text"
              value={search}
              onChange={e => handleSearch(e.target.value)}
              placeholder="Search drawings, transmittals, or tasks…"
              className="w-full pl-10 pr-4 py-2 bg-surface-container-low border border-border-slate rounded-lg text-body-sm text-on-surface placeholder:text-on-surface-variant focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/20 transition-all"
            />
          </div>

          {/* Utility icons — right */}
          <div className="flex items-center gap-1 shrink-0">
            <button className="p-2 text-on-surface-variant hover:bg-surface-container rounded-full transition-colors" title="Notifications">
              <span className="material-symbols-outlined text-[22px]">notifications</span>
            </button>
            <button className="p-2 text-on-surface-variant hover:bg-surface-container rounded-full transition-colors" title="Help">
              <span className="material-symbols-outlined text-[22px]">help</span>
            </button>

            <ProjectSelector
              projects={projects}
              activeProject={activeProject}
              onChange={setActiveProject}
              onNew={() => setShowProjectModal(true)}
              isRestricted={!isDirector}
            />

            <div className="h-6 w-px bg-border-slate mx-1" />

            <button
              onClick={() => setCurrentUser(null)}
              className="p-2 text-on-surface-variant hover:bg-status-rose-bg hover:text-status-rose-text rounded-full transition-colors"
              title="Sign out"
            >
              <span className="material-symbols-outlined text-[20px]">logout</span>
            </button>

            <div
              className="w-8 h-8 rounded-full bg-primary flex items-center justify-center text-white text-[13px] font-bold cursor-pointer border border-border-slate ml-1"
              title={currentUser.name}
            >
              {currentUser.name.charAt(0).toUpperCase()}
            </div>
          </div>
        </header>

        {/* ── Main content ── */}
        <main className="flex-1 p-margin-desktop">
          {currentTab === "dashboard" ? (
            <Dashboard
              totalDrawings={totalDrawings}
              totalTransmittals={totalTransmittals}
              latestRevisions={pendingReviews}
              overdueItems={overdueTransmit}
              drawings={drawings}
              activeProjectId={activeProject?.id}
              token={currentUser?.token}
              onViewRegister={() => setCurrentTab("register")}
            />
          ) : currentTab === "register" ? (
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
              onNewEntry={() => { setModalFolder(""); setShowModal(true); }}
              onNewTransmittal={!isRestricted ? () => setShowTransmittal(true) : undefined}
              onVoid={handleVoid}
              isRestricted={isRestricted}
            />
          ) : currentTab === "transmittals" ? (
            <TransmittalsView transmittals={transmittals} drawings={drawings} />
          ) : currentTab === "documents" ? (
            <DocumentsView
              drawings={drawings}
              onUpload={!isRestricted ? (folder) => { setModalFolder(folder); setShowModal(true); } : undefined}
            />
          ) : currentTab === "analytics" ? (
            <AnalyticsView drawings={drawings} transmittals={transmittals} />
          ) : currentTab === "settings" ? (
            <SettingsView currentUser={currentUser} onUserUpdate={setCurrentUser} token={currentUser?.token} />
          ) : (
            <PlaceholderView tab={currentTab} />
          )}
        </main>
      </div>

      {/* ── Modals & Toasts ── */}
      {showModal && <UploadModal onClose={() => setShowModal(false)} onSubmit={handleUpload} initialFolder={modalFolder} />}
      {showTransmittal && (
        <TransmittalModal
          drawings={drawings}
          onClose={() => setShowTransmittal(false)}
          onSubmit={handleTransmittal}
          trnNumber={nextTrnNumber}
        />
      )}
      {toast && <Toast msg={toast.msg} type={toast.type} onDone={() => setToast(null)} />}
      {showProjectModal && (
        <ProjectModal
          onClose={() => setShowProjectModal(false)}
          onSubmit={async (data) => {
            const res = await fetch(`${API}/api/projects`, {
              method:  "POST",
              headers: { "Content-Type": "application/json", ...authHeaders(currentUser.token) },
              body:    JSON.stringify(data),
            });
            if (res.ok) {
              const newProj  = await res.json();
              const allProjs = await fetchProjects(currentUser.token);
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
  const iconMap = { documents: "folder_open", analytics: "analytics", settings: "settings" };
  return (
    <div className="flex flex-col items-center justify-center h-[60vh] gap-4">
      <div className="w-20 h-20 rounded-2xl bg-white border border-border-slate flex items-center justify-center">
        <span className="material-symbols-outlined text-[40px] text-on-surface-variant">{iconMap[tab] || "construction"}</span>
      </div>
      <p className="text-headline-sm font-semibold text-on-surface capitalize">{tab}</p>
      <p className="text-body-md text-on-surface-variant">This section is coming soon.</p>
    </div>
  );
}
