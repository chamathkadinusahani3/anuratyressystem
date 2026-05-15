import React, { useState, useEffect, useCallback } from 'react';
import {
  X, Search, Plus, Wrench, Edit2, Trash2, Phone,
  Eye, EyeOff, KeyRound, Clock, CheckCircle, XCircle,
  AlertCircle, Coffee, Calendar, Stethoscope, ChevronDown,
  RefreshCw, Users, UserCheck, UserX, Ban, LogIn
} from 'lucide-react';

// ── API base ──────────────────────────────────────────────────────────────────
const API_BASE = (import.meta.env?.VITE_API_URL || 'https://anuratyres-backend-emm1774.vercel.app/api')
  .replace(/\/api$/, '');

async function apiFetch(path: string, opts?: RequestInit) {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...opts,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
  return data;
}

// ── Types ─────────────────────────────────────────────────────────────────────
type DayKey = 'Mon' | 'Tue' | 'Wed' | 'Thu' | 'Fri' | 'Sat' | 'Sun';
interface DayHours { on: boolean; start: string; end: string; }

interface StaffMember {
  id: string;
  name: string;
  role: string;
  username: string;
  phone: string;
  branch: string;
  status: 'active' | 'on_break' | 'off';
  bayNumber: string | null;
  clockInAt: string | null;
  workingHours?: Record<DayKey, DayHours>;
}

type LeaveType   = 'Annual Leave' | 'Sick Leave' | 'Break Request' | 'Tomorrow Off';
type LeaveStatus = 'Pending' | 'Approved' | 'Denied';

interface LeaveRequest {
  id: number;
  staffId: string;
  staffName: string;
  type: LeaveType;
  date: string;
  reason: string;
  status: LeaveStatus;
  createdAt: string;
}

// ── Constants ─────────────────────────────────────────────────────────────────
const DAYS: DayKey[] = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const BRANCHES = ['Pannipitiya', 'Ratnapura', 'Kalawana', 'Nivithigala'];
const PORTAL_ROLES = [
  { value: 'mechanic',    label: 'Mechanic' },
  { value: 'supervisor',  label: 'Supervisor' },
  { value: 'super_admin', label: 'Super Admin' },
];
const STAFF_ROLES = [
  'Sales Executive', 'Branch Assistant', 'Supervisor', 'Branch Manager',
  'Data Entry Operator', 'Technician', 'Alignment Technician', 'Labour',
  'Lead Mechanic', 'Mechanic', 'Junior Mechanic', 'Tyre Technician',
  'Service Advisor', 'Manager', 'Cashier',
];
const DEFAULT_HOURS: Record<DayKey, DayHours> = {
  Mon: { on: true,  start: '08:00', end: '17:00' },
  Tue: { on: true,  start: '08:00', end: '17:00' },
  Wed: { on: true,  start: '08:00', end: '17:00' },
  Thu: { on: true,  start: '08:00', end: '17:00' },
  Fri: { on: true,  start: '08:00', end: '17:00' },
  Sat: { on: true,  start: '08:00', end: '17:00' },
  Sun: { on: false, start: '08:00', end: '17:00' },
};

// ── Helpers ───────────────────────────────────────────────────────────────────
const todayStr    = () => new Date().toISOString().split('T')[0];
const tomorrowStr = () => { const d = new Date(); d.setDate(d.getDate() + 1); return d.toISOString().split('T')[0]; };
const fmtDate     = (d: string) => new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });

function statusLabel(s: string) {
  if (s === 'active')   return 'Active';
  if (s === 'on_break') return 'On Break';
  return 'Off';
}
function statusClass(s: string) {
  if (s === 'active')   return 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30';
  if (s === 'on_break') return 'bg-amber-500/15 text-amber-400 border-amber-500/30';
  return 'bg-neutral-700/50 text-neutral-400 border-neutral-600/40';
}
function leaveStatusClass(s: LeaveStatus) {
  if (s === 'Approved') return 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30';
  if (s === 'Denied')   return 'bg-red-500/15 text-red-400 border-red-500/30';
  return 'bg-amber-500/15 text-amber-400 border-amber-500/30';
}

// ── Reusable components ───────────────────────────────────────────────────────
const Label = ({ children }: { children: React.ReactNode }) => (
  <label className="block text-xs font-semibold text-neutral-400 mb-1.5 uppercase tracking-wider">{children}</label>
);
const Input = (props: React.InputHTMLAttributes<HTMLInputElement>) => (
  <input {...props} className={`w-full px-3 py-2.5 bg-neutral-800 border border-neutral-700 rounded-lg text-white text-sm placeholder:text-neutral-600 focus:outline-none focus:border-[#FFD700] focus:ring-1 focus:ring-[#FFD700]/20 transition-all ${props.className ?? ''}`} />
);
const Select = (props: React.SelectHTMLAttributes<HTMLSelectElement>) => (
  <select {...props} className={`w-full px-3 py-2.5 bg-neutral-800 border border-neutral-700 rounded-lg text-white text-sm focus:outline-none focus:border-[#FFD700] transition-all ${props.className ?? ''}`} />
);

// ── MODAL: Add Staff ──────────────────────────────────────────────────────────
function AddStaffModal({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
  const [form, setForm] = useState({
    name: '', username: '', password: '', role: '', branch: BRANCHES[0],
    portalRole: 'mechanic', phone: '',
    workingHours: { ...DEFAULT_HOURS } as Record<DayKey, DayHours>,
  });
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState('');
  const [success, setSuccess]   = useState('');

  const set = (k: string, v: any) => setForm(f => ({ ...f, [k]: v }));
  const setDay = (day: DayKey, patch: Partial<DayHours>) =>
    setForm(f => ({ ...f, workingHours: { ...f.workingHours, [day]: { ...f.workingHours[day], ...patch } } }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim())         return setError('Name is required');
    if (!form.username.trim())     return setError('Username is required');
    if (form.password.length < 6)  return setError('Password must be at least 6 characters');
    if (!form.phone.trim())        return setError('Phone number is required');
    setError(''); setLoading(true);
    try {
      // POST /api/staff?action=register
      await apiFetch('/api/staff?action=register', {
        method: 'POST',
        body: JSON.stringify({
          username:     form.username.trim().toLowerCase(),
          password:     form.password,
          name:         form.name.trim(),
          role:         form.portalRole,
          branch:       form.branch,
          phone:        form.phone.trim(),
          workingHours: form.workingHours,
        }),
      });
      setSuccess(`Account created! Login: ${form.username.toLowerCase()} / ${form.password}`);
      setTimeout(() => { onSuccess(); onClose(); }, 2500);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/75 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
      <div className="bg-neutral-900 rounded-2xl border border-neutral-700 w-full max-w-lg shadow-2xl max-h-[92vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-800 flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-[#FFD700]/10 flex items-center justify-center">
              <Plus className="w-4 h-4 text-[#FFD700]" />
            </div>
            <h2 className="text-lg font-bold text-white">Add Staff Member</h2>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-neutral-500 hover:text-white hover:bg-neutral-800 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={submit} className="overflow-y-auto flex-1 p-6 space-y-5">
          {error   && <div className="px-4 py-3 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 text-sm">{error}</div>}
          {success && <div className="px-4 py-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-emerald-400 text-sm font-mono">{success}</div>}

          {/* Personal Info */}
          <div className="space-y-4">
            <div>
              <Label>Full Name *</Label>
              <Input value={form.name} onChange={e => set('name', e.target.value)} placeholder="e.g. Saman Perera" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Phone *</Label>
                <Input value={form.phone} onChange={e => set('phone', e.target.value)} placeholder="077-1234567" />
              </div>
              <div>
                <Label>Branch *</Label>
                <Select value={form.branch} onChange={e => set('branch', e.target.value)}>
                  {BRANCHES.map(b => <option key={b} value={b}>{b}</option>)}
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Staff Role</Label>
                <Select value={form.role} onChange={e => set('role', e.target.value)}>
                  <option value="">Select role…</option>
                  {STAFF_ROLES.map(r => <option key={r} value={r}>{r}</option>)}
                </Select>
              </div>
              <div>
                <Label>Portal Access Level *</Label>
                <Select value={form.portalRole} onChange={e => set('portalRole', e.target.value)}>
                  {PORTAL_ROLES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                </Select>
              </div>
            </div>
          </div>

          {/* Portal Login */}
          <div className="p-4 bg-neutral-800/60 border border-neutral-700/60 rounded-xl space-y-3">
            <div className="flex items-center gap-2 mb-1">
              <KeyRound className="w-3.5 h-3.5 text-[#FFD700]" />
              <span className="text-xs font-bold text-[#FFD700] uppercase tracking-wider">Portal Login Credentials</span>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Username *</Label>
                <Input value={form.username}
                  onChange={e => set('username', e.target.value.toLowerCase().replace(/\s/g, ''))}
                  placeholder="e.g. saman.p" autoComplete="off" />
              </div>
              <div>
                <Label>Password *</Label>
                <div className="relative">
                  <Input type={showPass ? 'text' : 'password'} value={form.password}
                    onChange={e => set('password', e.target.value)}
                    placeholder="Min 6 characters" autoComplete="new-password" className="pr-10" />
                  <button type="button" onClick={() => setShowPass(v => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-500 hover:text-white transition-colors">
                    {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            </div>
            {form.username && form.password.length >= 6 && (
              <div className="px-3 py-2 bg-neutral-900 rounded-lg border border-neutral-700 font-mono text-xs text-neutral-400">
                <span className="text-neutral-300">{form.username}</span>
                <span className="text-neutral-600 mx-2">/</span>
                <span className="text-neutral-300">{form.password}</span>
                <span className="ml-2 text-neutral-600">· {form.branch} · {form.portalRole}</span>
              </div>
            )}
          </div>

          {/* Working Hours */}
          <div className="p-4 bg-neutral-800/60 border border-neutral-700/60 rounded-xl space-y-3">
            <div className="flex items-center gap-2 mb-1">
              <Clock className="w-3.5 h-3.5 text-[#FFD700]" />
              <span className="text-xs font-bold text-[#FFD700] uppercase tracking-wider">Working Hours</span>
            </div>
            {DAYS.map(day => {
              const h = form.workingHours[day];
              return (
                <div key={day} className={`flex items-center gap-3 px-3 py-2 rounded-lg border transition-colors ${h.on ? 'bg-neutral-800 border-neutral-700' : 'bg-neutral-900 border-neutral-800'}`}>
                  <label className="flex items-center gap-2 cursor-pointer w-16 flex-shrink-0">
                    <input type="checkbox" checked={h.on} onChange={e => setDay(day, { on: e.target.checked })} className="accent-[#FFD700]" />
                    <span className={`text-xs font-semibold ${h.on ? 'text-white' : 'text-neutral-600'}`}>{day}</span>
                  </label>
                  {h.on ? (
                    <div className="flex items-center gap-2 flex-1">
                      <input type="time" value={h.start} onChange={e => setDay(day, { start: e.target.value })}
                        className="flex-1 px-2 py-1 bg-neutral-900 border border-neutral-700 rounded text-white text-xs focus:outline-none focus:border-[#FFD700]" />
                      <span className="text-neutral-600 text-xs">–</span>
                      <input type="time" value={h.end} onChange={e => setDay(day, { end: e.target.value })}
                        className="flex-1 px-2 py-1 bg-neutral-900 border border-neutral-700 rounded text-white text-xs focus:outline-none focus:border-[#FFD700]" />
                    </div>
                  ) : <span className="text-neutral-600 text-xs italic">Day off</span>}
                </div>
              );
            })}
          </div>

          {/* Footer */}
          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose}
              className="flex-1 px-4 py-2.5 border border-neutral-700 rounded-xl text-neutral-300 text-sm font-medium hover:bg-neutral-800 transition-colors">
              Cancel
            </button>
            <button type="submit" disabled={loading}
              className="flex-1 px-4 py-2.5 bg-[#FFD700] rounded-xl text-black text-sm font-bold hover:bg-[#FFD700]/90 transition-colors disabled:opacity-60 flex items-center justify-center gap-2">
              {loading ? <><div className="w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin" /> Registering…</> : 'Add Staff Member'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── MODAL: Edit Staff ─────────────────────────────────────────────────────────
function EditStaffModal({ member, onClose, onSuccess }: { member: StaffMember; onClose: () => void; onSuccess: () => void }) {
  const [form, setForm] = useState({
    name:     member.name,
    role:     member.role,
    branch:   member.branch,
    phone:    member.phone,
    password: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState('');

  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) return setError('Name is required');
    if (form.password && form.password.length < 6) return setError('Password must be at least 6 characters');
    setError(''); setLoading(true);
    try {
      // POST /api/staff?action=update
      await apiFetch('/api/staff?action=update', {
        method: 'POST',
        body: JSON.stringify({
          id:       member.id,
          name:     form.name.trim(),
          role:     form.role,
          branch:   form.branch,
          phone:    form.phone.trim(),
          ...(form.password ? { password: form.password } : {}),
        }),
      });
      onSuccess(); onClose();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/75 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
      <div className="bg-neutral-900 rounded-2xl border border-neutral-700 w-full max-w-md shadow-2xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-800">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center">
              <Edit2 className="w-4 h-4 text-blue-400" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">Edit Staff</h2>
              <p className="text-xs text-neutral-500">{member.username}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-neutral-500 hover:text-white hover:bg-neutral-800 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>
        <form onSubmit={submit} className="p-6 space-y-4">
          {error && <div className="px-4 py-3 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 text-sm">{error}</div>}
          <div>
            <Label>Full Name *</Label>
            <Input value={form.name} onChange={e => set('name', e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Role</Label>
              <Select value={form.role} onChange={e => set('role', e.target.value)}>
                <option value="">Select…</option>
                {STAFF_ROLES.map(r => <option key={r} value={r}>{r}</option>)}
              </Select>
            </div>
            <div>
              <Label>Branch</Label>
              <Select value={form.branch} onChange={e => set('branch', e.target.value)}>
                {BRANCHES.map(b => <option key={b} value={b}>{b}</option>)}
              </Select>
            </div>
          </div>
          <div>
            <Label>Phone</Label>
            <Input value={form.phone} onChange={e => set('phone', e.target.value)} placeholder="077-1234567" />
          </div>
          <div>
            <Label>New Password <span className="text-neutral-600 normal-case font-normal">(leave blank to keep current)</span></Label>
            <Input type="password" value={form.password} onChange={e => set('password', e.target.value)} placeholder="Min 6 characters" autoComplete="new-password" />
          </div>
          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose}
              className="flex-1 px-4 py-2.5 border border-neutral-700 rounded-xl text-neutral-300 text-sm font-medium hover:bg-neutral-800 transition-colors">
              Cancel
            </button>
            <button type="submit" disabled={loading}
              className="flex-1 px-4 py-2.5 bg-[#FFD700] rounded-xl text-black text-sm font-bold hover:bg-[#FFD700]/90 transition-colors disabled:opacity-60 flex items-center justify-center gap-2">
              {loading ? <><div className="w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin" /> Saving…</> : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── MODAL: Leave Request ──────────────────────────────────────────────────────
function LeaveModal({ staff, onClose, onSubmit }: {
  staff: StaffMember[];
  onClose: () => void;
  onSubmit: (req: Omit<LeaveRequest, 'id' | 'createdAt'>) => void;
}) {
  const [staffId, setStaffId] = useState(staff[0]?.id ?? '');
  const [type,    setType]    = useState<LeaveType>('Annual Leave');
  const [date,    setDate]    = useState(tomorrowStr());
  const [reason,  setReason]  = useState('');
  const [error,   setError]   = useState('');

  useEffect(() => { if (type === 'Tomorrow Off') setDate(tomorrowStr()); }, [type]);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!staffId) return setError('Select a staff member');
    setError('');
    const m = staff.find(s => s.id === staffId);
    onSubmit({ staffId, staffName: m?.name ?? '', type, date, reason: reason.trim(), status: 'Pending' });
    onClose();
  };

  const typeIcon = { 'Annual Leave': <Calendar className="w-3.5 h-3.5" />, 'Sick Leave': <Stethoscope className="w-3.5 h-3.5" />, 'Break Request': <Coffee className="w-3.5 h-3.5" />, 'Tomorrow Off': <AlertCircle className="w-3.5 h-3.5" /> };

  return (
    <div className="fixed inset-0 bg-black/75 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
      <div className="bg-neutral-900 rounded-2xl border border-neutral-700 w-full max-w-md shadow-2xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-800">
          <h2 className="text-base font-bold text-white">New Leave Request</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg text-neutral-500 hover:text-white hover:bg-neutral-800 transition-colors"><X className="w-4 h-4" /></button>
        </div>
        <form onSubmit={submit} className="p-6 space-y-4">
          {error && <div className="px-4 py-3 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 text-sm">{error}</div>}
          <div>
            <Label>Staff Member *</Label>
            <Select value={staffId} onChange={e => setStaffId(e.target.value)}>
              {staff.map(s => <option key={s.id} value={s.id}>{s.name} — {s.role}</option>)}
            </Select>
          </div>
          <div>
            <Label>Request Type *</Label>
            <div className="grid grid-cols-2 gap-2">
              {(['Annual Leave', 'Sick Leave', 'Break Request', 'Tomorrow Off'] as LeaveType[]).map(t => (
                <button key={t} type="button" onClick={() => setType(t)}
                  className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border text-sm font-medium transition-colors ${type === t ? 'bg-[#FFD700]/10 border-[#FFD700]/40 text-[#FFD700]' : 'bg-neutral-800 border-neutral-700 text-neutral-400 hover:text-white'}`}>
                  {typeIcon[t]} {t}
                </button>
              ))}
            </div>
          </div>
          {type !== 'Break Request' && (
            <div>
              <Label>{type === 'Tomorrow Off' ? 'Date (auto-set)' : 'Date *'}</Label>
              <Input type="date" value={date} min={todayStr()} readOnly={type === 'Tomorrow Off'} onChange={e => setDate(e.target.value)} />
              {type === 'Tomorrow Off' && <p className="text-xs text-neutral-500 mt-1">Auto-set to {fmtDate(tomorrowStr())}</p>}
            </div>
          )}
          <div>
            <Label>Reason <span className="text-neutral-600 normal-case font-normal">(optional)</span></Label>
            <textarea value={reason} onChange={e => setReason(e.target.value)} rows={3}
              placeholder={type === 'Sick Leave' ? 'e.g. Fever and cold…' : type === 'Break Request' ? 'e.g. 30 min lunch…' : 'e.g. Family commitment…'}
              className="w-full px-3 py-2.5 bg-neutral-800 border border-neutral-700 rounded-xl text-white text-sm placeholder:text-neutral-600 focus:outline-none focus:border-[#FFD700] transition-all resize-none"
            />
          </div>
          <div className="flex gap-3">
            <button type="button" onClick={onClose} className="flex-1 px-4 py-2.5 border border-neutral-700 rounded-xl text-neutral-300 text-sm font-medium hover:bg-neutral-800 transition-colors">Cancel</button>
            <button type="submit" className="flex-1 px-4 py-2.5 bg-[#FFD700] rounded-xl text-black text-sm font-bold hover:bg-[#FFD700]/90 transition-colors">Submit</button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── STATUS PATCH helper ───────────────────────────────────────────────────────
async function patchStatus(staffId: string, action: string, branch: string, date: string, extra?: object) {
  return apiFetch(`/api/staff?resource=status&id=${staffId}`, {
    method: 'PATCH',
    body: JSON.stringify({ action, branch, date, ...extra }),
  });
}

// ── MAIN PAGE ─────────────────────────────────────────────────────────────────
export function StaffPage() {
  const [staff,        setStaff]        = useState<StaffMember[]>([]);
  const [loading,      setLoading]      = useState(true);
  const [error,        setError]        = useState<string | null>(null);
  const [branch,       setBranch]       = useState(BRANCHES[0]);
  const [search,       setSearch]       = useState('');
  const [activeTab,    setActiveTab]    = useState<'directory' | 'leaves'>('directory');
  const [showAdd,      setShowAdd]      = useState(false);
  const [editMember,   setEditMember]   = useState<StaffMember | null>(null);
  const [deleteId,     setDeleteId]     = useState<string | null>(null);
  const [showLeave,    setShowLeave]    = useState(false);
  const [leaveFilter,  setLeaveFilter]  = useState<LeaveStatus | 'All'>('All');
  const [leaveRequests, setLeaveRequests] = useState<LeaveRequest[]>([]);
  const today = todayStr();

  // ── Fetch staff from backend ──────────────────────────────────────────────
  const fetchStaff = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      // GET /api/staff?branch=X&date=Y  (or no branch for all staff)
      const data: any[] = await apiFetch(`/api/staff?branch=${encodeURIComponent(branch)}&date=${today}`);
      const mapped: StaffMember[] = data.map((m: any) => ({
        id:        String(m._id || m.id),
        name:      m.name || '',
        role:      m.role || '',
        username:  m.username || '',
        phone:     m.phone || '',
        branch:    m.branch || branch,
        status:    m.dayStatus?.status ?? 'off',
        bayNumber: m.dayStatus?.bayNumber ? String(m.dayStatus.bayNumber) : null,
        clockInAt: m.dayStatus?.clockInAt ?? null,
        workingHours: m.workingHours,
      }));
      setStaff(mapped);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [branch, today]);

  useEffect(() => { fetchStaff(); }, [fetchStaff]);

  // ── Status change via PATCH ───────────────────────────────────────────────
  const changeStatus = async (member: StaffMember, newStatus: string) => {
    // Optimistic update
    setStaff(prev => prev.map(s => s.id === member.id ? { ...s, status: newStatus as any } : s));
    try {
      // Map UI status to API action
      let action = 'set_status';
      if (newStatus === 'active')   action = 'clock_in';
      if (newStatus === 'on_break') action = 'start_break';
      if (newStatus === 'off')      action = 'clock_out';
      await patchStatus(member.id, action, member.branch, today);
    } catch {
      fetchStaff(); // revert on error
    }
  };

  // ── Deactivate (soft delete) via POST /api/staff?action=deactivate ────────
  const handleDelete = async (id: string) => {
    setDeleteId(null);
    try {
      await apiFetch('/api/staff?action=deactivate', {
        method: 'POST',
        body: JSON.stringify({ id }),
      });
      setStaff(prev => prev.filter(s => s.id !== id));
    } catch (err: any) {
      alert(`Failed to deactivate: ${err.message}`);
    }
  };

  // ── Leave helpers ─────────────────────────────────────────────────────────
  const addLeave = (req: Omit<LeaveRequest, 'id' | 'createdAt'>) =>
    setLeaveRequests(prev => [...prev, { ...req, id: Date.now(), createdAt: new Date().toISOString() }]);

  const actOnLeave = (id: number, status: LeaveStatus) =>
    setLeaveRequests(prev => prev.map(r => r.id === id ? { ...r, status } : r));

  // ── Derived ───────────────────────────────────────────────────────────────
  const filtered     = staff.filter(s => s.name.toLowerCase().includes(search.toLowerCase()) || s.role.toLowerCase().includes(search.toLowerCase()));
  const activeCount  = staff.filter(s => s.status === 'active').length;
  const breakCount   = staff.filter(s => s.status === 'on_break').length;
  const offCount     = staff.filter(s => s.status === 'off').length;
  const pendingCount = leaveRequests.filter(r => r.status === 'Pending').length;
  const filteredLeaves = leaveFilter === 'All' ? leaveRequests : leaveRequests.filter(r => r.status === leaveFilter);

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">
      {/* ── Page header ── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-white">Staff Management</h2>
          <p className="text-neutral-500 text-sm mt-0.5">Manage staff, statuses and leave requests</p>
        </div>
        <div className="flex items-center gap-2">
          {/* Branch selector */}
          <Select value={branch} onChange={e => setBranch(e.target.value)} className="w-40">
            {BRANCHES.map(b => <option key={b} value={b}>{b}</option>)}
          </Select>
          <button onClick={fetchStaff} disabled={loading}
            className="p-2.5 bg-neutral-800 border border-neutral-700 rounded-xl text-neutral-400 hover:text-white transition-colors disabled:opacity-40">
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <button onClick={() => setShowLeave(true)}
            className="flex items-center gap-2 px-4 py-2.5 bg-neutral-800 border border-neutral-700 rounded-xl text-white text-sm font-medium hover:bg-neutral-700 transition-colors">
            <Calendar className="w-4 h-4 text-[#FFD700]" /> Leave Request
          </button>
          <button onClick={() => setShowAdd(true)}
            className="flex items-center gap-2 px-4 py-2.5 bg-[#FFD700] rounded-xl text-black text-sm font-bold hover:bg-[#FFD700]/90 transition-colors">
            <Plus className="w-4 h-4" /> Add Staff
          </button>
        </div>
      </div>

      {/* ── Error banner ── */}
      {error && (
        <div className="flex items-center justify-between px-4 py-3 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 text-sm">
          <span>⚠ {error}</span>
          <button onClick={fetchStaff} className="underline hover:no-underline">Retry</button>
        </div>
      )}

      {/* ── Stats ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'Total Staff',      value: staff.length,  color: 'text-white',         sub: branch,          icon: <Users className="w-5 h-5" /> },
          { label: 'Active / Clocked In', value: activeCount,  color: 'text-emerald-400',  sub: 'working now',   icon: <UserCheck className="w-5 h-5" /> },
          { label: 'On Break',         value: breakCount,    color: 'text-amber-400',      sub: 'currently',     icon: <Coffee className="w-5 h-5" /> },
          { label: 'Off / Absent',     value: offCount,      color: 'text-neutral-400',    sub: 'today',         icon: <UserX className="w-5 h-5" /> },
        ].map(s => (
          <div key={s.label} className="bg-neutral-900 border border-neutral-800 rounded-xl p-4">
            <div className={`mb-3 ${s.color} opacity-60`}>{s.icon}</div>
            <div className={`text-2xl font-bold ${s.color}`}>{s.value}</div>
            <div className="text-white text-xs font-medium mt-0.5">{s.label}</div>
            <div className="text-neutral-600 text-xs">{s.sub}</div>
          </div>
        ))}
      </div>

      {/* ── Tabs ── */}
      <div className="flex gap-1 bg-neutral-900 border border-neutral-800 rounded-xl p-1 w-fit">
        {[
          { key: 'directory', label: 'Directory', icon: <Users className="w-3.5 h-3.5" /> },
          { key: 'leaves',    label: `Leave Board${pendingCount > 0 ? ` · ${pendingCount}` : ''}`, icon: <Calendar className="w-3.5 h-3.5" /> },
        ].map(tab => (
          <button key={tab.key} onClick={() => setActiveTab(tab.key as any)}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${activeTab === tab.key ? 'bg-[#FFD700] text-black' : 'text-neutral-400 hover:text-white'}`}>
            {tab.icon} {tab.label}
          </button>
        ))}
      </div>

      {/* ── Tab: Directory ── */}
      {activeTab === 'directory' && (
        <div className="bg-neutral-900 border border-neutral-800 rounded-2xl overflow-hidden">
          {/* Search bar */}
          <div className="px-5 py-4 border-b border-neutral-800 flex items-center gap-3">
            <div className="relative flex-1 max-w-xs">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-500" />
              <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search name or role…" className="pl-9" />
            </div>
            <span className="text-neutral-600 text-sm">{filtered.length} staff</span>
          </div>

          {/* Loading state */}
          {loading && (
            <div className="flex items-center justify-center py-16 gap-2 text-neutral-500 text-sm">
              <div className="w-4 h-4 border-2 border-neutral-700 border-t-[#FFD700] rounded-full animate-spin" />
              Loading staff…
            </div>
          )}

          {/* Empty state */}
          {!loading && filtered.length === 0 && (
            <div className="py-16 text-center text-neutral-500 text-sm">No staff found</div>
          )}

          {/* Table */}
          {!loading && filtered.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-neutral-950 border-b border-neutral-800">
                    {['Staff Member', 'Role', 'Status', 'Bay', 'Phone', 'Actions'].map(h => (
                      <th key={h} className={`px-4 py-3 text-left text-xs font-bold text-neutral-500 uppercase tracking-wider ${h === 'Actions' ? 'text-right' : ''}`}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-800">
                  {filtered.map(m => (
                    <tr key={m.id} className="hover:bg-neutral-800/40 transition-colors">
                      {/* Name */}
                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-neutral-800 border border-neutral-700 flex items-center justify-center text-[#FFD700] font-bold text-sm flex-shrink-0">
                            {m.name.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <div className="text-white font-medium text-sm leading-tight">{m.name}</div>
                            <div className="text-neutral-600 text-xs font-mono">{m.username}</div>
                          </div>
                        </div>
                      </td>
                      {/* Role */}
                      <td className="px-4 py-3.5 text-neutral-400 text-sm">{m.role || '—'}</td>
                      {/* Status — dropdown maps to correct PATCH action */}
                      <td className="px-4 py-3.5">
                        <select value={m.status} onChange={e => changeStatus(m, e.target.value)}
                          className={`px-2.5 py-1 rounded-full text-xs font-semibold border cursor-pointer focus:outline-none appearance-none ${statusClass(m.status)}`}
                          style={{ background: 'transparent' }}>
                          <option value="active">Active</option>
                          <option value="on_break">On Break</option>
                          <option value="off">Off</option>
                        </select>
                      </td>
                      {/* Bay */}
                      <td className="px-4 py-3.5">
                        {m.bayNumber
                          ? <span className="flex items-center gap-1 text-[#FFD700] text-xs font-medium"><Wrench className="w-3 h-3" /> Bay {m.bayNumber}</span>
                          : <span className="text-neutral-700 text-xs">—</span>}
                      </td>
                      {/* Phone */}
                      <td className="px-4 py-3.5">
                        {m.phone
                          ? <a href={`tel:${m.phone}`} className="flex items-center gap-1.5 text-neutral-400 hover:text-[#FFD700] text-xs transition-colors">
                              <Phone className="w-3.5 h-3.5" /> {m.phone}
                            </a>
                          : <span className="text-neutral-700 text-xs">—</span>}
                      </td>
                      {/* Actions */}
                      <td className="px-4 py-3.5">
                        <div className="flex items-center justify-end gap-1.5">
                          <button onClick={() => setEditMember(m)}
                            className="flex items-center gap-1 px-2.5 py-1.5 bg-neutral-800 hover:bg-blue-500/10 hover:text-blue-400 border border-neutral-700 hover:border-blue-500/30 rounded-lg text-neutral-400 text-xs font-medium transition-colors">
                            <Edit2 className="w-3 h-3" /> Edit
                          </button>
                          <button onClick={() => setDeleteId(m.id)}
                            className="p-1.5 rounded-lg text-neutral-600 hover:text-red-400 hover:bg-red-500/10 transition-colors">
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
      )}

      {/* ── Tab: Leave Board ── */}
      {activeTab === 'leaves' && (
        <div className="space-y-4">
          {/* Filter row */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-neutral-600 text-sm">Show:</span>
            {(['All', 'Pending', 'Approved', 'Denied'] as const).map(f => (
              <button key={f} onClick={() => setLeaveFilter(f)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors border ${
                  leaveFilter === f
                    ? 'bg-[#FFD700] text-black border-[#FFD700]'
                    : 'bg-neutral-900 border-neutral-800 text-neutral-400 hover:text-white hover:border-neutral-700'
                }`}>
                {f}
                {f === 'Pending' && pendingCount > 0 && (
                  <span className="ml-1.5 px-1.5 py-0.5 bg-amber-500 text-black rounded-full text-[10px] font-bold">{pendingCount}</span>
                )}
              </button>
            ))}
            <button onClick={() => setShowLeave(true)}
              className="ml-auto flex items-center gap-1.5 px-3 py-1.5 bg-neutral-900 border border-neutral-800 rounded-lg text-neutral-400 hover:text-white text-xs font-medium transition-colors">
              <Plus className="w-3.5 h-3.5" /> New Request
            </button>
          </div>

          {filteredLeaves.length === 0 ? (
            <div className="bg-neutral-900 border border-neutral-800 rounded-2xl py-16 text-center text-neutral-500 text-sm">
              No {leaveFilter !== 'All' ? leaveFilter.toLowerCase() : ''} requests
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {filteredLeaves.map(req => (
                <div key={req.id} className={`bg-neutral-900 border rounded-2xl p-4 space-y-3 ${
                  req.status === 'Pending' ? 'border-amber-500/20' : req.status === 'Approved' ? 'border-emerald-500/20' : 'border-red-500/20'
                }`}>
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-full bg-neutral-800 border border-neutral-700 flex items-center justify-center text-[#FFD700] font-bold text-sm">
                        {(req.staffName.charAt(0) || '?').toUpperCase()}
                      </div>
                      <div>
                        <div className="text-white text-sm font-semibold leading-tight">{req.staffName || 'Unknown'}</div>
                        <div className="text-neutral-600 text-xs">{fmtDate(req.createdAt)}</div>
                      </div>
                    </div>
                    <span className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold border ${leaveStatusClass(req.status)}`}>
                      {req.status === 'Approved' && <CheckCircle className="w-3 h-3" />}
                      {req.status === 'Denied'   && <XCircle className="w-3 h-3" />}
                      {req.status === 'Pending'  && <AlertCircle className="w-3 h-3" />}
                      {req.status}
                    </span>
                  </div>
                  <div className="flex items-center justify-between px-3 py-2 bg-neutral-800 rounded-xl">
                    <span className="text-neutral-200 text-sm font-medium">{req.type}</span>
                    {req.type !== 'Break Request' && (
                      <span className="text-neutral-500 text-xs">{fmtDate(req.date)}</span>
                    )}
                  </div>
                  {req.reason && <p className="text-neutral-500 text-xs italic px-1">"{req.reason}"</p>}
                  {req.status === 'Pending' && (
                    <div className="flex gap-2">
                      <button onClick={() => actOnLeave(req.id, 'Approved')}
                        className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-emerald-400 text-xs font-semibold hover:bg-emerald-500/20 transition-colors">
                        <CheckCircle className="w-3.5 h-3.5" /> Approve
                      </button>
                      <button onClick={() => actOnLeave(req.id, 'Denied')}
                        className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 text-xs font-semibold hover:bg-red-500/20 transition-colors">
                        <XCircle className="w-3.5 h-3.5" /> Deny
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Delete confirm ── */}
      {deleteId !== null && (
        <div className="fixed inset-0 bg-black/75 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
          <div className="bg-neutral-900 rounded-2xl border border-neutral-700 w-full max-w-sm p-6 shadow-2xl">
            <h3 className="text-base font-bold text-white mb-1">Deactivate Staff Member?</h3>
            <p className="text-neutral-400 text-sm mb-5">They will be marked as inactive and removed from the roster. This can be reversed from the database.</p>
            <div className="flex gap-3">
              <button onClick={() => setDeleteId(null)}
                className="flex-1 px-4 py-2.5 border border-neutral-700 rounded-xl text-neutral-300 text-sm hover:bg-neutral-800 transition-colors">
                Cancel
              </button>
              <button onClick={() => handleDelete(deleteId)}
                className="flex-1 px-4 py-2.5 bg-red-600 rounded-xl text-white text-sm font-bold hover:bg-red-700 transition-colors">
                Deactivate
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modals ── */}
      {showAdd    && <AddStaffModal  onClose={() => setShowAdd(false)}    onSuccess={fetchStaff} />}
      {editMember && <EditStaffModal member={editMember} onClose={() => setEditMember(null)} onSuccess={fetchStaff} />}
      {showLeave  && <LeaveModal     staff={staff} onClose={() => setShowLeave(false)} onSubmit={addLeave} />}
    </div>
  );
}