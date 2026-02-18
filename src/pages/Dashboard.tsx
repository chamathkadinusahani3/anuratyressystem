import React, { useState, useEffect, useRef } from 'react';
import { Sidebar } from '../components/layout/Sidebar';
import { StatsCards } from '../components/dashboard/StatsCards';
import { StaffAssignment } from '../components/dashboard/StaffAssignment';
import { Bell, Search, User, X, PlayCircle, CheckCircle, XCircle, AlertTriangle, Package, Calendar, LogOut, ChevronDown, Menu } from 'lucide-react';
import { SettingsPage } from './SettingsPage';
import { UserManagement } from './UserManagementpage';

import { BookingsPage } from './BookingsPage';
import { StaffPage } from './StaffPage';
import { InventoryPage } from './InventoryPage';
import { ReportsPage } from './ReportsPage';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

type BookingStatus = 'Pending' | 'In Progress' | 'Completed' | 'Cancelled';

interface Booking {
  id: string;
  date: string;
  customer: string;
  vehicle: string;
  service: string;
  status: BookingStatus;
  amount: string;
  timeSlot?: string;
}

interface Notification {
  id: string;
  type: 'error' | 'warning' | 'info' | 'success';
  title: string;
  message: string;
  time: string;
  read: boolean;
}

interface DashboardProps {
  user: { name: string; role: string; username: string };
  onLogout: () => void;
}

// ─── Notifications Panel ──────────────────────────────────────────────────────
const INITIAL_NOTIFICATIONS: Notification[] = [
  { id: '1', type: 'error',   title: 'Low Stock Warning',  message: 'Michelin 205/55R16 running low — only 4 left.',           time: '2 min ago',  read: false },
  { id: '2', type: 'warning', title: 'Pending Approvals',  message: '3 new large fleet bookings require manager approval.',     time: '15 min ago', read: false },
  { id: '3', type: 'info',    title: 'New Booking',        message: 'Nimal Perera booked Wheel Alignment for tomorrow 10:00.', time: '1 hr ago',   read: false },
  { id: '4', type: 'success', title: 'Service Completed',  message: 'BK-7828 marked as completed by Saman Perera.',            time: '2 hr ago',   read: true  },
];

function NotificationsPanel({ onClose }: { onClose: () => void }) {
  const [notifications, setNotifications] = useState<Notification[]>(INITIAL_NOTIFICATIONS);
  const dotColor = { error: 'bg-red-500', warning: 'bg-yellow-500', info: 'bg-blue-500', success: 'bg-green-500' };

  return (
    <div className="absolute right-0 top-full mt-2 w-80 max-w-[calc(100vw-2rem)] bg-neutral-900 border border-neutral-700 rounded-xl shadow-2xl z-50 overflow-hidden">
      <div className="px-4 py-3 border-b border-neutral-800 flex items-center justify-between">
        <span className="text-white font-bold text-sm">Notifications</span>
        <button onClick={() => setNotifications(n => n.map(x => ({ ...x, read: true })))}
          className="text-xs text-[#FFD700] hover:underline transition-colors">Mark all read</button>
      </div>
      <div className="max-h-80 overflow-y-auto divide-y divide-neutral-800/50">
        {notifications.length === 0 ? (
          <div className="p-6 text-center text-neutral-500 text-sm">All caught up! 🎉</div>
        ) : notifications.map(n => (
          <div key={n.id} onClick={() => setNotifications(prev => prev.map(x => x.id === n.id ? { ...x, read: true } : x))}
            className={`px-4 py-3 flex items-start gap-3 cursor-pointer transition-colors ${n.read ? 'opacity-50' : 'hover:bg-neutral-800'}`}>
            <div className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${dotColor[n.type]}`} />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-white">{n.title}</p>
              <p className="text-xs text-neutral-500 mt-0.5 leading-relaxed">{n.message}</p>
              <p className="text-xs text-neutral-600 mt-1">{n.time}</p>
            </div>
            <button onClick={e => { e.stopPropagation(); setNotifications(prev => prev.filter(x => x.id !== n.id)); }}
              className="text-neutral-600 hover:text-white transition-colors flex-shrink-0 mt-0.5">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        ))}
      </div>
      <div className="px-4 py-2 border-t border-neutral-800">
        <button onClick={onClose} className="w-full text-xs text-neutral-500 hover:text-white transition-colors py-1">Close</button>
      </div>
    </div>
  );
}

// ─── Global Search ─────────────────────────────────────────────────────────────
function GlobalSearch({ onNavigate }: { onNavigate: (tab: string) => void }) {
  const [query,   setQuery]   = useState('');
  const [results, setResults] = useState<Booking[]>([]);
  const [open,    setOpen]    = useState(false);
  const [loading, setLoading] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  useEffect(() => {
    if (query.trim().length < 2) { setResults([]); setOpen(false); return; }
    setLoading(true);
    const t = setTimeout(async () => {
      try {
        const res  = await fetch(`${API_URL}/bookings?search=${encodeURIComponent(query)}&limit=5`);
        const data = await res.json();
        setResults(data.bookings || []);
        setOpen(true);
      } catch { setResults([]); }
      finally { setLoading(false); }
    }, 300);
    return () => clearTimeout(t);
  }, [query]);

  const clear = () => { setQuery(''); setOpen(false); setResults([]); };

  return (
    <div ref={ref} className="relative w-full md:w-auto">
      <Search className="absolute left-3 top-2.5 h-4 w-4 text-neutral-500" />
      <input type="text" value={query} onChange={e => setQuery(e.target.value)}
        onFocus={() => results.length > 0 && setOpen(true)}
        placeholder="Global Search..."
        className="bg-neutral-900 border border-neutral-800 rounded-full pl-9 pr-9 py-1.5 text-sm text-white focus:outline-none focus:border-[#FFD700] w-full md:w-64 transition-all placeholder:text-neutral-600"
      />
      {query && (
        <button onClick={clear} className="absolute right-3 top-2.5 text-neutral-500 hover:text-white transition-colors">
          <X className="w-3.5 h-3.5" />
        </button>
      )}
      {open && (
        <div className="absolute top-full mt-2 left-0 w-full md:w-80 bg-neutral-900 border border-neutral-700 rounded-xl shadow-2xl z-50 overflow-hidden">
          {loading ? (
            <div className="p-4 text-center text-neutral-500 text-sm">Searching...</div>
          ) : results.length === 0 ? (
            <div className="p-4 text-center text-neutral-500 text-sm">No results for "{query}"</div>
          ) : (
            <>
              <div className="px-4 py-2 border-b border-neutral-800 text-xs text-neutral-500">
                {results.length} result{results.length !== 1 ? 's' : ''} found
              </div>
              {results.map(b => (
                <button key={b.id} onClick={() => { onNavigate('bookings'); clear(); }}
                  className="w-full px-4 py-3 hover:bg-neutral-800 transition-colors text-left border-b border-neutral-800/50 last:border-0">
                  <div className="flex justify-between items-center">
                    <span className="text-white text-sm font-medium">{b.customer}</span>
                    <span className="text-[10px] font-mono text-neutral-500">{b.id}</span>
                  </div>
                  <div className="text-xs text-neutral-500 mt-0.5">{b.service} · {b.date}</div>
                </button>
              ))}
              <button onClick={() => { onNavigate('bookings'); clear(); }}
                className="w-full px-4 py-2.5 text-xs text-[#FFD700] hover:bg-neutral-800 transition-colors font-medium text-center">
                See all results in Bookings →
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Recent Bookings Table ─────────────────────────────────────────────────────
function RecentBookingsTable({ onViewAll }: { onViewAll: () => void }) {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading,  setLoading]  = useState(true);

  useEffect(() => {
    fetch(`${API_URL}/bookings?limit=8`)
      .then(r => r.json())
      .then(d => setBookings(d.bookings || []))
      .catch(() => setBookings([]))
      .finally(() => setLoading(false));
  }, []);

  const changeStatus = async (id: string, status: BookingStatus) => {
    try {
      await fetch(`${API_URL}/bookings/${id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      setBookings(prev => prev.map(b => b.id === id ? { ...b, status } : b));
    } catch { alert('Failed to update status'); }
  };

  const statusStyle: Record<BookingStatus, string> = {
    'Pending':     'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30',
    'In Progress': 'bg-blue-500/20   text-blue-400   border border-blue-500/30',
    'Completed':   'bg-green-500/20  text-green-400  border border-green-500/30',
    'Cancelled':   'bg-red-500/20    text-red-400    border border-red-500/30',
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-white font-bold text-base md:text-lg">Recent Bookings</h3>
        <button onClick={onViewAll} className="text-xs text-[#FFD700] hover:underline transition-colors">View all →</button>
      </div>
      <div className="bg-neutral-900 border border-neutral-800 rounded-xl overflow-hidden flex-1">
        {loading ? (
          <div className="flex items-center justify-center h-48">
            <div className="w-8 h-8 border-2 border-[#FFD700] border-t-transparent rounded-full animate-spin" />
          </div>
        ) : bookings.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 gap-2">
            <p className="text-neutral-500 text-sm">No bookings yet.</p>
            <button onClick={onViewAll} className="text-[#FFD700] text-xs hover:underline">Create one in Bookings →</button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-neutral-950 border-b border-neutral-800">
                  {['Booking ID', 'Customer', 'Service', 'Date', 'Status', 'Actions'].map(h => (
                    <th key={h} className={`px-3 md:px-4 py-3 text-xs font-bold text-[#FFD700] text-left whitespace-nowrap ${h === 'Actions' ? 'text-right' : ''}`}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-800/50">
                {bookings.map(b => (
                  <tr key={b.id} className="hover:bg-neutral-800/30 transition-colors">
                    <td className="px-3 md:px-4 py-3 font-mono text-xs text-neutral-500">{b.id}</td>
                    <td className="px-3 md:px-4 py-3 text-white text-sm font-medium whitespace-nowrap">{b.customer}</td>
                    <td className="px-3 md:px-4 py-3 text-neutral-400 text-xs max-w-[140px] truncate">{b.service}</td>
                    <td className="px-3 md:px-4 py-3 text-neutral-500 text-xs whitespace-nowrap">{b.date}</td>
                    <td className="px-3 md:px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium whitespace-nowrap ${statusStyle[b.status]}`}>{b.status}</span>
                    </td>
                    <td className="px-3 md:px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button title="Start" onClick={() => changeStatus(b.id, 'In Progress')} disabled={b.status === 'In Progress'}
                          className="p-1 text-neutral-600 hover:text-[#FFD700] transition-colors disabled:opacity-20 disabled:cursor-not-allowed">
                          <PlayCircle className="w-3.5 h-3.5" />
                        </button>
                        <button title="Complete" onClick={() => changeStatus(b.id, 'Completed')} disabled={b.status === 'Completed'}
                          className="p-1 text-neutral-600 hover:text-green-400 transition-colors disabled:opacity-20 disabled:cursor-not-allowed">
                          <CheckCircle className="w-3.5 h-3.5" />
                        </button>
                        <button title="Cancel" onClick={() => changeStatus(b.id, 'Cancelled')} disabled={b.status === 'Cancelled'}
                          className="p-1 text-neutral-600 hover:text-red-400 transition-colors disabled:opacity-20 disabled:cursor-not-allowed">
                          <XCircle className="w-3.5 h-3.5" />
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
    </div>
  );
}

// ─── User Menu ─────────────────────────────────────────────────────────────────
function UserMenu({ user, onLogout }: { user: DashboardProps['user']; onLogout: () => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <div ref={ref} className="relative flex items-center gap-2 md:gap-3 pl-3 md:pl-6 border-l border-neutral-800">
      <div className="text-right hidden lg:block">
        <p className="text-sm font-bold text-white">{user.name}</p>
        <p className="text-xs text-neutral-500">{user.role}</p>
      </div>
      <button
        onClick={() => setOpen(v => !v)}
        className="flex items-center gap-1.5 h-8 w-8 md:h-9 md:w-9 rounded-full bg-[#FFD700] items-center justify-center text-black font-black hover:bg-[#FFD700]/90 transition-colors relative"
      >
        <span className="font-black text-sm">{user.name.charAt(0).toUpperCase()}</span>
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-52 bg-neutral-900 border border-neutral-700 rounded-xl shadow-2xl z-50 overflow-hidden">
          {/* User info */}
          <div className="px-4 py-3 border-b border-neutral-800">
            <p className="text-sm font-bold text-white">{user.name}</p>
            <p className="text-xs text-neutral-500">{user.role}</p>
            <p className="text-xs text-neutral-600 mt-0.5 font-mono">@{user.username}</p>
          </div>
          {/* Logout */}
          <button
            onClick={() => { setOpen(false); onLogout(); }}
            className="w-full px-4 py-3 flex items-center gap-3 text-sm text-red-400 hover:bg-red-500/10 transition-colors"
          >
            <LogOut className="w-4 h-4" />
            Sign Out
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Mobile Menu Button ────────────────────────────────────────────────────────
function MobileMenuButton({ onClick, isOpen }: { onClick: () => void; isOpen: boolean }) {
  return (
    <button
      onClick={onClick}
      className="lg:hidden text-neutral-400 hover:text-[#FFD700] transition-colors p-2"
      aria-label="Toggle menu"
    >
      {isOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
    </button>
  );
}

// ─── Mobile Search Toggle ──────────────────────────────────────────────────────
function MobileSearchToggle({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="md:hidden text-neutral-400 hover:text-[#FFD700] transition-colors p-2"
      aria-label="Toggle search"
    >
      <Search className="h-5 w-5" />
    </button>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN DASHBOARD
// ═══════════════════════════════════════════════════════════════════════════════
export function Dashboard({ user, onLogout }: DashboardProps) {
  const [activeTab,         setActiveTab]         = useState('dashboard');
  const [showNotifications, setShowNotifications] = useState(false);
  const [unreadCount,       setUnreadCount]       = useState(3);
  const [mobileMenuOpen,    setMobileMenuOpen]    = useState(false);
  const [mobileSearchOpen,  setMobileSearchOpen]  = useState(false);
  const notifRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setShowNotifications(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Close mobile menu when tab changes
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [activeTab]);

  // Prevent body scroll when mobile menu is open
  useEffect(() => {
    if (mobileMenuOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [mobileMenuOpen]);

  const dashboardHome = (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="mb-6 md:mb-8">
        <h2 className="text-2xl md:text-3xl font-bold text-white mb-2">
          Welcome back, {user.name.split(' ')[0]} 👋
        </h2>
        <p className="text-sm md:text-base text-neutral-400">
          Here's what's happening at Anura Tyres today —{' '}
          <span className="hidden sm:inline">
            {new Date().toLocaleDateString('en-US', {
              weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
            })}
          </span>
          <span className="sm:hidden">
            {new Date().toLocaleDateString('en-US', {
              month: 'short', day: 'numeric', year: 'numeric'
            })}
          </span>
        </p>
      </div>

      <StatsCards />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 md:gap-8 mt-4">
        <div className="lg:col-span-2 h-auto lg:h-[600px]">
          <RecentBookingsTable onViewAll={() => setActiveTab('bookings')} />
        </div>
        <div className="lg:col-span-1 space-y-6 md:space-y-8">
          <StaffAssignment />
          
        </div>
      </div>
    </div>
  );

  const renderContent = () => {
    switch (activeTab) {
      case 'dashboard': return dashboardHome;
      case 'bookings':  return <BookingsPage />;
      case 'staff':     return <StaffPage />;
      case 'inventory': return <InventoryPage />;
      case 'reports':   return <ReportsPage />;
      case 'settings':  return <SettingsPage />;
      case 'user-management': return <UserManagement />;
      default:          return <div className="text-white">Page not found</div>;
    }
  };

  return (
    <div className="min-h-screen bg-black text-white font-sans selection:bg-[#FFD700] selection:text-black">
      {/* Desktop Sidebar */}
      <div className="hidden lg:block">
        <Sidebar activeTab={activeTab} setActiveTab={setActiveTab} />
      </div>

      {/* Mobile Sidebar Overlay */}
      {mobileMenuOpen && (
        <>
          <div 
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 lg:hidden"
            onClick={() => setMobileMenuOpen(false)}
          />
          <div className="fixed inset-y-0 left-0 w-64 z-50 lg:hidden">
            <Sidebar activeTab={activeTab} setActiveTab={setActiveTab} />
          </div>
        </>
      )}

      <main className="lg:pl-64 min-h-screen">
        <header className="h-14 md:h-16 border-b border-neutral-800 flex items-center justify-between px-3 md:px-8 sticky top-0 bg-black/80 backdrop-blur-md z-40">
          <div className="flex items-center gap-3">
            <MobileMenuButton 
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              isOpen={mobileMenuOpen}
            />
            <div className="hidden md:flex items-center text-neutral-400 text-sm">
              <span onClick={() => setActiveTab('dashboard')} className="hover:text-white cursor-pointer transition-colors">Admin</span>
              <span className="mx-2 text-neutral-700">/</span>
              <span className="text-[#FFD700] font-medium capitalize">{activeTab}</span>
            </div>
            <div className="md:hidden text-[#FFD700] font-bold text-sm capitalize">
              {activeTab}
            </div>
          </div>

          <div className="flex items-center gap-2 md:gap-6">
            {/* Mobile Search Toggle */}
            <MobileSearchToggle onClick={() => setMobileSearchOpen(!mobileSearchOpen)} />

            {/* Desktop Search */}
            <div className="hidden md:block">
              <GlobalSearch onNavigate={setActiveTab} />
            </div>

            {/* Notifications */}
            <div ref={notifRef} className="relative">
              <button onClick={() => { setShowNotifications(v => !v); setUnreadCount(0); }}
                className="relative text-neutral-400 hover:text-[#FFD700] transition-colors p-2">
                <Bell className="h-4 w-4 md:h-5 md:w-5" />
                {unreadCount > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 h-4 w-4 bg-[#FF0000] rounded-full text-[9px] font-bold text-white flex items-center justify-center animate-pulse">
                    {unreadCount}
                  </span>
                )}
              </button>
              {showNotifications && <NotificationsPanel onClose={() => setShowNotifications(false)} />}
            </div>

            {/* User menu with logout */}
            <UserMenu user={user} onLogout={onLogout} />
          </div>
        </header>

        {/* Mobile Search Bar */}
        {mobileSearchOpen && (
          <div className="md:hidden px-3 py-3 border-b border-neutral-800 bg-black">
            <GlobalSearch onNavigate={(tab) => { setActiveTab(tab); setMobileSearchOpen(false); }} />
          </div>
        )}

        <div className="p-4 md:p-8 max-w-[1600px] mx-auto">{renderContent()}</div>
      </main>
    </div>
  );
}