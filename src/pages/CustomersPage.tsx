// src/pages/CustomersPage.tsx
import { useState, useEffect, useRef, useMemo } from 'react';
import {
  Users, Search, Download, RefreshCw, AlertCircle, Loader2,
  Car, Calendar, Package, Activity, Shield, TrendingUp, X,
  Clock, MapPin, Phone, Mail,
  Wrench, FileText, Filter, Eye,
  BadgeCheck, AlertTriangle, BarChart2,
  Bell, Tag, ChevronLeft, ChevronRight, ChevronDown,
  Trash2, MessageSquare, Send,
  Check, Plus, Edit2, Save,
  DollarSign, Columns,
} from 'lucide-react';
import { getSessionUser } from '../lib/auth';

const API_URL = (import.meta.env.VITE_API_URL || 'https://anuratyres-backend-emm1774.vercel.app/api').replace(/\/$/, '');
const PAGE_SIZE = 25;

// ─── Types ────────────────────────────────────────────────────────────────────
type TagType = 'VIP' | 'Flagged' | 'Corporate' | 'Inactive';

interface Vehicle {
  id: string; plate: string; make: string; model: string;
  year: string; tyreSize: string; insuranceExpiry: string; revenueExpiry: string;
  mileage?: string; lastService?: string;
}
interface Order {
  id: string; date: string; total: number; status: string;
  fulfilment: string; items: { name: string; size: string; qty: number; price: number }[];
}
interface ActivityEvent {
  id: string; type: string; page?: string; item?: string;
  detail?: string; branch?: string; timestamp: any;
}
interface Booking {
  id: string; date: string; branch: string; services: string[];
  status: string; timeSlot: string; vehicleNo: string; total: number;
}
interface Customer {
  uid: string; name: string; email: string; phone: string;
  photoURL: string; emailVerified: boolean; provider: string;
  createdAt: string; lastLogin: string; disabled: boolean;
  vehicles: Vehicle[]; appointments: any[]; orders: Order[];
  activity: ActivityEvent[]; bookings: Booking[];
  stats: {
    vehicleCount: number; appointmentCount: number; orderCount: number;
    bookingCount: number; totalRevenue: number; lastActivity: string | null;
  };
}
interface Note { id: string; text: string; author: string; createdAt: string; }
interface CustomerInvoice {
  _id: string; invoiceNumber: string; customerName: string; date: string;
  total: number; paymentStatus: string; balance: number;
}
interface ColVis {
  tags: boolean; contact: boolean; vehicles: boolean;
  bookings: boolean; revenue: boolean; lastLogin: boolean; joined: boolean;
}

const DEFAULT_COLS: ColVis = {
  tags: true, contact: true, vehicles: true,
  bookings: true, revenue: true, lastLogin: true, joined: true,
};

const TAG_STYLES: Record<TagType, string> = {
  VIP:       'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  Corporate: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  Flagged:   'bg-red-500/20 text-red-400 border-red-500/30',
  Inactive:  'bg-neutral-700 text-neutral-400 border-neutral-600',
};
const TAG_ICONS: Record<TagType, string> = {
  VIP: '⭐', Corporate: '🏢', Flagged: '🚩', Inactive: '💤',
};

const STATUS_COLORS: Record<string, string> = {
  upcoming:  'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30',
  completed: 'bg-green-500/20 text-green-400 border border-green-500/30',
  cancelled: 'bg-red-500/20 text-red-400 border border-red-500/30',
  confirmed: 'bg-blue-500/20 text-blue-400 border border-blue-500/30',
  pending:   'bg-neutral-700 text-neutral-400 border border-neutral-600',
  delivered: 'bg-green-500/20 text-green-400 border border-green-500/30',
  paid:      'bg-green-500/20 text-green-400 border border-green-500/30',
  partial:   'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30',
  unpaid:    'bg-red-500/20 text-red-400 border border-red-500/30',
  overdue:   'bg-red-600/30 text-red-300 border border-red-600/40',
};

// ─── localStorage helpers ─────────────────────────────────────────────────────
function getTags(): Record<string, TagType[]> {
  try { return JSON.parse(localStorage.getItem('at_customer_tags') || '{}'); } catch { return {}; }
}
function saveTags(t: Record<string, TagType[]>) {
  localStorage.setItem('at_customer_tags', JSON.stringify(t));
}
function getNotes(): Record<string, Note[]> {
  try { return JSON.parse(localStorage.getItem('at_customer_notes') || '{}'); } catch { return {}; }
}
function saveNotes(n: Record<string, Note[]>) {
  localStorage.setItem('at_customer_notes', JSON.stringify(n));
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function daysUntil(d: string) {
  if (!d) return 999;
  return Math.ceil((new Date(d).getTime() - Date.now()) / 86400000);
}
function fmtDate(d: string) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}
function fmtDateTime(d: string) {
  if (!d) return '—';
  return new Date(d).toLocaleString('en-US', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}
function timeAgo(d: string) {
  if (!d) return '—';
  const diff = Date.now() - new Date(d).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}
function str(val: any): string {
  if (val === null || val === undefined) return '—';
  if (typeof val === 'string') return val;
  if (typeof val === 'number') return String(val);
  if (Array.isArray(val)) return val.map(str).filter(v => v && v !== '—').join(', ');
  if (typeof val === 'object') return val.name || val.title || val.label || val.id || '';
  return String(val);
}

const ACTIVITY_LABELS: Record<string, string> = {
  page_view: '👁 Viewed', service_view: '🔧 Viewed service',
  tyre_search: '🔍 Searched tyres', booking_started: '📅 Started booking',
  booking_completed: '✅ Completed booking', product_view: '📦 Viewed product',
  branch_view: '📍 Viewed branch', price_check: '💰 Checked price',
  offer_view: '🏷 Viewed offer',
};

function downloadCSV(filename: string, rows: string[][]): void {
  const csv  = rows.map(r => r.map(c => `"${String(c ?? '').replace(/"/g, '""')}"`).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

function Empty({ icon: Icon, label, sub }: { icon: any; label: string; sub?: string }) {
  return (
    <div className="py-16 text-center">
      <div className="w-14 h-14 rounded-2xl bg-neutral-800 border border-neutral-700 flex items-center justify-center mx-auto mb-4">
        <Icon className="w-6 h-6 text-neutral-600" />
      </div>
      <p className="text-neutral-400 font-semibold text-sm">{label}</p>
      {sub && <p className="text-neutral-600 text-xs mt-1.5 max-w-xs mx-auto">{sub}</p>}
    </div>
  );
}

// ─── Avatar ───────────────────────────────────────────────────────────────────
function Avatar({ customer, size = 'md' }: { customer: Customer; size?: 'sm' | 'md' | 'lg' | 'xl' }) {
  const sz = size === 'sm' ? 'w-8 h-8 text-xs' : size === 'lg' ? 'w-16 h-16 text-2xl'
    : size === 'xl' ? 'w-20 h-20 text-3xl' : 'w-10 h-10 text-sm';
  if (customer.photoURL)
    return <img src={customer.photoURL} className={`${sz} rounded-full object-cover ring-2 ring-[#FFD700]/20`} alt="" />;
  return (
    <div className={`${sz} rounded-full bg-gradient-to-br from-[#FFD700]/20 to-[#FFD700]/5 border border-[#FFD700]/20 flex items-center justify-center text-[#FFD700] font-black flex-shrink-0`}>
      {(customer.name || customer.email)[0].toUpperCase()}
    </div>
  );
}

// ─── Monthly Spend Chart ──────────────────────────────────────────────────────
function MonthlySpendChart({ bookings }: { bookings: Booking[] }) {
  const data = useMemo(() => {
    const now = new Date();
    const months = Array.from({ length: 6 }, (_, i) => {
      const d = new Date(now.getFullYear(), now.getMonth() - 5 + i, 1);
      return {
        key: `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`,
        label: d.toLocaleDateString('en-US', { month: 'short' }),
        total: 0,
      };
    });
    bookings.forEach(b => {
      if (!b.date || !b.total) return;
      const key = b.date.substring(0, 7);
      const idx = months.findIndex(x => x.key === key);
      if (idx >= 0) months[idx].total += b.total;
    });
    return months;
  }, [bookings]);

  const max = Math.max(...data.map(d => d.total), 1);
  const BAR = 28; const GAP = 12; const H = 72;

  return (
    <svg width={data.length * (BAR + GAP)} height={H + 24} className="overflow-visible">
      {data.map((d, i) => {
        const barH = Math.max((d.total / max) * H, 2);
        const x = i * (BAR + GAP);
        const isLast = i === data.length - 1;
        return (
          <g key={d.key}>
            <rect x={x} y={H - barH} width={BAR} height={barH} rx={4}
              fill={isLast ? '#FFD700' : '#ffffff18'} />
            <text x={x + BAR / 2} y={H + 16} textAnchor="middle"
              fill="#6b7280" fontSize="9" fontFamily="sans-serif">{d.label}</text>
            {d.total > 0 && (
              <text x={x + BAR / 2} y={H - barH - 3} textAnchor="middle"
                fill={isLast ? '#FFD700' : '#6b7280'} fontSize="8" fontFamily="sans-serif">
                {d.total >= 1000 ? `${(d.total / 1000).toFixed(1)}k` : d.total}
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}

// ─── Tag Picker ───────────────────────────────────────────────────────────────
function TagPicker({ uid, allTags, onChange }: {
  uid: string;
  allTags: Record<string, TagType[]>;
  onChange: (t: Record<string, TagType[]>) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const current = allTags[uid] || [];

  useEffect(() => {
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  const toggle = (tag: TagType) => {
    const next = { ...allTags };
    const cur = next[uid] || [];
    next[uid] = cur.includes(tag) ? cur.filter(t => t !== tag) : [...cur, tag];
    saveTags(next);
    onChange(next);
  };

  return (
    <div className="relative" ref={ref} onClick={e => e.stopPropagation()}>
      <button onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 px-3 py-1.5 bg-neutral-800 border border-neutral-700 rounded-xl text-neutral-400 hover:text-white text-xs font-bold transition-colors">
        <Tag className="w-3.5 h-3.5" />
        {current.length > 0 ? `${current.length} tag${current.length > 1 ? 's' : ''}` : 'Tag'}
      </button>
      {open && (
        <div className="absolute right-0 top-9 z-50 bg-neutral-900 border border-neutral-700 rounded-xl shadow-xl p-1.5 w-40">
          {(['VIP', 'Corporate', 'Flagged', 'Inactive'] as TagType[]).map(tag => (
            <button key={tag} onClick={() => toggle(tag)}
              className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium text-neutral-400 hover:bg-neutral-800 hover:text-white transition-colors">
              {TAG_ICONS[tag]} {tag}
              {current.includes(tag) && <Check className="w-3 h-3 ml-auto text-[#FFD700]" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Vehicle Jobs Panel ───────────────────────────────────────────────────────
function VehicleJobsPanel({ vehicle, bookings }: { vehicle: Vehicle; bookings: Booking[] }) {
  const [editing, setEditing] = useState(false);
  const [editData, setEditData] = useState({ mileage: vehicle.mileage || '', lastService: vehicle.lastService || '' });
  const plate = str(vehicle.plate);
  const vehicleBookings = bookings.filter(b => {
    const bp = str(b.vehicleNo).toLowerCase();
    const vp = plate.toLowerCase();
    return bp.includes(vp) || vp.includes(bp);
  });
  const insExpiry = str(vehicle.insuranceExpiry) !== '—' ? str(vehicle.insuranceExpiry) : '';
  const revExpiry = str(vehicle.revenueExpiry) !== '—' ? str(vehicle.revenueExpiry) : '';
  const insD = daysUntil(insExpiry);
  const revD = daysUntil(revExpiry);

  return (
    <div className="bg-neutral-900 border border-neutral-800 rounded-2xl overflow-hidden">
      <div className="p-4 border-b border-neutral-800 bg-neutral-950/50">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#FFD700]/10 border border-[#FFD700]/20 flex items-center justify-center">
              <Car className="w-5 h-5 text-[#FFD700]" />
            </div>
            <div>
              <p className="text-white font-bold">{plate}</p>
              <p className="text-neutral-500 text-xs">{str(vehicle.year)} {str(vehicle.make)} {str(vehicle.model)}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {vehicle.tyreSize && (
              <span className="text-xs font-mono bg-neutral-800 border border-neutral-700 px-2.5 py-1 rounded-lg text-neutral-300">
                {str(vehicle.tyreSize)}
              </span>
            )}
            <button onClick={() => setEditing(!editing)}
              className="p-1.5 rounded-lg bg-neutral-800 border border-neutral-700 text-neutral-400 hover:text-white transition-colors">
              <Edit2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {editing && (
          <div className="mt-3 grid grid-cols-2 gap-2">
            <div>
              <label className="text-[10px] text-neutral-500 font-bold uppercase tracking-wider">Mileage (km)</label>
              <input value={editData.mileage} onChange={e => setEditData(p => ({ ...p, mileage: e.target.value }))}
                placeholder="e.g. 45000"
                className="w-full mt-1 px-3 py-1.5 bg-neutral-800 border border-neutral-700 rounded-lg text-white text-xs focus:outline-none focus:border-[#FFD700]" />
            </div>
            <div>
              <label className="text-[10px] text-neutral-500 font-bold uppercase tracking-wider">Last Service</label>
              <input type="date" value={editData.lastService} onChange={e => setEditData(p => ({ ...p, lastService: e.target.value }))}
                className="w-full mt-1 px-3 py-1.5 bg-neutral-800 border border-neutral-700 rounded-lg text-white text-xs focus:outline-none focus:border-[#FFD700]" />
            </div>
            <button onClick={() => setEditing(false)}
              className="col-span-2 py-1.5 bg-[#FFD700] text-black text-xs font-bold rounded-lg hover:bg-[#FFD700]/90 transition-colors flex items-center justify-center gap-1">
              <Save className="w-3.5 h-3.5" /> Save
            </button>
          </div>
        )}

        {!editing && (editData.mileage || editData.lastService) && (
          <div className="flex gap-4 mt-2">
            {editData.mileage && <span className="text-[10px] text-neutral-500">🏎 {editData.mileage} km</span>}
            {editData.lastService && <span className="text-[10px] text-neutral-500">🔧 Last: {fmtDate(editData.lastService)}</span>}
          </div>
        )}

        <div className="flex gap-2 mt-3 flex-wrap">
          {insExpiry && (
            <span className={`text-[10px] px-2.5 py-1 rounded-lg border font-medium flex items-center gap-1 ${
              insD < 0 ? 'text-red-400 bg-red-500/10 border-red-500/20' :
              insD < 30 ? 'text-yellow-400 bg-yellow-500/10 border-yellow-500/20' :
              'text-green-400 bg-green-500/10 border-green-500/20'}`}>
              <Shield className="w-3 h-3" />
              Insurance: {insD < 0 ? `Expired ${Math.abs(insD)}d ago` : insD < 30 ? `${insD}d left` : fmtDate(insExpiry)}
            </span>
          )}
          {revExpiry && (
            <span className={`text-[10px] px-2.5 py-1 rounded-lg border font-medium flex items-center gap-1 ${
              revD < 0 ? 'text-red-400 bg-red-500/10 border-red-500/20' :
              revD < 30 ? 'text-yellow-400 bg-yellow-500/10 border-yellow-500/20' :
              'text-green-400 bg-green-500/10 border-green-500/20'}`}>
              <FileText className="w-3 h-3" />
              Revenue: {revD < 0 ? `Expired ${Math.abs(revD)}d ago` : revD < 30 ? `${revD}d left` : fmtDate(revExpiry)}
            </span>
          )}
        </div>
      </div>

      <div className="p-3">
        {vehicleBookings.length === 0 ? (
          <div className="py-8 text-center">
            <Wrench className="w-7 h-7 text-neutral-700 mx-auto mb-2" />
            <p className="text-neutral-600 text-xs">No jobs recorded for this vehicle</p>
          </div>
        ) : (
          <div className="space-y-2">
            <p className="text-[10px] font-bold text-neutral-600 uppercase tracking-wider px-1 mb-2">
              {vehicleBookings.length} Job{vehicleBookings.length !== 1 ? 's' : ''}
            </p>
            {vehicleBookings.map(b => (
              <div key={b.id} className="bg-neutral-800/60 rounded-xl p-3 border border-neutral-700/50">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-white text-xs font-semibold">{fmtDate(b.date)}</span>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${STATUS_COLORS[str(b.status)] || STATUS_COLORS.pending}`}>
                    {str(b.status)}
                  </span>
                </div>
                <p className="text-[#FFD700] text-xs font-medium mb-1">{str(b.branch)}</p>
                {b.services?.length > 0 && <p className="text-neutral-500 text-[10px]">{b.services.map(str).join(' · ')}</p>}
                {b.total > 0 && <p className="text-green-400 text-xs font-bold mt-1.5">Rs. {b.total.toLocaleString()}</p>}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Customer Detail Page ─────────────────────────────────────────────────────
type DetailTab = 'overview' | 'vehicles' | 'bookings' | 'orders' | 'activity' | 'notes' | 'reminders' | 'invoices';

function CustomerDetailPage({
  customer, onBack, allTags, onTagsChange,
}: {
  customer: Customer;
  onBack: () => void;
  allTags: Record<string, TagType[]>;
  onTagsChange: (t: Record<string, TagType[]>) => void;
}) {
  const [activeTab, setActiveTab] = useState<DetailTab>('overview');
  const [vehicleFilter, setVehicleFilter] = useState('all');
  const [bookingStatusFilter, setBookingStatusFilter] = useState('all');
  const [activityFrom, setActivityFrom] = useState('');
  const [activityTo, setActivityTo] = useState('');
  const [groupByDay, setGroupByDay] = useState(true);
  const [allNotes, setAllNotes] = useState<Record<string, Note[]>>(getNotes());
  const [newNote, setNewNote] = useState('');
  const [invoices, setInvoices] = useState<CustomerInvoice[]>([]);
  const [invoicesLoading, setInvoicesLoading] = useState(false);
  const [actionMsg, setActionMsg] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  const sessionUser = getSessionUser();
  const vehicles  = customer.vehicles  ?? [];
  const bookings  = customer.bookings  ?? [];
  const orders    = customer.orders    ?? [];
  const activity  = customer.activity  ?? [];
  const stats     = customer.stats     ?? { vehicleCount: 0, appointmentCount: 0, orderCount: 0, bookingCount: 0, totalRevenue: 0, lastActivity: null };
  const tags      = allTags[customer.uid] || [];
  const expirySoon = vehicles.some(v => daysUntil(str(v.insuranceExpiry)) < 30 || daysUntil(str(v.revenueExpiry)) < 30);
  const notes     = allNotes[customer.uid] || [];

  // Filtered bookings
  const filteredBookings = useMemo(() => {
    let b = vehicleFilter === 'all' ? bookings
      : bookings.filter(bk => str(bk.vehicleNo).toLowerCase().includes(vehicleFilter.toLowerCase()));
    if (bookingStatusFilter !== 'all')
      b = b.filter(bk => str(bk.status).toLowerCase() === bookingStatusFilter);
    return b;
  }, [bookings, vehicleFilter, bookingStatusFilter]);

  // Filtered activity
  const filteredActivity = useMemo(() => {
    return activity.filter(ev => {
      const ts = ev.timestamp?.toDate ? ev.timestamp.toDate().getTime() : new Date(ev.timestamp || 0).getTime();
      if (activityFrom && ts < new Date(activityFrom).getTime()) return false;
      if (activityTo   && ts > new Date(activityTo).getTime() + 86400000) return false;
      return true;
    });
  }, [activity, activityFrom, activityTo]);

  // Group activity by day
  const groupedActivity = useMemo(() => {
    if (!groupByDay) return null;
    const map: Record<string, ActivityEvent[]> = {};
    filteredActivity.forEach(ev => {
      const ts = ev.timestamp?.toDate ? ev.timestamp.toDate() : new Date(ev.timestamp || 0);
      const day = ts.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
      (map[day] = map[day] || []).push(ev);
    });
    return map;
  }, [filteredActivity, groupByDay]);

  // Top page visited
  const topPage = useMemo(() => {
    const counts: Record<string, number> = {};
    activity.forEach(a => { if (a.page) counts[a.page] = (counts[a.page] || 0) + 1; });
    return Object.entries(counts).sort((a, b) => b[1] - a[1])[0] || null;
  }, [activity]);

  // Reminders
  const reminders = useMemo(() => {
    const items: { type: string; label: string; detail: string; daysLeft: number; urgency: 'critical' | 'warning' | 'ok' }[] = [];
    vehicles.forEach(v => {
      const addItem = (type: string, expiry: string, label: string) => {
        if (!expiry || expiry === '—') return;
        const d = daysUntil(expiry);
        items.push({ type, label: `${str(v.plate)} — ${label}`, detail: `Expires ${fmtDate(expiry)}`, daysLeft: d,
          urgency: d < 0 ? 'critical' : d < 30 ? 'warning' : 'ok' });
      };
      addItem('insurance', str(v.insuranceExpiry), 'Insurance');
      addItem('revenue',   str(v.revenueExpiry),   'Revenue Licence');
    });
    bookings.filter(b => str(b.status).toLowerCase() === 'upcoming').forEach(b => {
      const d = daysUntil(b.date);
      items.push({ type: 'booking', label: `Upcoming — ${str(b.branch)}`,
        detail: `${fmtDate(b.date)}${b.timeSlot ? ` at ${str(b.timeSlot)}` : ''}`, daysLeft: d,
        urgency: d <= 1 ? 'warning' : 'ok' });
    });
    return items.sort((a, b) => a.daysLeft - b.daysLeft);
  }, [vehicles, bookings]);

  // Load invoices tab
  useEffect(() => {
    if (activeTab !== 'invoices') return;
    setInvoicesLoading(true);
    fetch(`${API_URL}/invoices`)
      .then(r => r.json())
      .then(d => {
        const all = d.invoices || [];
        const name = customer.name?.toLowerCase() || '';
        const email = customer.email?.toLowerCase() || '';
        setInvoices(all.filter((inv: any) =>
          (inv.customerName || '').toLowerCase().includes(name) ||
          (inv.customerEmail || '').toLowerCase() === email
        ));
      })
      .catch(() => setInvoices([]))
      .finally(() => setInvoicesLoading(false));
  }, [activeTab, customer.email, customer.name]);

  const addNote = () => {
    if (!newNote.trim()) return;
    const note: Note = {
      id: Date.now().toString(),
      text: newNote.trim(),
      author: (sessionUser as any)?.displayName || (sessionUser as any)?.username || 'Staff',
      createdAt: new Date().toISOString(),
    };
    const updated = { ...allNotes, [customer.uid]: [note, ...notes] };
    saveNotes(updated);
    setAllNotes(updated);
    setNewNote('');
  };

  const deleteNote = (noteId: string) => {
    const updated = { ...allNotes, [customer.uid]: notes.filter(n => n.id !== noteId) };
    saveNotes(updated);
    setAllNotes(updated);
  };

  const sendReminder = async () => {
    if (!customer.phone) { setActionMsg('No phone on record'); return; }
    setActionLoading(true);
    try {
      const expiring = vehicles.filter(v => daysUntil(str(v.insuranceExpiry)) < 30 || daysUntil(str(v.revenueExpiry)) < 30);
      const msg = expiring.length
        ? `Dear ${customer.name}, your vehicle document(s) are expiring soon. Please renew to avoid penalties. - Anura Tyres`
        : `Dear ${customer.name}, this is a service reminder from Anura Tyres. Please contact us to schedule your next service.`;
      const res = await fetch(`${API_URL}/bookings?action=send-sms`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ to: customer.phone, message: msg }),
      });
      const data = await res.json();
      setActionMsg(data.success ? 'SMS sent!' : 'Failed to send');
    } catch { setActionMsg('Failed to send'); }
    finally { setActionLoading(false); setTimeout(() => setActionMsg(''), 3000); }
  };

  const TABS: { id: DetailTab; label: string; icon: any; count?: number }[] = [
    { id: 'overview',  label: 'Overview',  icon: BarChart2 },
    { id: 'vehicles',  label: 'Vehicles',  icon: Car,          count: stats.vehicleCount },
    { id: 'bookings',  label: 'Bookings',  icon: Calendar,     count: stats.bookingCount },
    { id: 'orders',    label: 'Orders',    icon: Package,      count: stats.orderCount },
    { id: 'activity',  label: 'Activity',  icon: Activity,     count: activity.length },
    { id: 'notes',     label: 'Notes',     icon: MessageSquare, count: notes.length },
    { id: 'reminders', label: 'Reminders', icon: Bell,         count: reminders.filter(r => r.urgency !== 'ok').length },
    { id: 'invoices',  label: 'Invoices',  icon: DollarSign },
  ];

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-400">
      <button onClick={onBack} className="flex items-center gap-2 text-neutral-400 hover:text-white transition-colors text-sm font-medium group">
        <ChevronLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" /> Back to Customers
      </button>

      {/* Profile Hero */}
      <div className="bg-neutral-900 border border-neutral-800 rounded-2xl overflow-hidden">
        <div className="h-24 bg-gradient-to-r from-[#FFD700]/10 via-neutral-800/40 to-neutral-900 relative">
          <div className="absolute inset-0 opacity-20"
            style={{ backgroundImage: 'radial-gradient(circle at 20% 50%, #FFD700 0%, transparent 50%)' }} />
        </div>
        <div className="px-6 pb-6">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 -mt-10">
            <div className="flex items-end gap-4">
              <div className="ring-4 ring-neutral-900 rounded-full"><Avatar customer={customer} size="xl" /></div>
              <div className="pb-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <h1 className="text-2xl font-black text-white">{customer.name || '(no name)'}</h1>
                  {customer.emailVerified && <BadgeCheck className="w-5 h-5 text-[#FFD700]" />}
                  {expirySoon && (
                    <span className="text-[10px] font-bold px-2 py-1 rounded-full bg-yellow-500/10 border border-yellow-500/20 text-yellow-400">⚠ Expiry Alert</span>
                  )}
                  {tags.map(tag => (
                    <span key={tag} className={`text-[10px] font-bold px-2 py-1 rounded-full border ${TAG_STYLES[tag]}`}>
                      {TAG_ICONS[tag]} {tag}
                    </span>
                  ))}
                </div>
                <div className="flex items-center gap-4 mt-1.5 flex-wrap">
                  <span className="flex items-center gap-1.5 text-neutral-400 text-sm"><Mail className="w-3.5 h-3.5" />{customer.email}</span>
                  {customer.phone && <span className="flex items-center gap-1.5 text-neutral-400 text-sm"><Phone className="w-3.5 h-3.5" />{customer.phone}</span>}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2 pb-1 flex-wrap">
              <button onClick={sendReminder} disabled={actionLoading || !customer.phone}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-neutral-800 border border-neutral-700 rounded-xl text-neutral-300 text-xs font-bold hover:bg-neutral-700 transition-colors disabled:opacity-40">
                {actionLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                Send Reminder
              </button>
              {actionMsg && (
                <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${actionMsg.includes('sent') ? 'text-green-400 bg-green-500/10' : 'text-red-400 bg-red-500/10'}`}>
                  {actionMsg}
                </span>
              )}
              <TagPicker uid={customer.uid} allTags={allTags} onChange={onTagsChange} />
              <span className="text-xs font-bold px-3 py-1.5 rounded-full bg-neutral-800 border border-neutral-700 text-neutral-300">
                {customer.provider === 'google.com' ? '🔵 Google' : '📧 Email'}
              </span>
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mt-6">
            {[
              { label: 'Vehicles',    value: stats.vehicleCount,                        color: 'text-white',      icon: Car },
              { label: 'Bookings',    value: stats.bookingCount,                        color: 'text-[#FFD700]',  icon: Calendar },
              { label: 'Orders',      value: stats.orderCount,                          color: 'text-blue-400',   icon: Package },
              { label: 'Total Spent', value: `Rs.${(stats.totalRevenue||0).toLocaleString()}`, color: 'text-green-400', icon: TrendingUp },
              { label: 'Last Active', value: timeAgo(customer.lastLogin),               color: 'text-neutral-300', icon: Activity },
            ].map(s => (
              <div key={s.label} className="bg-neutral-800/50 rounded-xl p-3.5 border border-neutral-700/50">
                <s.icon className={`w-4 h-4 ${s.color} mb-2 opacity-60`} />
                <div className={`text-lg font-black ${s.color}`}>{s.value}</div>
                <div className="text-[10px] text-neutral-600 mt-0.5 uppercase tracking-wider font-medium">{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-neutral-900 border border-neutral-800 rounded-xl p-1.5 overflow-x-auto">
        {TABS.map(t => (
          <button key={t.id} onClick={() => setActiveTab(t.id)}
            className={`flex-shrink-0 flex items-center gap-1.5 py-2 px-2.5 text-xs font-bold rounded-lg transition-all ${
              activeTab === t.id ? 'bg-[#FFD700] text-black shadow-lg shadow-[#FFD700]/10'
                : 'text-neutral-500 hover:text-neutral-300 hover:bg-neutral-800'}`}>
            <t.icon className="w-3.5 h-3.5" />
            <span className="hidden md:inline">{t.label}</span>
            {t.count !== undefined && t.count > 0 && (
              <span className={`px-1.5 py-0.5 rounded-full text-[9px] font-black ${
                activeTab === t.id ? 'bg-black/20 text-black' : 'bg-neutral-800 text-neutral-500'}`}>{t.count}</span>
            )}
          </button>
        ))}
      </div>

      {/* ── OVERVIEW ── */}
      {activeTab === 'overview' && (
        <div className="space-y-4">
          {/* Next booking banner */}
          {(() => {
            const next = bookings.find(b => str(b.status).toLowerCase() === 'upcoming');
            if (!next) return null;
            return (
              <div className="bg-[#FFD700]/5 border border-[#FFD700]/20 rounded-2xl p-4 flex items-center gap-4">
                <div className="w-10 h-10 rounded-xl bg-[#FFD700]/20 flex items-center justify-center flex-shrink-0">
                  <Calendar className="w-5 h-5 text-[#FFD700]" />
                </div>
                <div className="flex-1">
                  <p className="text-[10px] text-[#FFD700]/70 font-bold uppercase tracking-wider">Next Booking</p>
                  <p className="text-white font-bold">{str(next.branch)}</p>
                  <p className="text-neutral-400 text-xs">{fmtDate(next.date)}{next.timeSlot ? ` · ${str(next.timeSlot)}` : ''}</p>
                </div>
                {daysUntil(next.date) >= 0 && (
                  <div className="text-right">
                    <p className="text-[#FFD700] font-black text-xl">{daysUntil(next.date)}</p>
                    <p className="text-neutral-500 text-[10px]">days away</p>
                  </div>
                )}
              </div>
            );
          })()}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Spend chart */}
            <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-5">
              <h3 className="text-sm font-bold text-white mb-1 flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-[#FFD700]" /> Monthly Spend
              </h3>
              <p className="text-xs text-neutral-600 mb-4">Last 6 months (Rs.)</p>
              {bookings.length === 0
                ? <p className="text-neutral-600 text-xs py-4">No spend data yet</p>
                : <MonthlySpendChart bookings={bookings} />}
            </div>

            {/* Account details */}
            <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-5">
              <h3 className="text-sm font-bold text-white mb-4 flex items-center gap-2">
                <Users className="w-4 h-4 text-[#FFD700]" /> Account Details
              </h3>
              <div className="space-y-3">
                {[
                  { label: 'UID', value: customer.uid, mono: true },
                  { label: 'Provider', value: customer.provider === 'google.com' ? 'Google OAuth' : 'Email / Password' },
                  { label: 'Email Verified', value: customer.emailVerified ? '✅ Verified' : '❌ Not verified' },
                  { label: 'Account Status', value: customer.disabled ? '🔴 Disabled' : '🟢 Active' },
                  { label: 'Registered', value: fmtDateTime(customer.createdAt) },
                  { label: 'Last Login', value: fmtDateTime(customer.lastLogin) },
                ].map(row => (
                  <div key={row.label} className="flex justify-between items-center py-2 border-b border-neutral-800/60 last:border-0">
                    <span className="text-neutral-500 text-xs">{row.label}</span>
                    <span className={`text-xs font-medium ${(row as any).mono ? 'font-mono text-neutral-400' : 'text-neutral-300'} max-w-[200px] truncate text-right`}>
                      {row.value}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Vehicles quick view */}
            <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-5">
              <h3 className="text-sm font-bold text-white mb-4 flex items-center gap-2">
                <Car className="w-4 h-4 text-[#FFD700]" /> Registered Vehicles
              </h3>
              {vehicles.length === 0 ? <Empty icon={Car} label="No vehicles added" /> : (
                <div className="space-y-2">
                  {vehicles.map(v => {
                    const hasAlert = daysUntil(v.insuranceExpiry) < 30 || daysUntil(v.revenueExpiry) < 30;
                    return (
                      <div key={v.id} className={`flex items-center justify-between p-3 rounded-xl border ${hasAlert ? 'border-yellow-500/30 bg-yellow-500/5' : 'border-neutral-800 bg-neutral-800/40'}`}>
                        <div className="flex items-center gap-3">
                          <Car className={`w-4 h-4 ${hasAlert ? 'text-yellow-400' : 'text-neutral-500'}`} />
                          <div>
                            <p className="text-white text-sm font-bold">{str(v.plate)}</p>
                            <p className="text-neutral-500 text-[10px]">{str(v.year)} {str(v.make)} {str(v.model)}</p>
                          </div>
                        </div>
                        {hasAlert && <span className="text-[10px] text-yellow-400">⚠ Expiry soon</span>}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Recent bookings */}
            <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-5">
              <h3 className="text-sm font-bold text-white mb-4 flex items-center gap-2">
                <Calendar className="w-4 h-4 text-[#FFD700]" /> Recent Bookings
              </h3>
              {bookings.length === 0 ? <Empty icon={Calendar} label="No bookings yet" /> : (
                <div className="space-y-2">
                  {bookings.slice(0, 4).map(b => (
                    <div key={b.id} className="flex items-center justify-between p-3 bg-neutral-800/40 rounded-xl border border-neutral-800">
                      <div>
                        <p className="text-white text-xs font-semibold">{str(b.branch)}</p>
                        <p className="text-neutral-600 text-[10px]">{fmtDate(b.date)}</p>
                      </div>
                      <div className="text-right">
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${STATUS_COLORS[str(b.status)] || STATUS_COLORS.pending}`}>
                          {str(b.status)}
                        </span>
                        {b.total > 0 && <p className="text-green-400 text-[10px] font-bold mt-1">Rs. {b.total.toLocaleString()}</p>}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── VEHICLES ── */}
      {activeTab === 'vehicles' && (
        <div className="space-y-4">
          {vehicles.length > 0 && bookings.length > 0 && (
            <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-3 flex items-center gap-2 flex-wrap">
              <Filter className="w-3.5 h-3.5 text-neutral-500" />
              <span className="text-xs font-bold text-neutral-500">Filter:</span>
              {['all', ...vehicles.map(v => str(v.plate))].map(v => (
                <button key={v} onClick={() => setVehicleFilter(v)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold font-mono transition-colors ${
                    vehicleFilter === v ? 'bg-[#FFD700] text-black' : 'bg-neutral-800 text-neutral-400 border border-neutral-700'}`}>
                  {v === 'all' ? 'All' : v}
                </button>
              ))}
            </div>
          )}
          {vehicles.length === 0
            ? <Empty icon={Car} label="No vehicles registered" sub="Customer hasn't added any vehicles yet" />
            : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {vehicles.filter(v => vehicleFilter === 'all' || vehicleFilter === str(v.plate)).map(v => (
                  <VehicleJobsPanel key={v.id} vehicle={v} bookings={bookings} />
                ))}
              </div>
            )}
        </div>
      )}

      {/* ── BOOKINGS ── */}
      {activeTab === 'bookings' && (
        <div className="space-y-3">
          {/* Status pills */}
          <div className="flex gap-2 flex-wrap">
            {['all', 'upcoming', 'confirmed', 'completed', 'cancelled'].map(s => (
              <button key={s} onClick={() => setBookingStatusFilter(s)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold capitalize transition-colors ${
                  bookingStatusFilter === s ? 'bg-[#FFD700] text-black' : 'bg-neutral-800 text-neutral-400 border border-neutral-700 hover:text-white'}`}>
                {s}
              </button>
            ))}
          </div>
          {/* Vehicle filter */}
          {vehicles.length > 0 && (
            <div className="flex gap-2 flex-wrap items-center">
              <span className="text-xs text-neutral-600 font-bold">Vehicle:</span>
              {['all', ...vehicles.map(v => str(v.plate))].map(v => (
                <button key={v} onClick={() => setVehicleFilter(v)}
                  className={`px-2.5 py-1 rounded-lg text-[10px] font-bold font-mono transition-colors ${
                    vehicleFilter === v ? 'bg-[#FFD700] text-black' : 'bg-neutral-800 text-neutral-400 border border-neutral-700'}`}>
                  {v === 'all' ? 'All' : v}
                </button>
              ))}
            </div>
          )}
          <div className="bg-neutral-900 border border-neutral-800 rounded-2xl overflow-hidden">
            {filteredBookings.length === 0
              ? <Empty icon={Calendar} label="No bookings found" />
              : (
                <div className="divide-y divide-neutral-800/60">
                  {filteredBookings.map(b => (
                    <div key={b.id} className="p-4 hover:bg-neutral-800/30 transition-colors">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1 flex-wrap">
                            <span className="text-white font-semibold text-sm">{str(b.branch)}</span>
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${STATUS_COLORS[str(b.status)] || STATUS_COLORS.pending}`}>
                              {str(b.status)}
                            </span>
                            {b.vehicleNo && (
                              <span className="text-[10px] font-mono text-[#FFD700]/70 bg-[#FFD700]/5 border border-[#FFD700]/10 px-2 py-0.5 rounded-full">
                                {str(b.vehicleNo)}
                              </span>
                            )}
                          </div>
                          <p className="text-neutral-500 text-xs flex items-center gap-1.5">
                            <Clock className="w-3 h-3" /> {fmtDate(b.date)}{b.timeSlot ? ` at ${str(b.timeSlot)}` : ''}
                          </p>
                          {b.services?.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-2">
                              {b.services.map((s, i) => (
                                <span key={i} className="text-[10px] px-2 py-0.5 bg-neutral-800 border border-neutral-700 rounded-full text-neutral-400">{str(s)}</span>
                              ))}
                            </div>
                          )}
                        </div>
                        <div className="text-right flex-shrink-0">
                          {b.total > 0 && <span className="text-green-400 font-black text-sm">Rs. {b.total.toLocaleString()}</span>}
                          <p className="text-neutral-700 text-[10px] font-mono mt-1">#{b.id.substring(0, 8).toUpperCase()}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
          </div>
        </div>
      )}

      {/* ── ORDERS ── */}
      {activeTab === 'orders' && (
        <div className="bg-neutral-900 border border-neutral-800 rounded-2xl overflow-hidden">
          {orders.length === 0 ? <Empty icon={Package} label="No orders yet" /> : (
            <div className="divide-y divide-neutral-800/60">
              {orders.map(o => (
                <div key={o.id} className="p-5 hover:bg-neutral-800/30 transition-colors">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <span className="text-white text-sm font-mono font-bold">#{o.id.substring(0, 8).toUpperCase()}</span>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${STATUS_COLORS[str(o.status)] || STATUS_COLORS.pending}`}>{str(o.status)}</span>
                    </div>
                    <span className="text-[#FFD700] font-black">Rs. {(o.total||0).toLocaleString()}</span>
                  </div>
                  <p className="text-neutral-600 text-xs mb-3">{fmtDate(o.date)} · {str(o.fulfilment)}</p>
                  <div className="space-y-1.5 bg-neutral-800/40 rounded-xl p-3 border border-neutral-800">
                    {o.items?.map((item, i) => (
                      <div key={i} className="flex justify-between text-xs">
                        <span className="text-neutral-400">{str(item.name)} <span className="text-[#FFD700]/50 font-mono">{str(item.size)}</span> ×{item.qty}</span>
                        <span className="text-neutral-300 font-medium">Rs. {(item.price * item.qty).toLocaleString()}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── ACTIVITY ── */}
      {activeTab === 'activity' && (
        <div className="space-y-3">
          <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-4 flex flex-wrap gap-3 items-center">
            <div className="flex items-center gap-2">
              <label className="text-xs text-neutral-500 font-bold">From</label>
              <input type="date" value={activityFrom} onChange={e => setActivityFrom(e.target.value)}
                className="px-2.5 py-1.5 bg-neutral-800 border border-neutral-700 rounded-lg text-white text-xs focus:outline-none focus:border-[#FFD700]" />
            </div>
            <div className="flex items-center gap-2">
              <label className="text-xs text-neutral-500 font-bold">To</label>
              <input type="date" value={activityTo} onChange={e => setActivityTo(e.target.value)}
                className="px-2.5 py-1.5 bg-neutral-800 border border-neutral-700 rounded-lg text-white text-xs focus:outline-none focus:border-[#FFD700]" />
            </div>
            {(activityFrom || activityTo) && (
              <button onClick={() => { setActivityFrom(''); setActivityTo(''); }} className="text-neutral-500 hover:text-white p-1"><X className="w-4 h-4" /></button>
            )}
            <button onClick={() => setGroupByDay(!groupByDay)}
              className={`ml-auto flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                groupByDay ? 'bg-[#FFD700] text-black' : 'bg-neutral-800 text-neutral-400 border border-neutral-700'}`}>
              Group by Day
            </button>
          </div>

          {topPage && (
            <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-3 flex items-center gap-3">
              <BarChart2 className="w-4 h-4 text-[#FFD700]" />
              <span className="text-xs text-neutral-400">Most visited: <span className="text-white font-bold">{topPage[0]}</span></span>
              <span className="ml-auto text-xs text-neutral-600">{topPage[1]} visits</span>
            </div>
          )}

          <div className="bg-neutral-900 border border-neutral-800 rounded-2xl overflow-hidden">
            {filteredActivity.length === 0
              ? <Empty icon={Activity} label="No activity recorded" sub="Activity appears when the customer browses while logged in" />
              : groupByDay && groupedActivity
                ? Object.entries(groupedActivity).map(([day, events]) => (
                    <div key={day}>
                      <div className="px-4 py-2 bg-neutral-950/60 border-b border-neutral-800 flex items-center gap-2">
                        <span className="text-[10px] font-bold text-neutral-500 uppercase tracking-wider">{day}</span>
                        <span className="text-[10px] text-neutral-700">({events.length} events)</span>
                      </div>
                      {events.map(a => (
                        <div key={a.id} className="flex items-start gap-4 p-4 hover:bg-neutral-800/20 transition-colors border-b border-neutral-800/30 last:border-0">
                          <div className="w-9 h-9 rounded-xl bg-neutral-800 border border-neutral-700 flex items-center justify-center flex-shrink-0 text-base">
                            {ACTIVITY_LABELS[a.type]?.split(' ')[0] || '📌'}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm text-white font-medium">
                              {ACTIVITY_LABELS[a.type]?.split(' ').slice(1).join(' ') || a.type}
                              {a.item && <span className="text-[#FFD700] ml-1.5">"{a.item}"</span>}
                            </p>
                            {a.page && <p className="text-xs text-neutral-600 mt-0.5">{a.page}</p>}
                          </div>
                          <span className="text-[10px] text-neutral-600 flex-shrink-0 font-mono">
                            {a.timestamp?.toDate ? timeAgo(a.timestamp.toDate().toISOString()) : '—'}
                          </span>
                        </div>
                      ))}
                    </div>
                  ))
                : (
                  <div className="divide-y divide-neutral-800/40">
                    {filteredActivity.map(a => (
                      <div key={a.id} className="flex items-start gap-4 p-4 hover:bg-neutral-800/20 transition-colors">
                        <div className="w-9 h-9 rounded-xl bg-neutral-800 border border-neutral-700 flex items-center justify-center flex-shrink-0 text-base">
                          {ACTIVITY_LABELS[a.type]?.split(' ')[0] || '📌'}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-white font-medium">
                            {ACTIVITY_LABELS[a.type]?.split(' ').slice(1).join(' ') || a.type}
                            {a.item && <span className="text-[#FFD700] ml-1.5">"{a.item}"</span>}
                          </p>
                          {a.page && <p className="text-xs text-neutral-600 mt-0.5">{a.page}</p>}
                          {a.branch && <p className="text-xs text-neutral-600 mt-0.5 flex items-center gap-1"><MapPin className="w-3 h-3" />{str(a.branch)}</p>}
                        </div>
                        <span className="text-[10px] text-neutral-600 flex-shrink-0 font-mono">
                          {a.timestamp?.toDate ? timeAgo(a.timestamp.toDate().toISOString()) : '—'}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
          </div>
        </div>
      )}

      {/* ── NOTES ── */}
      {activeTab === 'notes' && (
        <div className="space-y-4">
          <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-4">
            <h3 className="text-sm font-bold text-white mb-3 flex items-center gap-2">
              <MessageSquare className="w-4 h-4 text-[#FFD700]" /> Add Internal Note
            </h3>
            <div className="flex gap-2">
              <textarea value={newNote} onChange={e => setNewNote(e.target.value)}
                placeholder="e.g. Prefers morning slots, VIP client, called about quote #123..."
                rows={2}
                className="flex-1 px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-xl text-white text-sm focus:outline-none focus:border-[#FFD700] resize-none placeholder:text-neutral-600" />
              <button onClick={addNote} disabled={!newNote.trim()}
                className="px-4 py-2 bg-[#FFD700] text-black font-bold text-sm rounded-xl hover:bg-[#FFD700]/90 transition-colors disabled:opacity-40 flex items-center gap-1">
                <Plus className="w-4 h-4" /> Add
              </button>
            </div>
          </div>
          {notes.length === 0
            ? <Empty icon={MessageSquare} label="No notes yet" sub="Staff notes are private and only visible inside this portal" />
            : (
              <div className="space-y-3">
                {notes.map(note => (
                  <div key={note.id} className="bg-neutral-900 border border-neutral-800 rounded-2xl p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1">
                        <p className="text-white text-sm leading-relaxed">{note.text}</p>
                        <div className="flex items-center gap-3 mt-2">
                          <span className="text-[10px] text-[#FFD700]/70 font-bold">{note.author}</span>
                          <span className="text-[10px] text-neutral-600">{fmtDateTime(note.createdAt)}</span>
                        </div>
                      </div>
                      <button onClick={() => deleteNote(note.id)}
                        className="p-1.5 rounded-lg text-neutral-600 hover:text-red-400 hover:bg-red-500/10 transition-colors flex-shrink-0">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
        </div>
      )}

      {/* ── REMINDERS ── */}
      {activeTab === 'reminders' && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-xs text-neutral-500">Based on vehicle docs and upcoming bookings</p>
            {customer.phone && reminders.some(r => r.urgency !== 'ok') && (
              <button onClick={sendReminder} disabled={actionLoading}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-[#FFD700]/10 border border-[#FFD700]/20 text-[#FFD700] text-xs font-bold rounded-xl hover:bg-[#FFD700]/20 transition-colors">
                <Send className="w-3.5 h-3.5" /> Send SMS
              </button>
            )}
          </div>
          {reminders.length === 0
            ? <Empty icon={Bell} label="No reminders" sub="Reminders appear when docs are expiring or bookings are upcoming" />
            : reminders.map((r, i) => (
              <div key={i} className={`p-4 rounded-2xl border flex items-start gap-4 ${
                r.urgency === 'critical' ? 'bg-red-500/5 border-red-500/20' :
                r.urgency === 'warning'  ? 'bg-yellow-500/5 border-yellow-500/20' :
                'bg-neutral-900 border-neutral-800'}`}>
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 text-lg ${
                  r.urgency === 'critical' ? 'bg-red-500/10' : r.urgency === 'warning' ? 'bg-yellow-500/10' : 'bg-neutral-800'}`}>
                  {r.type === 'insurance' ? '🛡️' : r.type === 'revenue' ? '📄' : '📅'}
                </div>
                <div className="flex-1">
                  <p className={`font-bold text-sm ${r.urgency === 'critical' ? 'text-red-400' : r.urgency === 'warning' ? 'text-yellow-400' : 'text-white'}`}>
                    {r.label}
                  </p>
                  <p className="text-neutral-500 text-xs mt-0.5">{r.detail}</p>
                </div>
                <div className="text-right flex-shrink-0">
                  {r.daysLeft < 0
                    ? <span className="text-red-400 text-xs font-black">{Math.abs(r.daysLeft)}d overdue</span>
                    : r.daysLeft === 0
                      ? <span className="text-yellow-400 text-xs font-black">Today</span>
                      : <span className={`text-xs font-black ${r.urgency === 'warning' ? 'text-yellow-400' : 'text-neutral-400'}`}>{r.daysLeft}d left</span>
                  }
                </div>
              </div>
            ))}
        </div>
      )}

      {/* ── INVOICES ── */}
      {activeTab === 'invoices' && (
        <div className="bg-neutral-900 border border-neutral-800 rounded-2xl overflow-hidden">
          {invoicesLoading
            ? <div className="flex items-center justify-center py-16"><Loader2 className="w-6 h-6 text-[#FFD700] animate-spin" /></div>
            : invoices.length === 0
              ? <Empty icon={DollarSign} label="No invoices found" sub="Invoices matched by customer name will appear here" />
              : (
                <div className="divide-y divide-neutral-800/60">
                  {invoices.map(inv => (
                    <div key={inv._id} className="p-4 hover:bg-neutral-800/30 transition-colors">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="text-white font-bold font-mono">{inv.invoiceNumber}</p>
                          <p className="text-neutral-500 text-xs mt-0.5">{fmtDate(inv.date)}</p>
                        </div>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${STATUS_COLORS[(inv.paymentStatus || '').toLowerCase()] || STATUS_COLORS.pending}`}>
                          {inv.paymentStatus || 'Unpaid'}
                        </span>
                        <div className="text-right">
                          <p className="text-[#FFD700] font-black">Rs. {(inv.total||0).toLocaleString()}</p>
                          {inv.balance > 0 && <p className="text-red-400 text-[10px] mt-0.5">Balance: Rs. {inv.balance.toLocaleString()}</p>}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
        </div>
      )}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export function CustomersPage() {
  const [loading, setLoading]     = useState(true);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [error, setError]         = useState('');
  const [search, setSearch]       = useState('');
  const [filter, setFilter]       = useState<'all'|'active'|'google'|'email'|'inactive'>('all');
  const [sortBy, setSortBy]       = useState<'newest'|'lastLogin'|'bookings'|'revenue'>('newest');
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [exporting] = useState(false);
  const [page, setPage]           = useState(1);
  const [selected, setSelected]   = useState<Set<string>>(new Set());
  const [allTags, setAllTags]     = useState<Record<string, TagType[]>>(getTags());
  const [tagFilter, setTagFilter] = useState<TagType | 'all'>('all');
  const [colVis, setColVis]       = useState<ColVis>(DEFAULT_COLS);
  const [showColPicker, setShowColPicker]     = useState(false);
  const [showExportMenu, setShowExportMenu]   = useState(false);
  const colRef    = useRef<HTMLDivElement>(null);
  const exportRef = useRef<HTMLDivElement>(null);

  useEffect(() => { loadCustomers(); }, []);
  useEffect(() => { setPage(1); }, [search, filter, sortBy, tagFilter]);
  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (colRef.current    && !colRef.current.contains(e.target as Node))    setShowColPicker(false);
      if (exportRef.current && !exportRef.current.contains(e.target as Node)) setShowExportMenu(false);
    };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  const loadCustomers = async () => {
    setLoading(true); setError('');
    try {
      const res  = await fetch(`${API_URL}/customers`);
      const data = await res.json();
      if (!data.success) throw new Error(data.message || 'Failed to load');
      setCustomers(data.customers);
    } catch (err: any) {
      setError(err.message || 'Failed to load customers');
    } finally { setLoading(false); }
  };

  const filtered = useMemo(() => customers
    .filter(c => {
      const q = search.toLowerCase();
      const matchSearch = !q || c.name?.toLowerCase().includes(q) || c.email?.toLowerCase().includes(q)
        || c.phone?.toLowerCase().includes(q) || c.vehicles?.some(v => v.plate?.toLowerCase().includes(q));
      const matchFilter =
        filter === 'all'      ? true :
        filter === 'active'   ? !c.disabled :
        filter === 'google'   ? c.provider === 'google.com' :
        filter === 'email'    ? c.provider === 'password' :
        filter === 'inactive' ? Date.now() - new Date(c.lastLogin).getTime() > 90 * 86400000 : true;
      const matchTag = tagFilter === 'all' || (allTags[c.uid] || []).includes(tagFilter);
      return matchSearch && matchFilter && matchTag;
    })
    .sort((a, b) => {
      if (sortBy === 'newest')    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      if (sortBy === 'lastLogin') return new Date(b.lastLogin).getTime() - new Date(a.lastLogin).getTime();
      if (sortBy === 'bookings')  return b.stats.bookingCount - a.stats.bookingCount;
      if (sortBy === 'revenue')   return b.stats.totalRevenue - a.stats.totalRevenue;
      return 0;
    }), [customers, search, filter, sortBy, tagFilter, allTags]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginated  = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const totalRevenue    = customers.reduce((s, c) => s + (c.stats.totalRevenue || 0), 0);
  const totalBookings   = customers.reduce((s, c) => s + c.stats.bookingCount, 0);
  const newThisWeek     = customers.filter(c => Date.now() - new Date(c.createdAt).getTime() < 7 * 86400000).length;
  const expirySoonCount = customers.reduce((s, c) =>
    s + (c.vehicles || []).filter(v => daysUntil(v.insuranceExpiry) < 30 || daysUntil(v.revenueExpiry) < 30).length, 0);
  const expiringThisWeek = customers.filter(c =>
    (c.vehicles || []).some(v => { const d = daysUntil(v.insuranceExpiry); return d >= 0 && d <= 7; })
  ).length;
  const inactiveCount = customers.filter(c =>
    Date.now() - new Date(c.lastLogin).getTime() > 90 * 86400000
  ).length;

  const toggleSelect = (uid: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelected(prev => { const n = new Set(prev); n.has(uid) ? n.delete(uid) : n.add(uid); return n; });
  };
  const toggleAll = () => {
    setSelected(selected.size === paginated.length && paginated.length > 0
      ? new Set() : new Set(paginated.map(c => c.uid)));
  };

  const CSV_HEADER = ['Name','Email','Phone','Tags','Provider','Registered','Last Login','Vehicles','Bookings','Revenue (Rs.)'];
  const toRow = (c: Customer) => [
    c.name, c.email, c.phone || '—', (allTags[c.uid] || []).join(';'), c.provider,
    fmtDate(c.createdAt), fmtDate(c.lastLogin),
    String(c.stats.vehicleCount), String(c.stats.bookingCount), String(c.stats.totalRevenue),
  ];
  const runExport = (list: Customer[], label: string) => {
    downloadCSV(`anura_customers_${label}_${new Date().toISOString().split('T')[0]}.csv`,
      [CSV_HEADER, ...list.map(toRow)]);
    setShowExportMenu(false);
  };

  const tagCounts = (['VIP','Corporate','Flagged','Inactive'] as TagType[]).reduce((acc, tag) => {
    acc[tag] = customers.filter(c => (allTags[c.uid] || []).includes(tag)).length;
    return acc;
  }, {} as Record<TagType, number>);
  const inactiveTagCount = customers.filter(c =>
    Date.now() - new Date(c.lastLogin).getTime() > 90 * 86400000
  ).length;

  if (selectedCustomer) {
    return (
      <CustomerDetailPage
        customer={selectedCustomer}
        onBack={() => setSelectedCustomer(null)}
        allTags={allTags}
        onTagsChange={setAllTags}
      />
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold text-white mb-1">Customers</h2>
          <p className="text-neutral-500 text-sm">All registered website customers and their service history.</p>
        </div>
        <div className="flex gap-2">
          <button onClick={loadCustomers}
            className="flex items-center gap-2 px-4 py-2.5 bg-neutral-900 border border-neutral-700 rounded-xl text-neutral-300 text-sm font-medium hover:bg-neutral-800 hover:text-white transition-colors">
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> Refresh
          </button>
          {/* Export dropdown */}
          <div className="relative" ref={exportRef}>
            <button onClick={() => setShowExportMenu(!showExportMenu)}
              disabled={customers.length === 0}
              className="flex items-center gap-2 px-4 py-2.5 bg-neutral-900 border border-neutral-700 rounded-xl text-neutral-300 text-sm font-medium hover:bg-neutral-800 hover:text-white transition-colors disabled:opacity-50">
              {exporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
              Export
              <ChevronDown className="w-3.5 h-3.5 opacity-60" />
            </button>

            {showExportMenu && (
              <div className="absolute right-0 top-12 z-50 bg-neutral-900 border border-neutral-700 rounded-2xl shadow-2xl shadow-black/40 w-56 overflow-hidden">
                {/* Current view / selected */}
                <div className="px-3 pt-3 pb-1">
                  <p className="text-[10px] font-bold text-neutral-500 uppercase tracking-wider px-1 mb-1">Current View</p>
                  <button onClick={() => runExport(filtered, 'filtered')}
                    className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm text-neutral-300 hover:bg-neutral-800 hover:text-white transition-colors">
                    <Download className="w-3.5 h-3.5 text-neutral-500" />
                    All filtered
                    <span className="ml-auto text-[10px] text-neutral-600 font-mono">{filtered.length}</span>
                  </button>
                  {selected.size > 0 && (
                    <button onClick={() => runExport(customers.filter(c => selected.has(c.uid)), 'selected')}
                      className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm text-[#FFD700] hover:bg-[#FFD700]/10 transition-colors">
                      <Check className="w-3.5 h-3.5" />
                      Selected rows
                      <span className="ml-auto text-[10px] font-mono">{selected.size}</span>
                    </button>
                  )}
                </div>

                <div className="mx-3 my-2 border-t border-neutral-800" />

                {/* By tag */}
                <div className="px-3 pb-3">
                  <p className="text-[10px] font-bold text-neutral-500 uppercase tracking-wider px-1 mb-1">By Tag</p>
                  {([
                    { tag: 'VIP'      as TagType, icon: '⭐', color: 'text-yellow-400' },
                    { tag: 'Corporate'as TagType, icon: '🏢', color: 'text-blue-400'   },
                    { tag: 'Flagged'  as TagType, icon: '🚩', color: 'text-red-400'    },
                    { tag: 'Inactive' as TagType, icon: '💤', color: 'text-neutral-400' },
                  ]).map(({ tag, icon, color }) => {
                    const list = tag === 'Inactive'
                      ? customers.filter(c => Date.now() - new Date(c.lastLogin).getTime() > 90 * 86400000)
                      : customers.filter(c => (allTags[c.uid] || []).includes(tag));
                    const count = tag === 'Inactive' ? inactiveTagCount : tagCounts[tag];
                    return (
                      <button key={tag}
                        onClick={() => runExport(list, tag.toLowerCase())}
                        disabled={count === 0}
                        className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm hover:bg-neutral-800 transition-colors disabled:opacity-35 disabled:cursor-not-allowed">
                        <span className="text-base leading-none">{icon}</span>
                        <span className={`${color} font-medium`}>{tag}</span>
                        <span className="ml-auto text-[10px] text-neutral-600 font-mono">{count}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Expiry alert banner */}
      {expiringThisWeek > 0 && (
        <div className="flex items-center gap-3 p-4 bg-yellow-500/5 border border-yellow-500/20 rounded-2xl">
          <AlertTriangle className="w-5 h-5 text-yellow-400 flex-shrink-0" />
          <p className="text-yellow-400 text-sm font-medium">
            <span className="font-black">{expiringThisWeek}</span> customer{expiringThisWeek > 1 ? 's have' : ' has'} vehicle insurance expiring within 7 days.
          </p>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { icon: Users,      label: 'Total Customers', value: customers.length,                       color: 'text-white',     bg: 'bg-white/5' },
          { icon: Calendar,   label: 'Total Bookings',  value: totalBookings,                          color: 'text-[#FFD700]', bg: 'bg-[#FFD700]/5' },
          { icon: TrendingUp, label: 'Total Revenue',   value: `Rs. ${totalRevenue.toLocaleString()}`, color: 'text-green-400', bg: 'bg-green-500/5' },
          { icon: Shield, label: 'Expiry Alerts', value: expirySoonCount,
            color: expirySoonCount > 0 ? 'text-yellow-400' : 'text-neutral-500',
            bg: expirySoonCount > 0 ? 'bg-yellow-500/5' : 'bg-neutral-800/50' },
        ].map(s => (
          <div key={s.label} className={`${s.bg} border border-neutral-800 rounded-2xl p-5`}>
            <s.icon className={`w-5 h-5 ${s.color} mb-3 opacity-70`} />
            <div className={`text-2xl font-black ${s.color}`}>{s.value}</div>
            <div className="text-neutral-500 text-xs mt-1 font-medium">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-4 space-y-3">
        <div className="flex flex-col md:flex-row gap-3">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-2.5 w-4 h-4 text-neutral-500" />
            <input value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Search name, email, phone, plate..."
              className="w-full pl-9 pr-3 py-2 bg-neutral-800 border border-neutral-700 rounded-xl text-white text-sm focus:outline-none focus:border-[#FFD700] placeholder:text-neutral-600 transition-colors" />
          </div>
          <div className="flex gap-2 flex-wrap items-center">
            {([
              { val: 'all',      label: 'All' },
              { val: 'active',   label: 'Active' },
              { val: 'google',   label: '🔵 Google' },
              { val: 'email',    label: '📧 Email' },
              { val: 'inactive', label: `💤 Inactive (${inactiveCount})` },
            ] as const).map(f => (
              <button key={f.val} onClick={() => setFilter(f.val)}
                className={`px-3 py-2 rounded-xl text-xs font-bold transition-colors ${
                  filter === f.val ? 'bg-[#FFD700] text-black' : 'bg-neutral-800 text-neutral-400 hover:text-white border border-neutral-700'}`}>
                {f.label}
              </button>
            ))}
            <select value={sortBy} onChange={e => setSortBy(e.target.value as any)}
              className="px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-xl text-neutral-400 text-xs font-bold focus:outline-none focus:border-[#FFD700]">
              <option value="newest">Newest first</option>
              <option value="lastLogin">Last login</option>
              <option value="bookings">Most bookings</option>
              <option value="revenue">Most revenue</option>
            </select>
          </div>
        </div>

        {/* Tag filter row */}
        <div className="flex gap-2 items-center flex-wrap">
          <Tag className="w-3.5 h-3.5 text-neutral-500" />
          <span className="text-xs text-neutral-500 font-bold">Tags:</span>
          {(['all', 'VIP', 'Corporate', 'Flagged', 'Inactive'] as const).map(tag => (
            <button key={tag} onClick={() => setTagFilter(tag)}
              className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition-colors border ${
                tagFilter === tag
                  ? tag === 'all' ? 'bg-[#FFD700] text-black border-[#FFD700]'
                    : TAG_STYLES[tag as TagType]
                  : 'bg-neutral-800 text-neutral-500 border-neutral-700'}`}>
              {tag === 'all' ? 'All' : `${TAG_ICONS[tag as TagType]} ${tag}`}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="bg-neutral-900 border border-neutral-800 rounded-2xl overflow-hidden">
        <div className="px-5 py-4 border-b border-neutral-800 flex items-center gap-3 flex-wrap">
          <span className="text-sm font-bold text-white flex-1">
            {filtered.length} customer{filtered.length !== 1 ? 's' : ''}
            {search && <span className="text-neutral-500 font-normal ml-1">matching "{search}"</span>}
          </span>
          <div className="flex items-center gap-2">
            {newThisWeek > 0 && (
              <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-green-500/10 border border-green-500/20 text-green-400">
                +{newThisWeek} new this week
              </span>
            )}
            {selected.size > 0 && (
              <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-[#FFD700]/10 border border-[#FFD700]/20 text-[#FFD700]">
                {selected.size} selected
              </span>
            )}
            <div className="relative" ref={colRef}>
              <button onClick={() => setShowColPicker(!showColPicker)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-neutral-800 border border-neutral-700 rounded-xl text-neutral-400 hover:text-white text-xs font-bold transition-colors">
                <Columns className="w-3.5 h-3.5" /> Columns
              </button>
              {showColPicker && (
                <div className="absolute right-0 top-9 z-50 bg-neutral-900 border border-neutral-700 rounded-xl shadow-xl p-1.5 w-44">
                  {(Object.keys(DEFAULT_COLS) as (keyof ColVis)[]).map(col => (
                    <button key={col} onClick={() => setColVis(p => ({ ...p, [col]: !p[col] }))}
                      className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium text-neutral-400 hover:bg-neutral-800 hover:text-white transition-colors capitalize">
                      <div className={`w-3.5 h-3.5 rounded border flex items-center justify-center ${
                        colVis[col] ? 'bg-[#FFD700] border-[#FFD700]' : 'border-neutral-600'}`}>
                        {colVis[col] && <Check className="w-2.5 h-2.5 text-black" />}
                      </div>
                      {col === 'lastLogin' ? 'Last Login' : col.charAt(0).toUpperCase() + col.slice(1)}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <RefreshCw className="w-6 h-6 text-[#FFD700] animate-spin" />
          </div>
        ) : error ? (
          <div className="p-6 text-center">
            <AlertCircle className="w-10 h-10 text-red-400 mx-auto mb-3" />
            <p className="text-red-400 font-semibold text-sm">{error}</p>
            <button onClick={loadCustomers} className="mt-4 text-[#FFD700] text-xs hover:underline">Try again</button>
          </div>
        ) : filtered.length === 0 ? (
          <Empty icon={Users} label={customers.length === 0 ? 'No customers registered yet' : 'No customers match your search'} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-neutral-950 border-b border-neutral-800">
                  <th className="px-4 py-3.5">
                    <input type="checkbox" checked={selected.size === paginated.length && paginated.length > 0}
                      onChange={toggleAll} className="rounded border-neutral-600 bg-neutral-800 accent-[#FFD700]" />
                  </th>
                  <th className="px-5 py-3.5 text-left text-xs font-bold text-[#FFD700] uppercase tracking-wider">Customer</th>
                  {colVis.tags     && <th className="px-5 py-3.5 text-left text-xs font-bold text-[#FFD700] uppercase tracking-wider">Tags</th>}
                  {colVis.contact  && <th className="px-5 py-3.5 text-left text-xs font-bold text-[#FFD700] uppercase tracking-wider">Contact</th>}
                  {colVis.vehicles && <th className="px-5 py-3.5 text-left text-xs font-bold text-[#FFD700] uppercase tracking-wider">Vehicles</th>}
                  {colVis.bookings && <th className="px-5 py-3.5 text-left text-xs font-bold text-[#FFD700] uppercase tracking-wider">Bookings</th>}
                  {colVis.revenue  && <th className="px-5 py-3.5 text-left text-xs font-bold text-[#FFD700] uppercase tracking-wider">Revenue</th>}
                  {colVis.lastLogin && <th className="px-5 py-3.5 text-left text-xs font-bold text-[#FFD700] uppercase tracking-wider">Last Login</th>}
                  {colVis.joined   && <th className="px-5 py-3.5 text-left text-xs font-bold text-[#FFD700] uppercase tracking-wider">Joined</th>}
                  <th className="px-4 py-3.5" />
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-800/60">
                {paginated.map(c => {
                  const hasExpiry = (c.vehicles||[]).some(v => daysUntil(v.insuranceExpiry) < 30 || daysUntil(v.revenueExpiry) < 30);
                  const isInactive = Date.now() - new Date(c.lastLogin).getTime() > 90 * 86400000;
                  const cTags = allTags[c.uid] || [];
                  return (
                    <tr key={c.uid}
                      onClick={() => setSelectedCustomer(c)}
                      className={`hover:bg-neutral-800/40 transition-colors cursor-pointer group ${selected.has(c.uid) ? 'bg-[#FFD700]/5' : ''}`}>

                      <td className="px-4 py-4" onClick={e => toggleSelect(c.uid, e)}>
                        <input type="checkbox" checked={selected.has(c.uid)} onChange={() => {}}
                          className="rounded border-neutral-600 bg-neutral-800 accent-[#FFD700]" />
                      </td>

                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          <Avatar customer={c} size="sm" />
                          <div className="min-w-0">
                            <div className="text-white font-semibold text-sm truncate max-w-[140px] flex items-center gap-1.5">
                              {c.name || '(no name)'}
                              {hasExpiry  && <span className="text-yellow-400 text-xs">⚠</span>}
                              {isInactive && <span className="text-neutral-600 text-xs">💤</span>}
                            </div>
                            <div className="text-neutral-600 text-xs">{c.provider === 'google.com' ? '🔵' : '📧'} {c.emailVerified ? '✓' : ''}</div>
                          </div>
                        </div>
                      </td>

                      {colVis.tags && (
                        <td className="px-5 py-4">
                          <div className="flex gap-1">
                            {cTags.length === 0
                              ? <span className="text-neutral-700 text-[10px]">—</span>
                              : cTags.map(tag => (
                                <span key={tag} className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full border ${TAG_STYLES[tag]}`}>
                                  {TAG_ICONS[tag]}
                                </span>
                              ))}
                          </div>
                        </td>
                      )}

                      {colVis.contact && (
                        <td className="px-5 py-4">
                          <div className="text-neutral-400 text-xs truncate max-w-[160px]">{c.email}</div>
                          {c.phone && <div className="text-neutral-600 text-xs mt-0.5">{c.phone}</div>}
                        </td>
                      )}

                      {colVis.vehicles && (
                        <td className="px-5 py-4">
                          <span className="text-white font-bold">{c.stats.vehicleCount}</span>
                          {(c.vehicles||[]).slice(0, 1).map(v => (
                            <div key={v.id} className="text-[10px] text-neutral-600 font-mono mt-0.5">{str(v.plate)}</div>
                          ))}
                        </td>
                      )}

                      {colVis.bookings && (
                        <td className="px-5 py-4">
                          <span className={`font-bold ${c.stats.bookingCount > 0 ? 'text-[#FFD700]' : 'text-neutral-600'}`}>
                            {c.stats.bookingCount}
                          </span>
                        </td>
                      )}

                      {colVis.revenue && (
                        <td className="px-5 py-4">
                          <span className={`font-bold text-sm ${c.stats.totalRevenue > 0 ? 'text-green-400' : 'text-neutral-700'}`}>
                            {c.stats.totalRevenue > 0 ? `Rs. ${c.stats.totalRevenue.toLocaleString()}` : '—'}
                          </span>
                        </td>
                      )}

                      {colVis.lastLogin && (
                        <td className="px-5 py-4 text-neutral-500 text-xs">{timeAgo(c.lastLogin)}</td>
                      )}

                      {colVis.joined && (
                        <td className="px-5 py-4 text-neutral-600 text-xs">{fmtDate(c.createdAt)}</td>
                      )}

                      <td className="px-4 py-4">
                        <span className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1 text-[#FFD700] text-xs font-bold">
                          <Eye className="w-3.5 h-3.5" /> View
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {!loading && filtered.length > PAGE_SIZE && (
          <div className="px-5 py-3 border-t border-neutral-800 flex items-center justify-between gap-3">
            <span className="text-xs text-neutral-600">Page {page} of {totalPages} · {filtered.length} total</span>
            <div className="flex items-center gap-1">
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                className="p-1.5 rounded-lg bg-neutral-800 border border-neutral-700 text-neutral-400 hover:text-white disabled:opacity-40 transition-colors">
                <ChevronLeft className="w-4 h-4" />
              </button>
              {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
                const pg = Math.max(1, Math.min(totalPages - 4, page - 2)) + i;
                return (
                  <button key={pg} onClick={() => setPage(pg)}
                    className={`w-8 h-8 rounded-lg text-xs font-bold transition-colors ${
                      pg === page ? 'bg-[#FFD700] text-black' : 'bg-neutral-800 text-neutral-400 border border-neutral-700 hover:text-white'}`}>
                    {pg}
                  </button>
                );
              })}
              <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
                className="p-1.5 rounded-lg bg-neutral-800 border border-neutral-700 text-neutral-400 hover:text-white disabled:opacity-40 transition-colors">
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {!loading && filtered.length > 0 && filtered.length <= PAGE_SIZE && (
          <div className="px-5 py-3 border-t border-neutral-800 text-xs text-neutral-600">
            Showing {filtered.length} of {customers.length} customers · Click any row to view full details
          </div>
        )}
      </div>
    </div>
  );
}
