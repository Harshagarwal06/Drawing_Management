import { useState, useEffect, useLayoutEffect, useRef, useCallback, useId } from "react";
import { createPortal } from "react-dom";
import {
  MoreVertical, KeyRound, UserX, Trash2, X, RotateCcw,
  Eye, EyeOff, UserPlus, Search, Pencil, FolderOpen,
  MessageSquare, CheckCircle2, Lock, User, Users, Check, Unplug, LogOut,
} from "lucide-react";

/* Shared focus-visible ring — keyboard users can see what's focused. */
const FOCUS_RING = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40';

const API = import.meta.env.VITE_API_URL;

const ROLES = ['Director', 'In House Architect', 'Project Team'];

const ROLE_COLOR = {
  'Director':            'bg-primary/10 text-primary',
  'In House Architect':  'bg-status-emerald-bg text-status-emerald-text',
  'Project Team':        'bg-status-amber-bg text-status-amber-text',
};

/* ── Portal dropdown — escapes overflow:hidden containers ────────────
   Positions itself with fixed coords from getBoundingClientRect().
   Flips upward automatically when there isn't enough space below.    */
const MENU_W = 200;
const MENU_H = 132; // approximate max height (3 items)

function PortalDropdown({ anchorEl, onClose, children }) {
  const menuRef = useRef(null);

  /* Measure the anchor before paint and position the menu by mutating its
     style directly, so it never flashes at a wrong position */
  useLayoutEffect(() => {
    const el = menuRef.current;
    if (!anchorEl || !el) return;
    const rect      = anchorEl.getBoundingClientRect();
    const spaceBelow = window.innerHeight - rect.bottom;
    const flipUp     = spaceBelow < MENU_H + 8;

    const rawLeft = rect.right - MENU_W;
    const left    = Math.max(8, Math.min(window.innerWidth - MENU_W - 8, rawLeft));

    el.style.left = `${left}px`;
    if (flipUp) {
      el.style.bottom = `${window.innerHeight - rect.top + 4}px`;
      el.style.removeProperty('top');
    } else {
      el.style.top = `${rect.bottom + 4}px`;
      el.style.removeProperty('bottom');
    }
  }, [anchorEl]);

  if (!anchorEl) return null;

  return createPortal(
    <>
      <div
        style={{ position: 'fixed', inset: 0, zIndex: 9998 }}
        onClick={onClose}
      />
      <div
        ref={menuRef}
        style={{ position: 'fixed', zIndex: 9999, width: MENU_W }}
        className="bg-white border border-border-slate rounded-xl shadow-xl overflow-hidden py-1"
      >
        {children}
      </div>
    </>,
    document.body
  );
}

/* Traps focus inside an open modal, autofocuses the first field/control,
   and restores focus to the trigger on close. (focus-management) */
function useFocusTrap(active) {
  const ref = useRef(null);
  useEffect(() => {
    if (!active) return;
    const node = ref.current;
    if (!node) return;
    const prevFocused = document.activeElement;
    const selector =
      'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';
    const focusables = () =>
      Array.from(node.querySelectorAll(selector)).filter(el => el.offsetParent !== null);

    // Prefer the first editable field; fall back to the first focusable control.
    (node.querySelector('input,select,textarea') || focusables()[0])?.focus();

    const onKey = (e) => {
      if (e.key !== 'Tab') return;
      const items = focusables();
      if (items.length === 0) return;
      const first = items[0];
      const last  = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first)      { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    };
    node.addEventListener('keydown', onKey);
    return () => {
      node.removeEventListener('keydown', onKey);
      prevFocused?.focus?.();
    };
  }, [active]);
  return ref;
}

/* ── Dropdown menu item variants ──────────────────────────────────── */
function MenuItem({ icon: Icon, label, onClick, variant = 'default' }) {
  const styles = {
    default: 'text-on-surface hover:bg-surface-container-low',
    warning: 'text-status-amber-text hover:bg-status-amber-bg',
    danger:  'text-status-rose-text hover:bg-status-rose-bg',
  };
  const iconStyles = {
    default: 'text-on-surface-variant',
    warning: 'text-status-amber-text',
    danger:  'text-status-rose-text',
  };
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-2.5 px-4 py-2.5 text-[13px] font-medium transition-colors text-left ${FOCUS_RING} ${styles[variant]}`}
    >
      <Icon size={14} className={`shrink-0 ${iconStyles[variant]}`} />
      {label}
    </button>
  );
}

/* ── Thin divider inside the dropdown ────────────────────────────── */
function MenuDivider() {
  return <div className="my-1 border-t border-border-slate" />;
}

export default function SettingsView({ currentUser, token, onUserUpdate, onLogout }) {
  const isAdmin = currentUser?.role === 'Director';

  const [pwForm,      setPwForm]      = useState({ currentPassword: '', newPassword: '', confirm: '' });
  const [pwMsg,       setPwMsg]       = useState(null);
  const [pwLoading,   setPwLoading]   = useState(false);
  const [signOutAllLoading, setSignOutAllLoading] = useState(false);
  const [users,       setUsers]       = useState([]);
  const [newUser,     setNewUser]     = useState({ username: '', password: '', name: '', role: 'In House Architect', selectedProjects: [] });
  const [userMsg,     setUserMsg]     = useState(null);
  const [userLoading, setUserLoading] = useState(false);
  const [addOpen,     setAddOpen]     = useState(false);
  const [roleFlash,   setRoleFlash]   = useState(null); // { userId, ok }

  const [projects,           setProjects]           = useState([]);
  const [editingProjectsFor, setEditingProjectsFor] = useState(null);
  const [pendingProjects,    setPendingProjects]    = useState([]);
  const [userSearch,         setUserSearch]         = useState('');
  const [roleFilter,         setRoleFilter]         = useState('All');

  // Project rename
  const [renamingProject, setRenamingProject] = useState(null); // { id, name, code }
  const [renameForm,      setRenameForm]      = useState({ name: '', code: '' });
  const [renameMsg,       setRenameMsg]       = useState(null);
  const [renameLoading,   setRenameLoading]   = useState(false);

  // Slack webhook config
  const [slackProject, setSlackProject] = useState(null); // { id, name, code, slackConfigured }
  const [slackUrl,     setSlackUrl]     = useState('');
  const [slackMsg,     setSlackMsg]     = useState(null);
  const [slackLoading, setSlackLoading] = useState(false);

  // ⋮ menu
  const [menuOpenId, setMenuOpenId] = useState(null);
  const [menuAnchor, setMenuAnchor] = useState(null);

  // Reset-password inline panel
  const [resetUserId,  setResetUserId]  = useState(null);
  const [resetPw,      setResetPw]      = useState('');
  const [resetMsg,     setResetMsg]     = useState(null);
  const [resetLoading, setResetLoading] = useState(false);

  // Map of userId → ⋮ button DOM element
  const btnRefs = useRef(new Map());
  const setBtnRef = useCallback((userId, el) => {
    if (el) btnRefs.current.set(userId, el);
    else    btnRefs.current.delete(userId);
  }, []);

  const openMenu = (userId) => {
    setMenuOpenId(userId);
    setMenuAnchor(btnRefs.current.get(userId) || null);
  };
  const closeMenu = () => { setMenuOpenId(null); setMenuAnchor(null); };

  /* Returns null for wildcard, or an array of project IDs */
  const parseAllowed = (ap) => {
    if (!ap || ap === '*') return null;
    try { return JSON.parse(ap); } catch { return []; }
  };

  /* ── Show a timed notice in the userMsg banner ── */
  const flashMsg = (type, text, ms = 3500) => {
    setUserMsg({ type, text });
    setTimeout(() => setUserMsg(null), ms);
  };

  const handlePwChange = async e => {
    e.preventDefault();
    if (pwForm.newPassword !== pwForm.confirm) { setPwMsg({ type: 'error', text: 'New passwords do not match.' }); return; }
    if (pwForm.newPassword.length < 6)         { setPwMsg({ type: 'error', text: 'New password must be at least 6 characters.' }); return; }
    setPwLoading(true);
    try {
      const res  = await fetch(`${API}/api/users/me/password`, {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body:    JSON.stringify({ currentPassword: pwForm.currentPassword, newPassword: pwForm.newPassword }),
      });
      const data = await res.json();
      if (res.ok) {
        setPwMsg({ type: 'success', text: 'Password updated. Other devices have been signed out.' });
        setPwForm({ currentPassword: '', newPassword: '', confirm: '' });
        // Swap in the fresh token so this device stays signed in (old token is now revoked).
        if (data.token) onUserUpdate?.(prev => ({ ...prev, token: data.token }));
      }
      else          setPwMsg({ type: 'error',   text: data.error || 'Failed to update password.' });
    } catch    { setPwMsg({ type: 'error', text: 'Cannot connect to server.' }); }
    finally    { setPwLoading(false); }
  };

  const handleSignOutAll = async () => {
    setSignOutAllLoading(true);
    try {
      const res = await fetch(`${API}/api/logout-all`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) onLogout?.();           // current token is now revoked too — return to login
      else setPwMsg({ type: 'error', text: 'Failed to sign out of all devices.' });
    } catch { setPwMsg({ type: 'error', text: 'Cannot connect to server.' }); }
    finally { setSignOutAllLoading(false); }
  };

  const loadUsers = useCallback(() => {
    if (!isAdmin) return;
    fetch(`${API}/api/users`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.ok ? r.json() : []).then(setUsers).catch(() => {});
  }, [isAdmin, token]);

  const loadProjects = useCallback(() => {
    if (!isAdmin) return;
    fetch(`${API}/api/projects`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.ok ? r.json() : [])
      .then(ps => {
        // Coerce SQLite's 0/1 to real booleans so {cond && ...} never renders "0".
        setProjects(ps.map(p => ({ ...p, slackConfigured: !!p.slackConfigured })));
      })
      .catch(() => {});
  }, [isAdmin, token]);

  useEffect(() => { loadUsers(); loadProjects(); }, [loadUsers, loadProjects]);

  const handleRenameProject = async (e) => {
    e.preventDefault();
    setRenameLoading(true);
    setRenameMsg(null);
    try {
      const res = await fetch(`${API}/api/projects/${renamingProject.id}`, {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body:    JSON.stringify({ name: renameForm.name.trim(), code: renameForm.code.trim().toUpperCase() }),
      });
      const data = await res.json();
      if (res.ok) {
        setRenameMsg({ type: 'success', text: 'Project renamed successfully.' });
        loadProjects();
        setTimeout(() => { setRenamingProject(null); setRenameMsg(null); }, 1000);
      } else {
        setRenameMsg({ type: 'error', text: data.error || 'Failed to rename project.' });
      }
    } catch (err) {
      setRenameMsg({ type: 'error', text: err?.message || 'Cannot connect to server.' });
    } finally {
      setRenameLoading(false);
    }
  };

  const openSlackEditor = (p) => {
    setSlackProject(p);
    setSlackUrl('');          // never pre-fill the secret; blank = leave unchanged when configured
    setSlackMsg(null);
  };

  const saveSlackUrl = async (url) => {
    setSlackLoading(true);
    setSlackMsg(null);
    try {
      const res = await fetch(`${API}/api/projects/${slackProject.id}/slack`, {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body:    JSON.stringify({ slackWebhookUrl: url }),
      });
      const data = await res.json();
      if (res.ok) {
        setSlackMsg({ type: 'success', text: url ? 'Slack webhook saved.' : 'Slack webhook cleared.' });
        loadProjects();
        setSlackProject(p => p ? { ...p, slackConfigured: data.slackConfigured } : p);
      } else {
        setSlackMsg({ type: 'error', text: data.error || 'Failed to save webhook.' });
      }
    } catch (err) {
      setSlackMsg({ type: 'error', text: err?.message || 'Cannot connect to server.' });
    } finally {
      setSlackLoading(false);
    }
  };

  const handleSaveSlack = (e) => {
    e.preventDefault();
    return saveSlackUrl(slackUrl.trim());
  };

  const handleTestSlack = async () => {
    setSlackLoading(true);
    setSlackMsg(null);
    try {
      const res = await fetch(`${API}/api/projects/${slackProject.id}/slack/test`, {
        method:  'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (res.ok) setSlackMsg({ type: 'success', text: 'Test message sent — check your Slack channel.' });
      else        setSlackMsg({ type: 'error', text: data.error || 'Failed to send test message.' });
    } catch (err) {
      setSlackMsg({ type: 'error', text: err?.message || 'Cannot connect to server.' });
    } finally {
      setSlackLoading(false);
    }
  };

  const handleRoleChange = async (userId, role, allowedProjects) => {
    try {
      const res = await fetch(`${API}/api/users/${userId}/role`, {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body:    JSON.stringify({ role, allowedProjects: role === 'Director' ? '*' : allowedProjects }),
      });
      const ok = res.ok;
      setRoleFlash({ userId, ok });
      setTimeout(() => setRoleFlash(null), 2000);
      if (!ok) flashMsg('error', 'Failed to update role.');
    } catch {
      setRoleFlash({ userId, ok: false });
      setTimeout(() => setRoleFlash(null), 2000);
      flashMsg('error', 'Cannot connect to server.');
    }
    loadUsers();
  };

  const handleSaveProjectAccess = async (userId) => {
    const user = users.find(u => u.id === userId);
    if (!user) return;
    try {
      const res = await fetch(`${API}/api/users/${userId}/role`, {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body:    JSON.stringify({ role: user.role, allowedProjects: JSON.stringify(pendingProjects) }),
      });
      if (res.ok) { flashMsg('success', 'Project access updated.'); setEditingProjectsFor(null); }
      else          flashMsg('error',   'Failed to update project access.');
    } catch     { flashMsg('error', 'Cannot connect to server.'); }
    loadUsers();
  };

  const openProjectEditor = (u) => {
    setEditingProjectsFor(u.id);
    const parsed = parseAllowed(u.allowed_projects);
    setPendingProjects(parsed === null ? projects.map(p => p.id) : parsed);
  };

  const handleResetPassword = async (userId) => {
    if (!resetPw || resetPw.length < 6) { setResetMsg({ type: 'error', text: 'Password must be at least 6 characters.' }); return; }
    setResetLoading(true);
    try {
      const res  = await fetch(`${API}/api/users/${userId}/reset-password`, {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body:    JSON.stringify({ newPassword: resetPw }),
      });
      const data = await res.json();
      if (res.ok) {
        setResetMsg({ type: 'success', text: 'Password reset successfully.' });
        setResetPw('');
        setTimeout(() => { setResetUserId(null); setResetMsg(null); }, 1500);
      } else {
        setResetMsg({ type: 'error', text: data.error || 'Failed to reset password.' });
      }
    } catch { setResetMsg({ type: 'error', text: 'Cannot connect to server.' }); }
    finally { setResetLoading(false); }
  };

  // Confirmation state for deactivate / remove / slack-disconnect
  const [confirmAction, setConfirmAction] = useState(null); // { type, user } | { type:'slack-disconnect', project }

  // Focus traps — autofocus first field, trap Tab, restore focus on close.
  const renameModalRef  = useFocusTrap(!!renamingProject);
  const slackModalRef    = useFocusTrap(!!slackProject);
  const confirmModalRef  = useFocusTrap(!!confirmAction);

  /* Escape closes whichever modal is open (innermost first). Gives keyboard
     users a predictable exit — escape-routes / modal-escape. */
  useEffect(() => {
    const onKey = (e) => {
      if (e.key !== 'Escape') return;
      if (confirmAction)        setConfirmAction(null);
      else if (slackProject)    setSlackProject(null);
      else if (renamingProject) setRenamingProject(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [confirmAction, slackProject, renamingProject]);

  const handleDeactivate = async (u) => {
    try {
      const res = await fetch(`${API}/api/users/${u.id}/deactivate`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (res.ok) {
        flashMsg('success', data.active ? `"${u.name}" reactivated.` : `"${u.name}" deactivated.`);
      } else {
        flashMsg('error', data.error || 'Failed to update user status.');
      }
    } catch { flashMsg('error', 'Cannot connect to server.'); }
    loadUsers();
  };

  const handleRemove = async (u) => {
    try {
      const res = await fetch(`${API}/api/users/${u.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (res.ok) {
        flashMsg('success', `"${u.name}" removed permanently.`);
      } else {
        flashMsg('error', data.error || 'Failed to remove user.');
      }
    } catch { flashMsg('error', 'Cannot connect to server.'); }
    loadUsers();
  };

  const handleAddUser = async e => {
    e.preventDefault();
    if (!newUser.name.trim() || !newUser.username.trim() || !newUser.password) {
      flashMsg('error', 'Name, username, and password are required.');
      return;
    }
    if (newUser.role !== 'Director' && newUser.selectedProjects.length === 0) {
      flashMsg('error', 'Please select at least one project for this user.');
      return;
    }
    setUserLoading(true);
    try {
      const res  = await fetch(`${API}/api/users`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body:    JSON.stringify({
          ...newUser,
          allowedProjects: newUser.role === 'Director' ? '*' : JSON.stringify(newUser.selectedProjects),
        }),
      });
      const data = await res.json();
      if (res.ok) {
        flashMsg('success', `User "${newUser.username}" created.`);
        setNewUser({ username: '', password: '', name: '', role: 'In House Architect', selectedProjects: [] });
        setAddOpen(false); loadUsers();
      } else flashMsg('error', data.error || 'Failed to create user.');
    } catch { flashMsg('error', 'Cannot connect to server.'); }
    finally { setUserLoading(false); }
  };

  const filteredUsers = users.filter(u => {
    const q      = userSearch.toLowerCase();
    const matchQ = !q || u.name.toLowerCase().includes(q) || u.username.toLowerCase().includes(q);
    const matchR = roleFilter === 'All' || u.role === roleFilter;
    return matchQ && matchR;
  });

  /* ── Banner colours (handles 'warning' type too) ── */
  const bannerClass = (type) => {
    if (type === 'success') return 'bg-status-emerald-bg text-status-emerald-text border-status-emerald-text/20';
    if (type === 'warning') return 'bg-status-amber-bg text-status-amber-text border-status-amber-text/20';
    return 'bg-status-rose-bg text-status-rose-text border-status-rose-text/20';
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-headline-lg font-semibold text-on-surface">Settings</h1>
        <p className="text-body-md text-on-surface-variant mt-1">Account &amp; administration</p>
      </div>

      {/* ── Profile ─────────────────────────────────────────────────── */}
      <Section title="Profile" icon={User}>
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

      {/* ── Change Password ──────────────────────────────────────────── */}
      <Section title="Change Password" icon={Lock}>
        <form onSubmit={handlePwChange} className="space-y-4 max-w-sm">
          {pwMsg && (
            <div role="alert" aria-live="polite" className={`text-[13px] p-3 rounded-lg border ${bannerClass(pwMsg.type)}`}>
              {pwMsg.text}
            </div>
          )}
          <Field label="Current Password"     type="password" autoComplete="current-password" value={pwForm.currentPassword} onChange={v => setPwForm(p => ({ ...p, currentPassword: v }))} />
          <Field label="New Password"         type="password" autoComplete="new-password"     value={pwForm.newPassword}     onChange={v => setPwForm(p => ({ ...p, newPassword: v }))} />
          <Field label="Confirm New Password" type="password" autoComplete="new-password"     value={pwForm.confirm}         onChange={v => setPwForm(p => ({ ...p, confirm: v }))} />
          <button type="submit" disabled={pwLoading}
            className={`bg-primary text-white rounded-lg hover:bg-primary-container px-5 py-2.5 font-medium text-[14px] transition-colors disabled:opacity-60 ${FOCUS_RING}`}>
            {pwLoading ? 'Updating…' : 'Update Password'}
          </button>
        </form>

        {/* ── Sign out everywhere ── */}
        <div className="max-w-sm mt-7 pt-6 border-t border-outline-variant">
          <h3 className="text-[14px] font-semibold text-on-surface flex items-center gap-2">
            <LogOut size={15} /> Sign out everywhere
          </h3>
          <p className="text-[12px] text-on-surface-variant mt-1 mb-3">
            Signs you out of this device and every other device. Use this if you think your account may be compromised.
          </p>
          <button type="button" onClick={handleSignOutAll} disabled={signOutAllLoading}
            className={`border border-status-rose-text/30 text-status-rose-text rounded-lg hover:bg-status-rose-bg px-5 py-2.5 font-medium text-[14px] transition-colors disabled:opacity-60 ${FOCUS_RING}`}>
            {signOutAllLoading ? 'Signing out…' : 'Sign out of all devices'}
          </button>
        </div>
      </Section>

      {/* ── User Management ──────────────────────────────────────────── */}
      {isAdmin && (
        <Section
          title="User Management"
          icon={Users}
          headerAction={
            !addOpen && (
              <button
                onClick={() => { setAddOpen(true); setUserMsg(null); }}
                className={`flex items-center gap-1.5 px-4 py-2 bg-primary text-white rounded-lg font-medium text-[13px] hover:bg-primary-container transition-colors ${FOCUS_RING}`}
              >
                <UserPlus size={16} />
                Add User
              </button>
            )
          }
        >
          {/* Status banner */}
          {userMsg && (
            <div role="alert" aria-live="polite" className={`text-[13px] p-3 rounded-lg border mb-4 ${bannerClass(userMsg.type)}`}>
              {userMsg.text}
            </div>
          )}

          {/* Search + filter toolbar */}
          {!addOpen && (
            <div className="flex gap-2 mb-4">
              <div className="relative flex-1">
                <Search size={16} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-on-surface-variant" />
                <input
                  type="text"
                  value={userSearch}
                  onChange={e => setUserSearch(e.target.value)}
                  placeholder="Search users..."
                  aria-label="Search users"
                  className="w-full pl-8 pr-3 py-2 text-[13px] bg-white border border-border-slate rounded-lg text-on-surface placeholder:text-on-surface-variant focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus:border-primary transition-all"
                />
              </div>
              <select
                value={roleFilter}
                onChange={e => setRoleFilter(e.target.value)}
                aria-label="Filter by role"
                className="bg-white border border-border-slate rounded-lg px-3 py-2 text-[13px] text-on-surface focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 shrink-0"
              >
                <option value="All">All Roles</option>
                {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>
          )}

          {/* User list */}
          {!addOpen && (
            <div className="rounded-xl border border-border-slate overflow-hidden mb-4">
              {filteredUsers.length === 0 && (
                <div className="px-4 py-8 text-center text-[13px] text-on-surface-variant">
                  No users found.
                </div>
              )}
              {filteredUsers
                .map((u, idx, arr) => {
                  const isNonDirector = u.role !== 'Director';
                  const isSelf        = u.id === currentUser?.id;
                  const allowedList   = parseAllowed(u.allowed_projects);
                  const isExpanded    = editingProjectsFor === u.id;
                  const isLast        = idx === arr.length - 1;
                  const isDeactivated = u.active === 0;

                  return (
                    <div key={u.id} className={!isLast ? 'border-b border-border-slate' : ''}>

                      {/* ── User row ── */}
                      <div className={`flex items-center gap-2 px-4 py-2.5 transition-colors ${isDeactivated ? 'bg-surface-container-low opacity-60' : 'bg-white hover:bg-surface-container-low'}`}>

                        {/* Avatar */}
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-[12px] shrink-0 ${isDeactivated ? 'bg-on-surface-variant' : 'bg-primary'}`}>
                          {u.avatar}
                        </div>

                        {/* Middle column — name stacks above the controls on mobile and
                            sits inline on desktop, so the name is never squeezed to zero. */}
                        <div className="flex-1 min-w-0 flex flex-col sm:flex-row sm:items-center gap-1.5 sm:gap-2">

                          {/* Name + username */}
                          <div className="min-w-0 sm:flex-1">
                            <p className="text-[13px] font-medium text-on-surface leading-tight flex items-center gap-2 min-w-0">
                              <span className="truncate">{u.name}</span>
                              {isDeactivated && (
                                <span className="shrink-0 px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-status-rose-bg text-status-rose-text uppercase tracking-wide">Deactivated</span>
                              )}
                            </p>
                            <p className="text-[11px] text-on-surface-variant truncate">@{u.username}</p>
                          </div>

                          {/* Controls — role select + project-access pill */}
                          <div className="flex items-center gap-1.5 shrink-0">

                            {/* Role dropdown */}
                            <div className="relative flex items-center gap-1.5 shrink-0">
                              <select
                                value={u.role}
                                onChange={e => handleRoleChange(u.id, e.target.value, u.allowed_projects)}
                                disabled={isSelf}
                                aria-label={`Role for ${u.name}`}
                                title={isSelf ? "You can't change your own role" : undefined}
                                className={`bg-white border border-border-slate rounded-lg px-2 py-1.5 text-[12px] text-on-surface focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 disabled:opacity-50 ${FOCUS_RING}`}
                              >
                                {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
                              </select>
                              {roleFlash?.userId === u.id && (
                                <span className={`inline-flex items-center gap-0.5 text-[10px] font-bold px-1.5 py-0.5 rounded-full shrink-0 ${
                                  roleFlash.ok
                                    ? 'bg-status-emerald-bg text-status-emerald-text'
                                    : 'bg-status-rose-bg text-status-rose-text'
                                }`}>
                                  {roleFlash.ok ? <Check size={11} /> : <X size={11} />}
                                  {roleFlash.ok ? 'saved' : 'failed'}
                                </span>
                              )}
                            </div>

                            {/* Project access pill — non-Director, non-self (primary way to edit access).
                                Shown on mobile too, so access can be edited on a phone. */}
                            {isNonDirector && !isSelf && (
                              allowedList === null ? (
                                <button
                                  onClick={() => isExpanded ? setEditingProjectsFor(null) : openProjectEditor(u)}
                                  aria-label={`Edit project access for ${u.name} (all projects)`}
                                  className={`flex px-2 py-1 rounded-full text-[10px] font-medium bg-surface-container text-on-surface-variant border border-border-slate hover:bg-surface-container-high transition-colors shrink-0 items-center gap-1 ${FOCUS_RING}`}
                                >
                                  <span className="hidden sm:inline">All projects</span>
                                  <Pencil size={11} />
                                </button>
                              ) : (
                                <button
                                  onClick={() => isExpanded ? setEditingProjectsFor(null) : openProjectEditor(u)}
                                  aria-label={`Edit project access for ${u.name} (${allowedList.length} project${allowedList.length !== 1 ? 's' : ''})`}
                                  className={`flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-medium bg-primary/10 text-primary border border-primary/20 hover:bg-primary/20 transition-colors shrink-0 ${FOCUS_RING}`}
                                >
                                  <span>{allowedList.length}<span className="hidden sm:inline"> project{allowedList.length !== 1 ? 's' : ''}</span></span>
                                  <Pencil size={12} />
                                </button>
                              )
                            )}
                            {/* Spacer keeps columns aligned for Director / self rows — desktop only */}
                            {(!isNonDirector || isSelf) && <div className="hidden sm:block w-[80px] shrink-0" />}
                          </div>
                        </div>

                        {/* ⋮ button */}
                        <button
                          ref={el => setBtnRef(u.id, el)}
                          disabled={isSelf}
                          onClick={() => menuOpenId === u.id ? closeMenu() : openMenu(u.id)}
                          className={`p-2 rounded-md text-on-surface-variant hover:bg-surface-container disabled:opacity-30 transition-colors shrink-0 ${FOCUS_RING}`}
                          aria-label={`More actions for ${u.name}`}
                          aria-haspopup="menu"
                          aria-expanded={menuOpenId === u.id}
                          title="More actions"
                        >
                          <MoreVertical size={15} />
                        </button>
                      </div>

                      {/* ── Portal dropdown ── */}
                      {menuOpenId === u.id && (
                        <PortalDropdown anchorEl={menuAnchor} onClose={closeMenu}>
                          <MenuItem
                            icon={KeyRound}
                            label="Reset Password"
                            variant="default"
                            onClick={() => {
                              closeMenu();
                              setResetUserId(u.id);
                              setResetPw('');
                              setResetMsg(null);
                            }}
                          />
                          <MenuDivider />
                          {isDeactivated ? (
                            <MenuItem
                              icon={RotateCcw}
                              label="Reactivate User"
                              variant="default"
                              onClick={() => { closeMenu(); handleDeactivate(u); }}
                            />
                          ) : (
                            <MenuItem
                              icon={UserX}
                              label="Deactivate User"
                              variant="warning"
                              onClick={() => { closeMenu(); setConfirmAction({ type: 'deactivate', user: u }); }}
                            />
                          )}
                          <MenuItem
                            icon={Trash2}
                            label="Remove User"
                            variant="danger"
                            onClick={() => { closeMenu(); setConfirmAction({ type: 'remove', user: u }); }}
                          />
                        </PortalDropdown>
                      )}

                      {/* ── Inline reset-password panel ── */}
                      {resetUserId === u.id && (
                        <div className="border-t border-border-slate bg-surface-container-low px-4 py-3">
                          <div className="flex items-center justify-between mb-2">
                            <p className="text-[11px] font-semibold text-on-surface-variant uppercase tracking-wide">
                              Reset Password — {u.name}
                            </p>
                            <button
                              onClick={() => { setResetUserId(null); setResetMsg(null); }}
                              aria-label="Close reset password panel"
                              className={`p-1.5 rounded-md text-on-surface-variant hover:text-on-surface hover:bg-surface-container ${FOCUS_RING}`}
                            >
                              <X size={14} />
                            </button>
                          </div>
                          {resetMsg && (
                            <div role="alert" aria-live="polite" className={`text-[12px] p-2 rounded-lg border mb-2 ${bannerClass(resetMsg.type)}`}>
                              {resetMsg.text}
                            </div>
                          )}
                          <div className="flex gap-2 items-center">
                            <input
                              type="password"
                              value={resetPw}
                              onChange={e => setResetPw(e.target.value)}
                              onKeyDown={e => e.key === 'Enter' && handleResetPassword(u.id)}
                              placeholder="New password (min 6 chars)"
                              autoComplete="new-password"
                              aria-label={`New password for ${u.name}`}
                              className="flex-1 bg-white border border-border-slate rounded-lg px-3 py-1.5 text-[13px] text-on-surface focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus:border-primary transition-all"
                            />
                            <button
                              onClick={() => handleResetPassword(u.id)}
                              disabled={resetLoading}
                              className={`bg-primary text-white rounded-lg hover:bg-primary-container px-3 py-1.5 font-medium text-[12px] transition-colors disabled:opacity-60 shrink-0 ${FOCUS_RING}`}
                            >
                              {resetLoading ? 'Saving…' : 'Set Password'}
                            </button>
                          </div>
                        </div>
                      )}

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
                              className={`bg-primary text-white rounded-lg hover:bg-primary-container px-3 py-1.5 font-medium text-[12px] transition-colors ${FOCUS_RING}`}>
                              Save
                            </button>
                            <button onClick={() => setEditingProjectsFor(null)}
                              className={`bg-white border border-border-slate text-on-surface-variant hover:bg-surface-container px-3 py-1.5 rounded-lg font-medium text-[12px] transition-colors ${FOCUS_RING}`}>
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
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Field label="Full Name" required autoComplete="off" value={newUser.name}     onChange={v => setNewUser(p => ({ ...p, name: v }))} />
                <Field label="Username"  required autoComplete="off" value={newUser.username} onChange={v => setNewUser(p => ({ ...p, username: v }))} />
                <Field label="Password"  required autoComplete="new-password" type="password" value={newUser.password} onChange={v => setNewUser(p => ({ ...p, password: v }))} />
                <div>
                  <label htmlFor="new-user-role" className="block text-[12px] text-on-surface-variant mb-1.5 font-medium">Role</label>
                  <select
                    id="new-user-role"
                    value={newUser.role}
                    onChange={e => setNewUser(p => ({ ...p, role: e.target.value }))}
                    className={`w-full bg-white border border-border-slate rounded-lg px-3 py-2 text-[14px] text-on-surface focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 ${FOCUS_RING}`}
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
                  className={`bg-primary text-white rounded-lg hover:bg-primary-container px-4 py-2 font-medium text-[14px] transition-colors disabled:opacity-60 ${FOCUS_RING}`}>
                  {userLoading ? 'Creating…' : 'Create User'}
                </button>
                <button type="button" onClick={() => setAddOpen(false)}
                  className={`bg-white border border-border-slate text-on-surface-variant hover:bg-surface-container px-4 py-2 rounded-lg font-medium text-[14px] transition-colors ${FOCUS_RING}`}>
                  Cancel
                </button>
              </div>
            </form>
          )}
        </Section>
      )}

      {/* ── Projects ─────────────────────────────────────────────────── */}
      {isAdmin && (
        <Section title="Projects" icon={FolderOpen}>
          <div className="space-y-2">
            {projects.length === 0 && (
              <p className="text-[13px] text-on-surface-variant">No projects yet.</p>
            )}
            {projects.map(p => (
              <div key={p.id} className="flex items-center gap-3 px-4 py-3 rounded-xl border border-border-slate bg-white hover:bg-surface-container-low transition-colors">
                <span className="font-mono text-[12px] font-bold text-primary bg-primary/10 px-2 py-0.5 rounded shrink-0">{p.code}</span>
                <span className="flex-1 text-[13px] text-on-surface truncate">{p.name}</span>
                {!!p.slackConfigured && (
                  <span className="hidden sm:inline-flex items-center gap-1 text-[11px] font-medium text-status-emerald-text bg-status-emerald-bg px-2 py-0.5 rounded-full shrink-0">
                    <CheckCircle2 size={12} />
                    Slack
                  </span>
                )}
                <button
                  onClick={() => openSlackEditor(p)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border-slate text-[12px] font-medium text-on-surface-variant hover:bg-surface-container hover:text-on-surface transition-colors shrink-0 ${FOCUS_RING}`}
                  aria-label={`Configure Slack notifications for ${p.code}`}
                  title="Configure Slack notifications"
                >
                  <MessageSquare size={14} />
                  <span className="hidden sm:inline">Slack</span>
                </button>
                <button
                  onClick={() => { setRenamingProject(p); setRenameForm({ name: p.name, code: p.code }); setRenameMsg(null); }}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border-slate text-[12px] font-medium text-on-surface-variant hover:bg-surface-container hover:text-on-surface transition-colors shrink-0 ${FOCUS_RING}`}
                  aria-label={`Rename project ${p.code}`}
                >
                  <Pencil size={14} />
                  <span className="hidden sm:inline">Rename</span>
                </button>
              </div>
            ))}
          </div>
        </Section>
      )}

      {/* ── Rename project modal ─────────────────────────────────────── */}
      {renamingProject && createPortal(
        <div className="modal-scrim fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-[rgba(15,23,42,0.45)] backdrop-blur-sm" onClick={() => setRenamingProject(null)}>
          <div
            ref={renameModalRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="rename-modal-title"
            onClick={(e) => e.stopPropagation()}
            className="modal-card bg-white rounded-2xl shadow-xl border border-border-slate w-full max-w-sm overflow-hidden"
          >
            <div className="px-6 py-4 border-b border-border-slate flex items-center justify-between">
              <h2 id="rename-modal-title" className="text-[15px] font-semibold text-on-surface">Rename Project</h2>
              <button onClick={() => setRenamingProject(null)} aria-label="Close" className={`text-on-surface-variant hover:text-on-surface transition p-1.5 rounded-lg hover:bg-surface-container ${FOCUS_RING}`}>
                <X size={16} />
              </button>
            </div>
            <form onSubmit={handleRenameProject} className="px-6 py-5 space-y-4">
              {renameMsg && (
                <div role="alert" aria-live="polite" className={`text-[13px] p-3 rounded-lg border ${bannerClass(renameMsg.type)}`}>{renameMsg.text}</div>
              )}
              <div>
                <label htmlFor="rename-code" className="block text-[12px] text-on-surface-variant mb-1.5 font-medium">Project Code</label>
                <input
                  id="rename-code"
                  value={renameForm.code}
                  onChange={e => setRenameForm(f => ({ ...f, code: e.target.value.toUpperCase() }))}
                  maxLength={10}
                  required
                  className="w-full bg-white border border-border-slate rounded-lg px-3 py-2 text-[14px] font-mono text-on-surface focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus:border-primary"
                />
              </div>
              <div>
                <label htmlFor="rename-name" className="block text-[12px] text-on-surface-variant mb-1.5 font-medium">Project Name</label>
                <input
                  id="rename-name"
                  value={renameForm.name}
                  onChange={e => setRenameForm(f => ({ ...f, name: e.target.value }))}
                  required
                  className="w-full bg-white border border-border-slate rounded-lg px-3 py-2 text-[14px] text-on-surface focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus:border-primary"
                />
              </div>
              <div className="flex gap-2 justify-end pt-1">
                <button type="button" onClick={() => setRenamingProject(null)}
                  className={`px-4 py-2 rounded-lg border border-border-slate text-on-surface-variant hover:bg-surface-container font-medium text-[13px] transition-colors ${FOCUS_RING}`}>
                  Cancel
                </button>
                <button type="submit" disabled={renameLoading}
                  className={`px-4 py-2 rounded-lg bg-primary text-white hover:bg-primary-container font-medium text-[13px] transition-colors disabled:opacity-60 ${FOCUS_RING}`}>
                  {renameLoading ? 'Saving…' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

      {/* ── Slack webhook modal ──────────────────────────────────────── */}
      {slackProject && createPortal(
        <div className="modal-scrim fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-[rgba(15,23,42,0.45)] backdrop-blur-sm" onClick={() => setSlackProject(null)}>
          <div
            ref={slackModalRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="slack-modal-title"
            onClick={(e) => e.stopPropagation()}
            className="modal-card bg-white rounded-2xl shadow-xl border border-border-slate w-full max-w-md overflow-hidden"
          >
            <div className="px-6 py-4 border-b border-border-slate flex items-center justify-between">
              <h2 id="slack-modal-title" className="text-[15px] font-semibold text-on-surface">
                Slack Notifications — <span className="font-mono text-primary">{slackProject.code}</span>
              </h2>
              <button onClick={() => setSlackProject(null)} aria-label="Close" className={`text-on-surface-variant hover:text-on-surface transition p-1.5 rounded-lg hover:bg-surface-container ${FOCUS_RING}`}>
                <X size={16} />
              </button>
            </div>
            <form onSubmit={handleSaveSlack} className="px-6 py-5 space-y-4">
              {slackMsg && (
                <div role="alert" aria-live="polite" className={`text-[13px] p-3 rounded-lg border ${bannerClass(slackMsg.type)}`}>{slackMsg.text}</div>
              )}
              <p className="text-[12px] text-on-surface-variant leading-relaxed">
                Post transmittal, new-drawing, and revision events to a Slack channel. Create an{' '}
                <span className="font-medium text-on-surface">Incoming Webhook</span> in Slack and paste the URL below.
                {slackProject.slackConfigured && (
                  <span className="flex items-start gap-1 mt-1.5 text-status-emerald-text font-medium">
                    <CheckCircle2 size={14} className="shrink-0 mt-px" />
                    <span>A webhook is currently configured. Leave blank to keep it, or paste a new one to replace it.</span>
                  </span>
                )}
              </p>
              <div>
                <label htmlFor="slack-webhook-url" className="block text-[12px] text-on-surface-variant mb-1.5 font-medium">Webhook URL</label>
                <input
                  id="slack-webhook-url"
                  value={slackUrl}
                  onChange={e => setSlackUrl(e.target.value)}
                  placeholder="https://hooks.slack.com/services/..."
                  autoComplete="off"
                  className="w-full bg-white border border-border-slate rounded-lg px-3 py-2 text-[13px] font-mono text-on-surface focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus:border-primary"
                />
              </div>
              <div className="flex flex-wrap gap-2 justify-between items-center pt-1">
                <div className="flex gap-2">
                  {slackProject.slackConfigured && (
                    <button type="button" onClick={handleTestSlack} disabled={slackLoading}
                      className={`px-3 py-2 rounded-lg border border-border-slate text-on-surface-variant hover:bg-surface-container font-medium text-[13px] transition-colors disabled:opacity-60 ${FOCUS_RING}`}>
                      Send Test
                    </button>
                  )}
                  {slackProject.slackConfigured && (
                    <button type="button" onClick={() => setConfirmAction({ type: 'slack-disconnect', project: slackProject })} disabled={slackLoading}
                      className={`px-3 py-2 rounded-lg border border-status-rose-text/30 text-status-rose-text hover:bg-status-rose-bg font-medium text-[13px] transition-colors disabled:opacity-60 ${FOCUS_RING}`}>
                      Disconnect
                    </button>
                  )}
                </div>
                <div className="flex gap-2">
                  <button type="button" onClick={() => setSlackProject(null)}
                    className={`px-4 py-2 rounded-lg border border-border-slate text-on-surface-variant hover:bg-surface-container font-medium text-[13px] transition-colors ${FOCUS_RING}`}>
                    Cancel
                  </button>
                  <button type="submit" disabled={slackLoading || !slackUrl.trim()}
                    className={`px-4 py-2 rounded-lg bg-primary text-white hover:bg-primary-container font-medium text-[13px] transition-colors disabled:opacity-60 ${FOCUS_RING}`}>
                    {slackLoading ? 'Saving…' : 'Save'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

      {/* ── Confirmation modal for deactivate / remove / slack-disconnect ── */}
      {confirmAction && (() => {
        const isDanger = confirmAction.type === 'remove' || confirmAction.type === 'slack-disconnect';
        const cfg = {
          remove: {
            icon: Trash2, title: 'Remove User',
            subject: `${confirmAction.user?.name} (@${confirmAction.user?.username})`,
            body: 'This will permanently delete this user account. This action cannot be undone.',
            confirmLabel: 'Remove Permanently',
            onConfirm: () => handleRemove(confirmAction.user),
          },
          deactivate: {
            icon: UserX, title: 'Deactivate User',
            subject: `${confirmAction.user?.name} (@${confirmAction.user?.username})`,
            body: 'This user will be unable to log in until reactivated. Their data will be preserved.',
            confirmLabel: 'Deactivate',
            onConfirm: () => handleDeactivate(confirmAction.user),
          },
          'slack-disconnect': {
            icon: Unplug, title: 'Disconnect Slack',
            subject: confirmAction.project?.code,
            body: 'This removes the saved webhook. Slack notifications will stop until you reconnect.',
            confirmLabel: 'Disconnect',
            onConfirm: () => saveSlackUrl(''),
          },
        }[confirmAction.type];
        const Icon = cfg.icon;
        return createPortal(
          <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4">
            <div className="modal-scrim absolute inset-0 bg-[rgba(15,23,42,0.45)] backdrop-blur-sm" onClick={() => setConfirmAction(null)} />
            <div
              ref={confirmModalRef}
              role="dialog"
              aria-modal="true"
              aria-labelledby="confirm-modal-title"
              className="modal-card relative bg-white rounded-2xl shadow-2xl border border-border-slate p-6 w-full max-w-sm"
            >
              <div className="flex items-center gap-3 mb-4">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center ${isDanger ? 'bg-status-rose-bg' : 'bg-status-amber-bg'}`}>
                  <Icon size={18} className={isDanger ? 'text-status-rose-text' : 'text-status-amber-text'} />
                </div>
                <div>
                  <h3 id="confirm-modal-title" className="text-[16px] font-semibold text-on-surface">{cfg.title}</h3>
                  <p className="text-[12px] text-on-surface-variant">{cfg.subject}</p>
                </div>
              </div>
              <p className="text-[13px] text-on-surface-variant mb-5">{cfg.body}</p>
              <div className="flex gap-2 justify-end">
                <button
                  onClick={() => setConfirmAction(null)}
                  className={`px-4 py-2 rounded-lg border border-border-slate text-on-surface-variant hover:bg-surface-container font-medium text-[13px] transition-colors ${FOCUS_RING}`}
                >
                  Cancel
                </button>
                <button
                  onClick={() => { setConfirmAction(null); cfg.onConfirm(); }}
                  className={`px-4 py-2 rounded-lg text-white font-medium text-[13px] transition-colors ${FOCUS_RING} ${
                    isDanger ? 'bg-status-rose-text hover:bg-status-rose-text/90' : 'bg-status-amber-text hover:bg-status-amber-text/90'
                  }`}
                >
                  {cfg.confirmLabel}
                </button>
              </div>
            </div>
          </div>,
          document.body
        );
      })()}
    </div>
  );
}

/* ── Layout helpers ───────────────────────────────────────────────── */

function Section({ title, icon: Icon, children, headerAction }) {
  return (
    <div className="bg-white border border-border-slate rounded-xl p-6">
      <div className="flex items-center justify-between gap-2 mb-5">
        <div className="flex items-center gap-2">
          {Icon && <Icon size={20} className="text-primary shrink-0" />}
          <h2 className="text-[18px] font-semibold text-on-surface">{title}</h2>
        </div>
        {headerAction}
      </div>
      {children}
    </div>
  );
}

function Field({ label, type = 'text', value, onChange, autoComplete, required }) {
  const id = useId();
  const isPassword = type === 'password';
  const [show, setShow] = useState(false);
  const inputType = isPassword && show ? 'text' : type;
  return (
    <div>
      <label htmlFor={id} className="block text-[12px] text-on-surface-variant mb-1.5 font-medium">
        {label}{required && <span className="text-status-rose-text ml-0.5" aria-hidden="true">*</span>}
      </label>
      <div className="relative">
        <input
          id={id}
          type={inputType}
          value={value}
          onChange={e => onChange(e.target.value)}
          autoComplete={autoComplete}
          required={required}
          className={`w-full bg-white border border-border-slate rounded-lg px-3 py-2 ${isPassword ? 'pr-10' : ''} text-[14px] text-on-surface focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus:border-primary transition-all`}
        />
        {isPassword && (
          <button
            type="button"
            onClick={() => setShow(s => !s)}
            aria-label={show ? 'Hide password' : 'Show password'}
            className={`absolute right-1.5 top-1/2 -translate-y-1/2 p-1.5 text-on-surface-variant hover:text-on-surface rounded-md ${FOCUS_RING}`}
          >
            {show ? <EyeOff size={16} /> : <Eye size={16} />}
          </button>
        )}
      </div>
    </div>
  );
}
