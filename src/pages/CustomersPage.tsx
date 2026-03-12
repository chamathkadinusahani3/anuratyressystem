// src/pages/CustomersPage.tsx  (admin dashboard)
import React, { useState, useEffect, useRef } from 'react';
import {
  Users, Search, Download, RefreshCw, AlertCircle, Loader2,
  ChevronDown, ChevronRight, Car, Calendar, Package, Activity,
  Mail, Phone, Shield, Clock, X, TrendingUp, Eye,
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
  upcoming:  'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  completed: 'bg-green-500/20 text-green-400 border-green-500/30',
  cancelled: 'bg-red-500/20 text-red-400 border-red-500/30',
  confirmed: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  pending:   'bg-gray-500/20 text-gray-400 border-gray-500/30',
  delivered: 'bg-green-500/20 text-green-400 border-green-500/30',
  Waiting:   'bg-orange-500/20 text-orange-400 border-orange-500/30',
};

// ─── CSV export ───────────────────────────────────────────────────────────────
function downloadCSV(filename: string, rows: string[][]): void {
  const csv  = rows.map(r => r.map(c => `"${String(c ?? '').replace(/"/g, '""')}"`).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}
function exportCustomersCSV(customers: Customer[]): void {
  const header = ['Name','Email','Phone','Provider','Registered','Last Login','Vehicles','Bookings','Orders','Revenue (Rs.)','Last Activity'];
  const rows   = customers.map(c => [
    c.name, c.email, c.phone || '—', c.provider,
    fmtDate(c.createdAt), fmtDate(c.lastLogin),
    String(c.stats.vehicleCount), String(c.stats.bookingCount),
    String(c.stats.orderCount), String(c.stats.totalRevenue),
    c.stats.lastActivity ? fmtDateTime(c.stats.lastActivity) : '—',
  ]);
  downloadCSV(`anura_customers_${new Date().toISOString().split('T')[0]}.csv`, [header, ...rows]);
}

// ─── Customer Detail Drawer ───────────────────────────────────────────────────
function CustomerDrawer({ customer, onClose }: { customer: Customer; onClose: () => void }) {
  const [tab, setTab] = useState<'vehicles'|'appointments'|'orders'|'activity'>('vehicles');

  const expirySoon = customer.vehicles.some(v => {
    const ins = daysUntil(v.insuranceExpiry);
    const rev = daysUntil(v.revenueExpiry);
    return ins < 30 || rev < 30;
  });

  return (
    <div className="fixed inset-0 z-50 flex">
      {/* Backdrop */}
      <div className="flex-1 bg-black/60" onClick={onClose} />

      {/* Drawer */}
      <div className="w-full max-w-2xl bg-neutral-900 border-l border-neutral-700 flex flex-col h-full overflow-hidden shadow-2xl">

        {/* Header */}
        <div className="p-5 border-b border-neutral-800 flex items-start justify-between gap-4">
          <div className="flex items-center gap-4">
            {customer.photoURL
              ? <img src={customer.photoURL} className="w-14 h-14 rounded-full object-cover ring-2 ring-[#FFD700]/30" alt="" />
              : <div className="w-14 h-14 rounded-full bg-[#FFD700]/20 flex items-center justify-center text-[#FFD700] font-bold text-xl">
                  {(customer.name || customer.email)[0].toUpperCase()}
                </div>
            }
            <div>
              <h2 className="text-lg font-bold text-white">{customer.name || '(no name)'}</h2>
              <p className="text-neutral-400 text-sm">{customer.email}</p>
              <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                <span className="text-xs px-2 py-0.5 rounded-full bg-neutral-800 border border-neutral-700 text-neutral-400">
                  {customer.provider === 'google.com' ? '🔵 Google' : '📧 Email'}
                </span>
                {customer.emailVerified && (
                  <span className="text-xs px-2 py-0.5 rounded-full bg-green-500/20 border border-green-500/30 text-green-400">✓ Verified</span>
                )}
                {expirySoon && (
                  <span className="text-xs px-2 py-0.5 rounded-full bg-yellow-500/20 border border-yellow-500/30 text-yellow-400">⚠ Expiry soon</span>
                )}
              </div>
            </div>
          </div>
          <button onClick={onClose} className="text-neutral-500 hover:text-white p-1">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Quick stats */}
        <div className="grid grid-cols-4 border-b border-neutral-800">
          {[
            { label: 'Vehicles',   value: customer.stats.vehicleCount },
            { label: 'Bookings',   value: customer.stats.bookingCount },
            { label: 'Orders',     value: customer.stats.orderCount },
            { label: 'Revenue',    value: `Rs.${customer.stats.totalRevenue.toLocaleString()}` },
          ].map(s => (
            <div key={s.label} className="p-3 text-center border-r border-neutral-800 last:border-0">
              <div className="text-lg font-bold text-[#FFD700]">{s.value}</div>
              <div className="text-xs text-neutral-500">{s.label}</div>
            </div>
          ))}
        </div>

        {/* Meta */}
        <div className="px-5 py-3 border-b border-neutral-800 grid grid-cols-2 gap-2 text-xs text-neutral-500">
          <span>📅 Joined: <span className="text-neutral-300">{fmtDate(customer.createdAt)}</span></span>
          <span>🔐 Last login: <span className="text-neutral-300">{timeAgo(customer.lastLogin)}</span></span>
          {customer.phone && <span>📞 <span className="text-neutral-300">{customer.phone}</span></span>}
          {customer.stats.lastActivity && <span>👁 Last activity: <span className="text-neutral-300">{timeAgo(customer.stats.lastActivity as string)}</span></span>}
        </div>

        {/* Tabs */}
        <div className="flex border-b border-neutral-800 px-3">
          {([
            { id: 'vehicles',     label: 'Vehicles',     icon: Car,      count: customer.stats.vehicleCount },
            { id: 'appointments', label: 'Appointments', icon: Calendar, count: customer.stats.appointmentCount },
            { id: 'orders',       label: 'Orders',        icon: Package, count: customer.stats.orderCount },
            { id: 'activity',     label: 'Activity',      icon: Activity, count: customer.activity.length },
          ] as const).map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={`flex items-center gap-1.5 px-3 py-3 text-xs font-medium border-b-2 transition-colors ${
                tab === t.id ? 'border-[#FFD700] text-white' : 'border-transparent text-neutral-500 hover:text-white'
              }`}>
              <t.icon className="w-3.5 h-3.5" />
              {t.label}
              {t.count > 0 && <span className="ml-0.5 px-1.5 py-0.5 rounded-full bg-neutral-800 text-[10px]">{t.count}</span>}
            </button>
          ))}
        </div>

        {/* Tab content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">

          {/* Vehicles */}
          {tab === 'vehicles' && (
            customer.vehicles.length === 0
              ? <Empty icon={Car} label="No vehicles added" />
              : customer.vehicles.map(v => {
                  const insD = daysUntil(v.insuranceExpiry);
                  const revD = daysUntil(v.revenueExpiry);
                  return (
                    <div key={v.id} className="bg-neutral-800 rounded-xl p-4">
                      <div className="flex items-center justify-between mb-2">
                        <div>
                          <span className="font-bold text-white text-sm">{v.plate}</span>
                          <span className="text-neutral-400 text-sm ml-2">{v.year} {v.make} {v.model}</span>
                        </div>
                        {v.tyreSize && <span className="text-xs font-mono bg-neutral-700 px-2 py-0.5 rounded text-neutral-300">{v.tyreSize}</span>}
                      </div>
                      <div className="flex flex-wrap gap-2 mt-2">
                        {v.insuranceExpiry && (
                          <span className={`text-xs px-2 py-1 rounded-lg border ${insD < 0 ? 'text-red-400 bg-red-500/10 border-red-500/20' : insD < 30 ? 'text-yellow-400 bg-yellow-500/10 border-yellow-500/20' : 'text-green-400 bg-green-500/10 border-green-500/20'}`}>
                            🛡 Insurance: {insD < 0 ? `Expired ${Math.abs(insD)}d ago` : insD < 30 ? `${insD}d left` : fmtDate(v.insuranceExpiry)}
                          </span>
                        )}
                        {v.revenueExpiry && (
                          <span className={`text-xs px-2 py-1 rounded-lg border ${revD < 0 ? 'text-red-400 bg-red-500/10 border-red-500/20' : revD < 30 ? 'text-yellow-400 bg-yellow-500/10 border-yellow-500/20' : 'text-green-400 bg-green-500/10 border-green-500/20'}`}>
                            📄 Revenue: {revD < 0 ? `Expired ${Math.abs(revD)}d ago` : revD < 30 ? `${revD}d left` : fmtDate(v.revenueExpiry)}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })
          )}

          {/* Appointments */}
          {tab === 'appointments' && (
            customer.appointments.length === 0
              ? <Empty icon={Calendar} label="No appointments yet" />
              : customer.appointments.map(a => (
                  <div key={a.id} className="bg-neutral-800 rounded-xl p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-white font-medium text-sm">{a.branch}</span>
                          <span className={`text-xs px-2 py-0.5 rounded-full border ${STATUS_COLORS[a.status] || STATUS_COLORS.pending}`}>
                            {a.status}
                          </span>
                        </div>
                        <p className="text-neutral-400 text-xs">{fmtDate(a.date)} at {a.time}</p>
                        <p className="text-neutral-500 text-xs mt-1">{a.services?.join(', ')}</p>
                      </div>
                      <span className="text-xs font-mono text-neutral-600">#{a.bookingId}</span>
                    </div>
                  </div>
                ))
          )}

          {/* Orders */}
          {tab === 'orders' && (
            customer.orders.length === 0
              ? <Empty icon={Package} label="No orders yet" />
              : customer.orders.map(o => (
                  <div key={o.id} className="bg-neutral-800 rounded-xl p-4">
                    <div className="flex items-start justify-between gap-3 mb-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-white text-sm font-mono">#{o.id.toUpperCase().substring(0, 8)}</span>
                          <span className={`text-xs px-2 py-0.5 rounded-full border ${STATUS_COLORS[o.status] || STATUS_COLORS.pending}`}>
                            {o.status}
                          </span>
                        </div>
                        <p className="text-neutral-500 text-xs mt-0.5">{fmtDate(o.date)} · {o.fulfilment}</p>
                      </div>
                      <span className="text-[#FFD700] font-bold text-sm">Rs. {o.total?.toLocaleString()}</span>
                    </div>
                    {o.items?.map((item, i) => (
                      <div key={i} className="flex justify-between text-xs text-neutral-400 py-0.5">
                        <span>{item.name} <span className="font-mono text-[#FFD700]/70">{item.size}</span> ×{item.qty}</span>
                        <span>Rs. {(item.price * item.qty).toLocaleString()}</span>
                      </div>
                    ))}
                  </div>
                ))
          )}

          {/* Activity */}
          {tab === 'activity' && (
            customer.activity.length === 0
              ? <Empty icon={Activity} label="No activity recorded yet" sub="Activity tracking will appear here once the customer browses the website while logged in" />
              : customer.activity.map(a => (
                  <div key={a.id} className="flex items-start gap-3 py-2 border-b border-neutral-800 last:border-0">
                    <div className="w-8 h-8 rounded-lg bg-neutral-800 flex items-center justify-center flex-shrink-0 text-sm">
                      {ACTIVITY_LABELS[a.type]?.split(' ')[0] || '📌'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-white">
                        {ACTIVITY_LABELS[a.type]?.split(' ').slice(1).join(' ') || a.type}
                        {a.item && <span className="text-[#FFD700] ml-1 font-medium">"{a.item}"</span>}
                      </p>
                      {a.page && <p className="text-xs text-neutral-500">{a.page}</p>}
                      {a.branch && <p className="text-xs text-neutral-500">Branch: {a.branch}</p>}
                    </div>
                    <span className="text-xs text-neutral-600 flex-shrink-0">
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

function Empty({ icon: Icon, label, sub }: { icon: any; label: string; sub?: string }) {
  return (
    <div className="py-12 text-center">
      <Icon className="w-10 h-10 text-neutral-700 mx-auto mb-3" />
      <p className="text-neutral-500 text-sm font-medium">{label}</p>
      {sub && <p className="text-neutral-600 text-xs mt-1 max-w-xs mx-auto">{sub}</p>}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export function CustomersPage() {
  const [loading, setLoading]       = useState(true);
  const [customers, setCustomers]   = useState<Customer[]>([]);
  const [error, setError]           = useState('');
  const [search, setSearch]         = useState('');
  const [filter, setFilter]         = useState<'all'|'active'|'google'|'email'>('all');
  const [sortBy, setSortBy]         = useState<'newest'|'lastLogin'|'bookings'|'revenue'>('newest');
  const [selected, setSelected]     = useState<Customer | null>(null);
  const [exporting, setExporting]   = useState(false);

  useEffect(() => { loadCustomers(); }, []);

  const loadCustomers = async () => {
    setLoading(true);
    setError('');
    try {
      const res  = await fetch(`${API_URL}/customers`);
      const data = await res.json();
      if (!data.success) throw new Error(data.message || 'Failed to load');
      setCustomers(data.customers);
    } catch (err: any) {
      setError(err.message || 'Failed to load customers');
    } finally {
      setLoading(false);
    }
  };

  const handleExport = async () => {
    setExporting(true);
    try { exportCustomersCSV(filtered); }
    finally { setExporting(false); }
  };

  const filtered = customers
    .filter(c => {
      const q = search.toLowerCase();
      const matchesSearch = !q ||
        c.name.toLowerCase().includes(q) ||
        c.email.toLowerCase().includes(q) ||
        c.phone?.toLowerCase().includes(q) ||
        c.vehicles.some(v => v.plate?.toLowerCase().includes(q));
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

  // Aggregate stats
  const totalRevenue    = customers.reduce((s, c) => s + c.stats.totalRevenue, 0);
  const totalBookings   = customers.reduce((s, c) => s + c.stats.bookingCount, 0);
  const activeThisWeek  = customers.filter(c => {
    const diff = Date.now() - new Date(c.lastLogin).getTime();
    return diff < 7 * 86400000;
  }).length;
  const expirySoonCount = customers.reduce((s, c) =>
    s + c.vehicles.filter(v => daysUntil(v.insuranceExpiry) < 30 || daysUntil(v.revenueExpiry) < 30).length, 0
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <Loader2 className="w-12 h-12 text-[#FFD700] animate-spin mx-auto mb-4" />
          <p className="text-neutral-400">Loading customer data…</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center max-w-md">
          <AlertCircle className="w-12 h-12 text-red-400 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-white mb-2">Error Loading Customers</h2>
          <p className="text-neutral-400 mb-6">{error}</p>
          <button onClick={loadCustomers} className="px-6 py-2 bg-[#FFD700] text-black font-bold rounded-lg">Try Again</button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold text-white mb-1">Customers</h2>
          <p className="text-neutral-400 text-sm">All registered website customers and their activity</p>
        </div>
        <div className="flex gap-2">
          <button onClick={loadCustomers}
            className="flex items-center gap-2 px-4 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-white hover:bg-neutral-700 transition-colors">
            <RefreshCw className="w-4 h-4" /> Refresh
          </button>
          <button onClick={handleExport} disabled={exporting}
            className="flex items-center gap-2 px-4 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-white hover:bg-neutral-700 transition-colors disabled:opacity-50">
            {exporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
            Export CSV
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { icon: <Users className="w-4 h-4 text-[#FFD700]" />,      label: 'Total Customers',  value: customers.length,                        sub: `${activeThisWeek} active this week` },
          { icon: <TrendingUp className="w-4 h-4 text-[#FFD700]" />,  label: 'Total Bookings',   value: totalBookings,                           sub: 'all time' },
          { icon: <Activity className="w-4 h-4 text-[#FFD700]" />,    label: 'Total Revenue',    value: `Rs. ${totalRevenue.toLocaleString()}`,   sub: 'from orders' },
          { icon: <Shield className="w-4 h-4 text-yellow-400" />,     label: 'Expiry Alerts',    value: expirySoonCount,                         sub: 'vehicles expiring soon', gold: expirySoonCount > 0 },
        ].map((card: any) => (
          <div key={card.label} className="bg-neutral-900 border border-neutral-800 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-2">{card.icon}<span className="text-xs text-neutral-500">{card.label}</span></div>
            <div className={`text-2xl font-bold ${card.gold ? 'text-yellow-400' : 'text-white'}`}>{card.value}</div>
            <div className="text-xs text-neutral-500 mt-1">{card.sub}</div>
          </div>
        ))}
      </div>

      {/* Search + Filter + Sort */}
      <div className="flex flex-col md:flex-row gap-3">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-500" />
          <input type="text" value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search by name, email, phone, or plate number…"
            className="w-full pl-10 pr-4 py-2.5 bg-neutral-800 border border-neutral-700 rounded-lg text-white placeholder:text-neutral-600 focus:outline-none focus:border-[#FFD700]" />
        </div>
        <div className="flex gap-2 flex-wrap">
          {(['all','active','google','email'] as const).map(f => (
            <button key={f} onClick={() => setFilter(f)}
              className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors capitalize ${filter === f ? 'bg-[#FFD700] text-black' : 'bg-neutral-800 text-neutral-400 hover:text-white'}`}>
              {f === 'google' ? '🔵 Google' : f === 'email' ? '📧 Email' : f.charAt(0).toUpperCase() + f.slice(1)}
            </button>
          ))}
          <select value={sortBy} onChange={e => setSortBy(e.target.value as any)}
            className="px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-neutral-400 text-sm focus:outline-none focus:border-[#FFD700]">
            <option value="newest">Newest first</option>
            <option value="lastLogin">Last login</option>
            <option value="bookings">Most bookings</option>
            <option value="revenue">Most revenue</option>
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="bg-neutral-900 border border-neutral-800 rounded-xl overflow-hidden">
        <div className="p-4 border-b border-neutral-800 flex items-center justify-between">
          <h3 className="font-bold text-white">Registered Customers ({filtered.length})</h3>
          {search && <span className="text-xs text-neutral-500">Filtered from {customers.length} total</span>}
        </div>

        {filtered.length === 0 ? (
          <div className="p-16 text-center">
            <Users className="w-12 h-12 text-neutral-700 mx-auto mb-3" />
            <p className="text-neutral-500">{customers.length === 0 ? 'No customers registered yet' : 'No customers match your search'}</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-neutral-800/60 border-b border-neutral-700">
                  <th className="px-4 py-3 text-left font-medium text-neutral-400">Customer</th>
                  <th className="px-4 py-3 text-left font-medium text-neutral-400">Vehicles</th>
                  <th className="px-4 py-3 text-left font-medium text-neutral-400">Bookings</th>
                  <th className="px-4 py-3 text-left font-medium text-neutral-400">Orders</th>
                  <th className="px-4 py-3 text-left font-medium text-neutral-400">Revenue</th>
                  <th className="px-4 py-3 text-left font-medium text-neutral-400">Last Login</th>
                  <th className="px-4 py-3 text-left font-medium text-neutral-400">Joined</th>
                  <th className="px-4 py-3 text-left font-medium text-neutral-400"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-800">
                {filtered.map(customer => {
                  const hasExpiry = customer.vehicles.some(v =>
                    daysUntil(v.insuranceExpiry) < 30 || daysUntil(v.revenueExpiry) < 30
                  );
                  return (
                    <tr key={customer.uid} className="hover:bg-neutral-800/40 transition-colors cursor-pointer"
                      onClick={() => setSelected(customer)}>

                      {/* Customer */}
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          {customer.photoURL
                            ? <img src={customer.photoURL} className="w-8 h-8 rounded-full object-cover" alt="" />
                            : <div className="w-8 h-8 rounded-full bg-[#FFD700]/20 flex items-center justify-center text-[#FFD700] text-xs font-bold flex-shrink-0">
                                {(customer.name || customer.email)[0].toUpperCase()}
                              </div>
                          }
                          <div className="min-w-0">
                            <div className="font-medium text-white truncate max-w-[160px]">
                              {customer.name || '(no name)'}
                              {hasExpiry && <span className="ml-1 text-yellow-400" title="Expiry soon">⚠</span>}
                            </div>
                            <div className="text-xs text-neutral-500 truncate max-w-[160px]">{customer.email}</div>
                            {customer.phone && <div className="text-xs text-neutral-600">{customer.phone}</div>}
                          </div>
                        </div>
                      </td>

                      {/* Vehicles */}
                      <td className="px-4 py-3">
                        <div className="flex flex-col gap-1">
                          <span className="text-white font-medium">{customer.stats.vehicleCount}</span>
                          {customer.vehicles.slice(0, 2).map(v => (
                            <span key={v.id} className="text-xs text-neutral-500 font-mono">{v.plate}</span>
                          ))}
                          {customer.vehicles.length > 2 && (
                            <span className="text-xs text-neutral-600">+{customer.vehicles.length - 2} more</span>
                          )}
                        </div>
                      </td>

                      {/* Bookings */}
                      <td className="px-4 py-3">
                        <span className="text-white font-medium">{customer.stats.bookingCount}</span>
                        {customer.bookings[0] && (
                          <p className="text-xs text-neutral-500 mt-0.5">{customer.bookings[0].branch}</p>
                        )}
                      </td>

                      {/* Orders */}
                      <td className="px-4 py-3">
                        <span className="text-white font-medium">{customer.stats.orderCount}</span>
                      </td>

                      {/* Revenue */}
                      <td className="px-4 py-3">
                        <span className={`font-medium ${customer.stats.totalRevenue > 0 ? 'text-[#FFD700]' : 'text-neutral-600'}`}>
                          {customer.stats.totalRevenue > 0 ? `Rs. ${customer.stats.totalRevenue.toLocaleString()}` : '—'}
                        </span>
                      </td>

                      {/* Last login */}
                      <td className="px-4 py-3 text-neutral-400 text-xs">
                        {timeAgo(customer.lastLogin)}
                      </td>

                      {/* Joined */}
                      <td className="px-4 py-3 text-neutral-500 text-xs">
                        {fmtDate(customer.createdAt)}
                      </td>

                      {/* View */}
                      <td className="px-4 py-3">
                        <button className="flex items-center gap-1 text-xs text-neutral-500 hover:text-[#FFD700] transition-colors">
                          <Eye className="w-3.5 h-3.5" /> View
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Customer detail drawer */}
      {selected && <CustomerDrawer customer={selected} onClose={() => setSelected(null)} />}
    </div>
  );
}