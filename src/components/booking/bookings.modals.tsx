// bookings.modals.tsx — ManualBookingModal, BookingDetailModal, BookingNotesModal, CalendarModal, PrintView

import React, { useState, useEffect, useRef } from 'react';
import {
  X, RefreshCw, User, Car, MapPin, Calendar, Clock, Shield,
  CheckCircle, AlertTriangle, PlayCircle, XCircle, List,
  Printer, MessageSquare, Wrench, History, Copy,
} from 'lucide-react';
import {
  BRANCHES, SERVICE_CATEGORIES, SERVICES, TIME_SLOTS, BAYS, PLATE_FORMATS,
  STATUS_CONFIRM_CONFIG, TAG_STYLE, TAG_LABEL, SOURCE_LABELS,
  validateSLPlate, formatPlate, resolveBranchName,
  type Booking, type BookingStatus, type CustomerNote,
} from './bookings.types';
import { statusBadge } from './bookings.ui';
import { useCustomerNotes } from './bookings.hooks';
import { canSeeAllBranches, getSessionUser, type UserRole } from '../../lib/auth';

const API_URL = (
  import.meta.env.VITE_API_URL ||
  'https://anuratyres-backend-emm1774.vercel.app/api'
).replace(/\/$/, '');

// ══════════════════════════════════════════════════════════════════════════════
// MANUAL BOOKING MODAL (also handles rebook)
// ══════════════════════════════════════════════════════════════════════════════
export function ManualBookingModal({
  onClose, onSuccess, existingBookings, defaultBranch, reBookFrom,
}: {
  onClose:          () => void;
  onSuccess:        () => void;
  existingBookings: Booking[];
  defaultBranch?:   string;
  reBookFrom?:      Booking;
}) {
  const [loading,    setLoading]    = useState(false);
  const [error,      setError]      = useState<string | null>(null);
  const [autofilled, setAutofilled] = useState(false);
  const [lookingUp,  setLookingUp]  = useState(false);
  const lookupTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const sessionUser  = getSessionUser();
  const lockedBranch = defaultBranch
    ? BRANCHES.find(b => b.shortName === defaultBranch || b.name === defaultBranch)
    : null;

  const reBranchId   = reBookFrom
    ? BRANCHES.find(b => resolveBranchName(reBookFrom.branch) === b.shortName)?.id ?? ''
    : '';
  const reCategory   = reBookFrom
    ? (SERVICES.find(s => reBookFrom.service.includes(s.name))?.category ?? '')
    : '';
  const reServiceIds = reBookFrom
    ? SERVICES.filter(s => reBookFrom.service.includes(s.name)).map(s => s.id)
    : [];

  const [form, setForm] = useState({
    branchId:   lockedBranch?.id ?? reBranchId,
    category:   reCategory,
    serviceIds: reServiceIds as string[],
    date:       '',
    timeSlot:   '',
    name:       reBookFrom?.customer || '',
    email:      reBookFrom?.email    || '',
    phone:      reBookFrom?.phone    || '',
    vehicleNo:  reBookFrom?.vehicle !== 'N/A' ? (reBookFrom?.vehicle || '') : '',
  });

  const branch     = BRANCHES.find(b => b.id === form.branchId);
  const categories = branch?.hasFullService
    ? SERVICE_CATEGORIES
    : SERVICE_CATEGORIES.filter(c => c.id === 'Anura Tyres');
  const services   = SERVICES.filter(s => s.category === form.category);

  // Slot availability
  const getSlotCount = (slot: string) => {
    if (!branch) return 0;
    return existingBookings.filter(bk =>
      (bk.branch === branch.shortName || bk.branch === branch.name) &&
      bk.date === form.date && bk.timeSlot === slot && bk.status !== 'Cancelled',
    ).length;
  };

  const lookupCustomer = (phone: string, vehicleNo: string) => {
    if (lookupTimer.current) clearTimeout(lookupTimer.current);
    const pc = phone.replace(/\s/g, '');
    const vc = vehicleNo.replace(/\s/g, '').toUpperCase();
    if (pc.length < 7 && vc.length < 4) { setAutofilled(false); return; }

    lookupTimer.current = setTimeout(async () => {
      setLookingUp(true);
      try {
        const params = new URLSearchParams();
        if (pc.length >= 7) params.set('phone',   pc);
        if (vc.length >= 4) params.set('vehicle', vc);
        const res  = await fetch(`${API_URL}/customers?${params}`);
        const data = await res.json();
        if (data.success && data.customer) {
          setForm(f => ({
            ...f,
            name:      data.customer.name      || f.name,
            email:     data.customer.email     || f.email,
            phone:     phone || data.customer.phone     || f.phone,
            vehicleNo: vehicleNo || data.customer.vehicleNo || f.vehicleNo,
          }));
          setAutofilled(true);
          setLookingUp(false);
          return;
        }
      } catch { /* fall through to in-memory */ }

      // In-memory fallback (already-loaded bookings on this page)
      const match = existingBookings.find(b => {
        if (pc.length >= 7 && b.phone && b.phone.replace(/\s/g, '').includes(pc)) return true;
        if (vc.length >= 4 && b.vehicle && b.vehicle !== 'N/A' &&
            b.vehicle.replace(/\s/g, '').toUpperCase() === vc) return true;
        return false;
      });
      if (match) {
        setForm(f => ({ ...f, name: match.customer || f.name, email: match.email || f.email,
          phone: phone || match.phone || f.phone, vehicleNo: vehicleNo || match.vehicle || f.vehicleNo }));
        setAutofilled(true);
      } else { setAutofilled(false); }
      setLookingUp(false);
    }, 400);
  };

  const toggle = (id: string) => setForm(f => ({
    ...f, serviceIds: f.serviceIds.includes(id)
      ? f.serviceIds.filter(x => x !== id)
      : [...f.serviceIds, id],
  }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.branchId)          return setError('Select a branch');
    if (!form.category)          return setError('Select a category');
    if (!form.serviceIds.length) return setError('Select at least one service');
    if (!form.date)              return setError('Select a date');
    if (!form.timeSlot)          return setError('Select a time slot');
    if (form.vehicleNo && !validateSLPlate(form.vehicleNo)) return setError('Invalid plate format');
    const branchObj = BRANCHES.find(b => b.id === form.branchId);
    if (!branchObj) return setError('Branch not found');
    if (getSlotCount(form.timeSlot) >= branchObj.maxBookingsPerSlot) return setError('Slot is fully booked');

    setLoading(true); setError(null);
    try {
      const svcs = SERVICES.filter(s => form.serviceIds.includes(s.id));
      const res  = await fetch(`${API_URL}/bookings`, {
        method:  'POST',
        headers: {
          'Content-Type':  'application/json',
          'X-User-Role':   sessionUser?.role   || 'Cashier',
          'X-User-Branch': canSeeAllBranches(sessionUser?.role as UserRole) ? '' : (sessionUser?.branch || ''),
        },
        body: JSON.stringify({
          source:   reBookFrom ? 'rebook' : 'manual',
          branch:   { id: branchObj.id, name: branchObj.shortName, address: branchObj.address, phone: branchObj.phone },
          category: form.category,
          services: svcs.map(s => ({ id: s.id, name: s.name, category: s.category })),
          date:     new Date(`${form.date}T12:00:00.000Z`).toISOString(),
          timeSlot: form.timeSlot,
          customer: { name: form.name, email: form.email, phone: form.phone, vehicleNo: form.vehicleNo.trim().toUpperCase() },
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed');
      onSuccess(); onClose();
    } catch (err: any) { setError(err.message); }
    finally { setLoading(false); }
  };

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4 backdrop-blur-sm overflow-y-auto">
      <div className="bg-neutral-900 rounded-xl border border-neutral-700 w-full max-w-2xl my-8 shadow-2xl">
        {/* Header */}
        <div className="sticky top-0 bg-neutral-900 border-b border-neutral-700 px-6 py-4 flex justify-between items-center rounded-t-xl z-10">
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            {reBookFrom && <Copy className="w-4 h-4 text-[#FFD700]" />}
            {reBookFrom ? 'Re-book Appointment' : 'Create New Booking'}
          </h2>
          <button onClick={onClose} className="text-neutral-400 hover:text-white p-1 rounded-lg hover:bg-neutral-800"><X className="w-5 h-5" /></button>
        </div>

        {reBookFrom && (
          <div className="mx-6 mt-4 px-3 py-2 bg-blue-500/10 border border-blue-500/30 rounded-lg text-xs text-blue-400 flex items-center gap-2">
            <Copy className="w-3.5 h-3.5 flex-shrink-0" />
            Re-booking <span className="font-semibold">{reBookFrom.customer}</span> — {reBookFrom.service}. Pick a new date & time.
          </div>
        )}

        <form onSubmit={submit} className="p-6 space-y-5">
          {error && <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm">{error}</div>}

          {/* Customer identification */}
          <div className="border border-neutral-700 rounded-xl p-4 space-y-3 bg-neutral-800/40">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <User className="w-4 h-4 text-[#FFD700]" /> Identify Customer
              <span className="text-[11px] font-normal text-neutral-500 ml-1">— phone or vehicle to auto-fill</span>
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-neutral-400 block mb-1.5">Phone *</label>
                <input type="tel" value={form.phone}
                  onChange={e => { setForm(f => ({ ...f, phone: e.target.value })); lookupCustomer(e.target.value, form.vehicleNo); }}
                  placeholder="077 123 4567" required
                  className="w-full px-3 py-2.5 bg-neutral-800 border border-neutral-700 rounded-lg text-white text-sm focus:outline-none focus:border-[#FFD700] placeholder:text-neutral-600" />
              </div>
              <div>
                <label className="text-xs font-medium text-neutral-400 block mb-1.5 flex items-center justify-between">
                  <span>Vehicle No <span className="text-neutral-600 font-normal">(Optional)</span></span>
                  {form.vehicleNo && (
                    <span className={`text-[11px] font-mono ${validateSLPlate(form.vehicleNo) ? 'text-green-400' : 'text-red-400'}`}>
                      {validateSLPlate(form.vehicleNo) ? '✓ Valid' : '✗ Invalid'}
                    </span>
                  )}
                </label>
                <div className="relative">
                  <Car className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-600 pointer-events-none" />
                  <input value={form.vehicleNo}
                    onChange={e => {
                      const r = e.target.value;
                      if (/ශ/.test(r)) { setForm(f => ({ ...f, vehicleNo: r })); return; }
                      const { formatted } = formatPlate(r);
                      setForm(f => ({ ...f, vehicleNo: formatted }));
                      lookupCustomer(form.phone, formatted);
                    }}
                    placeholder="e.g. WP CBA-1234"
                    maxLength={formatPlate(form.vehicleNo || '').maxLength}
                    autoComplete="off"
                    style={{ textTransform: /ශ/.test(form.vehicleNo || '') ? 'none' : 'uppercase' }}
                    className={`w-full pl-10 pr-10 py-2.5 bg-neutral-800 border rounded-lg text-white text-sm font-mono focus:outline-none transition-colors placeholder:text-neutral-600 ${
                      form.vehicleNo
                        ? validateSLPlate(form.vehicleNo)
                          ? 'border-green-500/50 focus:border-green-400'
                          : 'border-red-500/50 focus:border-red-400'
                        : 'border-neutral-700 focus:border-[#FFD700]'
                    }`} />
                  {form.vehicleNo && (
                    <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
                      {validateSLPlate(form.vehicleNo)
                        ? <CheckCircle className="w-4 h-4 text-green-400" />
                        : <AlertTriangle className="w-4 h-4 text-red-400" />}
                    </div>
                  )}
                </div>
                {/* Plate format examples */}
                <div className="grid grid-cols-4 gap-1 mt-1.5">
                  {PLATE_FORMATS.map(fmt => (
                    <button key={fmt.example} type="button"
                      onClick={() => { setForm(f => ({ ...f, vehicleNo: fmt.example })); lookupCustomer(form.phone, fmt.example); }}
                      className={`text-left px-2 py-1.5 rounded-lg border transition-all ${form.vehicleNo === fmt.example ? 'border-[#FFD700]/60 bg-[#FFD700]/5' : 'border-white/[0.08] hover:border-white/20'}`}>
                      <span className="block text-[9px] text-neutral-600 uppercase tracking-wider mb-0.5">{fmt.label}</span>
                      <span className="block text-[10px] font-mono text-neutral-400">{fmt.example}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {lookingUp ? (
              <div className="flex items-center gap-2 px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-lg">
                <RefreshCw className="w-4 h-4 text-neutral-500 animate-spin flex-shrink-0" />
                <span className="text-xs text-neutral-500">Looking up customer…</span>
              </div>
            ) : autofilled && (
              <div className="flex items-center gap-2 px-3 py-2 bg-green-500/10 border border-green-500/30 rounded-lg">
                <CheckCircle className="w-4 h-4 text-green-400 flex-shrink-0" />
                <span className="text-xs text-green-400">Returning customer — details auto-filled.</span>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
              <div>
                <label className="text-xs font-medium text-neutral-400 block mb-1.5">Full Name *</label>
                <input value={form.name}
                  onChange={e => { setForm(f => ({ ...f, name: e.target.value.toUpperCase() })); setAutofilled(false); }}
                  placeholder="E.G. NIMAL PERERA" style={{ textTransform: 'uppercase' }} required
                  className={`w-full px-3 py-2.5 bg-neutral-800 border rounded-lg text-white text-sm focus:outline-none focus:border-[#FFD700] placeholder:text-neutral-600 ${autofilled ? 'border-green-500/40' : 'border-neutral-700'}`} />
              </div>
              <div>
                <label className="text-xs font-medium text-neutral-400 block mb-1.5">Email *</label>
                <input type="email" value={form.email}
                  onChange={e => { setForm(f => ({ ...f, email: e.target.value })); setAutofilled(false); }}
                  placeholder="email@example.com" required
                  className={`w-full px-3 py-2.5 bg-neutral-800 border rounded-lg text-white text-sm focus:outline-none focus:border-[#FFD700] placeholder:text-neutral-600 ${autofilled ? 'border-green-500/40' : 'border-neutral-700'}`} />
              </div>
            </div>
          </div>

          {/* Branch */}
          <div>
            <label className="text-sm font-medium text-white block mb-1.5">
              Branch *
              {lockedBranch && <span className="ml-2 text-xs text-[#FFD700] font-normal inline-flex items-center gap-1"><Shield className="w-3 h-3" />locked</span>}
            </label>
            {lockedBranch
              ? <div className="w-full px-3 py-2.5 bg-neutral-800/50 border border-[#FFD700]/30 rounded-lg text-[#FFD700] text-sm flex items-center gap-2"><MapPin className="w-4 h-4" />{lockedBranch.name}</div>
              : <select value={form.branchId} onChange={e => setForm({ ...form, branchId: e.target.value, category: '', serviceIds: [] })}
                  className="w-full px-3 py-2.5 bg-neutral-800 border border-neutral-700 rounded-lg text-white text-sm focus:outline-none focus:border-[#FFD700]" required>
                  <option value="">Select a branch...</option>
                  {BRANCHES.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                </select>
            }
          </div>

          {/* Category */}
          {form.branchId && (
            <div>
              <label className="text-sm font-medium text-white block mb-1.5">Category *</label>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                {categories.map(c => (
                  <button key={c.id} type="button"
                    onClick={() => setForm({ ...form, category: c.id, serviceIds: [] })}
                    className={`p-3 rounded-lg border text-sm font-medium transition-all ${form.category === c.id ? 'bg-[#FFD700]/10 border-[#FFD700] text-[#FFD700]' : 'bg-neutral-800 border-neutral-700 text-neutral-400 hover:border-neutral-500'}`}>
                    {c.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Services */}
          {form.category && (
            <div>
              <label className="text-sm font-medium text-white block mb-1.5">Services * (one or more)</label>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2 max-h-52 overflow-y-auto">
                {services.map(s => (
                  <label key={s.id} className={`flex items-center gap-2.5 p-3 rounded-lg border cursor-pointer transition-all ${form.serviceIds.includes(s.id) ? 'bg-[#FFD700]/10 border-[#FFD700] text-white' : 'bg-neutral-800 border-neutral-700 text-neutral-400 hover:border-neutral-600'}`}>
                    <input type="checkbox" checked={form.serviceIds.includes(s.id)} onChange={() => toggle(s.id)} className="w-4 h-4 accent-[#FFD700]" />
                    <span className="text-sm flex-1">{s.name}</span>
                    <span className="text-[11px] text-neutral-600">{s.durationMin}m</span>
                  </label>
                ))}
              </div>
            </div>
          )}

          {/* Date & Time with capacity bars */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium text-white block mb-1.5">Date *</label>
              <input type="date" value={form.date}
                min={new Date().toISOString().split('T')[0]}
                onChange={e => setForm({ ...form, date: e.target.value, timeSlot: '' })}
                className="w-full px-3 py-2.5 bg-neutral-800 border border-neutral-700 rounded-lg text-white text-sm focus:outline-none focus:border-[#FFD700]" required />
            </div>
            <div>
              <label className="text-sm font-medium text-white block mb-1.5">Time Slot *</label>
              {form.branchId && form.date ? (
                <div className="grid grid-cols-3 gap-1.5 max-h-44 overflow-y-auto pr-1">
                  {TIME_SLOTS.map(slot => {
                    const count = getSlotCount(slot);
                    const max   = branch?.maxBookingsPerSlot ?? 3;
                    const full  = count >= max;
                    return (
                      <button key={slot} type="button" disabled={full}
                        onClick={() => setForm({ ...form, timeSlot: slot })}
                        className={`px-2 py-2 rounded-lg border text-xs font-medium transition-all ${
                          form.timeSlot === slot
                            ? 'bg-[#FFD700]/10 border-[#FFD700] text-[#FFD700]'
                            : full
                              ? 'bg-neutral-800/40 border-neutral-800 text-neutral-700 cursor-not-allowed'
                              : 'bg-neutral-800 border-neutral-700 text-neutral-300 hover:border-neutral-500'
                        }`}>
                        <div>{slot}</div>
                        <div className="mt-1 h-1 bg-neutral-700 rounded-full overflow-hidden">
                          <div className={`h-full rounded-full ${full ? 'bg-red-500' : count > 0 ? 'bg-orange-400' : 'bg-green-500'}`}
                            style={{ width: `${(count / max) * 100}%` }} />
                        </div>
                        <div className={`text-[10px] mt-0.5 ${full ? 'text-red-400' : count > 0 ? 'text-orange-400' : 'text-green-500/70'}`}>
                          {full ? 'Full' : `${count}/${max}`}
                        </div>
                      </button>
                    );
                  })}
                </div>
              ) : (
                <div className="w-full px-3 py-2.5 bg-neutral-800/50 border border-neutral-700 rounded-lg text-neutral-600 text-sm">
                  Select branch & date first
                </div>
              )}
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} disabled={loading}
              className="flex-1 px-4 py-2.5 border border-neutral-700 rounded-lg text-neutral-300 text-sm font-medium hover:bg-neutral-800 transition-colors disabled:opacity-50">
              Cancel
            </button>
            <button type="submit" disabled={loading || !form.timeSlot}
              className="flex-1 px-4 py-2.5 bg-[#FFD700] rounded-lg text-black text-sm font-bold hover:bg-[#FFD700]/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2">
              {loading ? <><RefreshCw className="w-4 h-4 animate-spin" />Creating...</> : reBookFrom ? 'Rebook' : 'Create Booking'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// BOOKING DETAIL MODAL
// ══════════════════════════════════════════════════════════════════════════════
export function BookingDetailModal({
  booking, allBookings, onClose, onStatusChange, onViewHistory, onEditNotes, customerNotes,
}: {
  booking:       Booking;
  allBookings:   Booking[];
  onClose:       () => void;
  onStatusChange:(id: string, status: BookingStatus) => Promise<void>;
  onViewHistory: (b: Booking) => void;
  onEditNotes:   (b: Booking) => void;
  customerNotes: ReturnType<typeof useCustomerNotes>;
}) {
  const [loading, setLoading] = useState<BookingStatus | null>(null);

  const historyCount = allBookings.filter(b => {
    if (b.id === booking.id) return false;
    return booking.phone && b.phone &&
      b.phone.replace(/\s/g, '') === booking.phone.replace(/\s/g, '');
  }).length;

  const note = customerNotes.getNote(booking.phone || '');

  const changeStatus = async (status: BookingStatus) => {
    setLoading(status);
    await onStatusChange(booking.id, status);
    setLoading(null);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
      <div className="bg-neutral-900 rounded-xl border border-neutral-700 w-full max-w-lg shadow-2xl">
        <div className="border-b border-neutral-700 px-6 py-4 flex justify-between items-center">
          <h2 className="text-lg font-bold text-white">Booking Details</h2>
          <div className="flex items-center gap-2">
            <button onClick={() => onEditNotes(booking)} title="Bay & Notes"
              className="p-1.5 text-neutral-400 hover:text-[#FFD700] hover:bg-neutral-800 rounded-lg transition-colors">
              <Wrench className="w-4 h-4" />
            </button>
            <button onClick={onClose} className="text-neutral-400 hover:text-white p-1 rounded-lg hover:bg-neutral-800">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="p-6 space-y-4">
          {/* ID + Source + Status */}
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <span className="text-lg font-bold text-[#FFD700] break-all">{booking.id}</span>
            <div className="flex items-center gap-2 flex-wrap">
              {booking.source && (
                <span className="px-2 py-0.5 bg-neutral-800 border border-neutral-700 rounded-full text-[11px] text-neutral-400">
                  {SOURCE_LABELS[booking.source] || booking.source}
                </span>
              )}
              {statusBadge(booking.status)}
            </div>
          </div>

          {/* Customer note banner */}
          {note && (
            <div className={`flex items-start gap-2 px-3 py-2 rounded-lg border ${note.tag ? TAG_STYLE[note.tag] : 'bg-neutral-800 border-neutral-700'}`}>
              <span className="text-xs text-neutral-300">{note.tag ? `${TAG_LABEL[note.tag]} · ` : ''}{note.text}</span>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="flex items-start gap-2">
              <User className="w-4 h-4 text-[#FFD700] mt-0.5 flex-shrink-0" />
              <div className="min-w-0">
                <div className="text-xs text-neutral-500">Customer</div>
                <div className="text-sm text-white font-medium break-words">{booking.customer}</div>
                {historyCount > 0 && (
                  <button onClick={() => { onClose(); onViewHistory(booking); }}
                    className="mt-0.5 flex items-center gap-1 text-xs text-[#FFD700] hover:underline">
                    <History className="w-3 h-3" />{historyCount} past visit{historyCount !== 1 ? 's' : ''}
                  </button>
                )}
              </div>
            </div>
            <div className="flex items-start gap-2">
              <Car className="w-4 h-4 text-[#FFD700] mt-0.5 flex-shrink-0" />
              <div className="min-w-0">
                <div className="text-xs text-neutral-500">Vehicle</div>
                <div className="text-sm text-white font-mono break-words">{booking.vehicle || 'N/A'}</div>
              </div>
            </div>
            <div className="flex items-start gap-2">
              <Calendar className="w-4 h-4 text-[#FFD700] mt-0.5 flex-shrink-0" />
              <div className="min-w-0"><div className="text-xs text-neutral-500">Date</div><div className="text-sm text-white">{booking.date}</div></div>
            </div>
            <div className="flex items-start gap-2">
              <Clock className="w-4 h-4 text-[#FFD700] mt-0.5 flex-shrink-0" />
              <div className="min-w-0"><div className="text-xs text-neutral-500">Time</div><div className="text-sm text-white">{booking.timeSlot || 'N/A'}</div></div>
            </div>
            {booking.bay && (
              <div className="flex items-start gap-2">
                <Wrench className="w-4 h-4 text-[#FFD700] mt-0.5 flex-shrink-0" />
                <div className="min-w-0"><div className="text-xs text-neutral-500">Bay</div><div className="text-sm text-white">{booking.bay}</div></div>
              </div>
            )}
            <div className="flex items-start gap-2 col-span-1 md:col-span-2">
              <MapPin className="w-4 h-4 text-[#FFD700] mt-0.5 flex-shrink-0" />
              <div className="min-w-0"><div className="text-xs text-neutral-500">Service</div><div className="text-sm text-white break-words">{booking.service}</div></div>
            </div>
            {booking.notes && (
              <div className="flex items-start gap-2 col-span-1 md:col-span-2">
                <MessageSquare className="w-4 h-4 text-[#FFD700] mt-0.5 flex-shrink-0" />
                <div className="min-w-0"><div className="text-xs text-neutral-500">Notes</div><div className="text-sm text-neutral-300 break-words">{booking.notes}</div></div>
              </div>
            )}
          </div>

          {/* Status actions */}
          <div className="border-t border-neutral-800 pt-4">
            <div className="text-xs text-neutral-500 mb-3">Update Status</div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              {([
                { status: 'In Progress' as BookingStatus, color: 'blue',   icon: <PlayCircle className="w-3 h-3" />,  label: 'In Progress', short: 'Progress' },
                { status: 'Completed'   as BookingStatus, color: 'green',  icon: <CheckCircle className="w-3 h-3" />, label: 'Completed',   short: 'Done'     },
                { status: 'Cancelled'   as BookingStatus, color: 'red',    icon: <XCircle className="w-3 h-3" />,     label: 'Cancelled',   short: 'Cancel'   },
                { status: 'Waiting'     as BookingStatus, color: 'orange', icon: <List className="w-3 h-3" />,        label: 'Waiting',     short: 'Wait'     },
              ]).map(({ status, color, icon, label, short }) => (
                <button key={status} onClick={() => changeStatus(status)}
                  disabled={booking.status === status || loading !== null}
                  className={`py-2 px-2 md:px-3 bg-${color}-500/20 border border-${color}-500/30 text-${color}-400 rounded-lg text-xs font-medium hover:bg-${color}-500/30 transition-colors disabled:opacity-40 flex items-center justify-center gap-1.5`}>
                  {loading === status ? <RefreshCw className="w-3 h-3 animate-spin" /> : icon}
                  <span className="hidden sm:inline">{label}</span>
                  <span className="sm:hidden">{short}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// BOOKING NOTES + BAY MODAL
// ══════════════════════════════════════════════════════════════════════════════
export function BookingNotesModal({
  booking, onClose, onSave,
}: {
  booking: Booking;
  onClose: () => void;
  onSave:  (id: string, bay: string, notes: string) => void;
}) {
  const [bay,   setBay]   = useState(booking.bay   || '');
  const [notes, setNotes] = useState(booking.notes || '');

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-[55] p-4 backdrop-blur-sm">
      <div className="bg-neutral-900 rounded-xl border border-neutral-700 w-full max-w-md shadow-2xl">
        <div className="border-b border-neutral-700 px-5 py-4 flex justify-between items-center">
          <h2 className="font-bold text-white flex items-center gap-2"><Wrench className="w-4 h-4 text-[#FFD700]" />Bay & Notes</h2>
          <button onClick={onClose} className="text-neutral-400 hover:text-white p-1 rounded-lg hover:bg-neutral-800"><X className="w-4 h-4" /></button>
        </div>
        <div className="p-5 space-y-4">
          <div className="text-sm text-neutral-400">
            <span className="text-white font-medium">{booking.customer}</span> · {booking.service}
          </div>
          <div>
            <label className="text-xs font-medium text-neutral-400 block mb-1.5">Assign Bay</label>
            <div className="grid grid-cols-3 gap-2">
              {BAYS.map(b => (
                <button key={b} type="button" onClick={() => setBay(bay === b ? '' : b)}
                  className={`py-2 rounded-lg border text-xs font-medium transition-all ${bay === b ? 'bg-[#FFD700]/10 border-[#FFD700] text-[#FFD700]' : 'bg-neutral-800 border-neutral-700 text-neutral-400 hover:border-neutral-500'}`}>
                  {b}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="text-xs font-medium text-neutral-400 block mb-1.5">Internal Notes</label>
            <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={4}
              placeholder="Parts needed, customer preferences, special instructions…"
              className="w-full px-3 py-2.5 bg-neutral-800 border border-neutral-700 rounded-lg text-white text-sm focus:outline-none focus:border-[#FFD700] resize-none placeholder:text-neutral-600" />
          </div>
          <div className="flex gap-3">
            <button onClick={onClose} className="flex-1 px-4 py-2.5 border border-neutral-700 rounded-lg text-neutral-300 text-sm font-medium hover:bg-neutral-800">Cancel</button>
            <button onClick={() => { onSave(booking.id, bay, notes); onClose(); }}
              className="flex-1 px-4 py-2.5 bg-[#FFD700] rounded-lg text-black text-sm font-bold hover:bg-[#FFD700]/90">Save</button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// CALENDAR MODAL
// ══════════════════════════════════════════════════════════════════════════════
export function CalendarModal({ bookings, onClose }: { bookings: Booking[]; onClose: () => void }) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDay, setSelectedDay] = useState<number | null>(null);
  const year = currentDate.getFullYear(), month = currentDate.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDay    = new Date(year, month, 1).getDay();
  const today       = new Date();
  const isToday     = (d: number) => d === today.getDate() && month === today.getMonth() && year === today.getFullYear();

  const getBookingsForDay = (day: number) => {
    const ds = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    return bookings.filter(b => b.date === ds);
  };

  const dot: Record<BookingStatus, string> = {
    'Pending': 'bg-yellow-500', 'In Progress': 'bg-blue-500', 'Completed': 'bg-green-500',
    'Cancelled': 'bg-red-500', 'Waiting': 'bg-orange-500',
  };

  const selectedBookings = selectedDay ? getBookingsForDay(selectedDay) : [];

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4 backdrop-blur-sm overflow-y-auto">
      <div className="bg-neutral-900 rounded-xl border border-neutral-700 w-full max-w-5xl my-8 shadow-2xl">
        <div className="sticky top-0 bg-neutral-900 border-b border-neutral-700 px-6 py-4 flex justify-between items-center rounded-t-xl">
          <h2 className="text-xl font-bold text-white flex items-center gap-2"><Calendar className="w-5 h-5 text-[#FFD700]" />Calendar View</h2>
          <button onClick={onClose} className="text-neutral-400 hover:text-white p-1 rounded-lg hover:bg-neutral-800"><X className="w-5 h-5" /></button>
        </div>
        <div className="p-6 grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 bg-neutral-800 rounded-xl border border-neutral-700 p-5">
            <div className="flex items-center justify-between mb-5">
              <button onClick={() => setCurrentDate(new Date(year, month - 1, 1))} className="p-2 hover:bg-neutral-700 rounded-lg text-neutral-400 hover:text-white"><ChevronLeft className="w-5 h-5" /></button>
              <h3 className="text-lg font-bold text-white">{currentDate.toLocaleString('default', { month: 'long', year: 'numeric' })}</h3>
              <button onClick={() => setCurrentDate(new Date(year, month + 1, 1))} className="p-2 hover:bg-neutral-700 rounded-lg text-neutral-400 hover:text-white"><ChevronRight className="w-5 h-5" /></button>
            </div>
            <div className="grid grid-cols-7 gap-1 mb-2">
              {['Su','Mo','Tu','We','Th','Fr','Sa'].map(d => <div key={d} className="text-center text-xs font-semibold text-neutral-500 py-2">{d}</div>)}
            </div>
            <div className="grid grid-cols-7 gap-1">
              {Array.from({ length: firstDay }, (_, i) => <div key={`e-${i}`} />)}
              {Array.from({ length: daysInMonth }, (_, i) => i + 1).map(day => {
                const dbs = getBookingsForDay(day); const isSel = selectedDay === day;
                return (
                  <button key={day} onClick={() => setSelectedDay(day)}
                    className={`min-h-[60px] p-1.5 rounded-lg border transition-all text-left ${isSel ? 'bg-[#FFD700]/10 border-[#FFD700]' : isToday(day) ? 'border-[#FFD700]/40 bg-neutral-900' : 'border-neutral-700 bg-neutral-900 hover:border-neutral-600'}`}>
                    <div className={`text-xs font-bold mb-1 ${isToday(day) ? 'text-[#FFD700]' : 'text-white'}`}>{day}</div>
                    {dbs.slice(0, 3).map((b, i) => (
                      <div key={i} className="flex items-center gap-1"><div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${dot[b.status]}`} /><span className="text-[10px] text-neutral-400 truncate">{b.timeSlot || b.customer}</span></div>
                    ))}
                    {dbs.length > 3 && <div className="text-[10px] text-neutral-500">+{dbs.length - 3}</div>}
                  </button>
                );
              })}
            </div>
          </div>
          <div className="bg-neutral-800 rounded-xl border border-neutral-700 p-5">
            <h3 className="font-bold text-white mb-4">{selectedDay ? new Date(year, month, selectedDay).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' }) : 'Click a date'}</h3>
            {selectedDay && (selectedBookings.length === 0
              ? <div className="text-neutral-500 text-sm text-center py-8">No bookings</div>
              : <div className="space-y-3 max-h-[400px] overflow-y-auto">
                  {selectedBookings.map(b => (
                    <div key={b.id} className="p-3 bg-neutral-900 rounded-lg border border-neutral-700">
                      <div className="flex justify-between items-start mb-2 gap-2"><span className="text-sm font-semibold text-white">{b.timeSlot || '--:--'}</span>{statusBadge(b.status)}</div>
                      <div className="text-sm text-neutral-300">{b.customer}</div>
                      <div className="text-xs text-neutral-500 mt-1">{b.service}</div>
                    </div>
                  ))}
                </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// Need ChevronLeft/ChevronRight — add to import at top
import { ChevronLeft, ChevronRight } from 'lucide-react';

// ══════════════════════════════════════════════════════════════════════════════
// PRINT VIEW
// ══════════════════════════════════════════════════════════════════════════════
export function PrintView({ bookings, onClose }: { bookings: Booking[]; onClose: () => void }) {
  return (
    <div className="fixed inset-0 bg-white z-50 overflow-auto">
      <div className="print:hidden sticky top-0 bg-white border-b border-neutral-300 px-6 py-4 flex justify-between items-center shadow-sm">
        <h2 className="text-xl font-bold text-neutral-900">Print Preview</h2>
        <div className="flex gap-3">
          <button onClick={() => window.print()} className="flex items-center gap-2 px-4 py-2 bg-[#FFD700] rounded-lg text-black text-sm font-bold"><Printer className="w-4 h-4" />Print</button>
          <button onClick={onClose} className="flex items-center gap-2 px-4 py-2 border border-neutral-300 rounded-lg text-neutral-700 text-sm font-medium hover:bg-neutral-100"><X className="w-4 h-4" />Close</button>
        </div>
      </div>
      <div className="p-8 max-w-7xl mx-auto">
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold text-neutral-900 mb-2">Anura Tyres — Bookings Report</h1>
          <p className="text-neutral-600">Generated {new Date().toLocaleString()} · Total: {bookings.length}</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse border border-neutral-300 text-sm">
            <thead>
              <tr className="bg-neutral-100">
                {['ID','Date','Time','Customer','Vehicle','Service','Branch','Bay','Status','Source'].map(h =>
                  <th key={h} className="border border-neutral-300 px-3 py-3 text-left text-xs font-bold text-neutral-900">{h}</th>)}
              </tr>
            </thead>
            <tbody>
              {bookings.map((b, i) => (
                <tr key={b.id} className={i % 2 === 0 ? 'bg-white' : 'bg-neutral-50'}>
                  <td className="border border-neutral-300 px-3 py-2 text-xs font-mono">{b.id}</td>
                  <td className="border border-neutral-300 px-3 py-2 text-xs">{b.date}</td>
                  <td className="border border-neutral-300 px-3 py-2 text-xs">{b.timeSlot || 'N/A'}</td>
                  <td className="border border-neutral-300 px-3 py-2 text-xs font-medium">{b.customer}</td>
                  <td className="border border-neutral-300 px-3 py-2 text-xs font-mono">{b.vehicle || 'N/A'}</td>
                  <td className="border border-neutral-300 px-3 py-2 text-xs">{b.service}</td>
                  <td className="border border-neutral-300 px-3 py-2 text-xs">{b.branch || 'N/A'}</td>
                  <td className="border border-neutral-300 px-3 py-2 text-xs">{b.bay || '—'}</td>
                  <td className="border border-neutral-300 px-3 py-2 text-xs font-medium">{b.status}</td>
                  <td className="border border-neutral-300 px-3 py-2 text-xs capitalize">{b.source || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}