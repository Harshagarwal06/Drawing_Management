import { useState, useEffect } from "react";

const API = import.meta.env.VITE_API_URL;

const ROLES = ['Document Controller', 'Project Manager', 'Internal User', 'Subcontractor', 'Read-Only'];

const ROLE_COLOR = {
  'Document Controller': 'bg-primary/20 text-primary',
  'Project Manager':     'bg-blue-500/20 text-blue-400',
  'Internal User':       'bg-emerald-500/20 text-emerald-400',
  'Subcontractor':       'bg-amber-500/20 text-amber-400',
  'Read-Only':           'bg-slate-500/20 text-slate-400',
};

export default function SettingsView({ currentUser, onUserUpdate, token }) {
  const isAdmin = currentUser?.role === 'Document Controller';

  /* ── Password change ── */
  const [pwForm, setPwForm] = useState({ currentPassword: '', newPassword: '', confirm: '' });
  const [pwMsg,  setPwMsg]  = useState(null);
  const [pwLoading, setPwLoading] = useState(false);

  const handlePwChange = async (e) => {
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
      if (res.ok) {
        setPwMsg({ type: 'success', text: 'Password updated successfully.' });
        setPwForm({ currentPassword: '', newPassword: '', confirm: '' });
      } else {
        setPwMsg({ type: 'error', text: data.error || 'Failed to update password.' });
      }
    } catch {
      setPwMsg({ type: 'error', text: 'Cannot connect to server.' });
    } finally {
      setPwLoading(false);
    }
  };

  /* ── User management (admin only) ── */
  const [users,      setUsers]      = useState([]);
  const [newUser,    setNewUser]    = useState({ username: '', password: '', name: '', role: 'Internal User' });
  const [userMsg,    setUserMsg]    = useState(null);
  const [userLoading, setUserLoading] = useState(false);
  const [addOpen,    setAddOpen]    = useState(false);

  const loadUsers = () => {
    if (!isAdmin) return;
    fetch(`${API}/api/users`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.ok ? r.json() : [])
      .then(setUsers)
      .catch(() => {});
  };

  useEffect(() => { loadUsers(); }, []);

  const handleRoleChange = async (userId, role) => {
    await fetch(`${API}/api/users/${userId}/role`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ role }),
    });
    loadUsers();
  };

  const handleAddUser = async (e) => {
    e.preventDefault();
    setUserLoading(true);
    try {
      const res = await fetch(`${API}/api/users`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(newUser),
      });
      const data = await res.json();
      if (res.ok) {
        setUserMsg({ type: 'success', text: `User "${newUser.username}" created.` });
        setNewUser({ username: '', password: '', name: '', role: 'Internal User' });
        setAddOpen(false);
        loadUsers();
      } else {
        setUserMsg({ type: 'error', text: data.error || 'Failed to create user.' });
      }
    } catch {
      setUserMsg({ type: 'error', text: 'Cannot connect to server.' });
    } finally {
      setUserLoading(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-8">
      {/* Header */}
      <div>
        <h1 className="font-display-lg text-display-lg text-on-surface tracking-tight">Settings</h1>
        <p className="font-body-md text-body-md text-on-surface-variant mt-1">Account & administration</p>
      </div>

      {/* Profile card */}
      <Section title="Profile" icon="person">
        <div className="flex items-center gap-4 mb-6">
          <div className="w-14 h-14 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold text-xl">
            {currentUser?.avatar || currentUser?.name?.charAt(0)}
          </div>
          <div>
            <p className="font-headline-sm text-headline-sm text-on-surface">{currentUser?.name}</p>
            <p className="font-body-sm text-body-sm text-on-surface-variant">@{currentUser?.username}</p>
            <span className={`inline-block mt-1 px-2 py-0.5 rounded-full text-[11px] font-semibold ${ROLE_COLOR[currentUser?.role] || 'bg-slate-500/20 text-slate-400'}`}>
              {currentUser?.role}
            </span>
          </div>
        </div>
      </Section>

      {/* Change password */}
      <Section title="Change Password" icon="lock">
        <form onSubmit={handlePwChange} className="space-y-4 max-w-sm">
          {pwMsg && (
            <div className={`text-sm p-3 rounded-lg ${pwMsg.type === 'success' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-error/10 text-error border border-error/20'}`}>
              {pwMsg.text}
            </div>
          )}
          <Field label="Current Password" type="password" value={pwForm.currentPassword} onChange={v => setPwForm(p => ({ ...p, currentPassword: v }))} />
          <Field label="New Password"     type="password" value={pwForm.newPassword}     onChange={v => setPwForm(p => ({ ...p, newPassword: v }))} />
          <Field label="Confirm New Password" type="password" value={pwForm.confirm}     onChange={v => setPwForm(p => ({ ...p, confirm: v }))} />
          <button type="submit" disabled={pwLoading} className="px-5 py-2.5 bg-primary text-on-primary rounded-lg font-label-md text-label-md hover:bg-primary/90 transition-colors disabled:opacity-60">
            {pwLoading ? 'Updating…' : 'Update Password'}
          </button>
        </form>
      </Section>

      {/* User management — admin only */}
      {isAdmin && (
        <Section title="User Management" icon="manage_accounts">
          {userMsg && (
            <div className={`text-sm p-3 rounded-lg mb-4 ${userMsg.type === 'success' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-error/10 text-error border border-error/20'}`}>
              {userMsg.text}
            </div>
          )}

          {/* User list */}
          <div className="space-y-2 mb-4">
            {users.map(u => (
              <div key={u.id} className="flex items-center gap-3 p-3 rounded-lg bg-gray-50 border border-gray-100">
                <div className="w-9 h-9 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold text-sm shrink-0">
                  {u.avatar}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-label-md text-label-md text-on-surface">{u.name}</p>
                  <p className="font-body-sm text-[11px] text-on-surface-variant">@{u.username}</p>
                </div>
                <select
                  value={u.role}
                  onChange={e => handleRoleChange(u.id, e.target.value)}
                  disabled={u.id === currentUser?.id}
                  className="bg-surface-container-highest border border-gray-200 rounded-lg px-2 py-1 text-[11px] text-on-surface focus:outline-none focus:ring-1 focus:ring-primary disabled:opacity-50"
                >
                  {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
                </select>
              </div>
            ))}
          </div>

          {/* Add user */}
          {addOpen ? (
            <form onSubmit={handleAddUser} className="p-4 rounded-lg border border-gray-200 bg-gray-50 space-y-3">
              <p className="font-label-md text-label-md text-on-surface mb-1">New User</p>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Full Name"  value={newUser.name}     onChange={v => setNewUser(p => ({ ...p, name: v }))} />
                <Field label="Username"   value={newUser.username} onChange={v => setNewUser(p => ({ ...p, username: v }))} />
                <Field label="Password" type="password" value={newUser.password} onChange={v => setNewUser(p => ({ ...p, password: v }))} />
                <div>
                  <label className="block font-label-sm text-[11px] text-on-surface-variant mb-1.5">Role</label>
                  <select
                    value={newUser.role}
                    onChange={e => setNewUser(p => ({ ...p, role: e.target.value }))}
                    className="w-full bg-surface-container-lowest/50 border border-outline-variant/30 rounded-lg px-3 py-2 font-body-sm text-body-sm text-on-surface focus:outline-none focus:ring-1 focus:ring-primary"
                  >
                    {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
                  </select>
                </div>
              </div>
              <div className="flex gap-2 pt-1">
                <button type="submit" disabled={userLoading} className="px-4 py-2 bg-primary text-on-primary rounded-lg font-label-md text-label-md hover:bg-primary/90 transition-colors disabled:opacity-60 text-sm">
                  {userLoading ? 'Creating…' : 'Create User'}
                </button>
                <button type="button" onClick={() => setAddOpen(false)} className="px-4 py-2 bg-surface-container-highest text-on-surface-variant rounded-lg font-label-md text-label-md hover:bg-gray-100 transition-colors text-sm">
                  Cancel
                </button>
              </div>
            </form>
          ) : (
            <button onClick={() => { setAddOpen(true); setUserMsg(null); }} className="flex items-center gap-2 px-4 py-2 rounded-lg border border-dashed border-white/20 text-on-surface-variant hover:text-on-surface hover:border-white/40 transition-colors font-label-md text-label-md">
              <span className="material-symbols-outlined text-[16px]">person_add</span>
              Add User
            </button>
          )}
        </Section>
      )}
    </div>
  );
}

function Section({ title, icon, children }) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
      <div className="flex items-center gap-2 mb-5">
        <span className="material-symbols-outlined text-primary text-[20px]">{icon}</span>
        <h2 className="font-headline-sm text-headline-sm text-on-surface font-semibold">{title}</h2>
      </div>
      {children}
    </div>
  );
}

function Field({ label, type = 'text', value, onChange }) {
  return (
    <div>
      <label className="block font-label-sm text-[11px] text-on-surface-variant mb-1.5">{label}</label>
      <input
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        className="w-full bg-surface-container-lowest/50 border border-outline-variant/30 rounded-lg px-3 py-2 font-body-sm text-body-sm text-on-surface placeholder:text-outline-variant focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary transition-all"
      />
    </div>
  );
}
