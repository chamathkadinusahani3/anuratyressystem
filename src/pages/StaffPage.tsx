import React, { useState, useEffect, useCallback } from 'react';
import { X, Search, Plus, Wrench, Edit2, Trash2, Phone, Mail, Eye, EyeOff, KeyRound } from 'lucide-react';

const API = (import.meta.env.VITE_API_URL || 'https://anuratyres-backend-emm1774.vercel.app/api')
  .replace(/\/api$/, '');

interface StaffMember {
  id: number;
  name: string;
  role: string;
  status: 'Available' | 'Busy' | 'On Leave' | 'On Break';
  contact: string;
  email: string;
  bay: string;
  emergencyContact: string;
}

// Staff loaded from API

function statusColor(status: string) {
  if (status === 'Available') return 'bg-green-500/20 text-green-400 border border-green-500/30';
  if (status === 'Busy')      return 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30';
  if (status === 'On Break')  return 'bg-orange-500/20 text-orange-400 border border-orange-500/30';
  return 'bg-red-500/20 text-red-400 border border-red-500/30';
}

// ═══════════════════════════════════════════════════════════════════════════════
// STAFF FORM MODAL (Add & Edit)
// ═══════════════════════════════════════════════════════════════════════════════
function StaffModal({ staff, onClose, onSave }: {
  staff?: StaffMember | null;
  onClose: () => void;
  onSave: (data: Omit<StaffMember, 'id'> & { id?: number }) => void;
}) {
  const isEdit = !!staff;
  const [form, setForm] = useState({
    name:             staff?.name             ?? '',
    role:             staff?.role             ?? '',
    status:           (staff?.status          ?? 'Available') as StaffMember['status'],
    contact:          staff?.contact          ?? '',
    email:            staff?.email            ?? '',
    bay:              staff?.bay              ?? '-',
    emergencyContact: staff?.emergencyContact ?? '',
    // Login credentials + portal settings — only used when adding new staff
    username:         '',
    password:         '',
    portalRole:       'mechanic',
    portalBranch:     'Pannipitiya',
  });
  const [showPass,  setShowPass]  = useState(false);
  const [saving,    setSaving]    = useState(false);
  const [error,     setError]     = useState('');
  const [credsNote, setCredsNote] = useState('');   // shows credentials after save

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim())    return setError('Name is required');
    if (!form.role)           return setError('Role is required');
    if (!form.contact.trim()) return setError('Contact number is required');

    // New staff require username + password for portal login
    if (!isEdit) {
      if (!form.username.trim()) return setError('Username is required for portal login');
      if (form.password.length < 6) return setError('Password must be at least 6 characters');
    }

    setError('');
    setSaving(true);

    try {
      if (!isEdit) {
        // Register with backend so staff can log into the staff portal
        const res = await fetch(`${API}/api/staff?action=register`, {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            username: form.username.trim().toLowerCase(),
            password: form.password,
            name:     form.name.trim(),
            role:     form.portalRole,
            branch:   form.portalBranch,
            phone:    form.contact.trim(),
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to register staff');
        // Show credentials note briefly before closing
        setCredsNote(`Login: ${form.username.trim().toLowerCase()} / ${form.password}`);
        setTimeout(() => {
          onSave({ id: staff?.id, ...form, name: form.name.trim(), contact: form.contact.trim() });
          onClose();
        }, 2000);
        return;
      }
    } catch (err: any) {
      setError(err.message);
      setSaving(false);
      return;
    }

    // Edit — just update local state (no backend call yet for profile update)
    onSave({ id: staff?.id, ...form, name: form.name.trim(), contact: form.contact.trim() });
    onClose();
    setSaving(false);
  };

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
      <div className="bg-neutral-900 rounded-xl border border-neutral-700 w-full max-w-lg shadow-2xl max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-neutral-900 border-b border-neutral-700 px-6 py-4 flex justify-between items-center">
          <h2 className="text-xl font-bold text-white">{isEdit ? 'Edit Staff Member' : 'Add Staff Member'}</h2>
          <button onClick={onClose} className="text-neutral-400 hover:text-white p-1 rounded-lg hover:bg-neutral-800 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>
        <form onSubmit={submit} className="p-6 space-y-4">
          {error && <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm">{error}</div>}

          {/* Credentials saved confirmation */}
          {credsNote && (
            <div className="p-3 bg-green-500/10 border border-green-500/30 rounded-lg text-green-400 text-sm">
              <p className="font-bold mb-0.5">Staff account created!</p>
              <p className="font-mono text-xs">{credsNote}</p>
              <p className="text-green-600 text-xs mt-0.5">Share these credentials with the staff member.</p>
            </div>
          )}

          <div>
            <label className="text-sm font-medium text-white block mb-1.5">Full Name *</label>
            <input value={form.name} onChange={e => setForm({...form, name: e.target.value})} placeholder="e.g. Saman Perera"
              className="w-full px-3 py-2.5 bg-neutral-800 border border-neutral-700 rounded-lg text-white text-sm focus:outline-none focus:border-[#FFD700] placeholder:text-neutral-600 transition-colors" />
          </div>

          {/* Username + Password — only shown when adding new staff */}
          {!isEdit && (
            <div className="grid grid-cols-2 gap-3 p-3 bg-neutral-800/50 border border-neutral-700 rounded-lg">
              <div className="col-span-2 flex items-center gap-2 mb-1">
                <KeyRound className="w-3.5 h-3.5 text-[#FFD700]" />
                <span className="text-xs font-bold text-[#FFD700]">Staff Portal Login</span>
              </div>
              <div>
                <label className="text-xs font-medium text-neutral-400 block mb-1.5">Username *</label>
                <input
                  value={form.username}
                  onChange={e => setForm({...form, username: e.target.value.toLowerCase().replace(/\s/g, '')})}
                  placeholder="e.g. saman.p"
                  autoComplete="off"
                  className="w-full px-3 py-2.5 bg-neutral-800 border border-neutral-700 rounded-lg text-white text-sm focus:outline-none focus:border-[#FFD700] placeholder:text-neutral-600 transition-colors"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-neutral-400 block mb-1.5">Password *</label>
                <div className="relative">
                  <input
                    type={showPass ? 'text' : 'password'}
                    value={form.password}
                    onChange={e => setForm({...form, password: e.target.value})}
                    placeholder="Min 6 chars"
                    autoComplete="new-password"
                    className="w-full px-3 py-2.5 pr-9 bg-neutral-800 border border-neutral-700 rounded-lg text-white text-sm focus:outline-none focus:border-[#FFD700] placeholder:text-neutral-600 transition-colors"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPass(v => !v)}
                    className="absolute right-2.5 top-2.5 text-neutral-500 hover:text-neutral-300 transition-colors"
                  >
                    {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
              {/* Branch + Role for portal */}
              <div>
                <label className="text-xs font-medium text-neutral-400 block mb-1.5">Branch *</label>
                <select
                  value={form.portalBranch}
                  onChange={e => setForm({...form, portalBranch: e.target.value})}
                  className="w-full px-3 py-2.5 bg-neutral-800 border border-neutral-700 rounded-lg text-white text-sm focus:outline-none focus:border-[#FFD700] transition-colors"
                >
                  {['Pannipitiya', 'Ratnapura', 'Kalawana', 'Nivithigala'].map(b => (
                    <option key={b} value={b}>{b}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-neutral-400 block mb-1.5">Portal Role *</label>
                <select
                  value={form.portalRole}
                  onChange={e => setForm({...form, portalRole: e.target.value})}
                  className="w-full px-3 py-2.5 bg-neutral-800 border border-neutral-700 rounded-lg text-white text-sm focus:outline-none focus:border-[#FFD700] transition-colors"
                >
                  <option value="mechanic">Mechanic</option>
                  <option value="supervisor">Supervisor</option>
                  <option value="super_admin">Super Admin</option>
                </select>
              </div>

              {/* Live credentials preview */}
              {form.username && form.password.length >= 6 && (
                <div className="col-span-2 bg-neutral-900 rounded-lg px-3 py-2 border border-neutral-700 space-y-1">
                  <p className="text-[10px] font-mono text-neutral-500">
                    Login: <span className="text-neutral-300">{form.username}</span>
                    {' / '}
                    <span className="text-neutral-300">{form.password}</span>
                  </p>
                  <p className="text-[10px] text-neutral-600">
                    {form.portalBranch} · {form.portalRole === 'super_admin' ? 'Super Admin' : form.portalRole === 'supervisor' ? 'Supervisor' : 'Mechanic'}
                  </p>
                </div>
              )}
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm font-medium text-white block mb-1.5">Role *</label>
              <select value={form.role} onChange={e => setForm({...form, role: e.target.value})}
                className="w-full px-3 py-2.5 bg-neutral-800 border border-neutral-700 rounded-lg text-white text-sm focus:outline-none focus:border-[#FFD700] transition-colors">
                <option value="">Select role...</option>
                {['Lead Mechanic', 'Mechanic', 'Junior Mechanic', 'Tyre Technician', 'Service Advisor', 'Manager', 'Cashier'].map(r => (
                  <option key={r} value={r}>{r}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-sm font-medium text-white block mb-1.5">Status</label>
              <select value={form.status} onChange={e => setForm({...form, status: e.target.value as StaffMember['status']})}
                className="w-full px-3 py-2.5 bg-neutral-800 border border-neutral-700 rounded-lg text-white text-sm focus:outline-none focus:border-[#FFD700] transition-colors">
                <option value="Available">Available</option>
                <option value="Busy">Busy</option>
                <option value="On Break">On Break</option>
                <option value="On Leave">On Leave</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm font-medium text-white block mb-1.5">Contact Number *</label>
              <input value={form.contact} onChange={e => setForm({...form, contact: e.target.value})} placeholder="077-1234567"
                className="w-full px-3 py-2.5 bg-neutral-800 border border-neutral-700 rounded-lg text-white text-sm focus:outline-none focus:border-[#FFD700] placeholder:text-neutral-600 transition-colors" />
            </div>
            <div>
              <label className="text-sm font-medium text-white block mb-1.5">Email</label>
              <input type="email" value={form.email} onChange={e => setForm({...form, email: e.target.value})} placeholder="name@anuratyres.lk"
                className="w-full px-3 py-2.5 bg-neutral-800 border border-neutral-700 rounded-lg text-white text-sm focus:outline-none focus:border-[#FFD700] placeholder:text-neutral-600 transition-colors" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm font-medium text-white block mb-1.5">Assigned Bay</label>
              <select value={form.bay} onChange={e => setForm({...form, bay: e.target.value})}
                className="w-full px-3 py-2.5 bg-neutral-800 border border-neutral-700 rounded-lg text-white text-sm focus:outline-none focus:border-[#FFD700] transition-colors">
                <option value="-">Not Assigned</option>
                {['Bay 1', 'Bay 2', 'Bay 3', 'Bay 4'].map(b => <option key={b} value={b}>{b}</option>)}
              </select>
            </div>
            <div>
              <label className="text-sm font-medium text-white block mb-1.5">Emergency Contact</label>
              <input value={form.emergencyContact} onChange={e => setForm({...form, emergencyContact: e.target.value})} placeholder="077-9876543"
                className="w-full px-3 py-2.5 bg-neutral-800 border border-neutral-700 rounded-lg text-white text-sm focus:outline-none focus:border-[#FFD700] placeholder:text-neutral-600 transition-colors" />
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 px-4 py-2.5 border border-neutral-700 rounded-lg text-neutral-300 text-sm font-medium hover:bg-neutral-800 transition-colors">Cancel</button>
            <button type="submit" disabled={saving} className="flex-1 px-4 py-2.5 bg-[#FFD700] rounded-lg text-black text-sm font-bold hover:bg-[#FFD700]/90 transition-colors disabled:opacity-60 flex items-center justify-center gap-2">{saving ? 'Saving…' : isEdit ? 'Save Changes' : 'Add Staff Member'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN STAFF PAGE
// ═══════════════════════════════════════════════════════════════════════════════
export function StaffPage() {
  const [staff,        setStaff]        = useState<StaffMember[]>([]);
  const [staffLoading, setStaffLoading] = useState(true);
  const [staffError,   setStaffError]   = useState<string | null>(null);

  const fetchStaff = useCallback(async () => {
    setStaffLoading(true);
    setStaffError(null);
    try {
      const res  = await fetch(`${API}/api/staff`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to load staff');
      // Map API fields to StaffMember shape
      const mapped: StaffMember[] = (Array.isArray(data) ? data : []).map((m: any, i: number) => ({
        id:               m._id || i,
        name:             m.name             || '',
        role:             m.role             || '',
        status:           (m.dayStatus?.status === 'on_break' ? 'On Break' :
                           m.dayStatus?.status === 'active'   ? 'Available' : 'Available') as StaffMember['status'],
        contact:          m.phone            || '',
        email:            m.email            || '',
        bay:              m.dayStatus?.bayNumber ? `Bay ${m.dayStatus.bayNumber}` : '-',
        emergencyContact: '',
      }));
      setStaff(mapped);
    } catch (err: any) {
      setStaffError(err.message);
    } finally {
      setStaffLoading(false);
    }
  }, []);

  useEffect(() => { fetchStaff(); }, [fetchStaff]);
  const [search, setSearch] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [editMember, setEditMember] = useState<StaffMember | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<number | null>(null);

  const handleSave = (data: any) => {
    if (data.id) {
      setStaff(prev => prev.map(s => s.id === data.id ? data : s));
    } else {
      setStaff(prev => [...prev, { ...data, id: Date.now() }]);
    }
    // Re-fetch from API to get the real saved data
    setTimeout(() => fetchStaff(), 500);
  };

  const handleDelete = (id: number) => {
    setStaff(prev => prev.filter(s => s.id !== id));
    setDeleteConfirm(null);
  };

  const handleStatusChange = (id: number, status: StaffMember['status']) => {
    setStaff(prev => prev.map(s => s.id === id ? { ...s, status } : s));
  };

  const filtered = staff.filter(s =>
    s.name.toLowerCase().includes(search.toLowerCase()) ||
    s.role.toLowerCase().includes(search.toLowerCase())
  );

  const bayAssigned = staff.filter(s => s.bay !== '-');
  const bayMap: Record<string, StaffMember | undefined> = {};
  bayAssigned.forEach(s => { bayMap[s.bay] = s; });

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold text-white mb-1">Staff Directory</h2>
          <p className="text-neutral-400 text-sm">Manage mechanics, technicians, and assignments.</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={fetchStaff} disabled={staffLoading}
            className="p-2 bg-neutral-900 border border-neutral-700 rounded-lg text-neutral-400 hover:text-white hover:border-neutral-600 transition-colors disabled:opacity-50">
            <svg className={`w-4 h-4 ${staffLoading ? 'animate-spin' : ''}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/>
              <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>
            </svg>
          </button>
          <button onClick={() => setShowAddModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-[#FFD700] rounded-lg text-black text-sm font-bold hover:bg-[#FFD700]/90 transition-colors">
            <Plus className="w-4 h-4" /> Add Staff Member
          </button>
        </div>
      </div>

      {/* Loading / error states */}
      {staffLoading && (
        <div className="flex items-center justify-center py-8 text-neutral-500 text-sm gap-2">
          <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none">
            <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeDasharray="40" strokeLinecap="round"/>
          </svg>
          Loading staff from database…
        </div>
      )}
      {staffError && (
        <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 text-sm">
          Failed to load staff: {staffError}
          <button onClick={fetchStaff} className="ml-3 underline hover:no-underline">Retry</button>
        </div>
      )}

      {/* Stats — now 4 cards including On Break */}
      <div className="grid grid-cols-4 gap-4">
        {[
          { label: 'Total Staff', value: staff.length,                                        color: 'text-white' },
          { label: 'Available',   value: staff.filter(s => s.status === 'Available').length,  color: 'text-green-400' },
          { label: 'On Break',    value: staff.filter(s => s.status === 'On Break').length,   color: 'text-orange-400' },
          { label: 'On Leave',    value: staff.filter(s => s.status === 'On Leave').length,   color: 'text-red-400' },
        ].map(s => (
          <div key={s.label} className="bg-neutral-900 border border-neutral-800 rounded-xl p-4 text-center">
            <div className={`text-2xl font-bold ${s.color}`}>{s.value}</div>
            <div className="text-neutral-500 text-xs mt-0.5">{s.label}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Staff Table */}
        <div className="lg:col-span-2">
          <div className="bg-neutral-900 border border-neutral-800 rounded-xl overflow-hidden">
            <div className="p-5 border-b border-neutral-800 flex justify-between items-center gap-3">
              <h3 className="font-bold text-white text-lg">Team Members</h3>
              <div className="relative w-56">
                <Search className="absolute left-3 top-2.5 w-4 h-4 text-neutral-500" />
                <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search staff..."
                  className="w-full pl-9 pr-3 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-white text-sm focus:outline-none focus:border-[#FFD700] placeholder:text-neutral-600 transition-colors" />
              </div>
            </div>

            {filtered.length === 0 ? (
              <div className="py-12 text-center text-neutral-500">No staff found</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-neutral-950 border-b border-neutral-800">
                      {['Name', 'Role', 'Status', 'Contact', 'Actions'].map(h => (
                        <th key={h} className={`px-5 py-3.5 font-bold text-[#FFD700] text-left ${h === 'Actions' ? 'text-right' : ''}`}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-800">
                    {filtered.map(member => (
                      <tr key={member.id} className="hover:bg-neutral-800/40 transition-colors">
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-neutral-800 border border-neutral-700 flex items-center justify-center text-[#FFD700] font-bold text-sm flex-shrink-0">
                              {member.name.charAt(0)}
                            </div>
                            <div>
                              <div className="text-white font-medium text-sm">{member.name}</div>
                              {member.bay !== '-' && <div className="text-xs text-neutral-500">{member.bay}</div>}
                            </div>
                          </div>
                        </td>
                        <td className="px-5 py-4 text-neutral-400 text-sm">{member.role}</td>
                        <td className="px-5 py-4">
                          <select value={member.status}
                            onChange={e => handleStatusChange(member.id, e.target.value as StaffMember['status'])}
                            className={`px-2 py-1 rounded-full text-xs font-medium border-0 cursor-pointer focus:outline-none ${statusColor(member.status)}`}
                            style={{ background: 'transparent' }}>
                            <option value="Available">Available</option>
                            <option value="Busy">Busy</option>
                            <option value="On Break">On Break</option>
                            <option value="On Leave">On Leave</option>
                          </select>
                        </td>
                        <td className="px-5 py-4">
                          <div className="text-neutral-400 text-xs">{member.contact}</div>
                          {member.email && <div className="text-neutral-600 text-xs">{member.email}</div>}
                        </td>
                        <td className="px-5 py-4 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button onClick={() => setEditMember(member)} title="Edit"
                              className="px-2.5 py-1.5 bg-neutral-800 hover:bg-blue-500/20 hover:text-blue-400 border border-neutral-700 rounded text-neutral-400 text-xs font-medium transition-colors flex items-center gap-1">
                              <Edit2 className="w-3 h-3" /> Edit
                            </button>
                            <button onClick={() => setDeleteConfirm(member.id)} title="Delete"
                              className="p-1.5 rounded text-neutral-500 hover:text-red-400 hover:bg-neutral-800 transition-colors">
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* Bay Status */}
        <div className="space-y-5">
          <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-5">
            <h3 className="font-bold text-white mb-4 text-sm uppercase tracking-wider text-neutral-400">Bay Status</h3>
            <div className="space-y-3">
              {['Bay 1', 'Bay 2', 'Bay 3', 'Bay 4'].map(bay => {
                const assignedStaff = bayMap[bay];
                return (
                  <div key={bay} className={`p-3 rounded-lg border transition-colors ${
                    assignedStaff ? 'bg-[#FFD700]/5 border-[#FFD700]/20' : 'bg-neutral-800 border-neutral-700'}`}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Wrench className={`w-4 h-4 ${assignedStaff ? 'text-[#FFD700]' : 'text-neutral-600'}`} />
                        <span className="text-white text-sm font-medium">{bay}</span>
                      </div>
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                        assignedStaff
                          ? 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30'
                          : 'bg-green-500/20 text-green-400 border border-green-500/30'}`}>
                        {assignedStaff ? 'Occupied' : 'Free'}
                      </span>
                    </div>
                    {assignedStaff && (
                      <div className="mt-2 text-xs text-neutral-500">
                        {assignedStaff.name} · {assignedStaff.role}
                        {assignedStaff.status === 'On Break' && (
                          <span className="ml-2 text-orange-400 font-medium">· On Break</span>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Quick contact */}
          <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-5">
            <h3 className="font-bold text-white mb-4 text-sm uppercase tracking-wider text-neutral-400">Available Now</h3>
            <div className="space-y-2">
              {staff.filter(s => s.status === 'Available').map(s => (
                <div key={s.id} className="flex items-center justify-between p-2 bg-neutral-800 rounded-lg">
                  <div>
                    <div className="text-sm text-white font-medium">{s.name}</div>
                    <div className="text-xs text-neutral-500">{s.role}</div>
                  </div>
                  <a href={`tel:${s.contact}`}
                    className="p-1.5 rounded text-neutral-500 hover:text-[#FFD700] hover:bg-neutral-700 transition-colors">
                    <Phone className="w-4 h-4" />
                  </a>
                </div>
              ))}
              {staff.filter(s => s.status === 'Available').length === 0 && (
                <div className="text-neutral-500 text-sm text-center py-3">No staff available</div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Delete Confirm */}
      {deleteConfirm !== null && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
          <div className="bg-neutral-900 rounded-xl border border-neutral-700 w-full max-w-sm p-6 shadow-2xl">
            <h3 className="text-lg font-bold text-white mb-2">Remove Staff Member?</h3>
            <p className="text-neutral-400 text-sm mb-5">This will permanently remove them from the system.</p>
            <div className="flex gap-3">
              <button onClick={() => setDeleteConfirm(null)} className="flex-1 px-4 py-2.5 border border-neutral-700 rounded-lg text-neutral-300 text-sm hover:bg-neutral-800 transition-colors">Cancel</button>
              <button onClick={() => handleDelete(deleteConfirm)} className="flex-1 px-4 py-2.5 bg-red-600 rounded-lg text-white text-sm font-bold hover:bg-red-700 transition-colors">Remove</button>
            </div>
          </div>
        </div>
      )}

      {/* Modals */}
      {showAddModal && <StaffModal onClose={() => setShowAddModal(false)} onSave={handleSave} />}
      {editMember   && <StaffModal staff={editMember} onClose={() => setEditMember(null)} onSave={handleSave} />}
    </div>
  );
}