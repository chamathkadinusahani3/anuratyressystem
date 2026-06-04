import { useState, useEffect, useCallback, type ReactNode } from 'react';
import {
  Plus, Pencil, Trash, User, X, Check, Key, Shield, AlertTriangle,
  Search, RefreshCw, Loader2, Copy, ChevronUp, ChevronDown,
  ChevronsUpDown, UserPlus, Clock, LogIn, Users,
} from 'lucide-react';
import { collection, getDocs, doc, setDoc, deleteDoc, updateDoc } from 'firebase/firestore';
import { db } from '../lib/firebase.ts';
import { getSessionUser } from '../lib/auth';

// ─── Constants ────────────────────────────────────────────────────────────────
const AVAILABLE_ROLES  = ['Super Admin', 'Admin', 'Manager', 'Cashier'];
const ALL_BRANCH_ROLES = ['Super Admin', 'Admin'];
const BRANCH_OPTIONS   = ['All Branches', 'Pannipitiya', 'Ratnapura', 'Kalawana', 'Nivithigala'];

const ROLE_DESCRIPTIONS: Record<string, string> = {
  'Super Admin': 'Full system access including user management — sees all branches',
  'Admin':       'Access to all features except user management — sees all branches',
  'Manager':     'Manage bookings, staff, and inventory — branch restricted',
  'Cashier':     'Manage bookings and payments only — branch restricted',
};

const ROLE_COLORS: Record<string, string> = {
  'Super Admin': 'bg-purple-500/20 text-purple-400 border-purple-500/30',
  'Admin':       'bg-red-500/20    text-red-400    border-red-500/30',
  'Manager':     'bg-blue-500/20   text-blue-400   border-blue-500/30',
  'Cashier':     'bg-green-500/20  text-green-400  border-green-500/30',
};

const generateTempPassword = () => Math.random().toString(36).slice(-8).toUpperCase();

// ─── Types ────────────────────────────────────────────────────────────────────
interface UserType {
  username:          string;
  name:              string;
  role:              string;
  branch:            string;
  password:          string;
  createdAt?:        string;
  lastLogin?:        string | null;
  updatedAt?:        string;
  updatedBy?:        string;
  mustChangePassword?: boolean;
}

type SortCol = 'username' | 'name' | 'role' | 'branch' | 'lastLogin';

// ─── Firestore helpers ────────────────────────────────────────────────────────
const USERS_COLLECTION = 'at_users';

async function fetchAllUsers(): Promise<UserType[]> {
  const snapshot = await getDocs(collection(db, USERS_COLLECTION));
  return snapshot.docs.map(d => d.data() as UserType);
}
async function createUser(user: UserType) { await setDoc(doc(db, USERS_COLLECTION, user.username), user); }
async function saveUser  (user: UserType) { await updateDoc(doc(db, USERS_COLLECTION, user.username), { ...user }); }
async function removeUser(username: string) { await deleteDoc(doc(db, USERS_COLLECTION, username)); }

// ─── Helpers ──────────────────────────────────────────────────────────────────
function timeAgo(iso: string | null | undefined): string {
  if (!iso) return 'Never';
  const secs = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (secs < 60)     return 'Just now';
  if (secs < 3600)   return `${Math.floor(secs / 60)}m ago`;
  if (secs < 86400)  return `${Math.floor(secs / 3600)}h ago`;
  if (secs < 604800) return `${Math.floor(secs / 86400)}d ago`;
  return new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
}

function useCopy() {
  const [copied, setCopied] = useState('');
  const copy = (text: string, label: string) => {
    navigator.clipboard.writeText(text).catch(() => {});
    setCopied(label);
    setTimeout(() => setCopied(''), 1800);
  };
  return { copy, copied };
}

// ─── Toast ────────────────────────────────────────────────────────────────────
function Toast({ message, type = 'success', onClose }: { message: string; type?: string; onClose: () => void }) {
  useEffect(() => { const t = setTimeout(onClose, 3500); return () => clearTimeout(t); }, [onClose]);
  const colors = type === 'error' ? 'bg-red-900 border-red-700 text-red-200'
    : type === 'info'  ? 'bg-blue-900 border-blue-700 text-blue-200'
    : 'bg-green-900 border-green-700 text-green-200';
  return (
    <div className={`fixed bottom-4 right-4 z-[100] px-4 py-3 rounded-xl border text-sm font-medium shadow-2xl flex items-center gap-3 max-w-sm ${colors}`}>
      {type === 'error' ? <AlertTriangle className="w-4 h-4 flex-shrink-0" /> : <Check className="w-4 h-4 flex-shrink-0" />}
      {message}
      <button onClick={onClose} className="ml-auto opacity-70 hover:opacity-100"><X className="w-3.5 h-3.5" /></button>
    </div>
  );
}

// ─── Confirm Dialog ───────────────────────────────────────────────────────────
function ConfirmDialog({ title, message, confirmLabel = 'Delete', confirmClass = 'bg-red-600 hover:bg-red-500', onConfirm, onCancel }: {
  title?: string; message: string; confirmLabel?: string; confirmClass?: string; onConfirm: () => void; onCancel: () => void;
}) {
  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-[60] p-4 backdrop-blur-sm">
      <div className="bg-neutral-900 rounded-xl border border-neutral-700 w-full max-w-sm shadow-2xl p-6">
        <div className="flex items-start gap-3 mb-5">
          <AlertTriangle className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
          <div>
            {title && <p className="text-sm font-bold text-white mb-1">{title}</p>}
            <p className="text-sm text-neutral-300">{message}</p>
          </div>
        </div>
        <div className="flex gap-3">
          <button onClick={onCancel} className="flex-1 px-4 py-2.5 border border-neutral-700 rounded-lg text-neutral-300 text-sm font-medium hover:bg-neutral-800 transition-colors">Cancel</button>
          <button onClick={onConfirm} className={`flex-1 px-4 py-2.5 rounded-lg text-white text-sm font-bold transition-colors ${confirmClass}`}>{confirmLabel}</button>
        </div>
      </div>
    </div>
  );
}

// ─── Role badge with tooltip ──────────────────────────────────────────────────
function RoleBadge({ role }: { role: string }) {
  return (
    <div className="relative group inline-flex">
      <span className={`px-2 py-1 rounded-full text-xs font-medium border whitespace-nowrap cursor-help select-none ${ROLE_COLORS[role]}`}>
        {role}
      </span>
      <div className="absolute bottom-full left-0 mb-2 w-64 px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-xs text-neutral-300 invisible group-hover:visible opacity-0 group-hover:opacity-100 transition-all z-30 pointer-events-none shadow-xl">
        <p className="font-semibold text-white mb-0.5">{role}</p>
        {ROLE_DESCRIPTIONS[role]}
        <div className="absolute top-full left-4 w-2 h-2 bg-neutral-800 border-b border-r border-neutral-700 rotate-45 -translate-y-1" />
      </div>
    </div>
  );
}

// ─── Sort header ──────────────────────────────────────────────────────────────
function SortTh({ col, sortCol, sortDir, onSort, children, right = false }: {
  col: SortCol; sortCol: SortCol; sortDir: 'asc' | 'desc'; onSort: (c: SortCol) => void; children: ReactNode; right?: boolean;
}) {
  const active = sortCol === col;
  return (
    <th onClick={() => onSort(col)} className={`px-3 md:px-5 py-3.5 font-bold text-xs uppercase tracking-wider cursor-pointer select-none whitespace-nowrap transition-colors ${active ? 'text-[#FFD700]' : 'text-neutral-500 hover:text-neutral-300'} ${right ? 'text-right' : 'text-left'}`}>
      <span className="inline-flex items-center gap-1">
        {children}
        {active
          ? sortDir === 'asc' ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />
          : <ChevronsUpDown className="w-3 h-3 opacity-30" />
        }
      </span>
    </th>
  );
}

// ─── User Form Fields ─────────────────────────────────────────────────────────
function UserFormFields({
  user, onChange, isEdit = false, originalRole = '',
}: {
  user: UserType; onChange: (u: UserType) => void; isEdit?: boolean; originalRole?: string;
}) {
  const handleRoleChange = (role: string) => {
    onChange({
      ...user,
      role,
      branch: ALL_BRANCH_ROLES.includes(role)
        ? 'All Branches'
        : user.branch === 'All Branches' ? 'Pannipitiya' : user.branch,
    });
  };

  const ic = "w-full px-3 py-2.5 bg-neutral-800 border border-neutral-700 rounded-lg text-white text-sm focus:outline-none focus:border-[#FFD700] transition-colors placeholder:text-neutral-600";
  const isDemotingAdmin = isEdit && ALL_BRANCH_ROLES.includes(originalRole) && !ALL_BRANCH_ROLES.includes(user.role);

  return (
    <div className="space-y-4">
      {/* Username */}
      <div>
        <label className="text-sm font-medium text-white block mb-1.5">Username {!isEdit && '*'}</label>
        <input type="text" value={user.username}
          onChange={e => !isEdit && onChange({ ...user, username: e.target.value })}
          disabled={isEdit} placeholder="e.g. jdoe"
          className={`${ic} ${isEdit ? 'opacity-50 cursor-not-allowed' : ''}`} />
        <p className="text-xs text-neutral-500 mt-1">{isEdit ? 'Username cannot be changed' : 'Letters, numbers, and underscores only'}</p>
      </div>

      {/* Full name */}
      <div>
        <label className="text-sm font-medium text-white block mb-1.5">Full Name *</label>
        <input type="text" value={user.name} onChange={e => onChange({ ...user, name: e.target.value })}
          placeholder="e.g. John Doe" className={ic} />
      </div>

      {/* Password */}
      <div>
        <label className="text-sm font-medium text-white block mb-1.5">
          {isEdit ? 'Password (leave blank to keep current)' : 'Password *'}
        </label>
        <input type="password" value={user.password}
          onChange={e => onChange({ ...user, password: e.target.value })}
          placeholder={isEdit ? 'Enter new password to change' : 'Enter password'}
          className={ic} />
      </div>

      {/* Role */}
      <div>
        <label className="text-sm font-medium text-white block mb-1.5">Role *</label>
        <select value={user.role} onChange={e => handleRoleChange(e.target.value)} className={ic}>
          {AVAILABLE_ROLES.map(r => <option key={r} value={r}>{r}</option>)}
        </select>
        <p className="text-xs text-neutral-500 mt-1">{ROLE_DESCRIPTIONS[user.role]}</p>
        {isDemotingAdmin && (
          <div className="mt-2 flex items-start gap-2 px-3 py-2 bg-amber-500/10 border border-amber-500/30 rounded-lg">
            <AlertTriangle className="w-3.5 h-3.5 text-amber-400 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-amber-400">This will remove <strong>all-branch access</strong> from this user — they will be restricted to a single branch.</p>
          </div>
        )}
      </div>

      {/* Branch */}
      {!ALL_BRANCH_ROLES.includes(user.role) ? (
        <div>
          <label className="text-sm font-medium text-white block mb-1.5">Branch Access *</label>
          <select value={user.branch} onChange={e => onChange({ ...user, branch: e.target.value })} className={ic}>
            {BRANCH_OPTIONS.filter(b => b !== 'All Branches').map(b => <option key={b} value={b}>{b}</option>)}
          </select>
          <p className="text-xs text-orange-400 mt-1 flex items-center gap-1">
            <AlertTriangle className="w-3 h-3" /> This user will only see data from the selected branch
          </p>
        </div>
      ) : (
        <div className="p-3 bg-neutral-800 border border-neutral-700 rounded-lg">
          <p className="text-xs text-neutral-400 flex items-center gap-1.5">
            <Shield className="w-3.5 h-3.5 text-[#FFD700]" />
            This role has access to <span className="text-white font-medium">all branches</span>
          </p>
        </div>
      )}

      {/* Force password change */}
      <label className="flex items-center gap-3 cursor-pointer px-3 py-2.5 bg-neutral-800/60 border border-neutral-700 rounded-lg hover:border-neutral-600 transition-colors">
        <input type="checkbox" checked={!!user.mustChangePassword}
          onChange={e => onChange({ ...user, mustChangePassword: e.target.checked })}
          className="w-4 h-4 accent-[#FFD700]" />
        <div>
          <p className="text-sm text-neutral-300 font-medium">Force password change on next login</p>
          <p className="text-xs text-neutral-500">User will be prompted immediately after signing in</p>
        </div>
      </label>

      {/* Audit info */}
      {isEdit && (user.updatedAt || user.createdAt) && (
        <div className="text-xs text-neutral-600 border-t border-neutral-800 pt-3 space-y-1">
          {user.updatedAt && <p>Last modified by <span className="text-neutral-400">{user.updatedBy || 'unknown'}</span> · {timeAgo(user.updatedAt)}</p>}
          {user.createdAt && <p>Created · {new Date(user.createdAt).toLocaleDateString('en-GB', { day:'2-digit', month:'short', year:'numeric' })}</p>}
        </div>
      )}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
const EMPTY_USER = (): UserType => ({ username:'', name:'', role:'Cashier', branch:'Pannipitiya', password:'' });

export function UserManagement() {
  const session         = getSessionUser();
  const currentUsername = session?.username ?? '';

  const [users,           setUsers]          = useState<UserType[]>([]);
  const [loading,         setLoading]        = useState(true);
  const [saving,          setSaving]         = useState(false);
  const [search,          setSearch]         = useState('');
  const [roleFilter,      setRoleFilter]     = useState('all');
  const [branchFilter,    setBranchFilter]   = useState('all');
  const [sortCol,         setSortCol]        = useState<SortCol>('name');
  const [sortDir,         setSortDir]        = useState<'asc'|'desc'>('asc');
  const [selected,        setSelected]       = useState<Set<string>>(new Set());
  const [bulkRole,        setBulkRole]       = useState('');
  const [editingUser,     setEditingUser]    = useState<UserType | null>(null);
  const [editOriginal,    setEditOriginal]   = useState<UserType | null>(null);
  const [showUnsaved,     setShowUnsaved]    = useState(false);
  const [showAdd,         setShowAdd]        = useState(false);
  const [newUser,         setNewUser]        = useState<UserType>(EMPTY_USER());
  const [passModal,       setPassModal]      = useState<{username:string;password:string}|null>(null);
  const [confirmDelete,   setConfirmDelete]  = useState<string|null>(null);
  const [confirmBulkDel,  setConfirmBulkDel]= useState(false);
  const [roleWarn,        setRoleWarn]       = useState<UserType|null>(null);
  const [toast,           setToast]          = useState<{message:string;type:string}|null>(null);
  const { copy, copied }  = useCopy();

  const showToast = useCallback((msg: string, type = 'success') => setToast({message:msg, type}), []);

  // ── Load ────────────────────────────────────────────────────────────────────
  const loadUsers = useCallback(async () => {
    setLoading(true);
    try { setUsers(await fetchAllUsers()); }
    catch { showToast('Failed to load users', 'error'); }
    finally { setLoading(false); }
  }, [showToast]);

  useEffect(() => { loadUsers(); }, [loadUsers]);

  // ── Sort toggle ────────────────────────────────────────────────────────────
  const toggleSort = (col: SortCol) => {
    if (sortCol === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortCol(col); setSortDir('asc'); }
  };

  // ── Filter + Sort ──────────────────────────────────────────────────────────
  const filtered = users.filter(u => {
    const s = search.toLowerCase();
    const matchSearch  = !s || u.username.toLowerCase().includes(s) || u.name.toLowerCase().includes(s);
    const matchRole    = roleFilter === 'all'   || u.role === roleFilter;
    const matchBranch  = branchFilter === 'all' || u.branch === branchFilter;
    return matchSearch && matchRole && matchBranch;
  });

  const sorted = [...filtered].sort((a, b) => {
    const m = sortDir === 'asc' ? 1 : -1;
    if (sortCol === 'lastLogin') {
      return ((a.lastLogin ? new Date(a.lastLogin).getTime() : 0) - (b.lastLogin ? new Date(b.lastLogin).getTime() : 0)) * m;
    }
    return ((a[sortCol] || '') < (b[sortCol] || '') ? -1 : 1) * m;
  });

  // ── Bulk selection ─────────────────────────────────────────────────────────
  const allSelected  = sorted.length > 0 && sorted.every(u => selected.has(u.username));
  const someSelected = selected.size > 0 && !allSelected;

  const toggleSelect  = (u: string) => setSelected(prev => { const n = new Set(prev); n.has(u) ? n.delete(u) : n.add(u); return n; });
  const toggleAll     = () => setSelected(allSelected ? new Set() : new Set(sorted.map(u => u.username)));
  const clearSelected = () => setSelected(new Set());

  // ── Add user ───────────────────────────────────────────────────────────────
  const handleAddUser = async () => {
    const u = newUser;
    if (!u.username.trim())             return showToast('Username is required', 'error');
    if (!u.name.trim())                 return showToast('Full name is required', 'error');
    if (!u.password.trim())             return showToast('Password is required', 'error');
    if (!/^[a-zA-Z0-9_]+$/.test(u.username)) return showToast('Username: letters, numbers, underscores only', 'error');
    if (users.some(x => x.username.toLowerCase() === u.username.toLowerCase()))
      return showToast('Username already exists', 'error');

    setSaving(true);
    try {
      const user: UserType = {
        ...u,
        branch:    ALL_BRANCH_ROLES.includes(u.role) ? 'All Branches' : (u.branch || 'Pannipitiya'),
        createdAt: new Date().toISOString(),
        lastLogin: null,
      };
      await createUser(user);
      setUsers(p => [...p, user]);
      setNewUser(EMPTY_USER());
      setShowAdd(false);
      showToast(`User "${user.username}" created`);
    } catch { showToast('Failed to create user', 'error'); }
    finally { setSaving(false); }
  };

  // ── Edit user ──────────────────────────────────────────────────────────────
  const openEdit = (u: UserType) => {
    const draft = { ...u, password: '' };
    setEditingUser(draft);
    setEditOriginal(draft);
  };

  const editChanged = editingUser && editOriginal
    ? JSON.stringify({ ...editingUser,  password: '' }) !== JSON.stringify({ ...editOriginal, password: '' })
    : false;

  const tryCloseEdit = () => {
    if (editChanged) setShowUnsaved(true);
    else             { setEditingUser(null); setEditOriginal(null); }
  };

  const handleUpdateUser = async () => {
    if (!editingUser) return;
    if (!editingUser.name.trim()) return showToast('Full name is required', 'error');

    // Warn if demoting from admin
    const orig = users.find(u => u.username === editingUser.username);
    if (orig && ALL_BRANCH_ROLES.includes(orig.role) && !ALL_BRANCH_ROLES.includes(editingUser.role)) {
      setRoleWarn(editingUser);
      return;
    }
    await doUpdateUser(editingUser);
  };

  const doUpdateUser = async (target: UserType) => {
    setSaving(true);
    try {
      const orig    = users.find(u => u.username === target.username);
      const updated: UserType = {
        ...target,
        branch:    ALL_BRANCH_ROLES.includes(target.role) ? 'All Branches' : (target.branch || 'Pannipitiya'),
        password:  target.password.trim() ? target.password : (orig?.password ?? ''),
        updatedAt: new Date().toISOString(),
        updatedBy: currentUsername || 'unknown',
      };
      await saveUser(updated);
      setUsers(p => p.map(u => u.username === updated.username ? updated : u));
      setEditingUser(null);
      setEditOriginal(null);
      setRoleWarn(null);
      showToast('User updated');
    } catch { showToast('Failed to update user', 'error'); }
    finally { setSaving(false); }
  };

  // ── Delete ─────────────────────────────────────────────────────────────────
  const handleDelete = async (username: string) => {
    setConfirmDelete(null);
    setSaving(true);
    try {
      await removeUser(username);
      setUsers(p => p.filter(u => u.username !== username));
      setSelected(p => { const n = new Set(p); n.delete(username); return n; });
      showToast(`Deleted "${username}"`);
    } catch { showToast('Failed to delete user', 'error'); }
    finally { setSaving(false); }
  };

  // ── Bulk delete ────────────────────────────────────────────────────────────
  const handleBulkDelete = async () => {
    setConfirmBulkDel(false);
    setSaving(true);
    const usernames = [...selected];
    try {
      await Promise.all(usernames.map(removeUser));
      setUsers(p => p.filter(u => !selected.has(u.username)));
      clearSelected();
      showToast(`Deleted ${usernames.length} users`);
    } catch { showToast('Failed to delete some users', 'error'); }
    finally { setSaving(false); }
  };

  // ── Bulk role change ───────────────────────────────────────────────────────
  const handleBulkRoleChange = async () => {
    if (!bulkRole) return;
    setSaving(true);
    try {
      const branch = ALL_BRANCH_ROLES.includes(bulkRole) ? 'All Branches' : undefined;
      await Promise.all([...selected].map(async uname => {
        const u = users.find(x => x.username === uname);
        if (!u) return;
        const updated: UserType = {
          ...u,
          role:      bulkRole,
          branch:    branch ?? (u.branch === 'All Branches' ? 'Pannipitiya' : u.branch),
          updatedAt: new Date().toISOString(),
          updatedBy: currentUsername || 'unknown',
        };
        await saveUser(updated);
        return updated;
      }));
      await loadUsers();
      clearSelected();
      setBulkRole('');
      showToast(`Updated role for ${selected.size} users`);
    } catch { showToast('Bulk role change failed', 'error'); }
    finally { setSaving(false); }
  };

  // ── Reset password ─────────────────────────────────────────────────────────
  const handleReset = async (username: string) => {
    const pw = generateTempPassword();
    setSaving(true);
    try {
      await updateDoc(doc(db, USERS_COLLECTION, username), {
        password: pw, mustChangePassword: true,
        updatedAt: new Date().toISOString(), updatedBy: currentUsername || 'unknown',
      });
      setUsers(p => p.map(u => u.username === username ? { ...u, password: pw, mustChangePassword: true } : u));
      setPassModal({ username, password: pw });
    } catch { showToast('Failed to reset password', 'error'); }
    finally { setSaving(false); }
  };

  // ── Duplicate user ─────────────────────────────────────────────────────────
  const duplicateUser = (u: UserType) => {
    setNewUser({ ...EMPTY_USER(), role: u.role, branch: u.branch, name: `Copy of ${u.name}` });
    setShowAdd(true);
  };

  // ── Stats ──────────────────────────────────────────────────────────────────
  const stats = {
    total:      users.length,
    superAdmin: users.filter(u => u.role === 'Super Admin').length,
    admin:      users.filter(u => u.role === 'Admin').length,
    manager:    users.filter(u => u.role === 'Manager').length,
    cashier:    users.filter(u => u.role === 'Cashier').length,
  };

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-4 md:space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

      {/* ── Header ── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl md:text-3xl font-bold text-white mb-1 flex items-center gap-2">
            <Shield className="w-7 h-7 text-[#FFD700]" /> User Management
          </h2>
          <p className="text-neutral-400 text-sm">Manage system users and their branch access levels.</p>
        </div>
        <div className="flex gap-3 items-center">
          {saving && <div className="flex items-center gap-1.5 text-xs text-neutral-400"><Loader2 className="w-3.5 h-3.5 animate-spin" />Saving…</div>}
          <button onClick={loadUsers} disabled={loading}
            className="flex items-center gap-2 px-3 md:px-4 py-2 border border-neutral-700 rounded-lg text-neutral-300 text-sm hover:bg-neutral-800 hover:text-white transition-colors disabled:opacity-50">
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">Refresh</span>
          </button>
          <button onClick={() => { setNewUser(EMPTY_USER()); setShowAdd(true); }}
            className="flex items-center gap-2 px-3 md:px-4 py-2 bg-[#FFD700] rounded-lg text-black text-sm font-bold hover:bg-[#FFD700]/90 transition-colors">
            <Plus className="w-4 h-4" /> Add User
          </button>
        </div>
      </div>

      {/* ── Stats ── */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {[
          { label: 'Total Users',  value: stats.total,      color: 'text-white',        click: () => setRoleFilter('all') },
          { label: 'Super Admins', value: stats.superAdmin, color: 'text-purple-400',   click: () => setRoleFilter('Super Admin') },
          { label: 'Admins',       value: stats.admin,      color: 'text-red-400',      click: () => setRoleFilter('Admin') },
          { label: 'Managers',     value: stats.manager,    color: 'text-blue-400',     click: () => setRoleFilter('Manager') },
          { label: 'Cashiers',     value: stats.cashier,    color: 'text-green-400',    click: () => setRoleFilter('Cashier') },
        ].map(s => (
          <button key={s.label} onClick={s.click}
            className="bg-neutral-900 border border-neutral-800 rounded-xl p-3 md:p-4 text-left hover:border-neutral-700 transition-colors">
            <div className={`text-xl md:text-2xl font-bold ${s.color}`}>{loading ? '—' : s.value}</div>
            <div className="text-neutral-500 text-xs mt-0.5">{s.label}</div>
          </button>
        ))}
      </div>

      {/* ── Filters ── */}
      <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-3 md:p-4 space-y-3">
        <div className="flex flex-col md:flex-row gap-3">
          {/* Search */}
          <div className="relative flex-1 max-w-full md:max-w-sm">
            <Search className="absolute left-3 top-2.5 w-4 h-4 text-neutral-500" />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by name or username…"
              className="w-full pl-9 pr-8 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-white text-sm focus:outline-none focus:border-[#FFD700] placeholder:text-neutral-600 transition-colors" />
            {search && <button onClick={() => setSearch('')} className="absolute right-3 top-2.5 text-neutral-500 hover:text-white"><X className="w-3.5 h-3.5" /></button>}
          </div>
          {/* Role filter */}
          <div className="flex gap-2 flex-wrap">
            {(['all', ...AVAILABLE_ROLES]).map(r => (
              <button key={r} onClick={() => setRoleFilter(r)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap ${roleFilter === r ? 'bg-[#FFD700] text-black' : 'bg-neutral-800 text-neutral-400 hover:bg-neutral-700 hover:text-white border border-neutral-700'}`}>
                {r === 'all' ? 'All Roles' : r}
              </button>
            ))}
          </div>
        </div>

        {/* Branch filter */}
        <div className="flex gap-2 flex-wrap">
          <span className="text-xs text-neutral-600 self-center">Branch:</span>
          {(['all', ...BRANCH_OPTIONS]).map(b => (
            <button key={b} onClick={() => setBranchFilter(b)}
              className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors whitespace-nowrap ${branchFilter === b ? 'bg-[#FFD700]/20 text-[#FFD700] border border-[#FFD700]/40' : 'bg-neutral-800/50 text-neutral-500 hover:text-neutral-300 border border-neutral-800'}`}>
              {b === 'all' ? 'All' : b}
            </button>
          ))}
        </div>
      </div>

      {/* ── Bulk action bar ── */}
      {selected.size > 0 && (
        <div className="flex items-center gap-3 px-4 py-3 bg-[#FFD700]/10 border border-[#FFD700]/30 rounded-xl">
          <span className="text-[#FFD700] text-sm font-semibold">{selected.size} selected</span>
          <div className="flex items-center gap-2 flex-1 flex-wrap">
            <select value={bulkRole} onChange={e => setBulkRole(e.target.value)}
              className="px-3 py-1.5 bg-neutral-800 border border-neutral-700 rounded-lg text-white text-xs focus:outline-none focus:border-[#FFD700]">
              <option value="">Change role to…</option>
              {AVAILABLE_ROLES.map(r => <option key={r} value={r}>{r}</option>)}
            </select>
            {bulkRole && (
              <button onClick={handleBulkRoleChange} disabled={saving}
                className="px-3 py-1.5 bg-blue-600 rounded-lg text-white text-xs font-semibold hover:bg-blue-500 disabled:opacity-50 transition-colors">
                Apply
              </button>
            )}
            <button onClick={() => setConfirmBulkDel(true)} disabled={saving}
              className="px-3 py-1.5 bg-red-500/20 border border-red-500/30 rounded-lg text-red-400 text-xs font-semibold hover:bg-red-500/30 disabled:opacity-50 transition-colors flex items-center gap-1.5">
              <Trash className="w-3 h-3" /> Delete {selected.size}
            </button>
          </div>
          <button onClick={clearSelected} className="text-neutral-500 hover:text-white transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* ── Table ── */}
      <div className="bg-neutral-900 border border-neutral-800 rounded-xl overflow-hidden">
        {loading ? (
          <div className="py-20 flex flex-col items-center gap-3 text-neutral-500">
            <Loader2 className="w-8 h-8 animate-spin text-[#FFD700]" />
            <span className="text-sm">Loading users…</span>
          </div>
        ) : sorted.length === 0 ? (
          <div className="py-16 text-center space-y-3">
            <Users className="w-12 h-12 text-neutral-700 mx-auto" />
            <p className="text-neutral-500 text-sm">
              {search || roleFilter !== 'all' || branchFilter !== 'all'
                ? 'No users match these filters'
                : 'No users yet'}
            </p>
            {!search && roleFilter !== 'all' && (
              <button onClick={() => {
                setNewUser({ ...EMPTY_USER(), role: roleFilter, branch: roleFilter === 'Manager' ? 'Pannipitiya' : EMPTY_USER().branch });
                setShowAdd(true);
              }} className="text-[#FFD700] text-sm hover:underline">
                Add first {roleFilter} →
              </button>
            )}
            {!search && roleFilter === 'all' && branchFilter === 'all' && (
              <button onClick={() => setShowAdd(true)} className="text-[#FFD700] text-sm hover:underline">Add your first user →</button>
            )}
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-neutral-950 border-b border-neutral-800">
                    {/* Checkbox */}
                    <th className="px-3 py-3.5 w-10">
                      <input type="checkbox" checked={allSelected} ref={r => { if(r) r.indeterminate = someSelected; }}
                        onChange={toggleAll} className="w-4 h-4 accent-[#FFD700]" />
                    </th>
                    <SortTh col="username" sortCol={sortCol} sortDir={sortDir} onSort={toggleSort}>Username</SortTh>
                    <SortTh col="name"     sortCol={sortCol} sortDir={sortDir} onSort={toggleSort}>Full Name</SortTh>
                    <SortTh col="role"     sortCol={sortCol} sortDir={sortDir} onSort={toggleSort}>Role</SortTh>
                    <SortTh col="branch"   sortCol={sortCol} sortDir={sortDir} onSort={toggleSort}>Branch</SortTh>
                    <SortTh col="lastLogin"sortCol={sortCol} sortDir={sortDir} onSort={toggleSort}>Last Login</SortTh>
                    <th className="px-3 py-3.5 text-right text-xs font-bold text-neutral-500 uppercase tracking-wider whitespace-nowrap">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-800">
                  {sorted.map(user => {
                    const isSelf    = user.username === currentUsername;
                    const isChosen  = selected.has(user.username);
                    return (
                      <tr key={user.username} className={`transition-colors ${isChosen ? 'bg-[#FFD700]/5' : 'hover:bg-neutral-800/50'}`}>
                        {/* Checkbox */}
                        <td className="px-3 py-3.5">
                          <input type="checkbox" checked={isChosen} onChange={() => toggleSelect(user.username)}
                            className="w-4 h-4 accent-[#FFD700]" disabled={isSelf} />
                        </td>
                        {/* Username + copy */}
                        <td className="px-3 md:px-4 py-3 md:py-3.5">
                          <div className="flex items-center gap-1.5">
                            <span className="font-mono text-white text-xs md:text-sm">{user.username}</span>
                            {isSelf && <span className="text-[9px] px-1.5 py-0.5 bg-[#FFD700]/20 text-[#FFD700] rounded-full font-bold border border-[#FFD700]/30">You</span>}
                            {user.mustChangePassword && <span className="text-[9px] px-1.5 py-0.5 bg-amber-500/20 text-amber-400 rounded-full font-bold border border-amber-500/30">⚠ pw change</span>}
                            <button onClick={() => copy(user.username, 'username')} title="Copy username"
                              className="text-neutral-700 hover:text-neutral-400 transition-colors opacity-0 group-hover:opacity-100">
                              <Copy className="w-3 h-3" />
                            </button>
                          </div>
                        </td>
                        {/* Name */}
                        <td className="px-3 md:px-4 py-3 md:py-3.5 text-white font-medium text-sm">{user.name}</td>
                        {/* Role with tooltip */}
                        <td className="px-3 md:px-4 py-3 md:py-3.5"><RoleBadge role={user.role} /></td>
                        {/* Branch */}
                        <td className="px-3 md:px-4 py-3 md:py-3.5">
                          {ALL_BRANCH_ROLES.includes(user.role)
                            ? <span className="px-2 py-1 rounded-full text-xs font-medium border bg-neutral-500/20 text-neutral-400 border-neutral-500/30 whitespace-nowrap">All Branches</span>
                            : <span className="px-2 py-1 rounded-full text-xs font-medium border bg-[#FFD700]/10 text-[#FFD700] border-[#FFD700]/30 whitespace-nowrap">{user.branch || 'Not set'}</span>
                          }
                        </td>
                        {/* Last login */}
                        <td className="px-3 md:px-4 py-3 md:py-3.5">
                          <div className="flex items-center gap-1.5 text-xs">
                            {user.lastLogin
                              ? <><LogIn className="w-3 h-3 text-emerald-500 flex-shrink-0" /><span className="text-neutral-400">{timeAgo(user.lastLogin)}</span></>
                              : <><Clock className="w-3 h-3 text-neutral-600 flex-shrink-0" /><span className="text-neutral-600">Never</span></>
                            }
                          </div>
                        </td>
                        {/* Actions */}
                        <td className="px-3 md:px-4 py-3 md:py-3.5 text-right">
                          <div className="flex items-center justify-end gap-1">
                            {/* Edit */}
                            <button onClick={() => openEdit(user)} title="Edit"
                              className="p-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 transition-colors">
                              <Pencil className="w-3.5 h-3.5 text-[#FFD700]" />
                            </button>
                            {/* Duplicate */}
                            <button onClick={() => duplicateUser(user)} title="Duplicate user"
                              className="p-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 transition-colors">
                              <UserPlus className="w-3.5 h-3.5 text-neutral-400" />
                            </button>
                            {/* Reset password */}
                            <button onClick={() => handleReset(user.username)} title="Reset password"
                              className="p-1.5 rounded-lg bg-blue-500/20 hover:bg-blue-500/30 transition-colors">
                              <Key className="w-3.5 h-3.5 text-blue-400" />
                            </button>
                            {/* Delete — disabled for self */}
                            <button onClick={() => !isSelf && setConfirmDelete(user.username)} title={isSelf ? "Can't delete your own account" : 'Delete'}
                              disabled={isSelf}
                              className={`p-1.5 rounded-lg transition-colors ${isSelf ? 'opacity-25 cursor-not-allowed bg-neutral-800' : 'bg-red-500/20 hover:bg-red-500/30'}`}>
                              <Trash className="w-3.5 h-3.5 text-red-400" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="px-4 py-3 border-t border-neutral-800 text-xs text-neutral-500 flex items-center justify-between">
              <span>Showing {sorted.length} of {users.length} users</span>
              {copied && <span className="text-[#FFD700]">✓ {copied} copied</span>}
            </div>
          </>
        )}
      </div>

      {/* ══ ADD USER MODAL ══ */}
      {showAdd && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
          <div className="bg-neutral-900 rounded-xl border border-neutral-700 w-full max-w-lg shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="border-b border-neutral-700 px-6 py-4 flex justify-between items-center sticky top-0 bg-neutral-900 z-10">
              <h2 className="text-lg font-bold text-white flex items-center gap-2"><Plus className="w-5 h-5 text-[#FFD700]" /> Add New User</h2>
              <button onClick={() => { setShowAdd(false); setNewUser(EMPTY_USER()); }}
                className="text-neutral-400 hover:text-white p-1 rounded-lg hover:bg-neutral-800"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-6">
              <UserFormFields user={newUser} onChange={setNewUser} />
              <div className="flex gap-3 pt-5">
                <button onClick={() => { setShowAdd(false); setNewUser(EMPTY_USER()); }}
                  className="flex-1 px-4 py-2.5 border border-neutral-700 rounded-lg text-neutral-300 text-sm hover:bg-neutral-800 transition-colors">Cancel</button>
                <button onClick={handleAddUser} disabled={saving}
                  className="flex-1 px-4 py-2.5 bg-[#FFD700] rounded-lg text-black text-sm font-bold hover:bg-[#FFD700]/90 transition-colors flex items-center justify-center gap-2 disabled:opacity-70">
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />} Add User
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ══ EDIT USER MODAL ══ */}
      {editingUser && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
          <div className="bg-neutral-900 rounded-xl border border-neutral-700 w-full max-w-lg shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="border-b border-neutral-700 px-6 py-4 flex justify-between items-center sticky top-0 bg-neutral-900 z-10">
              <div>
                <h2 className="text-lg font-bold text-white flex items-center gap-2"><Pencil className="w-5 h-5 text-[#FFD700]" /> Edit User</h2>
                {editChanged && <p className="text-[10px] text-amber-400 mt-0.5">Unsaved changes</p>}
              </div>
              <button onClick={tryCloseEdit} className="text-neutral-400 hover:text-white p-1 rounded-lg hover:bg-neutral-800"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-6">
              <UserFormFields user={editingUser} onChange={setEditingUser} isEdit originalRole={editOriginal?.role ?? ''} />
              <div className="flex gap-3 pt-5">
                <button onClick={tryCloseEdit}
                  className="flex-1 px-4 py-2.5 border border-neutral-700 rounded-lg text-neutral-300 text-sm hover:bg-neutral-800 transition-colors flex items-center justify-center gap-2">
                  <X className="w-4 h-4" /> {editChanged ? 'Discard' : 'Cancel'}
                </button>
                <button onClick={handleUpdateUser} disabled={saving}
                  className="flex-1 px-4 py-2.5 bg-[#FFD700] rounded-lg text-black text-sm font-bold hover:bg-[#FFD700]/90 transition-colors flex items-center justify-center gap-2 disabled:opacity-70">
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />} Save Changes
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ══ PASSWORD RESET MODAL ══ */}
      {passModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
          <div className="bg-neutral-900 rounded-xl border border-neutral-700 w-full max-w-md shadow-2xl">
            <div className="border-b border-neutral-700 px-6 py-4 flex justify-between items-center">
              <h2 className="text-lg font-bold text-white flex items-center gap-2"><Key className="w-5 h-5 text-blue-400" /> Password Reset</h2>
              <button onClick={() => setPassModal(null)} className="text-neutral-400 hover:text-white p-1 rounded-lg hover:bg-neutral-800"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-6 space-y-4">
              <div className="flex items-start gap-3 p-4 bg-blue-500/10 border border-blue-500/30 rounded-lg">
                <AlertTriangle className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm text-blue-400 font-semibold">Temporary password generated</p>
                  <p className="text-xs text-neutral-400 mt-0.5">Share securely. User will be prompted to change on next login.</p>
                </div>
              </div>
              <div>
                <label className="text-sm font-medium text-neutral-400 block mb-1.5">Username</label>
                <div className="flex items-center gap-2">
                  <div className="flex-1 px-3 py-2.5 bg-neutral-800 border border-neutral-700 rounded-lg text-white text-sm">{passModal.username}</div>
                  <button onClick={() => copy(passModal.username, 'Username')} className="p-2.5 bg-neutral-800 border border-neutral-700 rounded-lg text-neutral-400 hover:text-white hover:border-neutral-500 transition-colors">
                    <Copy className="w-4 h-4" />
                  </button>
                </div>
              </div>
              <div>
                <label className="text-sm font-medium text-neutral-400 block mb-1.5">Temporary Password</label>
                <div className="flex items-center gap-2">
                  <div className="flex-1 px-3 py-2.5 bg-neutral-800 border border-neutral-700 rounded-lg text-[#FFD700] text-lg font-mono font-bold tracking-widest">{passModal.password}</div>
                  <button onClick={() => copy(passModal.password, 'Password')} className="p-2.5 bg-neutral-800 border border-neutral-700 rounded-lg text-neutral-400 hover:text-[#FFD700] hover:border-[#FFD700]/40 transition-colors">
                    <Copy className="w-4 h-4" />
                  </button>
                </div>
                {copied && <p className="text-xs text-[#FFD700] mt-1.5">✓ {copied} copied to clipboard</p>}
              </div>
              <button onClick={() => setPassModal(null)}
                className="w-full px-4 py-2.5 bg-[#FFD700] rounded-lg text-black text-sm font-bold hover:bg-[#FFD700]/90 transition-colors">Done</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Unsaved changes warning ── */}
      {showUnsaved && (
        <ConfirmDialog
          title="Unsaved Changes"
          message="You have unsaved changes. Are you sure you want to close? Changes will be lost."
          confirmLabel="Discard Changes"
          confirmClass="bg-amber-600 hover:bg-amber-500"
          onConfirm={() => { setShowUnsaved(false); setEditingUser(null); setEditOriginal(null); }}
          onCancel={() => setShowUnsaved(false)}
        />
      )}

      {/* ── Role change warning ── */}
      {roleWarn && (
        <ConfirmDialog
          title="Remove All-Branch Access?"
          message={`Changing "${roleWarn.username}" from ${editOriginal?.role} to ${roleWarn.role} will restrict them to a single branch. They will no longer see all branches.`}
          confirmLabel="Yes, Change Role"
          confirmClass="bg-amber-600 hover:bg-amber-500"
          onConfirm={() => doUpdateUser(roleWarn)}
          onCancel={() => setRoleWarn(null)}
        />
      )}

      {/* ── Delete confirm ── */}
      {confirmDelete && (
        <ConfirmDialog
          message={`Delete user "${confirmDelete}"? This cannot be undone.`}
          onConfirm={() => handleDelete(confirmDelete)}
          onCancel={() => setConfirmDelete(null)}
        />
      )}

      {/* ── Bulk delete confirm ── */}
      {confirmBulkDel && (
        <ConfirmDialog
          title={`Delete ${selected.size} Users?`}
          message="All selected users will be permanently deleted. This cannot be undone."
          confirmLabel={`Delete ${selected.size} Users`}
          onConfirm={handleBulkDelete}
          onCancel={() => setConfirmBulkDel(false)}
        />
      )}
    </div>
  );
}

export default UserManagement;
