// src/pages/CustomersPage.tsx
import React, { useState, useEffect } from 'react';
import {
  Users, Search, Download, RefreshCw, AlertCircle, Loader2,
  Car, Calendar, Package, Activity, Shield, TrendingUp, X,
  CheckCircle, Clock, MapPin,
} from 'lucide-react';

const API_URL = (import.meta.env.VITE_API_URL || 'https://anuratyres-backend-emm1774.vercel.app/api').replace(/\/$/, '');

// ─── Types ────────────────────────────────────────────────────────────────────
interface Vehicle {
  id: string; plate: string; make: string; model: string;
  year: string; tyreSize: string; insuranceExpiry: string; revenueExpiry: string;
}
interface Appointment {
  id: string; date: string; time: string; branch: string;
  services: string[]; status: string; bookingId: string;
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
  vehicles: Vehicle[]; appointments: Appointment[]; orders: Order[];
  activity: ActivityEvent[]; bookings: Booking[];
  stats: {
    vehicleCount: number; appointmentCount: number; orderCount: number;
    bookingCount: number; totalRevenue: number; lastActivity: string | null;
  };
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

const ACTIVITY_LABELS: Record<string, string> = {
  page_view: '👁 Viewed', service_view: '🔧 Viewed service',
  tyre_search: '🔍 Searched tyres', booking_started: '📅 Started booking',
  booking_completed: '✅ Completed booking', product_view: '📦 Viewed product',
  branch_view: '📍 Viewed branch', price_check: '💰 Checked price',
  offer_view: '🏷 Viewed offer',
};

const STATUS_COLORS: Record<string, string> = {
  upcoming:  'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30',
  completed: 'bg-green-500/20 text-green-400 border border-green-500/30',
  cancelled: 'bg-red-500/20 text-red-400 border border-red-500/30',
  confirmed: 'bg-blue-500/20 text-blue-400 border border-blue-500/30',
  pending:   'bg-neutral-700 text-neutral-400 border border-neutral-600',
  delivered: 'bg-green-500/20 text-green-400 border border-green-500/30',
};

function downloadCSV(filename: string, rows: string[][]): void {
  const csv  = rows.map(r => r.map(c => `"${String(c ?? '').replace(/"/g, '""')}"`).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}
function exportCustomersCSV(customers: Customer[]): void {
  const header = ['Name','Email','Phone','Provider','Registered','Last Login','Vehicles','Bookings','Orders','Revenue (Rs.)'];
  const rows   = customers.map(c => [
    c.name, c.email, c.phone || '—', c.provider,
    fmtDate(c.createdAt), fmtDate(c.lastLogin),
    String(c.stats.vehicleCount), String(c.stats.bookingCount),
    String(c.stats.orderCount), String(c.stats.totalRevenue),
  ]);
  downloadCSV(`anura_customers_${new Date().toISOString().split('T')[0]}.csv`, [header, ...rows]);
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
function Avatar({ customer, size = 'md' }: { customer: Customer; size?: 'sm' | 'md' | 'lg' }) {
  const sz = size === 'sm' ? 'w-8 h-8 text-xs' : size === 'lg' ? 'w-16 h-16 text-2xl' : 'w-10 h-10 text-sm';
  if (customer.photoURL) {
    return <img src={customer.photoURL} className={`${sz} rounded-full object-cover ring-2 ring-[#FFD700]/20`} alt="" />;
  }
  return (
    <div className={`${sz} rounded-full bg-gradient-to-br from-[#FFD700]/20 to-[#FFD700]/5 border border-[#FFD700]/20 flex items-center justify-center text-[#FFD700] font-black flex-shrink-0`}>
      {(customer.name || customer.email)[0].toUpperCase()}
    </div>
  );
}

// ─── Customer Drawer ──────────────────────────────────────────────────────────
function CustomerDrawer({ customer, onClose }: { customer: Customer; onClose: () => void }) {
  const [tab, setTab] = useState<'vehicles'|'appointments'|'orders'|'activity'>('vehicles');
  const expirySoon = customer.vehicles.some(v => daysUntil(v.insuranceExpiry) < 30 || daysUntil(v.revenueExpiry) < 30);

  return (
    <div className="fixed inset-0 z-50 flex">
      <div className="flex-1 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="w-full max-w-xl bg-neutral-950 border-l border-neutral-800 flex flex-col h-full shadow-2xl">

        {/* Header */}
        <div className="p-6 border-b border-neutral-800/80 bg-neutral-900/50">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-4">
              <Avatar customer={customer} size="lg" />
              <div>
                <h2 className="text-lg font-bold text-white">{customer.name || '(no name)'}</h2>
                <p className="text-neutral-400 text-sm mt-0.5">{customer.email}</p>
                <div className="flex items-center gap-2 mt-2 flex-wrap">
                  <span className="text-[10px] font-bold px-2 py-1 rounded-full bg-neutral-800 border border-neutral-700 text-neutral-400 uppercase tracking-wider">
                    {customer.provider === 'google.com' ? '🔵 Google' : '📧 Email'}
                  </span>
                  {customer.emailVerified && (
                    <span className="text-[10px] font-bold px-2 py-1 rounded-full bg-green-500/10 border border-green-500/20 text-green-400 uppercase tracking-wider">✓ Verified</span>
                  )}
                  {expirySoon && (
                    <span className="text-[10px] font-bold px-2 py-1 rounded-full bg-yellow-500/10 border border-yellow-500/20 text-yellow-400 uppercase tracking-wider">⚠ Expiry</span>
                  )}
                </div>
              </div>
            </div>
            <button onClick={onClose} className="text-neutral-600 hover:text-white transition-colors p-1.5 rounded-lg hover:bg-neutral-800">
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Stats row */}
          <div className="grid grid-cols-4 gap-3 mt-5">
            {[
              { label: 'Vehicles',   value: customer.stats.vehicleCount,  color: 'text-white' },
              { label: 'Bookings',   value: customer.stats.bookingCount,   color: 'text-[#FFD700]' },
              { label: 'Orders',     value: customer.stats.orderCount,     color: 'text-white' },
              { label: 'Revenue',    value: `Rs.${(customer.stats.totalRevenue||0).toLocaleString()}`, color: 'text-green-400' },
            ].map(s => (
              <div key={s.label} className="bg-neutral-800/60 rounded-xl p-3 text-center border border-neutral-700/50">
                <div className={`text-base font-black ${s.color}`}>{s.value}</div>
                <div className="text-[10px] text-neutral-500 mt-0.5 uppercase tracking-wider">{s.label}</div>
              </div>
            ))}
          </div>

          {/* Meta */}
          <div className="flex gap-4 mt-4 text-xs text-neutral-500">
            <span>📅 Joined {fmtDate(customer.createdAt)}</span>
            <span>🔐 {timeAgo(customer.lastLogin)}</span>
            {customer.phone && <span>📞 {customer.phone}</span>}
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-neutral-800 bg-neutral-900/30">
          {([
            { id: 'vehicles',     label: 'Vehicles',     count: customer.stats.vehicleCount },
            { id: 'appointments', label: 'Appts',         count: customer.stats.appointmentCount },
            { id: 'orders',       label: 'Orders',        count: customer.stats.orderCount },
            { id: 'activity',     label: 'Activity',      count: customer.activity.length },
          ] as const).map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={`flex-1 flex items-center justify-center gap-1.5 py-3.5 text-xs font-bold border-b-2 transition-all ${
                tab === t.id
                  ? 'border-[#FFD700] text-[#FFD700]'
                  : 'border-transparent text-neutral-500 hover:text-neutral-300'
              }`}>
              {t.label}
              {t.count > 0 && (
                <span className={`px-1.5 py-0.5 rounded-full text-[9px] font-black ${
                  tab === t.id ? 'bg-[#FFD700]/20 text-[#FFD700]' : 'bg-neutral-800 text-neutral-500'
                }`}>{t.count}</span>
              )}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {tab === 'vehicles' && (
            customer.vehicles.length === 0
              ? <Empty icon={Car} label="No vehicles added" />
              : customer.vehicles.map(v => {
                  const insD = daysUntil(v.insuranceExpiry);
                  const revD = daysUntil(v.revenueExpiry);
                  return (
                    <div key={v.id} className="bg-neutral-900 border border-neutral-800 rounded-xl p-4 hover:border-neutral-700 transition-colors">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-xl bg-[#FFD700]/10 border border-[#FFD700]/20 flex items-center justify-center">
                            <Car className="w-4 h-4 text-[#FFD700]" />
                          </div>
                          <div>
                            <p className="text-white font-bold text-sm">{v.plate}</p>
                            <p className="text-neutral-500 text-xs">{v.year} {v.make} {v.model}</p>
                          </div>
                        </div>
                        {v.tyreSize && <span className="text-[10px] font-mono bg-neutral-800 border border-neutral-700 px-2 py-1 rounded-lg text-neutral-400">{v.tyreSize}</span>}
                      </div>
                      <div className="flex gap-2 flex-wrap">
                        {v.insuranceExpiry && (
                          <span className={`text-[10px] px-2.5 py-1 rounded-lg border font-medium ${
                            insD < 0 ? 'text-red-400 bg-red-500/10 border-red-500/20' :
                            insD < 30 ? 'text-yellow-400 bg-yellow-500/10 border-yellow-500/20' :
                            'text-green-400 bg-green-500/10 border-green-500/20'
                          }`}>
                            🛡 {insD < 0 ? `Expired ${Math.abs(insD)}d ago` : insD < 30 ? `${insD}d left` : fmtDate(v.insuranceExpiry)}
                          </span>
                        )}
                        {v.revenueExpiry && (
                          <span className={`text-[10px] px-2.5 py-1 rounded-lg border font-medium ${
                            revD < 0 ? 'text-red-400 bg-red-500/10 border-red-500/20' :
                            revD < 30 ? 'text-yellow-400 bg-yellow-500/10 border-yellow-500/20' :
                            'text-green-400 bg-green-500/10 border-green-500/20'
                          }`}>
                            📄 {revD < 0 ? `Expired ${Math.abs(revD)}d ago` : revD < 30 ? `${revD}d left` : fmtDate(v.revenueExpiry)}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })
          )}

          {tab === 'appointments' && (
            customer.appointments.length === 0
              ? <Empty icon={Calendar} label="No appointments yet" />
              : customer.appointments.map(a => (
                  <div key={a.id} className="bg-neutral-900 border border-neutral-800 rounded-xl p-4 hover:border-neutral-700 transition-colors">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2 mb-1.5">
                          <p className="text-white font-semibold text-sm">{a.branch}</p>
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${STATUS_COLORS[a.status] || STATUS_COLORS.pending}`}>
                            {a.status}
                          </span>
                        </div>
                        <p className="text-neutral-500 text-xs flex items-center gap-1.5">
                          <Clock className="w-3 h-3" /> {fmtDate(a.date)} {a.time && `at ${a.time}`}
                        </p>
                        {a.services?.length > 0 && (
                          <p className="text-neutral-600 text-xs mt-1">{a.services.join(', ')}</p>
                        )}
                      </div>
                      <span className="text-[10px] font-mono text-neutral-600 bg-neutral-800 px-2 py-1 rounded-lg">#{a.bookingId}</span>
                    </div>
                  </div>
                ))
          )}

          {tab === 'orders' && (
            customer.orders.length === 0
              ? <Empty icon={Package} label="No orders yet" />
              : customer.orders.map(o => (
                  <div key={o.id} className="bg-neutral-900 border border-neutral-800 rounded-xl p-4 hover:border-neutral-700 transition-colors">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <span className="text-white text-sm font-mono">#{o.id.substring(0, 8).toUpperCase()}</span>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${STATUS_COLORS[o.status] || STATUS_COLORS.pending}`}>
                          {o.status}
                        </span>
                      </div>
                      <span className="text-[#FFD700] font-black text-sm">Rs. {(o.total||0).toLocaleString()}</span>
                    </div>
                    <p className="text-neutral-600 text-xs">{fmtDate(o.date)} · {o.fulfilment}</p>
                    {o.items?.map((item, i) => (
                      <div key={i} className="flex justify-between text-xs text-neutral-500 mt-1.5">
                        <span>{item.name} <span className="text-[#FFD700]/50 font-mono">{item.size}</span> ×{item.qty}</span>
                        <span>Rs. {(item.price * item.qty).toLocaleString()}</span>
                      </div>
                    ))}
                  </div>
                ))
          )}

          {tab === 'activity' && (
            customer.activity.length === 0
              ? <Empty icon={Activity} label="No activity yet" sub="Activity appears when customer browses while logged in" />
              : customer.activity.map(a => (
                  <div key={a.id} className="flex items-start gap-3 py-3 border-b border-neutral-800/60 last:border-0">
                    <div className="w-8 h-8 rounded-xl bg-neutral-800 border border-neutral-700 flex items-center justify-center flex-shrink-0 text-sm">
                      {ACTIVITY_LABELS[a.type]?.split(' ')[0] || '📌'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-white font-medium">
                        {ACTIVITY_LABELS[a.type]?.split(' ').slice(1).join(' ') || a.type}
                        {a.item && <span className="text-[#FFD700] ml-1">"{a.item}"</span>}
                      </p>
                      {a.page && <p className="text-xs text-neutral-600 mt-0.5">{a.page}</p>}
                    </div>
                    <span className="text-[10px] text-neutral-600 flex-shrink-0 font-mono">
                      {a.timestamp?.toDate ? timeAgo(a.timestamp.toDate().toISOString()) : '—'}
                    </span>
                  </div>
                ))
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export function CustomersPage() {
  const [loading, setLoading]     = useState(true);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [error, setError]         = useState('');
  const [search, setSearch]       = useState('');
  const [filter, setFilter]       = useState<'all'|'active'|'google'|'email'>('all');
  const [sortBy, setSortBy]       = useState<'newest'|'lastLogin'|'bookings'|'revenue'>('newest');
  const [selected, setSelected]   = useState<Customer | null>(null);
  const [exporting, setExporting] = useState(false);

  useEffect(() => { loadCustomers(); }, []);

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

  const filtered = customers
    .filter(c => {
      const q = search.toLowerCase();
      const matchesSearch = !q ||
        c.name?.toLowerCase().includes(q) ||
        c.email?.toLowerCase().includes(q) ||
        c.phone?.toLowerCase().includes(q) ||
        c.vehicles?.some(v => v.plate?.toLowerCase().includes(q));
      const matchesFilter =
        filter === 'all'    ? true :
        filter === 'active' ? !c.disabled :
        filter === 'google' ? c.provider === 'google.com' :
        filter === 'email'  ? c.provider === 'password' : true;
      return matchesSearch && matchesFilter;
    })
    .sort((a, b) => {
      if (sortBy === 'newest')    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      if (sortBy === 'lastLogin') return new Date(b.lastLogin).getTime() - new Date(a.lastLogin).getTime();
      if (sortBy === 'bookings')  return b.stats.bookingCount - a.stats.bookingCount;
      if (sortBy === 'revenue')   return b.stats.totalRevenue - a.stats.totalRevenue;
      return 0;
    });

  const totalRevenue   = customers.reduce((s, c) => s + (c.stats.totalRevenue || 0), 0);
  const totalBookings  = customers.reduce((s, c) => s + c.stats.bookingCount, 0);
  const newThisWeek    = customers.filter(c => Date.now() - new Date(c.createdAt).getTime() < 7*86400000).length;
  const expirySoonCount = customers.reduce((s, c) =>
    s + (c.vehicles || []).filter(v => daysUntil(v.insuranceExpiry) < 30 || daysUntil(v.revenueExpiry) < 30).length, 0
  );

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
          <button onClick={() => { setExporting(true); exportCustomersCSV(filtered); setTimeout(() => setExporting(false), 500); }}
            disabled={exporting || filtered.length === 0}
            className="flex items-center gap-2 px-4 py-2.5 bg-neutral-900 border border-neutral-700 rounded-xl text-neutral-300 text-sm font-medium hover:bg-neutral-800 hover:text-white transition-colors disabled:opacity-50">
            {exporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
            Export CSV
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { icon: Users,      label: 'Total Customers', value: customers.length,                      color: 'text-white',     bg: 'bg-white/5' },
          { icon: Calendar,   label: 'Total Bookings',  value: totalBookings,                         color: 'text-[#FFD700]', bg: 'bg-[#FFD700]/5' },
          { icon: TrendingUp, label: 'Total Revenue',   value: `Rs. ${totalRevenue.toLocaleString()}`, color: 'text-green-400', bg: 'bg-green-500/5' },
          { icon: Shield,     label: 'Expiry Alerts',   value: expirySoonCount,                        color: expirySoonCount > 0 ? 'text-yellow-400' : 'text-neutral-500', bg: expirySoonCount > 0 ? 'bg-yellow-500/5' : 'bg-neutral-800/50' },
        ].map(s => (
          <div key={s.label} className={`${s.bg} border border-neutral-800 rounded-2xl p-5`}>
            <s.icon className={`w-5 h-5 ${s.color} mb-3 opacity-70`} />
            <div className={`text-2xl font-black ${s.color}`}>{s.value}</div>
            <div className="text-neutral-500 text-xs mt-1 font-medium">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-4">
        <div className="flex flex-col md:flex-row gap-3">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-2.5 w-4 h-4 text-neutral-500" />
            <input value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Search name, email, phone, plate..."
              className="w-full pl-9 pr-3 py-2 bg-neutral-800 border border-neutral-700 rounded-xl text-white text-sm focus:outline-none focus:border-[#FFD700] placeholder:text-neutral-600 transition-colors" />
          </div>
          <div className="flex gap-2 flex-wrap">
            {(['all','active','google','email'] as const).map(f => (
              <button key={f} onClick={() => setFilter(f)}
                className={`px-3 py-2 rounded-xl text-xs font-bold transition-colors capitalize ${
                  filter === f ? 'bg-[#FFD700] text-black' : 'bg-neutral-800 text-neutral-400 hover:text-white border border-neutral-700'
                }`}>
                {f === 'google' ? '🔵 Google' : f === 'email' ? '📧 Email' : f.charAt(0).toUpperCase() + f.slice(1)}
              </button>
            ))}
            <select value={sortBy} onChange={e => setSortBy(e.target.value as any)}
              className="px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-xl text-neutral-400 text-xs font-bold focus:outline-none focus:border-[#FFD700] transition-colors">
              <option value="newest">Newest first</option>
              <option value="lastLogin">Last login</option>
              <option value="bookings">Most bookings</option>
              <option value="revenue">Most revenue</option>
            </select>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="bg-neutral-900 border border-neutral-800 rounded-2xl overflow-hidden">
        <div className="px-5 py-4 border-b border-neutral-800 flex items-center justify-between">
          <span className="text-sm font-bold text-white">
            {filtered.length} customer{filtered.length !== 1 ? 's' : ''}
            {search && <span className="text-neutral-500 font-normal ml-1">matching "{search}"</span>}
          </span>
          {newThisWeek > 0 && (
            <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-green-500/10 border border-green-500/20 text-green-400">
              +{newThisWeek} new this week
            </span>
          )}
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
                  {['Customer', 'Contact', 'Vehicles', 'Bookings', 'Revenue', 'Last Login', 'Joined'].map(h => (
                    <th key={h} className="px-5 py-3.5 text-left text-xs font-bold text-[#FFD700] uppercase tracking-wider whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-800/60">
                {filtered.map(c => {
                  const hasExpiry = (c.vehicles||[]).some(v =>
                    daysUntil(v.insuranceExpiry) < 30 || daysUntil(v.revenueExpiry) < 30
                  );
                  return (
                    <tr key={c.uid}
                      className="hover:bg-neutral-800/40 transition-colors cursor-pointer group"
                      onClick={() => setSelected(c)}>

                      {/* Customer */}
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          <Avatar customer={c} size="sm" />
                          <div className="min-w-0">
                            <div className="text-white font-semibold text-sm truncate max-w-[140px] flex items-center gap-1.5">
                              {c.name || '(no name)'}
                              {hasExpiry && <span className="text-yellow-400 text-xs">⚠</span>}
                            </div>
                            <div className="text-neutral-600 text-xs truncate max-w-[140px]">
                              {c.provider === 'google.com' ? '🔵' : '📧'} {c.emailVerified ? '✓' : ''}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Contact */}
                      <td className="px-5 py-4">
                        <div className="text-neutral-400 text-xs truncate max-w-[160px]">{c.email}</div>
                        {c.phone && <div className="text-neutral-600 text-xs mt-0.5">{c.phone}</div>}
                      </td>

                      {/* Vehicles */}
                      <td className="px-5 py-4">
                        <span className="text-white font-bold">{c.stats.vehicleCount}</span>
                        {(c.vehicles||[]).slice(0, 1).map(v => (
                          <div key={v.id} className="text-[10px] text-neutral-600 font-mono mt-0.5">{v.plate}</div>
                        ))}
                      </td>

                      {/* Bookings */}
                      <td className="px-5 py-4">
                        <span className={`font-bold ${c.stats.bookingCount > 0 ? 'text-[#FFD700]' : 'text-neutral-600'}`}>
                          {c.stats.bookingCount}
                        </span>
                      </td>

                      {/* Revenue */}
                      <td className="px-5 py-4">
                        <span className={`font-bold text-sm ${c.stats.totalRevenue > 0 ? 'text-green-400' : 'text-neutral-700'}`}>
                          {c.stats.totalRevenue > 0 ? `Rs. ${c.stats.totalRevenue.toLocaleString()}` : '—'}
                        </span>
                      </td>

                      {/* Last login */}
                      <td className="px-5 py-4 text-neutral-500 text-xs">{timeAgo(c.lastLogin)}</td>

                      {/* Joined */}
                      <td className="px-5 py-4 text-neutral-600 text-xs">{fmtDate(c.createdAt)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {!loading && filtered.length > 0 && (
          <div className="px-5 py-3 border-t border-neutral-800 text-xs text-neutral-600">
            Showing {filtered.length} of {customers.length} customers
          </div>
        )}
      </div>

      {selected && <CustomerDrawer customer={selected} onClose={() => setSelected(null)} />}
    </div>
  );
}