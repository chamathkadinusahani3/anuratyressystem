import React, { useState, useEffect, useCallback } from 'react';
import { Plus, Pencil, Trash, User, X, Check, Key, Shield, AlertTriangle, Search, RefreshCw, Loader2 } from 'lucide-react';
import {
  collection, getDocs, doc, setDoc, deleteDoc, updateDoc
} from 'firebase/firestore';
import { db } from '../lib/firebase.ts';

// ─── Constants ────────────────────────────────────────────────────────────────
const AVAILABLE_ROLES = ['Super Admin', 'Admin', 'Manager', 'Cashier'];
const ALL_BRANCH_ROLES = ['Super Admin', 'Admin'];
const BRANCH_OPTIONS = ['All Branches', 'Pannipitiya', 'Ratnapura', 'Kalawana', 'Nivithigala'];

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
  username: string;
  name: string;
  role: string;
  branch: string;
  password: string;
  createdAt?: string;
  lastLogin?: string | null;
}

// ─── Firestore helpers ────────────────────────────────────────────────────────
const USERS_COLLECTION = 'at_users';

async function fetchAllUsers(): Promise<UserType[]> {
  const snapshot = await getDocs(collection(db, USERS_COLLECTION));
  return snapshot.docs.map(d => d.data() as UserType);
}

async function createUser(user: UserType): Promise<void> {
  await setDoc(doc(db, USERS_COLLECTION, user.username), user);
}

async function updateUser(user: UserType): Promise<void> {
  await updateDoc(doc(db, USERS_COLLECTION, user.username), { ...user });
}

async function removeUser(username: string): Promise<void> {
  await deleteDoc(doc(db, USERS_COLLECTION, username));
}

// ─── Toast ────────────────────────────────────────────────────────────────────
function Toast({ message, type = 'success', onClose }: { message: string; type?: string; onClose: () => void }) {
  useEffect(() => { const t = setTimeout(onClose, 3500); return () => clearTimeout(t); }, [onClose]);
  const colors = type === 'error'
    ? 'bg-red-900 border-red-700 text-red-200'
    : type === 'info'
    ? 'bg-blue-900 border-blue-700 text-blue-200'
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
function ConfirmDialog({ message, onConfirm, onCancel }: { message: string; onConfirm: () => void; onCancel: () => void }) {
  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
      <div className="bg-neutral-900 rounded-xl border border-neutral-700 w-full max-w-sm shadow-2xl p-6">
        <div className="flex items-start gap-3 mb-5">
          <AlertTriangle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-neutral-300">{message}</p>
        </div>
        <div className="flex gap-3">
          <button onClick={onCancel} className="flex-1 px-4 py-2.5 border border-neutral-700 rounded-lg text-neutral-300 text-sm font-medium hover:bg-neutral-800 transition-colors">Cancel</button>
          <button onClick={onConfirm} className="flex-1 px-4 py-2.5 bg-red-600 rounded-lg text-white text-sm font-bold hover:bg-red-500 transition-colors">Delete</button>
        </div>
      </div>
    </div>
  );
}

// ─── User Form Fields ─────────────────────────────────────────────────────────
function UserFormFields({ user, onChange, isEdit = false }: { user: UserType; onChange: (u: UserType) => void; isEdit?: boolean }) {
  const handleRoleChange = (role: string) => {
    onChange({
      ...user,
      role,
      branch: ALL_BRANCH_ROLES.includes(role)
        ? 'All Branches'
        : user.branch === 'All Branches' ? 'Pannipitiya' : user.branch,
    });
  };

  const inputClass = "w-full px-3 py-2.5 bg-neutral-800 border border-neutral-700 rounded-lg text-white text-sm focus:outline-none focus:border-[#FFD700] transition-colors placeholder:text-neutral-600";

  return (
    <div className="space-y-4">
      <div>
        <label className="text-sm font-medium text-white block mb-1.5">Username {!isEdit && '*'}</label>
        <input
          type="text"
          value={user.username}
          onChange={e => !isEdit && onChange({ ...user, username: e.target.value })}
          disabled={isEdit}
          placeholder="e.g. jdoe"
          className={`${inputClass} ${isEdit ? 'opacity-50 cursor-not-allowed' : ''}`}
        />
        <p className="text-xs text-neutral-500 mt-1">
          {isEdit ? 'Username cannot be changed' : 'Letters, numbers, and underscores only'}
        </p>
      </div>

      <div>
        <label className="text-sm font-medium text-white block mb-1.5">Full Name *</label>
        <input
          type="text"
          value={user.name}
          onChange={e => onChange({ ...user, name: e.target.value })}
          placeholder="e.g. John Doe"
          className={inputClass}
        />
      </div>

      <div>
        <label className="text-sm font-medium text-white block mb-1.5">
          {isEdit ? 'Password (leave blank to keep current)' : 'Password *'}
        </label>
        <input
          type="password"
          value={user.password}
          onChange={e => onChange({ ...user, password: e.target.value })}
          placeholder={isEdit ? 'Enter new password to change' : 'Enter password'}
          className={inputClass}
        />
      </div>

      <div>
        <label className="text-sm font-medium text-white block mb-1.5">Role *</label>
        <select value={user.role} onChange={e => handleRoleChange(e.target.value)} className={inputClass}>
          {AVAILABLE_ROLES.map(r => <option key={r} value={r}>{r}</option>)}
        </select>
        <p className="text-xs text-neutral-500 mt-1">{ROLE_DESCRIPTIONS[user.role]}</p>
      </div>

      {!ALL_BRANCH_ROLES.includes(user.role) ? (
        <div>
          <label className="text-sm font-medium text-white block mb-1.5">Branch Access *</label>
          <select
            value={user.branch}
            onChange={e => onChange({ ...user, branch: e.target.value })}
            className={inputClass}
          >
            {BRANCH_OPTIONS.filter(b => b !== 'All Branches').map(b => (
              <option key={b} value={b}>{b}</option>
            ))}
          </select>
          <p className="text-xs text-orange-400 mt-1 flex items-center gap-1">
            <AlertTriangle className="w-3 h-3" />
            This user will only see bookings from the selected branch
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
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
const EMPTY_NEW_USER: UserType = { username: '', name: '', role: 'Cashier', branch: 'Pannipitiya', password: '' };

export function UserManagement() {
  const [users, setUsers]             = useState<UserType[]>([]);
  const [loading, setLoading]         = useState(true);
  const [saving, setSaving]           = useState(false);
  const [search, setSearch]           = useState('');
  const [roleFilter, setRoleFilter]   = useState('all');
  const [editingUser, setEditingUser] = useState<UserType | null>(null);
  const [showAddModal, setShowAddModal]           = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState<{ username: string; password: string } | null>(null);
  const [confirmDelete, setConfirmDelete]         = useState<string | null>(null);
  const [newUser, setNewUser]   = useState<UserType>(EMPTY_NEW_USER);
  const [toast, setToast]       = useState<{ message: string; type: string } | null>(null);

  const showToast = useCallback((message: string, type = 'success') => setToast({ message, type }), []);

  // ── Load ───────────────────────────────────────────────────────────────────
  const loadUsers = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchAllUsers();
      setUsers(data);
    } catch (err) {
      showToast('Failed to load users from Firestore', 'error');
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => { loadUsers(); }, [loadUsers]);

  // ── Add ────────────────────────────────────────────────────────────────────
// In the handleAddUser function, update the user creation:

const handleAddUser = async () => {
  if (!newUser.username.trim()) return showToast('Username is required', 'error');
  if (!newUser.name.trim())     return showToast('Full name is required', 'error');
  if (!newUser.password.trim()) return showToast('Password is required', 'error');
  if (!/^[a-zA-Z0-9_]+$/.test(newUser.username))
    return showToast('Username: letters, numbers, underscores only', 'error');
  if (users.find(u => u.username.toLowerCase() === newUser.username.toLowerCase()))
    return showToast('Username already exists', 'error');

  setSaving(true);
  try {
    // ── Determine branch ──
    const ADMIN_ROLES = ['Super Admin', 'Admin'];
    const branch = ADMIN_ROLES.includes(newUser.role) 
      ? 'All Branches' 
      : (newUser.branch || 'Pannipitiya');

    const user: UserType = {
      ...newUser,
      branch,  // ← Ensure branch is always set
      createdAt: new Date().toISOString(),
      lastLogin: null
    };

    await createUser(user);
    setUsers(prev => [...prev, user]);
    setNewUser(EMPTY_NEW_USER);
    setShowAddModal(false);
    showToast(`User "${user.username}" created successfully`);
  } catch (err) {
    showToast('Failed to create user', 'error');
    console.error(err);
  } finally {
    setSaving(false);
  }
};

// And in the handleUpdateUser function:

const handleUpdateUser = async () => {
  if (!editingUser) return;
  if (!editingUser.name.trim()) return showToast('Full name is required', 'error');

  setSaving(true);
  try {
    const ADMIN_ROLES = ['Super Admin', 'Admin'];
    const branch = ADMIN_ROLES.includes(editingUser.role) 
      ? 'All Branches' 
      : (editingUser.branch || 'Pannipitiya');

    const orig = users.find(u => u.username === editingUser.username);
    const updated: UserType = {
      ...editingUser,
      branch,  // ← Ensure branch is always set
      password: editingUser.password.trim() ? editingUser.password : (orig?.password ?? ''),
    };

    await updateUser(updated);
    setUsers(prev => prev.map(u => u.username === updated.username ? updated : u));
    setEditingUser(null);
    showToast('User updated successfully');
  } catch (err) {
    showToast('Failed to update user', 'error');
    console.error(err);
  } finally {
    setSaving(false);
  }
};
  // ── Delete ─────────────────────────────────────────────────────────────────
  const handleDeleteUser = async (username: string) => {
    setConfirmDelete(null);
    setSaving(true);
    try {
      await removeUser(username);
      setUsers(prev => prev.filter(u => u.username !== username));
      showToast(`User "${username}" deleted`);
    } catch (err) {
      showToast('Failed to delete user', 'error');
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  // ── Reset Password ─────────────────────────────────────────────────────────
  const handleResetPassword = async (username: string) => {
    const tempPassword = generateTempPassword();
    setSaving(true);
    try {
      await updateDoc(doc(db, USERS_COLLECTION, username), { password: tempPassword });
      setUsers(prev => prev.map(u => u.username === username ? { ...u, password: tempPassword } : u));
      setShowPasswordModal({ username, password: tempPassword });
    } catch (err) {
      showToast('Failed to reset password', 'error');
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  // ── Filtered ───────────────────────────────────────────────────────────────
  const filteredUsers = users.filter(u => {
    const matchesSearch = u.username.toLowerCase().includes(search.toLowerCase()) || u.name.toLowerCase().includes(search.toLowerCase());
    const matchesRole   = roleFilter === 'all' || u.role === roleFilter;
    return matchesSearch && matchesRole;
  });

  const stats = {
    total:      users.length,
    superAdmin: users.filter(u => u.role === 'Super Admin').length,
    admin:      users.filter(u => u.role === 'Admin').length,
    manager:    users.filter(u => u.role === 'Manager').length,
    cashier:    users.filter(u => u.role === 'Cashier').length,
  };

  return (
    <div className="space-y-4 md:space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl md:text-3xl font-bold text-white mb-1 flex items-center gap-2">
            <Shield className="w-7 h-7 md:w-8 md:h-8 text-[#FFD700]" /> User Management
          </h2>
          <p className="text-neutral-400 text-sm">Manage system users and their branch access levels.</p>
        </div>
        <div className="flex gap-3 items-center">
          {saving && (
            <div className="flex items-center gap-1.5 text-xs text-neutral-400">
              <Loader2 className="w-3.5 h-3.5 animate-spin" /> Saving…
            </div>
          )}
          <button
            onClick={loadUsers}
            disabled={loading}
            className="flex items-center gap-2 px-3 md:px-4 py-2 border border-neutral-700 rounded-lg text-neutral-300 text-sm font-medium hover:bg-neutral-800 hover:text-white transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">Refresh</span>
          </button>
          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-2 px-3 md:px-4 py-2 bg-[#FFD700] rounded-lg text-black text-sm font-bold hover:bg-[#FFD700]/90 transition-colors"
          >
            <Plus className="w-4 h-4" /> Add User
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 md:gap-4">
        {[
          { label: 'Total Users',  value: stats.total,      color: 'text-white' },
          { label: 'Super Admins', value: stats.superAdmin, color: 'text-purple-400' },
          { label: 'Admins',       value: stats.admin,      color: 'text-red-400' },
          { label: 'Managers',     value: stats.manager,    color: 'text-blue-400' },
          { label: 'Cashiers',     value: stats.cashier,    color: 'text-green-400' },
        ].map(s => (
          <div key={s.label} className="bg-neutral-900 border border-neutral-800 rounded-xl p-3 md:p-4">
            <div className={`text-xl md:text-2xl font-bold ${s.color}`}>{loading ? '—' : s.value}</div>
            <div className="text-neutral-500 text-xs md:text-sm mt-0.5">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-3 md:p-5">
        <div className="flex flex-col md:flex-row gap-3">
          <div className="relative flex-1 max-w-full md:max-w-sm">
            <Search className="absolute left-3 top-2.5 w-4 h-4 text-neutral-500" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search users..."
              className="w-full pl-9 pr-3 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-white text-sm focus:outline-none focus:border-[#FFD700] placeholder:text-neutral-600 transition-colors"
            />
          </div>
          <div className="flex gap-2 flex-wrap">
            {(['all', ...AVAILABLE_ROLES]).map(role => (
              <button
                key={role}
                onClick={() => setRoleFilter(role)}
                className={`px-3 py-1.5 md:py-2 rounded-lg text-xs font-medium transition-colors whitespace-nowrap ${
                  roleFilter === role
                    ? 'bg-[#FFD700] text-black'
                    : 'bg-neutral-800 text-neutral-400 hover:bg-neutral-700 hover:text-white border border-neutral-700'
                }`}
              >
                {role === 'all' ? 'All Roles' : role}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* User Table */}
      <div className="bg-neutral-900 border border-neutral-800 rounded-xl overflow-hidden">
        {loading ? (
          <div className="py-20 flex flex-col items-center gap-3 text-neutral-500">
            <Loader2 className="w-8 h-8 animate-spin text-[#FFD700]" />
            <span className="text-sm">Loading users…</span>
          </div>
        ) : filteredUsers.length === 0 ? (
          <div className="py-16 text-center">
            <User className="w-12 h-12 text-neutral-600 mx-auto mb-3" />
            <div className="text-neutral-500 mb-3">
              {search || roleFilter !== 'all' ? 'No users found matching filters' : 'No users yet'}
            </div>
            {!search && roleFilter === 'all' && (
              <button onClick={() => setShowAddModal(true)} className="text-[#FFD700] text-sm hover:underline">
                Add your first user
              </button>
            )}
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-neutral-950 border-b border-neutral-800">
                    {['Username', 'Full Name', 'Role', 'Branch Access', 'Actions'].map(h => (
                      <th key={h} className={`px-3 md:px-5 py-3 md:py-3.5 font-bold text-[#FFD700] text-left text-xs md:text-sm whitespace-nowrap ${h === 'Actions' ? 'text-right' : ''}`}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-800">
                  {filteredUsers.map(user => (
                    <tr key={user.username} className="hover:bg-neutral-800/50 transition-colors">
                      <td className="px-3 md:px-5 py-3 md:py-4 font-mono text-white text-xs md:text-sm">{user.username}</td>
                      <td className="px-3 md:px-5 py-3 md:py-4 text-white font-medium text-sm">{user.name}</td>
                      <td className="px-3 md:px-5 py-3 md:py-4">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium border whitespace-nowrap ${ROLE_COLORS[user.role]}`}>
                          {user.role}
                        </span>
                      </td>
                      <td className="px-3 md:px-5 py-3 md:py-4">
                        {ALL_BRANCH_ROLES.includes(user.role) ? (
                          <span className="px-2 py-1 rounded-full text-xs font-medium border bg-neutral-500/20 text-neutral-400 border-neutral-500/30 whitespace-nowrap">
                            All Branches
                          </span>
                        ) : (
                          <span className="px-2 py-1 rounded-full text-xs font-medium border bg-[#FFD700]/10 text-[#FFD700] border-[#FFD700]/30 whitespace-nowrap">
                            {user.branch || 'Not set'}
                          </span>
                        )}
                      </td>
                      <td className="px-3 md:px-5 py-3 md:py-4 text-right">
                        <div className="flex items-center justify-end gap-1 md:gap-2">
                          <button onClick={() => setEditingUser({ ...user, password: '' })} title="Edit"
                            className="p-1.5 md:p-2 rounded-lg bg-neutral-800 hover:bg-neutral-700 transition-colors">
                            <Pencil className="w-3.5 h-3.5 md:w-4 md:h-4 text-[#FFD700]" />
                          </button>
                          <button onClick={() => handleResetPassword(user.username)} title="Reset Password"
                            className="p-1.5 md:p-2 rounded-lg bg-blue-500/20 hover:bg-blue-500/30 transition-colors">
                            <Key className="w-3.5 h-3.5 md:w-4 md:h-4 text-blue-400" />
                          </button>
                          <button onClick={() => setConfirmDelete(user.username)} title="Delete"
                            className="p-1.5 md:p-2 rounded-lg bg-red-500/20 hover:bg-red-500/30 transition-colors">
                            <Trash className="w-3.5 h-3.5 md:w-4 md:h-4 text-red-400" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="px-3 md:px-5 py-3 border-t border-neutral-800 text-xs text-neutral-500">
              Showing {filteredUsers.length} of {users.length} users
            </div>
          </>
        )}
      </div>

      {/* ── Add User Modal ── */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
          <div className="bg-neutral-900 rounded-xl border border-neutral-700 w-full max-w-lg shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="border-b border-neutral-700 px-4 md:px-6 py-4 flex justify-between items-center sticky top-0 bg-neutral-900 z-10">
              <h2 className="text-lg md:text-xl font-bold text-white flex items-center gap-2">
                <Plus className="w-5 h-5 text-[#FFD700]" /> Add New User
              </h2>
              <button onClick={() => { setShowAddModal(false); setNewUser(EMPTY_NEW_USER); }}
                className="text-neutral-400 hover:text-white p-1 rounded-lg hover:bg-neutral-800 transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4 md:p-6">
              <UserFormFields user={newUser} onChange={setNewUser} />
              <div className="flex flex-col md:flex-row gap-3 pt-5">
                <button onClick={() => { setShowAddModal(false); setNewUser(EMPTY_NEW_USER); }}
                  className="flex-1 px-4 py-2.5 border border-neutral-700 rounded-lg text-neutral-300 text-sm font-medium hover:bg-neutral-800 transition-colors">
                  Cancel
                </button>
                <button onClick={handleAddUser} disabled={saving}
                  className="flex-1 px-4 py-2.5 bg-[#FFD700] rounded-lg text-black text-sm font-bold hover:bg-[#FFD700]/90 transition-colors flex items-center justify-center gap-2 disabled:opacity-70">
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                  Add User
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Edit User Modal ── */}
      {editingUser && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
          <div className="bg-neutral-900 rounded-xl border border-neutral-700 w-full max-w-lg shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="border-b border-neutral-700 px-4 md:px-6 py-4 flex justify-between items-center sticky top-0 bg-neutral-900 z-10">
              <h2 className="text-lg md:text-xl font-bold text-white flex items-center gap-2">
                <Pencil className="w-5 h-5 text-[#FFD700]" /> Edit User
              </h2>
              <button onClick={() => setEditingUser(null)}
                className="text-neutral-400 hover:text-white p-1 rounded-lg hover:bg-neutral-800 transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4 md:p-6">
              <UserFormFields user={editingUser} onChange={setEditingUser} isEdit />
              <div className="flex flex-col md:flex-row gap-3 pt-5">
                <button onClick={() => setEditingUser(null)}
                  className="flex-1 px-4 py-2.5 border border-neutral-700 rounded-lg text-neutral-300 text-sm font-medium hover:bg-neutral-800 transition-colors flex items-center justify-center gap-2">
                  <X className="w-4 h-4" /> Cancel
                </button>
                <button onClick={handleUpdateUser} disabled={saving}
                  className="flex-1 px-4 py-2.5 bg-[#FFD700] rounded-lg text-black text-sm font-bold hover:bg-[#FFD700]/90 transition-colors flex items-center justify-center gap-2 disabled:opacity-70">
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                  Save Changes
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Password Reset Modal ── */}
      {showPasswordModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
          <div className="bg-neutral-900 rounded-xl border border-neutral-700 w-full max-w-md shadow-2xl">
            <div className="border-b border-neutral-700 px-4 md:px-6 py-4 flex justify-between items-center">
              <h2 className="text-lg md:text-xl font-bold text-white flex items-center gap-2">
                <Key className="w-5 h-5 text-blue-400" /> Password Reset
              </h2>
              <button onClick={() => setShowPasswordModal(null)}
                className="text-neutral-400 hover:text-white p-1 rounded-lg hover:bg-neutral-800 transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4 md:p-6">
              <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4 mb-4">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm text-blue-400 font-medium mb-1">Temporary Password Generated</p>
                    <p className="text-xs text-neutral-400">Share this securely. The user should change it after logging in.</p>
                  </div>
                </div>
              </div>
              <div className="space-y-3">
                <div>
                  <label className="text-sm font-medium text-neutral-400 block mb-1.5">Username</label>
                  <div className="px-3 py-2.5 bg-neutral-800 border border-neutral-700 rounded-lg text-white text-sm">{showPasswordModal.username}</div>
                </div>
                <div>
                  <label className="text-sm font-medium text-neutral-400 block mb-1.5">Temporary Password</label>
                  <div className="px-3 py-2.5 bg-neutral-800 border border-neutral-700 rounded-lg text-[#FFD700] text-lg font-mono font-bold tracking-widest">{showPasswordModal.password}</div>
                </div>
              </div>
              <button onClick={() => setShowPasswordModal(null)}
                className="w-full mt-6 px-4 py-2.5 bg-[#FFD700] rounded-lg text-black text-sm font-bold hover:bg-[#FFD700]/90 transition-colors">
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Confirm Delete ── */}
      {confirmDelete && (
        <ConfirmDialog
          message={`Are you sure you want to delete user "${confirmDelete}"? This action cannot be undone.`}
          onConfirm={() => handleDeleteUser(confirmDelete)}
          onCancel={() => setConfirmDelete(null)}
        />
      )}
    </div>
  );
}

export default UserManagement;