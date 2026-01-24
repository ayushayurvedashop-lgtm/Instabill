import React, { useState, useEffect, useRef } from 'react';
import Sidebar from './components/Sidebar';
import Dashboard from './components/Dashboard';
import Billing from './components/Billing';
import Inventory from './components/Inventory';
import Customers from './components/Customers';
import BillHistory from './components/BillHistory';
import Settings from './components/Settings'; // Import Settings component

import LandingPage from './components/LandingPage';
import { PublicInvoiceViewer } from './components/PublicInvoiceViewer';
import SPManager from './components/SPManager';
import ProductManager from './components/ProductManager';
import { Bot, Search, Bell, Menu, Flower, Settings as SettingsIcon, LogOut, ListTodo, Mic, LayoutList, Package } from 'lucide-react';
import { auth } from './firebaseConfig';
import VoiceAssistant from './components/VoiceAssistant';
import CreateBillButton from './components/ui/create-bill-button';
import { onAuthStateChanged, signOut, User } from 'firebase/auth';
import { Bill, Tab, BillItem } from './types';
import { EMPTY_BILL } from './constants';
import { store } from './store';

const App: React.FC = () => {
  const [activeView, setActiveView] = useState('dashboard');
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);
  const profileMenuRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (profileMenuRef.current && !profileMenuRef.current.contains(event.target as Node)) {
        setIsProfileMenuOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setAuthLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const handleManualLogin = (user: any) => {
    // This prop is passed to LandingPage but primarily for state update trigger if needed
    setUser(user);
  };

  const handleManualLogout = async () => {
    try {
      localStorage.removeItem('vedabill_user');
      await signOut(auth);
    } catch (error) {
      console.error("Error signing out", error);
    } finally {
      setUser(null);
      setActiveView('dashboard');
    }
  };

  const [tabs, setTabs] = useState<Tab[]>([{
    id: '1',
    title: 'Bill #1',
    bill: {
      ...EMPTY_BILL,
      id: '1',
      billingType: store.getSettings().defaultBillingMode || 'DP'
    }
  }]);
  const [activeTabId, setActiveTabId] = useState<string>('1');
  const [searchQuery, setSearchQuery] = useState('');

  const handleEditBill = (bill: Bill) => {
    const existingTab = tabs.find(t => t.id === bill.id);
    if (existingTab) {
      setActiveTabId(bill.id);
    } else {
      const newTab: Tab = {
        id: bill.id,
        title: `Edit: ${bill.customerName}`,
        bill: bill
      };

      // If current tab is empty/default, replace it
      if (tabs.length === 1 && tabs[0].id === '1' && tabs[0].bill.items.length === 0 && !tabs[0].bill.customerName) {
        setTabs([newTab]);
      } else {
        setTabs([...tabs, newTab]);
      }
      setActiveTabId(bill.id);
    }
    setActiveView('billing');
  };

  const handleVoiceAddItems = (newItems: BillItem[]) => {
    // 1. Find or create active tab
    // Ideally we add to the 'activeTabId' if exists, or current visible one.
    // Logic similar to handleEditBill but modifying existing.

    setTabs(currentTabs => {
      return currentTabs.map(tab => {
        if (tab.id === activeTabId) {
          // Add items to this bill
          // We need to verify if item already exists -> increment quantity
          // newItems might have duplicates among themselves too? (Gemini usually aggregates)

          const currentItems = [...tab.bill.items];

          newItems.forEach(newItem => {
            const existingItemIndex = currentItems.findIndex(i => i.id === newItem.id);
            if (existingItemIndex > -1) {
              const existing = currentItems[existingItemIndex];
              const newQty = existing.quantity + newItem.quantity;
              currentItems[existingItemIndex] = {
                ...existing,
                quantity: newQty,
                totalSp: existing.sp * newQty
              };
            } else {
              currentItems.push(newItem);
            }
          });

          // Recalculate Totals
          const newTotalAmount = currentItems.reduce((sum, item) => sum + (item.currentPrice * item.quantity), 0);
          const newTotalSp = currentItems.reduce((sum, item) => sum + item.totalSp, 0);

          return {
            ...tab,
            bill: {
              ...tab.bill,
              items: currentItems,
              totalAmount: newTotalAmount,
              totalSp: newTotalSp
            }
          };
        }
        return tab;
      });
    });

    // Switch to billing view to see changes
    setActiveView('billing');
  };

  const renderContent = () => {
    switch (activeView) {
      case 'dashboard':
        return <Dashboard setActiveView={setActiveView} onEditBill={handleEditBill} searchQuery={searchQuery} />;
      case 'billing':
        return (
          <Billing
            tabs={tabs}
            setTabs={setTabs}
            activeTabId={activeTabId}
            setActiveTabId={setActiveTabId}
          />
        );
      case 'inventory':
        return <Inventory />;
      case 'customers':
        return <Customers onEditBill={handleEditBill} />;
      case 'history':
        return <BillHistory onEditBill={handleEditBill} />;
      case 'settings':
        return <Settings />;
      case 'sp-manager':
        return <SPManager />;
      case 'product-manager':
        return <ProductManager />;

      case 'assistant':
        return (
          <div className="flex flex-col items-center justify-center h-full text-center p-8 bg-surface rounded-3xl shadow-sm mx-4 mb-20 md:mb-0">
            <div className="bg-primary/20 p-8 rounded-full mb-6">
              <Bot size={64} className="text-dark" />
            </div>
            <h2 className="text-3xl font-bold text-dark mb-2">Ayush Assistant</h2>
            <p className="text-gray-500 max-w-md mb-8">
              We are building a powerful AI assistant trained on Ayurvedic knowledge to help you answer customer queries about products and dosage.
            </p>
            <span className="px-6 py-2 bg-gray-100 text-gray-600 rounded-full text-sm font-semibold">
              Coming Soon
            </span>
          </div>
        );
      default:
        return <Dashboard />;
    }
  };

  if (authLoading) {
    return (
      <div className="h-[100dvh] w-screen bg-bg flex flex-col items-center justify-center text-dark">
        <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mb-4"></div>
        <p className="font-medium animate-pulse">Loading Ayush Ayurveda...</p>
      </div>
    );
  }

  // Check for Public Bill View (Deep Link)
  const isPublicBillView = new URLSearchParams(window.location.search).has('billId');
  if (isPublicBillView) {
    return <PublicInvoiceViewer />;
  }

  if (!user) {
    return <LandingPage onLogin={handleManualLogin} />;
  }

  return (
    <div className="flex h-[100dvh] w-full overflow-hidden bg-bg">
      <Sidebar activeView={activeView} setActiveView={setActiveView} onLogout={handleManualLogout} />

      <div className="flex-1 flex flex-col h-full pt-6 md:pt-8 px-5 md:px-8 relative overflow-hidden">
        {/* Top Header Section */}
        <header className="flex justify-between items-center mb-4 md:mb-6 shrink-0">
          <div className="flex items-center gap-2 md:gap-3 min-w-0">
            {/* Mobile Logo */}
            <div className="md:hidden w-10 h-10 bg-[#12332A] rounded-xl flex items-center justify-center text-[#D4F34A] font-bold shadow-sm shrink-0">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10Z" />
                <path d="M2 21c0-3 1.85-5.36 5.08-6C9.5 14.52 12 13 13 12" />
              </svg>
            </div>
            {/* Page Title - visible on all screens */}
            <h2 className="text-lg md:text-2xl font-bold text-dark capitalize truncate">
              {activeView.replace('-', ' ')}
            </h2>
          </div>

          <div className="flex items-center gap-2 md:gap-6 shrink-0">
            {/* Search Bar - Hidden on mobile */}
            <div className={`relative hidden lg:block ${activeView !== 'dashboard' ? 'invisible' : ''}`}>
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
              <input
                type="text"
                placeholder="Search Bills..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-12 pr-4 py-3 bg-white rounded-full text-sm w-64 focus:outline-none focus:ring-2 focus:ring-primary/50 text-dark placeholder-gray-400 shadow-sm"
              />
            </div>

            <div className="flex items-center gap-2 md:gap-3">
              {/* Voice AI Assistant Trigger */}
              <VoiceAssistant
                isOpen={true}
                onClose={() => { }}
                onAddItems={handleVoiceAddItems}
                trigger={
                  <button
                    className="h-10 md:h-11 bg-white border border-gray-200 text-dark rounded-full flex items-center justify-center gap-1.5 md:gap-2 px-2.5 md:px-3 md:pr-4 hover:shadow-md hover:border-gray-300 shadow-sm transition-all cursor-pointer"
                    style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.05), 0 1px 2px rgba(0,0,0,0.05)' }}
                    title="AI Assistant"
                  >
                    {/* Static Gradient Orb */}
                    <div
                      className="w-5 h-5 md:w-7 md:h-7 rounded-full shrink-0"
                      style={{
                        background: 'linear-gradient(135deg, #a78bfa 0%, #f472b6 50%, #38bdf8 100%)',
                      }}
                    />
                    <span className="text-xs md:text-sm font-semibold text-gray-700">AI Assistant</span>
                  </button>
                }
              />

              {/* Create New Bill Button - Hidden on mobile since bottom nav has it */}
              <CreateBillButton onClick={() => setActiveView('billing')} className="hidden md:flex" />

              {/* Mobile SP Manager Button */}
              <button
                onClick={() => setActiveView('sp-manager')}
                className="md:hidden h-10 w-10 bg-amber-50 rounded-full flex items-center justify-center text-amber-600 border border-amber-200 shadow-sm"
                title="SP Manager"
              >
                <LayoutList size={20} />
              </button>

              <button
                onClick={() => setActiveView('product-manager')}
                className="md:hidden h-10 w-10 bg-orange-50 rounded-full flex items-center justify-center text-orange-600 border border-orange-200 shadow-sm"
                title="Pending Products"
              >
                <Package size={20} />
              </button>
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-auto w-full pb-24 md:pb-8">
          <div key={activeView} className="h-full animate-fade-in">
            {renderContent()}
          </div>
        </main>
      </div>

    </div>
  );
};

export default App;