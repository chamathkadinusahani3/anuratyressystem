// BookingsPage.tsx — main orchestrator
// Imports every feature from sibling files; this file is only state + wiring.

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  Plus, Search, RefreshCw, MapPin, Shield, List,
  Columns, BarChart2, TrendingUp, Printer, Calendar,
  Command, Zap, PlayCircle, CheckCircle, XCircle, Wrench, Copy,
  Star, AlertTriangle, MessageSquare, History,
} from 'lucide-react';

import { getSessionUser, canSeeAllBranches, bookingMatchesBranch, type UserRole } from '../lib/auth';

import {
  BRANCHES, SERVICES, STATUS_CONFIRM_CONFIG, TAG_STYLE,
  exportToCSV, resolveBranchName,
  type Booking, type BookingStatus, type AdvancedFilters, type ConfirmState,
} from '../components/booking/bookings.types';

import {
  useToasts, useAutoRefresh, useCustomerNotes,
  useLateAlerts, useBulkSelect, useKeyboardShortcuts,
} from '../components/booking/bookings.hooks';

import {
  statusBadge, CountdownTimer, ConfirmDialog,
  ToastContainer, OnlineBadge, BulkActionBar, RowCheckbox,
} from '../components/booking/bookings.ui';

import {
  ManualBookingModal, BookingDetailModal, BookingNotesModal,
  CalendarModal, PrintView,
} from '../components/booking/bookings.modals';

import {
  MorningBriefing, LateAlertBanner, TodayTimeline,
  AnalyticsDashboard, CustomerHistoryPanel, KanbanView,
  CommandPalette, ShortcutsPanel, AdvancedSearchPanel, ExportDropdown,
} from '../components/booking/bookings.panels';

const API_URL = (
  import.meta.env.VITE_API_URL ||
  'https://anuratyres-backend-emm1774.vercel.app/api'
).replace(/\/$/, '');

type ViewMode = 'table' | 'kanban';

// ─── Default advanced filters ─────────────────────────────────────────────────
const DEFAULT_ADV: AdvancedFilters = {
  dateFrom: '', dateTo: '', category: '', source: '', vehicle: '', hasNotes: false,
};

// ═══════════════════════════════════════════════════════════════════════════════
export function BookingsPage() {
  // ── Auth — read once on mount, stable via ref so callbacks don't re-create ──
  const sessionUser = getSessionUser();                          // plain object from localStorage
  const userRole    = (sessionUser?.role   ?? 'Cashier') as UserRole;
  const userBranch  = sessionUser?.branch  ?? '';
  const fullAccess  = canSeeAllBranches(userRole);

  // Stable refs so fetch callbacks don't need these in their dep arrays
  const roleRef   = useRef(sessionUser?.role   || 'Cashier');
  const branchRef = useRef(sessionUser?.branch || '');
  const fullRef   = useRef(fullAccess);

  // ── Core data ──────────────────────────────────────────────────────────────
  const [bookings, setBookings]         = useState<Booking[]>([]);
  const [loading,  setLoading]          = useState(true);
  const [error,    setError]            = useState<string | null>(null);

  // ── Filters ────────────────────────────────────────────────────────────────
  const [search,        setSearch]        = useState('');
  const [statusFilter,  setStatusFilter]  = useState<string>('all');
  const [dateFilter,    setDateFilter]    = useState<string>('');
  const [branchFilter,  setBranchFilter]  = useState<string>(fullAccess ? 'all' : userBranch);
  const [advFilters,    setAdvFilters]    = useState<AdvancedFilters>(DEFAULT_ADV);
  const [showAdvSearch, setShowAdvSearch] = useState(false);

  // ── UI mode ────────────────────────────────────────────────────────────────
  const [viewMode, setViewMode] = useState<ViewMode>('table');

  // ── Modal visibility ───────────────────────────────────────────────────────
  const [showNewBooking,  setShowNewBooking]  = useState(false);
  const [showCalendar,    setShowCalendar]    = useState(false);
  const [showPrint,       setShowPrint]       = useState(false);
  const [showTimeline,    setShowTimeline]    = useState(false);
  const [showAnalytics,   setShowAnalytics]   = useState(false);
  const [showShortcuts,   setShowShortcuts]   = useState(false);
  const [showPalette,     setShowPalette]     = useState(false);
  const [showBriefing,    setShowBriefing]    = useState(true);

  // ── Selected items for detail/history/notes/rebook ────────────────────────
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);
  const [historyBooking,  setHistoryBooking]  = useState<Booking | null>(null);
  const [notesBooking,    setNotesBooking]    = useState<Booking | null>(null);
  const [reBookFrom,      setReBookFrom]      = useState<Booking | null>(null);

  // ── Confirm dialog ─────────────────────────────────────────────────────────
  const [confirmDialog, setConfirmDialog] = useState<ConfirmState | null>(null);
  const [bulkConfirm,   setBulkConfirm]   = useState<{ status: BookingStatus; count: number } | null>(null);

  // ── Hooks ──────────────────────────────────────────────────────────────────
  const { toasts, push: pushToast } = useToasts();
  const customerNotes               = useCustomerNotes();
  const searchRef                   = useRef<HTMLInputElement>(null);

  // ── Fetch ──────────────────────────────────────────────────────────────────
  // roleRef/branchRef/fullRef are stable — never add sessionUser or fullAccess
  // to dep arrays below or every render triggers a fetch (infinite loading loop).
  const fetchBookings = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const params = new URLSearchParams();
      if (statusFilter !== 'all') params.append('status', statusFilter);
      if (dateFilter)             params.append('date',   dateFilter);
      const res  = await fetch(`${API_URL}/bookings?${params}`, {
        headers: {
          'X-User-Role':   roleRef.current,
          'X-User-Branch': fullRef.current ? '' : branchRef.current,
        },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to fetch');
      setBookings(data.bookings || []);
    } catch (err: any) { setError(err.message); }
    finally { setLoading(false); }
  }, [statusFilter, dateFilter]); // stable: only re-creates when filters change

  useEffect(() => { fetchBookings(); }, [fetchBookings]);

  // bookingsRef lets silentFetch read current bookings without being in its deps
  const bookingsRef = useRef<Booking[]>([]);
  useEffect(() => { bookingsRef.current = bookings; }, [bookings]);

  const silentFetch = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (statusFilter !== 'all') params.append('status', statusFilter);
      if (dateFilter)             params.append('date',   dateFilter);
      const res  = await fetch(`${API_URL}/bookings?${params}`, {
        headers: {
          'X-User-Role':   roleRef.current,
          'X-User-Branch': fullRef.current ? '' : branchRef.current,
        },
      });
      const data = await res.json();
      if (!res.ok) return;
      const incoming: Booking[] = data.bookings || [];
      const newOnes = incoming.filter(b => !new Set(bookingsRef.current.map(x => x.id)).has(b.id));
      if (newOnes.length > 0) {
        pushToast(`${newOnes.length} new booking${newOnes.length > 1 ? 's' : ''} arrived`, 'success');
        if (Notification.permission === 'granted') {
          new Notification('Anura Tyres — New Booking', {
            body: newOnes.map(b => `${b.customer} · ${b.service}`).join('\n'),
            icon: '/favicon.ico',
          });
        }
      }
      setBookings(incoming);
    } catch {}
  }, [statusFilter, dateFilter, pushToast]); // stable: bookings via ref, no loop

  const { online, lastRefresh } = useAutoRefresh(silentFetch, 30_000);

  // ── Status change ──────────────────────────────────────────────────────────
  const handleStatusChange = async (id: string, status: BookingStatus) => {
    try {
      const res  = await fetch(`${API_URL}/bookings`, {
        method:  'PATCH',
        headers: {
          'Content-Type':  'application/json',
          'X-User-Role':   roleRef.current,
          'X-User-Branch': fullRef.current ? '' : branchRef.current,
        },
        body: JSON.stringify({ bookingId: id, status }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || `Server returned ${res.status}`);
      setBookings(prev => prev.map(b => b.id === id ? { ...b, status } : b));
      pushToast(`Status updated to ${status}`, 'success');
    } catch (err: any) {
      pushToast(`Failed: ${err.message}`, 'error');
      throw err;
    }
  };

  const confirmStatusChange = (id: string, status: BookingStatus) => {
    const cfg = STATUS_CONFIRM_CONFIG[status];
    setConfirmDialog({ bookingId: id, status, label: cfg.label, message: cfg.message, btnClass: cfg.btnClass });
  };

  // ── Bay / notes (local only — backend call optional) ─────────────────────
  const handleSaveBayNotes = (id: string, bay: string, notes: string) => {
    setBookings(prev => prev.map(b => b.id === id ? { ...b, bay, notes } : b));
    pushToast('Bay & notes saved', 'success');
  };

  // ── Bulk ───────────────────────────────────────────────────────────────────
  const [bulkLoading, setBulkLoading] = useState(false);
  const handleBulkStatus = async (status: BookingStatus) => {
    setBulkLoading(true);
    await Promise.allSettled(Array.from(bulkSelect.selectedIds).map(id => handleStatusChange(id, status)));
    bulkSelect.clear();
    setBulkLoading(false);
    setBulkConfirm(null);
  };

  // ── Late alerts ────────────────────────────────────────────────────────────
  const handleAutoCancel = useCallback((bookingId: string) => {
    setBookings(prev => prev.map(b => b.id === bookingId ? { ...b, status: 'Cancelled' } : b));
  }, []);

  const { visibleAlerts, dismissAlert } = useLateAlerts(
    bookings, handleAutoCancel, roleRef.current, branchRef.current,
  );

  const handleMarkArrived = async (alert: { bookingId: string; level: 10 | 30 }) => {
    await handleStatusChange(alert.bookingId, 'In Progress').catch(() => {});
    dismissAlert(alert.bookingId, alert.level);
  };

  // ── Push notification permission ───────────────────────────────────────────
  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }, []);

  // ── Filtering ──────────────────────────────────────────────────────────────
  const branchFiltered = bookings.filter(b => bookingMatchesBranch(b.branch, branchFilter));

  const filtered = useMemo(() => {
    const q  = search.toLowerCase();
    const af = advFilters;
    return branchFiltered.filter(b => {
      if (q && !(b.customer?.toLowerCase().includes(q) || b.id?.toLowerCase().includes(q) || b.vehicle?.toLowerCase().includes(q))) return false;
      if (af.dateFrom && b.date < af.dateFrom)           return false;
      if (af.dateTo   && b.date > af.dateTo)             return false;
      if (af.category && !SERVICES.some(s => s.category === af.category && b.service.includes(s.name))) return false;
      if (af.source   && b.source !== af.source)         return false;
      if (af.vehicle  && !b.vehicle?.toLowerCase().includes(af.vehicle.toLowerCase())) return false;
      if (af.hasNotes && !b.notes)                        return false;
      return true;
    });
  }, [branchFiltered, search, advFilters]);

  const hasAdvFilters = Object.entries(advFilters).some(([k,v]) => k !== 'hasNotes' ? !!v : v);

  // ── Bulk select ────────────────────────────────────────────────────────────
  const bulkSelect = useBulkSelect(filtered.map(b => b.id));

  // ── Stats ──────────────────────────────────────────────────────────────────
  const stats = {
    total:      branchFiltered.length,
    pending:    branchFiltered.filter(b => b.status === 'Pending').length,
    inProgress: branchFiltered.filter(b => b.status === 'In Progress').length,
    completed:  branchFiltered.filter(b => b.status === 'Completed').length,
    waiting:    branchFiltered.filter(b => b.status === 'Waiting').length,
  };

  // ── Keyboard shortcuts ─────────────────────────────────────────────────────
  // filteredRef lets the export shortcut see the latest filtered list without
  // adding it to the handlers object deps (which would cause the listener to
  // re-register on every keystroke).
  const filteredRef = useRef<Booking[]>([]);
  useEffect(() => { filteredRef.current = filtered; }, [filtered]);

  useKeyboardShortcuts({
    onNew:         () => setShowNewBooking(true),
    onTimeline:    () => setShowTimeline(true),
    onToggleView:  () => setViewMode(v => v === 'table' ? 'kanban' : 'table'),
    onRefresh:     () => fetchBookings(),
    onFocusSearch: () => searchRef.current?.focus(),
    onPalette:     () => setShowPalette(true),
    onExport:      () => exportToCSV(filteredRef.current, 'bookings_filtered'),
    onShortcuts:   () => setShowShortcuts(true),
    onEscape:      () => { bulkSelect.clear(); setShowPalette(false); setShowShortcuts(false); },
  });

  // ══════════════════════════════════════════════════════════════════════════
  // RENDER
  // ══════════════════════════════════════════════════════════════════════════
  return (
    <>
      <div className="space-y-4 md:space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">

        {/* Late alert banners */}
        {visibleAlerts.length > 0 && (
          <div className="space-y-2">
            {visibleAlerts.map(alert => (
              <LateAlertBanner key={`${alert.bookingId}-${alert.level}`}
                alert={alert}
                onDismiss={() => dismissAlert(alert.bookingId, alert.level)}
                onMarkArrived={() => handleMarkArrived(alert)} />
            ))}
          </div>
        )}

        {/* Morning briefing */}
        {showBriefing && bookings.length > 0 && (
          <MorningBriefing bookings={bookings} onDismiss={() => setShowBriefing(false)} />
        )}

        {/* Page header */}
        <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
          <div>
            <h2 className="text-2xl md:text-3xl font-bold text-white mb-1">Bookings Management</h2>
            <div className="flex items-center gap-3 flex-wrap">
              <p className="text-neutral-400 text-sm">{fullAccess ? 'All branches' : `${userBranch} branch only`}</p>
              <OnlineBadge online={online} lastRefresh={lastRefresh} />
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex flex-wrap gap-2">
            {/* Table / Kanban toggle */}
            <div className="flex items-center bg-neutral-800 border border-neutral-700 rounded-lg p-1">
              <button onClick={() => setViewMode('table')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${viewMode==='table'?'bg-neutral-700 text-white':'text-neutral-500 hover:text-neutral-300'}`}>
                <List className="w-3.5 h-3.5"/>Table
              </button>
              <button onClick={() => setViewMode('kanban')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${viewMode==='kanban'?'bg-neutral-700 text-white':'text-neutral-500 hover:text-neutral-300'}`}>
                <Columns className="w-3.5 h-3.5"/>Kanban
              </button>
            </div>

            <button onClick={() => setShowTimeline(true)}  className="flex items-center gap-2 px-3 py-2 border border-neutral-700 rounded-lg text-neutral-300 text-sm font-medium hover:bg-neutral-800 hover:text-white transition-colors"><BarChart2 className="w-4 h-4"/><span className="hidden sm:inline">Timeline</span></button>
            <button onClick={() => setShowAnalytics(true)} className="flex items-center gap-2 px-3 py-2 border border-neutral-700 rounded-lg text-neutral-300 text-sm font-medium hover:bg-neutral-800 hover:text-white transition-colors"><TrendingUp className="w-4 h-4"/><span className="hidden sm:inline">Analytics</span></button>
            <button onClick={() => setShowCalendar(true)}  className="flex items-center gap-2 px-3 py-2 border border-neutral-700 rounded-lg text-neutral-300 text-sm font-medium hover:bg-neutral-800 hover:text-white transition-colors"><Calendar className="w-4 h-4"/><span className="hidden sm:inline">Calendar</span></button>
            <button onClick={() => setShowPrint(true)}     className="flex items-center gap-2 px-3 py-2 border border-neutral-700 rounded-lg text-neutral-300 text-sm font-medium hover:bg-neutral-800 hover:text-white transition-colors"><Printer className="w-4 h-4"/><span className="hidden sm:inline">Print</span></button>
            <ExportDropdown bookings={bookings} filtered={filtered} />
            <button onClick={() => setShowPalette(true)}   title="⌘K" className="flex items-center gap-2 px-3 py-2 border border-neutral-700 rounded-lg text-neutral-300 text-sm font-medium hover:bg-neutral-800 hover:text-white transition-colors"><Command className="w-4 h-4"/></button>
            <button onClick={() => setShowShortcuts(true)} title="?" className="flex items-center gap-2 px-3 py-2 border border-neutral-700 rounded-lg text-neutral-300 text-sm font-medium hover:bg-neutral-800 hover:text-white transition-colors"><Zap className="w-4 h-4"/></button>
            <button onClick={() => setShowNewBooking(true)} className="flex items-center gap-2 px-3 md:px-4 py-2 bg-[#FFD700] rounded-lg text-black text-sm font-bold hover:bg-[#FFD700]/90 transition-colors"><Plus className="w-4 h-4"/>New</button>
          </div>
        </div>

        {/* Branch restriction banner */}
        {!fullAccess && (
          <div className="flex items-center gap-2.5 px-4 py-2.5 bg-[#FFD700]/5 border border-[#FFD700]/20 rounded-xl">
            <Shield className="w-4 h-4 text-[#FFD700] flex-shrink-0"/>
            <p className="text-sm text-neutral-300">Restricted to <span className="text-[#FFD700] font-bold">{userBranch}</span><span className="text-neutral-500 ml-1 text-xs">({userRole})</span></p>
          </div>
        )}

        {/* Stats row */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 md:gap-4">
          {[
            { label:'Total',       value: stats.total,      color:'text-white' },
            { label:'Pending',     value: stats.pending,    color:'text-yellow-400' },
            { label:'In Progress', value: stats.inProgress, color:'text-blue-400' },
            { label:'Completed',   value: stats.completed,  color:'text-green-400' },
            { label:'Waiting',     value: stats.waiting,    color:'text-orange-400' },
          ].map(s => (
            <div key={s.label} className="bg-neutral-900 border border-neutral-800 rounded-xl p-3 md:p-4">
              <div className={`text-xl md:text-2xl font-bold ${s.color}`}>{s.value}</div>
              <div className="text-neutral-500 text-xs md:text-sm mt-0.5">{s.label}</div>
            </div>
          ))}
        </div>

        {/* Main table/kanban card */}
        <div className="bg-neutral-900 border border-neutral-800 rounded-xl overflow-hidden">

          {/* Filter bar */}
          <div className="p-3 md:p-5 border-b border-neutral-800 space-y-3">
            <div className="flex flex-col md:flex-row gap-3">
              {/* Search */}
              <div className="relative flex-1 max-w-full md:max-w-sm">
                <Search className="absolute left-3 top-2.5 w-4 h-4 text-neutral-500"/>
                <input ref={searchRef} value={search} onChange={e => setSearch(e.target.value)}
                  placeholder="Search customer, ID, vehicle… (⌘F)"
                  className="w-full pl-9 pr-3 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-white text-sm focus:outline-none focus:border-[#FFD700] placeholder:text-neutral-600 transition-colors"/>
              </div>
              <div className="flex gap-2 items-center flex-wrap">
                <input type="date" value={dateFilter} onChange={e => setDateFilter(e.target.value)}
                  className="px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-white text-sm focus:outline-none focus:border-[#FFD700]"/>
                {dateFilter && <button onClick={() => setDateFilter('')} className="px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-neutral-400 hover:text-white text-xs transition-colors">Clear</button>}
                <button onClick={() => setShowAdvSearch(s => !s)}
                  className={`flex items-center gap-1.5 px-3 py-2 rounded-lg border text-xs font-medium transition-colors ${showAdvSearch || hasAdvFilters ? 'bg-[#FFD700]/10 border-[#FFD700]/40 text-[#FFD700]' : 'bg-neutral-800 border-neutral-700 text-neutral-400 hover:text-white'}`}>
                  Advanced{hasAdvFilters && <span className="w-1.5 h-1.5 rounded-full bg-[#FFD700]"/>}
                </button>
              </div>
            </div>

            {/* Advanced filters */}
            {showAdvSearch && (
              <AdvancedSearchPanel filters={advFilters} onChange={setAdvFilters}
                onClear={() => setAdvFilters(DEFAULT_ADV)} onClose={() => setShowAdvSearch(false)} />
            )}

            {/* Status pills */}
            <div className="flex gap-2 flex-wrap">
              {(['all','Pending','In Progress','Completed','Cancelled','Waiting'] as const).map(s => (
                <button key={s} onClick={() => setStatusFilter(s)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap ${statusFilter === s ? 'bg-[#FFD700] text-black' : 'bg-neutral-800 text-neutral-400 hover:bg-neutral-700 hover:text-white border border-neutral-700'}`}>
                  {s === 'all' ? 'All' : s}
                </button>
              ))}
              <button onClick={fetchBookings} disabled={loading}
                className="p-1.5 md:p-2 bg-neutral-800 border border-neutral-700 rounded-lg text-neutral-400 hover:text-white hover:bg-neutral-700 transition-colors" title="Refresh (R)">
                <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`}/>
              </button>
            </div>

            {/* Branch filter */}
            <div className="flex gap-2 flex-wrap items-center">
              <span className="text-xs text-neutral-500 font-medium flex items-center gap-1 whitespace-nowrap"><MapPin className="w-3 h-3"/>Branch:</span>
              {fullAccess ? (
                (['all', ...BRANCHES.map(b => b.shortName)] as const).map(br => (
                  <button key={br} onClick={() => setBranchFilter(br)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap ${branchFilter === br ? 'bg-[#FFD700] text-black' : 'bg-neutral-800 text-neutral-400 hover:bg-neutral-700 hover:text-white border border-neutral-700'}`}>
                    {br === 'all' ? 'All Branches' : br}
                  </button>
                ))
              ) : (
                <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border bg-[#FFD700]/10 border-[#FFD700]/30 text-[#FFD700] text-xs font-medium">
                  <Shield className="w-3 h-3"/>{userBranch}<span className="ml-1 text-[10px] text-neutral-500">(locked)</span>
                </span>
              )}
            </div>

            {/* Bulk action bar */}
            <BulkActionBar
              selectedIds={bulkSelect.selectedIds}
              onClear={bulkSelect.clear}
              onBulkStatus={status => setBulkConfirm({ status, count: bulkSelect.selectedIds.size })}
              loading={bulkLoading} />
          </div>

          {error && <div className="p-4 bg-red-500/10 border-b border-red-500/20 text-red-400 text-sm text-center">{error}</div>}
          {loading && <div className="flex items-center justify-center py-16"><RefreshCw className="w-8 h-8 text-[#FFD700] animate-spin"/></div>}

          {!loading && !error && filtered.length === 0 && (
            <div className="py-16 text-center">
              <div className="text-neutral-500 mb-3">No bookings found</div>
              <button onClick={fetchBookings} className="text-[#FFD700] text-sm hover:underline">Refresh</button>
            </div>
          )}

          {/* ── TABLE ── */}
          {!loading && filtered.length > 0 && viewMode === 'table' && (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-neutral-950 border-b border-neutral-800">
                    {/* Select-all checkbox */}
                    <th className="px-3 md:px-5 py-3.5 w-10">
                      <RowCheckbox checked={bulkSelect.allSelected} indeterminate={bulkSelect.someSelected} onChange={bulkSelect.toggleAll}/>
                    </th>
                    {['Booking ID','Date','Customer','Vehicle','Service','Status','Actions'].map(h => (
                      <th key={h} className={`px-3 md:px-5 py-3.5 font-bold text-[#FFD700] text-left text-xs md:text-sm whitespace-nowrap ${h==='Actions'?'text-right':''}`}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-800">
                  {filtered.map(booking => {
                    const hasAlert   = visibleAlerts.some(a => a.bookingId === booking.id);
                    const isSelected = bulkSelect.selectedIds.has(booking.id);
                    const note       = customerNotes.getNote(booking.phone || '');
                    const hCount     = bookings.filter(b => {
                      if (b.id === booking.id) return false;
                      return booking.phone && b.phone &&
                        b.phone.replace(/\s/g,'') === booking.phone.replace(/\s/g,'');
                    }).length;

                    return (
                      <tr key={booking.id}
                        className={`hover:bg-neutral-800/50 transition-colors cursor-pointer ${hasAlert?'bg-orange-500/5':''} ${isSelected?'bg-[#FFD700]/5':''}`}
                        onClick={() => setSelectedBooking(booking)}>

                        {/* Checkbox */}
                        <td className="px-3 md:px-5 py-3 md:py-4">
                          <RowCheckbox checked={isSelected} onChange={() => bulkSelect.toggle(booking.id)}/>
                        </td>

                        {/* ID + source */}
                        <td className="px-3 md:px-5 py-3 md:py-4 font-mono font-medium text-white text-xs">
                          <div className="flex items-center gap-1.5 mb-0.5">
                            {hasAlert && <span className="w-1.5 h-1.5 rounded-full bg-orange-400 animate-pulse flex-shrink-0"/>}
                            {booking.source && booking.source !== 'website' && (
                              <span className="text-[10px] px-1.5 py-0.5 rounded bg-neutral-800 text-neutral-500 border border-neutral-700">
                                {booking.source === 'manual' ? 'Staff' : booking.source === 'rebook' ? 'Rebook' : 'Walk-in'}
                              </span>
                            )}
                          </div>
                          {booking.id}
                        </td>

                        {/* Date + countdown */}
                        <td className="px-3 md:px-5 py-3 md:py-4 text-neutral-400 text-xs whitespace-nowrap">
                          <div>{booking.date}</div>
                          {booking.timeSlot && (booking.status==='Pending'||booking.status==='In Progress') && (
                            <CountdownTimer dateStr={booking.date} timeSlot={booking.timeSlot}/>
                          )}
                        </td>

                        {/* Customer + history + tag */}
                        <td className="px-3 md:px-5 py-3 md:py-4 text-white font-medium text-sm">
                          <div className="flex items-center gap-1.5">
                            {note?.tag === 'vip'     && <Star className="w-3 h-3 text-yellow-400 flex-shrink-0"/>}
                            {note?.tag === 'flagged' && <AlertTriangle className="w-3 h-3 text-red-400 flex-shrink-0"/>}
                            <span>{booking.customer}</span>
                          </div>
                          {hCount > 0 && (
                            <button onClick={e => { e.stopPropagation(); setHistoryBooking(booking); }}
                              className="flex items-center gap-1 text-[11px] text-[#FFD700]/70 hover:text-[#FFD700] mt-0.5">
                              <History className="w-3 h-3"/>{hCount} past
                            </button>
                          )}
                        </td>

                        {/* Vehicle */}
                        <td className="px-3 md:px-5 py-3 md:py-4 text-neutral-400 font-mono text-xs">{booking.vehicle||'N/A'}</td>

                        {/* Service + bay + notes indicator */}
                        <td className="px-3 md:px-5 py-3 md:py-4 text-neutral-300 text-xs max-w-[120px] md:max-w-[150px]">
                          <div className="truncate">{booking.service}</div>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            {booking.bay   && <span className="text-[11px] text-blue-400 flex items-center gap-0.5"><Wrench className="w-3 h-3"/>{booking.bay}</span>}
                            {booking.notes && <MessageSquare className="w-3 h-3 text-[#FFD700]"/>}
                          </div>
                        </td>

                        {/* Status */}
                        <td className="px-3 md:px-5 py-3 md:py-4">{statusBadge(booking.status)}</td>

                        {/* Actions */}
                        <td className="px-3 md:px-5 py-3 md:py-4 text-right" onClick={e => e.stopPropagation()}>
                          <div className="flex items-center justify-end gap-1 md:gap-1.5">
                            <button title="Start"    onClick={() => confirmStatusChange(booking.id,'In Progress')} disabled={booking.status==='In Progress'} className="p-1 md:p-1.5 rounded text-neutral-500 hover:text-[#FFD700] hover:bg-neutral-800 transition-colors disabled:opacity-30"><PlayCircle className="w-3.5 h-3.5 md:w-4 md:h-4"/></button>
                            <button title="Complete" onClick={() => confirmStatusChange(booking.id,'Completed')}   disabled={booking.status==='Completed'}   className="p-1 md:p-1.5 rounded text-neutral-500 hover:text-green-400 hover:bg-neutral-800 transition-colors disabled:opacity-30"><CheckCircle className="w-3.5 h-3.5 md:w-4 md:h-4"/></button>
                            <button title="Cancel"   onClick={() => confirmStatusChange(booking.id,'Cancelled')}   disabled={booking.status==='Cancelled'}   className="p-1 md:p-1.5 rounded text-neutral-500 hover:text-red-400 hover:bg-neutral-800 transition-colors disabled:opacity-30"><XCircle className="w-3.5 h-3.5 md:w-4 md:h-4"/></button>
                            <button title="Bay & Notes" onClick={() => setNotesBooking(booking)} className="p-1 md:p-1.5 rounded text-neutral-500 hover:text-blue-400 hover:bg-neutral-800 transition-colors"><Wrench className="w-3.5 h-3.5 md:w-4 md:h-4"/></button>
                            <button title="Re-book"  onClick={() => setReBookFrom(booking)}      className="p-1 md:p-1.5 rounded text-neutral-500 hover:text-purple-400 hover:bg-neutral-800 transition-colors"><Copy className="w-3.5 h-3.5 md:w-4 md:h-4"/></button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* ── KANBAN ── */}
          {!loading && viewMode === 'kanban' && (
            <div className="p-4 md:p-5">
              <KanbanView
                bookings={filtered}
                onStatusChange={handleStatusChange}
                onBookingClick={setSelectedBooking}
                customerNotes={customerNotes} />
            </div>
          )}

          {/* Footer */}
          {!loading && filtered.length > 0 && (
            <div className="px-3 md:px-5 py-3 border-t border-neutral-800 text-xs text-neutral-500 flex items-center justify-between gap-2 flex-wrap">
              <span>
                Showing {filtered.length} of {branchFiltered.length} bookings
                {!fullAccess              && <span className="text-[#FFD700] ml-1">· {userBranch}</span>}
                {fullAccess && branchFilter !== 'all' && <span className="text-[#FFD700] ml-1">· {branchFilter}</span>}
                {bulkSelect.selectedIds.size > 0 && <span className="text-[#FFD700] ml-2">· {bulkSelect.selectedIds.size} selected</span>}
                {hasAdvFilters && <span className="text-orange-400 ml-2">· filtered</span>}
              </span>
              <span className="text-[11px] text-neutral-700">
                Press <kbd className="px-1 py-0.5 bg-neutral-800 border border-neutral-700 rounded text-[10px]">?</kbd> for shortcuts
              </span>
            </div>
          )}
        </div>
      </div>

      {/* ── Modals ─────────────────────────────────────────────────────────── */}
      {showNewBooking && (
        <ManualBookingModal
          onClose={() => setShowNewBooking(false)} onSuccess={fetchBookings}
          existingBookings={bookings} defaultBranch={!fullAccess ? userBranch : undefined} />
      )}
      {reBookFrom && (
        <ManualBookingModal
          onClose={() => setReBookFrom(null)} onSuccess={fetchBookings}
          existingBookings={bookings} defaultBranch={!fullAccess ? userBranch : undefined}
          reBookFrom={reBookFrom} />
      )}
      {showCalendar  && <CalendarModal bookings={filtered} onClose={() => setShowCalendar(false)} />}
      {showPrint     && <PrintView     bookings={filtered} onClose={() => setShowPrint(false)} />}
      {showTimeline  && <TodayTimeline bookings={bookings} onClose={() => setShowTimeline(false)} />}
      {showAnalytics && <AnalyticsDashboard bookings={bookings} onClose={() => setShowAnalytics(false)} />}
      {showShortcuts && <ShortcutsPanel onClose={() => setShowShortcuts(false)} />}
      {showPalette   && (
        <CommandPalette bookings={bookings} onClose={() => setShowPalette(false)}
          onBookingSelect={b => setSelectedBooking(b)}
          onAction={action => {
            if (action === 'new')      setShowNewBooking(true);
            if (action === 'timeline') setShowTimeline(true);
            if (action === 'export')   exportToCSV(filtered, 'bookings_filtered');
            if (action === 'refresh')  fetchBookings();
            if (action === 'kanban')   setViewMode(v => v === 'table' ? 'kanban' : 'table');
          }} />
      )}
      {historyBooking && (
        <CustomerHistoryPanel
          booking={historyBooking} allBookings={bookings}
          onClose={() => setHistoryBooking(null)}
          notes={customerNotes}
          onSaveNote={(phone, text, tag) => customerNotes.upsert(phone, text, tag)} />
      )}
      {notesBooking && (
        <BookingNotesModal booking={notesBooking} onClose={() => setNotesBooking(null)} onSave={handleSaveBayNotes} />
      )}
      {selectedBooking && (
        <BookingDetailModal
          booking={selectedBooking} allBookings={bookings}
          onClose={() => setSelectedBooking(null)}
          onStatusChange={async (id, status) => { setSelectedBooking(null); confirmStatusChange(id, status); }}
          onViewHistory={b => setHistoryBooking(b)}
          onEditNotes={b => { setSelectedBooking(null); setNotesBooking(b); }}
          customerNotes={customerNotes} />
      )}

      {confirmDialog && (
        <ConfirmDialog
          title={`Confirm: ${confirmDialog.label}`}
          message={confirmDialog.message}
          confirmLabel={confirmDialog.label}
          confirmClass={confirmDialog.btnClass}
          onCancel={() => setConfirmDialog(null)}
          onConfirm={async () => {
            const { bookingId, status } = confirmDialog;
            setConfirmDialog(null);
            await handleStatusChange(bookingId, status).catch(() => {});
          }} />
      )}
      {bulkConfirm && (
        <ConfirmDialog
          title={`Bulk Update — ${bulkConfirm.count} bookings`}
          message={`Set all ${bulkConfirm.count} selected booking(s) to "${bulkConfirm.status}"?`}
          confirmLabel={`Update ${bulkConfirm.count} bookings`}
          confirmClass={STATUS_CONFIRM_CONFIG[bulkConfirm.status].btnClass}
          onCancel={() => setBulkConfirm(null)}
          onConfirm={() => handleBulkStatus(bulkConfirm.status)} />
      )}

      <ToastContainer toasts={toasts} />
    </>
  );
}