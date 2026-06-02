// bookings.panels.tsx — feature panels: Timeline, Analytics, CustomerHistory,
// Kanban, CommandPalette, ShortcutsPanel, AdvancedSearch, MorningBriefing,
// LateAlertBanner, ExportDropdown

import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  X, Clock, MapPin, User, Car, Search, Plus, Download, Columns,
  BarChart2, History, ChevronDown, Star, MessageSquare, Copy, Wrench,
  TrendingUp, Command, Hash, Filter, Sun, Activity, BellRing, XCircle,
  PhoneCall, RefreshCw, CheckCircle,
} from 'lucide-react';
import {
  BRANCHES, SERVICE_CATEGORIES, SERVICES, TIME_SLOTS, KANBAN_COLUMNS,
  TAG_STYLE, TAG_LABEL, SOURCE_LABELS, resolveBranchName, exportToCSV,
  type Booking, type BookingStatus, type LateAlert, type AdvancedFilters, type CustomerNote,
} from './bookings.types';
import { statusBadge } from './bookings.ui';
import { useCustomerNotes } from './bookings.hooks';
import { getSessionUser } from '../../lib/auth';

// ══════════════════════════════════════════════════════════════════════════════
// MORNING BRIEFING
// ══════════════════════════════════════════════════════════════════════════════
export function MorningBriefing({ bookings, onDismiss }: { bookings: Booking[]; onDismiss: () => void }) {
  const today    = new Date().toISOString().split('T')[0];
  const todayBks = bookings.filter(b => b.date === today);
  const hour     = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  const su       = getSessionUser();
  const next     = todayBks
    .filter(b => b.status === 'Pending' && b.timeSlot)
    .sort((a, b) => a.timeSlot! > b.timeSlot! ? 1 : -1)[0];

  const summaries = [
    { l: "Today's bookings", v: todayBks.length,                                              c: 'text-white' },
    { l: 'Pending',          v: todayBks.filter(b => b.status === 'Pending').length,          c: 'text-yellow-400' },
    { l: 'In Progress',      v: todayBks.filter(b => b.status === 'In Progress').length,      c: 'text-blue-400' },
    { l: 'Completed',        v: todayBks.filter(b => b.status === 'Completed').length,        c: 'text-green-400' },
  ];

  return (
    <div className="relative bg-gradient-to-r from-[#FFD700]/10 via-neutral-900 to-neutral-900 border border-[#FFD700]/30 rounded-xl p-4 md:p-5 overflow-hidden">
      <div className="absolute top-0 right-0 w-32 h-32 bg-[#FFD700]/5 rounded-full -translate-y-1/2 translate-x-1/2 pointer-events-none" />
      <button onClick={onDismiss} className="absolute top-3 right-3 p-1 text-neutral-600 hover:text-white rounded-lg transition-colors"><X className="w-4 h-4" /></button>
      <div className="flex items-start gap-3">
        <Sun className="w-6 h-6 text-[#FFD700] flex-shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0">
          <div className="text-base font-bold text-white">{greeting}{su?.branch ? `, ${su.branch}` : ''}!</div>
          <div className="text-xs text-neutral-400 mt-0.5">{new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}</div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mt-3">
            {summaries.map(s => (
              <div key={s.l} className="bg-neutral-800/60 rounded-lg px-3 py-2">
                <div className={`text-xl font-bold ${s.c}`}>{s.v}</div>
                <div className="text-[11px] text-neutral-500">{s.l}</div>
              </div>
            ))}
          </div>
          {next && (
            <div className="mt-3 flex items-center gap-2 text-xs text-neutral-400">
              <Clock className="w-3.5 h-3.5 text-[#FFD700]" />
              Next pending: <span className="text-white font-medium">{next.customer}</span>
              <span className="font-mono text-[#FFD700]">{next.timeSlot}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// LATE ALERT BANNER
// ══════════════════════════════════════════════════════════════════════════════
export function LateAlertBanner({
  alert, onDismiss, onMarkArrived,
}: {
  alert: LateAlert; onDismiss: () => void; onMarkArrived: () => void;
}) {
  const is30 = alert.level === 30;
  return (
    <div className={`relative flex flex-col sm:flex-row sm:items-center gap-3 px-4 py-3 rounded-xl border text-sm ${is30 ? 'bg-red-500/10 border-red-500/40 text-red-300' : 'bg-orange-500/10 border-orange-500/40 text-orange-300'}`}>
      <span className="relative flex-shrink-0 hidden sm:flex h-3 w-3 mt-0.5">
        <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${is30 ? 'bg-red-400' : 'bg-orange-400'}`} />
        <span className={`relative inline-flex rounded-full h-3 w-3 ${is30 ? 'bg-red-500' : 'bg-orange-500'}`} />
      </span>
      {is30 ? <XCircle className="w-4 h-4 flex-shrink-0 text-red-400" /> : <BellRing className="w-4 h-4 flex-shrink-0 text-orange-400 animate-bounce" />}
      <div className="flex-1 min-w-0">
        <div className="font-medium">
          <span className="font-bold">{is30 ? '🚫 Auto-cancelled' : '⏰ Late customer'}</span>
          <span className="text-neutral-500 mx-1">·</span>
          <span className="font-semibold">{alert.customer}</span>
          <span className="text-neutral-400"> — {alert.service}</span>
        </div>
        <div className="text-xs text-neutral-400 mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5">
          <span className="font-mono">{alert.timeSlot}</span>
          <span className="text-neutral-600">·</span>
          <span>{alert.branch}</span>
          {alert.phone && <>
            <span className="text-neutral-600">·</span>
            <span className="inline-flex items-center gap-1"><PhoneCall className="w-3 h-3" />{alert.phone}</span>
          </>}
        </div>
        <div className={`text-xs mt-1 ${alert.smsSent ? 'text-green-500/70' : 'text-red-400/70'}`}>
          {is30
            ? alert.smsSent ? '✓ Auto-cancelled · SMS sent.' : '✗ SMS failed — contact manually.'
            : alert.smsSent ? '✓ SMS sent — customer notified.' : '✗ SMS failed — contact manually.'}
        </div>
      </div>
      <div className="flex items-center gap-2 flex-shrink-0">
        {!is30 && (
          <button onClick={onMarkArrived}
            className="px-3 py-1.5 bg-green-500/20 border border-green-500/30 text-green-400 rounded-lg text-xs font-medium hover:bg-green-500/30 transition-colors whitespace-nowrap">
            Mark Arrived
          </button>
        )}
        <button onClick={onDismiss} className="p-1.5 text-neutral-500 hover:text-white hover:bg-neutral-700 rounded-lg transition-colors"><X className="w-4 h-4" /></button>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// TODAY'S TIMELINE / SLOT HEATMAP
// ══════════════════════════════════════════════════════════════════════════════
export function TodayTimeline({ bookings, onClose }: { bookings: Booking[]; onClose: () => void }) {
  const todayStr     = new Date().toISOString().split('T')[0];
  const todayBookings = bookings.filter(b => b.date === todayStr);

  const slotMap = useMemo(() => {
    const m = new Map<string, Booking[]>();
    TIME_SLOTS.forEach(s => m.set(s, []));
    todayBookings.forEach(b => { if (b.timeSlot && m.has(b.timeSlot)) m.get(b.timeSlot)!.push(b); });
    return m;
  }, [todayBookings]);

  const maxCount   = useMemo(() => Math.max(...Array.from(slotMap.values()).map(v => v.length), 1), [slotMap]);
  const now        = new Date();
  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  const [hoveredSlot, setHoveredSlot] = useState<string | null>(null);

  const SC: Record<BookingStatus, string> = {
    'Pending':'bg-yellow-500','In Progress':'bg-blue-500','Completed':'bg-green-500','Cancelled':'bg-red-500','Waiting':'bg-orange-500',
  };

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4 backdrop-blur-sm overflow-y-auto">
      <div className="bg-neutral-900 rounded-xl border border-neutral-700 w-full max-w-4xl my-8 shadow-2xl">
        <div className="sticky top-0 bg-neutral-900 border-b border-neutral-700 px-6 py-4 flex justify-between items-center rounded-t-xl z-10">
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <BarChart2 className="w-5 h-5 text-[#FFD700]" /> Today's Timeline
            <span className="text-sm font-normal text-neutral-400 ml-1">— {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}</span>
          </h2>
          <button onClick={onClose} className="text-neutral-400 hover:text-white p-1 rounded-lg hover:bg-neutral-800"><X className="w-5 h-5" /></button>
        </div>
        <div className="p-6 space-y-6">
          {/* Status pills */}
          <div className="flex flex-wrap gap-3">
            {(Object.keys(SC) as BookingStatus[]).map(s => {
              const count = todayBookings.filter(b => b.status === s).length;
              return <div key={s} className="flex items-center gap-2 px-3 py-1.5 bg-neutral-800 border border-neutral-700 rounded-full"><span className={`w-2 h-2 rounded-full ${SC[s]}`} /><span className="text-xs text-neutral-300">{s}</span><span className="text-xs font-bold text-white">{count}</span></div>;
            })}
            <div className="flex items-center gap-2 px-3 py-1.5 bg-[#FFD700]/10 border border-[#FFD700]/30 rounded-full ml-auto"><span className="text-xs text-[#FFD700] font-medium">Total:</span><span className="text-xs font-bold text-[#FFD700]">{todayBookings.length}</span></div>
          </div>

          {/* Heatmap */}
          <div className="bg-neutral-800/50 border border-neutral-700 rounded-xl p-4 overflow-x-auto">
            <div className="min-w-[600px] space-y-1.5">
              {TIME_SLOTS.map(slot => {
                const entries = slotMap.get(slot) || [];
                const count   = entries.length;
                const [h, m]  = slot.split(':').map(Number);
                const slotMin = h * 60 + m;
                const isPast  = slotMin < nowMinutes;
                const isCur   = slotMin <= nowMinutes && slotMin + 30 > nowMinutes;
                const heat    = count === 0 ? 'bg-neutral-700/30' : count >= 3 ? 'bg-red-500/70' : count === 2 ? 'bg-orange-500/70' : 'bg-green-500/70';
                return (
                  <div key={slot} className="flex items-center gap-2 cursor-pointer"
                    onMouseEnter={() => setHoveredSlot(slot)} onMouseLeave={() => setHoveredSlot(null)}>
                    <div className={`w-14 flex-shrink-0 text-right text-[11px] font-mono ${isCur ? 'text-[#FFD700] font-bold' : isPast ? 'text-neutral-600' : 'text-neutral-400'}`}>
                      {slot}{isCur && <span className="ml-1">▶</span>}
                    </div>
                    <div className="flex-1 relative h-6 bg-neutral-800 rounded-md overflow-hidden border border-neutral-700/50">
                      <div className={`h-full transition-all ${heat}`} style={{ width: count > 0 ? `${Math.max((count/maxCount)*100,8)}%` : '0%' }} />
                      {isCur && <div className="absolute top-0 bottom-0 w-0.5 bg-[#FFD700] opacity-80" style={{ left: `${((nowMinutes-slotMin)/30)*100}%` }} />}
                      {count > 0 && <div className="absolute inset-0 flex items-center px-2 gap-1">{entries.slice(0,6).map((b,i)=><span key={i} className={`w-2 h-2 rounded-full flex-shrink-0 ${SC[b.status]}`} title={b.customer}/>)}{entries.length>6&&<span className="text-[10px] text-white/60">+{entries.length-6}</span>}</div>}
                    </div>
                    <div className={`w-6 flex-shrink-0 text-center text-[11px] font-bold ${count>0?'text-white':'text-neutral-700'}`}>{count||'—'}</div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Hover detail */}
          {hoveredSlot && (slotMap.get(hoveredSlot)||[]).length > 0 && (
            <div className="bg-neutral-800 border border-neutral-700 rounded-xl p-4">
              <h4 className="text-sm font-bold text-white mb-3 flex items-center gap-2"><Clock className="w-4 h-4 text-[#FFD700]"/>{hoveredSlot}</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {(slotMap.get(hoveredSlot)||[]).map(b => (
                  <div key={b.id} className="flex items-center gap-3 px-3 py-2 bg-neutral-900 rounded-lg border border-neutral-700">
                    <span className={`w-2 h-2 rounded-full flex-shrink-0 ${SC[b.status]}`}/>
                    <div className="flex-1 min-w-0"><div className="text-sm font-medium text-white truncate">{b.customer}</div><div className="text-xs text-neutral-500 truncate">{b.service}{b.bay&&` · ${b.bay}`}</div></div>
                    {statusBadge(b.status)}
                  </div>
                ))}
              </div>
            </div>
          )}
          {/* Legend */}
          <div className="flex items-center gap-4 text-[11px] text-neutral-500">
            <span>Occupancy:</span>
            {[['bg-green-500/70','1 booking'],['bg-orange-500/70','2 bookings'],['bg-red-500/70','3+ (full)']].map(([cls,lbl])=>(
              <div key={lbl} className="flex items-center gap-1.5"><span className={`w-3 h-3 rounded-sm ${cls}`}/><span className="text-neutral-400">{lbl}</span></div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// ANALYTICS DASHBOARD
// ══════════════════════════════════════════════════════════════════════════════
export function AnalyticsDashboard({ bookings, onClose }: { bookings: Booking[]; onClose: () => void }) {
  const today     = new Date().toISOString().split('T')[0];
  const thisMonth = today.slice(0, 7);

  const stats = useMemo(() => {
    const todayBks     = bookings.filter(b => b.date === today);
    const monthBks     = bookings.filter(b => b.date.startsWith(thisMonth));
    const completedAll = bookings.filter(b => b.status === 'Completed');
    const cancelledAll = bookings.filter(b => b.status === 'Cancelled');

    const byBranch = BRANCHES.map(br => ({
      name:  br.shortName,
      count: bookings.filter(b => resolveBranchName(b.branch) === br.shortName).length,
      today: bookings.filter(b => resolveBranchName(b.branch) === br.shortName && b.date === today).length,
    }));

    const svcMap = new Map<string, number>();
    bookings.forEach(b => b.service.split(', ').forEach(s => svcMap.set(s, (svcMap.get(s)||0)+1)));
    const topServices = [...svcMap.entries()].sort((a,b)=>b[1]-a[1]).slice(0,5);

    const srcMap = new Map<string, number>();
    bookings.forEach(b => { const s = b.source||'website'; srcMap.set(s,(srcMap.get(s)||0)+1); });

    return { todayBks, monthBks, completedAll, cancelledAll, byBranch, topServices, srcMap };
  }, [bookings]);

  const cancelRate     = bookings.length ? Math.round((stats.cancelledAll.length/bookings.length)*100) : 0;
  const completionRate = bookings.length ? Math.round((stats.completedAll.length/bookings.length)*100) : 0;
  const maxBranch      = Math.max(...stats.byBranch.map(b=>b.count), 1);
  const maxSvc         = stats.topServices[0]?.[1] || 1;

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4 backdrop-blur-sm overflow-y-auto">
      <div className="bg-neutral-900 rounded-xl border border-neutral-700 w-full max-w-5xl my-8 shadow-2xl">
        <div className="sticky top-0 bg-neutral-900 border-b border-neutral-700 px-6 py-4 flex justify-between items-center rounded-t-xl z-10">
          <h2 className="text-xl font-bold text-white flex items-center gap-2"><TrendingUp className="w-5 h-5 text-[#FFD700]"/>Analytics</h2>
          <button onClick={onClose} className="text-neutral-400 hover:text-white p-1 rounded-lg hover:bg-neutral-800"><X className="w-5 h-5"/></button>
        </div>
        <div className="p-6 space-y-6">
          {/* KPIs */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label:'Total Bookings',   value: bookings.length,        sub:`${stats.todayBks.length} today`,         color:'text-white' },
              { label:'This Month',       value: stats.monthBks.length,  sub: thisMonth,                               color:'text-blue-400' },
              { label:'Completion Rate',  value:`${completionRate}%`,    sub:`${stats.completedAll.length} completed`,  color:'text-green-400' },
              { label:'Cancellation Rate',value:`${cancelRate}%`,        sub:`${stats.cancelledAll.length} cancelled`,  color: cancelRate>20?'text-red-400':'text-orange-400' },
            ].map(k=>(
              <div key={k.label} className="bg-neutral-800 border border-neutral-700 rounded-xl p-4">
                <div className={`text-2xl font-bold ${k.color}`}>{k.value}</div>
                <div className="text-sm text-neutral-400 mt-0.5">{k.label}</div>
                <div className="text-xs text-neutral-600 mt-0.5">{k.sub}</div>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* By branch */}
            <div className="bg-neutral-800 border border-neutral-700 rounded-xl p-4">
              <h3 className="text-sm font-bold text-white mb-4 flex items-center gap-2"><MapPin className="w-4 h-4 text-[#FFD700]"/>By Branch</h3>
              <div className="space-y-3">{stats.byBranch.map(br=>(
                <div key={br.name}>
                  <div className="flex justify-between text-xs mb-1"><span className="text-neutral-300">{br.name}</span><span className="text-neutral-400">{br.count} · <span className="text-[#FFD700]">{br.today} today</span></span></div>
                  <div className="h-2 bg-neutral-700 rounded-full overflow-hidden"><div className="h-full bg-[#FFD700] rounded-full transition-all duration-500" style={{width:`${(br.count/maxBranch)*100}%`}}/></div>
                </div>
              ))}</div>
            </div>

            {/* Top services */}
            <div className="bg-neutral-800 border border-neutral-700 rounded-xl p-4">
              <h3 className="text-sm font-bold text-white mb-4 flex items-center gap-2"><Wrench className="w-4 h-4 text-[#FFD700]"/>Top Services</h3>
              <div className="space-y-3">{stats.topServices.map(([svc,count])=>(
                <div key={svc}>
                  <div className="flex justify-between text-xs mb-1"><span className="text-neutral-300 truncate pr-2">{svc}</span><span className="text-neutral-400 flex-shrink-0">{count}</span></div>
                  <div className="h-2 bg-neutral-700 rounded-full overflow-hidden"><div className="h-full bg-blue-500 rounded-full" style={{width:`${(count/maxSvc)*100}%`}}/></div>
                </div>
              ))}</div>
            </div>

            {/* Status breakdown */}
            <div className="bg-neutral-800 border border-neutral-700 rounded-xl p-4">
              <h3 className="text-sm font-bold text-white mb-4 flex items-center gap-2"><Hash className="w-4 h-4 text-[#FFD700]"/>Status Breakdown</h3>
              {(['Pending','In Progress','Waiting','Completed','Cancelled'] as BookingStatus[]).map(s=>{
                const count=bookings.filter(b=>b.status===s).length;
                const pct=bookings.length?Math.round((count/bookings.length)*100):0;
                const bar={'Pending':'bg-yellow-500','In Progress':'bg-blue-500','Waiting':'bg-orange-500','Completed':'bg-green-500','Cancelled':'bg-red-500'}[s];
                return <div key={s} className="mb-3"><div className="flex justify-between text-xs mb-1"><span className="text-neutral-300">{s}</span><span className="text-neutral-400">{count} ({pct}%)</span></div><div className="h-2 bg-neutral-700 rounded-full overflow-hidden"><div className={`h-full ${bar} rounded-full`} style={{width:`${pct}%`}}/></div></div>;
              })}
            </div>

            {/* Source breakdown */}
            <div className="bg-neutral-800 border border-neutral-700 rounded-xl p-4">
              <h3 className="text-sm font-bold text-white mb-4 flex items-center gap-2"><Activity className="w-4 h-4 text-[#FFD700]"/>Booking Source</h3>
              <div className="flex flex-wrap gap-3">{[...stats.srcMap.entries()].map(([src,count])=>{
                const pct=Math.round((count/bookings.length)*100);
                const cls:Record<string,string>={manual:'text-blue-400 bg-blue-500/10 border-blue-500/30',website:'text-green-400 bg-green-500/10 border-green-500/30',walkin:'text-orange-400 bg-orange-500/10 border-orange-500/30'};
                return <div key={src} className={`flex flex-col items-center px-4 py-3 rounded-xl border ${cls[src]||'text-neutral-400 bg-neutral-700 border-neutral-600'}`}><span className="text-2xl font-bold">{pct}%</span><span className="text-xs capitalize mt-0.5">{SOURCE_LABELS[src]||src}</span><span className="text-[11px] opacity-60">{count}</span></div>;
              })}</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// CUSTOMER HISTORY PANEL
// ══════════════════════════════════════════════════════════════════════════════
export function CustomerHistoryPanel({
  booking, allBookings, onClose, notes, onSaveNote,
}: {
  booking:     Booking;
  allBookings: Booking[];
  onClose:     () => void;
  notes:       ReturnType<typeof useCustomerNotes>;
  onSaveNote:  (phone: string, text: string, tag?: CustomerNote['tag']) => void;
}) {
  const history = useMemo(() => allBookings.filter(b => {
    if (b.id === booking.id) return false;
    if (booking.phone && b.phone && b.phone.replace(/\s/g,'') === booking.phone.replace(/\s/g,'')) return true;
    if (booking.vehicle && booking.vehicle !== 'N/A' && b.vehicle && b.vehicle !== 'N/A' &&
        b.vehicle.replace(/\s/g,'').toUpperCase() === booking.vehicle.replace(/\s/g,'').toUpperCase()) return true;
    return false;
  }).sort((a,b) => new Date(b.date).getTime()-new Date(a.date).getTime()), [booking, allBookings]);

  const existing = notes.getNote(booking.phone || '');
  const [noteText, setNoteText] = useState(existing?.text || '');
  const [noteTag,  setNoteTag]  = useState<CustomerNote['tag']>(existing?.tag);
  const [saved,    setSaved]    = useState(false);

  const saveNote = () => {
    if (booking.phone) {
      onSaveNote(booking.phone, noteText, noteTag);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    }
  };

  const stats = {
    total:     history.length,
    completed: history.filter(b => b.status === 'Completed').length,
    cancelled: history.filter(b => b.status === 'Cancelled').length,
    services:  [...new Set(history.flatMap(b => b.service.split(', ')))],
  };

  return (
    <div className="fixed inset-0 bg-black/70 flex items-end md:items-center justify-center z-50 p-4 backdrop-blur-sm">
      <div className="bg-neutral-900 rounded-xl border border-neutral-700 w-full max-w-lg shadow-2xl max-h-[85vh] flex flex-col">
        <div className="border-b border-neutral-700 px-6 py-4 flex justify-between items-center flex-shrink-0">
          <h2 className="text-lg font-bold text-white flex items-center gap-2"><History className="w-5 h-5 text-[#FFD700]"/>Customer History</h2>
          <button onClick={onClose} className="text-neutral-400 hover:text-white p-1 rounded-lg hover:bg-neutral-800"><X className="w-5 h-5"/></button>
        </div>
        <div className="overflow-y-auto flex-1 p-6 space-y-5">
          {/* Customer card */}
          <div className="flex items-start gap-3 p-4 bg-neutral-800 border border-neutral-700 rounded-xl">
            <div className="w-10 h-10 rounded-full bg-[#FFD700]/20 border border-[#FFD700]/30 flex items-center justify-center flex-shrink-0"><User className="w-5 h-5 text-[#FFD700]"/></div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-bold text-white">{booking.customer}</span>
                {existing?.tag && <span className={`px-2 py-0.5 rounded-full border text-[11px] font-medium ${TAG_STYLE[existing.tag]}`}>{TAG_LABEL[existing.tag]}</span>}
              </div>
              {booking.phone && <div className="text-sm text-neutral-400 flex items-center gap-1 mt-0.5"><PhoneCall className="w-3 h-3"/>{booking.phone}</div>}
              {booking.vehicle && booking.vehicle !== 'N/A' && <div className="text-sm text-neutral-400 flex items-center gap-1 mt-0.5"><Car className="w-3 h-3"/><span className="font-mono">{booking.vehicle}</span></div>}
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-3 gap-3">
            {[{v:stats.total,l:'Past visits',c:'text-white'},{v:stats.completed,l:'Completed',c:'text-green-400'},{v:stats.cancelled,l:'Cancelled',c:'text-red-400'}].map(s=>(
              <div key={s.l} className="bg-neutral-800 border border-neutral-700 rounded-xl p-3 text-center"><div className={`text-2xl font-bold ${s.c}`}>{s.v}</div><div className="text-xs text-neutral-500 mt-0.5">{s.l}</div></div>
            ))}
          </div>

          {/* Staff notes */}
          {booking.phone && (
            <div className="bg-neutral-800 border border-neutral-700 rounded-xl p-4">
              <h4 className="text-sm font-bold text-white mb-3 flex items-center gap-2"><MessageSquare className="w-4 h-4 text-[#FFD700]"/>Staff Notes</h4>
              <div className="flex gap-2 mb-3">
                {(['vip','regular','flagged'] as CustomerNote['tag'][]).map(tag => (
                  <button key={tag} onClick={() => setNoteTag(noteTag === tag ? undefined : tag)}
                    className={`px-2.5 py-1 rounded-full border text-[11px] font-medium transition-colors ${noteTag === tag ? TAG_STYLE[tag!] : 'bg-neutral-700 border-neutral-600 text-neutral-400'}`}>
                    {TAG_LABEL[tag!]}
                  </button>
                ))}
              </div>
              <textarea value={noteText} onChange={e => setNoteText(e.target.value)} rows={3} placeholder="Add a note…"
                className="w-full px-3 py-2 bg-neutral-900 border border-neutral-700 rounded-lg text-white text-sm focus:outline-none focus:border-[#FFD700] resize-none placeholder:text-neutral-600"/>
              <button onClick={saveNote}
                className={`mt-2 px-4 py-2 rounded-lg text-xs font-medium transition-colors ${saved ? 'bg-green-500/20 text-green-400 border border-green-500/30' : 'bg-[#FFD700]/20 text-[#FFD700] border border-[#FFD700]/30 hover:bg-[#FFD700]/30'}`}>
                {saved ? '✓ Saved' : 'Save note'}
              </button>
            </div>
          )}

          {/* Services used */}
          {stats.services.length > 0 && (
            <div>
              <div className="text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-2">Services used</div>
              <div className="flex flex-wrap gap-1.5">{stats.services.slice(0,8).map(s=><span key={s} className="px-2.5 py-1 bg-neutral-800 border border-neutral-700 rounded-full text-xs text-neutral-300">{s}</span>)}</div>
            </div>
          )}

          {/* History list */}
          <div>
            <div className="text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-3">{history.length ? `${history.length} previous booking(s)` : 'No previous bookings'}</div>
            {history.length === 0
              ? <div className="text-center py-6 text-neutral-600 text-sm">New customer</div>
              : <div className="space-y-2">{history.map(b=>(
                  <div key={b.id} className="flex items-center gap-3 p-3 bg-neutral-800 border border-neutral-700 rounded-xl">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5"><span className="text-xs font-mono text-neutral-500">{b.date}</span>{b.timeSlot&&<span className="text-xs text-neutral-600">{b.timeSlot}</span>}{b.branch&&<span className="text-xs text-neutral-600">· {resolveBranchName(b.branch)}</span>}</div>
                      <div className="text-sm text-neutral-300 truncate">{b.service}</div>
                    </div>
                    {statusBadge(b.status)}
                  </div>
                ))}</div>
            }
          </div>
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// KANBAN VIEW (drag + mobile swipe)
// ══════════════════════════════════════════════════════════════════════════════
const KANBAN_COLORS: Record<BookingStatus, { header: string; dot: string; card: string }> = {
  'Pending':     { header:'border-yellow-500/40 text-yellow-400', dot:'bg-yellow-500', card:'hover:border-yellow-500/40' },
  'Waiting':     { header:'border-orange-500/40 text-orange-400', dot:'bg-orange-500', card:'hover:border-orange-500/40' },
  'In Progress': { header:'border-blue-500/40 text-blue-400',     dot:'bg-blue-500',   card:'hover:border-blue-500/40' },
  'Completed':   { header:'border-green-500/40 text-green-400',   dot:'bg-green-500',  card:'hover:border-green-500/40' },
  'Cancelled':   { header:'border-red-500/40 text-red-400',       dot:'bg-red-500',    card:'hover:border-red-500/40' },
};

export function KanbanView({
  bookings, onStatusChange, onBookingClick, customerNotes,
}: {
  bookings:       Booking[];
  onStatusChange: (id: string, status: BookingStatus) => Promise<void>;
  onBookingClick: (b: Booking) => void;
  customerNotes:  ReturnType<typeof useCustomerNotes>;
}) {
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [overColumn, setOverColumn] = useState<BookingStatus | null>(null);
  const [localBooks, setLocalBooks] = useState<Booking[]>(bookings);
  const [updating,   setUpdating]   = useState<string | null>(null);
  const touchStartX = useRef<number>(0);

  useEffect(() => { setLocalBooks(bookings); }, [bookings]);

  const grouped = useMemo(() => {
    const m = new Map<BookingStatus, Booking[]>();
    KANBAN_COLUMNS.forEach(s => m.set(s, []));
    localBooks.forEach(b => m.get(b.status)?.push(b));
    return m;
  }, [localBooks]);

  const moveCard = async (id: string, status: BookingStatus) => {
    const booking = localBooks.find(b => b.id === id);
    if (!booking || booking.status === status) return;
    setLocalBooks(prev => prev.map(b => b.id === id ? { ...b, status } : b));
    setUpdating(id);
    try { await onStatusChange(id, status); }
    catch { setLocalBooks(prev => prev.map(b => b.id === id ? { ...b, status: booking.status } : b)); }
    finally { setUpdating(null); }
  };

  return (
    <div className="overflow-x-auto pb-4">
      <div className="flex gap-4 min-w-[900px]">
        {KANBAN_COLUMNS.map(status => {
          const cols  = KANBAN_COLORS[status];
          const cards = grouped.get(status) || [];
          const isOver = overColumn === status;
          return (
            <div key={status}
              className={`flex-1 min-w-[180px] rounded-xl border transition-colors duration-150 ${isOver ? 'border-[#FFD700]/50 bg-[#FFD700]/5' : 'border-neutral-700 bg-neutral-900'}`}
              onDragOver={e => { e.preventDefault(); setOverColumn(status); }}
              onDrop={async e => { e.preventDefault(); setOverColumn(null); if (draggingId) await moveCard(draggingId, status); setDraggingId(null); }}
              onDragLeave={() => setOverColumn(null)}>
              <div className={`flex items-center justify-between px-3 py-3 border-b ${cols.header} border-neutral-700`}>
                <div className="flex items-center gap-2"><span className={`w-2 h-2 rounded-full ${cols.dot}`}/><span className="text-xs font-bold">{status}</span></div>
                <span className="text-xs font-bold bg-neutral-800 border border-neutral-700 rounded-full px-2 py-0.5 text-neutral-300">{cards.length}</span>
              </div>
              <div className="p-2 space-y-2 min-h-[120px]">
                {cards.map(b => {
                  const note = customerNotes.getNote(b.phone || '');
                  return (
                    <div key={b.id} draggable
                      onDragStart={e => { setDraggingId(b.id); e.dataTransfer.effectAllowed = 'move'; }}
                      onDragEnd={() => { setDraggingId(null); setOverColumn(null); }}
                      onTouchStart={e => { touchStartX.current = e.touches[0].clientX; }}
                      onTouchEnd={e => {
                        const dx = e.changedTouches[0].clientX - touchStartX.current;
                        if (Math.abs(dx) < 60) return;
                        const idx  = KANBAN_COLUMNS.indexOf(status);
                        const next = dx > 0 ? KANBAN_COLUMNS[idx+1] : KANBAN_COLUMNS[idx-1];
                        if (next) moveCard(b.id, next);
                      }}
                      onClick={() => onBookingClick(b)}
                      className={`p-3 bg-neutral-800 border border-neutral-700 rounded-lg cursor-grab active:cursor-grabbing transition-all ${cols.card} ${draggingId===b.id?'opacity-40 scale-95':'hover:bg-neutral-700/80'} ${updating===b.id?'opacity-60':''}`}>
                      {updating === b.id && <div className="flex items-center gap-1.5 mb-2 text-[#FFD700] text-[10px]"><RefreshCw className="w-3 h-3 animate-spin"/>Saving…</div>}
                      <div className="flex items-start justify-between gap-1 mb-1">
                        <div className="text-xs font-mono text-neutral-500 truncate flex-1">{b.id}</div>
                        {note?.tag === 'vip' && <Star className="w-3 h-3 text-yellow-400 flex-shrink-0"/>}
                      </div>
                      <div className="text-sm font-semibold text-white mb-1 truncate">{b.customer}</div>
                      <div className="text-xs text-neutral-400 truncate mb-2">{b.service}</div>
                      <div className="flex items-center justify-between flex-wrap gap-1">
                        {b.timeSlot && <span className="text-[11px] font-mono text-neutral-500 flex items-center gap-0.5"><Clock className="w-3 h-3"/>{b.timeSlot}</span>}
                        {b.bay && <span className="text-[11px] text-blue-400 flex items-center gap-0.5"><Wrench className="w-3 h-3"/>{b.bay}</span>}
                        {b.notes && <MessageSquare className="w-3 h-3 text-[#FFD700]"/>}
                      </div>
                      {b.branch && <div className="text-[11px] text-neutral-600 mt-1 flex items-center gap-0.5 truncate"><MapPin className="w-3 h-3 flex-shrink-0"/>{resolveBranchName(b.branch)}</div>}
                      <div className="mt-2 flex justify-between text-[10px] text-neutral-700 md:hidden">
                        {KANBAN_COLUMNS.indexOf(status) > 0 && <span>← back</span>}
                        {KANBAN_COLUMNS.indexOf(status) < KANBAN_COLUMNS.length - 1 && <span className="ml-auto">next →</span>}
                      </div>
                    </div>
                  );
                })}
                {!cards.length && (
                  <div className={`flex items-center justify-center h-16 rounded-lg border-2 border-dashed text-xs transition-colors ${isOver ? 'border-[#FFD700]/40 text-[#FFD700]/40' : 'border-neutral-800 text-neutral-700'}`}>
                    {isOver ? 'Drop here' : 'No bookings'}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
      <p className="text-xs text-neutral-600 mt-3 text-center">Drag cards between columns · Swipe left/right on mobile</p>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// COMMAND PALETTE
// ══════════════════════════════════════════════════════════════════════════════
export function CommandPalette({
  bookings, onClose, onBookingSelect, onAction,
}: {
  bookings:        Booking[];
  onClose:         () => void;
  onBookingSelect: (b: Booking) => void;
  onAction:        (action: string) => void;
}) {
  const [query, setQuery] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => { inputRef.current?.focus(); }, []);

  const ACTIONS = [
    { id:'new',      icon:<Plus className="w-4 h-4"/>,      label:'New Booking',    shortcut:'N' },
    { id:'timeline', icon:<BarChart2 className="w-4 h-4"/>, label:'Open Timeline',  shortcut:'T' },
    { id:'export',   icon:<Download className="w-4 h-4"/>,  label:'Export CSV',     shortcut:'⌘E' },
    { id:'refresh',  icon:<RefreshCw className="w-4 h-4"/>, label:'Refresh',        shortcut:'R' },
    { id:'kanban',   icon:<Columns className="w-4 h-4"/>,   label:'Toggle Kanban',  shortcut:'K' },
  ];

  const fa = ACTIONS.filter(a => !query || a.label.toLowerCase().includes(query.toLowerCase()));
  const fb = query.length >= 2
    ? bookings.filter(b =>
        b.customer.toLowerCase().includes(query.toLowerCase()) ||
        b.id.toLowerCase().includes(query.toLowerCase()) ||
        b.vehicle?.toLowerCase().includes(query.toLowerCase())
      ).slice(0, 6)
    : [];

  return (
    <div className="fixed inset-0 bg-black/60 flex items-start justify-center z-[80] pt-[15vh] p-4 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-neutral-900 border border-neutral-700 rounded-xl w-full max-w-xl shadow-2xl overflow-hidden" onClick={e => e.stopPropagation()}>
        <div className="flex items-center gap-3 px-4 py-3 border-b border-neutral-800">
          <Search className="w-4 h-4 text-neutral-500 flex-shrink-0"/>
          <input ref={inputRef} value={query} onChange={e => setQuery(e.target.value)}
            placeholder="Search bookings or type a command…"
            className="flex-1 bg-transparent text-white text-sm placeholder:text-neutral-600 outline-none"/>
          <kbd className="px-2 py-0.5 bg-neutral-800 border border-neutral-700 rounded text-[11px] font-mono text-neutral-500">Esc</kbd>
        </div>
        <div className="max-h-80 overflow-y-auto p-2">
          {fa.length > 0 && (
            <div className="mb-2">
              <div className="px-3 py-1 text-[11px] text-neutral-600 uppercase tracking-wider font-medium">Actions</div>
              {fa.map(a => (
                <button key={a.id} onClick={() => { onAction(a.id); onClose(); }}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-neutral-800 transition-colors text-left">
                  <span className="text-neutral-400">{a.icon}</span>
                  <span className="flex-1 text-sm text-white">{a.label}</span>
                  <kbd className="px-2 py-0.5 bg-neutral-800 border border-neutral-700 rounded text-[11px] font-mono text-neutral-500">{a.shortcut}</kbd>
                </button>
              ))}
            </div>
          )}
          {fb.length > 0 && (
            <div>
              <div className="px-3 py-1 text-[11px] text-neutral-600 uppercase tracking-wider font-medium">Bookings</div>
              {fb.map(b => (
                <button key={b.id} onClick={() => { onBookingSelect(b); onClose(); }}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-neutral-800 transition-colors text-left">
                  <User className="w-4 h-4 text-neutral-500 flex-shrink-0"/>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm text-white font-medium truncate">{b.customer}</div>
                    <div className="text-xs text-neutral-500 truncate">{b.service} · {b.date}</div>
                  </div>
                  {statusBadge(b.status)}
                </button>
              ))}
            </div>
          )}
          {!fa.length && !fb.length && <div className="py-8 text-center text-neutral-600 text-sm">No results for "{query}"</div>}
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// SHORTCUTS PANEL
// ══════════════════════════════════════════════════════════════════════════════
const SHORTCUTS = [
  { keys:['N'],       desc:'New booking' },
  { keys:['T'],       desc:'Open timeline' },
  { keys:['K'],       desc:'Toggle Kanban / Table' },
  { keys:['R'],       desc:'Refresh bookings' },
  { keys:['⌘','F'],  desc:'Focus search' },
  { keys:['⌘','K'],  desc:'Command palette' },
  { keys:['⌘','E'],  desc:'Export CSV' },
  { keys:['Esc'],     desc:'Close / clear selection' },
  { keys:['?'],       desc:'Show this panel' },
];

export function ShortcutsPanel({ onClose }: { onClose: () => void }) {
  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
      <div className="bg-neutral-900 border border-neutral-700 rounded-xl w-full max-w-sm shadow-2xl">
        <div className="border-b border-neutral-700 px-5 py-4 flex justify-between items-center">
          <h2 className="font-bold text-white flex items-center gap-2"><Command className="w-4 h-4 text-[#FFD700]"/>Keyboard Shortcuts</h2>
          <button onClick={onClose} className="text-neutral-400 hover:text-white p-1 rounded-lg hover:bg-neutral-800"><X className="w-4 h-4"/></button>
        </div>
        <div className="p-4 space-y-1.5">
          {SHORTCUTS.map((s, i) => (
            <div key={i} className="flex items-center justify-between py-1.5 px-2 rounded-lg hover:bg-neutral-800 transition-colors">
              <span className="text-sm text-neutral-300">{s.desc}</span>
              <div className="flex items-center gap-1">{s.keys.map((k,j)=><kbd key={j} className="px-2 py-0.5 bg-neutral-800 border border-neutral-600 rounded text-[11px] font-mono text-neutral-300">{k}</kbd>)}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// ADVANCED SEARCH PANEL
// ══════════════════════════════════════════════════════════════════════════════
export function AdvancedSearchPanel({
  filters, onChange, onClear, onClose,
}: {
  filters:  AdvancedFilters;
  onChange: (f: AdvancedFilters) => void;
  onClear:  () => void;
  onClose:  () => void;
}) {
  const set = (k: keyof AdvancedFilters, v: any) => onChange({ ...filters, [k]: v });
  const hasF = Object.entries(filters).some(([k,v]) => k !== 'hasNotes' ? !!v : v);

  return (
    <div className="bg-neutral-800/60 border border-neutral-700 rounded-xl p-4 space-y-4 animate-in slide-in-from-top-2 duration-200">
      <div className="flex items-center justify-between">
        <span className="text-sm font-bold text-white flex items-center gap-2"><Filter className="w-4 h-4 text-[#FFD700]"/>Advanced Filters</span>
        <div className="flex gap-2">
          {hasF && <button onClick={onClear} className="text-xs text-red-400 hover:underline">Clear all</button>}
          <button onClick={onClose} className="p-1 text-neutral-500 hover:text-white rounded"><X className="w-4 h-4"/></button>
        </div>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <div><label className="text-xs text-neutral-500 block mb-1">Date from</label><input type="date" value={filters.dateFrom} onChange={e=>set('dateFrom',e.target.value)} className="w-full px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-white text-xs focus:outline-none focus:border-[#FFD700]"/></div>
        <div><label className="text-xs text-neutral-500 block mb-1">Date to</label><input type="date" value={filters.dateTo} onChange={e=>set('dateTo',e.target.value)} className="w-full px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-white text-xs focus:outline-none focus:border-[#FFD700]"/></div>
        <div><label className="text-xs text-neutral-500 block mb-1">Category</label>
          <select value={filters.category} onChange={e=>set('category',e.target.value)} className="w-full px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-white text-xs focus:outline-none focus:border-[#FFD700]">
            <option value="">All categories</option>
            {SERVICE_CATEGORIES.map(c=><option key={c.id} value={c.id}>{c.label}</option>)}
          </select>
        </div>
        <div><label className="text-xs text-neutral-500 block mb-1">Vehicle plate</label><input value={filters.vehicle} onChange={e=>set('vehicle',e.target.value)} placeholder="e.g. WP CAA" className="w-full px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-white text-xs focus:outline-none focus:border-[#FFD700] font-mono"/></div>
        <div><label className="text-xs text-neutral-500 block mb-1">Source</label>
          <select value={filters.source} onChange={e=>set('source',e.target.value)} className="w-full px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-white text-xs focus:outline-none focus:border-[#FFD700]">
            <option value="">All sources</option>
            <option value="manual">Staff</option>
            <option value="website">Website</option>
            <option value="walkin">Walk-in</option>
            <option value="rebook">Rebook</option>
          </select>
        </div>
        <div className="flex items-end">
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={filters.hasNotes} onChange={e=>set('hasNotes',e.target.checked)} className="w-4 h-4 accent-[#FFD700]"/>
            <span className="text-xs text-neutral-300">Has notes only</span>
          </label>
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// EXPORT DROPDOWN
// ══════════════════════════════════════════════════════════════════════════════
export function ExportDropdown({ bookings, filtered }: { bookings: Booking[]; filtered: Booking[] }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  return (
    <div ref={ref} className="relative">
      <button onClick={() => setOpen(o => !o)}
        className="flex items-center gap-2 px-3 md:px-4 py-2 border border-neutral-700 rounded-lg text-neutral-300 text-sm font-medium hover:bg-neutral-800 hover:text-white transition-colors">
        <Download className="w-4 h-4"/>
        <span className="hidden sm:inline">Export</span>
        <ChevronDown className="w-3 h-3"/>
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-1 w-52 bg-neutral-900 border border-neutral-700 rounded-xl shadow-2xl z-30 overflow-hidden animate-in fade-in slide-in-from-top-1 duration-150">
          <div className="px-3 py-2 border-b border-neutral-800"><span className="text-[11px] text-neutral-500 uppercase tracking-wider font-medium">Export CSV</span></div>
          <button onClick={() => { exportToCSV(filtered,'bookings_filtered'); setOpen(false); }}
            className="w-full text-left px-3 py-2.5 text-sm text-neutral-300 hover:bg-neutral-800 hover:text-white transition-colors flex items-center gap-2">
            <Download className="w-4 h-4 text-[#FFD700]"/>Current view ({filtered.length})
          </button>
          <button onClick={() => { exportToCSV(bookings,'bookings_all'); setOpen(false); }}
            className="w-full text-left px-3 py-2.5 text-sm text-neutral-300 hover:bg-neutral-800 hover:text-white transition-colors flex items-center gap-2">
            <Download className="w-4 h-4 text-neutral-500"/>All bookings ({bookings.length})
          </button>
          <div className="px-3 py-2 border-t border-neutral-800"><p className="text-[10px] text-neutral-600">BOM-prefixed for Excel compatibility</p></div>
        </div>
      )}
    </div>
  );
}