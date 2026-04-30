// src/pages/CustomersPage.tsx
import React, { useState, useEffect } from 'react';
import {
  Users, Search, Download, RefreshCw, AlertCircle, Loader2,
  Car, Calendar, Package, Activity, Shield, TrendingUp, X,
  CheckCircle, Clock, MapPin, ArrowLeft, Phone, Mail,
  Wrench, FileText, ChevronRight, Filter, Eye, Star,
  Hash, Layers, BadgeCheck, AlertTriangle, BarChart2,
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
// Safely convert any API value to a display string.
// branch/services/make/model can come back as objects from the API.
function str(val: any): string {
  if (val === null || val === undefined) return '—';
  if (typeof val === 'string') return val;
  if (typeof val === 'number') return String(val);
  if (Array.isArray(val)) return val.map(str).filter(v => v && v !== '—').join(', ');
  if (typeof val === 'object') {
    return val.name || val.title || val.label || val.address || val.id || '';
  }
  return String(val);
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
function Avatar({ customer, size = 'md' }: { customer: Customer; size?: 'sm' | 'md' | 'lg' | 'xl' }) {
  const sz =
    size === 'sm' ? 'w-8 h-8 text-xs' :
    size === 'lg' ? 'w-16 h-16 text-2xl' :
    size === 'xl' ? 'w-20 h-20 text-3xl' :
    'w-10 h-10 text-sm';
  if (customer.photoURL) {
    return <img src={customer.photoURL} className={`${sz} rounded-full object-cover ring-2 ring-[#FFD700]/20`} alt="" />;
  }
  return (
    <div className={`${sz} rounded-full bg-gradient-to-br from-[#FFD700]/20 to-[#FFD700]/5 border border-[#FFD700]/20 flex items-center justify-center text-[#FFD700] font-black flex-shrink-0`}>
      {(customer.name || customer.email)[0].toUpperCase()}
    </div>
  );
}

// ─── Vehicle Jobs Panel ───────────────────────────────────────────────────────
function VehicleJobsPanel({ vehicle, bookings, appointments }: {
  vehicle: Vehicle;
  bookings: Booking[];
  appointments: Appointment[];
}) {
  // Filter bookings and appointments by vehicle plate
  const plate = str(vehicle.plate);
  const vehicleBookings = bookings.filter(b => {
    const bPlate = str(b.vehicleNo).toLowerCase();
    const vPlate = plate.toLowerCase();
    return bPlate.includes(vPlate) || vPlate.includes(bPlate);
  });

  const insExpiry = str(vehicle.insuranceExpiry) !== '—' ? str(vehicle.insuranceExpiry) : '';
  const revExpiry = str(vehicle.revenueExpiry)   !== '—' ? str(vehicle.revenueExpiry)   : '';
  const insD = daysUntil(insExpiry);
  const revD = daysUntil(revExpiry);

  return (
    <div className="bg-neutral-900 border border-neutral-800 rounded-2xl overflow-hidden">
      {/* Vehicle Header */}
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
          {vehicle.tyreSize && (
            <span className="text-xs font-mono bg-neutral-800 border border-neutral-700 px-2.5 py-1 rounded-lg text-neutral-300">
              {str(vehicle.tyreSize)}
            </span>
          )}
        </div>

        {/* Expiry badges */}
        <div className="flex gap-2 mt-3 flex-wrap">
          {insExpiry && (
            <span className={`text-[10px] px-2.5 py-1 rounded-lg border font-medium flex items-center gap-1 ${
              insD < 0 ? 'text-red-400 bg-red-500/10 border-red-500/20' :
              insD < 30 ? 'text-yellow-400 bg-yellow-500/10 border-yellow-500/20' :
              'text-green-400 bg-green-500/10 border-green-500/20'
            }`}>
              <Shield className="w-3 h-3" />
              Insurance: {insD < 0 ? `Expired ${Math.abs(insD)}d ago` : insD < 30 ? `${insD}d left` : fmtDate(insExpiry)}
            </span>
          )}
          {revExpiry && (
            <span className={`text-[10px] px-2.5 py-1 rounded-lg border font-medium flex items-center gap-1 ${
              revD < 0 ? 'text-red-400 bg-red-500/10 border-red-500/20' :
              revD < 30 ? 'text-yellow-400 bg-yellow-500/10 border-yellow-500/20' :
              'text-green-400 bg-green-500/10 border-green-500/20'
            }`}>
              <FileText className="w-3 h-3" />
              Revenue: {revD < 0 ? `Expired ${Math.abs(revD)}d ago` : revD < 30 ? `${revD}d left` : fmtDate(revExpiry)}
            </span>
          )}
        </div>
      </div>

      {/* Jobs for this vehicle */}
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
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${STATUS_COLORS[str(b.status)] || STATUS_COLORS.pending}`}>
                    {str(b.status)}
                  </span>
                </div>
                <p className="text-[#FFD700] text-xs font-medium mb-1">{str(b.branch)}</p>
                {b.services?.length > 0 && (
                  <p className="text-neutral-500 text-[10px]">{b.services.map(str).join(' · ')}</p>
                )}
                {b.total > 0 && (
                  <p className="text-green-400 text-xs font-bold mt-1.5">Rs. {b.total.toLocaleString()}</p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Customer Detail Page ─────────────────────────────────────────────────────
function CustomerDetailPage({ customer, onBack }: { customer: Customer; onBack: () => void }) {
  const [activeTab, setActiveTab] = useState<'overview'|'vehicles'|'bookings'|'orders'|'activity'>('overview');
  const [vehicleFilter, setVehicleFilter] = useState<string>('all');

  // Safe defaults — API may return undefined for any of these arrays
  const vehicles     = customer.vehicles     ?? [];
  const bookings     = customer.bookings     ?? [];
  const appointments = customer.appointments ?? [];
  const orders       = customer.orders       ?? [];
  const activity     = customer.activity     ?? [];
  const stats        = customer.stats        ?? { vehicleCount: 0, appointmentCount: 0, orderCount: 0, bookingCount: 0, totalRevenue: 0, lastActivity: null };

  const expirySoon = vehicles.some(v => daysUntil(str(v.insuranceExpiry)) < 30 || daysUntil(str(v.revenueExpiry)) < 30);
  const totalSpent = stats.totalRevenue || 0;

  // Jobs filtered by vehicle
  const filteredBookings = vehicleFilter === 'all'
    ? bookings
    : bookings.filter(b =>
        b.vehicleNo?.toLowerCase().includes(vehicleFilter.toLowerCase()) ||
        vehicleFilter.toLowerCase().includes(b.vehicleNo?.toLowerCase())
      );

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-400">

      {/* Back button */}
      <button onClick={onBack} className="flex items-center gap-2 text-neutral-400 hover:text-white transition-colors text-sm font-medium group">
        <ArrowLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" />
        Back to Customers
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
              <div className="ring-4 ring-neutral-900 rounded-full">
                <Avatar customer={customer} size="xl" />
              </div>
              <div className="pb-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <h1 className="text-2xl font-black text-white">{customer.name || '(no name)'}</h1>
                  {customer.emailVerified && (
                    <BadgeCheck className="w-5 h-5 text-[#FFD700]" />
                  )}
                  {expirySoon && (
                    <span className="text-[10px] font-bold px-2 py-1 rounded-full bg-yellow-500/10 border border-yellow-500/20 text-yellow-400 uppercase tracking-wider">
                      ⚠ Expiry Alert
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-4 mt-1.5 flex-wrap">
                  <span className="flex items-center gap-1.5 text-neutral-400 text-sm">
                    <Mail className="w-3.5 h-3.5" /> {customer.email}
                  </span>
                  {customer.phone && (
                    <span className="flex items-center gap-1.5 text-neutral-400 text-sm">
                      <Phone className="w-3.5 h-3.5" /> {customer.phone}
                    </span>
                  )}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2 pb-1">
              <span className="text-xs font-bold px-3 py-1.5 rounded-full bg-neutral-800 border border-neutral-700 text-neutral-300">
                {customer.provider === 'google.com' ? '🔵 Google' : '📧 Email'}
              </span>
              <span className="text-xs text-neutral-600">Joined {fmtDate(customer.createdAt)}</span>
            </div>
          </div>

          {/* Stats Row */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mt-6">
            {[
              { label: 'Vehicles',    value: stats.vehicleCount,   color: 'text-white',      icon: Car },
              { label: 'Bookings',    value: stats.bookingCount,   color: 'text-[#FFD700]',  icon: Calendar },
              { label: 'Orders',      value: stats.orderCount,     color: 'text-blue-400',   icon: Package },
              { label: 'Total Spent', value: `Rs.${totalSpent.toLocaleString()}`, color: 'text-green-400', icon: TrendingUp },
              { label: 'Last Active', value: timeAgo(customer.lastLogin),   color: 'text-neutral-300', icon: Activity },
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

      {/* Tab Navigation */}
      <div className="flex gap-1 bg-neutral-900 border border-neutral-800 rounded-xl p-1.5">
        {([
          { id: 'overview',  label: 'Overview',    icon: BarChart2 },
          { id: 'vehicles',  label: 'Vehicles & Jobs', icon: Car, count: stats.vehicleCount },
          { id: 'bookings',  label: 'All Bookings', icon: Calendar, count: stats.bookingCount },
          { id: 'orders',    label: 'Orders',       icon: Package, count: stats.orderCount },
          { id: 'activity',  label: 'Activity',     icon: Activity, count: activity.length },
        ] as const).map(t => (
          <button key={t.id} onClick={() => setActiveTab(t.id)}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 px-2 text-xs font-bold rounded-lg transition-all ${
              activeTab === t.id
                ? 'bg-[#FFD700] text-black shadow-lg shadow-[#FFD700]/10'
                : 'text-neutral-500 hover:text-neutral-300 hover:bg-neutral-800'
            }`}>
            <t.icon className="w-3.5 h-3.5" />
            <span className="hidden md:inline">{t.label}</span>
            {'count' in t && t.count > 0 && (
              <span className={`px-1.5 py-0.5 rounded-full text-[9px] font-black ${
                activeTab === t.id ? 'bg-black/20 text-black' : 'bg-neutral-800 text-neutral-500'
              }`}>{t.count}</span>
            )}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {activeTab === 'overview' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Account Info */}
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

          {/* Vehicles Quick View */}
          <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-5">
            <h3 className="text-sm font-bold text-white mb-4 flex items-center gap-2">
              <Car className="w-4 h-4 text-[#FFD700]" /> Registered Vehicles
            </h3>
            {vehicles.length === 0 ? (
              <Empty icon={Car} label="No vehicles added" />
            ) : (
              <div className="space-y-2">
                {vehicles.map(v => {
                  const insD = daysUntil(v.insuranceExpiry);
                  const revD = daysUntil(v.revenueExpiry);
                  const hasAlert = insD < 30 || revD < 30;
                  return (
                    <div key={v.id} className={`flex items-center justify-between p-3 rounded-xl border transition-colors ${
                      hasAlert ? 'border-yellow-500/30 bg-yellow-500/5' : 'border-neutral-800 bg-neutral-800/40'
                    }`}>
                      <div className="flex items-center gap-3">
                        <Car className={`w-4 h-4 ${hasAlert ? 'text-yellow-400' : 'text-neutral-500'}`} />
                        <div>
                          <p className="text-white text-sm font-bold">{str(v.plate)}</p>
                          <p className="text-neutral-500 text-[10px]">{str(v.year)} {str(v.make)} {str(v.model)}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        {v.tyreSize && <p className="text-[10px] font-mono text-neutral-500 mb-0.5">{str(v.tyreSize)}</p>}
                        {hasAlert && <span className="text-[10px] text-yellow-400">⚠ Expiry soon</span>}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Recent Bookings */}
          <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-5">
            <h3 className="text-sm font-bold text-white mb-4 flex items-center gap-2">
              <Calendar className="w-4 h-4 text-[#FFD700]" /> Recent Bookings
            </h3>
            {bookings.length === 0 ? (
              <Empty icon={Calendar} label="No bookings yet" />
            ) : (
              <div className="space-y-2">
                {bookings.slice(0, 4).map(b => (
                  <div key={b.id} className="flex items-center justify-between p-3 bg-neutral-800/40 rounded-xl border border-neutral-800">
                    <div>
                      <p className="text-white text-xs font-semibold">{str(b.branch)}</p>
                      <p className="text-neutral-600 text-[10px]">{fmtDate(b.date)}{b.vehicleNo ? ` · ${str(b.vehicleNo)}` : ''}</p>
                    </div>
                    <div className="text-right">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${STATUS_COLORS[str(b.status)] || STATUS_COLORS.pending}`}>
                        {str(b.status)}
                      </span>
                      {b.total > 0 && <p className="text-green-400 text-[10px] font-bold mt-1">Rs. {b.total.toLocaleString()}</p>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Recent Orders */}
          <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-5">
            <h3 className="text-sm font-bold text-white mb-4 flex items-center gap-2">
              <Package className="w-4 h-4 text-[#FFD700]" /> Recent Orders
            </h3>
            {orders.length === 0 ? (
              <Empty icon={Package} label="No orders yet" />
            ) : (
              <div className="space-y-2">
                {orders.slice(0, 4).map(o => (
                  <div key={o.id} className="flex items-center justify-between p-3 bg-neutral-800/40 rounded-xl border border-neutral-800">
                    <div>
                      <p className="text-white text-xs font-mono">#{o.id.substring(0, 8).toUpperCase()}</p>
                      <p className="text-neutral-600 text-[10px]">{fmtDate(o.date)} · {str(o.fulfilment)}</p>
                    </div>
                    <div className="text-right">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${STATUS_COLORS[str(o.status)] || STATUS_COLORS.pending}`}>
                        {str(o.status)}
                      </span>
                      <p className="text-[#FFD700] text-[10px] font-black mt-1">Rs. {(o.total||0).toLocaleString()}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === 'vehicles' && (
        <div className="space-y-4">
          {/* Vehicle Filter Bar */}
          {vehicles.length > 0 && bookings.length > 0 && (
            <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-4 flex items-center gap-3 flex-wrap">
              <div className="flex items-center gap-2 text-xs font-bold text-neutral-500 uppercase tracking-wider">
                <Filter className="w-3.5 h-3.5" /> Filter Jobs by Vehicle:
              </div>
              <button
                onClick={() => setVehicleFilter('all')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                  vehicleFilter === 'all' ? 'bg-[#FFD700] text-black' : 'bg-neutral-800 text-neutral-400 hover:text-white border border-neutral-700'
                }`}>
                All Vehicles
              </button>
              {vehicles.map(v => (
                <button key={v.id}
                  onClick={() => setVehicleFilter(str(v.plate))}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors font-mono ${
                    vehicleFilter === str(v.plate) ? 'bg-[#FFD700] text-black' : 'bg-neutral-800 text-neutral-400 hover:text-white border border-neutral-700'
                  }`}>
                  {str(v.plate)}
                </button>
              ))}
            </div>
          )}

          {vehicles.length === 0 ? (
            <Empty icon={Car} label="No vehicles registered" sub="Customer hasn't added any vehicles yet" />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {vehicles
                .filter(v => vehicleFilter === 'all' || vehicleFilter === str(v.plate))
                .map(v => (
                  <VehicleJobsPanel
                    key={v.id}
                    vehicle={v}
                    bookings={bookings}
                    appointments={appointments}
                  />
                ))
              }
            </div>
          )}
        </div>
      )}

      {activeTab === 'bookings' && (
        <div className="space-y-3">
          {/* Vehicle filter for bookings */}
          {vehicles.length > 0 && (
            <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-3 flex items-center gap-2 flex-wrap">
              <Filter className="w-3.5 h-3.5 text-neutral-500" />
              <span className="text-xs text-neutral-500 font-bold uppercase tracking-wider mr-1">Filter:</span>
              <button onClick={() => setVehicleFilter('all')}
                className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition-colors ${
                  vehicleFilter === 'all' ? 'bg-[#FFD700] text-black' : 'bg-neutral-800 text-neutral-400 border border-neutral-700 hover:text-white'
                }`}>All</button>
              {vehicles.map(v => (
                <button key={v.id} onClick={() => setVehicleFilter(str(v.plate))}
                  className={`px-2.5 py-1 rounded-lg text-[10px] font-bold font-mono transition-colors ${
                    vehicleFilter === str(v.plate) ? 'bg-[#FFD700] text-black' : 'bg-neutral-800 text-neutral-400 border border-neutral-700 hover:text-white'
                  }`}>{str(v.plate)}</button>
              ))}
              {vehicleFilter !== 'all' && (
                <span className="text-[10px] text-neutral-600 ml-auto">{filteredBookings.length} result{filteredBookings.length !== 1 ? 's' : ''}</span>
              )}
            </div>
          )}

          <div className="bg-neutral-900 border border-neutral-800 rounded-2xl overflow-hidden">
            {filteredBookings.length === 0 ? (
              <Empty icon={Calendar} label="No bookings found" sub={vehicleFilter !== 'all' ? `No bookings for plate ${vehicleFilter}` : undefined} />
            ) : (
              <div className="divide-y divide-neutral-800/60">
                {filteredBookings.map(b => (
                  <div key={b.id} className="p-4 hover:bg-neutral-800/30 transition-colors">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <span className="text-white font-semibold text-sm">{str(b.branch)}</span>
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${STATUS_COLORS[str(b.status)] || STATUS_COLORS.pending}`}>
                            {str(b.status)}
                          </span>
                          {b.vehicleNo && (
                            <span className="text-[10px] font-mono text-[#FFD700]/70 bg-[#FFD700]/5 border border-[#FFD700]/10 px-2 py-0.5 rounded-full">
                              {str(b.vehicleNo)}
                            </span>
                          )}
                        </div>
                        <p className="text-neutral-500 text-xs flex items-center gap-1.5 mb-1">
                          <Clock className="w-3 h-3" /> {fmtDate(b.date)}{b.timeSlot ? ` at ${str(b.timeSlot)}` : ''}
                        </p>
                        {b.services?.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-2">
                            {b.services.map((s, i) => (
                              <span key={i} className="text-[10px] px-2 py-0.5 bg-neutral-800 border border-neutral-700 rounded-full text-neutral-400">
                                {str(s)}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                      <div className="text-right flex-shrink-0">
                        {b.total > 0 && (
                          <span className="text-green-400 font-black text-sm">Rs. {b.total.toLocaleString()}</span>
                        )}
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

      {activeTab === 'orders' && (
        <div className="bg-neutral-900 border border-neutral-800 rounded-2xl overflow-hidden">
          {orders.length === 0 ? (
            <Empty icon={Package} label="No orders yet" />
          ) : (
            <div className="divide-y divide-neutral-800/60">
              {orders.map(o => (
                <div key={o.id} className="p-5 hover:bg-neutral-800/30 transition-colors">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <span className="text-white text-sm font-mono font-bold">#{o.id.substring(0, 8).toUpperCase()}</span>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${STATUS_COLORS[str(o.status)] || STATUS_COLORS.pending}`}>
                        {str(o.status)}
                      </span>
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

      {activeTab === 'activity' && (
        <div className="bg-neutral-900 border border-neutral-800 rounded-2xl overflow-hidden">
          {activity.length === 0 ? (
            <Empty icon={Activity} label="No activity recorded" sub="Activity appears when customer browses while logged in" />
          ) : (
            <div className="divide-y divide-neutral-800/40">
              {activity.map(a => (
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
  const [filter, setFilter]       = useState<'all'|'active'|'google'|'email'>('all');
  const [sortBy, setSortBy]       = useState<'newest'|'lastLogin'|'bookings'|'revenue'>('newest');
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
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

  const totalRevenue    = customers.reduce((s, c) => s + (c.stats.totalRevenue || 0), 0);
  const totalBookings   = customers.reduce((s, c) => s + c.stats.bookingCount, 0);
  const newThisWeek     = customers.filter(c => Date.now() - new Date(c.createdAt).getTime() < 7*86400000).length;
  const expirySoonCount = customers.reduce((s, c) =>
    s + (c.vehicles || []).filter(v => daysUntil(v.insuranceExpiry) < 30 || daysUntil(v.revenueExpiry) < 30).length, 0
  );

  // Show detail page if customer selected
  if (selectedCustomer) {
    return (
      <CustomerDetailPage
        customer={selectedCustomer}
        onBack={() => setSelectedCustomer(null)}
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
          { icon: Users,      label: 'Total Customers', value: customers.length,                       color: 'text-white',     bg: 'bg-white/5' },
          { icon: Calendar,   label: 'Total Bookings',  value: totalBookings,                          color: 'text-[#FFD700]', bg: 'bg-[#FFD700]/5' },
          { icon: TrendingUp, label: 'Total Revenue',   value: `Rs. ${totalRevenue.toLocaleString()}`, color: 'text-green-400', bg: 'bg-green-500/5' },
          { icon: Shield,     label: 'Expiry Alerts',   value: expirySoonCount, color: expirySoonCount > 0 ? 'text-yellow-400' : 'text-neutral-500', bg: expirySoonCount > 0 ? 'bg-yellow-500/5' : 'bg-neutral-800/50' },
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
                  {['Customer', 'Contact', 'Vehicles', 'Bookings', 'Revenue', 'Last Login', 'Joined', ''].map(h => (
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
                      onClick={() => setSelectedCustomer(c)}>

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
                          <div key={v.id} className="text-[10px] text-neutral-600 font-mono mt-0.5">{str(v.plate)}</div>
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

                      {/* View button */}
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

        {!loading && filtered.length > 0 && (
          <div className="px-5 py-3 border-t border-neutral-800 text-xs text-neutral-600">
            Showing {filtered.length} of {customers.length} customers · Click any row to view full details
          </div>
        )}
      </div>
    </div>
  );
}