import React, { useState, useEffect } from 'react';
import { Plus, Pencil, Trash, User, X, Check, Key, Shield, AlertTriangle, Search, RefreshCw } from 'lucide-react';

interface UserType {
  username: string;
  name: string;
  role: string;
  password: string;
  createdAt?: string;
  lastLogin?: string;
}

const AVAILABLE_ROLES = ['Super Admin', 'Admin', 'Manager', 'Cashier'];

const ROLE_DESCRIPTIONS: Record<string, string> = {
  'Super Admin': 'Full system access including user management',
  'Admin': 'Access to all features except user management',
  'Manager': 'Manage bookings, staff, and inventory',
  'Cashier': 'Manage bookings and payments only'
};

const ROLE_COLORS: Record<string, string> = {
  'Super Admin': 'bg-purple-500/20 text-purple-400 border-purple-500/30',
  'Admin': 'bg-red-500/20 text-red-400 border-red-500/30',
  'Manager': 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  'Cashier': 'bg-green-500/20 text-green-400 border-green-500/30'
};

const generateTempPassword = () => Math.random().toString(36).slice(-8).toUpperCase();

export function UserManagement() {
  const [users, setUsers] = useState<UserType[]>([]);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [editingUser, setEditingUser] = useState<UserType | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState<{ username: string; password: string } | null>(null);
  const [newUser, setNewUser] = useState<UserType>({
    username: '',
    name: '',
    role: 'Cashier',
    password: ''
  });

  useEffect(() => {
    loadUsers();
  }, []);

  const loadUsers = () => {
    const storedUsers = JSON.parse(localStorage.getItem('at_users') || '[]');
    setUsers(storedUsers);
  };

  const saveUsers = (updatedUsers: UserType[]) => {
    localStorage.setItem('at_users', JSON.stringify(updatedUsers));
    setUsers(updatedUsers);
  };

  const handleAddUser = () => {
    if (!newUser.username.trim()) return alert('Username is required');
    if (!newUser.name.trim()) return alert('Full name is required');
    if (!newUser.password.trim()) return alert('Password is required');
    
    // Username validation
    if (!/^[a-zA-Z0-9_]+$/.test(newUser.username)) {
      return alert('Username can only contain letters, numbers, and underscores');
    }
    
    if (users.find(u => u.username.toLowerCase() === newUser.username.toLowerCase())) {
      return alert('Username already exists');
    }

    const userToAdd: UserType = {
      ...newUser,
      createdAt: new Date().toISOString(),
      lastLogin: undefined
    };

    saveUsers([...users, userToAdd]);
    setNewUser({ username: '', name: '', role: 'Cashier', password: '' });
    setShowAddModal(false);
  };

  const handleDeleteUser = (username: string) => {
    if (!window.confirm(`Are you sure you want to delete user "${username}"? This action cannot be undone.`)) return;
    saveUsers(users.filter(u => u.username !== username));
  };

  const handleUpdateUser = () => {
    if (!editingUser) return;
    if (!editingUser.name.trim()) return alert('Full name is required');
    
    saveUsers(users.map(u => u.username === editingUser.username ? editingUser : u));
    setEditingUser(null);
  };

  const handleResetPassword = (username: string) => {
    const tempPassword = generateTempPassword();
    saveUsers(users.map(u => u.username === username ? { ...u, password: tempPassword } : u));
    setShowPasswordModal({ username, password: tempPassword });
  };

  const filteredUsers = users.filter(u => {
    const matchesSearch = 
      u.username.toLowerCase().includes(search.toLowerCase()) ||
      u.name.toLowerCase().includes(search.toLowerCase());
    const matchesRole = roleFilter === 'all' || u.role === roleFilter;
    return matchesSearch && matchesRole;
  });

  const stats = {
    total: users.length,
    superAdmin: users.filter(u => u.role === 'Super Admin').length,
    admin: users.filter(u => u.role === 'Admin').length,
    manager: users.filter(u => u.role === 'Manager').length,
    cashier: users.filter(u => u.role === 'Cashier').length,
  };

  return (
    <div className="space-y-4 md:space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl md:text-3xl font-bold text-white mb-1 flex items-center gap-2">
            <Shield className="w-7 h-7 md:w-8 md:h-8 text-[#FFD700]" /> User Management
          </h2>
          <p className="text-neutral-400 text-sm">Manage system users and their access levels.</p>
        </div>
        <div className="flex gap-3">
          <button onClick={loadUsers}
            className="flex items-center gap-2 px-3 md:px-4 py-2 border border-neutral-700 rounded-lg text-neutral-300 text-sm font-medium hover:bg-neutral-800 hover:text-white transition-colors">
            <RefreshCw className="w-4 h-4" /> <span className="hidden sm:inline">Refresh</span>
          </button>
          <button onClick={() => setShowAddModal(true)}
            className="flex items-center gap-2 px-3 md:px-4 py-2 bg-[#FFD700] rounded-lg text-black text-sm font-bold hover:bg-[#FFD700]/90 transition-colors">
            <Plus className="w-4 h-4" /> Add User
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 md:gap-4">
        {[
          { label: 'Total Users', value: stats.total, color: 'text-white' },
          { label: 'Super Admins', value: stats.superAdmin, color: 'text-purple-400' },
          { label: 'Admins', value: stats.admin, color: 'text-red-400' },
          { label: 'Managers', value: stats.manager, color: 'text-blue-400' },
          { label: 'Cashiers', value: stats.cashier, color: 'text-green-400' },
        ].map(s => (
          <div key={s.label} className="bg-neutral-900 border border-neutral-800 rounded-xl p-3 md:p-4">
            <div className={`text-xl md:text-2xl font-bold ${s.color}`}>{s.value}</div>
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
            {(['all', ...AVAILABLE_ROLES] as const).map(role => (
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
        {filteredUsers.length === 0 ? (
          <div className="py-16 text-center">
            <User className="w-12 h-12 text-neutral-600 mx-auto mb-3" />
            <div className="text-neutral-500 mb-3">
              {search || roleFilter !== 'all' ? 'No users found matching filters' : 'No users yet'}
            </div>
            {!search && roleFilter === 'all' && (
              <button
                onClick={() => setShowAddModal(true)}
                className="text-[#FFD700] text-sm hover:underline"
              >
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
                    <th className="px-3 md:px-5 py-3 md:py-3.5 font-bold text-[#FFD700] text-left text-xs md:text-sm whitespace-nowrap">Username</th>
                    <th className="px-3 md:px-5 py-3 md:py-3.5 font-bold text-[#FFD700] text-left text-xs md:text-sm whitespace-nowrap">Full Name</th>
                    <th className="px-3 md:px-5 py-3 md:py-3.5 font-bold text-[#FFD700] text-left text-xs md:text-sm whitespace-nowrap">Role</th>
                    <th className="px-3 md:px-5 py-3 md:py-3.5 font-bold text-[#FFD700] text-right text-xs md:text-sm whitespace-nowrap">Actions</th>
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
                      <td className="px-3 md:px-5 py-3 md:py-4 text-right">
                        <div className="flex items-center justify-end gap-1 md:gap-2">
                          <button
                            onClick={() => setEditingUser(user)}
                            title="Edit"
                            className="p-1.5 md:p-2 rounded-lg bg-neutral-800 hover:bg-neutral-700 transition-colors"
                          >
                            <Pencil className="w-3.5 h-3.5 md:w-4 md:h-4 text-[#FFD700]" />
                          </button>
                          <button
                            onClick={() => handleResetPassword(user.username)}
                            title="Reset Password"
                            className="p-1.5 md:p-2 rounded-lg bg-blue-500/20 hover:bg-blue-500/30 transition-colors"
                          >
                            <Key className="w-3.5 h-3.5 md:w-4 md:h-4 text-blue-400" />
                          </button>
                          <button
                            onClick={() => handleDeleteUser(user.username)}
                            title="Delete"
                            className="p-1.5 md:p-2 rounded-lg bg-red-500/20 hover:bg-red-500/30 transition-colors"
                          >
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

      {/* Add User Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
          <div className="bg-neutral-900 rounded-xl border border-neutral-700 w-full max-w-lg shadow-2xl">
            <div className="border-b border-neutral-700 px-4 md:px-6 py-4 flex justify-between items-center">
              <h2 className="text-lg md:text-xl font-bold text-white flex items-center gap-2">
                <Plus className="w-5 h-5 text-[#FFD700]" /> Add New User
              </h2>
              <button
                onClick={() => {
                  setShowAddModal(false);
                  setNewUser({ username: '', name: '', role: 'Cashier', password: '' });
                }}
                className="text-neutral-400 hover:text-white p-1 rounded-lg hover:bg-neutral-800 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 md:p-6 space-y-4">
              <div>
                <label className="text-sm font-medium text-white block mb-1.5">Username *</label>
                <input
                  type="text"
                  value={newUser.username}
                  onChange={e => setNewUser({ ...newUser, username: e.target.value })}
                  placeholder="e.g. jdoe"
                  className="w-full px-3 py-2.5 bg-neutral-800 border border-neutral-700 rounded-lg text-white text-sm focus:outline-none focus:border-[#FFD700] transition-colors placeholder:text-neutral-600"
                />
                <p className="text-xs text-neutral-500 mt-1">Letters, numbers, and underscores only</p>
              </div>

              <div>
                <label className="text-sm font-medium text-white block mb-1.5">Full Name *</label>
                <input
                  type="text"
                  value={newUser.name}
                  onChange={e => setNewUser({ ...newUser, name: e.target.value })}
                  placeholder="e.g. John Doe"
                  className="w-full px-3 py-2.5 bg-neutral-800 border border-neutral-700 rounded-lg text-white text-sm focus:outline-none focus:border-[#FFD700] transition-colors placeholder:text-neutral-600"
                />
              </div>

              <div>
                <label className="text-sm font-medium text-white block mb-1.5">Password *</label>
                <input
                  type="password"
                  value={newUser.password}
                  onChange={e => setNewUser({ ...newUser, password: e.target.value })}
                  placeholder="Enter password"
                  className="w-full px-3 py-2.5 bg-neutral-800 border border-neutral-700 rounded-lg text-white text-sm focus:outline-none focus:border-[#FFD700] transition-colors placeholder:text-neutral-600"
                />
              </div>

              <div>
                <label className="text-sm font-medium text-white block mb-1.5">Role *</label>
                <select
                  value={newUser.role}
                  onChange={e => setNewUser({ ...newUser, role: e.target.value })}
                  className="w-full px-3 py-2.5 bg-neutral-800 border border-neutral-700 rounded-lg text-white text-sm focus:outline-none focus:border-[#FFD700] transition-colors"
                >
                  {AVAILABLE_ROLES.map(r => (
                    <option key={r} value={r}>{r}</option>
                  ))}
                </select>
                <p className="text-xs text-neutral-500 mt-1">{ROLE_DESCRIPTIONS[newUser.role]}</p>
              </div>

              <div className="flex flex-col md:flex-row gap-3 pt-2">
                <button
                  onClick={() => {
                    setShowAddModal(false);
                    setNewUser({ username: '', name: '', role: 'Cashier', password: '' });
                  }}
                  className="flex-1 px-4 py-2.5 border border-neutral-700 rounded-lg text-neutral-300 text-sm font-medium hover:bg-neutral-800 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleAddUser}
                  className="flex-1 px-4 py-2.5 bg-[#FFD700] rounded-lg text-black text-sm font-bold hover:bg-[#FFD700]/90 transition-colors flex items-center justify-center gap-2"
                >
                  <Check className="w-4 h-4" /> Add User
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Edit User Modal */}
      {editingUser && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
          <div className="bg-neutral-900 rounded-xl border border-neutral-700 w-full max-w-lg shadow-2xl">
            <div className="border-b border-neutral-700 px-4 md:px-6 py-4 flex justify-between items-center">
              <h2 className="text-lg md:text-xl font-bold text-white flex items-center gap-2">
                <Pencil className="w-5 h-5 text-[#FFD700]" /> Edit User
              </h2>
              <button
                onClick={() => setEditingUser(null)}
                className="text-neutral-400 hover:text-white p-1 rounded-lg hover:bg-neutral-800 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 md:p-6 space-y-4">
              <div>
                <label className="text-sm font-medium text-white block mb-1.5">Username</label>
                <input
                  type="text"
                  value={editingUser.username}
                  disabled
                  className="w-full px-3 py-2.5 bg-neutral-800 border border-neutral-700 rounded-lg text-neutral-500 text-sm cursor-not-allowed"
                />
                <p className="text-xs text-neutral-500 mt-1">Username cannot be changed</p>
              </div>

              <div>
                <label className="text-sm font-medium text-white block mb-1.5">Full Name *</label>
                <input
                  type="text"
                  value={editingUser.name}
                  onChange={e => setEditingUser({ ...editingUser, name: e.target.value })}
                  placeholder="e.g. John Doe"
                  className="w-full px-3 py-2.5 bg-neutral-800 border border-neutral-700 rounded-lg text-white text-sm focus:outline-none focus:border-[#FFD700] transition-colors placeholder:text-neutral-600"
                />
              </div>

              <div>
                <label className="text-sm font-medium text-white block mb-1.5">Password (leave blank to keep current)</label>
                <input
                  type="password"
                  value={editingUser.password}
                  onChange={e => setEditingUser({ ...editingUser, password: e.target.value })}
                  placeholder="Enter new password"
                  className="w-full px-3 py-2.5 bg-neutral-800 border border-neutral-700 rounded-lg text-white text-sm focus:outline-none focus:border-[#FFD700] transition-colors placeholder:text-neutral-600"
                />
              </div>

              <div>
                <label className="text-sm font-medium text-white block mb-1.5">Role *</label>
                <select
                  value={editingUser.role}
                  onChange={e => setEditingUser({ ...editingUser, role: e.target.value })}
                  className="w-full px-3 py-2.5 bg-neutral-800 border border-neutral-700 rounded-lg text-white text-sm focus:outline-none focus:border-[#FFD700] transition-colors"
                >
                  {AVAILABLE_ROLES.map(r => (
                    <option key={r} value={r}>{r}</option>
                  ))}
                </select>
                <p className="text-xs text-neutral-500 mt-1">{ROLE_DESCRIPTIONS[editingUser.role]}</p>
              </div>

              <div className="flex flex-col md:flex-row gap-3 pt-2">
                <button
                  onClick={() => setEditingUser(null)}
                  className="flex-1 px-4 py-2.5 border border-neutral-700 rounded-lg text-neutral-300 text-sm font-medium hover:bg-neutral-800 transition-colors flex items-center justify-center gap-2"
                >
                  <X className="w-4 h-4" /> Cancel
                </button>
                <button
                  onClick={handleUpdateUser}
                  className="flex-1 px-4 py-2.5 bg-[#FFD700] rounded-lg text-black text-sm font-bold hover:bg-[#FFD700]/90 transition-colors flex items-center justify-center gap-2"
                >
                  <Check className="w-4 h-4" /> Save Changes
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Password Reset Modal */}
      {showPasswordModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
          <div className="bg-neutral-900 rounded-xl border border-neutral-700 w-full max-w-md shadow-2xl">
            <div className="border-b border-neutral-700 px-4 md:px-6 py-4 flex justify-between items-center">
              <h2 className="text-lg md:text-xl font-bold text-white flex items-center gap-2">
                <Key className="w-5 h-5 text-blue-400" /> Password Reset
              </h2>
              <button
                onClick={() => setShowPasswordModal(null)}
                className="text-neutral-400 hover:text-white p-1 rounded-lg hover:bg-neutral-800 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 md:p-6">
              <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4 mb-4">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm text-blue-400 font-medium mb-1">Temporary Password Generated</p>
                    <p className="text-xs text-neutral-400">
                      Please share this password securely with the user. They should change it after logging in.
                    </p>
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <div>
                  <label className="text-sm font-medium text-neutral-400 block mb-1.5">Username</label>
                  <div className="px-3 py-2.5 bg-neutral-800 border border-neutral-700 rounded-lg text-white text-sm">
                    {showPasswordModal.username}
                  </div>
                </div>

                <div>
                  <label className="text-sm font-medium text-neutral-400 block mb-1.5">Temporary Password</label>
                  <div className="px-3 py-2.5 bg-neutral-800 border border-neutral-700 rounded-lg text-[#FFD700] text-lg font-mono font-bold">
                    {showPasswordModal.password}
                  </div>
                </div>
              </div>

              <button
                onClick={() => setShowPasswordModal(null)}
                className="w-full mt-6 px-4 py-2.5 bg-[#FFD700] rounded-lg text-black text-sm font-bold hover:bg-[#FFD700]/90 transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}