import React, { useState, useEffect, useCallback } from 'react';
import {
  X, Search, Plus, Wrench, Edit2, Trash2, Phone,
  Eye, EyeOff, KeyRound, Clock, CheckCircle, XCircle,
  AlertCircle, Coffee, Calendar, Stethoscope, ChevronDown,
  RefreshCw, Users, UserCheck, UserX, Ban
} from 'lucide-react';

const API = (import.meta.env?.VITE_API_URL || 'https://anuratyres-backend-emm1774.vercel.app/api')
  .replace(/\/api$/, '');

type DayKey = 'Mon' | 'Tue' | 'Wed' | 'Thu' | 'Fri' | 'Sat' | 'Sun';

interface DayHours {
  on: boolean;
  start: string;
  end: string;
}

interface StaffMember {
  id: number;
  name: string;
  role: string;
  status: 'Available' | 'Busy' | 'On Leave' | 'On Break';
  contact: string;
  email: string;
  bay: string;
  emergencyContact: string;
  workingHours?: Record<DayKey, DayHours>;
  disabledDays?: string[];
}

type LeaveType   = 'Annual Leave' | 'Sick Leave' | 'Break Request' | 'Tomorrow Off';
type LeaveStatus = 'Pending' | 'Approved' | 'Denied';

interface LeaveRequest {
  id: number;
  staffId: number;
  staffName: string;
  type: LeaveType;
  date: string;
  reason: string;
  status: LeaveStatus;
  createdAt: string;
}

const DAYS: DayKey[] = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

const DEFAULT_WORKING_HOURS: Record<DayKey, DayHours> = {
  Mon: { on: true,  start: '08:00', end: '17:00' },
  Tue: { on: true,  start: '08:00', end: '17:00' },
  Wed: { on: true,  start: '08:00', end: '17:00' },
  Thu: { on: true,  start: '08:00', end: '17:00' },
  Fri: { on: true,  start: '08:00', end: '17:00' },
  Sat: { on: true,  start: '08:00', end: '17:00' },
  Sun: { on: false, start: '08:00', end: '17:00' },
};

// ── All staff roles used in both Add/Edit modal and any role dropdown ──
const STAFF_ROLES: string[] = [
  'Sales Executive',
  'Branch Assistant',
  'Supervisor',
  'Branch Manager',
  'Data Entry Operator',
  'Technician',
  'Alignment Technician',
  'Labour',
  'Lead Mechanic',
  'Mechanic',
  'Junior Mechanic',
  'Tyre Technician',
  'Service Advisor',
  'Manager',
  'Cashier',
];

function todayStr()    { return new Date().toISOString().split('T')[0]; }
function tomorrowStr() { const d = new Date(); d.setDate(d.getDate() + 1); return d.toISOString().split('T')[0]; }
function fmtDate(d: string) {
  return new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

function statusColor(status: string) {
  if (status === 'Available') return 'bg-green-500/20 text-green-400 border border-green-500/30';
  if (status === 'Busy')      return 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30';
  if (status === 'On Break')  return 'bg-orange-500/20 text-orange-400 border border-orange-500/30';
  return 'bg-red-500/20 text-red-400 border border-red-500/30';
}

function leaveTypeIcon(type: LeaveType) {
  if (type === 'Break Request') return <Coffee className="w-3.5 h-3.5" />;
  if (type === 'Sick Leave')    return <Stethoscope className="w-3.5 h-3.5" />;
  if (type === 'Tomorrow Off')  return <AlertCircle className="w-3.5 h-3.5" />;
  return <Calendar className="w-3.5 h-3.5" />;
}

function leaveStatusBadge(status: LeaveStatus) {
  if (status === 'Approved') return 'bg-green-500/20 text-green-400 border border-green-500/30';
  if (status === 'Denied')   return 'bg-red-500/20 text-red-400 border border-red-500/30';
  return 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30';
}

function buildHoursSummary(wh: Record<DayKey, DayHours>): string {
  const onDays = DAYS.filter(d => wh[d].on);
  if (onDays.length === 0) return 'No working days';
  const ranges: string[] = [];
  let rangeStart = onDays[0];
  let prev = onDays[0];
  for (let i = 1; i <= onDays.length; i++) {
    const cur = onDays[i];
    const prevIdx = DAYS.indexOf(prev);
    const curIdx  = cur ? DAYS.indexOf(cur) : -1;
    if (curIdx !== prevIdx + 1) {
      ranges.push(rangeStart === prev ? rangeStart : `${rangeStart}–${prev}`);
      rangeStart = cur as DayKey;
      prev = cur as DayKey;
    } else {
      prev = cur as DayKey;
    }
  }
  const firstOn = onDays[0];
  return `${ranges.join(', ')} · ${wh[firstOn].start}–${wh[firstOn].end}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// LEAVE REQUEST MODAL
// ─────────────────────────────────────────────────────────────────────────────
function LeaveRequestModal({ staff, onClose, onSubmit }: {
  staff: StaffMember[];
  onClose: () => void;
  onSubmit: (req: Omit<LeaveRequest, 'id' | 'createdAt'>) => void;
}) {
  const [staffId, setStaffId] = useState<number | ''>(staff[0]?.id ?? '');
  const [type,    setType]    = useState<LeaveType>('Annual Leave');
  const [date,    setDate]    = useState(tomorrowStr());
  const [reason,  setReason]  = useState('');
  const [error,   setError]   = useState('');

  useEffect(() => {
    if (type === 'Tomorrow Off') setDate(tomorrowStr());
  }, [type]);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (staffId === '') return setError('Select a staff member');
    if (!date)          return setError('Select a date');
    setError('');
    const member = staff.find(s => s.id === staffId);
    onSubmit({
      staffId: staffId as number,
      staffName: member?.name ?? '',
      type, date,
      reason: reason.trim(),
      status: 'Pending',
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
      <div className="bg-neutral-900 rounded-xl border border-neutral-700 w-full max-w-md shadow-2xl">
        <div className="border-b border-neutral-700 px-6 py-4 flex justify-between items-center">
          <h2 className="text-xl font-bold text-white">New Leave / Break Request</h2>
          <button onClick={onClose} className="text-neutral-400 hover:text-white p-1 rounded-lg hover:bg-neutral-800 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>
        <form onSubmit={submit} className="p-6 space-y-4">
          {error && (
            <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm">{error}</div>
          )}
          <div>
            <label className="text-sm font-medium text-white block mb-1.5">Staff Member *</label>
            <select value={staffId} onChange={e => setStaffId(Number(e.target.value))}
              className="w-full px-3 py-2.5 bg-neutral-800 border border-neutral-700 rounded-lg text-white text-sm focus:outline-none focus:border-[#FFD700] transition-colors">
              {staff.map(s => <option key={s.id} value={s.id}>{s.name} — {s.role}</option>)}
            </select>
          </div>
          <div>
            <label className="text-sm font-medium text-white block mb-1.5">Request Type *</label>
            <div className="grid grid-cols-2 gap-2">
              {(['Annual Leave', 'Sick Leave', 'Break Request', 'Tomorrow Off'] as LeaveType[]).map(t => (
                <button key={t} type="button" onClick={() => setType(t)}
                  className={`flex items-center gap-2 px-3 py-2.5 rounded-lg border text-sm font-medium transition-colors ${
                    type === t
                      ? 'bg-[#FFD700]/10 border-[#FFD700]/50 text-[#FFD700]'
                      : 'bg-neutral-800 border-neutral-700 text-neutral-400 hover:text-white hover:border-neutral-600'
                  }`}>
                  {leaveTypeIcon(t)} {t}
                </button>
              ))}
            </div>
          </div>
          {type !== 'Break Request' && (
            <div>
              <label className="text-sm font-medium text-white block mb-1.5">
                {type === 'Tomorrow Off' ? 'Date (tomorrow)' : 'Date *'}
              </label>
              <input type="date" value={date} min={todayStr()}
                readOnly={type === 'Tomorrow Off'}
                onChange={e => setDate(e.target.value)}
                className="w-full px-3 py-2.5 bg-neutral-800 border border-neutral-700 rounded-lg text-white text-sm focus:outline-none focus:border-[#FFD700] transition-colors"
              />
              {type === 'Tomorrow Off' && (
                <p className="text-xs text-neutral-500 mt-1">Automatically set to tomorrow ({fmtDate(tomorrowStr())})</p>
              )}
            </div>
          )}
          <div>
            <label className="text-sm font-medium text-white block mb-1.5">Reason <span className="text-neutral-500">(optional)</span></label>
            <textarea value={reason} onChange={e => setReason(e.target.value)} rows={3}
              placeholder={
                type === 'Sick Leave'    ? 'e.g. Fever and cold...' :
                type === 'Break Request' ? 'e.g. 30 min lunch break...' :
                type === 'Tomorrow Off'  ? "e.g. Family commitment..." :
                'e.g. Annual family vacation...'
              }
              className="w-full px-3 py-2.5 bg-neutral-800 border border-neutral-700 rounded-lg text-white text-sm focus:outline-none focus:border-[#FFD700] placeholder:text-neutral-600 transition-colors resize-none"
            />
          </div>
          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose}
              className="flex-1 px-4 py-2.5 border border-neutral-700 rounded-lg text-neutral-300 text-sm font-medium hover:bg-neutral-800 transition-colors">
              Cancel
            </button>
            <button type="submit"
              className="flex-1 px-4 py-2.5 bg-[#FFD700] rounded-lg text-black text-sm font-bold hover:bg-[#FFD700]/90 transition-colors">
              Submit Request
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MANAGER DISABLE DAYS MODAL
// ─────────────────────────────────────────────────────────────────────────────
function DisableDaysModal({ member, onClose, onSave }: {
  member: StaffMember;
  onClose: () => void;
  onSave: (id: number, disabledDays: string[]) => void;
}) {
  const [days,   setDays]   = useState<string[]>(member.disabledDays ?? []);
  const [newDay, setNewDay] = useState('');

  const addDay = () => {
    if (!newDay || days.includes(newDay)) return;
    setDays(prev => [...prev, newDay].sort());
    setNewDay('');
  };
  const removeDay = (d: string) => setDays(prev => prev.filter(x => x !== d));

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
      <div className="bg-neutral-900 rounded-xl border border-neutral-700 w-full max-w-sm shadow-2xl">
        <div className="border-b border-neutral-700 px-6 py-4 flex justify-between items-center">
          <div>
            <h2 className="text-lg font-bold text-white">Manager — Block Days</h2>
            <p className="text-xs text-neutral-500 mt-0.5">{member.name} · {member.role}</p>
          </div>
          <button onClick={onClose} className="text-neutral-400 hover:text-white p-1 rounded-lg hover:bg-neutral-800 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-6 space-y-4">
          <p className="text-xs text-neutral-500">
            Block specific dates for this staff member. Blocked days count as "On Leave" in the system — the staff member cannot be assigned jobs on those days.
          </p>

          <div>
            <p className="text-xs font-semibold text-neutral-400 mb-2">Quick add</p>
            <div className="flex gap-2">
              <button onClick={() => { setNewDay(todayStr()); }}
                className="px-3 py-1.5 bg-neutral-800 border border-neutral-700 rounded-lg text-neutral-400 text-xs hover:border-neutral-600 hover:text-white transition-colors">
                Today
              </button>
              <button onClick={() => { setNewDay(tomorrowStr()); }}
                className="px-3 py-1.5 bg-neutral-800 border border-neutral-700 rounded-lg text-neutral-400 text-xs hover:border-neutral-600 hover:text-white transition-colors">
                Tomorrow
              </button>
            </div>
          </div>

          <div className="flex gap-2">
            <input type="date" value={newDay} min={todayStr()} onChange={e => setNewDay(e.target.value)}
              className="flex-1 px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-white text-sm focus:outline-none focus:border-[#FFD700] transition-colors"
            />
            <button onClick={addDay}
              className="px-3 py-2 bg-[#FFD700] rounded-lg text-black text-sm font-bold hover:bg-[#FFD700]/90 transition-colors">
              <Plus className="w-4 h-4" />
            </button>
          </div>

          <div className="space-y-2 max-h-52 overflow-y-auto">
            {days.length === 0 ? (
              <div className="text-neutral-600 text-sm text-center py-6 bg-neutral-800/50 rounded-lg">
                <Ban className="w-5 h-5 mx-auto mb-2 text-neutral-700" />
                No days blocked
              </div>
            ) : days.map(d => (
              <div key={d} className="flex items-center justify-between px-3 py-2.5 bg-red-500/10 border border-red-500/20 rounded-lg">
                <div className="flex items-center gap-2">
                  <Ban className="w-3.5 h-3.5 text-red-400" />
                  <span className="text-sm text-red-300 font-medium">{fmtDate(d)}</span>
                  {d === todayStr()    && <span className="text-[10px] text-red-500 font-bold ml-1">TODAY</span>}
                  {d === tomorrowStr()&& <span className="text-[10px] text-orange-500 font-bold ml-1">TOMORROW</span>}
                </div>
                <button onClick={() => removeDay(d)} className="text-red-500 hover:text-red-300 transition-colors">
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>

          {days.length > 0 && (
            <p className="text-xs text-neutral-600">
              {days.length} day{days.length > 1 ? 's' : ''} blocked — staff member will show as "On Leave" on those days.
            </p>
          )}

          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose}
              className="flex-1 px-4 py-2.5 border border-neutral-700 rounded-lg text-neutral-300 text-sm font-medium hover:bg-neutral-800 transition-colors">
              Cancel
            </button>
            <button onClick={() => { onSave(member.id, days); onClose(); }}
              className="flex-1 px-4 py-2.5 bg-[#FFD700] rounded-lg text-black text-sm font-bold hover:bg-[#FFD700]/90 transition-colors">
              Save Changes
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MANAGER ALL-STAFF DISABLE DAYS PANEL
// ─────────────────────────────────────────────────────────────────────────────
function ManagerDisableDaysPanel({ staff, onSave }: {
  staff: StaffMember[];
  onSave: (id: number, disabledDays: string[]) => void;
}) {
  const [expanded, setExpanded] = useState<number | null>(null);
  const [newDays,  setNewDays]  = useState<Record<number, string>>({});

  const addDay = (memberId: number) => {
    const d = newDays[memberId];
    if (!d) return;
    const member = staff.find(s => s.id === memberId);
    if (!member) return;
    const existing = member.disabledDays ?? [];
    if (existing.includes(d)) return;
    onSave(memberId, [...existing, d].sort());
    setNewDays(prev => ({ ...prev, [memberId]: '' }));
  };

  const removeDay = (memberId: number, day: string) => {
    const member = staff.find(s => s.id === memberId);
    if (!member) return;
    onSave(memberId, (member.disabledDays ?? []).filter(x => x !== day));
  };

  return (
    <div className="bg-neutral-900 border border-neutral-800 rounded-xl overflow-hidden">
      <div className="px-5 py-4 border-b border-neutral-800 flex items-center gap-3">
        <Ban className="w-4 h-4 text-[#FFD700]" />
        <h3 className="font-bold text-white text-base">Manager — Disable Leave Days</h3>
      </div>
      <div className="p-4 space-y-3">
        <p className="text-xs text-neutral-500">
          Block specific dates per staff member. Blocked dates count as approved leave — staff will show as "On Leave" and cannot be assigned jobs on those days.
        </p>
        {staff.length === 0 ? (
          <div className="text-neutral-600 text-sm text-center py-6">No staff loaded</div>
        ) : staff.map(member => {
          const blocked     = member.disabledDays ?? [];
          const isExpanded  = expanded === member.id;
          const blockedToday = blocked.includes(todayStr());

          return (
            <div key={member.id} className="bg-neutral-800/50 border border-neutral-700 rounded-xl overflow-hidden">
              <button
                onClick={() => setExpanded(isExpanded ? null : member.id)}
                className="w-full flex items-center justify-between px-4 py-3 hover:bg-neutral-800 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-neutral-800 border border-neutral-700 flex items-center justify-center text-[#FFD700] font-bold text-sm flex-shrink-0">
                    {member.name.charAt(0)}
                  </div>
                  <div className="text-left">
                    <div className="text-white text-sm font-semibold leading-tight">{member.name}</div>
                    <div className="text-neutral-500 text-xs">{member.role}</div>
                  </div>
                  {blockedToday && (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-500/20 text-red-400 border border-red-500/30 ml-1">
                      OFF TODAY
                    </span>
                  )}
                  {blocked.length > 0 && (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-neutral-700 text-neutral-400">
                      {blocked.length} blocked
                    </span>
                  )}
                </div>
                <ChevronDown className={`w-4 h-4 text-neutral-500 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
              </button>

              {isExpanded && (
                <div className="px-4 pb-4 pt-1 border-t border-neutral-700 space-y-3">
                  <div className="flex gap-2">
                    <input type="date" value={newDays[member.id] ?? ''} min={todayStr()}
                      onChange={e => setNewDays(prev => ({ ...prev, [member.id]: e.target.value }))}
                      className="flex-1 px-3 py-2 bg-neutral-900 border border-neutral-700 rounded-lg text-white text-sm focus:outline-none focus:border-[#FFD700] transition-colors"
                    />
                    <button onClick={() => addDay(member.id)}
                      className="px-3 py-2 bg-[#FFD700] rounded-lg text-black text-sm font-bold hover:bg-[#FFD700]/90 transition-colors">
                      <Plus className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => setNewDays(prev => ({ ...prev, [member.id]: todayStr() }))}
                      className="px-2.5 py-1 bg-neutral-800 border border-neutral-700 rounded text-neutral-400 text-xs hover:text-white hover:border-neutral-600 transition-colors">
                      Today
                    </button>
                    <button onClick={() => setNewDays(prev => ({ ...prev, [member.id]: tomorrowStr() }))}
                      className="px-2.5 py-1 bg-neutral-800 border border-neutral-700 rounded text-neutral-400 text-xs hover:text-white hover:border-neutral-600 transition-colors">
                      Tomorrow
                    </button>
                  </div>
                  {blocked.length === 0 ? (
                    <div className="text-neutral-600 text-xs text-center py-3 bg-neutral-900 rounded-lg">No days blocked</div>
                  ) : (
                    <div className="space-y-1.5">
                      {blocked.map(d => (
                        <div key={d} className="flex items-center justify-between px-3 py-2 bg-red-500/10 border border-red-500/20 rounded-lg">
                          <div className="flex items-center gap-2">
                            <Ban className="w-3 h-3 text-red-400" />
                            <span className="text-sm text-red-300 font-medium">{fmtDate(d)}</span>
                            {d === todayStr()     && <span className="text-[10px] text-red-500 font-bold">TODAY</span>}
                            {d === tomorrowStr()  && <span className="text-[10px] text-orange-400 font-bold">TOMORROW</span>}
                          </div>
                          <button onClick={() => removeDay(member.id, d)} className="text-red-500 hover:text-red-300 transition-colors">
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// STAFF FORM MODAL  (Add & Edit)
// ─────────────────────────────────────────────────────────────────────────────
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
    workingHours:     staff?.workingHours     ?? { ...DEFAULT_WORKING_HOURS } as Record<DayKey, DayHours>,
    disabledDays:     staff?.disabledDays     ?? [] as string[],
    username:         '',
    password:         '',
    portalRole:       'mechanic',
    portalBranch:     'Pannipitiya',
  });
  const [showPass,  setShowPass]  = useState(false);
  const [saving,    setSaving]    = useState(false);
  const [error,     setError]     = useState('');
  const [credsNote, setCredsNote] = useState('');

  const updateDayHours = (day: DayKey, patch: Partial<DayHours>) => {
    setForm(f => ({ ...f, workingHours: { ...f.workingHours, [day]: { ...f.workingHours[day], ...patch } } }));
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim())    return setError('Name is required');
    if (!form.role)           return setError('Role is required');
    if (!form.contact.trim()) return setError('Contact number is required');
    if (!isEdit) {
      if (!form.username.trim())    return setError('Username is required for portal login');
      if (form.password.length < 6) return setError('Password must be at least 6 characters');
    }
    setError(''); setSaving(true);

    try {
      if (!isEdit) {
        const res = await fetch(`${API}/api/staff?action=register`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            username:     form.username.trim().toLowerCase(),
            password:     form.password,
            name:         form.name.trim(),
            role:         form.portalRole,
            branch:       form.portalBranch,
            phone:        form.contact.trim(),
            workingHours: form.workingHours,
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to register staff');
        setCredsNote(`Login: ${form.username.trim().toLowerCase()} / ${form.password}`);
        setTimeout(() => {
          onSave({ id: staff?.id, ...form, name: form.name.trim(), contact: form.contact.trim() });
          onClose();
        }, 2000);
        return;
      }
    } catch (err: any) {
      setError(err.message); setSaving(false); return;
    }

    onSave({ id: staff?.id, ...form, name: form.name.trim(), contact: form.contact.trim() });
    onClose(); setSaving(false);
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
          {error     && <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm">{error}</div>}
          {credsNote && (
            <div className="p-3 bg-green-500/10 border border-green-500/30 rounded-lg text-green-400 text-sm">
              <p className="font-bold mb-0.5">Staff account created!</p>
              <p className="font-mono text-xs">{credsNote}</p>
              <p className="text-green-600 text-xs mt-0.5">Share these credentials with the staff member.</p>
            </div>
          )}

          <div>
            <label className="text-sm font-medium text-white block mb-1.5">Full Name *</label>
            <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })}
              placeholder="e.g. Saman Perera"
              className="w-full px-3 py-2.5 bg-neutral-800 border border-neutral-700 rounded-lg text-white text-sm focus:outline-none focus:border-[#FFD700] placeholder:text-neutral-600 transition-colors"
            />
          </div>

          {!isEdit && (
            <div className="grid grid-cols-2 gap-3 p-3 bg-neutral-800/50 border border-neutral-700 rounded-lg">
              <div className="col-span-2 flex items-center gap-2 mb-1">
                <KeyRound className="w-3.5 h-3.5 text-[#FFD700]" />
                <span className="text-xs font-bold text-[#FFD700]">Staff Portal Login</span>
              </div>
              <div>
                <label className="text-xs font-medium text-neutral-400 block mb-1.5">Username *</label>
                <input value={form.username}
                  onChange={e => setForm({ ...form, username: e.target.value.toLowerCase().replace(/\s/g, '') })}
                  placeholder="e.g. saman.p" autoComplete="off"
                  className="w-full px-3 py-2.5 bg-neutral-800 border border-neutral-700 rounded-lg text-white text-sm focus:outline-none focus:border-[#FFD700] placeholder:text-neutral-600 transition-colors"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-neutral-400 block mb-1.5">Password *</label>
                <div className="relative">
                  <input type={showPass ? 'text' : 'password'} value={form.password}
                    onChange={e => setForm({ ...form, password: e.target.value })}
                    placeholder="Min 6 chars" autoComplete="new-password"
                    className="w-full px-3 py-2.5 pr-9 bg-neutral-800 border border-neutral-700 rounded-lg text-white text-sm focus:outline-none focus:border-[#FFD700] placeholder:text-neutral-600 transition-colors"
                  />
                  <button type="button" onClick={() => setShowPass(v => !v)}
                    className="absolute right-2.5 top-2.5 text-neutral-500 hover:text-neutral-300 transition-colors">
                    {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
              <div>
                <label className="text-xs font-medium text-neutral-400 block mb-1.5">Branch *</label>
                <select value={form.portalBranch} onChange={e => setForm({ ...form, portalBranch: e.target.value })}
                  className="w-full px-3 py-2.5 bg-neutral-800 border border-neutral-700 rounded-lg text-white text-sm focus:outline-none focus:border-[#FFD700] transition-colors">
                  {['Pannipitiya', 'Ratnapura', 'Kalawana', 'Nivithigala'].map(b => <option key={b} value={b}>{b}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-neutral-400 block mb-1.5">Portal Role *</label>
                <select value={form.portalRole} onChange={e => setForm({ ...form, portalRole: e.target.value })}
                  className="w-full px-3 py-2.5 bg-neutral-800 border border-neutral-700 rounded-lg text-white text-sm focus:outline-none focus:border-[#FFD700] transition-colors">
                  <option value="mechanic">Mechanic</option>
                  <option value="supervisor">Supervisor</option>
                  <option value="super_admin">Super Admin</option>
                </select>
              </div>
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

          {/* Role — uses the shared STAFF_ROLES constant */}
          <div>
            <label className="text-sm font-medium text-white block mb-1.5">Role *</label>
            <select value={form.role} onChange={e => setForm({ ...form, role: e.target.value })}
              className="w-full px-3 py-2.5 bg-neutral-800 border border-neutral-700 rounded-lg text-white text-sm focus:outline-none focus:border-[#FFD700] transition-colors">
              <option value="">Select role...</option>
              {STAFF_ROLES.map(r => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm font-medium text-white block mb-1.5">Contact Number *</label>
              <input value={form.contact} onChange={e => setForm({ ...form, contact: e.target.value })}
                placeholder="077-1234567"
                className="w-full px-3 py-2.5 bg-neutral-800 border border-neutral-700 rounded-lg text-white text-sm focus:outline-none focus:border-[#FFD700] placeholder:text-neutral-600 transition-colors"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-white block mb-1.5">Email</label>
              <input type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })}
                placeholder="name@anuratyres.lk"
                className="w-full px-3 py-2.5 bg-neutral-800 border border-neutral-700 rounded-lg text-white text-sm focus:outline-none focus:border-[#FFD700] placeholder:text-neutral-600 transition-colors"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm font-medium text-white block mb-1.5">Assigned Bay</label>
              <select value={form.bay} onChange={e => setForm({ ...form, bay: e.target.value })}
                className="w-full px-3 py-2.5 bg-neutral-800 border border-neutral-700 rounded-lg text-white text-sm focus:outline-none focus:border-[#FFD700] transition-colors">
                <option value="-">Not Assigned</option>
                {['Bay 1', 'Bay 2', 'Bay 3', 'Bay 4'].map(b => <option key={b} value={b}>{b}</option>)}
              </select>
            </div>
            <div>
              <label className="text-sm font-medium text-white block mb-1.5">Emergency Contact</label>
              <input value={form.emergencyContact} onChange={e => setForm({ ...form, emergencyContact: e.target.value })}
                placeholder="077-9876543"
                className="w-full px-3 py-2.5 bg-neutral-800 border border-neutral-700 rounded-lg text-white text-sm focus:outline-none focus:border-[#FFD700] placeholder:text-neutral-600 transition-colors"
              />
            </div>
          </div>

          {/* Working Hours */}
          <div className="p-3 bg-neutral-800/50 border border-neutral-700 rounded-lg space-y-2">
            <div className="flex items-center gap-2 mb-2">
              <Clock className="w-3.5 h-3.5 text-[#FFD700]" />
              <span className="text-xs font-bold text-[#FFD700]">Working Hours</span>
            </div>
            <div className="space-y-1.5">
              {DAYS.map(day => {
                const h = form.workingHours[day];
                return (
                  <div key={day}
                    className={`flex items-center gap-3 px-3 py-2 rounded-lg border transition-colors ${
                      h.on ? 'bg-neutral-800 border-neutral-700' : 'bg-neutral-900 border-neutral-800'
                    }`}
                  >
                    <label className="flex items-center gap-2 cursor-pointer select-none flex-shrink-0 w-14">
                      <input type="checkbox" checked={h.on}
                        onChange={e => updateDayHours(day, { on: e.target.checked })}
                        className="accent-[#FFD700] w-3.5 h-3.5 flex-shrink-0"
                      />
                      <span className={`text-xs font-semibold ${h.on ? 'text-white' : 'text-neutral-600'}`}>{day}</span>
                    </label>
                    {h.on ? (
                      <div className="flex items-center gap-2 flex-1">
                        <input type="time" value={h.start}
                          onChange={e => updateDayHours(day, { start: e.target.value })}
                          className="flex-1 min-w-0 px-2 py-1 bg-neutral-900 border border-neutral-700 rounded text-white text-xs focus:outline-none focus:border-[#FFD700] transition-colors"
                        />
                        <span className="text-neutral-600 text-xs flex-shrink-0">–</span>
                        <input type="time" value={h.end}
                          onChange={e => updateDayHours(day, { end: e.target.value })}
                          className="flex-1 min-w-0 px-2 py-1 bg-neutral-900 border border-neutral-700 rounded text-white text-xs focus:outline-none focus:border-[#FFD700] transition-colors"
                        />
                      </div>
                    ) : (
                      <span className="text-neutral-600 text-xs italic">Day off</span>
                    )}
                  </div>
                );
              })}
            </div>
            <p className="text-[11px] text-neutral-500 font-mono pt-1 leading-relaxed">
              {buildHoursSummary(form.workingHours)}
            </p>
          </div>

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose}
              className="flex-1 px-4 py-2.5 border border-neutral-700 rounded-lg text-neutral-300 text-sm font-medium hover:bg-neutral-800 transition-colors">
              Cancel
            </button>
            <button type="submit" disabled={saving}
              className="flex-1 px-4 py-2.5 bg-[#FFD700] rounded-lg text-black text-sm font-bold hover:bg-[#FFD700]/90 transition-colors disabled:opacity-60 flex items-center justify-center gap-2">
              {saving ? 'Saving…' : isEdit ? 'Save Changes' : 'Add Staff Member'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN STAFF PAGE
// ─────────────────────────────────────────────────────────────────────────────
export function StaffPage() {
  const [staff,        setStaff]        = useState<StaffMember[]>([]);
  const [staffLoading, setStaffLoading] = useState(true);
  const [staffError,   setStaffError]   = useState<string | null>(null);

  const [leaveRequests, setLeaveRequests] = useState<LeaveRequest[]>([
    { id: 1, staffId: 0, staffName: 'Demo Staff', type: 'Annual Leave', date: tomorrowStr(), reason: 'Family event',  status: 'Pending',  createdAt: new Date().toISOString() },
    { id: 2, staffId: 0, staffName: 'Demo Staff', type: 'Sick Leave',   date: todayStr(),    reason: 'Fever',         status: 'Approved', createdAt: new Date().toISOString() },
  ]);

  const [activeTab,        setActiveTab]        = useState<'directory' | 'leaves' | 'manage-leaves'>('directory');
  const [search,           setSearch]           = useState('');
  const [showAddModal,     setShowAddModal]      = useState(false);
  const [editMember,       setEditMember]        = useState<StaffMember | null>(null);
  const [deleteConfirm,    setDeleteConfirm]     = useState<number | null>(null);
  const [showLeaveModal,   setShowLeaveModal]    = useState(false);
  const [disableDaysMember,setDisableDaysMember] = useState<StaffMember | null>(null);
  const [leaveFilter,      setLeaveFilter]       = useState<LeaveStatus | 'All'>('All');

  const fetchStaff = useCallback(async () => {
    setStaffLoading(true); setStaffError(null);
    try {
      const res  = await fetch(`${API}/api/staff`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to load staff');
      const mapped: StaffMember[] = (Array.isArray(data) ? data : []).map((m: any, i: number) => ({
        id:               m._id || i,
        name:             m.name    || '',
        role:             m.role    || '',
        status:           (m.dayStatus?.status === 'on_break' ? 'On Break' :
                           m.dayStatus?.status === 'active'   ? 'Available' : 'Available') as StaffMember['status'],
        contact:          m.phone   || '',
        email:            m.email   || '',
        bay:              m.dayStatus?.bayNumber ? `Bay ${m.dayStatus.bayNumber}` : '-',
        emergencyContact: '',
        workingHours:     m.workingHours || { ...DEFAULT_WORKING_HOURS },
        disabledDays:     m.disabledDays || [],
      }));
      setStaff(mapped);
    } catch (err: any) {
      setStaffError(err.message);
    } finally {
      setStaffLoading(false);
    }
  }, []);

  useEffect(() => { fetchStaff(); }, [fetchStaff]);

  const handleSave = (data: any) => {
    if (data.id) setStaff(prev => prev.map(s => s.id === data.id ? data : s));
    else         setStaff(prev => [...prev, { ...data, id: Date.now() }]);
    setTimeout(() => fetchStaff(), 500);
  };

  const handleDelete       = (id: number) => { setStaff(prev => prev.filter(s => s.id !== id)); setDeleteConfirm(null); };
  const handleStatusChange = (id: number, status: StaffMember['status']) =>
    setStaff(prev => prev.map(s => s.id === id ? { ...s, status } : s));
  const handleSaveDisabledDays = (id: number, disabledDays: string[]) =>
    setStaff(prev => prev.map(s => s.id === id ? { ...s, disabledDays } : s));

  const handleLeaveAction = (id: number, status: LeaveStatus) => {
    setLeaveRequests(prev => prev.map(r => r.id === id ? { ...r, status } : r));
    const req = leaveRequests.find(r => r.id === id);
    if (req && status === 'Approved' && req.type !== 'Break Request') {
      setStaff(prev => prev.map(s => {
        if (s.id !== req.staffId) return s;
        const existing = s.disabledDays ?? [];
        if (existing.includes(req.date)) return s;
        return { ...s, disabledDays: [...existing, req.date].sort() };
      }));
    }
  };

  const handleLeaveSubmit = (req: Omit<LeaveRequest, 'id' | 'createdAt'>) => {
    setLeaveRequests(prev => [...prev, { ...req, id: Date.now(), createdAt: new Date().toISOString() }]);
  };

  const filtered = staff.filter(s =>
    s.name.toLowerCase().includes(search.toLowerCase()) ||
    s.role.toLowerCase().includes(search.toLowerCase())
  );

  const bayMap: Record<string, StaffMember | undefined> = {};
  staff.filter(s => s.bay !== '-').forEach(s => { bayMap[s.bay] = s; });

  const filteredLeaves = leaveRequests.filter(r => leaveFilter === 'All' || r.status === leaveFilter);
  const pendingCount   = leaveRequests.filter(r => r.status === 'Pending').length;
  const today          = todayStr();
  const availableStaff = staff.filter(s =>
    s.status === 'Available' && !(s.disabledDays ?? []).includes(today)
  );

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold text-white mb-1">Staff Directory</h2>
          <p className="text-neutral-400 text-sm">Manage mechanics, technicians, leave requests and assignments.</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={fetchStaff} disabled={staffLoading}
            className="p-2 bg-neutral-900 border border-neutral-700 rounded-lg text-neutral-400 hover:text-white hover:border-neutral-600 transition-colors disabled:opacity-50">
            <RefreshCw className={`w-4 h-4 ${staffLoading ? 'animate-spin' : ''}`} />
          </button>
          <button onClick={() => setShowLeaveModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-white text-sm font-medium hover:bg-neutral-700 transition-colors">
            <Calendar className="w-4 h-4 text-[#FFD700]" /> Request Leave
          </button>
          <button onClick={() => setShowAddModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-[#FFD700] rounded-lg text-black text-sm font-bold hover:bg-[#FFD700]/90 transition-colors">
            <Plus className="w-4 h-4" /> Add Staff
          </button>
        </div>
      </div>

      {/* Loading / Error */}
      {staffLoading && (
        <div className="flex items-center justify-center py-6 text-neutral-500 text-sm gap-2">
          <div className="w-4 h-4 border-2 border-neutral-700 border-t-[#FFD700] rounded-full animate-spin" />
          Loading staff…
        </div>
      )}
      {staffError && (
        <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 text-sm">
          Failed to load staff: {staffError}
          <button onClick={fetchStaff} className="ml-3 underline hover:no-underline">Retry</button>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Total Staff',      value: staff.length,                                                     color: 'text-white',      icon: <Users className="w-5 h-5" /> },
          { label: 'Available Now',    value: availableStaff.length,                                            color: 'text-green-400',  icon: <UserCheck className="w-5 h-5" /> },
          { label: 'On Leave',         value: staff.filter(s => (s.disabledDays ?? []).includes(today)).length, color: 'text-red-400',    icon: <UserX className="w-5 h-5" /> },
          { label: 'Pending Requests', value: pendingCount,                                                     color: 'text-yellow-400', icon: <AlertCircle className="w-5 h-5" /> },
        ].map(s => (
          <div key={s.label} className="bg-neutral-900 border border-neutral-800 rounded-xl p-4">
            <div className="flex items-center justify-between mb-2">
              <span className={`${s.color} opacity-60`}>{s.icon}</span>
            </div>
            <div className={`text-2xl font-bold ${s.color}`}>{s.value}</div>
            <div className="text-neutral-500 text-xs mt-0.5">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Tab Navigation */}
      <div className="flex gap-1 bg-neutral-900 border border-neutral-800 rounded-xl p-1 w-fit">
        {[
          { key: 'directory',     label: 'Staff Directory',                                               icon: <Users className="w-4 h-4" /> },
          { key: 'leaves',        label: `Leave Board${pendingCount > 0 ? ` (${pendingCount})` : ''}`,   icon: <Calendar className="w-4 h-4" /> },
          { key: 'manage-leaves', label: 'Manage Leave Days',                                             icon: <Ban className="w-4 h-4" /> },
        ].map(tab => (
          <button key={tab.key}
            onClick={() => setActiveTab(tab.key as any)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              activeTab === tab.key
                ? 'bg-[#FFD700] text-black'
                : 'text-neutral-400 hover:text-white'
            }`}
          >
            {tab.icon} {tab.label}
          </button>
        ))}
      </div>

      {/* ── TAB: DIRECTORY ── */}
      {activeTab === 'directory' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <div className="bg-neutral-900 border border-neutral-800 rounded-xl overflow-hidden">
              <div className="p-5 border-b border-neutral-800 flex justify-between items-center gap-3">
                <h3 className="font-bold text-white text-lg">Team Members</h3>
                <div className="relative w-56">
                  <Search className="absolute left-3 top-2.5 w-4 h-4 text-neutral-500" />
                  <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search staff..."
                    className="w-full pl-9 pr-3 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-white text-sm focus:outline-none focus:border-[#FFD700] placeholder:text-neutral-600 transition-colors"
                  />
                </div>
              </div>
              {filtered.length === 0 ? (
                <div className="py-12 text-center text-neutral-500">No staff found</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-neutral-950 border-b border-neutral-800">
                        {['Name', 'Role', 'Status', 'Contact', 'Hours', 'Actions'].map(h => (
                          <th key={h} className={`px-4 py-3.5 font-bold text-[#FFD700] text-left text-xs uppercase tracking-wider ${h === 'Actions' ? 'text-right' : ''}`}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-neutral-800">
                      {filtered.map(member => {
                        const blockedToday = (member.disabledDays ?? []).includes(today);
                        return (
                          <tr key={member.id} className={`hover:bg-neutral-800/40 transition-colors ${blockedToday ? 'opacity-50' : ''}`}>
                            <td className="px-4 py-4">
                              <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-full bg-neutral-800 border border-neutral-700 flex items-center justify-center text-[#FFD700] font-bold text-sm flex-shrink-0">
                                  {member.name.charAt(0)}
                                </div>
                                <div>
                                  <div className="text-white font-medium text-sm">{member.name}</div>
                                  {member.bay !== '-' && <div className="text-xs text-neutral-500">{member.bay}</div>}
                                  {blockedToday && <div className="text-xs text-red-400 font-medium">Off today</div>}
                                </div>
                              </div>
                            </td>
                            <td className="px-4 py-4 text-neutral-400 text-sm">{member.role}</td>
                            <td className="px-4 py-4">
                              {blockedToday ? (
                                <span className="px-2 py-1 rounded-full text-xs font-medium bg-red-500/20 text-red-400 border border-red-500/30">On Leave</span>
                              ) : (
                                <select value={member.status}
                                  onChange={e => handleStatusChange(member.id, e.target.value as StaffMember['status'])}
                                  className={`px-2 py-1 rounded-full text-xs font-medium border-0 cursor-pointer focus:outline-none ${statusColor(member.status)}`}
                                  style={{ background: 'transparent' }}>
                                  <option value="Available">Available</option>
                                  <option value="Busy">Busy</option>
                                  <option value="On Break">On Break</option>
                                  <option value="On Leave">On Leave</option>
                                </select>
                              )}
                            </td>
                            <td className="px-4 py-4">
                              <div className="text-neutral-400 text-xs">{member.contact}</div>
                              {member.email && <div className="text-neutral-600 text-xs">{member.email}</div>}
                            </td>
                            <td className="px-4 py-4">
                              {member.workingHours ? (
                                <div className="text-neutral-500 text-xs font-mono leading-relaxed whitespace-nowrap">
                                  {buildHoursSummary(member.workingHours)}
                                </div>
                              ) : (
                                <span className="text-neutral-700 text-xs">—</span>
                              )}
                            </td>
                            <td className="px-4 py-4 text-right">
                              <div className="flex items-center justify-end gap-1.5">
                                <button onClick={() => setEditMember(member)}
                                  className="px-2.5 py-1.5 bg-neutral-800 hover:bg-blue-500/20 hover:text-blue-400 border border-neutral-700 rounded text-neutral-400 text-xs font-medium transition-colors flex items-center gap-1">
                                  <Edit2 className="w-3 h-3" /> Edit
                                </button>
                                <button onClick={() => setDisableDaysMember(member)} title="Block Days"
                                  className="p-1.5 rounded text-neutral-500 hover:text-yellow-400 hover:bg-neutral-800 transition-colors">
                                  <Ban className="w-3.5 h-3.5" />
                                </button>
                                <button onClick={() => setDeleteConfirm(member.id)}
                                  className="p-1.5 rounded text-neutral-500 hover:text-red-400 hover:bg-neutral-800 transition-colors">
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-5">
            <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-5">
              <h3 className="font-bold text-neutral-400 mb-4 text-xs uppercase tracking-wider">Bay Status</h3>
              <div className="space-y-3">
                {['Bay 1', 'Bay 2', 'Bay 3', 'Bay 4'].map(bay => {
                  const assignedStaff = bayMap[bay];
                  return (
                    <div key={bay}
                      className={`p-3 rounded-lg border transition-colors ${
                        assignedStaff ? 'bg-[#FFD700]/5 border-[#FFD700]/20' : 'bg-neutral-800 border-neutral-700'
                      }`}>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Wrench className={`w-4 h-4 ${assignedStaff ? 'text-[#FFD700]' : 'text-neutral-600'}`} />
                          <span className="text-white text-sm font-medium">{bay}</span>
                        </div>
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                          assignedStaff
                            ? 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30'
                            : 'bg-green-500/20 text-green-400 border border-green-500/30'
                        }`}>
                          {assignedStaff ? 'Occupied' : 'Free'}
                        </span>
                      </div>
                      {assignedStaff && (
                        <div className="mt-2 text-xs text-neutral-500">
                          {assignedStaff.name} · {assignedStaff.role}
                          {assignedStaff.status === 'On Break' && <span className="ml-2 text-orange-400 font-medium">· On Break</span>}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-5">
              <h3 className="font-bold text-neutral-400 mb-4 text-xs uppercase tracking-wider flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-green-400 inline-block" />
                Available Now
              </h3>
              <div className="space-y-2">
                {availableStaff.length === 0 ? (
                  <div className="text-neutral-500 text-sm text-center py-4 bg-neutral-800 rounded-lg">No staff available</div>
                ) : availableStaff.map(s => (
                  <div key={s.id} className="flex items-center justify-between p-2.5 bg-neutral-800 rounded-lg border border-neutral-700/50 hover:border-green-500/30 transition-colors">
                    <div className="flex items-center gap-2.5">
                      <div className="w-7 h-7 rounded-full bg-green-500/10 border border-green-500/30 flex items-center justify-center text-green-400 font-bold text-xs">
                        {s.name.charAt(0)}
                      </div>
                      <div>
                        <div className="text-sm text-white font-medium leading-tight">{s.name}</div>
                        <div className="text-xs text-neutral-500">{s.role}</div>
                      </div>
                    </div>
                    <a href={`tel:${s.contact}`}
                      className="p-1.5 rounded text-neutral-500 hover:text-[#FFD700] hover:bg-neutral-700 transition-colors">
                      <Phone className="w-4 h-4" />
                    </a>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── TAB: LEAVE BOARD ── */}
      {activeTab === 'leaves' && (
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <span className="text-neutral-500 text-sm">Filter:</span>
            {(['All', 'Pending', 'Approved', 'Denied'] as const).map(f => (
              <button key={f} onClick={() => setLeaveFilter(f)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  leaveFilter === f
                    ? 'bg-[#FFD700] text-black'
                    : 'bg-neutral-900 border border-neutral-800 text-neutral-400 hover:text-white'
                }`}>
                {f}
                {f === 'Pending' && pendingCount > 0 && (
                  <span className="ml-1.5 bg-yellow-500 text-black rounded-full w-4 h-4 inline-flex items-center justify-center text-[10px] font-bold">
                    {pendingCount}
                  </span>
                )}
              </button>
            ))}
            <button onClick={() => setShowLeaveModal(true)}
              className="ml-auto flex items-center gap-1.5 px-3 py-1.5 bg-neutral-900 border border-neutral-800 rounded-lg text-neutral-400 hover:text-white text-xs font-medium transition-colors">
              <Plus className="w-3.5 h-3.5" /> New Request
            </button>
          </div>

          {filteredLeaves.length === 0 ? (
            <div className="bg-neutral-900 border border-neutral-800 rounded-xl py-16 text-center text-neutral-500">
              No {leaveFilter !== 'All' ? leaveFilter.toLowerCase() : ''} requests found
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {filteredLeaves.map(req => (
                <div key={req.id}
                  className={`bg-neutral-900 border rounded-xl p-4 space-y-3 ${
                    req.status === 'Pending'  ? 'border-yellow-500/20' :
                    req.status === 'Approved' ? 'border-green-500/20'  :
                                                'border-red-500/20'
                  }`}>
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-full bg-neutral-800 border border-neutral-700 flex items-center justify-center text-[#FFD700] font-bold text-sm">
                        {req.staffName.charAt(0) || '?'}
                      </div>
                      <div>
                        <div className="text-white text-sm font-medium">{req.staffName || 'Unknown'}</div>
                        <div className="text-neutral-500 text-xs">{fmtDate(req.createdAt)}</div>
                      </div>
                    </div>
                    <span className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${leaveStatusBadge(req.status)}`}>
                      {req.status === 'Approved' && <CheckCircle className="w-3 h-3" />}
                      {req.status === 'Denied'   && <XCircle className="w-3 h-3" />}
                      {req.status === 'Pending'  && <AlertCircle className="w-3 h-3" />}
                      {req.status}
                    </span>
                  </div>
                  <div className="flex items-center justify-between px-3 py-2 bg-neutral-800 rounded-lg">
                    <div className="flex items-center gap-1.5 text-neutral-300 text-sm font-medium">
                      {leaveTypeIcon(req.type)} {req.type}
                    </div>
                    {req.type !== 'Break Request' && (
                      <span className="text-neutral-500 text-xs">{fmtDate(req.date)}</span>
                    )}
                  </div>
                  {req.reason && <p className="text-neutral-500 text-xs px-1">"{req.reason}"</p>}
                  {req.status === 'Pending' && (
                    <div className="flex gap-2 pt-1">
                      <button onClick={() => handleLeaveAction(req.id, 'Approved')}
                        className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-green-500/10 border border-green-500/30 rounded-lg text-green-400 text-xs font-medium hover:bg-green-500/20 transition-colors">
                        <CheckCircle className="w-3.5 h-3.5" /> Approve
                      </button>
                      <button onClick={() => handleLeaveAction(req.id, 'Denied')}
                        className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-xs font-medium hover:bg-red-500/20 transition-colors">
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

      {/* ── TAB: MANAGE LEAVE DAYS (MANAGER) ── */}
      {activeTab === 'manage-leaves' && (
        <ManagerDisableDaysPanel
          staff={staff}
          onSave={handleSaveDisabledDays}
        />
      )}

      {/* Delete Confirm */}
      {deleteConfirm !== null && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
          <div className="bg-neutral-900 rounded-xl border border-neutral-700 w-full max-w-sm p-6 shadow-2xl">
            <h3 className="text-lg font-bold text-white mb-2">Remove Staff Member?</h3>
            <p className="text-neutral-400 text-sm mb-5">This will permanently remove them from the system.</p>
            <div className="flex gap-3">
              <button onClick={() => setDeleteConfirm(null)}
                className="flex-1 px-4 py-2.5 border border-neutral-700 rounded-lg text-neutral-300 text-sm hover:bg-neutral-800 transition-colors">
                Cancel
              </button>
              <button onClick={() => handleDelete(deleteConfirm)}
                className="flex-1 px-4 py-2.5 bg-red-600 rounded-lg text-white text-sm font-bold hover:bg-red-700 transition-colors">
                Remove
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modals */}
      {showAddModal        && <StaffModal onClose={() => setShowAddModal(false)} onSave={handleSave} />}
      {editMember          && <StaffModal staff={editMember} onClose={() => setEditMember(null)} onSave={handleSave} />}
      {showLeaveModal      && <LeaveRequestModal staff={staff} onClose={() => setShowLeaveModal(false)} onSubmit={handleLeaveSubmit} />}
      {disableDaysMember   && <DisableDaysModal member={disableDaysMember} onClose={() => setDisableDaysMember(null)} onSave={handleSaveDisabledDays} />}
    </div>
  );
}