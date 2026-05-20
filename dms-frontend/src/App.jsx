import { useState, useMemo, useEffect } from "react";
import { Routes, Route, Navigate, useNavigate } from "react-router-dom";

import AppShell          from "./components/AppShell";
import ProtectedRoute    from "./components/ProtectedRoute";
import LoginPage         from "./components/LoginPage";
import Dashboard         from "./components/Dashboard";
import MasterRegisterTable from "./components/MasterRegisterTable";
import TransmittalsView  from "./components/TransmittalsView";
import DocumentsView     from "./components/DocumentsView";
import AnalyticsView     from "./components/AnalyticsView";
import SettingsView      from "./components/SettingsView";
import UploadModal       from "./components/UploadModal";
import TransmittalModal  from "./components/TransmittalModal";
import ProjectModal      from "./components/ProjectModal";
import Toast             from "./components/Toast";

import { OVERDUE_PURPOSES, MS_30_DAYS, MEP_SUBTYPES } from "./constants";

const API      = import.meta.env.VITE_API_URL;
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
  const navigate = useNavigate();

  const [projects,         setProjects]         = useState([]);
  const [activeProject,    setActiveProject]    = useState(null);
  const [showProjectModal, setShowProjectModal] = useState(false);
  const [drawings,         setDrawings]         = useState([]);
  const [transmittals,     setTransmittals]     = useState([]);
  const [drawingsLoading,  setDrawingsLoading]  = useState(false);
  const [showModal,        setShowModal]        = useState(false);
  const [modalFolder,      setModalFolder]      = useState("");
  const [showTransmittal,  setShowTransmittal]  = useState(false);
  const [toast,            setToast]            = useState(null);
  const [currentUser,      setCurrentUser]      = useState(null);
  const [sessionLoading,   setSessionLoading]   = useState(true); // true until localStorage checked
  const [mobileNavOpen,    setMobileNavOpen]    = useState(false);
  const [search,           setSearch]           = useState("");
  const [filterDisc,       setFilterDisc]       = useState("All");
  const [filterStat,       setFilterStat]       = useState("All");
  const [sortKey,          setSortKey]          = useState("number");
  const [sortDir,          setSortDir]          = useState("asc");
  const [page,             setPage]             = useState(1);

  const activeRole    = currentUser?.role || "Project Team";
  const isRestricted  = activeRole === "Project Team";
  const isDirector    = activeRole === "Director";
  const isProjectTeam = activeRole === "Project Team";

  /* ── Session restore + token expiry check ── */
  useEffect(() => {
    try {
      const saved = localStorage.getItem("dms_user");
      if (saved) {
        const user = JSON.parse(saved);
        // Decode JWT payload (base64url) and check exp
        const payload = JSON.parse(atob(user.token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/")));
        if (payload.exp * 1000 < Date.now()) {
          localStorage.removeItem("dms_user");
        } else {
          setCurrentUser(user);
        }
      }
    } catch {
      localStorage.removeItem("dms_user");
    } finally {
      setSessionLoading(false); // always unblock rendering
    }
  }, []);

  /* ── Persist session ── */
  useEffect(() => {
    if (currentUser) localStorage.setItem("dms_user", JSON.stringify(currentUser));
    else localStorage.removeItem("dms_user");
  }, [currentUser]);

  /* ── Auth handlers ── */
  const handleLogin = (user) => {
    setCurrentUser(user);
    navigate("/dashboard", { replace: true });
  };

  const handleLogout = () => {
    setCurrentUser(null);
    navigate("/login", { replace: true });
  };

  const handleUnauthorized = () => {
    setCurrentUser(null);
    setToast({ msg: "Session expired — please log in again.", type: "error" });
    navigate("/login", { replace: true });
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
    setDrawingsLoading(true);
    Promise.all([
      fetchDrawings(activeProject.id, currentUser.token),
      fetchTransmittals(activeProject.id, currentUser.token),
    ])
      .then(([d, t]) => { setDrawings(d); setTransmittals(t); })
      .catch(err => { if (err.status === 401) handleUnauthorized(); })
      .finally(() => setDrawingsLoading(false));
  }, [activeProject]);

  /* ── Derived metrics ── */
  const totalDrawings     = drawings.length;
  const pendingReviews    = drawings.filter(d => d.status === "S2").length;
  const totalTransmittals = transmittals.length;
  const overdueTransmit   = transmittals.filter(t =>
    OVERDUE_PURPOSES.has(t.purpose) &&
    (Date.now() - new Date(t.issuedAt).getTime()) > MS_30_DAYS
  ).length;

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

  const handleSort       = key => {
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
      const created = await res.json();
      const [freshDrawings, freshTransmittals] = await Promise.all([
        fetchDrawings(activeProject.id, currentUser.token),
        fetchTransmittals(activeProject.id, currentUser.token),
      ]);
      setDrawings(freshDrawings);
      setTransmittals(freshTransmittals);
      setShowTransmittal(false);
      setToast({ msg: `Transmittal ${created.number} issued successfully.`, type: "success" });
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

  /* ── Delete ── */
  const handleDeleteDrawing = async (id) => {
    const res = await fetch(`${API}/api/drawings/${id}`, { method: "DELETE", headers: authHeaders(currentUser.token) });
    if (res.status === 401) { handleUnauthorized(); throw new Error("Unauthorized"); }
    if (!res.ok) throw new Error("Delete failed");
    setDrawings(await fetchDrawings(activeProject.id, currentUser.token));
  };

  /* ── Shared shell props ── */
  const shellProps = {
    currentUser,
    onLogout: handleLogout,
    activeProject,
    projects,
    isDirector,
    isProjectTeam,
    isRestricted,
    search,
    onSearch: handleSearch,
    mobileNavOpen,
    setMobileNavOpen,
    onNewDrawing: () => { setModalFolder(""); setShowModal(true); },
    onProjectChange: setActiveProject,
    onNewProject: () => setShowProjectModal(true),
  };

  /* ── Block render until we know if user is logged in ── */
  if (sessionLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-8 h-8 rounded-full border-4 border-primary/20 border-t-primary animate-spin" />
      </div>
    );
  }

  return (
    <>
      <Routes>
        {/* ── Public ── */}
        <Route path="/login" element={<LoginPage onLogin={handleLogin} />} />

        {/* ── Protected ── */}
        <Route element={<ProtectedRoute currentUser={currentUser} />}>
          <Route element={<AppShell {...shellProps} />}>

            {/* Root redirect — directors go to dashboard, others to documents */}
            <Route index element={<Navigate to={isDirector ? "/dashboard" : "/documents"} replace />} />

            {/* ── Director-only routes — redirect others to /documents ── */}
            <Route path="/dashboard" element={
              isDirector ? (
                <Dashboard
                  totalDrawings={totalDrawings}
                  totalTransmittals={totalTransmittals}
                  latestRevisions={pendingReviews}
                  overdueItems={overdueTransmit}
                  drawings={drawings}
                  activeProjectId={activeProject?.id}
                  token={currentUser?.token}
                />
              ) : <Navigate to="/documents" replace />
            } />

            <Route path="/register" element={
              isDirector ? (
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
                  onNewTransmittal={() => setShowTransmittal(true)}
                  onVoid={handleVoid}
                  isRestricted={false}
                  loading={drawingsLoading}
                />
              ) : <Navigate to="/documents" replace />
            } />

            <Route path="/transmittals" element={
              isDirector
                ? <TransmittalsView transmittals={transmittals} drawings={drawings} loading={drawingsLoading} token={currentUser?.token} />
                : <Navigate to="/documents" replace />
            } />

            <Route path="/analytics" element={
              isDirector
                ? <AnalyticsView drawings={drawings} transmittals={transmittals} />
                : <Navigate to="/documents" replace />
            } />

            {/* ── Documents — all roles ── */}
            <Route path="/documents" element={
              <DocumentsView
                drawings={drawings}
                onUpload={!isRestricted ? (folder) => { setModalFolder(folder); setShowModal(true); } : undefined}
                onDeleteDrawing={!isRestricted ? handleDeleteDrawing : undefined}
                projects={projects}
                activeProject={activeProject}
                onProjectChange={setActiveProject}
                transmittals={transmittals}
                isProjectTeam={isProjectTeam}
                token={currentUser?.token}
                onDrawingUpdate={async () => { setDrawings(await fetchDrawings(activeProject.id, currentUser.token)); }}
              />
            } />

            {/* ── Settings — all roles (password change for everyone, user mgmt for director) ── */}
            <Route path="/settings" element={
              <SettingsView currentUser={currentUser} onUserUpdate={setCurrentUser} token={currentUser?.token} />
            } />

            {/* Catch-all */}
            <Route path="*" element={<Navigate to={isDirector ? "/dashboard" : "/documents"} replace />} />
          </Route>
        </Route>
      </Routes>

      {/* ── Modals & Toasts (outside Routes so they overlay correctly) ── */}
      {showModal && <UploadModal onClose={() => setShowModal(false)} onSubmit={handleUpload} initialFolder={modalFolder} />}
      {showTransmittal && (
        <TransmittalModal
          drawings={drawings}
          onClose={() => setShowTransmittal(false)}
          onSubmit={handleTransmittal}
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
    </>
  );
}
