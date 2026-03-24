import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  RefreshCw, Clock, MapPin, User, Car, Calendar,
  AlertTriangle, Package, Search, Plus, X,
  Coffee, Wrench, CheckCircle, Circle, Minus,
  Play, Pause, Square, ShieldCheck, Link2, Unlink,
  BarChart2, TrendingUp, TrendingDown, Award, Download,
} from 'lucide-react';

const API = (import.meta.env.VITE_API_URL || 'https://anuratyres-backend-emm1774.vercel.app/api')
  .replace(/\/api$/, '');

const BRANCHES = ['Pannipitiya', 'Ratnapura', 'Kalawana', 'Nivithigala'];

const BRANCH_BAYS: Record<string, number> = {
  Pannipitiya: 4, Ratnapura: 2, Kalawana: 2, Nivithigala: 2,
};

const SERVICES = [
  'Wheel Alignment', 'Wheel Balancing', 'Tyre Change', 'Tyre Repair (Puncture)',
  'Nitrogen Filling', 'Full Service', 'Oil Change', 'Battery Check & Replace',
  'Brake Service', 'AC Service', 'Heavy Vehicle Alignment', 'Truck Tyre Change',
  'Bus Full Service',
];

// ─── Pause reasons ───────────────────────────────────────────────────────────
const PAUSE_REASONS = [
  'Fetching tyres / tools',
  'On break',
  'Waiting for parts',
  'Customer query',
  'Equipment issue',
  'Supervisor needed',
  'Other',
];

// ─── Live clock hook ──────────────────────────────────────────────────────────
function useNow(_active?: boolean) {
  // Always tick — computeRemaining handles stoppedAt correctly
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  return now;
}

// ─── Format mm:ss ─────────────────────────────────────────────────────────────
function fmtCountdown(secs: number) {
  const abs = Math.abs(secs);
  const m   = Math.floor(abs / 60).toString().padStart(2, '0');
  const s   = (abs % 60).toString().padStart(2, '0');
  return `${secs < 0 ? '-' : ''}${m}:${s}`;
}

// ─── Compute remaining seconds from a timer doc ───────────────────────────────
function computeRemaining(timer: any, allocatedMins: number, nowMs: number): number {
  if (!timer?.startedAt) return allocatedMins * 60;

  // Use stop time if job is done — freeze the display at final value
  const endMs = timer.stoppedAt
    ? new Date(timer.stoppedAt).getTime()
    : nowMs;

  const elapsed = Math.floor((endMs - new Date(timer.startedAt).getTime()) / 1000);
  let paused = 0;
  for (const p of timer.pauseLogs || []) {
    const end = p.resumedAt
      ? new Date(p.resumedAt).getTime()
      : (timer.stoppedAt ? new Date(timer.stoppedAt).getTime() : nowMs);
    paused += Math.floor((end - new Date(p.pausedAt).getTime()) / 1000);
  }
  return allocatedMins * 60 - (elapsed - paused);
}

// ─── Types ────────────────────────────────────────────────────────────────────
interface Job {
  _id:          string;
  bookingId:    string | null;
  bookingRef:   string;
  branch:       string;
  date:         string;
  timeSlot:     string;
  vehiclePlate: string;
  customerName: string;
  customerPhone:string;
  service:      string;
  allocatedMins:number;
  staffId:      string | null;
  staffName:    string | null;
  bayNumber:    number | null;
  status:       string;
  source:       string;
}

interface StaffMember {
  id:       string;
  _id:      string;
  name:     string;
  role:     string;
  username: string;
  phone:    string;
  dayStatus: {
    status:    'active' | 'on_break' | 'off';
    bayNumber: number | null;
    clockInAt: string | null;
  };
}

// ─── Report types ────────────────────────────────────────────────────────────
interface ReportJob {
  service:       string;
  vehiclePlate:  string;
  bookingRef:    string;
  allocatedMins: number;
  activeWorkMins:number;
  overtimeMins:  number;
  isOvertime:    boolean;
  pauseLogs:     { reason: string; pausedAt: string; resumedAt: string | null }[];
}
interface ReportStaff {
  staffId:       string;
  name:          string;
  role:          string;
  completedJobs: number;
  allocatedMins: number;
  activeWorkMins:number;
  overtimeMins:  number;
  pauseMins:     number;
  efficiencyPct: number;
  overtimeFlag:  boolean;
  jobs:          ReportJob[];
}
interface Report {
  branch:           string;
  date:             string;
  generatedAt:      string;
  totalJobsDone:    number;
  totalStaffWorked: number;
  staff:            ReportStaff[];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
const JOB_STATUS_COLORS: Record<string, string> = {
  unassigned:  'bg-neutral-800 text-neutral-400 border-neutral-700',
  assigned:    'bg-blue-500/20 text-blue-400 border-blue-500/30',
  in_progress: 'bg-green-500/20 text-green-400 border-green-500/30',
  paused:      'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  done:        'bg-neutral-800 text-neutral-500 border-neutral-700',
};
const JOB_STATUS_LABELS: Record<string, string> = {
  unassigned: 'Unassigned', assigned: 'Assigned',
  in_progress: 'In Progress', paused: 'Paused', done: 'Done',
};

const STAFF_STATUS_CONFIG = {
  active:   { dot: 'bg-green-500',  label: 'Active',   text: 'text-green-400',  badge: 'bg-green-500/20 border-green-500/30 text-green-400' },
  on_break: { dot: 'bg-yellow-400', label: 'On Break', text: 'text-yellow-400', badge: 'bg-yellow-500/20 border-yellow-500/30 text-yellow-400' },
  off:      { dot: 'bg-neutral-600',label: 'Off',      text: 'text-neutral-500',badge: 'bg-neutral-800 border-neutral-700 text-neutral-500' },
};

// ═══════════════════════════════════════════════════════════════════════════════
// TIMER PANEL — slide-in panel when a job card is clicked
// ═══════════════════════════════════════════════════════════════════════════════
function TimerPanel({ job, onClose, onRefresh }: {
  job:       Job;
  onClose:   () => void;
  onRefresh: () => void;
}) {
  const isRunning = job.status === 'in_progress';
  const isPaused  = job.status === 'paused';
  const isDone    = job.status === 'done';

  const now        = useNow();
  const remaining  = computeRemaining((job as any).timer, job.allocatedMins, now);
  const isOvertime = isRunning && remaining < 0;

  const [loading,       setLoading]       = useState(false);
  const [showReasons,   setShowReasons]   = useState(false);
  const [actionError,   setActionError]   = useState('');

  const callTimer = async (action: string, extra: Record<string, any> = {}) => {
    setLoading(true);
    setActionError('');
    try {
      const res = await fetch(`${API}/api/jobs?resource=timer`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ jobId: job._id, staffId: job.staffId, action, ...extra }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Action failed');
      onRefresh();
    } catch (err: any) {
      setActionError(err.message);
    } finally {
      setLoading(false);
      setShowReasons(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-end z-50 backdrop-blur-sm"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="bg-neutral-900 border-l border-neutral-700 w-full max-w-sm h-full flex flex-col shadow-2xl">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-neutral-800">
          <div className="min-w-0">
            <p className="text-white font-bold text-sm truncate">{job.service}</p>
            <p className="text-neutral-500 text-xs mt-0.5 font-mono">{job.vehiclePlate || '—'} · {job.customerName || 'Walk-in'}</p>
          </div>
          <button onClick={onClose} className="text-neutral-500 hover:text-white transition-colors ml-3 flex-shrink-0">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-5">

          {/* ── Countdown display ── */}
          <div className={`rounded-xl p-6 text-center border ${
            isDone      ? 'bg-neutral-800 border-neutral-700' :
            isOvertime  ? 'bg-red-500/10 border-red-500/30' :
            isPaused    ? 'bg-yellow-500/10 border-yellow-500/30' :
            isRunning   ? 'bg-green-500/10 border-green-500/30' :
                          'bg-neutral-800 border-neutral-700'
          }`}>
            {isDone ? (
              <div className="flex flex-col items-center gap-2">
                <CheckCircle className="w-10 h-10 text-green-400" />
                <p className="text-green-400 font-bold text-lg">Job Complete</p>
              </div>
            ) : (
              <>
                <p className={`text-5xl font-black font-mono tracking-tight ${
                  isOvertime ? 'text-red-400' :
                  isPaused   ? 'text-yellow-400' :
                  isRunning  ? 'text-green-400' :
                               'text-neutral-400'
                }`}>
                  {isRunning || isPaused ? fmtCountdown(remaining) : `${job.allocatedMins}:00`}
                </p>
                <p className="text-neutral-500 text-xs mt-2">
                  {isOvertime ? '⚠ Overtime' :
                   isPaused   ? '⏸ Paused' :
                   isRunning  ? 'Remaining' :
                                `${job.allocatedMins} min allocated`}
                </p>
              </>
            )}
          </div>

          {/* ── Status + allocated info ── */}
          <div className="grid grid-cols-2 gap-3 text-xs">
            <div className="bg-neutral-800 rounded-lg p-3">
              <p className="text-neutral-500 mb-1">Allocated</p>
              <p className="text-white font-bold">{job.allocatedMins} min</p>
            </div>
            <div className="bg-neutral-800 rounded-lg p-3">
              <p className="text-neutral-500 mb-1">Assigned to</p>
              <p className="text-white font-bold truncate">{job.staffName || '—'}</p>
            </div>
          </div>

          {/* ── Error ── */}
          {actionError && (
            <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-xs">
              {actionError}
            </div>
          )}

          {/* ── Control buttons ── */}
          {!isDone && (
            <div className="space-y-3">

              {/* START — only when assigned and not yet started */}
              {job.status === 'assigned' && (
                <button
                  onClick={() => callTimer('start')}
                  disabled={loading}
                  className="w-full flex items-center justify-center gap-2 py-3.5 bg-green-500 hover:bg-green-400 text-black font-bold rounded-xl transition-colors disabled:opacity-50"
                >
                  <Play className="w-5 h-5" /> Start Job
                </button>
              )}

              {/* PAUSE — only when running */}
              {isRunning && !showReasons && (
                <button
                  onClick={() => setShowReasons(true)}
                  disabled={loading}
                  className="w-full flex items-center justify-center gap-2 py-3.5 bg-yellow-500 hover:bg-yellow-400 text-black font-bold rounded-xl transition-colors disabled:opacity-50"
                >
                  <Pause className="w-5 h-5" /> Pause
                </button>
              )}

              {/* STOP — when running or paused */}
              {(isRunning || isPaused) && (
                <button
                  onClick={() => callTimer('stop')}
                  disabled={loading}
                  className="w-full flex items-center justify-center gap-2 py-3.5 bg-neutral-800 hover:bg-red-500/20 text-red-400 font-bold rounded-xl border border-neutral-700 hover:border-red-500/40 transition-colors disabled:opacity-50"
                >
                  <Square className="w-4 h-4" /> Stop Job
                </button>
              )}

              {/* APPROVE RESUME — only when paused (supervisor action) */}
              {isPaused && (
                <button
                  onClick={() => callTimer('approve_resume')}
                  disabled={loading}
                  className="w-full flex items-center justify-center gap-2 py-3.5 bg-[#FFD700] hover:bg-[#FFD700]/90 text-black font-bold rounded-xl transition-colors disabled:opacity-50"
                >
                  <ShieldCheck className="w-5 h-5" /> Approve & Resume
                </button>
              )}

            </div>
          )}

          {/* ── Pause reason picker ── */}
          {showReasons && (
            <div className="space-y-2">
              <p className="text-xs font-bold text-neutral-400 uppercase tracking-wider">Select pause reason</p>
              {PAUSE_REASONS.map(reason => (
                <button
                  key={reason}
                  onClick={() => callTimer('pause', { reason })}
                  disabled={loading}
                  className="w-full text-left px-4 py-3 bg-neutral-800 hover:bg-neutral-700 border border-neutral-700 hover:border-yellow-500/40 rounded-xl text-sm text-neutral-300 hover:text-white transition-colors disabled:opacity-50"
                >
                  {reason}
                </button>
              ))}
              <button
                onClick={() => setShowReasons(false)}
                className="w-full text-xs text-neutral-600 hover:text-neutral-400 py-2 transition-colors"
              >
                Cancel
              </button>
            </div>
          )}

          {/* ── Pause log history ── */}
          {(job as any).timer?.pauseLogs?.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-bold text-neutral-500 uppercase tracking-wider">Pause history</p>
              {(job as any).timer.pauseLogs.map((p: any, i: number) => (
                <div key={i} className="flex items-center justify-between bg-neutral-800 rounded-lg px-3 py-2 text-xs">
                  <span className="text-neutral-400">{p.reason}</span>
                  <span className={p.resumedAt ? 'text-green-500' : 'text-yellow-400'}>
                    {p.resumedAt ? '✓ Resumed' : '⏸ Active'}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// ADD MANUAL JOB MODAL
// ═══════════════════════════════════════════════════════════════════════════════
function AddJobModal({ branch, date, onClose, onSaved }: {
  branch: string; date: string;
  onClose: () => void; onSaved: () => void;
}) {
  const [form, setForm] = useState({
    vehiclePlate: '', customerName: '', customerPhone: '',
    service: '', timeSlot: '',
  });
  const [saving, setSaving] = useState(false);
  const [error,  setError]  = useState('');

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.service) return setError('Please select a service');
    setSaving(true); setError('');
    try {
      const res = await fetch(`${API}/api/jobs`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ branch, date, ...form }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to create job');
      onSaved(); onClose();
    } catch (err: any) { setError(err.message); }
    finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
      <div className="bg-neutral-900 rounded-xl border border-neutral-700 w-full max-w-md shadow-2xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-800">
          <h2 className="text-base font-bold text-white">Add Manual Job</h2>
          <button onClick={onClose} className="text-neutral-500 hover:text-white transition-colors"><X className="w-5 h-5" /></button>
        </div>
        <form onSubmit={submit} className="p-6 space-y-4">
          {error && <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm">{error}</div>}
          <div className="grid grid-cols-2 gap-3 text-xs text-neutral-400 mb-1">
            <span>Branch: <span className="text-white font-medium">{branch}</span></span>
            <span>Date: <span className="text-white font-medium">{date}</span></span>
          </div>
          <div>
            <label className="text-xs font-medium text-neutral-400 block mb-1.5">Service *</label>
            <select value={form.service} onChange={e => setForm({ ...form, service: e.target.value })}
              className="w-full px-3 py-2.5 bg-neutral-800 border border-neutral-700 rounded-lg text-white text-sm focus:outline-none focus:border-[#FFD700] transition-colors">
              <option value="">Select service...</option>
              {SERVICES.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-neutral-400 block mb-1.5">Vehicle Plate</label>
              <input value={form.vehiclePlate} onChange={e => setForm({ ...form, vehiclePlate: e.target.value.toUpperCase() })}
                placeholder="e.g. CAB-1234"
                className="w-full px-3 py-2.5 bg-neutral-800 border border-neutral-700 rounded-lg text-white text-sm focus:outline-none focus:border-[#FFD700] placeholder:text-neutral-600 transition-colors" />
            </div>
            <div>
              <label className="text-xs font-medium text-neutral-400 block mb-1.5">Time Slot</label>
              <input type="time" value={form.timeSlot} onChange={e => setForm({ ...form, timeSlot: e.target.value })}
                className="w-full px-3 py-2.5 bg-neutral-800 border border-neutral-700 rounded-lg text-white text-sm focus:outline-none focus:border-[#FFD700] transition-colors" />
            </div>
          </div>
          <div>
            <label className="text-xs font-medium text-neutral-400 block mb-1.5">Customer Name</label>
            <input value={form.customerName} onChange={e => setForm({ ...form, customerName: e.target.value })}
              placeholder="e.g. Nimal Perera"
              className="w-full px-3 py-2.5 bg-neutral-800 border border-neutral-700 rounded-lg text-white text-sm focus:outline-none focus:border-[#FFD700] placeholder:text-neutral-600 transition-colors" />
          </div>
          <div>
            <label className="text-xs font-medium text-neutral-400 block mb-1.5">Customer Phone</label>
            <input value={form.customerPhone} onChange={e => setForm({ ...form, customerPhone: e.target.value })}
              placeholder="077 123 4567"
              className="w-full px-3 py-2.5 bg-neutral-800 border border-neutral-700 rounded-lg text-white text-sm focus:outline-none focus:border-[#FFD700] placeholder:text-neutral-600 transition-colors" />
          </div>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 px-4 py-2.5 border border-neutral-700 rounded-lg text-neutral-300 text-sm font-medium hover:bg-neutral-800 transition-colors">Cancel</button>
            <button type="submit" disabled={saving} className="flex-1 px-4 py-2.5 bg-[#FFD700] rounded-lg text-black text-sm font-bold hover:bg-[#FFD700]/90 transition-colors disabled:opacity-50">
              {saving ? 'Adding...' : 'Add Job'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// JOB CARD (draggable)
// ═══════════════════════════════════════════════════════════════════════════════
function JobCard({ job, onDragStart, onSelect, chainMode, isChainFirst, onChainSelect, onUnchain }: {
  job:           Job;
  onDragStart:   (e: React.DragEvent, jobId: string) => void;
  onSelect:      (jobId: string) => void;
  chainMode?:    boolean;
  isChainFirst?: boolean;
  onChainSelect?:(jobId: string) => void;
  onUnchain?:    (jobId: string) => void;
}) {
  const isDraggable = job.status === 'unassigned' && !chainMode;
  const isChained   = !!(job.chainedToJob || job.chainedFromJob);

  const handleClick = () => {
    if (chainMode && onChainSelect) { onChainSelect(job._id); return; }
    onSelect(job._id);
  };

  return (
    <div
      draggable={isDraggable}
      onDragStart={e => isDraggable && onDragStart(e, job._id)}
      onClick={handleClick}
      className={`bg-neutral-900 border rounded-xl p-4 transition-all cursor-pointer
        ${isChainFirst  ? 'border-purple-500 ring-2 ring-purple-500/30' :
          chainMode     ? 'border-purple-500/40 hover:border-purple-500' :
          isChained     ? 'border-blue-500/30 hover:border-blue-500/60' :
          isDraggable   ? 'border-neutral-800 hover:border-[#FFD700]/40' :
                          'border-neutral-800 hover:border-neutral-600'}
      `}
    >
      {/* Chain indicator badges */}
      {job.chainedFromJob && (
        <div className="flex items-center gap-1 text-[9px] font-bold text-blue-400 bg-blue-500/10 border border-blue-500/20 px-2 py-0.5 rounded-full w-fit mb-2">
          <Link2 className="w-2.5 h-2.5" /> Continues from previous job
        </div>
      )}

      <div className="flex items-start justify-between gap-2 mb-3">
        <div className="min-w-0">
          <p className="text-white font-bold text-sm leading-tight">{job.service}</p>
          {job.bookingRef && (
            <p className="text-[10px] text-[#FFD700]/70 font-mono mt-0.5">{job.bookingRef}</p>
          )}
        </div>
        <div className="flex items-center gap-1.5 flex-shrink-0">
          {/* Unchain button */}
          {isChained && onUnchain && !chainMode && (
            <button
              onClick={e => { e.stopPropagation(); onUnchain(job._id); }}
              className="p-1 rounded text-neutral-600 hover:text-red-400 hover:bg-neutral-800 transition-colors"
              title="Remove chain"
            >
              <Unlink className="w-3 h-3" />
            </button>
          )}
          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border whitespace-nowrap ${JOB_STATUS_COLORS[job.status] ?? JOB_STATUS_COLORS.unassigned}`}>
            {JOB_STATUS_LABELS[job.status] ?? job.status}
          </span>
        </div>
      </div>
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-xs text-neutral-400">
            <Car className="w-3 h-3 flex-shrink-0" />
            <span className="font-mono font-medium">{job.vehiclePlate || '—'}</span>
          </div>
          {job.timeSlot && (
            <div className="flex items-center gap-1 text-xs text-neutral-400">
              <Clock className="w-3 h-3" />
              <span>{job.timeSlot}</span>
            </div>
          )}
        </div>
        {job.customerName && (
          <div className="flex items-center gap-1.5 text-xs text-neutral-400">
            <User className="w-3 h-3 flex-shrink-0" />
            <span className="truncate">{job.customerName}</span>
          </div>
        )}
        <div className="flex items-center justify-between pt-1">
          <div className="flex items-center gap-1.5 text-xs text-neutral-500">
            <Clock className="w-3 h-3" />
            <span>{job.allocatedMins} min</span>
          </div>
          <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${
            job.source === 'website' ? 'bg-blue-500/15 text-blue-400' : 'bg-neutral-700 text-neutral-500'
          }`}>
            {job.source === 'website' ? 'ONLINE' : 'MANUAL'}
          </span>
        </div>
        {/* Chain-to indicator */}
        {job.chainedToJob && (
          <div className="flex items-center gap-1 text-[9px] font-bold text-blue-400 mt-2 pt-2 border-t border-blue-500/20">
            <Link2 className="w-2.5 h-2.5" />
            <span>Chains to next job →</span>
          </div>
        )}

        {/* Hints */}
        {isDraggable && !chainMode && (
          <p className="text-[10px] text-neutral-600 text-center pt-1">↕ drag to assign</p>
        )}
        {chainMode && (
          <p className={`text-[10px] text-center pt-1 font-bold ${isChainFirst ? 'text-purple-400' : 'text-purple-500/70'}`}>
            {isChainFirst ? '1st — now click 2nd job' : 'Click to select'}
          </p>
        )}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// STAFF TILE
// ═══════════════════════════════════════════════════════════════════════════════
function StaffTile({ member, jobs, branch, date, bayCount, onDrop, onStatusChange, onBayChange }: {
  member:         StaffMember;
  jobs:           Job[];
  branch:         string;
  date:           string;
  bayCount:       number;
  onDrop:         (jobId: string, staffId: string) => void;
  onStatusChange: (staffId: string, action: string) => void;
  onBayChange:    (staffId: string, bay: number | null) => void;
}) {
  const [dragOver, setDragOver] = useState(false);
  const ds     = member.dayStatus;
  const sc     = STAFF_STATUS_CONFIG[ds.status] ?? STAFF_STATUS_CONFIG.off;

  // Jobs currently assigned to this staff member (not done)
  const myJobs = jobs.filter(j => j.staffId === member._id && j.status !== 'done');

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  };
  const handleDragLeave = () => setDragOver(false);
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const jobId = e.dataTransfer.getData('jobId');
    if (jobId) onDrop(jobId, member._id);
  };

  // Next status action button
  const statusAction = ds.status === 'active'
    ? { label: 'Break', action: 'start_break', icon: <Coffee className="w-3 h-3" /> }
    : ds.status === 'on_break'
    ? { label: 'Resume', action: 'end_break', icon: <CheckCircle className="w-3 h-3" /> }
    : { label: 'Clock In', action: 'clock_in', icon: <Circle className="w-3 h-3" /> };

  return (
    <div className={`bg-neutral-900 border rounded-xl overflow-hidden transition-all duration-200
      ${dragOver ? 'border-[#FFD700]/60 ring-1 ring-[#FFD700]/30' : 'border-neutral-800'}
      ${ds.status === 'off' ? 'opacity-60' : ''}
    `}>

      {/* ── Staff header ───────────────────────────────────────────────── */}
      <div className="p-4 border-b border-neutral-800">
        <div className="flex items-center gap-3">

          {/* Avatar with status dot */}
          <div className="relative flex-shrink-0">
            <div className="w-10 h-10 rounded-full bg-neutral-800 border border-neutral-700 flex items-center justify-center text-[#FFD700] font-black text-sm">
              {member.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
            </div>
            <span className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-neutral-900 ${sc.dot}`} />
          </div>

          {/* Name + role */}
          <div className="flex-1 min-w-0">
            <p className="text-white font-bold text-sm truncate">{member.name}</p>
            <p className="text-neutral-500 text-xs truncate">{member.role}</p>
          </div>

          {/* Status badge + action button */}
          <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${sc.badge}`}>
              {sc.label}
            </span>
            <button
              onClick={() => onStatusChange(member._id, statusAction.action)}
              className="flex items-center gap-1 text-[10px] font-bold text-neutral-400 hover:text-white transition-colors px-2 py-1 bg-neutral-800 hover:bg-neutral-700 rounded-lg border border-neutral-700"
            >
              {statusAction.icon}
              {statusAction.label}
            </button>
          </div>
        </div>

        {/* Bay selector */}
        <div className="mt-3 flex items-center gap-2">
          <MapPin className="w-3 h-3 text-neutral-600 flex-shrink-0" />
          <span className="text-[10px] text-neutral-600 uppercase tracking-wider mr-1">Bay</span>
          <div className="flex gap-1">
            {Array.from({ length: bayCount }, (_, i) => i + 1).map(bay => (
              <button
                key={bay}
                onClick={() => onBayChange(member._id, ds.bayNumber === bay ? null : bay)}
                className={`w-7 h-7 rounded-lg text-xs font-bold transition-colors ${
                  ds.bayNumber === bay
                    ? 'bg-[#FFD700] text-black'
                    : 'bg-neutral-800 border border-neutral-700 text-neutral-400 hover:border-neutral-500 hover:text-white'
                }`}
              >
                {bay}
              </button>
            ))}
            {ds.bayNumber && (
              <button
                onClick={() => onBayChange(member._id, null)}
                className="w-7 h-7 rounded-lg text-xs font-bold bg-neutral-800 border border-neutral-700 text-neutral-500 hover:text-red-400 transition-colors"
                title="Clear bay"
              >
                <X className="w-3 h-3 mx-auto" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ── Drop zone ──────────────────────────────────────────────────── */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`min-h-[80px] p-3 transition-all duration-150 ${
          dragOver
            ? 'bg-[#FFD700]/8 border-t-2 border-[#FFD700]/40'
            : 'border-t border-neutral-800'
        }`}
      >
        {myJobs.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-16 text-center">
            <Wrench className={`w-4 h-4 mb-1 ${dragOver ? 'text-[#FFD700]/60' : 'text-neutral-700'}`} />
            <p className={`text-xs ${dragOver ? 'text-[#FFD700]/80 font-medium' : 'text-neutral-600'}`}>
              {dragOver ? 'Drop to assign' : 'No jobs assigned'}
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {myJobs.map(job => (
              <div key={job._id} className="bg-neutral-800 rounded-lg px-3 py-2 border border-neutral-700">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-white text-xs font-semibold truncate flex-1">{job.service}</p>
                  <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full border flex-shrink-0 ${JOB_STATUS_COLORS[job.status]}`}>
                    {JOB_STATUS_LABELS[job.status]}
                  </span>
                </div>
                <div className="flex items-center gap-3 mt-1">
                  <span className="text-[10px] text-neutral-500 font-mono">{job.vehiclePlate || '—'}</span>
                  <span className="text-[10px] text-neutral-600">{job.allocatedMins}m</span>
                </div>
              </div>
            ))}
            {/* Drop hint at bottom when already has jobs */}
            {dragOver && (
              <div className="border-2 border-dashed border-[#FFD700]/40 rounded-lg p-2 text-center text-[#FFD700]/70 text-xs font-bold">
                + Drop here
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// REPORT VIEW
// ═══════════════════════════════════════════════════════════════════════════════
function ReportView({ branch, date }: { branch: string; date: string }) {
  const [report,  setReport]  = useState<Report | null>(null);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);

  const fetchReport = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const res  = await fetch(`${API}/api/jobs?resource=report&branch=${encodeURIComponent(branch)}&date=${date}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to fetch report');
      setReport(data);
    } catch (err: any) { setError(err.message); }
    finally { setLoading(false); }
  }, [branch, date]);

  useEffect(() => { fetchReport(); }, [fetchReport]);

  // Export to CSV
  const exportCSV = () => {
    if (!report) return;
    const rows = [
      ['Staff', 'Role', 'Jobs Done', 'Allocated (min)', 'Actual (min)', 'Overtime (min)', 'Pause (min)', 'Efficiency %'],
      ...report.staff.map(s => [
        s.name, s.role, s.completedJobs,
        s.allocatedMins, s.activeWorkMins, s.overtimeMins, s.pauseMins, s.efficiencyPct,
      ]),
    ];
    const csv  = rows.map(r => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href = url; a.download = `anura-report-${branch}-${date}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  if (loading) return (
    <div className="flex items-center justify-center py-20">
      <RefreshCw className="w-6 h-6 text-[#FFD700] animate-spin" />
    </div>
  );

  if (error) return (
    <div className="flex items-center gap-2 p-4 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 text-sm">
      <AlertTriangle className="w-4 h-4 flex-shrink-0" />{error}
    </div>
  );

  if (!report) return null;

  const overtimeCount = report.staff.filter(s => s.overtimeFlag).length;

  return (
    <div className="space-y-6">

      {/* ── Report header ─────────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-neutral-400 text-sm">
            Generated for <span className="text-white font-medium">{report.branch}</span> on{' '}
            <span className="text-white font-medium">{report.date}</span>
          </p>
          <p className="text-neutral-600 text-xs mt-0.5">
            {new Date(report.generatedAt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={fetchReport}
            className="p-2 bg-neutral-900 border border-neutral-700 rounded-lg text-neutral-400 hover:text-white transition-colors">
            <RefreshCw className="w-4 h-4" />
          </button>
          <button onClick={exportCSV}
            className="flex items-center gap-2 px-4 py-2 bg-neutral-900 border border-neutral-700 rounded-lg text-neutral-300 text-sm font-medium hover:bg-neutral-800 transition-colors">
            <Download className="w-4 h-4" /> Export CSV
          </button>
        </div>
      </div>

      {/* ── Summary cards ─────────────────────────────────────────────── */}
      <div className="grid grid-cols-4 gap-4">
        {[
          { label: 'Jobs Done',     value: report.totalJobsDone,    color: 'text-white',        icon: <CheckCircle className="w-5 h-5" /> },
          { label: 'Staff Worked',  value: report.totalStaffWorked, color: 'text-blue-400',     icon: <Award className="w-5 h-5" /> },
          { label: 'Overtime Cases',value: overtimeCount,           color: overtimeCount > 0 ? 'text-red-400' : 'text-green-400',
            icon: overtimeCount > 0 ? <TrendingUp className="w-5 h-5" /> : <TrendingDown className="w-5 h-5" /> },
          { label: 'On Time',       value: report.totalStaffWorked - overtimeCount, color: 'text-green-400', icon: <CheckCircle className="w-5 h-5" /> },
        ].map(s => (
          <div key={s.label} className="bg-neutral-900 border border-neutral-800 rounded-xl p-4 flex items-center gap-3">
            <div className={`${s.color} opacity-60`}>{s.icon}</div>
            <div>
              <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
              <p className="text-neutral-500 text-xs mt-0.5">{s.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* ── No data state ─────────────────────────────────────────────── */}
      {report.staff.length === 0 && (
        <div className="py-16 text-center bg-neutral-900 border border-neutral-800 rounded-xl">
          <BarChart2 className="w-10 h-10 text-neutral-700 mx-auto mb-3" />
          <p className="text-neutral-400 font-medium">No completed jobs yet for {report.date}</p>
          <p className="text-neutral-600 text-sm mt-1">
            Report will populate as jobs are marked done throughout the day.
          </p>
        </div>
      )}

      {/* ── Staff breakdown ───────────────────────────────────────────── */}
      <div className="space-y-4">
        {report.staff.map(s => {
          const isExpanded = expanded === s.staffId;
          const effColor =
            s.efficiencyPct >= 90 ? 'text-green-400'  :
            s.efficiencyPct >= 70 ? 'text-yellow-400' : 'text-red-400';
          const effBar =
            s.efficiencyPct >= 90 ? 'bg-green-500'  :
            s.efficiencyPct >= 70 ? 'bg-yellow-400' : 'bg-red-500';

          return (
            <div key={s.staffId}
              className={`bg-neutral-900 border rounded-xl overflow-hidden transition-colors ${
                s.overtimeFlag ? 'border-red-500/30' : 'border-neutral-800'
              }`}
            >
              {/* Staff row */}
              <button
                onClick={() => setExpanded(isExpanded ? null : s.staffId)}
                className="w-full text-left"
              >
                <div className="p-5 flex flex-col md:flex-row md:items-center gap-4">

                  {/* Name + role */}
                  <div className="flex items-center gap-3 min-w-[180px]">
                    <div className="w-9 h-9 rounded-full bg-neutral-800 border border-neutral-700 flex items-center justify-center text-[#FFD700] font-black text-sm flex-shrink-0">
                      {s.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <p className="text-white font-bold text-sm">{s.name}</p>
                      <p className="text-neutral-500 text-xs">{s.role}</p>
                    </div>
                  </div>

                  {/* Stats grid */}
                  <div className="flex-1 grid grid-cols-2 md:grid-cols-4 gap-3">
                    <div className="bg-neutral-800 rounded-lg p-2.5 text-center">
                      <p className="text-white font-bold text-lg">{s.completedJobs}</p>
                      <p className="text-neutral-500 text-[10px]">Jobs done</p>
                    </div>
                    <div className="bg-neutral-800 rounded-lg p-2.5 text-center">
                      <p className="text-white font-bold text-lg">{s.activeWorkMins}m</p>
                      <p className="text-neutral-500 text-[10px]">Actual time</p>
                    </div>
                    <div className={`rounded-lg p-2.5 text-center ${s.overtimeMins > 0 ? 'bg-red-500/10' : 'bg-neutral-800'}`}>
                      <p className={`font-bold text-lg ${s.overtimeMins > 0 ? 'text-red-400' : 'text-neutral-500'}`}>
                        {s.overtimeMins > 0 ? `+${s.overtimeMins}m` : '—'}
                      </p>
                      <p className="text-neutral-500 text-[10px]">Overtime</p>
                    </div>
                    <div className="bg-neutral-800 rounded-lg p-2.5 text-center">
                      <p className={`font-bold text-lg ${effColor}`}>{s.efficiencyPct}%</p>
                      <p className="text-neutral-500 text-[10px]">Efficiency</p>
                    </div>
                  </div>

                  {/* Efficiency bar + overtime badge */}
                  <div className="flex flex-col gap-2 min-w-[140px]">
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="text-neutral-500">Efficiency</span>
                      <span className={effColor}>{s.efficiencyPct}%</span>
                    </div>
                    <div className="w-full bg-neutral-800 rounded-full h-2">
                      <div
                        className={`h-2 rounded-full transition-all ${effBar}`}
                        style={{ width: `${Math.min(s.efficiencyPct, 100)}%` }}
                      />
                    </div>
                    {s.overtimeFlag && (
                      <div className="flex items-center gap-1 text-[10px] font-bold text-red-400 bg-red-500/10 border border-red-500/20 px-2 py-1 rounded-lg">
                        <TrendingUp className="w-3 h-3" /> OVERTIME
                      </div>
                    )}
                    {s.pauseMins > 0 && (
                      <div className="flex items-center gap-1 text-[10px] text-yellow-500 bg-yellow-500/10 border border-yellow-500/20 px-2 py-1 rounded-lg">
                        <Coffee className="w-3 h-3" /> {s.pauseMins}m paused
                      </div>
                    )}
                  </div>

                  {/* Expand chevron */}
                  <div className={`text-neutral-600 transition-transform ${isExpanded ? 'rotate-180' : ''}`}>
                    <TrendingDown className="w-4 h-4" />
                  </div>

                </div>
              </button>

              {/* Expanded: per-job breakdown */}
              {isExpanded && (
                <div className="border-t border-neutral-800 p-5 space-y-3">
                  <p className="text-xs font-bold text-neutral-500 uppercase tracking-wider mb-3">Job breakdown</p>
                  {s.jobs.map((job, i) => (
                    <div key={i} className={`flex items-center gap-3 p-3 rounded-lg border text-sm ${
                      job.isOvertime
                        ? 'bg-red-500/5 border-red-500/20'
                        : 'bg-neutral-800 border-neutral-700'
                    }`}>
                      <div className="flex-1 min-w-0">
                        <p className="text-white font-semibold text-xs truncate">{job.service}</p>
                        <p className="text-neutral-500 text-[10px] font-mono">{job.vehiclePlate || '—'}{job.bookingRef ? ` · ${job.bookingRef}` : ''}</p>
                      </div>
                      <div className="flex items-center gap-4 text-xs flex-shrink-0">
                        <div className="text-center">
                          <p className="text-neutral-400">{job.allocatedMins}m</p>
                          <p className="text-neutral-600 text-[9px]">allocated</p>
                        </div>
                        <div className="text-center">
                          <p className={job.isOvertime ? 'text-red-400 font-bold' : 'text-white'}>{job.activeWorkMins}m</p>
                          <p className="text-neutral-600 text-[9px]">actual</p>
                        </div>
                        {job.isOvertime && (
                          <div className="text-center">
                            <p className="text-red-400 font-bold">+{job.overtimeMins}m</p>
                            <p className="text-neutral-600 text-[9px]">over</p>
                          </div>
                        )}
                        {job.pauseLogs.length > 0 && (
                          <div className="text-center">
                            <p className="text-yellow-400">{job.pauseLogs.length}×</p>
                            <p className="text-neutral-600 text-[9px]">paused</p>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}

                  {/* Totals row */}
                  <div className="flex items-center gap-3 p-3 rounded-lg bg-neutral-700/30 border border-neutral-700 text-sm mt-2">
                    <p className="text-neutral-400 text-xs flex-1 font-bold uppercase tracking-wider">Totals</p>
                    <div className="flex items-center gap-4 text-xs flex-shrink-0">
                      <div className="text-center">
                        <p className="text-neutral-300 font-bold">{s.allocatedMins}m</p>
                        <p className="text-neutral-600 text-[9px]">allocated</p>
                      </div>
                      <div className="text-center">
                        <p className={`font-bold ${s.overtimeFlag ? 'text-red-400' : 'text-green-400'}`}>{s.activeWorkMins}m</p>
                        <p className="text-neutral-600 text-[9px]">actual</p>
                      </div>
                      {s.overtimeMins > 0 && (
                        <div className="text-center">
                          <p className="text-red-400 font-bold">+{s.overtimeMins}m</p>
                          <p className="text-neutral-600 text-[9px]">over</p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN PAGE
// ═══════════════════════════════════════════════════════════════════════════════
export function JobManagementPage() {
  const today = new Date().toISOString().split('T')[0];

  const [branch,        setBranch]        = useState(BRANCHES[0]);
  const [date,          setDate]          = useState(today);
  const [jobs,          setJobs]          = useState<Job[]>([]);
  const [staff,         setStaff]         = useState<StaffMember[]>([]);
  const [loadingJobs,   setLoadingJobs]   = useState(false);
  const [loadingStaff,  setLoadingStaff]  = useState(false);
  const [error,         setError]         = useState<string | null>(null);
  const [search,        setSearch]        = useState('');
  const [showAddModal,  setShowAddModal]  = useState(false);
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const [view,          setView]          = useState<'board' | 'report'>('board');
  const [chainMode,     setChainMode]     = useState(false);   // chain-selection active
  const [chainFirst,    setChainFirst]    = useState<string | null>(null); // first selected job

  const dragJobId = useRef<string | null>(null);

  // ── Fetch jobs ──────────────────────────────────────────────────────────────
  const fetchJobs = useCallback(async () => {
    setLoadingJobs(true);
    setError(null);
    try {
      const res  = await fetch(`${API}/api/jobs?branch=${encodeURIComponent(branch)}&date=${date}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to fetch jobs');
      setJobs(Array.isArray(data) ? data : []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoadingJobs(false);
    }
  }, [branch, date]);

  // ── Fetch staff ─────────────────────────────────────────────────────────────
  const fetchStaff = useCallback(async () => {
    setLoadingStaff(true);
    try {
      const res  = await fetch(`${API}/api/staff?branch=${encodeURIComponent(branch)}&date=${date}`);
      const data = await res.json();
      if (res.ok) setStaff(Array.isArray(data) ? data : []);
    } catch {
      // non-fatal — staff panel just stays empty
    } finally {
      setLoadingStaff(false);
    }
  }, [branch, date]);

  const fetchAll = useCallback(() => {
    fetchJobs();
    fetchStaff();
  }, [fetchJobs, fetchStaff]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  // ── Drag start ──────────────────────────────────────────────────────────────
  const handleDragStart = (e: React.DragEvent, jobId: string) => {
    dragJobId.current = jobId;
    e.dataTransfer.setData('jobId', jobId);
    e.dataTransfer.effectAllowed = 'move';
  };

  // ── Drop on staff tile → assign ─────────────────────────────────────────────
  const handleDrop = async (jobId: string, staffId: string) => {
    // Optimistic update
    const member = staff.find(s => s._id === staffId);
    setJobs(prev => prev.map(j =>
      j._id === jobId
        ? { ...j, staffId, staffName: member?.name || null, status: 'assigned' }
        : j
    ));

    try {
      const res = await fetch(`${API}/api/jobs?resource=assign&id=${jobId}`, {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ action: 'assign_staff', staffId }),
      });
      if (!res.ok) throw new Error('Assign failed');
    } catch {
      // Revert on failure
      fetchJobs();
    }
  };

  // ── Staff status change ──────────────────────────────────────────────────────
  const handleStatusChange = async (staffId: string, action: string) => {
    // Optimistic
    setStaff(prev => prev.map(m => {
      if (m._id !== staffId) return m;
      const newStatus =
        action === 'clock_in'    ? 'active'   :
        action === 'start_break' ? 'on_break' : 'off';
      return { ...m, dayStatus: { ...m.dayStatus, status: newStatus as any } };
    }));

    try {
      await fetch(`${API}/api/staff?id=${staffId}`, {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ action, branch, date }),
      });
    } catch {
      fetchStaff();
    }
  };

  // ── Bay assignment ───────────────────────────────────────────────────────────
  const handleBayChange = async (staffId: string, bay: number | null) => {
    // Optimistic
    setStaff(prev => prev.map(m =>
      m._id === staffId ? { ...m, dayStatus: { ...m.dayStatus, bayNumber: bay } } : m
    ));

    try {
      await fetch(`${API}/api/staff?id=${staffId}`, {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ action: 'assign_bay', branch, date, bayNumber: bay }),
      });
    } catch {
      fetchStaff();
    }
  };

  // ── Chain job selection ──────────────────────────────────────────────────────
  const handleChainSelect = async (jobId: string) => {
    // First click: pick the first job
    if (!chainFirst) {
      setChainFirst(jobId);
      return;
    }
    // Second click on same job: deselect
    if (chainFirst === jobId) {
      setChainFirst(null);
      return;
    }
    // Second click on different job: create the chain
    const firstJob  = jobs.find(j => j._id === chainFirst);
    const secondJob = jobs.find(j => j._id === jobId);
    if (!firstJob || !secondJob) { setChainFirst(null); return; }

    // Optimistic — update both jobs in local state
    setJobs(prev => prev.map(j => {
      if (j._id === chainFirst) return { ...j, chainedToJob: jobId };
      if (j._id === jobId)      return { ...j, chainedFromJob: chainFirst };
      return j;
    }));

    try {
      const res = await fetch(
        `${API}/api/jobs?resource=assign&id=${chainFirst}`,
        {
          method:  'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify({ action: 'chain_next', nextJobId: jobId }),
        }
      );
      if (!res.ok) throw new Error('Chain failed');
    } catch {
      fetchJobs(); // revert on failure
    } finally {
      setChainFirst(null);
      setChainMode(false);
    }
  };

  const handleUnchain = async (jobId: string) => {
    const job = jobs.find(j => j._id === jobId);
    if (!job) return;

    // Optimistic
    setJobs(prev => prev.map(j => {
      if (j._id === jobId)                return { ...j, chainedToJob: null };
      if (j._id === job.chainedFromJob)   return { ...j, chainedToJob: null };
      return j;
    }));

    try {
      // Remove chainedToJob from this job + chainedFromJob from the next
      await fetch(`${API}/api/jobs?resource=assign&id=${jobId}`, {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ action: 'set_status', status: job.status }), // no-op to trigger refresh
      });
      // Direct MongoDB update via a dedicated unchain call
      await fetch(`${API}/api/jobs?resource=assign&id=${jobId}`, {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ action: 'unchain' }),
      });
    } catch {
      fetchJobs();
    }
  };

  // ── Derived ──────────────────────────────────────────────────────────────────
  const filtered = jobs.filter(j => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      j.service.toLowerCase().includes(q)      ||
      j.vehiclePlate.toLowerCase().includes(q) ||
      j.customerName.toLowerCase().includes(q) ||
      (j.bookingRef || '').toLowerCase().includes(q)
    );
  });

  const selectedJob = jobs.find(j => j._id === selectedJobId) ?? null;
  const unassigned = filtered.filter(j => j.status === 'unassigned');
  const assigned   = filtered.filter(j => j.status === 'assigned');
  const inProgress = filtered.filter(j => j.status === 'in_progress');
  const paused     = filtered.filter(j => j.status === 'paused');
  const done       = filtered.filter(j => j.status === 'done');

  const bayCount = BRANCH_BAYS[branch] ?? 2;
  const loading  = loadingJobs || loadingStaff;

  // ── Render ───────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">

      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold text-white mb-1">Job Management</h2>
          <p className="text-neutral-400 text-sm">Today's service jobs by branch. Drag unassigned jobs onto a mechanic to assign.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select value={branch} onChange={e => setBranch(e.target.value)}
            className="px-3 py-2 bg-neutral-900 border border-neutral-700 rounded-lg text-white text-sm focus:outline-none focus:border-[#FFD700] transition-colors">
            {BRANCHES.map(b => <option key={b}>{b}</option>)}
          </select>
          <input type="date" value={date} onChange={e => setDate(e.target.value)}
            className="px-3 py-2 bg-neutral-900 border border-neutral-700 rounded-lg text-white text-sm focus:outline-none focus:border-[#FFD700] transition-colors" />
          <button onClick={fetchAll} disabled={loading}
            className="p-2 bg-neutral-900 border border-neutral-700 rounded-lg text-neutral-400 hover:text-white hover:border-neutral-600 transition-colors disabled:opacity-50">
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          {/* View tabs */}
          <div className="flex bg-neutral-800 rounded-lg p-1 border border-neutral-700">
            <button
              onClick={() => setView('board')}
              className={`px-3 py-1.5 rounded text-xs font-bold transition-colors ${
                view === 'board'
                  ? 'bg-neutral-700 text-white'
                  : 'text-neutral-500 hover:text-neutral-300'
              }`}
            >
              Board
            </button>
            <button
              onClick={() => setView('report')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-bold transition-colors ${
                view === 'report'
                  ? 'bg-neutral-700 text-white'
                  : 'text-neutral-500 hover:text-neutral-300'
              }`}
            >
              <BarChart2 className="w-3.5 h-3.5" /> Report
            </button>
          </div>

          {/* Chain Jobs toggle */}
          <button
            onClick={() => { setChainMode(m => !m); setChainFirst(null); }}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-colors border ${
              chainMode
                ? 'bg-purple-500/20 border-purple-500/50 text-purple-400 hover:bg-purple-500/30'
                : 'bg-neutral-900 border-neutral-700 text-neutral-300 hover:bg-neutral-800 hover:text-white'
            }`}
          >
            <Link2 className="w-4 h-4" />
            {chainMode
              ? chainFirst ? 'Select 2nd job…' : 'Select 1st job…'
              : 'Chain Jobs'}
          </button>

          <button onClick={() => setShowAddModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-[#FFD700] rounded-lg text-black text-sm font-bold hover:bg-[#FFD700]/90 transition-colors">
            <Plus className="w-4 h-4" /> Add Job
          </button>
        </div>
      </div>

      {/* ── Board / Report switch ───────────────────────────────────────── */}
      {view === 'board' ? (<>

      {/* ── Stats ──────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-5 gap-3">
        {[
          { label: 'Total',       value: jobs.length,                                          color: 'text-white' },
          { label: 'Unassigned',  value: jobs.filter(j => j.status === 'unassigned').length,   color: 'text-neutral-400' },
          { label: 'In Progress', value: jobs.filter(j => j.status === 'in_progress').length,  color: 'text-green-400' },
          { label: 'Paused',      value: jobs.filter(j => j.status === 'paused').length,       color: 'text-yellow-400' },
          { label: 'Done',        value: jobs.filter(j => j.status === 'done').length,         color: 'text-blue-400' },
        ].map(s => (
          <div key={s.label} className="bg-neutral-900 border border-neutral-800 rounded-xl p-4 text-center">
            <div className={`text-2xl font-bold ${s.color}`}>{s.value}</div>
            <div className="text-neutral-500 text-xs mt-0.5">{s.label}</div>
          </div>
        ))}
      </div>

      {/* ── Search ─────────────────────────────────────────────────────── */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-2.5 w-4 h-4 text-neutral-500" />
        <input value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Search service, plate, customer..."
          className="w-full pl-9 pr-3 py-2 bg-neutral-900 border border-neutral-700 rounded-lg text-white text-sm focus:outline-none focus:border-[#FFD700] placeholder:text-neutral-600 transition-colors" />
      </div>

      {/* ── Chain mode banner ─────────────────────────────────────────────── */}
      {chainMode && (
        <div className="flex items-center justify-between p-4 bg-purple-500/10 border border-purple-500/30 rounded-xl">
          <div className="flex items-center gap-3">
            <Link2 className="w-5 h-5 text-purple-400 flex-shrink-0" />
            <div>
              <p className="text-purple-300 font-bold text-sm">
                {chainFirst
                  ? '1st job selected — now click the job that should run after it'
                  : 'Click the 1st job (e.g. Tyre Change)'}
              </p>
              <p className="text-purple-500 text-xs mt-0.5">
                When the 1st job finishes, the 2nd activates automatically.
              </p>
            </div>
          </div>
          <button
            onClick={() => { setChainMode(false); setChainFirst(null); }}
            className="text-purple-500 hover:text-purple-300 transition-colors flex-shrink-0 ml-4"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      )}

      {/* ── Error ──────────────────────────────────────────────────────── */}
      {error && (
        <div className="flex items-center gap-2 p-4 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 text-sm">
          <AlertTriangle className="w-4 h-4 flex-shrink-0" />{error}
        </div>
      )}

      {/* ── Loading ────────────────────────────────────────────────────── */}
      {loading && (
        <div className="flex items-center justify-center py-16">
          <RefreshCw className="w-6 h-6 text-[#FFD700] animate-spin" />
        </div>
      )}

      {!loading && (
        <>
          {/* ══════════════════════════════════════════════════════════════
              SECTION 1: JOB QUEUE (4 columns)
          ══════════════════════════════════════════════════════════════ */}
          {jobs.length === 0 ? (
            <div className="py-16 text-center bg-neutral-900 border border-neutral-800 rounded-xl">
              <Package className="w-10 h-10 text-neutral-700 mx-auto mb-3" />
              <p className="text-neutral-400 font-medium">No jobs for {branch} on {date}</p>
              <p className="text-neutral-600 text-sm mt-1">Bookings from the website will appear here automatically.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">

              {/* Unassigned */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-bold text-neutral-400 uppercase tracking-wider">Unassigned</h3>
                  <span className="text-xs font-bold bg-neutral-800 text-neutral-400 px-2 py-0.5 rounded-full border border-neutral-700">{unassigned.length}</span>
                </div>
                <div className="space-y-3">
                  {unassigned.length === 0
                    ? <p className="text-neutral-600 text-sm text-center py-6 border border-dashed border-neutral-800 rounded-xl">All jobs assigned</p>
                    : unassigned.map(job => (
                      <JobCard key={job._id} job={job}
                        onDragStart={handleDragStart}
                        onSelect={id => { if (!chainMode) setSelectedJobId(id); }}
                        chainMode={chainMode}
                        isChainFirst={chainFirst === job._id}
                        onChainSelect={handleChainSelect}
                        onUnchain={handleUnchain}
                      />
                    ))
                  }
                </div>
              </div>

              {/* Assigned */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-bold text-blue-400 uppercase tracking-wider">Assigned</h3>
                  <span className="text-xs font-bold bg-blue-500/20 text-blue-400 px-2 py-0.5 rounded-full border border-blue-500/30">{assigned.length}</span>
                </div>
                <div className="space-y-3">
                  {assigned.length === 0
                    ? <p className="text-neutral-600 text-sm text-center py-6 border border-dashed border-neutral-800 rounded-xl">No assigned jobs</p>
                    : assigned.map(job => (
                      <JobCard key={job._id} job={job}
                        onDragStart={handleDragStart}
                        onSelect={id => { if (!chainMode) setSelectedJobId(id); }}
                        chainMode={chainMode}
                        isChainFirst={chainFirst === job._id}
                        onChainSelect={handleChainSelect}
                        onUnchain={handleUnchain}
                      />
                    ))
                  }
                </div>
              </div>

              {/* In Progress + Paused */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-bold text-green-400 uppercase tracking-wider">In Progress</h3>
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-bold bg-green-500/20 text-green-400 px-2 py-0.5 rounded-full border border-green-500/30">{inProgress.length}</span>
                    {paused.length > 0 && (
                      <span className="text-xs font-bold bg-yellow-500/20 text-yellow-400 px-2 py-0.5 rounded-full border border-yellow-500/30">{paused.length} paused</span>
                    )}
                  </div>
                </div>
                <div className="space-y-3">
                  {[...inProgress, ...paused].length === 0
                    ? <p className="text-neutral-600 text-sm text-center py-6 border border-dashed border-neutral-800 rounded-xl">No active jobs</p>
                    : [...inProgress, ...paused].map(job => (
                      <JobCard key={job._id} job={job}
                        onDragStart={handleDragStart}
                        onSelect={id => { if (!chainMode) setSelectedJobId(id); }}
                        chainMode={chainMode}
                        isChainFirst={chainFirst === job._id}
                        onChainSelect={handleChainSelect}
                        onUnchain={handleUnchain}
                      />
                    ))
                  }
                </div>
              </div>

              {/* Done */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-bold text-neutral-500 uppercase tracking-wider">Done</h3>
                  <span className="text-xs font-bold bg-neutral-800 text-neutral-500 px-2 py-0.5 rounded-full border border-neutral-700">{done.length}</span>
                </div>
                <div className="space-y-3">
                  {done.length === 0
                    ? <p className="text-neutral-600 text-sm text-center py-6 border border-dashed border-neutral-800 rounded-xl">No completed jobs</p>
                    : done.map(job => (
                      <JobCard key={job._id} job={job}
                        onDragStart={handleDragStart}
                        onSelect={id => { if (!chainMode) setSelectedJobId(id); }}
                        chainMode={chainMode}
                        isChainFirst={chainFirst === job._id}
                        onChainSelect={handleChainSelect}
                        onUnchain={handleUnchain}
                      />
                    ))
                  }
                </div>
              </div>

            </div>
          )}

          {/* ══════════════════════════════════════════════════════════════
              SECTION 2: STAFF TILES
          ══════════════════════════════════════════════════════════════ */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-lg font-bold text-white">Staff — {branch}</h3>
                <p className="text-neutral-500 text-xs mt-0.5">
                  Drag an unassigned job card onto a mechanic to assign it.
                  Use the bay buttons to allocate a workspace.
                </p>
              </div>
              <div className="flex items-center gap-3 text-xs">
                {Object.entries(STAFF_STATUS_CONFIG).map(([key, cfg]) => (
                  <div key={key} className="flex items-center gap-1.5">
                    <span className={`w-2 h-2 rounded-full ${cfg.dot}`} />
                    <span className="text-neutral-500">{cfg.label}</span>
                  </div>
                ))}
              </div>
            </div>

            {loadingStaff ? (
              <div className="flex items-center justify-center py-10">
                <RefreshCw className="w-5 h-5 text-neutral-600 animate-spin" />
              </div>
            ) : staff.length === 0 ? (
              <div className="py-12 text-center bg-neutral-900 border border-neutral-800 rounded-xl">
                <User className="w-8 h-8 text-neutral-700 mx-auto mb-3" />
                <p className="text-neutral-400 font-medium">No staff found for {branch}</p>
                <p className="text-neutral-600 text-sm mt-1">Add staff members in the Staff Directory page first.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {staff.map(member => (
                  <StaffTile
                    key={member._id}
                    member={member}
                    jobs={jobs}
                    branch={branch}
                    date={date}
                    bayCount={bayCount}
                    onDrop={handleDrop}
                    onStatusChange={handleStatusChange}
                    onBayChange={handleBayChange}
                  />
                ))}
              </div>
            )}
          </div>
        </>
      )}

      </>) : (
        <ReportView branch={branch} date={date} />
      )}

      {/* ── Add Job Modal ───────────────────────────────────────────────── */}
      {showAddModal && (
        <AddJobModal
          branch={branch} date={date}
          onClose={() => setShowAddModal(false)}
          onSaved={fetchAll}
        />
      )}

      {/* ── Timer Panel ─────────────────────────────────────────────────── */}
      {selectedJob && (
        <TimerPanel
          job={selectedJob}
          onClose={() => setSelectedJobId(null)}
          onRefresh={() => { fetchJobs(); }}
        />
      )}
    </div>
  );
}