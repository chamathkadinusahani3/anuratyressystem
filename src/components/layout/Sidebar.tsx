import React from 'react';
import {
  LayoutDashboard,
  Calendar,
  Users,
  Package,
  FileBarChart,
  Settings,
  LogOut } from
'lucide-react';
interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
}
export function Sidebar({ activeTab, setActiveTab }: SidebarProps) {
  const menuItems = [
  {
    id: 'dashboard',
    label: 'Dashboard',
    icon: LayoutDashboard
  },
  {
    id: 'bookings',
    label: 'Bookings',
    icon: Calendar
  },
  {
    id: 'staff',
    label: 'Staff',
    icon: Users
  },
  {
    id: 'inventory',
    label: 'Inventory',
    icon: Package
  },
  {
    id: 'reports',
    label: 'Reports',
    icon: FileBarChart
  },
  {
    id: 'settings',
    label: 'Settings',
    icon: Settings
  }];

  return (
    <aside className="w-64 bg-black border-r border-neutral-800 flex flex-col h-screen fixed left-0 top-0 z-50">
      <div className="p-6 border-b border-neutral-800 flex items-center gap-3">
  {/* Logo */}
  <img
    src="/logo.png"
    alt="Anura Tyres Logo"
    className="h-12 w-12 object-contain"
  />

  {/* Title */}
  <div>
    <h1 className="text-xl font-black text-white tracking-tight leading-none">
      ANURA<span className="text-[#FFD700]">TYRES</span>
    </h1>
    <p className="text-xs text-neutral-500">Service Management</p>
  </div>
</div>

      <nav className="flex-1 py-6 px-3 space-y-1">
        {menuItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`w-full flex items-center px-3 py-3 text-sm font-medium rounded-md transition-all duration-200 group
                ${isActive ? 'bg-[#FFD700] text-black' : 'text-neutral-400 hover:bg-neutral-900 hover:text-[#FF0000]'}`}>

              <Icon
                className={`mr-3 h-5 w-5 transition-colors
                  ${isActive ? 'text-black' : 'text-neutral-500 group-hover:text-[#FF0000]'}
                `} />

              {item.label}
            </button>);

        })}
      </nav>

      <div className="p-4 border-t border-neutral-800">
        <button className="w-full flex items-center px-3 py-3 text-sm font-medium text-neutral-400 rounded-md hover:bg-neutral-900 hover:text-[#FF0000] transition-colors group">
          <LogOut className="mr-3 h-5 w-5 text-neutral-500 group-hover:text-[#FF0000]" />
          Sign Out
        </button>
      </div>
    </aside>);

}