import { useState, useEffect } from "react";

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
  const [newUser,    setNewUser]    = useState({ username: '', password: '', name: '', role: 'In House Architect', allowedProjects: '*' });
  const [userMsg,    setUserMsg]    = useState(null);
  const [userLoading,setUserLoading]= useState(false);
  const [addOpen,    setAddOpen]    = useState(false);

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

  useEffect(() => { loadUsers(); }, []);

  const handleRoleChange = async (userId, role, allowedProjects) => {
    await fetch(`${API}/api/users/${userId}/role`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ role, allowedProjects: role === 'Director' ? '*' : allowedProjects }),
    });
    loadUsers();
  };

  const handleAddUser = async e => {
    e.preventDefault();
    setUserLoading(true);
    try {
      const res = await fetch(`${API}/api/users`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ ...newUser, allowedProjects: newUser.role === 'Director' ? '*' : newUser.allowedProjects }),
      });
      const data = await res.json();
      if (res.ok) {
        setUserMsg({ type: 'success', text: `User "${newUser.username}" created.` });
        setNewUser({ username: '', password: '', name: '', role: 'In House Architect', allowedProjects: '*' });
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
          <Field label="Current Password" type="password" value={pwForm.currentPassword} onChange={v => setPwForm(p => ({ ...p, currentPassword: v }))} />
          <Field label="New Password"     type="password" value={pwForm.newPassword}     onChange={v => setPwForm(p => ({ ...p, newPassword: v }))} />
          <Field label="Confirm New Password" type="password" value={pwForm.confirm}     onChange={v => setPwForm(p => ({ ...p, confirm: v }))} />
          <button type="submit" disabled={pwLoading}
            className="bg-primary text-white rounded-lg hover:bg-primary-container px-5 py-2.5 font-medium text-[14px] transition-colors disabled:opacity-60">
            {pwLoading ? 'Updating…' : 'Update Password'}
          </button>
        </form>
      </Section>

      {/* User Management */}
      {isAdmin && (
        <Section title="User Management" icon="manage_accounts">
          {userMsg && (
            <div className={`text-[13px] p-3 rounded-lg border mb-4 ${userMsg.type === 'success' ? 'bg-status-emerald-bg text-status-emerald-text border-status-emerald-text/20' : 'bg-status-rose-bg text-status-rose-text border-status-rose-text/20'}`}>
              {userMsg.text}
            </div>
          )}

          <div className="space-y-2 mb-4">
            {users.map(u => (
              <div key={u.id} className="flex items-center gap-3 p-3 rounded-lg bg-surface-container-low border border-border-slate">
                <div className="w-9 h-9 rounded-full bg-primary flex items-center justify-center text-white font-bold text-[13px] shrink-0">
                  {u.avatar}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[14px] font-medium text-on-surface">{u.name}</p>
                  <p className="text-[11px] text-on-surface-variant">@{u.username}</p>
                </div>
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold shrink-0 hidden sm:block ${ROLE_COLOR[u.role] || 'bg-surface-container text-on-surface-variant'}`}>
                  {u.role}
                </span>
                <select
                  value={u.role}
                  onChange={e => handleRoleChange(u.id, e.target.value, u.allowedProjects)}
                  disabled={u.id === currentUser?.id}
                  className="bg-white border border-border-slate rounded-lg px-2 py-1 text-[12px] text-on-surface focus:outline-none focus:ring-1 focus:ring-primary/20 disabled:opacity-50"
                >
                  {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
                </select>
              </div>
            ))}
          </div>

          {addOpen ? (
            <form onSubmit={handleAddUser} className="p-4 rounded-lg border border-border-slate bg-surface-container-low space-y-3">
              <p className="text-[14px] font-semibold text-on-surface mb-1">New User</p>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Full Name" value={newUser.name}     onChange={v => setNewUser(p => ({ ...p, name: v }))} />
                <Field label="Username"  value={newUser.username} onChange={v => setNewUser(p => ({ ...p, username: v }))} />
                <Field label="Password" type="password" value={newUser.password} onChange={v => setNewUser(p => ({ ...p, password: v }))} />
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
          ) : (
            <button onClick={() => { setAddOpen(true); setUserMsg(null); }}
              className="flex items-center gap-2 px-4 py-2 rounded-lg border border-dashed border-border-slate text-on-surface-variant hover:text-on-surface hover:bg-surface-container-low transition-colors text-[14px] font-medium">
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
    <div className="bg-white border border-border-slate rounded-xl p-6">
      <div className="flex items-center gap-2 mb-5">
        <span className="material-symbols-outlined text-primary text-[20px]">{icon}</span>
        <h2 className="text-[18px] font-semibold text-on-surface">{title}</h2>
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
