import {
  LayoutDashboard,
  Calendar,
  Users,
  Package,
  FileBarChart,
  Settings,
  LogOut,
  User,
  Wrench
} from 'lucide-react';

interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
}

// Role Permissions
const ROLE_PERMISSIONS: Record<string, string[]> = {
  Admin: ['dashboard', 'bookings', 'staff', 'inventory', 'reports', 'settings'],
  Manager: ['dashboard', 'bookings', 'staff', 'inventory', 'reports'],
  'Service Advisor': ['dashboard', 'bookings'],
  'Super Admin': ['dashboard', 'bookings', 'staff', 'inventory', 'reports', 'settings', 'user-management'],
};

export function Sidebar({ activeTab, setActiveTab }: SidebarProps) {
  const user = JSON.parse(localStorage.getItem('at_user') || '{}');
  const role = user.role || '';
  
  const hasPermission = (tab: string) => ROLE_PERMISSIONS[role]?.includes(tab);

  const menuItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'bookings', label: 'Bookings', icon: Calendar },
    { id: 'staff', label: 'Staff', icon: Wrench },
    { id: 'inventory', label: 'Inventory', icon: Package },
    { id: 'reports', label: 'Reports', icon: FileBarChart },
    { id: 'settings', label: 'Settings', icon: Settings },
    { id: 'user-management', label: 'User Management', icon: User }
  ];

  const handleLogout = () => {
    localStorage.removeItem('at_user');
    window.location.href = '/login';
  };

  return (
    <aside className="w-64 bg-black border-r border-neutral-800 flex flex-col h-screen fixed left-0 top-0 z-50">
      {/* Header */}
      <div className="p-6 border-b border-neutral-800 flex items-center gap-3">
        <img src="/logo.png" alt="Anura Tyres Logo" className="h-12 w-12 object-contain" />
        <div>
          <h1 className="text-xl font-black text-white tracking-tight leading-none">
            ANURA<span className="text-[#FFD700]">TYRES</span>
          </h1>
          <p className="text-xs text-neutral-500">Service Management</p>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 py-6 px-3 space-y-1">
        {menuItems
          .filter(item => hasPermission(item.id))
          .map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`w-full flex items-center px-3 py-3 text-sm font-medium rounded-md transition-all duration-200 group
                  ${isActive
                      ? 'bg-[#FFD700] text-black'
                      : 'text-neutral-400 hover:bg-neutral-900 hover:text-[#FFD700]'}`}
              >
                <Icon className={`mr-3 h-5 w-5 transition-colors ${isActive ? 'text-black' : 'text-neutral-500 group-hover:text-[#FFD700]'}`} />
                {item.label}
              </button>
            );
          })}
      </nav>

      {/* Footer */}
      <div className="p-4 border-t border-neutral-800">
        <button
          onClick={handleLogout}
          className="w-full flex items-center px-3 py-3 text-sm font-medium text-neutral-400 rounded-md hover:bg-neutral-900 hover:text-[#FFD700] transition-colors group"
        >
          <LogOut className="mr-3 h-5 w-5 text-neutral-500 group-hover:text-[#FFD700]" />
          Sign Out
        </button>
      </div>
    </aside>
  );
}