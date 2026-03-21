import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useBackButton } from './hooks/useBackButton';
import Sidebar from './components/Sidebar';
import Dashboard from './components/Dashboard';
import Billing from './components/Billing';
import Inventory from './components/Inventory';
import Customers from './components/Customers';
import BillHistory from './components/BillHistory';
import Settings from './components/Settings';
import CatalogUpdateModal from './components/CatalogUpdateModal';

import LandingPage from './components/LandingPage';
import { PublicInvoiceViewer } from './components/PublicInvoiceViewer';
import SPManager from './components/SPManager';
import ProductManager from './components/ProductManager';
import PaymentManagerPage from './components/PaymentManagerPage';
import SubscriptionPage from './components/SubscriptionPage';
import SubscriptionManager from './components/SubscriptionManager';
import ExtendSubscriptionPage from './components/ExtendSubscriptionPage';
import TermsAndConditions from './components/TermsAndConditions';
import PrivacyPolicy from './components/PrivacyPolicy';
import RefundPolicy from './components/RefundPolicy';
import { Bot, Search, Bell, Menu, Flower, Settings as SettingsIcon, LogOut, ListTodo, Mic, LayoutList, Package, ChevronLeft, ChevronDown, User, Store, Crown } from 'lucide-react';
import { auth, db } from './firebaseConfig';
import { doc, updateDoc } from 'firebase/firestore';
import CreateBillButton from './components/ui/create-bill-button';
import { onAuthStateChanged, signOut, User as FirebaseUser } from 'firebase/auth';
import { Bill, Tab, BillItem, ShopProfile } from './types';
import { EMPTY_BILL } from './constants';
import { store } from './store';
import { AnimatePresence, motion } from 'framer-motion';
import { getShopProfile } from './services/authService';

const App: React.FC = () => {
  const [activeView, setActiveView] = useState('dashboard');
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [shopProfile, setShopProfile] = useState<ShopProfile | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [splashDone, setSplashDone] = useState(false);
  const [fadeOut, setFadeOut] = useState(false);
  const [splashHidden, setSplashHidden] = useState(false);
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);
  const [isShopManagerOpen, setIsShopManagerOpen] = useState(false);
  const profileMenuRef = useRef<HTMLDivElement>(null);
  const shopManagerRef = useRef<HTMLDivElement>(null);
  const [showCatalogUpdate, setShowCatalogUpdate] = useState(false);

  // Back button: navigate from any view back to dashboard
  const handleBackToHome = useCallback(() => {
    setActiveView('dashboard');
  }, []);
  useBackButton(activeView !== 'dashboard', handleBackToHome);

  // Splash screen timer
  useEffect(() => {
    const splashTimer = setTimeout(() => {
      setSplashDone(true);
    }, 3500);
    return () => clearTimeout(splashTimer);
  }, []);

  // Trigger fade-out when both auth and splash are done, then hide after animation
  useEffect(() => {
    if (!authLoading && splashDone && !fadeOut) {
      setFadeOut(true);
      // Wait for CSS fade-out transition to complete before unmounting
      const hideTimer = setTimeout(() => {
        setSplashHidden(true);
      }, 500);
      return () => clearTimeout(hideTimer);
    }
  }, [authLoading, splashDone, fadeOut]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (profileMenuRef.current && !profileMenuRef.current.contains(event.target as Node)) {
        setIsProfileMenuOpen(false);
      }
      if (shopManagerRef.current && !shopManagerRef.current.contains(event.target as Node)) {
        setIsShopManagerOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        setUser(currentUser);
        // Try to load shop profile and initialize store
        try {
          const profile = await getShopProfile(currentUser.uid);
          if (profile) {
            setShopProfile(profile);
            store.setShopId(profile.id);
            store.reinitStore();
          } else {
            // Legacy admin without shop profile — init store without shopId (top-level collections)
            store.reinitStore();
          }
        } catch (e) {
          console.warn('Failed to load shop profile, using legacy mode', e);
          store.reinitStore();
        }
      } else {
        setUser(null);
        setShopProfile(null);
      }
      setAuthLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // Check for catalog updates after store is initialized
  useEffect(() => {
    if (!shopProfile) return;
    const checkCatalogUpdate = async () => {
      try {
        const globalVersion = store.getCatalogVersion();
        const shopVersion = await store.getShopCatalogVersion();
        if (globalVersion > 0 && shopVersion < globalVersion) {
          setShowCatalogUpdate(true);
        }
      } catch (e) {
        console.warn('Failed to check catalog version', e);
      }
    };
    // Small delay to let store listeners fire
    const timer = setTimeout(checkCatalogUpdate, 3000);
    return () => clearTimeout(timer);
  }, [shopProfile]);

  const handleManualLogin = (user: any, profile?: ShopProfile) => {
    setUser(user);
    if (profile) {
      setShopProfile(profile);
      store.setShopId(profile.id);
      store.reinitStore();
    } else {
      // Legacy admin — init without shopId
      store.reinitStore();
    }
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
        return <Dashboard setActiveView={setActiveView} onEditBill={handleEditBill} searchQuery={searchQuery} shopProfile={shopProfile} />;
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
        return <Settings shopProfile={shopProfile} onLogout={handleManualLogout} />;
      case 'sp-manager':
        return <SPManager />;
      case 'product-manager':
        return <ProductManager />;
      case 'payment-manager':
        return <PaymentManagerPage />;
      case 'subscription-manager':
        return <SubscriptionManager shopProfile={shopProfile} setActiveView={setActiveView} />;
      case 'subscription-extend':
        return shopProfile ? (
          <SubscriptionPage
            shopProfile={shopProfile}
            onSubscribed={(updated) => setShopProfile(updated)}
            onLogout={handleManualLogout}
          />
        ) : null;
      case 'subscription-extend-page':
        return shopProfile ? (
          <ExtendSubscriptionPage
            shopProfile={shopProfile}
            onExtended={(updated) => { setShopProfile(updated); setActiveView('subscription-manager'); }}
            onBack={() => setActiveView('subscription-manager')}
          />
        ) : null;

      case 'assistant':
        return (
          <div className="flex flex-col items-center justify-center h-full text-center p-8 bg-surface rounded-3xl shadow-sm mx-4 mb-20 md:mb-0">
            <div className="bg-primary/20 p-8 rounded-full mb-6">
              <Bot size={64} className="text-dark" />
            </div>
            <h2 className="text-3xl font-bold text-dark mb-2">Instabill Assistant</h2>
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

  const urlParams = new URLSearchParams(window.location.search);
  const isPublicBillView = urlParams.has('billId');

  const getActiveViewContent = () => {
    if (isPublicBillView) return <PublicInvoiceViewer />;
    if (urlParams.has('terms')) return <TermsAndConditions />;
    if (urlParams.has('privacy')) return <PrivacyPolicy />;
    if (urlParams.has('refund')) return <RefundPolicy />;
    
    if (!user) {
      return <LandingPage onLogin={handleManualLogin} />;
    }

    // Subscription gate
    const isSubscriptionActive = shopProfile &&
      (shopProfile.subscriptionStatus === 'active' || shopProfile.subscriptionStatus === 'trial') &&
      shopProfile.subscriptionEnd &&
      (typeof shopProfile.subscriptionEnd === 'string' 
        ? new Date(shopProfile.subscriptionEnd) > new Date()
        : (shopProfile.subscriptionEnd as any).toDate ? (shopProfile.subscriptionEnd as any).toDate() > new Date() : false);

    if (shopProfile && !isSubscriptionActive) {
      return (
        <SubscriptionPage
          shopProfile={shopProfile}
          onSubscribed={(updated) => setShopProfile(updated)}
          onLogout={handleManualLogout}
        />
      );
    }

    return (
      <div className="flex h-[100dvh] w-full overflow-hidden bg-bg">
        <Sidebar activeView={activeView} setActiveView={setActiveView} onLogout={handleManualLogout} />

        <div className={`flex-1 flex flex-col h-full pt-4 md:pt-6 ${activeView === 'billing' ? 'px-0' : 'px-5'} md:px-8 relative overflow-hidden`}>
          {/* Top Header Section */}
          <header className={`flex justify-between items-center shrink-0 bg-white border-b border-gray-100 px-5 md:px-8 py-3 md:py-4 -mt-4 md:-mt-6 mb-4 md:mb-6 z-20 md:-mx-8 ${activeView === 'billing' ? 'mx-0' : '-mx-5'}`}>
            <div className="flex items-center gap-2 md:gap-3 min-w-0">
              {activeView !== 'dashboard' && (
                <button
                  onClick={() => setActiveView('dashboard')}
                  className="md:hidden w-9 h-9 bg-[#F3F5F2] rounded-full flex items-center justify-center text-[#111617]/50 hover:text-[#111617] hover:bg-[#e8ebe6] transition-all active:scale-95 shrink-0"
                >
                  <ChevronLeft size={20} strokeWidth={2.5} />
                </button>
              )}
              {activeView === 'dashboard' && (
                <img src="/Logo-Icon.png" alt="Instabill" className="h-7 md:hidden object-contain" />
              )}
              <h2 className="text-lg md:text-xl font-bold text-[#111617] capitalize truncate">
                {activeView.replace('-', ' ')}
              </h2>
              {shopProfile && activeView === 'dashboard' && (
                <div className="hidden md:flex items-center gap-1.5 px-3 py-1 bg-[#DAF4D7] rounded-full">
                  <Store size={13} className="text-[#21776A]" />
                  <span className="text-xs font-bold text-[#21776A] truncate max-w-[140px]">{shopProfile.shopName}</span>
                </div>
              )}
            </div>

            <div className="flex items-center gap-2 md:gap-6 shrink-0">
              <div className={`relative hidden lg:flex items-center ${activeView !== 'dashboard' ? 'invisible' : ''}`}>
                <div className="absolute left-3.5 text-gray-400 flex items-center justify-center">
                  <Search size={16} strokeWidth={2.5} />
                </div>
                <input
                  type="text"
                  placeholder="Search bills..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 pr-4 py-2.5 h-[42px] bg-white border border-gray-200/60 rounded-xl text-[13px] font-medium w-[240px] focus:outline-none focus:ring-2 focus:ring-[#88de7d]/40 focus:border-[#88de7d] text-[#111617] placeholder-gray-400 shadow-[0_2px_8px_rgba(0,0,0,0.02)] transition-all duration-300"
                />
              </div>

              <div className="hidden lg:block w-[1px] h-8 bg-gray-200/60 mx-1"></div>

              <div className="flex items-center gap-2 md:gap-3">
                <div className="hidden md:flex h-[42px]">
                  <CreateBillButton onClick={() => setActiveView('billing')} />
                </div>

                <div className="flex flex-row items-center gap-1.5 md:gap-3 h-full">
                  <div className="md:hidden relative" ref={shopManagerRef}>
                    <button
                      onClick={() => { setIsShopManagerOpen(!isShopManagerOpen); setIsProfileMenuOpen(false); }}
                      className="h-8 px-3.5 bg-gradient-to-r from-[#88DE7D] to-[#21776A] text-white rounded-xl flex items-center justify-center gap-1 shadow-[0_2px_8px_rgba(33,119,106,0.15)] active:scale-95 transition-all text-[11px] font-bold whitespace-nowrap"
                      title="Manager"
                    >
                      <LayoutList size={13} strokeWidth={2.5} />
                      <span>Manager</span>
                      <ChevronDown size={13} strokeWidth={3} />
                    </button>

                    <AnimatePresence>
                      {isShopManagerOpen && (
                        <motion.div
                          initial={{ opacity: 0, scale: 0.95, y: -10 }}
                          animate={{ opacity: 1, scale: 1, y: 0 }}
                          exit={{ opacity: 0, scale: 0.95, y: -10 }}
                          transition={{ duration: 0.2, ease: "easeOut" }}
                          className="absolute right-0 mt-2 w-48 bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden z-50 py-1"
                        >
                          <button
                            onClick={() => { setActiveView('payment-manager'); setIsShopManagerOpen(false); }}
                            className="w-full flex items-center gap-3 px-4 py-3 text-sm text-[#111617] hover:bg-[#F3F5F2] transition-colors text-left"
                          >
                            <div className="w-8 h-8 rounded-lg bg-[#DAF4D7] flex items-center justify-center text-[#21776A]">
                              <Bell size={18} />
                            </div>
                            <span className="font-medium">Payment Manager</span>
                          </button>

                          <button
                            onClick={() => { setActiveView('product-manager'); setIsShopManagerOpen(false); }}
                            className="w-full flex items-center gap-3 px-4 py-3 text-sm text-[#111617] hover:bg-[#F3F5F2] transition-colors text-left"
                          >
                            <div className="w-8 h-8 rounded-lg bg-[#DAF4D7] flex items-center justify-center text-[#21776A]">
                              <Package size={18} />
                            </div>
                            <span className="font-medium">Product Manager</span>
                          </button>

                          <button
                            onClick={() => { setActiveView('sp-manager'); setIsShopManagerOpen(false); }}
                            className="w-full flex items-center gap-3 px-4 py-3 text-sm text-[#111617] hover:bg-[#F3F5F2] transition-colors text-left"
                          >
                            <div className="w-8 h-8 rounded-lg bg-[#DAF4D7] flex items-center justify-center text-[#21776A]">
                              <LayoutList size={18} />
                            </div>
                            <span className="font-medium">SP Manager</span>
                          </button>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>

                  <div className="relative" ref={profileMenuRef}>
                    <button
                      onClick={() => {
                        setIsProfileMenuOpen(!isProfileMenuOpen);
                        setIsShopManagerOpen(false);
                      }}
                      className="w-8 h-8 md:w-[42px] md:h-[42px] rounded-xl bg-white border border-gray-200/60 shadow-[0_2px_8px_rgba(0,0,0,0.02)] flex items-center justify-center text-[#111617]/70 hover:text-[#111617] hover:bg-gray-50 hover:border-gray-200 transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-[#88de7d]/40 active:scale-95"
                      title="Profile"
                    >
                      <User className="w-4 h-4 md:w-[18px] md:h-[18px]" strokeWidth={2.5} />
                    </button>

                    <AnimatePresence>
                      {isProfileMenuOpen && (
                        <motion.div
                          initial={{ opacity: 0, scale: 0.95, y: -10 }}
                          animate={{ opacity: 1, scale: 1, y: 0 }}
                          exit={{ opacity: 0, scale: 0.95, y: -10 }}
                          transition={{ duration: 0.2, ease: "easeOut" }}
                          className="absolute right-0 mt-2 w-72 bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden z-50"
                        >
                          <div className="px-5 pt-5 pb-4 border-b border-gray-100">
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 rounded-full bg-[#DAF4D7] flex items-center justify-center text-[#21776A] shrink-0">
                                <User size={20} strokeWidth={2} />
                              </div>
                              <div className="min-w-0">
                                <p className="font-bold text-sm text-[#111617] truncate">{shopProfile?.shopName || 'Shop'}</p>
                                <p className="text-xs text-gray-400 truncate">{shopProfile?.phone || ''}</p>
                              </div>
                            </div>
                          </div>

                          {shopProfile && (
                            <div className="px-5 py-4 border-b border-gray-100">
                              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-3">Subscription</p>
                              <div className="space-y-2.5">
                                <div className="flex items-center justify-between">
                                  <span className="text-xs text-gray-500 font-medium">Plan</span>
                                  <span className={`text-xs font-bold px-2.5 py-0.5 rounded-full ${shopProfile.planId === 'pro' ? 'bg-[#DAF4D7] text-[#21776A]' :
                                    shopProfile.planId === 'enterprise' ? 'bg-purple-100 text-purple-700' :
                                      'bg-blue-50 text-blue-600'
                                    }`}>
                                    {(shopProfile.planId || 'basic').charAt(0).toUpperCase() + (shopProfile.planId || 'basic').slice(1)}
                                  </span>
                                </div>
                                {shopProfile.subscriptionStart && (
                                  <div className="flex items-center justify-between">
                                    <span className="text-xs text-gray-500 font-medium">Started</span>
                                    <span className="text-xs font-semibold text-[#111617]">
                                      {new Date(shopProfile.subscriptionStart).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                                    </span>
                                  </div>
                                )}
                                {shopProfile.subscriptionEnd && (
                                  <div className="flex items-center justify-between">
                                    <span className="text-xs text-gray-500 font-medium">Expires</span>
                                    <span className="text-xs font-semibold text-[#111617]">
                                      {new Date(shopProfile.subscriptionEnd).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                                    </span>
                                  </div>
                                )}
                                {shopProfile.subscriptionEnd && (() => {
                                  const daysLeft = Math.ceil((new Date(shopProfile.subscriptionEnd).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
                                  return (
                                    <div className="flex items-center justify-between">
                                      <span className="text-xs text-gray-500 font-medium">Remaining</span>
                                      <span className={`text-xs font-bold ${daysLeft <= 7 ? 'text-red-500' : daysLeft <= 30 ? 'text-amber-500' : 'text-[#21776A]'
                                        }`}>
                                        {daysLeft > 0 ? `${daysLeft} day${daysLeft !== 1 ? 's' : ''}` : 'Expired'}
                                      </span>
                                    </div>
                                  );
                                })()}
                                {shopProfile.planDurationMonths && (
                                  <div className="flex items-center justify-between">
                                    <span className="text-xs text-gray-500 font-medium">Duration</span>
                                    <span className="text-xs font-semibold text-[#111617]">
                                      {shopProfile.planDurationMonths} month{shopProfile.planDurationMonths !== 1 ? 's' : ''}
                                    </span>
                                  </div>
                                )}
                              </div>
                            </div>
                          )}

                          <div className="p-2">
                            <button
                              onClick={() => { setActiveView('subscription-manager'); setIsProfileMenuOpen(false); }}
                              className="w-full flex items-center gap-3 px-3 py-2.5 text-sm text-[#111617] hover:bg-[#F3F5F2] transition-colors rounded-xl text-left"
                            >
                              <Crown size={16} className="text-amber-500" />
                              <span className="font-medium">Manage Subscription</span>
                            </button>
                            <button
                              onClick={() => { setActiveView('settings'); setIsProfileMenuOpen(false); }}
                              className="w-full flex items-center gap-3 px-3 py-2.5 text-sm text-[#111617] hover:bg-[#F3F5F2] transition-colors rounded-xl text-left"
                            >
                              <SettingsIcon size={16} className="text-gray-400" />
                              <span className="font-medium">Settings</span>
                            </button>
                            <button
                              onClick={() => { handleManualLogout(); setIsProfileMenuOpen(false); }}
                              className="w-full flex items-center gap-3 px-3 py-2.5 text-sm text-red-500 hover:bg-red-50 transition-colors rounded-xl text-left"
                            >
                              <LogOut size={16} />
                              <span className="font-medium">Logout</span>
                            </button>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </div>
              </div>
            </div>
          </header>

          <main className={`flex-1 overflow-auto w-full ${activeView === 'billing' ? 'pb-0' : 'pb-24'} md:pb-8`}>
            <AnimatePresence mode="wait">
              <motion.div
                key={activeView}
                initial={{ opacity: 0, y: 15, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1, transition: { duration: 0.3, ease: [0.4, 0, 0.2, 1] } }}
                exit={{ opacity: 0, y: activeView === 'dashboard' ? 15 : -15, scale: 0.98, transition: { duration: 0.2, ease: [0.4, 0, 1, 1] } }}
                className="h-full w-full bg-bg relative z-10"
              >
                {renderContent()}
              </motion.div>
            </AnimatePresence>
          </main>
        </div>

        {/* Trial Approved Modal */}
        {shopProfile?.trialStatus === 'approved' && shopProfile?.trialApprovedNotified === false && (
          <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '20px' }}>
            <div style={{ background: 'white', borderRadius: '20px', width: '100%', maxWidth: '400px', padding: '40px 32px', boxShadow: '0 10px 40px rgba(0,0,0,0.2)', textAlign: 'center' }}>
              <div style={{ width: '64px', height: '64px', borderRadius: '50%', background: '#DAF4D7', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 24px' }}>
                <Crown size={32} color="#21776A" />
              </div>
              <h2 style={{ fontSize: '24px', fontWeight: 800, margin: '0 0 16px', color: '#111617' }}>Trial Approved!</h2>
              <p style={{ fontSize: '15px', color: '#6B7280', margin: '0 0 32px', lineHeight: 1.6 }}>Congratulations! Your shop has been verified and your free trial is now active. You have full access to all Instabill features.</p>
              <button onClick={async () => { try { await updateDoc(doc(db, 'shops', shopProfile.id), { trialApprovedNotified: true }); setShopProfile({ ...shopProfile, trialApprovedNotified: true }); } catch (e) { console.error('Error updating trial notification flag', e); } }} style={{ width: '100%', padding: '14px', background: '#21776A', color: 'white', border: 'none', borderRadius: '12px', fontSize: '15px', fontWeight: 700, cursor: 'pointer' }}>Start Exploring</button>
            </div>
          </div>
        )}

        {/* Catalog Update Modal */}
        {showCatalogUpdate && (
          <CatalogUpdateModal onClose={() => setShowCatalogUpdate(false)} />
        )}
      </div>
    );
  };

  return (
    <>
      {getActiveViewContent()}
      {!splashHidden && (
        <div className={`splash-screen ${fadeOut ? 'splash-fade-out' : ''}`}>
          <div className="splash-logo-container">
            <img src="/LogoAnimation.svg" alt="Instabill Logo Animation" />
          </div>
          <div className="splash-progress-track">
            <div className="splash-progress-fill"></div>
          </div>
        </div>
      )}
    </>
  );
};

export default App;