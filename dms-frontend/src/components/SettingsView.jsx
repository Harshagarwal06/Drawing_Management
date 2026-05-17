import { useState, useEffect } from "react";
import { MoreVertical } from "lucide-react";

const API = import.meta.env.VITE_API_URL;

const ROLES = ['Director', 'In House Architect', 'Project Team'];

const ROLE_COLOR = {
  'Director':            'bg-primary/10 text-primary',
  'In House Architect':  'bg-status-emerald-bg text-status-emerald-text',
  'Project Team':        'bg-status-amber-bg text-status-amber-text',
};

export default function SettingsView({ currentUser, onUserUpdate, token }) {
  const isAdmin = currentUser?.role === 'Director';

  const [pwForm,     setPwForm]     = useState({ currentPassword: '', newPassword: '', confirm: '' });
  const [pwMsg,      setPwMsg]      = useState(null);
  const [pwLoading,  setPwLoading]  = useState(false);
  const [users,      setUsers]      = useState([]);
  const [newUser,    setNewUser]    = useState({ username: '', password: '', name: '', role: 'In House Architect', selectedProjects: [] });
  const [userMsg,    setUserMsg]    = useState(null);
  const [userLoading,setUserLoading]= useState(false);
  const [addOpen,    setAddOpen]    = useState(false);

  const [projects,           setProjects]           = useState([]);
  const [editingProjectsFor, setEditingProjectsFor] = useState(null);
  const [pendingProjects,    setPendingProjects]    = useState([]);
  const [userSearch,         setUserSearch]         = useState('');
  const [roleFilter,         setRoleFilter]         = useState('All');

  /* Returns null for wildcard, or an array of project IDs */
  const parseAllowed = (ap) => {
    if (!ap || ap === '*') return null;
    try { return JSON.parse(ap); } catch { return []; }
  };

  const handlePwChange = async e => {
    e.preventDefault();
    if (pwForm.newPassword !== pwForm.confirm) { setPwMsg({ type: 'error', text: 'New passwords do not match.' }); return; }
    if (pwForm.newPassword.length < 6) { setPwMsg({ type: 'error', text: 'New password must be at least 6 characters.' }); return; }
    setPwLoading(true);
    try {
      const res = await fetch(`${API}/api/users/me/password`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ currentPassword: pwForm.currentPassword, newPassword: pwForm.newPassword }),
      });
      const data = await res.json();
      if (res.ok) { setPwMsg({ type: 'success', text: 'Password updated successfully.' }); setPwForm({ currentPassword: '', newPassword: '', confirm: '' }); }
      else setPwMsg({ type: 'error', text: data.error || 'Failed to update password.' });
    } catch { setPwMsg({ type: 'error', text: 'Cannot connect to server.' }); }
    finally { setPwLoading(false); }
  };

  const loadUsers = () => {
    if (!isAdmin) return;
    fetch(`${API}/api/users`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.ok ? r.json() : []).then(setUsers).catch(() => {});
  };

  const loadProjects = () => {
    if (!isAdmin) return;
    fetch(`${API}/api/projects`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.ok ? r.json() : []).then(setProjects).catch(() => {});
  };

  useEffect(() => { loadUsers(); loadProjects(); }, []);

  const handleRoleChange = async (userId, role, allowedProjects) => {
    try {
      const res = await fetch(`${API}/api/users/${userId}/role`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ role, allowedProjects: role === 'Director' ? '*' : allowedProjects }),
      });
      if (res.ok) setUserMsg({ type: 'success', text: 'Role updated successfully.' });
      else setUserMsg({ type: 'error', text: 'Failed to update role.' });
    } catch { setUserMsg({ type: 'error', text: 'Cannot connect to server.' }); }
    loadUsers();
  };

  const handleSaveProjectAccess = async (userId) => {
    const user = users.find(u => u.id === userId);
    if (!user) return;
    try {
      const res = await fetch(`${API}/api/users/${userId}/role`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ role: user.role, allowedProjects: JSON.stringify(pendingProjects) }),
      });
      if (res.ok) { setUserMsg({ type: 'success', text: 'Project access updated.' }); setEditingProjectsFor(null); }
      else setUserMsg({ type: 'error', text: 'Failed to update project access.' });
    } catch { setUserMsg({ type: 'error', text: 'Cannot connect to server.' }); }
    loadUsers();
  };

  const openProjectEditor = (u) => {
    setEditingProjectsFor(u.id);
    const parsed = parseAllowed(u.allowed_projects);
    // If wildcard (null), pre-select all projects; otherwise use the stored list
    setPendingProjects(parsed === null ? projects.map(p => p.id) : parsed);
  };

  const handleAddUser = async e => {
    e.preventDefault();
    setUserLoading(true);
    try {
      const res = await fetch(`${API}/api/users`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          ...newUser,
          allowedProjects: newUser.role === 'Director' ? '*' : JSON.stringify(newUser.selectedProjects),
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setUserMsg({ type: 'success', text: `User "${newUser.username}" created.` });
        setNewUser({ username: '', password: '', name: '', role: 'In House Architect', selectedProjects: [] });
        setAddOpen(false); loadUsers();
      } else setUserMsg({ type: 'error', text: data.error || 'Failed to create user.' });
    } catch { setUserMsg({ type: 'error', text: 'Cannot connect to server.' }); }
    finally { setUserLoading(false); }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-headline-lg font-semibold text-on-surface">Settings</h1>
        <p className="text-body-md text-on-surface-variant mt-1">Account &amp; administration</p>
      </div>

      {/* Profile */}
      <Section title="Profile" icon="person">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-full bg-primary flex items-center justify-center text-white font-bold text-xl shrink-0">
            {currentUser?.avatar || currentUser?.name?.charAt(0)}
          </div>
          <div>
            <p className="text-[18px] font-semibold text-on-surface">{currentUser?.name}</p>
            <p className="text-[14px] text-on-surface-variant">@{currentUser?.username}</p>
            <span className={`inline-block mt-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold ${ROLE_COLOR[currentUser?.role] || 'bg-surface-container text-on-surface-variant'}`}>
              {currentUser?.role}
            </span>
          </div>
        </div>
      </Section>

      {/* Change Password */}
      <Section title="Change Password" icon="lock">
        <form onSubmit={handlePwChange} className="space-y-4 max-w-sm">
          {pwMsg && (
            <div className={`text-[13px] p-3 rounded-lg border ${pwMsg.type === 'success' ? 'bg-status-emerald-bg text-status-emerald-text border-status-emerald-text/20' : 'bg-status-rose-bg text-status-rose-text border-status-rose-text/20'}`}>
              {pwMsg.text}
            </div>
          )}
          <Field label="Current Password"     type="password" value={pwForm.currentPassword} onChange={v => setPwForm(p => ({ ...p, currentPassword: v }))} />
          <Field label="New Password"         type="password" value={pwForm.newPassword}     onChange={v => setPwForm(p => ({ ...p, newPassword: v }))} />
          <Field label="Confirm New Password" type="password" value={pwForm.confirm}         onChange={v => setPwForm(p => ({ ...p, confirm: v }))} />
          <button type="submit" disabled={pwLoading}
            className="bg-primary text-white rounded-lg hover:bg-primary-container px-5 py-2.5 font-medium text-[14px] transition-colors disabled:opacity-60">
            {pwLoading ? 'Updating…' : 'Update Password'}
          </button>
        </form>
      </Section>

      {/* User Management */}
      {isAdmin && (
        <Section
          title="User Management"
          icon="manage_accounts"
          headerAction={
            !addOpen && (
              <button
                onClick={() => { setAddOpen(true); setUserMsg(null); }}
                className="flex items-center gap-1.5 px-4 py-2 bg-primary text-white rounded-lg font-medium text-[13px] hover:bg-primary-container transition-colors"
              >
                <span className="material-symbols-outlined text-[16px]">person_add</span>
                Add User
              </button>
            )
          }
        >
          {userMsg && (
            <div className={`text-[13px] p-3 rounded-lg border mb-4 ${userMsg.type === 'success' ? 'bg-status-emerald-bg text-status-emerald-text border-status-emerald-text/20' : 'bg-status-rose-bg text-status-rose-text border-status-rose-text/20'}`}>
              {userMsg.text}
            </div>
          )}

          {/* Search + filter toolbar */}
          {!addOpen && (
            <div className="flex gap-2 mb-4">
              <div className="relative flex-1">
                <span className="material-symbols-outlined absolute left-2.5 top-1/2 -translate-y-1/2 text-on-surface-variant text-[16px]">search</span>
                <input
                  type="text"
                  value={userSearch}
                  onChange={e => setUserSearch(e.target.value)}
                  placeholder="Search users..."
                  className="w-full pl-8 pr-3 py-2 text-[13px] bg-white border border-border-slate rounded-lg text-on-surface placeholder:text-on-surface-variant focus:outline-none focus:ring-1 focus:ring-primary/20 focus:border-primary transition-all"
                />
              </div>
              <select
                value={roleFilter}
                onChange={e => setRoleFilter(e.target.value)}
                className="bg-white border border-border-slate rounded-lg px-3 py-2 text-[13px] text-on-surface focus:outline-none focus:ring-1 focus:ring-primary/20 shrink-0"
              >
                <option value="All">All Roles</option>
                {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>
          )}

          {/* User list — single container with dividers */}
          {!addOpen && (
            <div className="rounded-xl border border-border-slate overflow-hidden mb-4">
              {users
                .filter(u => {
                  const q = userSearch.toLowerCase();
                  const matchQ = !q || u.name.toLowerCase().includes(q) || u.username.toLowerCase().includes(q);
                  const matchR = roleFilter === 'All' || u.role === roleFilter;
                  return matchQ && matchR;
                })
                .map((u, idx, arr) => {
                  const isNonDirector = u.role !== 'Director';
                  const isSelf        = u.id === currentUser?.id;
                  const allowedList   = parseAllowed(u.allowed_projects);
                  const isExpanded    = editingProjectsFor === u.id;
                  const isLast        = idx === arr.length - 1;

                  return (
                    <div key={u.id} className={!isLast ? 'border-b border-border-slate' : ''}>

                      {/* ── User row ── */}
                      <div className="flex items-center gap-3 px-4 py-2.5 bg-white hover:bg-surface-container-low transition-colors">
                        <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center text-white font-bold text-[12px] shrink-0">
                          {u.avatar}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-[13px] font-medium text-on-surface leading-tight">{u.name}</p>
                          <p className="text-[11px] text-on-surface-variant">@{u.username}</p>
                        </div>

                        {/* Role dropdown — sole visual indicator + control */}
                        <select
                          value={u.role}
                          onChange={e => handleRoleChange(u.id, e.target.value, u.allowed_projects)}
                          disabled={isSelf}
                          className="bg-white border border-border-slate rounded-lg px-2 py-1.5 text-[12px] text-on-surface focus:outline-none focus:ring-1 focus:ring-primary/20 disabled:opacity-50 shrink-0"
                        >
                          {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
                        </select>

                        {/* Project access pill — non-Director, non-self */}
                        {isNonDirector && !isSelf && (
                          allowedList === null ? (
                            <button
                              onClick={() => isExpanded ? setEditingProjectsFor(null) : openProjectEditor(u)}
                              className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-surface-container text-on-surface-variant border border-border-slate hover:bg-surface-container-high transition-colors shrink-0 flex items-center gap-1"
                            >
                              All projects
                              <span className="material-symbols-outlined text-[11px]">edit</span>
                            </button>
                          ) : (
                            <button
                              onClick={() => isExpanded ? setEditingProjectsFor(null) : openProjectEditor(u)}
                              className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-primary/10 text-primary border border-primary/20 hover:bg-primary/20 transition-colors shrink-0"
                            >
                              <span>{allowedList.length} project{allowedList.length !== 1 ? 's' : ''}</span>
                              <span className="material-symbols-outlined text-[12px]">edit</span>
                            </button>
                          )
                        )}
                        {/* Spacer for Director / self rows so columns stay aligned */}
                        {(!isNonDirector || isSelf) && <div className="w-[80px] shrink-0" />}

                        {/* Row actions */}
                        <button
                          disabled={isSelf}
                          className="p-1 rounded-md text-on-surface-variant hover:bg-surface-container disabled:opacity-30 transition-colors shrink-0"
                          title="More actions"
                        >
                          <MoreVertical size={15} />
                        </button>
                      </div>

                      {/* ── Inline project editor ── */}
                      {isNonDirector && !isSelf && isExpanded && (
                        <div className="border-t border-border-slate bg-surface-container-low px-4 py-3">
                          <p className="text-[11px] font-semibold text-on-surface-variant mb-2 uppercase tracking-wide">Project Access</p>
                          {projects.length === 0 ? (
                            <p className="text-[12px] text-on-surface-variant">No projects available.</p>
                          ) : (
                            <div className="flex flex-wrap gap-x-5 gap-y-2 mb-3">
                              {projects.map(p => (
                                <label key={p.id} className="flex items-center gap-1.5 cursor-pointer select-none">
                                  <input
                                    type="checkbox"
                                    checked={pendingProjects.includes(p.id)}
                                    onChange={e => setPendingProjects(prev =>
                                      e.target.checked ? [...prev, p.id] : prev.filter(id => id !== p.id)
                                    )}
                                    className="accent-primary"
                                  />
                                  <span className="font-mono text-[11px] font-bold text-primary">{p.code}</span>
                                  <span className="text-[11px] text-on-surface-variant truncate max-w-[100px]">
                                    {p.name?.split('—')[1]?.trim() ?? p.name}
                                  </span>
                                </label>
                              ))}
                            </div>
                          )}
                          <div className="flex gap-2">
                            <button onClick={() => handleSaveProjectAccess(u.id)}
                              className="bg-primary text-white rounded-lg hover:bg-primary-container px-3 py-1.5 font-medium text-[12px] transition-colors">
                              Save
                            </button>
                            <button onClick={() => setEditingProjectsFor(null)}
                              className="bg-white border border-border-slate text-on-surface-variant hover:bg-surface-container px-3 py-1.5 rounded-lg font-medium text-[12px] transition-colors">
                              Cancel
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
            </div>
          )}

          {/* Add User form */}
          {addOpen && (
            <form onSubmit={handleAddUser} className="p-4 rounded-lg border border-border-slate bg-surface-container-low space-y-3">
              <p className="text-[14px] font-semibold text-on-surface mb-1">New User</p>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Full Name" value={newUser.name}     onChange={v => setNewUser(p => ({ ...p, name: v }))} />
                <Field label="Username"  value={newUser.username} onChange={v => setNewUser(p => ({ ...p, username: v }))} />
                <Field label="Password"  type="password" value={newUser.password} onChange={v => setNewUser(p => ({ ...p, password: v }))} />
                <div>
                  <label className="block text-[12px] text-on-surface-variant mb-1.5 font-medium">Role</label>
                  <select
                    value={newUser.role}
                    onChange={e => setNewUser(p => ({ ...p, role: e.target.value }))}
                    className="w-full bg-white border border-border-slate rounded-lg px-3 py-2 text-[14px] text-on-surface focus:outline-none focus:ring-1 focus:ring-primary/20"
                  >
                    {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
                  </select>
                </div>

                {newUser.role !== 'Director' && (
                  <div className="col-span-2">
                    <label className="block text-[12px] text-on-surface-variant mb-1.5 font-medium">Project Access</label>
                    <div className="flex flex-wrap gap-2 p-3 border border-border-slate rounded-lg bg-white">
                      {projects.length === 0 && <p className="text-[12px] text-on-surface-variant">No projects yet</p>}
                      {projects.map(p => (
                        <label key={p.id} className="flex items-center gap-1.5 cursor-pointer select-none">
                          <input
                            type="checkbox"
                            checked={newUser.selectedProjects.includes(p.id)}
                            onChange={e => setNewUser(prev => ({
                              ...prev,
                              selectedProjects: e.target.checked
                                ? [...prev.selectedProjects, p.id]
                                : prev.selectedProjects.filter(id => id !== p.id),
                            }))}
                            className="accent-primary"
                          />
                          <span className="font-mono text-[11px] font-bold text-primary">{p.code}</span>
                          <span className="text-[11px] text-on-surface-variant truncate max-w-[80px]">
                            {p.name?.split('—')[1]?.trim() ?? p.name}
                          </span>
                        </label>
                      ))}
                    </div>
                  </div>
                )}
              </div>
              <div className="flex gap-2 pt-1">
                <button type="submit" disabled={userLoading}
                  className="bg-primary text-white rounded-lg hover:bg-primary-container px-4 py-2 font-medium text-[14px] transition-colors disabled:opacity-60">
                  {userLoading ? 'Creating…' : 'Create User'}
                </button>
                <button type="button" onClick={() => setAddOpen(false)}
                  className="bg-white border border-border-slate text-on-surface-variant hover:bg-surface-container px-4 py-2 rounded-lg font-medium text-[14px] transition-colors">
                  Cancel
                </button>
              </div>
            </form>
          )}
        </Section>
      )}
    </div>
  );
}

function Section({ title, icon, children, headerAction }) {
  return (
    <div className="bg-white border border-border-slate rounded-xl p-6">
      <div className="flex items-center justify-between gap-2 mb-5">
        <div className="flex items-center gap-2">
          <span className="material-symbols-outlined text-primary text-[20px]">{icon}</span>
          <h2 className="text-[18px] font-semibold text-on-surface">{title}</h2>
        </div>
        {headerAction}
      </div>
      {children}
    </div>
  );
}

function Field({ label, type = 'text', value, onChange }) {
  return (
    <div>
      <label className="block text-[12px] text-on-surface-variant mb-1.5 font-medium">{label}</label>
      <input
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        className="w-full bg-white border border-border-slate rounded-lg px-3 py-2 text-[14px] text-on-surface focus:outline-none focus:ring-1 focus:ring-primary/20 focus:border-primary transition-all"
      />
    </div>
  );
}
