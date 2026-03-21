import React from 'react';
import { LayoutDashboard, Receipt, Package, Users, History, LogOut, Plus, Smartphone, Settings, LayoutList, User, Crown } from 'lucide-react';
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

  // Navigation sections
  const sections = [
    {
      title: 'GENERAL',
      items: [
        { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
        { id: 'history', label: 'Bill History', icon: History },
        { id: 'customers', label: 'Clients', icon: Users },
        { id: 'inventory', label: 'Stock', icon: Package },
      ]
    },
    {
      title: 'SHOP MANAGER',
      items: [
        { id: 'sp-manager', label: 'SP Manager', icon: LayoutList },
        { id: 'payment-manager', label: 'Payment Manager', icon: Receipt },
        { id: 'product-manager', label: 'Product Manager', icon: Package },
      ]
    },
    {
      title: 'SYSTEM',
      items: [
        { id: 'subscription-manager', label: 'Subscription', icon: Crown },
        { id: 'settings', label: 'Settings', icon: Settings },
      ]
    }
  ];

  // Mobile navigation items (flattened)
  const mobileOrder = ['dashboard', 'inventory', 'billing', 'history', 'customers'];
  const mobileNavItemsMapping: Record<string, { id: string; label: string; icon: any }> = {
    dashboard: { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    billing: { id: 'billing', label: 'Create Bill', icon: Receipt },
    inventory: { id: 'inventory', label: 'Stock', icon: Package },
    history: { id: 'history', label: 'Bill History', icon: History },
    customers: { id: 'customers', label: 'Users', icon: Users },
  };

  const menuItems = mobileOrder.map(key => ({
    id: mobileNavItemsMapping[key].id,
    label: mobileNavItemsMapping[key].label,
    icon: mobileNavItemsMapping[key].icon,
  }));

  return (
    <>
      {/* Desktop Sidebar - Dark Theme */}
      <aside className="hidden md:flex w-72 bg-[#111617] flex-col h-full transition-all duration-300 z-20 border-r border-white/5">
        {/* Logo */}
        <div className="h-28 flex items-center px-8">
          <img src="/Logo (White).png" alt="Instabill" className="h-10 object-contain transform transition-transform hover:scale-105 duration-300" />
        </div>

        {/* Navigation */}
        <nav className="mt-2 px-6 space-y-8 flex-1 overflow-y-auto no-scrollbar pb-8">
          {sections.map((section) => (
            <div key={section.title} className="space-y-4">
              <h3 className="px-4 text-[11px] font-bold text-gray-500 tracking-[0.2em] uppercase">
                {section.title}
              </h3>
              <div className="space-y-1.5">
                {section.items.map((item) => {
                  const isActive = activeView === item.id;

                  return (
                    <button
                      key={item.id}
                      onClick={() => setActiveView(item.id)}
                      className={`w-full group flex items-center gap-4 px-4 py-3.5 text-sm font-semibold rounded-2xl transition-all duration-300 relative overflow-hidden ${isActive
                        ? 'bg-gradient-to-r from-[#88de7d]/10 to-transparent text-white'
                        : 'text-gray-400 hover:text-white hover:bg-white/5'
                        }`}
                    >
                      {/* Active Indicator */}
                      {isActive && (
                        <div className="absolute right-0 top-1/2 -translate-y-1/2 w-[4px] h-8 bg-[#88de7d] rounded-l-full shadow-[0_0_12px_rgba(136,222,125,0.8)]" />
                      )}

                      <item.icon
                        size={22}
                        className={`transition-colors duration-300 ${isActive ? 'text-[#88de7d]' : 'group-hover:text-[#88de7d]/70 text-gray-400'}`}
                      />
                      <span className="tracking-wide">{item.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        {/* Profile Section at Bottom */}
        <div className="px-5 pb-6 pt-4">
          <div className="relative flex items-center gap-3.5 p-3 rounded-2xl bg-white/[0.02] border border-white/5 hover:bg-white/[0.06] hover:border-white/10 transition-all duration-300 group/profile">
            {/* Avatar container */}
            <div className="relative shrink-0">
              <div className="w-11 h-11 rounded-[14px] overflow-hidden border border-white/10 group-hover/profile:border-[#88de7d]/40 transition-colors duration-300 bg-[#88de7d]/10 flex items-center justify-center text-[#88de7d]">
                <User size={22} strokeWidth={2.5} />
              </div>
              <div className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 bg-[#88de7d] border-2 border-[#111617] rounded-full shadow-[0_0_8px_rgba(136,222,125,0.4)]" />
            </div>

            {/* User Info */}
            <div className="flex flex-col flex-1 min-w-0 justify-center">
              <span className="text-[14px] font-bold text-white tracking-wide truncate group-hover/profile:text-[#88de7d] transition-colors duration-300">
                {user?.email?.split('@')[0] === '9423791137' ? '94237 91137' : (user?.email?.split('@')[0]?.charAt(0).toUpperCase() + user?.email?.split('@')[0]?.slice(1) || 'Ayush')}
              </span>
              <span className="text-[10px] font-bold text-gray-400/80 uppercase tracking-widest mt-0.5">Administrator</span>
            </div>

            {/* Logout Button */}
            <button
              onClick={onLogout}
              className="p-2 text-gray-500 hover:text-red-400 hover:bg-red-400/10 rounded-xl transition-all duration-300 shrink-0"
              title="Log out"
            >
              <LogOut size={18} strokeWidth={2.5} />
            </button>
          </div>
        </div>
      </aside>

      {/* Mobile Bottom Navigation */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 z-[100] pb-safe overflow-hidden pointer-events-none">
        <div className={`transition-transform duration-500 ease-in-out transform ${activeView === 'billing' ? 'translate-y-full' : 'translate-y-0'} pointer-events-auto`}>
          <div className="bg-white/90 backdrop-blur-3xl border-t border-gray-100 shadow-[0_-8px_30px_-5px_rgba(0,0,0,0.05)] rounded-t-3xl h-[72px] px-2 flex items-center">
            <InteractiveMenu
              items={menuItems.map(item => item.id === 'billing' ? { ...item, icon: Plus } : item)}
              activeItem={activeView}
              onItemSelect={(id) => setActiveView(id)}
              accentColor="#111617"
            />
          </div>
        </div>
      </div>
    </>
  );
};

export default Sidebar;