import React from 'react';
import { LayoutDashboard, Receipt, Package, Users, History, LogOut, Plus, Smartphone, Settings, LayoutList } from 'lucide-react';
import { usePWAInstall } from '../hooks/usePWAInstall';
import { InteractiveMenu } from './ui/modern-mobile-menu';
import { auth } from '../firebaseConfig';

interface SidebarProps {
  activeView: string;
  setActiveView: (view: string) => void;
  onLogout: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({ activeView, setActiveView, onLogout }) => {
  const { isInstallable, installApp } = usePWAInstall();
  const user = auth.currentUser;

  // Navigation items
  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'history', label: 'Invoices', icon: Receipt },
    { id: 'customers', label: 'Clients', icon: Users },
    { id: 'inventory', label: 'Stock', icon: Package },
    { id: 'sp-manager', label: 'SP Manager', icon: LayoutList },
    { id: 'product-manager', label: 'Pending Products', icon: Package },
    { id: 'settings', label: 'Settings', icon: Settings },
  ];

  // Mobile navigation items
  const mobileOrder = ['dashboard', 'inventory', 'billing', 'history', 'customers'];
  const mobileNavItems = {
    dashboard: { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    billing: { id: 'billing', label: 'Create Bill', icon: Receipt },
    inventory: { id: 'inventory', label: 'Stock', icon: Package },
    history: { id: 'history', label: 'Bill History', icon: History },
    customers: { id: 'customers', label: 'Users', icon: Users },
  };

  const menuItems = mobileOrder.map(key => ({
    id: mobileNavItems[key as keyof typeof mobileNavItems].id,
    label: mobileNavItems[key as keyof typeof mobileNavItems].label,
    icon: mobileNavItems[key as keyof typeof mobileNavItems].icon,
  }));

  return (
    <>
      {/* Desktop Sidebar - Dark Theme */}
      <aside className="hidden md:flex w-64 bg-[#12332A] flex-col h-full transition-all duration-300 z-20">
        {/* Logo */}
        <div className="h-24 flex items-center px-8">
          <div className="flex items-center gap-3 text-white">
            <div className="w-10 h-10 bg-[#D4F34A] rounded-xl flex items-center justify-center text-[#12332A] shadow-lg">
              {/* Minimal Leaf SVG */}
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10Z" />
                <path d="M2 21c0-3 1.85-5.36 5.08-6C9.5 14.52 12 13 13 12" />
              </svg>
            </div>
            <div className="flex flex-col">
              <span className="text-lg font-bold tracking-tight text-white leading-tight">Ayush</span>
              <span className="text-sm font-semibold text-[#D4F34A] tracking-wide">Ayurveda</span>
            </div>
          </div>
        </div>

        {/* Navigation */}
        <nav className="mt-4 px-4 space-y-2 flex-1">
          {navItems.map((item) => {
            const isActive = activeView === item.id ||
              (item.id === 'billing' && activeView === 'inventory');

            return (
              <button
                key={item.id}
                onClick={() => setActiveView(item.id)}
                className={`w-full flex items-center gap-3 px-4 py-3 text-sm font-medium rounded-xl transition-all ${isActive
                  ? 'bg-[#D4F34A]/15 text-[#D4F34A] border-r-[3px] border-[#D4F34A]'
                  : 'text-gray-400 hover:bg-white/5 hover:text-[#D4F34A]'
                  }`}
              >
                <item.icon size={20} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>

        {/* Install App Button */}
        {isInstallable && (
          <div className="px-4 mb-2">
            <button
              onClick={installApp}
              className="w-full flex items-center gap-3 px-4 py-3 text-gray-400 hover:text-[#D4F34A] hover:bg-white/5 rounded-xl transition-all text-sm font-medium"
            >
              <Smartphone size={20} />
              <span>Install App</span>
            </button>
          </div>
        )}

        {/* Profile Section at Bottom */}
        <div className="p-6 border-t border-white/10">
          <div className="flex items-center gap-3">
            <img
              src={user ? `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.uid}` : 'https://api.dicebear.com/7.x/avataaars/svg?seed=default'}
              alt="User Profile"
              className="w-10 h-10 rounded-full border-2 border-[#D4F34A] object-cover"
            />
            <div className="flex flex-col flex-1 min-w-0">
              <span className="text-sm font-semibold text-white truncate">
                {user?.email?.split('@')[0] || 'User'}
              </span>
              <span className="text-xs text-gray-400">Store Manager</span>
            </div>
            <button
              onClick={onLogout}
              className="p-2 text-gray-400 hover:text-red-400 hover:bg-white/5 rounded-lg transition-all"
              title="Log out"
            >
              <LogOut size={18} />
            </button>
          </div>
        </div>
      </aside>

      {/* Mobile Bottom Navigation */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 z-[100] pb-safe">
        <div className="bg-white/90 backdrop-blur-3xl border-t border-gray-100 shadow-[0_-8px_30px_-5px_rgba(0,0,0,0.05)] rounded-t-3xl h-[72px] px-2 flex items-center">
          <InteractiveMenu
            items={menuItems.map(item => item.id === 'billing' ? { ...item, icon: Plus } : item)}
            activeItem={activeView}
            onItemSelect={(id) => setActiveView(id)}
            accentColor="#132c25"
          />
        </div>
      </div>
    </>
  );
};

export default Sidebar;