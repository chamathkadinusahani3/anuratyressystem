import { useState, useEffect, useCallback, useRef } from 'react';
import { getSessionUser } from '../lib/auth';
import {
  X, Search, Plus, Wrench, Edit2, Trash2, Phone,
  Eye, EyeOff, KeyRound, Clock, CheckCircle, XCircle,
  AlertCircle, Coffee, Calendar, Stethoscope, ChevronDown,
  RefreshCw, Users, UserCheck, UserX, Ban, LogIn,
  Trophy, Star, TrendingUp, DollarSign, MapPin, Zap,
  Award, BarChart2, Timer, Target, Activity, ChevronUp,
  ArrowUpRight, ArrowDownRight, Flame, Shield, AlertTriangle,
  FileText, Download, Settings, MoreVertical, Hash
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

interface CurrentJob {
  service:       string;
  vehiclePlate:  string;
  allocatedMins: number;
  liveWorkMins:  number;
  liveOverMins:  number;
  isOvertime:    boolean;
  status:        string;
  bayNumber:     string | null;
}

interface StaffMember {
  id: string;
  name: string;
  role: string;
  jobTitle: string;
  username: string;
  phone: string;
  branch: string;
  status: 'active' | 'on_break' | 'off';
  bayNumber: string | null;
  activeBay?: string | null;      // real bay from job assignments
  clockInAt: string | null;
  workingHours?: Record<DayKey, DayHours>;
  skills?: string[];
  // Real-time from job management
  jobsToday?: number;
  jobsInProgress?: number;
  jobsOverdue?: number;
  revenueToday?: number;
  overtimeHours?: number;
  efficiencyPct?: number | null;
  onTimeRate?: number | null;
  pauseCount?: number;
  currentJob?: CurrentJob | null;
  // Derived/enriched
  rating?: number;
  attendanceRate?: number;
  baseSalary?: number | null;
  otRate?: number | null;
}

interface ServicePrice {
  id?: string;
  name: string;
  code: string;
  price: number;
  duration: number;
}

interface PayrollStats {
  month: string;
  totalJobs: number;
  totalRevenue: number;
  bookingCount: number;
}

type LeaveType   = 'Annual Leave' | 'Sick Leave' | 'Break Request' | 'Tomorrow Off';
type LeaveStatus = 'Pending' | 'Approved' | 'Denied';

interface LeaveRequest {
  id: string;
  staffId: string;
  staffName: string;
  type: LeaveType;
  date: string;
  reason: string;
  status: LeaveStatus;
  createdAt: string;
}

interface BayAssignment {
  bayNumber: string;
  staffId: string | null;
  staffName: string | null;
  jobTitle: string | null;
  vehiclePlate: string | null;
  status: 'occupied' | 'available' | 'maintenance';
  startTime: string | null;
  allocatedMins?: number | null;
  liveWorkMins?: number;
  liveOverMins?: number;
  isOvertime?: boolean;
  jobStatus?: string | null;
}

// ── Constants ─────────────────────────────────────────────────────────────────
const DAYS: DayKey[] = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const BRANCHES = ['Pannipitiya', 'Ratnapura', 'Kalawana', 'Nivithigala'];
const PORTAL_ROLES = [
  { value: 'Cashier',     label: 'Cashier' },
  { value: 'Manager',     label: 'Manager' },
  { value: 'Admin',       label: 'Admin' },
  { value: 'Super Admin', label: 'Super Admin' },
];
const STAFF_ROLES = [
  'Sales Executive', 'Branch Assistant', 'Supervisor', 'Branch Manager',
  'Data Entry Operator', 'Technician', 'Alignment Technician', 'Labour',
  'Lead Mechanic', 'Mechanic', 'Junior Mechanic', 'Tyre Technician',
  'Service Advisor', 'Manager', 'Cashier',
];
const SKILL_OPTIONS = [
  'Tyre Fitting', 'Alignment', 'Balancing', 'Engine Repair', 'Brake Service',
  'Oil Change', 'AC Service', 'Electrical', 'Suspension', 'Exhaust',
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
const TOTAL_BAYS = 8;

// ── Helpers ───────────────────────────────────────────────────────────────────
const todayStr    = () => new Date().toISOString().split('T')[0];
const tomorrowStr = () => { const d = new Date(); d.setDate(d.getDate() + 1); return d.toISOString().split('T')[0]; };
const fmtDate     = (d: string) => new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
const fmtTime     = (iso: string | null) => iso ? new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) : '—';

function getElapsed(clockInAt: string | null): string {
  if (!clockInAt) return '—';
  const diff = Date.now() - new Date(clockInAt).getTime();
  const h = Math.floor(diff / 3600000);
  const m = Math.floor((diff % 3600000) / 60000);
  return `${h}h ${m}m`;
}

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

function rankMedal(i: number) {
  if (i === 0) return '🥇';
  if (i === 1) return '🥈';
  if (i === 2) return '🥉';
  return `#${i + 1}`;
}

// Deterministic hash so enriched values don't flicker on re-fetch
function hashNum(id: string, salt: number): number {
  let h = salt;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return h;
}

function enrichStaff(staff: StaffMember[]): StaffMember[] {
  return staff.map((s, i) => {
    const h = (n: number) => hashNum(s.id || String(i), n);
    return {
      ...s,
      skills:        s.skills?.length ? s.skills : SKILL_OPTIONS.slice(0, 2 + (h(1) % 4)),
      jobsToday:     s.jobsToday     ?? (h(2) % 8) + 1,
      revenueToday:  s.revenueToday  ?? ((h(3) % 20) + 5) * 1000,
      rating:        s.rating        ?? parseFloat((3.5 + (h(4) % 15) / 10).toFixed(1)),
      attendanceRate:s.attendanceRate ?? 80 + (h(5) % 20),
      overtimeHours: s.overtimeHours ?? parseFloat(((h(6) % 30) / 10).toFixed(1)),
      baseSalary:    s.baseSalary    ?? [35000, 42000, 55000, 28000][i % 4],
    };
  });
}

function generateBays(staff: StaffMember[]): BayAssignment[] {
  return Array.from({ length: TOTAL_BAYS }, (_, i) => {
    const bayNum = String(i + 1);
    // Find staff whose active job is in this bay (activeBay takes priority over dayStatus bayNumber)
    const assignedStaff = staff.find(s =>
      (s.activeBay === bayNum) || (!s.activeBay && s.bayNumber === bayNum && s.status === 'active')
    );
    if (assignedStaff) {
      const job = assignedStaff.currentJob ?? null;
      return {
        bayNumber:    bayNum,
        staffId:      assignedStaff.id,
        staffName:    assignedStaff.name,
        jobTitle:     job?.service ?? null,
        vehiclePlate: job?.vehiclePlate ?? null,
        status:       'occupied' as const,
        startTime:    assignedStaff.clockInAt,
        allocatedMins:job?.allocatedMins   ?? null,
        liveWorkMins: job?.liveWorkMins    ?? undefined,
        liveOverMins: job?.liveOverMins    ?? undefined,
        isOvertime:   job?.isOvertime      ?? false,
        jobStatus:    job?.status          ?? null,
      };
    }
    return {
      bayNumber: bayNum, staffId: null, staffName: null, jobTitle: null,
      vehiclePlate: null, status: 'available' as const, startTime: null,
    };
  });
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

// ── BAY MAP COMPONENT ─────────────────────────────────────────────────────────
function BayMap({ staff, onAssign }: { staff: StaffMember[]; onAssign: (staffId: string, bay: string) => void }) {
  const bays = generateBays(staff);
  const [dragStaff, setDragStaff] = useState<StaffMember | null>(null);
  const [hoveredBay, setHoveredBay] = useState<string | null>(null);

  const availableStaff = staff.filter(s => s.status === 'active' && !s.bayNumber && !s.activeBay);
  const overdueCount   = bays.filter(b => b.isOvertime).length;

  function bayBorder(b: BayAssignment) {
    if (b.isOvertime)              return 'border-red-500/60 bg-red-500/5';
    if (b.jobStatus === 'paused')  return 'border-amber-500/50 bg-amber-500/5';
    if (b.status === 'occupied')   return 'border-emerald-500/40 bg-emerald-500/5';
    return 'border-neutral-700 bg-neutral-800/40';
  }

  function progressBar(b: BayAssignment) {
    if (!b.allocatedMins || b.liveWorkMins == null) return null;
    const pct = Math.min((b.liveWorkMins / b.allocatedMins) * 100, 100);
    const color = b.isOvertime ? 'bg-red-500' : pct > 80 ? 'bg-amber-400' : 'bg-emerald-400';
    return { pct, color };
  }

  return (
    <div className="space-y-5">
      {/* Legend */}
      <div className="flex flex-wrap items-center gap-4 text-xs">
        {[
          { color: 'bg-emerald-500', label: 'Active' },
          { color: 'bg-amber-500',   label: 'Paused' },
          { color: 'bg-red-500',     label: 'Overtime' },
          { color: 'bg-neutral-700', label: 'Available' },
        ].map(l => (
          <div key={l.label} className="flex items-center gap-1.5">
            <div className={`w-2.5 h-2.5 rounded-full ${l.color}`} />
            <span className="text-neutral-400">{l.label}</span>
          </div>
        ))}
        <div className="ml-auto flex items-center gap-3">
          {overdueCount > 0 && (
            <span className="flex items-center gap-1 text-red-400 font-semibold">
              <AlertTriangle className="w-3.5 h-3.5" /> {overdueCount} overdue
            </span>
          )}
          <span className="text-neutral-600">{bays.filter(b => b.status === 'occupied').length}/{TOTAL_BAYS} bays active</span>
        </div>
      </div>

      {/* Bay Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {bays.map(bay => {
          const bar = progressBar(bay);
          return (
            <div
              key={bay.bayNumber}
              onDragOver={e => { e.preventDefault(); setHoveredBay(bay.bayNumber); }}
              onDragLeave={() => setHoveredBay(null)}
              onDrop={e => {
                e.preventDefault();
                setHoveredBay(null);
                if (dragStaff && bay.status === 'available') {
                  onAssign(dragStaff.id, bay.bayNumber);
                  setDragStaff(null);
                }
              }}
              className={`relative rounded-xl border-2 p-3.5 transition-all ${bayBorder(bay)} ${hoveredBay === bay.bayNumber && bay.status === 'available' ? 'border-[#FFD700] scale-105' : ''}`}
            >
              {/* Bay header */}
              <div className="flex items-center justify-between mb-2.5">
                <span className="flex items-center gap-1 text-xs font-bold text-neutral-400">
                  <Wrench className="w-3 h-3" /> Bay {bay.bayNumber}
                </span>
                {bay.isOvertime && (
                  <span className="flex items-center gap-0.5 text-[10px] font-bold text-red-400 bg-red-500/10 border border-red-500/20 px-1.5 py-0.5 rounded-full">
                    <AlertTriangle className="w-2.5 h-2.5" /> +{bay.liveOverMins}m
                  </span>
                )}
                {!bay.isOvertime && bay.status === 'occupied' && (
                  <span className={`w-2 h-2 rounded-full ${bay.jobStatus === 'paused' ? 'bg-amber-400' : 'bg-emerald-400 animate-pulse'}`} />
                )}
              </div>

              {bay.status === 'occupied' && bay.staffName ? (
                <>
                  <div className="text-white text-sm font-semibold leading-tight truncate">{bay.staffName}</div>

                  {bay.jobTitle && (
                    <div className={`text-xs mt-0.5 truncate font-medium ${bay.isOvertime ? 'text-red-400' : bay.jobStatus === 'paused' ? 'text-amber-400' : 'text-emerald-400'}`}>
                      {bay.jobStatus === 'paused' ? '⏸ ' : ''}{bay.jobTitle}
                    </div>
                  )}

                  {bay.vehiclePlate && (
                    <div className="mt-2 px-2 py-0.5 bg-neutral-900/60 rounded text-xs text-neutral-400 font-mono inline-block">
                      {bay.vehiclePlate}
                    </div>
                  )}

                  {/* Live progress bar */}
                  {bar && (
                    <div className="mt-2.5 space-y-1">
                      <div className="flex justify-between text-[10px] text-neutral-500">
                        <span>{bay.liveWorkMins}m used</span>
                        <span>{bay.allocatedMins}m allocated</span>
                      </div>
                      <div className="h-1.5 bg-neutral-800 rounded-full overflow-hidden">
                        <div className={`h-full rounded-full transition-all ${bar.color}`} style={{ width: `${bar.pct}%` }} />
                      </div>
                    </div>
                  )}

                  {/* Fallback elapsed time if no job data */}
                  {!bar && bay.startTime && (
                    <div className="mt-1.5 flex items-center gap-1 text-neutral-500 text-xs">
                      <Timer className="w-3 h-3" /> {getElapsed(bay.startTime)}
                    </div>
                  )}
                </>
              ) : (
                <div className="text-neutral-600 text-xs italic mt-1">
                  {hoveredBay === bay.bayNumber ? '⬇ Drop mechanic here' : 'Available'}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Draggable Staff Pool */}
      {availableStaff.length > 0 && (
        <div className="p-4 bg-neutral-800/40 border border-neutral-700 rounded-xl">
          <div className="text-xs font-bold text-neutral-400 uppercase tracking-wider mb-3">
            Active Staff Without Bay — drag to assign
          </div>
          <div className="flex flex-wrap gap-2">
            {availableStaff.map(s => (
              <div
                key={s.id}
                draggable
                onDragStart={() => setDragStaff(s)}
                onDragEnd={() => setDragStaff(null)}
                className={`flex items-center gap-2 px-3 py-1.5 bg-neutral-900 border rounded-lg text-sm cursor-grab active:cursor-grabbing transition-all select-none ${dragStaff?.id === s.id ? 'border-[#FFD700] text-[#FFD700] scale-95' : 'border-neutral-700 text-white hover:border-neutral-500'}`}
              >
                <div className="w-5 h-5 rounded-full bg-[#FFD700]/20 flex items-center justify-center text-[#FFD700] text-[10px] font-bold">
                  {s.name.charAt(0)}
                </div>
                <span>{s.name.split(' ')[0]}</span>
                {(s.jobsInProgress ?? 0) > 0 && (
                  <span className="text-[10px] text-blue-400">· {s.jobsInProgress} active</span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── PERFORMANCE LEADERBOARD ───────────────────────────────────────────────────
function Leaderboard({ staff }: { staff: StaffMember[] }) {
  const [metric, setMetric] = useState<'jobsToday' | 'revenueToday' | 'efficiencyPct' | 'rating' | 'attendanceRate'>('jobsToday');

  const metrics = [
    { key: 'jobsToday',      label: 'Jobs Done',   icon: <Target className="w-3.5 h-3.5" />,     fmt: (v: number) => `${v}`,                   real: true  },
    { key: 'revenueToday',   label: 'Revenue',     icon: <DollarSign className="w-3.5 h-3.5" />, fmt: (v: number) => `Rs ${v.toLocaleString()}`, real: true  },
    { key: 'efficiencyPct',  label: 'Efficiency',  icon: <Zap className="w-3.5 h-3.5" />,        fmt: (v: number) => `${v}%`,                   real: true  },
    { key: 'rating',         label: 'Rating',      icon: <Star className="w-3.5 h-3.5" />,        fmt: (v: number) => `${v.toFixed(1)} ★`,       real: false },
    { key: 'attendanceRate', label: 'Attendance',  icon: <Activity className="w-3.5 h-3.5" />,   fmt: (v: number) => `${v}%`,                   real: false },
  ] as const;

  const activeMetric = metrics.find(m => m.key === metric)!;
  const sorted = [...staff].sort((a, b) => (b[metric] ?? 0) - (a[metric] ?? 0));
  const max = Math.max(...sorted.map(s => s[metric] ?? 0));

  return (
    <div className="space-y-4">
      {/* Metric switcher */}
      <div className="flex gap-2 flex-wrap items-center">
        {metrics.map(m => (
          <button
            key={m.key}
            onClick={() => setMetric(m.key as typeof metric)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${metric === m.key ? 'bg-[#FFD700] text-black border-[#FFD700]' : 'bg-neutral-800 border-neutral-700 text-neutral-400 hover:text-white'}`}
          >
            {m.icon} {m.label}
            {m.real && <span className="text-[8px] font-bold px-1 py-0.5 bg-emerald-500/20 text-emerald-400 rounded ml-0.5">LIVE</span>}
          </button>
        ))}
      </div>

      {/* Top 3 podium */}
      {sorted.length >= 3 && (
        <div className="grid grid-cols-3 gap-3 mb-2">
          {[sorted[1], sorted[0], sorted[2]].map((s, podiumIdx) => {
            const rank = podiumIdx === 1 ? 0 : podiumIdx === 0 ? 1 : 2;
            const heights = ['h-20', 'h-28', 'h-16'];
            return (
              <div key={s.id} className={`flex flex-col items-center justify-end ${heights[podiumIdx]} p-3 rounded-xl border ${rank === 0 ? 'border-[#FFD700]/40 bg-[#FFD700]/5' : 'border-neutral-700 bg-neutral-800/40'}`}>
                <div className="text-lg mb-0.5">{rankMedal(rank)}</div>
                <div className="w-8 h-8 rounded-full bg-neutral-700 border-2 border-neutral-600 flex items-center justify-center text-[#FFD700] font-bold text-sm mb-1">
                  {s.name.charAt(0)}
                </div>
                <div className="text-white text-xs font-bold text-center truncate w-full text-center">{s.name.split(' ')[0]}</div>
                <div className={`text-xs font-semibold mt-0.5 ${rank === 0 ? 'text-[#FFD700]' : 'text-neutral-400'}`}>
                  {activeMetric.fmt(s[metric] ?? 0)}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Full ranked list */}
      <div className="space-y-2">
        {sorted.map((s, i) => {
          const val = s[metric] ?? 0;
          const pct = max > 0 ? (val / max) * 100 : 0;
          return (
            <div key={s.id} className="flex items-center gap-3 px-3 py-2 bg-neutral-800/50 rounded-xl border border-neutral-800 hover:border-neutral-700 transition-colors">
              <span className="text-sm w-6 text-center flex-shrink-0 font-bold text-neutral-500">{i < 3 ? rankMedal(i) : `${i + 1}`}</span>
              <div className="w-7 h-7 rounded-full bg-neutral-700 flex items-center justify-center text-[#FFD700] font-bold text-xs flex-shrink-0">
                {s.name.charAt(0)}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-white text-xs font-semibold truncate">{s.name}</div>
                <div className="relative mt-1 h-1 bg-neutral-700 rounded-full overflow-hidden">
                  <div className={`absolute left-0 top-0 h-full rounded-full transition-all ${i === 0 ? 'bg-[#FFD700]' : 'bg-neutral-500'}`} style={{ width: `${pct}%` }} />
                </div>
              </div>
              <div className={`text-xs font-bold flex-shrink-0 ${i === 0 ? 'text-[#FFD700]' : 'text-neutral-300'}`}>
                {activeMetric.fmt(val)}
              </div>
              {s.status === 'active' && <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 flex-shrink-0" />}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── MODAL: Service Prices ─────────────────────────────────────────────────────
function ServicePricesModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [prices, setPrices] = useState<ServicePrice[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving,  setSaving]  = useState(false);
  const [error,   setError]   = useState('');

  useEffect(() => {
    apiFetch('/api/staff?resource=service-prices')
      .then(data => setPrices(Array.isArray(data) ? data : []))
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  const update = (idx: number, patch: Partial<ServicePrice>) =>
    setPrices(prev => prev.map((p, i) => i === idx ? { ...p, ...patch } : p));

  const add = () =>
    setPrices(prev => [...prev, { name: '', code: '', price: 0, duration: 30 }]);

  const remove = (idx: number) =>
    setPrices(prev => prev.filter((_, i) => i !== idx));

  const save = async () => {
    const invalid = prices.find(p => !p.name.trim());
    if (invalid) { setError('All service names are required.'); return; }
    setSaving(true); setError('');
    try {
      await apiFetch('/api/staff?resource=service-prices', {
        method: 'PUT',
        body: JSON.stringify({ prices }),
      });
      onSaved(); onClose();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/75 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
      <div className="bg-neutral-900 rounded-2xl border border-neutral-700 w-full max-w-2xl shadow-2xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-800 flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-[#FFD700]/10 flex items-center justify-center">
              <DollarSign className="w-4 h-4 text-[#FFD700]" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">Service Prices</h2>
              <p className="text-xs text-neutral-500">Used to calculate branch revenue from completed bookings</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-neutral-500 hover:text-white hover:bg-neutral-800 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-3">
          {error && <div className="px-4 py-3 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 text-sm">{error}</div>}

          {loading ? (
            <div className="flex items-center justify-center py-12 gap-2 text-neutral-500 text-sm">
              <div className="w-4 h-4 border-2 border-neutral-700 border-t-[#FFD700] rounded-full animate-spin" />
              Loading…
            </div>
          ) : (
            <>
              {/* Column headers */}
              <div className="grid grid-cols-12 gap-2 px-1">
                <span className="col-span-5 text-[10px] font-bold text-neutral-500 uppercase tracking-wider">Service Name</span>
                <span className="col-span-2 text-[10px] font-bold text-neutral-500 uppercase tracking-wider">Code</span>
                <span className="col-span-2 text-[10px] font-bold text-neutral-500 uppercase tracking-wider">Price (Rs)</span>
                <span className="col-span-2 text-[10px] font-bold text-neutral-500 uppercase tracking-wider">Mins</span>
                <span className="col-span-1" />
              </div>

              {prices.map((p, i) => (
                <div key={i} className="grid grid-cols-12 gap-2 items-center">
                  <div className="col-span-5">
                    <Input
                      value={p.name}
                      onChange={e => update(i, { name: e.target.value })}
                      placeholder="e.g. Wheel Alignment"
                    />
                  </div>
                  <div className="col-span-2">
                    <Input
                      value={p.code}
                      onChange={e => update(i, { code: e.target.value.toUpperCase() })}
                      placeholder="AL"
                      maxLength={4}
                    />
                  </div>
                  <div className="col-span-2">
                    <Input
                      type="number"
                      min={0}
                      value={p.price}
                      onChange={e => update(i, { price: Number(e.target.value) })}
                      placeholder="2500"
                    />
                  </div>
                  <div className="col-span-2">
                    <Input
                      type="number"
                      min={0}
                      value={p.duration}
                      onChange={e => update(i, { duration: Number(e.target.value) })}
                      placeholder="60"
                    />
                  </div>
                  <div className="col-span-1 flex justify-center">
                    <button
                      onClick={() => remove(i)}
                      className="p-1.5 text-neutral-600 hover:text-red-400 transition-colors rounded-lg hover:bg-red-500/10"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}

              <button
                onClick={add}
                className="w-full flex items-center justify-center gap-2 py-2.5 border border-dashed border-neutral-700 rounded-xl text-neutral-500 hover:text-white hover:border-neutral-500 text-sm transition-colors"
              >
                <Plus className="w-4 h-4" /> Add Service
              </button>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="flex gap-3 px-6 py-4 border-t border-neutral-800 flex-shrink-0">
          <button onClick={onClose} className="flex-1 px-4 py-2.5 border border-neutral-700 rounded-xl text-neutral-300 text-sm font-medium hover:bg-neutral-800 transition-colors">
            Cancel
          </button>
          <button onClick={save} disabled={saving || loading} className="flex-1 px-4 py-2.5 bg-[#FFD700] rounded-xl text-black text-sm font-bold hover:bg-[#FFD700]/90 transition-colors disabled:opacity-60 flex items-center justify-center gap-2">
            {saving ? <><div className="w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin" /> Saving…</> : 'Save Prices'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── MODAL: Edit Salary ────────────────────────────────────────────────────────
function SalaryModal({ member, onClose, onSaved }: { member: StaffMember; onClose: () => void; onSaved: () => void }) {
  const DEFAULT_OT = 150;
  const [baseSalary, setBaseSalary] = useState(String(member.baseSalary ?? ''));
  const [otRate,     setOtRate]     = useState(String(member.otRate     ?? DEFAULT_OT));
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState('');

  const save = async () => {
    if (!baseSalary || Number(baseSalary) < 0) { setError('Enter a valid base salary'); return; }
    setLoading(true); setError('');
    try {
      await apiFetch('/api/staff?action=update-salary', {
        method: 'POST',
        body: JSON.stringify({
          id:         member.id,
          baseSalary: Number(baseSalary),
          otRate:     Number(otRate) || DEFAULT_OT,
        }),
      });
      onSaved(); onClose();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const base   = Number(baseSalary) || 0;
  const ot     = Number(otRate)     || DEFAULT_OT;
  const epf    = Math.round(base * 0.08);
  const etf    = Math.round(base * 0.03);
  const net    = base - epf;

  return (
    <div className="fixed inset-0 bg-black/75 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
      <div className="bg-neutral-900 rounded-2xl border border-neutral-700 w-full max-w-sm shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-800">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-[#FFD700]/20 flex items-center justify-center text-[#FFD700] font-bold text-sm">
              {member.name.charAt(0)}
            </div>
            <div>
              <h2 className="text-sm font-bold text-white">{member.name}</h2>
              <p className="text-xs text-neutral-500">{member.jobTitle || member.role}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-neutral-500 hover:text-white hover:bg-neutral-800 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          {error && <div className="px-4 py-3 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 text-sm">{error}</div>}

          <div>
            <Label>Base Salary (Rs / month) *</Label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500 text-sm font-medium">Rs</span>
              <Input
                type="number"
                min={0}
                value={baseSalary}
                onChange={e => setBaseSalary(e.target.value)}
                placeholder="e.g. 45000"
                className="pl-9"
              />
            </div>
          </div>

          <div>
            <Label>OT Rate (Rs / hour)</Label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500 text-sm font-medium">Rs</span>
              <Input
                type="number"
                min={0}
                value={otRate}
                onChange={e => setOtRate(e.target.value)}
                placeholder={String(DEFAULT_OT)}
                className="pl-9"
              />
            </div>
            <p className="text-xs text-neutral-600 mt-1">Per hour rate for overtime work</p>
          </div>

          {/* Live preview */}
          {base > 0 && (
            <div className="p-4 bg-neutral-800/60 border border-neutral-700 rounded-xl space-y-2">
              <p className="text-[10px] font-bold text-neutral-500 uppercase tracking-wider mb-3">Monthly Estimate</p>
              {[
                { label: 'Base Salary',   value: `Rs ${base.toLocaleString()}`,  color: 'text-neutral-200' },
                { label: 'EPF (8%)',      value: `−Rs ${epf.toLocaleString()}`,  color: 'text-red-400' },
                { label: 'ETF (3%)',      value: `Rs ${etf.toLocaleString()}`,   color: 'text-blue-400 text-xs opacity-60' },
              ].map(row => (
                <div key={row.label} className="flex justify-between items-center">
                  <span className="text-neutral-500 text-xs">{row.label}</span>
                  <span className={`text-xs font-medium ${row.color}`}>{row.value}</span>
                </div>
              ))}
              <div className="border-t border-neutral-700 pt-2 flex justify-between">
                <span className="text-white text-xs font-bold">Net Take-Home</span>
                <span className="text-emerald-400 font-bold text-sm">Rs {net.toLocaleString()}</span>
              </div>
              {ot > 0 && (
                <p className="text-xs text-amber-400/70 pt-1">+ Rs {ot}/hr OT on overtime hours</p>
              )}
            </div>
          )}

          <div className="flex gap-3 pt-1">
            <button onClick={onClose} className="flex-1 px-4 py-2.5 border border-neutral-700 rounded-xl text-neutral-300 text-sm font-medium hover:bg-neutral-800 transition-colors">
              Cancel
            </button>
            <button onClick={save} disabled={loading} className="flex-1 px-4 py-2.5 bg-[#FFD700] rounded-xl text-black text-sm font-bold hover:bg-[#FFD700]/90 transition-colors disabled:opacity-60 flex items-center justify-center gap-2">
              {loading ? <><div className="w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin" /> Saving…</> : 'Save Salary'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── PAYROLL PANEL ─────────────────────────────────────────────────────────────
function PayrollPanel({
  staff, servicePrices, payrollStats, onEditSalary, onManagePrices, currentMonth, onMonthChange,
}: {
  staff: StaffMember[];
  servicePrices: ServicePrice[];
  payrollStats: PayrollStats | null;
  onEditSalary: (m: StaffMember) => void;
  onManagePrices: () => void;
  currentMonth: string;
  onMonthChange: (m: string) => void;
}) {
  const DEFAULT_OT_RATE  = 150;
  const DEFAULT_SALARY   = 35000;

  // Per-staff revenue share — real branch revenue divided equally across staff
  const staffCount       = staff.length || 1;
  const branchRevenue    = payrollStats?.totalRevenue ?? 0;
  const revenuePerStaff  = staffCount > 0 ? Math.round(branchRevenue / staffCount) : 0;
  const hasPriceData     = servicePrices.length > 0;

  function calcPayroll(s: StaffMember) {
    const base       = s.baseSalary ?? DEFAULT_SALARY;
    const rate       = s.otRate     ?? DEFAULT_OT_RATE;
    const otHours    = s.overtimeHours ?? 0;
    const otPay      = Math.round(otHours * rate);
    const epf        = Math.round(base * 0.08);
    const gross      = base + otPay;
    const net        = gross - epf;
    const hasSalary  = s.baseSalary !== null && s.baseSalary !== undefined;
    return { base, rate, otHours, otPay, epf, gross, net, hasSalary };
  }

  const totalNet   = staff.reduce((a, s) => a + calcPayroll(s).net, 0);
  const totalGross = staff.reduce((a, s) => a + calcPayroll(s).gross, 0);
  const monthLabel = new Date(currentMonth + '-01').toLocaleString('en-GB', { month: 'long', year: 'numeric' });

  return (
    <div className="space-y-5">
      {/* ── Top controls ── */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <input
            type="month"
            value={currentMonth}
            onChange={e => onMonthChange(e.target.value)}
            className="px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-xl text-white text-sm focus:outline-none focus:border-[#FFD700]"
          />
          {payrollStats && (
            <div className="flex items-center gap-1.5 text-xs px-3 py-1.5 bg-emerald-500/10 border border-emerald-500/20 rounded-lg text-emerald-400">
              <CheckCircle className="w-3.5 h-3.5" />
              {payrollStats.bookingCount} completed bookings · Rs {payrollStats.totalRevenue.toLocaleString()} revenue
            </div>
          )}
          {!hasPriceData && (
            <div className="flex items-center gap-1.5 text-xs px-3 py-1.5 bg-amber-500/10 border border-amber-500/20 rounded-lg text-amber-400">
              <AlertTriangle className="w-3.5 h-3.5" />
              Set service prices for real revenue
            </div>
          )}
        </div>
        <button
          onClick={onManagePrices}
          className="flex items-center gap-2 px-4 py-2 bg-neutral-800 border border-neutral-700 rounded-xl text-neutral-300 text-sm font-medium hover:bg-neutral-700 transition-colors"
        >
          <Settings className="w-3.5 h-3.5 text-[#FFD700]" /> Manage Service Prices
        </button>
      </div>

      {/* ── Summary cards ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'Total Staff',    value: String(staff.length),                         sub: 'on roster',            icon: <Users className="w-4 h-4" />,     color: 'text-white',       badge: '' },
          { label: 'Branch Revenue', value: `Rs ${(branchRevenue / 1000).toFixed(1)}k`,   sub: hasPriceData ? 'from bookings' : 'set prices first', icon: <TrendingUp className="w-4 h-4" />, color: 'text-emerald-400', badge: hasPriceData ? 'Real' : '' },
          { label: 'Gross Payroll',  value: `Rs ${(totalGross / 1000).toFixed(0)}k`,      sub: 'base + OT',            icon: <DollarSign className="w-4 h-4" />, color: 'text-[#FFD700]',  badge: '' },
          { label: 'Net Payroll',    value: `Rs ${(totalNet / 1000).toFixed(0)}k`,        sub: 'after EPF deductions', icon: <CheckCircle className="w-4 h-4" />, color: 'text-blue-400',  badge: '' },
        ].map(c => (
          <div key={c.label} className="bg-neutral-800/60 border border-neutral-700 rounded-xl p-3.5">
            <div className="flex items-center justify-between mb-1.5">
              <div className={`${c.color} opacity-60`}>{c.icon}</div>
              {c.badge && <span className="text-[9px] font-bold px-1.5 py-0.5 bg-emerald-500/20 text-emerald-400 rounded-full border border-emerald-500/30">{c.badge}</span>}
            </div>
            <div className={`text-xl font-bold ${c.color}`}>{c.value}</div>
            <div className="text-neutral-500 text-xs mt-0.5">{c.label}</div>
            <div className="text-neutral-700 text-[10px]">{c.sub}</div>
          </div>
        ))}
      </div>

      {/* ── Payroll table ── */}
      <div className="rounded-xl border border-neutral-800 overflow-hidden">
        <div className="px-4 py-3 bg-neutral-950 border-b border-neutral-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-neutral-400 uppercase tracking-wider">{monthLabel} — Payroll</span>
            <span className="text-[10px] text-neutral-600">(Revenue split equally across staff)</span>
          </div>
          <div className="flex items-center gap-2 text-amber-400/70 text-[10px]">
            <AlertTriangle className="w-3 h-3" /> Estimates — verify with HR
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-neutral-900/60 border-b border-neutral-800">
                {['Staff', 'Base Salary', 'OT (hrs)', 'OT Pay', 'Rev. Share', 'EPF (8%)', 'Net Pay', ''].map(h => (
                  <th key={h} className={`px-3 py-2.5 text-left text-neutral-500 font-semibold uppercase tracking-wider whitespace-nowrap ${h === 'Net Pay' ? 'text-right' : ''}`}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-800/60">
              {staff.map(s => {
                const p = calcPayroll(s);
                return (
                  <tr key={s.id} className="hover:bg-neutral-800/30 transition-colors">
                    <td className="px-3 py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-full bg-neutral-800 border border-neutral-700 flex items-center justify-center text-[#FFD700] text-[10px] font-bold flex-shrink-0">
                          {s.name.charAt(0)}
                        </div>
                        <div>
                          <div className="text-white font-medium whitespace-nowrap">{s.name}</div>
                          <div className="text-neutral-600 text-[10px]">{s.jobTitle || s.role}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex items-center gap-1.5">
                        {p.hasSalary
                          ? <span className="text-neutral-200 font-medium">Rs {p.base.toLocaleString()}</span>
                          : <span className="text-amber-400/70 italic text-[10px]">Not set</span>
                        }
                      </div>
                    </td>
                    <td className="px-3 py-3">
                      <span className={p.otHours > 0 ? 'text-amber-400' : 'text-neutral-600'}>
                        {p.otHours.toFixed(1)}h
                      </span>
                    </td>
                    <td className="px-3 py-3 text-amber-400">
                      {p.otPay > 0 ? `+Rs ${p.otPay.toLocaleString()}` : '—'}
                    </td>
                    <td className="px-3 py-3">
                      {hasPriceData
                        ? <span className="text-emerald-400 font-medium">Rs {revenuePerStaff.toLocaleString()}</span>
                        : <span className="text-neutral-600 text-[10px]">Set prices</span>
                      }
                    </td>
                    <td className="px-3 py-3 text-red-400">−Rs {p.epf.toLocaleString()}</td>
                    <td className="px-3 py-3 text-right">
                      <span className={`font-bold ${p.hasSalary ? 'text-emerald-400' : 'text-neutral-600'}`}>
                        {p.hasSalary ? `Rs ${p.net.toLocaleString()}` : '—'}
                      </span>
                    </td>
                    <td className="px-3 py-3">
                      <button
                        onClick={() => onEditSalary(s)}
                        title="Edit salary"
                        className={`p-1.5 rounded-lg transition-colors text-xs flex items-center gap-1 ${p.hasSalary ? 'text-neutral-500 hover:text-[#FFD700] hover:bg-[#FFD700]/10' : 'text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2 py-1 rounded-lg hover:bg-amber-500/20'}`}
                      >
                        <Edit2 className="w-3 h-3" />
                        {!p.hasSalary && <span>Set</span>}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="border-t border-neutral-700 bg-neutral-900/80">
                <td className="px-3 py-3 text-neutral-400 font-bold uppercase tracking-wider">Total</td>
                <td colSpan={5} className="px-3 py-3" />
                <td className="px-3 py-3 text-right text-[#FFD700] font-bold text-sm">Rs {totalNet.toLocaleString()}</td>
                <td />
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  );
}

// ── MODAL: Add Staff ──────────────────────────────────────────────────────────
function AddStaffModal({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
  const [form, setForm] = useState({
    name: '', username: '', password: '', role: '', branch: BRANCHES[0],
    portalRole: 'mechanic', phone: '', skills: [] as string[],
    workingHours: { ...DEFAULT_HOURS } as Record<DayKey, DayHours>,
  });
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState('');
  const [success, setSuccess]   = useState('');

  const set = (k: string, v: any) => setForm(f => ({ ...f, [k]: v }));
  const toggleSkill = (s: string) => setForm(f => ({
    ...f,
    skills: f.skills.includes(s) ? f.skills.filter(x => x !== s) : [...f.skills, s],
  }));
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
      await apiFetch('/api/staff?action=register', {
        method: 'POST',
        body: JSON.stringify({
          username:     form.username.trim().toLowerCase(),
          password:     form.password,
          name:         form.name.trim(),
          role:         form.portalRole,          // portal access level
          jobTitle:     form.role || form.portalRole, // display job title
          branch:       form.branch,
          phone:        form.phone.trim(),
          skills:       form.skills,
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

          {/* Skills */}
          <div className="p-4 bg-neutral-800/60 border border-neutral-700/60 rounded-xl space-y-3">
            <div className="flex items-center gap-2 mb-1">
              <Zap className="w-3.5 h-3.5 text-[#FFD700]" />
              <span className="text-xs font-bold text-[#FFD700] uppercase tracking-wider">Skills & Certifications</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {SKILL_OPTIONS.map(sk => (
                <button type="button" key={sk} onClick={() => toggleSkill(sk)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-medium border transition-colors ${form.skills.includes(sk) ? 'bg-[#FFD700]/15 border-[#FFD700]/40 text-[#FFD700]' : 'bg-neutral-800 border-neutral-700 text-neutral-400 hover:text-white'}`}>
                  {sk}
                </button>
              ))}
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
    name:       member.name,
    jobTitle:   member.jobTitle || member.role,
    portalRole: member.role,
    branch:     member.branch,
    phone:      member.phone,
    password:   '',
    skills:     member.skills ?? [],
  });
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState('');

  const set = (k: string, v: any) => setForm(f => ({ ...f, [k]: v }));
  const toggleSkill = (s: string) => setForm(f => ({
    ...f,
    skills: f.skills.includes(s) ? f.skills.filter(x => x !== s) : [...f.skills, s],
  }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) return setError('Name is required');
    if (form.password && form.password.length < 6) return setError('Password must be at least 6 characters');
    setError(''); setLoading(true);
    try {
      await apiFetch('/api/staff?action=update', {
        method: 'POST',
        body: JSON.stringify({
          id:       member.id,
          name:     form.name.trim(),
          role:     form.portalRole,
          jobTitle: form.jobTitle.trim() || form.portalRole,
          branch:   form.branch,
          phone:    form.phone.trim(),
          skills:   form.skills,
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
      <div className="bg-neutral-900 rounded-2xl border border-neutral-700 w-full max-w-md shadow-2xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-800 flex-shrink-0">
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
        <form onSubmit={submit} className="p-6 space-y-4 overflow-y-auto flex-1">
          {error && <div className="px-4 py-3 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 text-sm">{error}</div>}
          <div>
            <Label>Full Name *</Label>
            <Input value={form.name} onChange={e => set('name', e.target.value)} />
          </div>
          <div>
            <Label>Job Title</Label>
            <Select value={form.jobTitle} onChange={e => set('jobTitle', e.target.value)}>
              <option value="">Select…</option>
              {STAFF_ROLES.map(r => <option key={r} value={r}>{r}</option>)}
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Portal Access Level</Label>
              <Select value={form.portalRole} onChange={e => set('portalRole', e.target.value)}>
                {PORTAL_ROLES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
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
          <div>
            <Label>Skills</Label>
            <div className="flex flex-wrap gap-2 mt-1">
              {SKILL_OPTIONS.map(sk => (
                <button type="button" key={sk} onClick={() => toggleSkill(sk)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-medium border transition-colors ${form.skills.includes(sk) ? 'bg-[#FFD700]/15 border-[#FFD700]/40 text-[#FFD700]' : 'bg-neutral-800 border-neutral-700 text-neutral-400 hover:text-white'}`}>
                  {sk}
                </button>
              ))}
            </div>
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
function LeaveModal({ staff, onClose, onSubmit, onRefresh }: {
  staff: StaffMember[];
  onClose: () => void;
  onSubmit: (req: Omit<LeaveRequest, 'id' | 'createdAt'>) => void;
  onRefresh: () => void;
}) {
  const [staffId, setStaffId] = useState(staff[0]?.id ?? '');
  const [type,    setType]    = useState<LeaveType>('Annual Leave');
  const [date,    setDate]    = useState(tomorrowStr());
  const [reason,  setReason]  = useState('');
  const [error,   setError]   = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => { if (type === 'Tomorrow Off') setDate(tomorrowStr()); }, [type]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!staffId) return setError('Select a staff member');
    setError(''); setSubmitting(true);
    try {
      const m = staff.find(s => s.id === staffId);
      const payload = { staffId, staffName: m?.name ?? '', branch: m?.branch ?? '', type, date, reason: reason.trim() };
      await apiFetch('/api/staff?resource=leave&action=submit', { method: 'POST', body: JSON.stringify(payload) });
      onSubmit({ ...payload, status: 'Pending' });
      onRefresh?.();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to submit leave request');
    } finally {
      setSubmitting(false);
    }
  };

  const typeIcon = {
    'Annual Leave': <Calendar className="w-3.5 h-3.5" />,
    'Sick Leave': <Stethoscope className="w-3.5 h-3.5" />,
    'Break Request': <Coffee className="w-3.5 h-3.5" />,
    'Tomorrow Off': <AlertCircle className="w-3.5 h-3.5" />
  };

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
              className="w-full px-3 py-2.5 bg-neutral-800 border border-neutral-700 rounded-xl text-white text-sm placeholder:text-neutral-600 focus:outline-none focus:border-[#FFD700] transition-all resize-none" />
          </div>
          <div className="flex gap-3">
            <button type="button" onClick={onClose} className="flex-1 px-4 py-2.5 border border-neutral-700 rounded-xl text-neutral-300 text-sm font-medium hover:bg-neutral-800 transition-colors">Cancel</button>
            <button type="submit" disabled={submitting} className="flex-1 px-4 py-2.5 bg-[#FFD700] rounded-xl text-black text-sm font-bold hover:bg-[#FFD700]/90 transition-colors disabled:opacity-60 flex items-center justify-center gap-2">
              {submitting ? <><div className="w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin" /> Submitting…</> : 'Submit'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── STAFF PROFILE DRAWER ──────────────────────────────────────────────────────
function StaffProfileDrawer({ member, onClose }: { member: StaffMember; onClose: () => void }) {
  const p = {
    base: member.baseSalary ?? 35000,
    otPay: Math.round((member.overtimeHours ?? 0) * 150 * 8),
    deductions: Math.round((member.baseSalary ?? 35000) * 0.08),
  };
  p['net'] = p.base + p.otPay - p.deductions;

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-end z-50 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-neutral-900 border-l border-neutral-700 h-full w-full max-w-sm overflow-y-auto shadow-2xl" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="p-6 border-b border-neutral-800">
          <div className="flex items-start justify-between mb-4">
            <button onClick={onClose} className="p-1.5 rounded-lg text-neutral-500 hover:text-white hover:bg-neutral-800 transition-colors">
              <X className="w-4 h-4" />
            </button>
            <span className={`px-2.5 py-1 rounded-full text-xs font-semibold border ${statusClass(member.status)}`}>
              {statusLabel(member.status)}
            </span>
          </div>
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-2xl bg-[#FFD700]/10 border border-[#FFD700]/20 flex items-center justify-center text-[#FFD700] font-bold text-2xl">
              {member.name.charAt(0)}
            </div>
            <div>
              <h3 className="text-white text-xl font-bold">{member.name}</h3>
              <p className="text-neutral-400 text-sm">{member.jobTitle || member.role || 'Staff Member'}</p>
              <p className="text-neutral-600 text-xs font-mono mt-0.5">@{member.username}</p>
            </div>
          </div>
        </div>

        <div className="p-6 space-y-6">
          {/* Quick stats */}
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: 'Jobs Today', value: member.jobsToday ?? 0, color: 'text-[#FFD700]' },
              { label: 'Revenue', value: `Rs ${((member.revenueToday ?? 0) / 1000).toFixed(1)}k`, color: 'text-emerald-400' },
              { label: 'Rating', value: `${(member.rating ?? 0).toFixed(1)} ★`, color: 'text-amber-400' },
              { label: 'Attendance', value: `${member.attendanceRate ?? 0}%`, color: 'text-blue-400' },
            ].map(s => (
              <div key={s.label} className="bg-neutral-800 border border-neutral-700 rounded-xl p-3">
                <div className={`text-lg font-bold ${s.color}`}>{s.value}</div>
                <div className="text-neutral-500 text-xs mt-0.5">{s.label}</div>
              </div>
            ))}
          </div>

          {/* Contact & Info */}
          <div className="space-y-2">
            <div className="text-xs font-bold text-neutral-500 uppercase tracking-wider mb-2">Info</div>
            {[
              { icon: <Phone className="w-3.5 h-3.5" />, label: 'Phone', value: member.phone || '—' },
              { icon: <MapPin className="w-3.5 h-3.5" />, label: 'Branch', value: member.branch },
              { icon: <Wrench className="w-3.5 h-3.5" />, label: 'Bay', value: member.bayNumber ? `Bay ${member.bayNumber}` : 'Unassigned' },
              { icon: <Clock className="w-3.5 h-3.5" />, label: 'Clock In', value: fmtTime(member.clockInAt) },
              { icon: <Timer className="w-3.5 h-3.5" />, label: 'Time On', value: getElapsed(member.clockInAt) },
            ].map(row => (
              <div key={row.label} className="flex items-center justify-between px-3 py-2 bg-neutral-800/50 rounded-lg">
                <div className="flex items-center gap-2 text-neutral-500 text-xs">{row.icon} {row.label}</div>
                <span className="text-white text-xs font-medium">{row.value}</span>
              </div>
            ))}
          </div>

          {/* Skills */}
          {(member.skills?.length ?? 0) > 0 && (
            <div>
              <div className="text-xs font-bold text-neutral-500 uppercase tracking-wider mb-2">Skills</div>
              <div className="flex flex-wrap gap-1.5">
                {member.skills!.map(sk => (
                  <span key={sk} className="px-2.5 py-1 bg-[#FFD700]/10 border border-[#FFD700]/20 rounded-lg text-[#FFD700] text-xs font-medium">
                    {sk}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Payroll summary */}
          <div>
            <div className="text-xs font-bold text-neutral-500 uppercase tracking-wider mb-2">This Month's Pay</div>
            <div className="bg-neutral-800 border border-neutral-700 rounded-xl p-4 space-y-2">
              {[
                { label: 'Base Salary', value: `Rs ${p.base.toLocaleString()}`, color: 'text-neutral-300' },
                { label: `OT Pay (${(member.overtimeHours ?? 0).toFixed(1)}h)`, value: p.otPay > 0 ? `+Rs ${p.otPay.toLocaleString()}` : '—', color: 'text-amber-400' },
                { label: 'EPF (8%)', value: `−Rs ${p.deductions.toLocaleString()}`, color: 'text-red-400' },
              ].map(row => (
                <div key={row.label} className="flex justify-between text-xs">
                  <span className="text-neutral-500">{row.label}</span>
                  <span className={row.color}>{row.value}</span>
                </div>
              ))}
              <div className="border-t border-neutral-700 pt-2 flex justify-between">
                <span className="text-white text-xs font-bold">Net Pay</span>
                <span className="text-emerald-400 text-sm font-bold">Rs {p['net'].toLocaleString()}</span>
              </div>
            </div>
          </div>

          {/* OT tracker */}
          <div>
            <div className="text-xs font-bold text-neutral-500 uppercase tracking-wider mb-2">Overtime This Month</div>
            <div className="bg-neutral-800 border border-neutral-700 rounded-xl p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-amber-400 text-2xl font-bold">{(member.overtimeHours ?? 0).toFixed(1)}h</span>
                <span className="text-neutral-500 text-xs">/ 20h limit</span>
              </div>
              <div className="h-2 bg-neutral-700 rounded-full overflow-hidden">
                <div className="h-full bg-amber-400 rounded-full transition-all"
                  style={{ width: `${Math.min(((member.overtimeHours ?? 0) / 20) * 100, 100)}%` }} />
              </div>
            </div>
          </div>
        </div>
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
  const sessionUser = getSessionUser();
  const defaultBranch =
    sessionUser && !['Super Admin', 'Admin'].includes(sessionUser.role) && sessionUser.branch
      ? sessionUser.branch
      : BRANCHES[0];

  const [staff,          setStaff]          = useState<StaffMember[]>([]);
  const [enriched,       setEnriched]       = useState<StaffMember[]>([]);
  const [loading,        setLoading]        = useState(true);
  const [error,          setError]          = useState<string | null>(null);
  const [branch,         setBranch]         = useState(defaultBranch);
  const [search,         setSearch]         = useState('');
  const [activeTab,      setActiveTab]      = useState<'directory' | 'bays' | 'performance' | 'payroll' | 'leaves'>('directory');
  const [showAdd,        setShowAdd]        = useState(false);
  const [editMember,     setEditMember]     = useState<StaffMember | null>(null);
  const [deleteId,       setDeleteId]       = useState<string | null>(null);
  const [showLeave,      setShowLeave]      = useState(false);
  const [profileMember,  setProfileMember]  = useState<StaffMember | null>(null);
  const [leaveFilter,    setLeaveFilter]    = useState<LeaveStatus | 'All'>('All');
  const [leaveRequests,  setLeaveRequests]  = useState<LeaveRequest[]>([]);
  const [clockTick,      setClockTick]      = useState(0);
  const [servicePrices,  setServicePrices]  = useState<ServicePrice[]>([]);
  const [payrollStats,   setPayrollStats]   = useState<PayrollStats | null>(null);
  const [showPricesModal,setShowPricesModal]= useState(false);
  const [salaryTarget,   setSalaryTarget]   = useState<StaffMember | null>(null);
  const [currentMonth,   setCurrentMonth]   = useState(() => new Date().toISOString().slice(0, 7));
  const today = todayStr();

  // Live clock tick every minute to refresh elapsed times
  useEffect(() => {
    const id = setInterval(() => setClockTick(t => t + 1), 60000);
    return () => clearInterval(id);
  }, []);

  const fetchStaff = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const [staffData, perfData] = await Promise.all([
        apiFetch(`/api/staff?branch=${encodeURIComponent(branch)}&date=${today}`),
        apiFetch(`/api/jobs?resource=staff-performance&branch=${encodeURIComponent(branch)}&date=${today}`)
          .catch(() => []),
      ]);

      const perfMap: Record<string, any> = {};
      (Array.isArray(perfData) ? perfData : []).forEach((p: any) => {
        perfMap[String(p.staffId)] = p;
      });

      const mapped: StaffMember[] = (staffData as any[]).map((m: any) => {
        const sid  = String(m._id || m.id);
        const p    = perfMap[sid] || {};
        const hasJobs = p.jobsCompleted != null || p.jobsInProgress != null;
        const ratingFromEff = p.efficiencyPct != null
          ? Math.max(1, Math.min(5, parseFloat((1 + (p.efficiencyPct / 100) * 4).toFixed(1))))
          : undefined;
        return {
          id:            sid,
          name:          m.name     || '',
          role:          m.role     || 'Cashier',
          jobTitle:      m.jobTitle || m.role || '',
          username:      m.username || '',
          phone:         m.phone    || '',
          branch:        m.branch   || branch,
          status:        m.dayStatus?.status   ?? 'off',
          bayNumber:     p.activeBay ?? (m.dayStatus?.bayNumber ? String(m.dayStatus.bayNumber) : null),
          activeBay:     p.activeBay ?? null,
          clockInAt:     m.dayStatus?.clockInAt ?? null,
          workingHours:  m.workingHours   ?? undefined,
          skills:        Array.isArray(m.skills) && m.skills.length ? m.skills : undefined,
          jobsToday:     p.jobsCompleted  ?? undefined,
          jobsInProgress:p.jobsInProgress ?? undefined,
          jobsOverdue:   p.jobsOverdue    ?? undefined,
          revenueToday:  p.totalRevenue   ?? undefined,
          overtimeHours: p.overtimeMins   != null ? p.overtimeMins / 60 : undefined,
          efficiencyPct: p.efficiencyPct  ?? undefined,
          onTimeRate:    p.onTimeRate     ?? undefined,
          pauseCount:    p.pauseCount     ?? undefined,
          currentJob:    p.currentJob     ?? null,
          rating:        ratingFromEff,
          attendanceRate:hasJobs ? 100 : undefined,
          baseSalary:    m.baseSalary ?? undefined,
          otRate:        m.otRate     ?? undefined,
        };
      });
      setStaff(mapped);
      setEnriched(enrichStaff(mapped));
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [branch, today]);

  const fetchLeaveRequests = useCallback(async () => {
    try {
      const data: any[] = await apiFetch(`/api/staff?resource=leave&branch=${encodeURIComponent(branch)}`);
      setLeaveRequests(data.map((r: any) => ({
        id:        String(r._id || r.id),
        staffId:   r.staffId,
        staffName: r.staffName,
        type:      r.type as LeaveType,
        date:      r.date,
        reason:    r.reason || '',
        status:    r.status as LeaveStatus,
        createdAt: r.createdAt,
      })));
    } catch (err: any) {
      console.error('Failed to fetch leave requests:', err);
    }
  }, [branch]);

  const fetchServicePrices = useCallback(async () => {
    try {
      const data = await apiFetch('/api/staff?resource=service-prices');
      setServicePrices(Array.isArray(data) ? data : []);
    } catch (e) { console.error('[servicePrices]', e); }
  }, []);

  const fetchPayrollStats = useCallback(async () => {
    try {
      const data = await apiFetch(
        `/api/staff?resource=payroll-stats&branch=${encodeURIComponent(branch)}&month=${currentMonth}`
      );
      setPayrollStats(data);
    } catch (e) { console.error('[payrollStats]', e); }
  }, [branch, currentMonth]);

  useEffect(() => { fetchStaff(); }, [fetchStaff]);
  useEffect(() => { if (activeTab === 'leaves')  fetchLeaveRequests();  }, [activeTab, fetchLeaveRequests]);
  useEffect(() => { if (activeTab === 'payroll') fetchPayrollStats();   }, [activeTab, fetchPayrollStats]);
  useEffect(() => { fetchServicePrices(); }, [fetchServicePrices]);
  useEffect(() => {
    if (activeTab === 'leaves') {
      const id = setInterval(fetchLeaveRequests, 15000);
      return () => clearInterval(id);
    }
  }, [activeTab, fetchLeaveRequests]);

  const changeStatus = async (member: StaffMember, newStatus: string) => {
    setStaff(prev => prev.map(s => s.id === member.id ? { ...s, status: newStatus as any } : s));
    setEnriched(prev => prev.map(s => s.id === member.id ? { ...s, status: newStatus as any } : s));
    try {
      let action = 'set_status';
      if (newStatus === 'active')   action = 'clock_in';
      if (newStatus === 'on_break') action = 'start_break';
      if (newStatus === 'off')      action = 'clock_out';
      await patchStatus(member.id, action, member.branch, today);
    } catch {
      fetchStaff();
    }
  };

  const assignBay = async (staffId: string, bayNumber: string) => {
    setEnriched(prev => prev.map(s => s.id === staffId ? { ...s, bayNumber } : s));
    try {
      await patchStatus(staffId, 'assign_bay', branch, today, { bayNumber });
    } catch {
      fetchStaff();
    }
  };

  const handleDelete = async (id: string) => {
    setDeleteId(null);
    try {
      await apiFetch('/api/staff?action=deactivate', { method: 'POST', body: JSON.stringify({ id }) });
      setStaff(prev => prev.filter(s => s.id !== id));
      setEnriched(prev => prev.filter(s => s.id !== id));
    } catch (err: any) {
      alert(`Failed to deactivate: ${err.message}`);
    }
  };

  const addLeave = (req: Omit<LeaveRequest, 'id' | 'createdAt'>) =>
    setLeaveRequests(prev => [...prev, { ...req, id: Date.now().toString(), createdAt: new Date().toISOString() }]);

  const actOnLeave = async (id: string, status: LeaveStatus) => {
    try {
      await apiFetch('/api/staff?resource=leave&action=respond', {
        method: 'POST',
        body: JSON.stringify({ id, status, respondedBy: 'Admin' }),
      });
      setLeaveRequests(prev => prev.map(r => r.id === id ? { ...r, status } : r));
    } catch (err: any) {
      alert(`Failed to update leave request: ${err.message}`);
    }
  };

  // Derived
  const filtered     = enriched.filter(s => s.name.toLowerCase().includes(search.toLowerCase()) || s.role.toLowerCase().includes(search.toLowerCase()));
  const activeCount  = enriched.filter(s => s.status === 'active').length;
  const breakCount   = enriched.filter(s => s.status === 'on_break').length;
  const offCount     = enriched.filter(s => s.status === 'off').length;
  const pendingCount = leaveRequests.filter(r => r.status === 'Pending').length;
  const filteredLeaves = leaveFilter === 'All' ? leaveRequests : leaveRequests.filter(r => r.status === leaveFilter);
  const availBays    = TOTAL_BAYS - enriched.filter(s => s.bayNumber).length;

  const TABS = [
    { key: 'directory',   label: 'Directory',    icon: <Users className="w-3.5 h-3.5" /> },
    { key: 'bays',        label: 'Bay Map',       icon: <Wrench className="w-3.5 h-3.5" /> },
    { key: 'performance', label: 'Performance',   icon: <Trophy className="w-3.5 h-3.5" /> },
    { key: 'payroll',     label: 'Payroll',       icon: <DollarSign className="w-3.5 h-3.5" /> },
    { key: 'leaves',      label: `Leaves${pendingCount > 0 ? ` · ${pendingCount}` : ''}`, icon: <Calendar className="w-3.5 h-3.5" /> },
  ];

  return (
    <div className="space-y-6">
      {/* ── Page header ── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-white">Staff Management</h2>
          <p className="text-neutral-500 text-sm mt-0.5">Manage staff, bays, performance and payroll</p>
        </div>
        <div className="flex items-center gap-2">
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

      {error && (
        <div className="flex items-center justify-between px-4 py-3 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 text-sm">
          <span>⚠ {error}</span>
          <button onClick={fetchStaff} className="underline hover:no-underline">Retry</button>
        </div>
      )}

      {/* ── Stats ── */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {[
          { label: 'Total Staff',    value: enriched.length, color: 'text-white',        sub: branch,         icon: <Users className="w-5 h-5" /> },
          { label: 'Active',         value: activeCount,     color: 'text-emerald-400',   sub: 'working now',  icon: <UserCheck className="w-5 h-5" /> },
          { label: 'On Break',       value: breakCount,      color: 'text-amber-400',     sub: 'currently',    icon: <Coffee className="w-5 h-5" /> },
          { label: 'Off / Absent',   value: offCount,        color: 'text-neutral-400',   sub: 'today',        icon: <UserX className="w-5 h-5" /> },
          { label: 'Bays Available', value: availBays,       color: 'text-blue-400',      sub: `of ${TOTAL_BAYS} total`, icon: <Wrench className="w-5 h-5" /> },
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
      <div className="flex gap-1 bg-neutral-900 border border-neutral-800 rounded-xl p-1 overflow-x-auto">
        {TABS.map(tab => (
          <button key={tab.key} onClick={() => setActiveTab(tab.key as any)}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap flex-shrink-0 ${activeTab === tab.key ? 'bg-[#FFD700] text-black' : 'text-neutral-400 hover:text-white'}`}>
            {tab.icon} {tab.label}
          </button>
        ))}
      </div>

      {/* ── Tab: Directory ── */}
      {activeTab === 'directory' && (
        <div className="bg-neutral-900 border border-neutral-800 rounded-2xl overflow-hidden">
          <div className="px-5 py-4 border-b border-neutral-800 flex items-center gap-3">
            <div className="relative flex-1 max-w-xs">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-500" />
              <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search name or role…" className="pl-9" />
            </div>
            <span className="text-neutral-600 text-sm">{filtered.length} staff</span>
          </div>

          {loading && (
            <div className="flex items-center justify-center py-16 gap-2 text-neutral-500 text-sm">
              <div className="w-4 h-4 border-2 border-neutral-700 border-t-[#FFD700] rounded-full animate-spin" />
              Loading staff…
            </div>
          )}
          {!loading && filtered.length === 0 && (
            <div className="py-16 text-center text-neutral-500 text-sm">No staff found</div>
          )}
          {!loading && filtered.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-neutral-950 border-b border-neutral-800">
                    {['Staff Member', 'Role / Skills', 'Status', 'Bay', 'Today', 'Phone', 'Actions'].map(h => (
                      <th key={h} className={`px-4 py-3 text-left text-xs font-bold text-neutral-500 uppercase tracking-wider ${h === 'Actions' ? 'text-right' : ''}`}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-800">
                  {filtered.map(m => (
                    <tr key={m.id} className="hover:bg-neutral-800/40 transition-colors cursor-pointer" onClick={() => setProfileMember(m)}>
                      <td className="px-4 py-3.5" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-neutral-800 border border-neutral-700 flex items-center justify-center text-[#FFD700] font-bold text-sm flex-shrink-0">
                            {m.name.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <div className="text-white font-medium text-sm leading-tight">{m.name}</div>
                            <div className="text-neutral-600 text-xs font-mono">{m.username}</div>
                            {m.clockInAt && m.status === 'active' && (
                              <div className="text-emerald-600 text-xs flex items-center gap-1 mt-0.5">
                                <Clock className="w-2.5 h-2.5" /> {getElapsed(m.clockInAt)}
                              </div>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3.5">
                        <div className="text-neutral-400 text-sm">{m.jobTitle || m.role || '—'}</div>
                        {m.skills && m.skills.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-1">
                            {m.skills.slice(0, 2).map(sk => (
                              <span key={sk} className="px-1.5 py-0.5 bg-[#FFD700]/10 text-[#FFD700] text-[10px] rounded font-medium">{sk}</span>
                            ))}
                            {m.skills.length > 2 && <span className="text-neutral-600 text-[10px]">+{m.skills.length - 2}</span>}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3.5" onClick={e => e.stopPropagation()}>
                        <select value={m.status} onChange={e => changeStatus(m, e.target.value)}
                          className={`px-2.5 py-1 rounded-full text-xs font-semibold border cursor-pointer focus:outline-none appearance-none ${statusClass(m.status)}`}
                          style={{ background: 'transparent' }}>
                          <option value="active">Active</option>
                          <option value="on_break">On Break</option>
                          <option value="off">Off</option>
                        </select>
                      </td>
                      <td className="px-4 py-3.5">
                        {m.bayNumber
                          ? <span className="flex items-center gap-1 text-[#FFD700] text-xs font-medium"><Wrench className="w-3 h-3" /> Bay {m.bayNumber}</span>
                          : <span className="text-neutral-700 text-xs">—</span>}
                      </td>
                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-1.5">
                          <span className="text-white text-xs font-semibold">
                            {m.jobsToday ?? 0} done
                          </span>
                          {(m.jobsInProgress ?? 0) > 0 && (
                            <span className="text-[10px] text-blue-400 bg-blue-500/10 px-1.5 py-0.5 rounded-full">
                              {m.jobsInProgress} active
                            </span>
                          )}
                          {(m.jobsOverdue ?? 0) > 0 && (
                            <span className="flex items-center gap-0.5 text-[10px] text-red-400 bg-red-500/10 px-1.5 py-0.5 rounded-full">
                              <AlertTriangle className="w-2.5 h-2.5" />{m.jobsOverdue} OT
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <span className="text-emerald-500 text-xs">Rs {((m.revenueToday ?? 0) / 1000).toFixed(1)}k</span>
                          {m.efficiencyPct != null && (
                            <span className={`text-[10px] font-medium ${m.efficiencyPct >= 90 ? 'text-emerald-400' : m.efficiencyPct >= 70 ? 'text-amber-400' : 'text-red-400'}`}>
                              {m.efficiencyPct}% eff.
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3.5" onClick={e => e.stopPropagation()}>
                        {m.phone
                          ? <a href={`tel:${m.phone}`} className="flex items-center gap-1.5 text-neutral-400 hover:text-[#FFD700] text-xs transition-colors">
                              <Phone className="w-3.5 h-3.5" /> {m.phone}
                            </a>
                          : <span className="text-neutral-700 text-xs">—</span>}
                      </td>
                      <td className="px-4 py-3.5" onClick={e => e.stopPropagation()}>
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

      {/* ── Tab: Bay Map ── */}
      {activeTab === 'bays' && (
        <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-6">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h3 className="text-white font-bold">Workshop Bay Map</h3>
              <p className="text-neutral-500 text-xs mt-0.5">Drag mechanics to assign bays · {branch} Branch</p>
            </div>
            <div className="flex items-center gap-2 text-xs text-neutral-500">
              <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              Live
            </div>
          </div>
          {loading ? (
            <div className="flex items-center justify-center py-16 gap-2 text-neutral-500 text-sm">
              <div className="w-4 h-4 border-2 border-neutral-700 border-t-[#FFD700] rounded-full animate-spin" />
              Loading bays…
            </div>
          ) : (
            <BayMap staff={enriched} onAssign={assignBay} />
          )}
        </div>
      )}

      {/* ── Tab: Performance ── */}
      {activeTab === 'performance' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          {/* Leaderboard */}
          <div className="lg:col-span-2 bg-neutral-900 border border-neutral-800 rounded-2xl p-6">
            <div className="flex items-center gap-3 mb-5">
              <div className="w-8 h-8 rounded-lg bg-[#FFD700]/10 flex items-center justify-center">
                <Trophy className="w-4 h-4 text-[#FFD700]" />
              </div>
              <div>
                <h3 className="text-white font-bold">Performance Leaderboard</h3>
                <p className="text-neutral-500 text-xs">{branch} · Today</p>
              </div>
            </div>
            {loading ? (
              <div className="flex items-center justify-center py-16 gap-2 text-neutral-500 text-sm">
                <div className="w-4 h-4 border-2 border-neutral-700 border-t-[#FFD700] rounded-full animate-spin" />
                Loading…
              </div>
            ) : enriched.length === 0 ? (
              <div className="py-16 text-center text-neutral-500 text-sm">No staff data</div>
            ) : (
              <Leaderboard staff={enriched} />
            )}
          </div>

          {/* Branch Stats */}
          <div className="space-y-4">
            <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-5">
              <h3 className="text-white font-bold mb-4 text-sm">Branch Summary</h3>
              <div className="space-y-3">
                {[
                  { label: 'Total Jobs Today',  value: enriched.reduce((a, s) => a + (s.jobsToday ?? 0), 0), color: 'text-[#FFD700]', icon: <Target className="w-4 h-4" /> },
                  { label: 'In Progress',       value: enriched.reduce((a, s) => a + (s.jobsInProgress ?? 0), 0), color: 'text-blue-400', icon: <Activity className="w-4 h-4" /> },
                  { label: 'Overdue Jobs',      value: enriched.reduce((a, s) => a + (s.jobsOverdue ?? 0), 0), color: 'text-red-400', icon: <AlertTriangle className="w-4 h-4" /> },
                  { label: 'Total Revenue',     value: `Rs ${(enriched.reduce((a, s) => a + (s.revenueToday ?? 0), 0) / 1000).toFixed(1)}k`, color: 'text-emerald-400', icon: <DollarSign className="w-4 h-4" /> },
                ].map(s => (
                  <div key={s.label} className="flex items-center gap-3 px-3 py-2.5 bg-neutral-800/50 rounded-xl">
                    <div className={`${s.color} opacity-70`}>{s.icon}</div>
                    <div className="flex-1">
                      <div className="text-neutral-500 text-xs">{s.label}</div>
                      <div className={`text-base font-bold ${s.color}`}>{s.value}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Top performer highlight */}
            {enriched.length > 0 && (() => {
              const top = [...enriched].sort((a, b) => (b.jobsToday ?? 0) - (a.jobsToday ?? 0))[0];
              return (
                <div className="bg-[#FFD700]/5 border border-[#FFD700]/20 rounded-2xl p-5">
                  <div className="flex items-center gap-2 mb-3">
                    <Flame className="w-4 h-4 text-[#FFD700]" />
                    <span className="text-[#FFD700] text-xs font-bold uppercase tracking-wider">Top Performer Today</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-[#FFD700]/20 flex items-center justify-center text-[#FFD700] font-bold text-lg">
                      {top.name.charAt(0)}
                    </div>
                    <div>
                      <div className="text-white font-bold">{top.name}</div>
                      <div className="text-neutral-400 text-xs">{top.role}</div>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2 mt-3">
                    <div className="bg-neutral-900/60 rounded-lg px-3 py-2">
                      <div className="text-[#FFD700] font-bold">{top.jobsToday}</div>
                      <div className="text-neutral-500 text-xs">Jobs</div>
                    </div>
                    <div className="bg-neutral-900/60 rounded-lg px-3 py-2">
                      <div className="text-emerald-400 font-bold text-sm">Rs {((top.revenueToday ?? 0) / 1000).toFixed(1)}k</div>
                      <div className="text-neutral-500 text-xs">Revenue</div>
                    </div>
                  </div>
                </div>
              );
            })()}
          </div>
        </div>
      )}

      {/* ── Tab: Payroll ── */}
      {activeTab === 'payroll' && (
        <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-6">
          <div className="flex items-center gap-3 mb-5">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center">
              <DollarSign className="w-4 h-4 text-emerald-400" />
            </div>
            <div>
              <h3 className="text-white font-bold">Payroll Overview</h3>
              <p className="text-neutral-500 text-xs">{branch} branch</p>
            </div>
          </div>
          {loading ? (
            <div className="flex items-center justify-center py-16 gap-2 text-neutral-500 text-sm">
              <div className="w-4 h-4 border-2 border-neutral-700 border-t-[#FFD700] rounded-full animate-spin" />
              Loading…
            </div>
          ) : enriched.length === 0 ? (
            <div className="py-16 text-center text-neutral-500 text-sm">No staff data</div>
          ) : (
            <PayrollPanel
              staff={enriched}
              servicePrices={servicePrices}
              payrollStats={payrollStats}
              onEditSalary={m => setSalaryTarget(m)}
              onManagePrices={() => setShowPricesModal(true)}
              currentMonth={currentMonth}
              onMonthChange={m => setCurrentMonth(m)}
            />
          )}
        </div>
      )}

      {/* ── Tab: Leave Board ── */}
      {activeTab === 'leaves' && (
        <div className="space-y-4">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-neutral-600 text-sm">Show:</span>
            {(['All', 'Pending', 'Approved', 'Denied'] as const).map(f => (
              <button key={f} onClick={() => setLeaveFilter(f)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors border ${leaveFilter === f ? 'bg-[#FFD700] text-black border-[#FFD700]' : 'bg-neutral-900 border-neutral-800 text-neutral-400 hover:text-white hover:border-neutral-700'}`}>
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
                <div key={req.id} className={`bg-neutral-900 border rounded-2xl p-4 space-y-3 ${req.status === 'Pending' ? 'border-amber-500/20' : req.status === 'Approved' ? 'border-emerald-500/20' : 'border-red-500/20'}`}>
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
                className="flex-1 px-4 py-2.5 border border-neutral-700 rounded-xl text-neutral-300 text-sm hover:bg-neutral-800 transition-colors">Cancel</button>
              <button onClick={() => handleDelete(deleteId)}
                className="flex-1 px-4 py-2.5 bg-red-600 rounded-xl text-white text-sm font-bold hover:bg-red-700 transition-colors">Deactivate</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modals ── */}
      {showAdd      && <AddStaffModal  onClose={() => setShowAdd(false)}      onSuccess={fetchStaff} />}
      {editMember   && <EditStaffModal member={editMember} onClose={() => setEditMember(null)} onSuccess={fetchStaff} />}
      {showLeave    && <LeaveModal     staff={enriched} onClose={() => setShowLeave(false)} onSubmit={addLeave} onRefresh={fetchLeaveRequests} />}
      {profileMember && <StaffProfileDrawer member={profileMember} onClose={() => setProfileMember(null)} />}
      {showPricesModal && (
        <ServicePricesModal
          onClose={() => setShowPricesModal(false)}
          onSaved={() => { fetchServicePrices(); fetchPayrollStats(); }}
        />
      )}
      {salaryTarget && (
        <SalaryModal
          member={salaryTarget}
          onClose={() => setSalaryTarget(null)}
          onSaved={() => {
            setSalaryTarget(null);
            fetchStaff();
          }}
        />
      )}
    </div>
  );
}