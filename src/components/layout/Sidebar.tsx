// Sidebar.tsx — updated to accept allowedTabs prop for RBAC nav filtering
import React from 'react';
import {
  LayoutDashboard, Calendar, Users, Package, Settings,
  Shield, Building2, UserCog, Car, Wrench, ChevronRight
} from 'lucide-react';
import logo from '../../assets/logo.png';

interface SidebarProps {
  activeTab:    string;
  setActiveTab: (tab: string) => void;
  allowedTabs?: string[]; // if provided, only these tabs are shown
}

const ALL_NAV_ITEMS = [
  { id: 'dashboard',       label: 'Dashboard',         icon: LayoutDashboard,  group: 'main' },
  { id: 'bookings',        label: 'Bookings',           icon: Calendar,         group: 'main' },
  { id: 'staff',           label: 'Staff',              icon: Users,            group: 'main' },
  { id: 'inventory',       label: 'Inventory',          icon: Package,          group: 'main' },
  { id: 'customers',       label: 'Customers',          icon: Car,              group: 'main' },
  { id: 'jobs',            label: 'Job Management',     icon: Wrench,           group: 'main' },
  { id: 'corporate-data',  label: 'Corporate',          icon: Building2,        group: 'admin' },
  { id: 'user-management', label: 'User Management',    icon: UserCog,          group: 'admin' },
  { id: 'settings',        label: 'Settings',           icon: Settings,         group: 'bottom' },
];

export function Sidebar({ activeTab, setActiveTab, allowedTabs }: SidebarProps) {
  // If allowedTabs provided, filter nav items; otherwise show all
  const visibleItems = allowedTabs
    ? ALL_NAV_ITEMS.filter(item => allowedTabs.includes(item.id))
    : ALL_NAV_ITEMS;

  const mainItems   = visibleItems.filter(i => i.group === 'main');
  const adminItems  = visibleItems.filter(i => i.group === 'admin');
  const bottomItems = visibleItems.filter(i => i.group === 'bottom');

  const NavButton = ({ item }: { item: typeof ALL_NAV_ITEMS[0] }) => {
    const Icon    = item.icon;
    const isActive = activeTab === item.id;
    return (
      <button
        onClick={() => setActiveTab(item.id)}
        className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all group relative ${
          isActive
            ? 'bg-[#FFD700] text-black shadow-lg shadow-[#FFD700]/20'
            : 'text-neutral-400 hover:bg-neutral-800 hover:text-white'
        }`}
      >
        <Icon className={`w-4 h-4 flex-shrink-0 ${isActive ? 'text-black' : ''}`} />
        <span className="truncate">{item.label}</span>
        {isActive && <ChevronRight className="w-3.5 h-3.5 ml-auto text-black/60" />}
      </button>
    );
  };

  return (
    <aside className="fixed left-0 top-0 h-full w-64 bg-neutral-950 border-r border-neutral-800 flex flex-col z-30">
      {/* Logo */}
      <div className="px-5 py-5 border-b border-neutral-800 flex items-center gap-3 flex-shrink-0">
        <img src={logo} alt="Anura Tyres" className="h-9 w-auto object-contain" />
        <div className="min-w-0">
          <p className="text-white font-black text-sm leading-tight">ANURA TYRES</p>
          <p className="text-neutral-500 text-[10px] tracking-wider">Management</p>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
        {/* Main nav */}
        {mainItems.length > 0 && (
          <div className="space-y-1">
            {mainItems.map(item => <NavButton key={item.id} item={item} />)}
          </div>
        )}

        {/* Admin-only section */}
        {adminItems.length > 0 && (
          <div className="pt-4 mt-4 border-t border-neutral-800 space-y-1">
            <p className="text-[10px] text-neutral-600 font-bold uppercase tracking-widest px-3 mb-2 flex items-center gap-1.5">
              <Shield className="w-3 h-3" /> Administration
            </p>
            {adminItems.map(item => <NavButton key={item.id} item={item} />)}
          </div>
        )}
      </nav>

      {/* Bottom settings */}
      {bottomItems.length > 0 && (
        <div className="px-3 pb-4 pt-2 border-t border-neutral-800 space-y-1">
          {bottomItems.map(item => <NavButton key={item.id} item={item} />)}
        </div>
      )}
    </aside>
  );
}