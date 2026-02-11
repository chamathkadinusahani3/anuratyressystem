import React, { useState } from 'react';
import { X, Search, Plus, Wrench, Edit2, Trash2, Phone, Mail } from 'lucide-react';

interface StaffMember {
  id: number;
  name: string;
  role: string;
  status: 'Available' | 'Busy' | 'On Leave';
  contact: string;
  email: string;
  bay: string;
  emergencyContact: string;
}

const initialStaff: StaffMember[] = [
  { id: 1, name: 'Saman Perera', role: 'Lead Mechanic', status: 'Available', contact: '077-1234567', email: 'saman@anuratyres.lk', bay: 'Bay 1', emergencyContact: '071-1234567' },
  { id: 2, name: 'John Doe', role: 'Mechanic', status: 'Busy', contact: '071-9876543', email: 'john@anuratyres.lk', bay: 'Bay 2', emergencyContact: '' },
  { id: 3, name: 'Amal Silva', role: 'Tyre Technician', status: 'Available', contact: '076-5554444', email: 'amal@anuratyres.lk', bay: '-', emergencyContact: '' },
  { id: 4, name: 'Ruwan Dias', role: 'Tyre Technician', status: 'On Leave', contact: '070-1112222', email: 'ruwan@anuratyres.lk', bay: '-', emergencyContact: '077-1112222' },
  { id: 5, name: 'Kasun Raj', role: 'Junior Mechanic', status: 'Available', contact: '077-9998888', email: 'kasun@anuratyres.lk', bay: 'Bay 3', emergencyContact: '' },
];

function statusColor(status: string) {
  if (status === 'Available') return 'bg-green-500/20 text-green-400 border border-green-500/30';
  if (status === 'Busy') return 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30';
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
    name: staff?.name ?? '',
    role: staff?.role ?? '',
    status: (staff?.status ?? 'Available') as StaffMember['status'],
    contact: staff?.contact ?? '',
    email: staff?.email ?? '',
    bay: staff?.bay ?? '-',
    emergencyContact: staff?.emergencyContact ?? '',
  });
  const [error, setError] = useState('');

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) return setError('Name is required');
    if (!form.role) return setError('Role is required');
    if (!form.contact.trim()) return setError('Contact number is required');
    setError('');
    onSave({ id: staff?.id, ...form, name: form.name.trim(), contact: form.contact.trim() });
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
      <div className="bg-neutral-900 rounded-xl border border-neutral-700 w-full max-w-lg shadow-2xl max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-neutral-900 border-b border-neutral-700 px-6 py-4 flex justify-between items-center">
          <h2 className="text-xl font-bold text-white">{isEdit ? 'Edit Staff Member' : 'Add Staff Member'}</h2>
          <button onClick={onClose} className="text-neutral-400 hover:text-white p-1 rounded-lg hover:bg-neutral-800 transition-colors"><X className="w-5 h-5" /></button>
        </div>
        <form onSubmit={submit} className="p-6 space-y-4">
          {error && <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm">{error}</div>}

          <div>
            <label className="text-sm font-medium text-white block mb-1.5">Full Name *</label>
            <input value={form.name} onChange={e => setForm({...form, name: e.target.value})} placeholder="e.g. Saman Perera"
              className="w-full px-3 py-2.5 bg-neutral-800 border border-neutral-700 rounded-lg text-white text-sm focus:outline-none focus:border-[#FFD700] placeholder:text-neutral-600 transition-colors" />
          </div>

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
            <button type="submit" className="flex-1 px-4 py-2.5 bg-[#FFD700] rounded-lg text-black text-sm font-bold hover:bg-[#FFD700]/90 transition-colors">{isEdit ? 'Save Changes' : 'Add Staff Member'}</button>
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
  const [staff, setStaff] = useState<StaffMember[]>(initialStaff);
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
        <button onClick={() => setShowAddModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-[#FFD700] rounded-lg text-black text-sm font-bold hover:bg-[#FFD700]/90 transition-colors">
          <Plus className="w-4 h-4" /> Add Staff Member
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Total Staff', value: staff.length, color: 'text-white' },
          { label: 'Available', value: staff.filter(s => s.status === 'Available').length, color: 'text-green-400' },
          { label: 'On Leave', value: staff.filter(s => s.status === 'On Leave').length, color: 'text-red-400' },
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
      {editMember && <StaffModal staff={editMember} onClose={() => setEditMember(null)} onSave={handleSave} />}
    </div>
  );
}