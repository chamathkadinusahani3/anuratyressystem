import React, { useState, useEffect } from 'react';
import { 
  Calendar, Plus, ChevronLeft, ChevronRight, X, 
  PlayCircle, CheckCircle, XCircle, Search, Filter,
  RefreshCw, Clock, MapPin, User, Phone, Mail, Car, Printer, List
} from 'lucide-react';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Badge } from '../components/ui/Badge';
import { Card, CardHeader, CardTitle } from '../components/ui/Card';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

// ─── Types ────────────────────────────────────────────────────────────────────
type BookingStatus = 'Pending' | 'In Progress' | 'Completed' | 'Cancelled' | 'Waiting';

interface Booking {
  id: string;
  date: string;
  customer: string;
  vehicle: string;
  service: string;
  status: BookingStatus;
  amount: string;
  timeSlot?: string;
  branch?: string;
  email?: string;
  phone?: string;
}

// ─── Data ─────────────────────────────────────────────────────────────────────

const BRANCHES = [
  {
    id: '1',
    name: 'Pannipitiya Branch',
    address: '278/2 High Level Rd, Pannipitiya',
    phone: '077 578 5785',
    hasFullService: true,
    maxBookingsPerSlot: 3
  },
  {
    id: '2',
    name: 'Ratnapura Branch',
    address: '151 Colombo Rd, Ratnapura',
    phone: '076 688 5885  ',
    hasFullService: false,
    maxBookingsPerSlot: 2
  },
  {
    id: '3',
    name: 'Kalawana Branch',
    address: 'Rathnapura road, Kalawana',
    phone: '0777 32 95 32  ',
    hasFullService: false,
    maxBookingsPerSlot: 2
  },
  {
    id: '4',
    name: 'Nivithigala Branch',
    address: 'Tiruwanaketiya-Agalawatte Rd, Nivithigala',
    phone: '045 227 9396',
    hasFullService: false,
    maxBookingsPerSlot: 2
  }
];


const SERVICE_CATEGORIES = [
  { id: 'Anura Tyres', label: 'Anura Tyres', description: 'Tyre fitting, balancing & alignment' },
  { id: 'Mechanix', label: 'Mechanix', description: 'Full mechanical services' },
  { id: 'Truck & Bus', label: 'Truck & Bus', description: 'Heavy vehicle services' },
];

const SERVICES = [
  { id: 't1', name: 'Wheel Alignment', category: 'Anura Tyres' },
  { id: 't2', name: 'Wheel Balancing', category: 'Anura Tyres' },
  { id: 't3', name: 'Tyre Change', category: 'Anura Tyres' },
  { id: 't4', name: 'Tyre Repair (Puncture)', category: 'Anura Tyres' },
  { id: 't5', name: 'Nitrogen Filling', category: 'Anura Tyres' },
  { id: 'm1', name: 'Full Service', category: 'Mechanix' },
  { id: 'm2', name: 'Oil Change', category: 'Mechanix' },
  { id: 'm3', name: 'Battery Check & Replace', category: 'Mechanix' },
  { id: 'm4', name: 'Brake Service', category: 'Mechanix' },
  { id: 'm5', name: 'AC Service', category: 'Mechanix' },
  { id: 'b1', name: 'Heavy Vehicle Alignment', category: 'Truck & Bus' },
  { id: 'b2', name: 'Truck Tyre Change', category: 'Truck & Bus' },
  { id: 'b3', name: 'Bus Full Service', category: 'Truck & Bus' },
];

const TIME_SLOTS = [
  '08:30', '09:00', '09:30', '10:00', '10:30', '11:00', '11:30', '12:00',
  '13:00', '13:30', '14:00', '14:30', '15:00', '15:30', '16:00', '16:30',
  '17:00', '17:30', '18:00', '18:30', '19:00'
];

// ─── Status Badge Helper ───────────────────────────────────────────────────────
function statusBadge(status: BookingStatus) {
  const map: Record<BookingStatus, string> = {
    'Pending': 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30',
    'In Progress': 'bg-blue-500/20 text-blue-400 border border-blue-500/30',
    'Completed': 'bg-green-500/20 text-green-400 border border-green-500/30',
    'Cancelled': 'bg-red-500/20 text-red-400 border border-red-500/30',
    'Waiting': 'bg-orange-500/20 text-orange-400 border border-orange-500/30',
  };
  return (
    <span className={`px-2 py-1 rounded-full text-xs font-medium whitespace-nowrap ${map[status]}`}>
      {status}
    </span>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// MANUAL BOOKING FORM MODAL
// ═══════════════════════════════════════════════════════════════════════════════
function ManualBookingModal({ onClose, onSuccess, existingBookings }: { 
  onClose: () => void; 
  onSuccess: () => void;
  existingBookings: Booking[];
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [availableSlots, setAvailableSlots] = useState<string[]>(TIME_SLOTS);
  const [form, setForm] = useState({
    branchId: '', category: '', serviceIds: [] as string[],
    date: '', timeSlot: '', name: '', email: '', phone: '', vehicleNo: ''
  });

  const branch = BRANCHES.find(b => b.id === form.branchId);
  const categories = branch?.hasFullService ? SERVICE_CATEGORIES : SERVICE_CATEGORIES.filter(c => c.id === 'Anura Tyres');
  const services = SERVICES.filter(s => s.category === form.category);

  // Check slot availability when branch or date changes
  useEffect(() => {
    if (form.branchId && form.date) {
      checkSlotAvailability();
    } else {
      setAvailableSlots(TIME_SLOTS);
    }
  }, [form.branchId, form.date, existingBookings]);

  const checkSlotAvailability = () => {
    if (!form.branchId || !form.date) return;
    
    const branch = BRANCHES.find(b => b.id === form.branchId);
    if (!branch) return;

    // Get bookings for this branch and date (excluding cancelled ones)
    const dateBookings = existingBookings.filter(
      b => b.branch === branch.name && b.date === form.date && b.status !== 'Cancelled'
    );

    // Count bookings per time slot
    const slotCounts = new Map<string, number>();
    dateBookings.forEach(b => {
      if (b.timeSlot) {
        slotCounts.set(b.timeSlot, (slotCounts.get(b.timeSlot) || 0) + 1);
      }
    });

    // Filter out fully booked slots
    const available = TIME_SLOTS.filter(slot => {
      const count = slotCounts.get(slot) || 0;
      return count < branch.maxBookingsPerSlot;
    });

    setAvailableSlots(available);
  };

  const toggle = (id: string) => setForm(f => ({
    ...f,
    serviceIds: f.serviceIds.includes(id) ? f.serviceIds.filter(x => x !== id) : [...f.serviceIds, id]
  }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.branchId) return setError('Please select a branch');
    if (!form.category) return setError('Please select a category');
    if (form.serviceIds.length === 0) return setError('Please select at least one service');
    if (!form.date) return setError('Please select a date');
    if (!form.timeSlot) return setError('Please select a time slot');

    setLoading(true);
    setError(null);
    try {
      const b = BRANCHES.find(b => b.id === form.branchId)!;
      const svcs = SERVICES.filter(s => form.serviceIds.includes(s.id));
      
      // Check if slot is still available
      if (!availableSlots.includes(form.timeSlot)) {
        throw new Error('This time slot is now fully booked. Please select another slot.');
      }

      const res = await fetch(`${API_URL}/bookings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          branch: { id: b.id, name: b.name, address: b.address, phone: b.phone },
          category: form.category,
          services: svcs.map(s => ({ id: s.id, name: s.name, category: s.category })),
          date: new Date(form.date),
          timeSlot: form.timeSlot,
          customer: { name: form.name, email: form.email, phone: form.phone, vehicleNo: form.vehicleNo }
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed');
      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to create booking');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4 backdrop-blur-sm overflow-y-auto">
      <div className="bg-neutral-900 rounded-xl border border-neutral-700 w-full max-w-2xl my-8 shadow-2xl">
        <div className="sticky top-0 bg-neutral-900 border-b border-neutral-700 px-4 md:px-6 py-4 flex justify-between items-center z-10 rounded-t-xl">
          <h2 className="text-lg md:text-xl font-bold text-white">Create New Booking</h2>
          <button onClick={onClose} className="text-neutral-400 hover:text-white p-1 rounded-lg hover:bg-neutral-800 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={submit} className="p-4 md:p-6 space-y-5">
          {error && <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm">{error}</div>}

          {/* Branch */}
          <div>
            <label className="text-sm font-medium text-white block mb-1.5">Branch *</label>
            <select value={form.branchId} onChange={e => setForm({...form, branchId: e.target.value, category: '', serviceIds: []})}
              className="w-full px-3 py-2.5 bg-neutral-800 border border-neutral-700 rounded-lg text-white text-sm focus:outline-none focus:border-[#FFD700] transition-colors" required>
              <option value="">Select a branch...</option>
              {BRANCHES.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          </div>

          {/* Category */}
          {form.branchId && (
            <div>
              <label className="text-sm font-medium text-white block mb-1.5">Category *</label>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                {categories.map(c => (
                  <button key={c.id} type="button"
                    onClick={() => setForm({...form, category: c.id, serviceIds: []})}
                    className={`p-3 rounded-lg border text-sm font-medium transition-all ${
                      form.category === c.id 
                        ? 'bg-[#FFD700]/10 border-[#FFD700] text-[#FFD700]' 
                        : 'bg-neutral-800 border-neutral-700 text-neutral-400 hover:border-neutral-500'}`}>
                    {c.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Services */}
          {form.category && (
            <div>
              <label className="text-sm font-medium text-white block mb-1.5">Services * (select one or more)</label>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2 max-h-60 overflow-y-auto">
                {services.map(s => (
                  <label key={s.id} className={`flex items-center gap-2.5 p-3 rounded-lg border cursor-pointer transition-all ${
                    form.serviceIds.includes(s.id)
                      ? 'bg-[#FFD700]/10 border-[#FFD700] text-white'
                      : 'bg-neutral-800 border-neutral-700 text-neutral-400 hover:border-neutral-600'}`}>
                    <input type="checkbox" checked={form.serviceIds.includes(s.id)} onChange={() => toggle(s.id)} className="w-4 h-4 accent-[#FFD700]" />
                    <span className="text-sm">{s.name}</span>
                  </label>
                ))}
              </div>
            </div>
          )}

          {/* Date & Time */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium text-white block mb-1.5">Date *</label>
              <input type="date" value={form.date} min={new Date().toISOString().split('T')[0]}
                onChange={e => setForm({...form, date: e.target.value, timeSlot: ''})}
                className="w-full px-3 py-2.5 bg-neutral-800 border border-neutral-700 rounded-lg text-white text-sm focus:outline-none focus:border-[#FFD700] transition-colors" required />
            </div>
            <div>
              <label className="text-sm font-medium text-white block mb-1.5">
                Time Slot * 
                {form.date && availableSlots.length < TIME_SLOTS.length && (
                  <span className="text-xs text-orange-400 ml-2">({TIME_SLOTS.length - availableSlots.length} slots full)</span>
                )}
              </label>
              <select value={form.timeSlot} onChange={e => setForm({...form, timeSlot: e.target.value})}
                className="w-full px-3 py-2.5 bg-neutral-800 border border-neutral-700 rounded-lg text-white text-sm focus:outline-none focus:border-[#FFD700] transition-colors" required
                disabled={!form.date || availableSlots.length === 0}>
                <option value="">Select time...</option>
                {availableSlots.length === 0 && form.date ? (
                  <option value="" disabled>All slots fully booked</option>
                ) : (
                  availableSlots.map(t => <option key={t} value={t}>{t}</option>)
                )}
              </select>
              {availableSlots.length === 0 && form.date && (
                <p className="text-xs text-orange-400 mt-1.5 flex items-start gap-1">
                  <AlertTriangle className="w-3 h-3 mt-0.5 flex-shrink-0" />
                  <span>All time slots are fully booked for this date. Please select another date.</span>
                </p>
              )}
            </div>
          </div>

          {/* Customer Details */}
          <div className="border-t border-neutral-800 pt-5">
            <h3 className="text-base font-bold text-white mb-4 flex items-center gap-2">
              <User className="w-4 h-4 text-[#FFD700]" /> Customer Details
            </h3>
            <div className="space-y-3">
              <div>
                <label className="text-sm font-medium text-white block mb-1.5">Full Name *</label>
                <input value={form.name} onChange={e => setForm({...form, name: e.target.value})} placeholder="e.g. Nimal Perera"
                  className="w-full px-3 py-2.5 bg-neutral-800 border border-neutral-700 rounded-lg text-white text-sm focus:outline-none focus:border-[#FFD700] transition-colors placeholder:text-neutral-600" required />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="text-sm font-medium text-white block mb-1.5">Phone *</label>
                  <input type="tel" value={form.phone} onChange={e => setForm({...form, phone: e.target.value})} placeholder="077 123 4567"
                    className="w-full px-3 py-2.5 bg-neutral-800 border border-neutral-700 rounded-lg text-white text-sm focus:outline-none focus:border-[#FFD700] transition-colors placeholder:text-neutral-600" required />
                </div>
                <div>
                  <label className="text-sm font-medium text-white block mb-1.5">Email *</label>
                  <input type="email" value={form.email} onChange={e => setForm({...form, email: e.target.value})} placeholder="email@example.com"
                    className="w-full px-3 py-2.5 bg-neutral-800 border border-neutral-700 rounded-lg text-white text-sm focus:outline-none focus:border-[#FFD700] transition-colors placeholder:text-neutral-600" required />
                </div>
              </div>
              <div>
                <label className="text-sm font-medium text-white block mb-1.5">Vehicle Number (Optional)</label>
                <input value={form.vehicleNo} onChange={e => setForm({...form, vehicleNo: e.target.value})} placeholder="e.g. CAB-1234"
                  className="w-full px-3 py-2.5 bg-neutral-800 border border-neutral-700 rounded-lg text-white text-sm focus:outline-none focus:border-[#FFD700] transition-colors placeholder:text-neutral-600" />
              </div>
            </div>
          </div>

          <div className="flex flex-col md:flex-row gap-3 pt-2">
            <button type="button" onClick={onClose} disabled={loading}
              className="flex-1 px-4 py-2.5 border border-neutral-700 rounded-lg text-neutral-300 text-sm font-medium hover:bg-neutral-800 transition-colors disabled:opacity-50">
              Cancel
            </button>
            <button type="submit" disabled={loading || (form.date && availableSlots.length === 0)}
              className="flex-1 px-4 py-2.5 bg-[#FFD700] rounded-lg text-black text-sm font-bold hover:bg-[#FFD700]/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2">
              {loading ? <><RefreshCw className="w-4 h-4 animate-spin" /> Creating...</> : 'Create Booking'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// Import AlertTriangle for the warning message
import { AlertTriangle } from 'lucide-react';

// ═══════════════════════════════════════════════════════════════════════════════
// CALENDAR VIEW MODAL
// ═══════════════════════════════════════════════════════════════════════════════
function CalendarModal({ bookings, onClose }: { bookings: Booking[]; onClose: () => void }) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDay, setSelectedDay] = useState<number | null>(null);

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDay = new Date(year, month, 1).getDay();

  const getBookingsForDay = (day: number) => {
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    return bookings.filter(b => b.date === dateStr);
  };

  const selectedBookings = selectedDay ? getBookingsForDay(selectedDay) : [];
  const today = new Date();
  const isToday = (day: number) => day === today.getDate() && month === today.getMonth() && year === today.getFullYear();

  const statusDot: Record<BookingStatus, string> = {
    'Pending': 'bg-yellow-500',
    'In Progress': 'bg-blue-500',
    'Completed': 'bg-green-500',
    'Cancelled': 'bg-red-500',
    'Waiting': 'bg-orange-500',
  };

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4 backdrop-blur-sm overflow-y-auto">
      <div className="bg-neutral-900 rounded-xl border border-neutral-700 w-full max-w-5xl my-8 shadow-2xl">
        <div className="sticky top-0 bg-neutral-900 border-b border-neutral-700 px-4 md:px-6 py-4 flex justify-between items-center rounded-t-xl">
          <h2 className="text-lg md:text-xl font-bold text-white flex items-center gap-2">
            <Calendar className="w-5 h-5 text-[#FFD700]" /> Calendar View
          </h2>
          <button onClick={onClose} className="text-neutral-400 hover:text-white p-1 rounded-lg hover:bg-neutral-800 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 md:p-6 grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Calendar Grid */}
          <div className="lg:col-span-2 bg-neutral-800 rounded-xl border border-neutral-700 p-4 md:p-5">
            <div className="flex items-center justify-between mb-5">
              <button onClick={() => setCurrentDate(new Date(year, month - 1, 1))}
                className="p-2 hover:bg-neutral-700 rounded-lg text-neutral-400 hover:text-white transition-colors">
                <ChevronLeft className="w-5 h-5" />
              </button>
              <h3 className="text-base md:text-lg font-bold text-white">
                {currentDate.toLocaleString('default', { month: 'long', year: 'numeric' })}
              </h3>
              <button onClick={() => setCurrentDate(new Date(year, month + 1, 1))}
                className="p-2 hover:bg-neutral-700 rounded-lg text-neutral-400 hover:text-white transition-colors">
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-7 gap-1 mb-2">
              {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map(d => (
                <div key={d} className="text-center text-xs font-semibold text-neutral-500 py-2">{d}</div>
              ))}
            </div>

            <div className="grid grid-cols-7 gap-1">
              {Array.from({ length: firstDay }, (_, i) => <div key={`e-${i}`} />)}
              {Array.from({ length: daysInMonth }, (_, i) => i + 1).map(day => {
                const dayBookings = getBookingsForDay(day);
                const isSelected = selectedDay === day;
                return (
                  <button key={day} onClick={() => setSelectedDay(day)}
                    className={`min-h-[60px] md:min-h-[72px] p-1.5 rounded-lg border transition-all text-left ${
                      isSelected ? 'bg-[#FFD700]/10 border-[#FFD700]' :
                      isToday(day) ? 'border-[#FFD700]/40 bg-neutral-900' :
                      'border-neutral-700 bg-neutral-900 hover:border-neutral-600'}`}>
                    <div className={`text-xs font-bold mb-1 ${isToday(day) ? 'text-[#FFD700]' : 'text-white'}`}>{day}</div>
                    <div className="space-y-0.5">
                      {dayBookings.slice(0, 3).map((b, i) => (
                        <div key={i} className="flex items-center gap-1">
                          <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${statusDot[b.status]}`} />
                          <span className="text-[10px] text-neutral-400 truncate">{b.timeSlot || b.customer}</span>
                        </div>
                      ))}
                      {dayBookings.length > 3 && <div className="text-[10px] text-neutral-500">+{dayBookings.length - 3} more</div>}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Day Details */}
          <div className="bg-neutral-800 rounded-xl border border-neutral-700 p-4 md:p-5">
            <h3 className="font-bold text-white mb-4 text-sm md:text-base">
              {selectedDay
                ? new Date(year, month, selectedDay).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })
                : 'Click a date to view bookings'}
            </h3>
            {selectedDay && (
              selectedBookings.length === 0
                ? <div className="text-neutral-500 text-sm text-center py-8">No bookings on this day</div>
                : <div className="space-y-3 max-h-[300px] md:max-h-[400px] overflow-y-auto">
                    {selectedBookings.map(b => (
                      <div key={b.id} className="p-3 bg-neutral-900 rounded-lg border border-neutral-700">
                        <div className="flex justify-between items-start mb-2 gap-2">
                          <span className="text-sm font-semibold text-white">{b.timeSlot || '--:--'}</span>
                          {statusBadge(b.status)}
                        </div>
                        <div className="text-sm text-neutral-300">{b.customer}</div>
                        <div className="text-xs text-neutral-500 mt-1">{b.service}</div>
                        <div className="text-xs text-neutral-600 mt-1">{b.id}</div>
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

// ═══════════════════════════════════════════════════════════════════════════════
// BOOKING DETAIL MODAL
// ═══════════════════════════════════════════════════════════════════════════════
function BookingDetailModal({ booking, onClose, onStatusChange }: {
  booking: Booking;
  onClose: () => void;
  onStatusChange: (id: string, status: BookingStatus) => void;
}) {
  const [loading, setLoading] = useState<BookingStatus | null>(null);

  const changeStatus = async (status: BookingStatus) => {
    setLoading(status);
    await onStatusChange(booking.id, status);
    setLoading(null);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
      <div className="bg-neutral-900 rounded-xl border border-neutral-700 w-full max-w-lg shadow-2xl">
        <div className="border-b border-neutral-700 px-4 md:px-6 py-4 flex justify-between items-center">
          <h2 className="text-lg md:text-xl font-bold text-white">Booking Details</h2>
          <button onClick={onClose} className="text-neutral-400 hover:text-white p-1 rounded-lg hover:bg-neutral-800 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 md:p-6 space-y-4">
          <div className="flex items-center justify-between gap-3">
            <span className="text-base md:text-lg font-bold text-[#FFD700] break-all">{booking.id}</span>
            {statusBadge(booking.status)}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="flex items-start gap-2">
              <User className="w-4 h-4 text-[#FFD700] mt-0.5 flex-shrink-0" />
              <div className="min-w-0">
                <div className="text-xs text-neutral-500">Customer</div>
                <div className="text-sm text-white font-medium break-words">{booking.customer}</div>
              </div>
            </div>
            <div className="flex items-start gap-2">
              <Car className="w-4 h-4 text-[#FFD700] mt-0.5 flex-shrink-0" />
              <div className="min-w-0">
                <div className="text-xs text-neutral-500">Vehicle</div>
                <div className="text-sm text-white break-words">{booking.vehicle || 'N/A'}</div>
              </div>
            </div>
            <div className="flex items-start gap-2">
              <Calendar className="w-4 h-4 text-[#FFD700] mt-0.5 flex-shrink-0" />
              <div className="min-w-0">
                <div className="text-xs text-neutral-500">Date</div>
                <div className="text-sm text-white">{booking.date}</div>
              </div>
            </div>
            <div className="flex items-start gap-2">
              <Clock className="w-4 h-4 text-[#FFD700] mt-0.5 flex-shrink-0" />
              <div className="min-w-0">
                <div className="text-xs text-neutral-500">Time</div>
                <div className="text-sm text-white">{booking.timeSlot || 'N/A'}</div>
              </div>
            </div>
            <div className="flex items-start gap-2 col-span-1 md:col-span-2">
              <MapPin className="w-4 h-4 text-[#FFD700] mt-0.5 flex-shrink-0" />
              <div className="min-w-0">
                <div className="text-xs text-neutral-500">Service</div>
                <div className="text-sm text-white break-words">{booking.service}</div>
              </div>
            </div>
          </div>

          <div className="border-t border-neutral-800 pt-4">
            <div className="text-xs text-neutral-500 mb-3">Update Status</div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              <button onClick={() => changeStatus('In Progress')} disabled={booking.status === 'In Progress' || loading !== null}
                className="py-2 px-2 md:px-3 bg-blue-500/20 border border-blue-500/30 text-blue-400 rounded-lg text-xs font-medium hover:bg-blue-500/30 transition-colors disabled:opacity-40 flex items-center justify-center gap-1.5">
                {loading === 'In Progress' ? <RefreshCw className="w-3 h-3 animate-spin" /> : <PlayCircle className="w-3 h-3" />}
                <span className="hidden sm:inline">In Progress</span>
                <span className="sm:hidden">Progress</span>
              </button>
              <button onClick={() => changeStatus('Completed')} disabled={booking.status === 'Completed' || loading !== null}
                className="py-2 px-2 md:px-3 bg-green-500/20 border border-green-500/30 text-green-400 rounded-lg text-xs font-medium hover:bg-green-500/30 transition-colors disabled:opacity-40 flex items-center justify-center gap-1.5">
                {loading === 'Completed' ? <RefreshCw className="w-3 h-3 animate-spin" /> : <CheckCircle className="w-3 h-3" />}
                <span className="hidden sm:inline">Completed</span>
                <span className="sm:hidden">Done</span>
              </button>
              <button onClick={() => changeStatus('Cancelled')} disabled={booking.status === 'Cancelled' || loading !== null}
                className="py-2 px-2 md:px-3 bg-red-500/20 border border-red-500/30 text-red-400 rounded-lg text-xs font-medium hover:bg-red-500/30 transition-colors disabled:opacity-40 flex items-center justify-center gap-1.5">
                {loading === 'Cancelled' ? <RefreshCw className="w-3 h-3 animate-spin" /> : <XCircle className="w-3 h-3" />}
                <span className="hidden sm:inline">Cancelled</span>
                <span className="sm:hidden">Cancel</span>
              </button>
              <button onClick={() => changeStatus('Waiting')} disabled={booking.status === 'Waiting' || loading !== null}
                className="py-2 px-2 md:px-3 bg-orange-500/20 border border-orange-500/30 text-orange-400 rounded-lg text-xs font-medium hover:bg-orange-500/30 transition-colors disabled:opacity-40 flex items-center justify-center gap-1.5">
                {loading === 'Waiting' ? <RefreshCw className="w-3 h-3 animate-spin" /> : <List className="w-3 h-3" />}
                <span className="hidden sm:inline">Waiting</span>
                <span className="sm:hidden">Wait</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// PRINT VIEW
// ═══════════════════════════════════════════════════════════════════════════════
function PrintView({ bookings, onClose }: { bookings: Booking[]; onClose: () => void }) {
  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 bg-white z-50 overflow-auto">
      {/* Screen-only controls */}
      <div className="print:hidden sticky top-0 bg-white border-b border-neutral-300 px-4 md:px-6 py-4 flex flex-col md:flex-row justify-between items-start md:items-center gap-3 shadow-sm">
        <h2 className="text-lg md:text-xl font-bold text-neutral-900">Print Preview</h2>
        <div className="flex gap-3">
          <button onClick={handlePrint}
            className="flex items-center gap-2 px-4 py-2 bg-[#FFD700] rounded-lg text-black text-sm font-bold hover:bg-[#FFD700]/90 transition-colors">
            <Printer className="w-4 h-4" /> Print
          </button>
          <button onClick={onClose}
            className="flex items-center gap-2 px-4 py-2 border border-neutral-300 rounded-lg text-neutral-700 text-sm font-medium hover:bg-neutral-100 transition-colors">
            <X className="w-4 h-4" /> Close
          </button>
        </div>
      </div>

      {/* Print content */}
      <div className="p-4 md:p-8 max-w-7xl mx-auto">
        <div className="mb-6 md:mb-8 text-center">
          <h1 className="text-2xl md:text-3xl font-bold text-neutral-900 mb-2">Anura Tyres - Bookings Report</h1>
          <p className="text-sm md:text-base text-neutral-600">Generated on {new Date().toLocaleString()}</p>
          <p className="text-sm md:text-base text-neutral-600 mt-1">Total Bookings: {bookings.length}</p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full border-collapse border border-neutral-300 text-sm">
            <thead>
              <tr className="bg-neutral-100">
                <th className="border border-neutral-300 px-2 md:px-4 py-2 md:py-3 text-left text-xs md:text-sm font-bold text-neutral-900">ID</th>
                <th className="border border-neutral-300 px-2 md:px-4 py-2 md:py-3 text-left text-xs md:text-sm font-bold text-neutral-900">Date</th>
                <th className="border border-neutral-300 px-2 md:px-4 py-2 md:py-3 text-left text-xs md:text-sm font-bold text-neutral-900">Time</th>
                <th className="border border-neutral-300 px-2 md:px-4 py-2 md:py-3 text-left text-xs md:text-sm font-bold text-neutral-900">Customer</th>
                <th className="border border-neutral-300 px-2 md:px-4 py-2 md:py-3 text-left text-xs md:text-sm font-bold text-neutral-900">Vehicle</th>
                <th className="border border-neutral-300 px-2 md:px-4 py-2 md:py-3 text-left text-xs md:text-sm font-bold text-neutral-900">Service</th>
                <th className="border border-neutral-300 px-2 md:px-4 py-2 md:py-3 text-left text-xs md:text-sm font-bold text-neutral-900">Branch</th>
                <th className="border border-neutral-300 px-2 md:px-4 py-2 md:py-3 text-left text-xs md:text-sm font-bold text-neutral-900">Status</th>
              </tr>
            </thead>
            <tbody>
              {bookings.map((booking, idx) => (
                <tr key={booking.id} className={idx % 2 === 0 ? 'bg-white' : 'bg-neutral-50'}>
                  <td className="border border-neutral-300 px-2 md:px-4 py-2 md:py-3 text-xs font-mono text-neutral-700">{booking.id}</td>
                  <td className="border border-neutral-300 px-2 md:px-4 py-2 md:py-3 text-xs md:text-sm text-neutral-900">{booking.date}</td>
                  <td className="border border-neutral-300 px-2 md:px-4 py-2 md:py-3 text-xs md:text-sm text-neutral-900">{booking.timeSlot || 'N/A'}</td>
                  <td className="border border-neutral-300 px-2 md:px-4 py-2 md:py-3 text-xs md:text-sm font-medium text-neutral-900">{booking.customer}</td>
                  <td className="border border-neutral-300 px-2 md:px-4 py-2 md:py-3 text-xs md:text-sm text-neutral-700">{booking.vehicle || 'N/A'}</td>
                  <td className="border border-neutral-300 px-2 md:px-4 py-2 md:py-3 text-xs md:text-sm text-neutral-700">{booking.service}</td>
                  <td className="border border-neutral-300 px-2 md:px-4 py-2 md:py-3 text-xs md:text-sm text-neutral-700">{booking.branch || 'N/A'}</td>
                  <td className="border border-neutral-300 px-2 md:px-4 py-2 md:py-3 text-xs md:text-sm font-medium text-neutral-900">{booking.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {bookings.length === 0 && (
          <div className="text-center py-8 text-neutral-500 text-sm md:text-base">No bookings to display</div>
        )}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN BOOKINGS PAGE
// ═══════════════════════════════════════════════════════════════════════════════
export function BookingsPage() {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [dateFilter, setDateFilter] = useState<string>('');
  const [showNewBooking, setShowNewBooking] = useState(false);
  const [showCalendar, setShowCalendar] = useState(false);
  const [showPrint, setShowPrint] = useState(false);
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);

  useEffect(() => { fetchBookings(); }, [statusFilter, dateFilter]);

  const fetchBookings = async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (statusFilter !== 'all') params.append('status', statusFilter);
      if (dateFilter) params.append('date', dateFilter);
      const res = await fetch(`${API_URL}/bookings?${params}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to fetch');
      setBookings(data.bookings || []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleStatusChange = async (id: string, status: BookingStatus) => {
    try {
      const res = await fetch(`${API_URL}/bookings/${id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status })
      });
      if (!res.ok) throw new Error('Failed to update');
      setBookings(prev => prev.map(b => b.id === id ? { ...b, status } : b));
    } catch (err: any) {
      alert('Failed to update status: ' + err.message);
    }
  };
  

  const filtered = bookings.filter(b =>
    (b.customer?.toLowerCase().includes(search.toLowerCase()) ||
     b.id?.toLowerCase().includes(search.toLowerCase()) ||
     b.vehicle?.toLowerCase().includes(search.toLowerCase())) ?? true
  );

  const stats = {
    total: bookings.length,
    pending: bookings.filter(b => b.status === 'Pending').length,
    inProgress: bookings.filter(b => b.status === 'In Progress').length,
    completed: bookings.filter(b => b.status === 'Completed').length,
    waiting: bookings.filter(b => b.status === 'Waiting').length,
  };

  return (
    <>
      <div className="space-y-4 md:space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h2 className="text-2xl md:text-3xl font-bold text-white mb-1">Bookings Management</h2>
            <p className="text-neutral-400 text-sm">View and manage all service appointments.</p>
          </div>
          <div className="flex flex-wrap gap-2 md:gap-3">
            <button onClick={() => setShowPrint(true)}
              className="flex items-center gap-2 px-3 md:px-4 py-2 border border-neutral-700 rounded-lg text-neutral-300 text-sm font-medium hover:bg-neutral-800 hover:text-white transition-colors">
              <Printer className="w-4 h-4" /> <span className="hidden sm:inline">Print</span>
            </button>
            <button onClick={() => setShowCalendar(true)}
              className="flex items-center gap-2 px-3 md:px-4 py-2 border border-neutral-700 rounded-lg text-neutral-300 text-sm font-medium hover:bg-neutral-800 hover:text-white transition-colors">
              <Calendar className="w-4 h-4" /> <span className="hidden sm:inline">Calendar</span>
            </button>
            <button onClick={() => setShowNewBooking(true)}
              className="flex items-center gap-2 px-3 md:px-4 py-2 bg-[#FFD700] rounded-lg text-black text-sm font-bold hover:bg-[#FFD700]/90 transition-colors">
              <Plus className="w-4 h-4" /> New
            </button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 md:gap-4">
          {[
            { label: 'Total', value: stats.total, color: 'text-white' },
            { label: 'Pending', value: stats.pending, color: 'text-yellow-400' },
            { label: 'In Progress', value: stats.inProgress, color: 'text-blue-400' },
            { label: 'Completed', value: stats.completed, color: 'text-green-400' },
            { label: 'Waiting', value: stats.waiting, color: 'text-orange-400' },
          ].map(s => (
            <div key={s.label} className="bg-neutral-900 border border-neutral-800 rounded-xl p-3 md:p-4">
              <div className={`text-xl md:text-2xl font-bold ${s.color}`}>{s.value}</div>
              <div className="text-neutral-500 text-xs md:text-sm mt-0.5">{s.label}</div>
            </div>
          ))}
        </div>

        {/* Table Card */}
        <div className="bg-neutral-900 border border-neutral-800 rounded-xl overflow-hidden">
          {/* Filters */}
          <div className="p-3 md:p-5 border-b border-neutral-800 space-y-3">
            <div className="flex flex-col md:flex-row gap-3">
              <div className="relative flex-1 max-w-full md:max-w-sm">
                <Search className="absolute left-3 top-2.5 w-4 h-4 text-neutral-500" />
                <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search customer, ID, vehicle..."
                  className="w-full pl-9 pr-3 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-white text-sm focus:outline-none focus:border-[#FFD700] placeholder:text-neutral-600 transition-colors" />
              </div>
              <div className="flex gap-2 items-center">
                <input type="date" value={dateFilter} onChange={e => setDateFilter(e.target.value)}
                  className="px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-white text-sm focus:outline-none focus:border-[#FFD700] transition-colors"
                  placeholder="Filter by date" />
                {dateFilter && (
                  <button onClick={() => setDateFilter('')}
                    className="px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-neutral-400 hover:text-white text-xs font-medium transition-colors whitespace-nowrap">
                    Clear
                  </button>
                )}
              </div>
            </div>
            <div className="flex gap-2 flex-wrap">
              {(['all', 'Pending', 'In Progress', 'Completed', 'Cancelled', 'Waiting'] as const).map(s => (
                <button key={s} onClick={() => setStatusFilter(s)}
                  className={`px-3 py-1.5 md:py-2 rounded-lg text-xs font-medium transition-colors whitespace-nowrap ${
                    statusFilter === s
                      ? 'bg-[#FFD700] text-black'
                      : 'bg-neutral-800 text-neutral-400 hover:bg-neutral-700 hover:text-white border border-neutral-700'}`}>
                  {s === 'all' ? 'All' : s}
                </button>
              ))}
              <button onClick={fetchBookings} disabled={loading}
                className="p-1.5 md:p-2 bg-neutral-800 border border-neutral-700 rounded-lg text-neutral-400 hover:text-white hover:bg-neutral-700 transition-colors">
                <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              </button>
            </div>
          </div>

          {/* Error */}
          {error && <div className="p-4 bg-red-500/10 border-b border-red-500/20 text-red-400 text-sm text-center">{error}</div>}

          {/* Loading */}
          {loading && (
            <div className="flex items-center justify-center py-16">
              <RefreshCw className="w-8 h-8 text-[#FFD700] animate-spin" />
            </div>
          )}

          {/* Empty */}
          {!loading && !error && filtered.length === 0 && (
            <div className="py-16 text-center">
              <div className="text-neutral-500 mb-3">No bookings found</div>
              <button onClick={fetchBookings} className="text-[#FFD700] text-sm hover:underline">Refresh</button>
            </div>
          )}

          {/* Table */}
          {!loading && filtered.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-neutral-950 border-b border-neutral-800">
                    {['Booking ID', 'Date', 'Customer', 'Vehicle', 'Service', 'Status', 'Actions'].map(h => (
                      <th key={h} className={`px-3 md:px-5 py-3 md:py-3.5 font-bold text-[#FFD700] text-left text-xs md:text-sm whitespace-nowrap ${h === 'Actions' ? 'text-right' : ''}`}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-800">
                  {filtered.map(booking => (
                    <tr key={booking.id} className="hover:bg-neutral-800/50 transition-colors cursor-pointer"
                      onClick={() => setSelectedBooking(booking)}>
                      <td className="px-3 md:px-5 py-3 md:py-4 font-mono font-medium text-white text-xs">{booking.id}</td>
                      <td className="px-3 md:px-5 py-3 md:py-4 text-neutral-400 text-xs whitespace-nowrap">{booking.date}</td>
                      <td className="px-3 md:px-5 py-3 md:py-4 text-white font-medium text-sm">{booking.customer}</td>
                      <td className="px-3 md:px-5 py-3 md:py-4 text-neutral-400 text-xs">{booking.vehicle || 'N/A'}</td>
                      <td className="px-3 md:px-5 py-3 md:py-4 text-neutral-300 text-xs max-w-[120px] md:max-w-[150px] truncate">{booking.service}</td>
                      <td className="px-3 md:px-5 py-3 md:py-4">{statusBadge(booking.status)}</td>
                      <td className="px-3 md:px-5 py-3 md:py-4 text-right" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-1 md:gap-1.5">
                          <button title="Start" onClick={() => handleStatusChange(booking.id, 'In Progress')}
                            disabled={booking.status === 'In Progress'}
                            className="p-1 md:p-1.5 rounded text-neutral-500 hover:text-[#FFD700] hover:bg-neutral-800 transition-colors disabled:opacity-30">
                            <PlayCircle className="w-3.5 h-3.5 md:w-4 md:h-4" />
                          </button>
                          <button title="Complete" onClick={() => handleStatusChange(booking.id, 'Completed')}
                            disabled={booking.status === 'Completed'}
                            className="p-1 md:p-1.5 rounded text-neutral-500 hover:text-green-400 hover:bg-neutral-800 transition-colors disabled:opacity-30">
                            <CheckCircle className="w-3.5 h-3.5 md:w-4 md:h-4" />
                          </button>
                          <button title="Cancel" onClick={() => handleStatusChange(booking.id, 'Cancelled')}
                            disabled={booking.status === 'Cancelled'}
                            className="p-1 md:p-1.5 rounded text-neutral-500 hover:text-red-400 hover:bg-neutral-800 transition-colors disabled:opacity-30">
                            <XCircle className="w-3.5 h-3.5 md:w-4 md:h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {!loading && filtered.length > 0 && (
            <div className="px-3 md:px-5 py-3 border-t border-neutral-800 text-xs text-neutral-500">
              Showing {filtered.length} of {bookings.length} bookings
            </div>
          )}
        </div>
      </div>

      {/* Modals */}
      {showNewBooking && <ManualBookingModal onClose={() => setShowNewBooking(false)} onSuccess={fetchBookings} existingBookings={bookings} />}
      {showCalendar && <CalendarModal bookings={bookings} onClose={() => setShowCalendar(false)} />}
      {showPrint && <PrintView bookings={filtered} onClose={() => setShowPrint(false)} />}
      {selectedBooking && (
        <BookingDetailModal
          booking={selectedBooking}
          onClose={() => setSelectedBooking(null)}
          onStatusChange={async (id, status) => { await handleStatusChange(id, status); setSelectedBooking(null); }}
        />
      )}
    </>
  );
}