import React, { useState, useEffect } from 'react';
import { Database, Trash2, AlertTriangle, Loader2, MessageCircle, User, FileText, Users, Package, Crown, Calendar, MapPin, Phone, Shield, LogOut } from 'lucide-react';
import { store } from '../store';
import { db } from '../firebaseConfig';
import { ShopProfile } from '../types';
import { updateShopProfile } from '../services/authService';

type WipeTarget = 'bills' | 'customers' | 'stock' | null;

interface SettingsProps {
  shopProfile?: ShopProfile | null;
  onLogout: () => void;
}

const Settings: React.FC<SettingsProps> = ({ shopProfile, onLogout }) => {
  const [isResetting, setIsResetting] = useState(false);
  const [wipeTarget, setWipeTarget] = useState<WipeTarget>(null);
  const [wipeCloud, setWipeCloud] = useState(false);

  // Shop Info State — prefer shopProfile if available, fall back to store settings
  const [shopName, setShopName] = useState(shopProfile?.shopName || store.getSettings().shopName);
  const [shopAddress, setShopAddress] = useState(shopProfile?.address || store.getSettings().shopAddress);
  const [isSavingShopInfo, setIsSavingShopInfo] = useState(false);

  // Preferences State
  const [defaultBillingMode, setDefaultBillingMode] = useState(store.getSettings().defaultBillingMode || 'DP');
  const [whatsappEnabled, setWhatsappEnabled] = useState(store.getSettings().whatsappEnabled !== false);

  useEffect(() => {
    const unsubscribeStore = store.subscribe(() => {
      const s = store.getSettings();
      if (document.activeElement?.tagName !== 'INPUT' && document.activeElement?.tagName !== 'TEXTAREA') {
        setShopName(s.shopName);
        setShopAddress(s.shopAddress);
      }
      setDefaultBillingMode(s.defaultBillingMode || 'DP');
      setWhatsappEnabled(s.whatsappEnabled !== false);
    });

    return () => {
      unsubscribeStore();
    };
  }, []);

  const handleWipe = async () => {
    if (!wipeTarget) return;
    setIsResetting(true);
    setTimeout(async () => {
      try {
        let result;
        switch (wipeTarget) {
          case 'bills':
            result = await store.wipeBills(wipeCloud);
            break;
          case 'customers':
            result = await store.wipeCustomers(wipeCloud);
            break;
          case 'stock':
            result = await store.wipeStock(wipeCloud);
            break;
        }
        alert(result?.message || 'Data wiped successfully.');
        setWipeTarget(null);
        setWipeCloud(false);
      } catch (e) {
        console.error(e);
        alert("Failed to wipe data.");
      } finally {
        setIsResetting(false);
      }
    }, 100);
  };

  const handleSaveShopInfo = async () => {
    setIsSavingShopInfo(true);
    await store.updateSettings({ shopName, shopAddress });
    if (shopProfile?.id) {
      try {
        await updateShopProfile(shopProfile.id, { shopName, address: shopAddress });
      } catch (e) {
        console.warn('Failed to update shop profile', e);
      }
    }
    setIsSavingShopInfo(false);
    alert('Shop information saved successfully!');
  };

  const getStatusBadge = (status?: string) => {
    switch (status) {
      case 'active':
        return <span className="px-3 py-1 rounded-full bg-green-100 text-[#5abc8b] text-xs font-bold">Active</span>;
      case 'trial':
        return <span className="px-3 py-1 rounded-full bg-amber-100 text-amber-700 text-xs font-bold">Trial</span>;
      case 'expired':
        return <span className="px-3 py-1 rounded-full bg-red-100 text-red-700 text-xs font-bold">Expired</span>;
      case 'suspended':
        return <span className="px-3 py-1 rounded-full bg-gray-200 text-gray-600 text-xs font-bold">Suspended</span>;
      default:
        return <span className="px-3 py-1 rounded-full bg-gray-100 text-gray-500 text-xs font-bold">Unknown</span>;
    }
  };

  const getPlanLabel = (planId?: string) => {
    switch (planId) {
      case 'basic': return 'Basic';
      case 'pro': return 'Pro';
      case 'enterprise': return 'Enterprise';
      default: return planId || '—';
    }
  };

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return '—';
    try {
      return new Date(dateStr).toLocaleDateString('en-IN', {
        day: 'numeric', month: 'short', year: 'numeric'
      });
    } catch { return dateStr; }
  };

  const getInitials = (name: string) => {
    return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2) || '?';
  };

  const WIPE_CONFIG = {
    bills: {
      icon: <FileText size={20} className="text-red-500" />,
      title: 'Wipe Bills',
      description: 'Clear all bill and sales history data.',
      confirmTitle: 'Delete All Bills?',
      confirmText: 'This will permanently delete all bills and sales history. This cannot be undone.',
    },
    customers: {
      icon: <Users size={20} className="text-orange-500" />,
      title: 'Wipe Customers',
      description: 'Clear all customer records and data.',
      confirmTitle: 'Delete All Customers?',
      confirmText: 'This will permanently delete all customer records. This cannot be undone.',
    },
  };

  return (
    <div className="max-w-4xl mx-auto h-full overflow-y-auto px-1 md:pr-2 custom-scrollbar relative pb-24 md:pb-2">

      {/* Wipe Confirmation Modal */}
      {wipeTarget && (
        <div className="fixed inset-0 bg-dark/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white rounded-3xl shadow-xl p-8 w-full max-w-md animate-modal-in">
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <AlertTriangle size={32} className="text-red-600" />
            </div>
            <h3 className="text-2xl font-bold text-dark text-center mb-2">{WIPE_CONFIG[wipeTarget].confirmTitle}</h3>
            <p className="text-gray-500 text-center mb-6">
              {WIPE_CONFIG[wipeTarget].confirmText}
            </p>

            <div className="bg-red-50 p-4 rounded-xl mb-6 flex items-start gap-3">
              <input
                type="checkbox"
                id="wipeCloud"
                checked={wipeCloud}
                onChange={(e) => setWipeCloud(e.target.checked)}
                className="mt-1 w-4 h-4 text-red-600 rounded focus:ring-red-500"
              />
              <label htmlFor="wipeCloud" className="text-sm text-red-800 cursor-pointer select-none">
                <strong>Also wipe Cloud Database?</strong>
                <br />
                <span className="text-xs opacity-80">Uncheck to only clear data from this device (Local Storage).</span>
              </label>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => { setWipeTarget(null); setWipeCloud(false); }}
                disabled={isResetting}
                className="flex-1 py-3 rounded-xl font-bold text-gray-500 hover:bg-gray-100 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleWipe}
                disabled={isResetting}
                className="flex-1 py-3 bg-red-600 text-white rounded-xl font-bold hover:bg-red-700 transition-all shadow-lg flex items-center justify-center gap-2"
              >
                {isResetting ? <Loader2 size={18} className="animate-spin" /> : <Trash2 size={18} />}
                {isResetting ? "Wiping..." : "Confirm Delete"}
              </button>
            </div>
          </div>
        </div>
      )}

      <h2 className="text-2xl font-bold text-dark mb-6">Settings</h2>

      {/* Profile Panel */}
      <div className="bg-white rounded-3xl p-5 md:p-8 shadow-sm mb-6">
        <h3 className="text-lg font-bold text-dark mb-6 flex items-center gap-2">
          <User size={20} /> Profile
        </h3>

        {/* Profile Header */}
        <div className="flex items-center gap-4 mb-6 pb-6 border-b border-gray-100">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-emerald-400 to-teal-600 flex items-center justify-center text-white text-xl font-bold shadow-lg">
            {getInitials(shopProfile?.shopName || shopName || 'S')}
          </div>
          <div className="flex-1 min-w-0">
            <h4 className="text-xl font-bold text-dark truncate">{shopProfile?.shopName || shopName || 'My Shop'}</h4>
            <p className="text-sm text-gray-500 truncate">{shopProfile?.address || shopAddress || 'No address set'}</p>
            {shopProfile?.subscriptionStatus && (
              <div className="mt-1.5">{getStatusBadge(shopProfile.subscriptionStatus)}</div>
            )}
          </div>
        </div>

        {/* Subscription Details Grid */}
        {shopProfile && (
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4 mb-6 pb-6 border-b border-gray-100">
            <div className="bg-gray-50 rounded-xl p-3">
              <div className="flex items-center gap-1.5 mb-1">
                <Crown size={14} className="text-amber-500" />
                <span className="text-xs font-medium text-gray-400">Plan</span>
              </div>
              <p className="font-bold text-dark text-sm">{getPlanLabel(shopProfile.planId)}</p>
            </div>

            <div className="bg-gray-50 rounded-xl p-3">
              <div className="flex items-center gap-1.5 mb-1">
                <Shield size={14} className="text-green-500" />
                <span className="text-xs font-medium text-gray-400">Status</span>
              </div>
              <p className="font-bold text-dark text-sm capitalize">{shopProfile.subscriptionStatus || '—'}</p>
            </div>

            <div className="bg-gray-50 rounded-xl p-3">
              <div className="flex items-center gap-1.5 mb-1">
                <Phone size={14} className="text-blue-500" />
                <span className="text-xs font-medium text-gray-400">Phone</span>
              </div>
              <p className="font-bold text-dark text-sm">{shopProfile.phone || '—'}</p>
            </div>

            <div className="bg-gray-50 rounded-xl p-3">
              <div className="flex items-center gap-1.5 mb-1">
                <Calendar size={14} className="text-indigo-500" />
                <span className="text-xs font-medium text-gray-400">Subscription Start</span>
              </div>
              <p className="font-bold text-dark text-sm">{formatDate(shopProfile.subscriptionStart)}</p>
            </div>

            <div className="bg-gray-50 rounded-xl p-3">
              <div className="flex items-center gap-1.5 mb-1">
                <Calendar size={14} className="text-red-400" />
                <span className="text-xs font-medium text-gray-400">Subscription End</span>
              </div>
              <p className="font-bold text-dark text-sm">{formatDate(shopProfile.subscriptionEnd || shopProfile.currentPeriodEnd)}</p>
            </div>

            <div className="bg-gray-50 rounded-xl p-3">
              <div className="flex items-center gap-1.5 mb-1">
                <Calendar size={14} className="text-gray-400" />
                <span className="text-xs font-medium text-gray-400">Registered</span>
              </div>
              <p className="font-bold text-dark text-sm">{formatDate(shopProfile.createdAt)}</p>
            </div>
          </div>
        )}

        {/* Editable Shop Info */}
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-2">Shop Name</label>
            <input
              type="text"
              value={shopName}
              onChange={(e) => setShopName(e.target.value)}
              className="w-full px-4 py-3 bg-bg rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/50 font-medium"
              placeholder="Enter shop name"
            />
          </div>

          <div>
            <label className="block text-sm font-bold text-gray-700 mb-2">Shop Address</label>
            <textarea
              value={shopAddress}
              onChange={(e) => setShopAddress(e.target.value)}
              rows={3}
              className="w-full px-4 py-3 bg-bg rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/50 font-medium resize-none"
              placeholder="Enter shop address"
            />
          </div>

          <button
            onClick={handleSaveShopInfo}
            disabled={isSavingShopInfo}
            className="bg-dark text-white px-6 py-3 rounded-xl font-bold hover:bg-dark-light transition-colors flex items-center gap-2 disabled:opacity-50"
          >
            {isSavingShopInfo ? (
              <>
                <Loader2 size={18} className="animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Database size={18} />
                Save Profile
              </>
            )}
          </button>
        </div>
      </div>

      {/* Preferences Section */}
      <div className="bg-white rounded-3xl p-5 md:p-8 shadow-sm mb-6">
        <h3 className="text-lg font-bold text-dark mb-6 flex items-center gap-2">
          Preferences
        </h3>

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-4 bg-gray-50 rounded-2xl border border-gray-100">
          <div>
            <h4 className="font-bold text-dark text-sm mb-1">Default Billing Price Mode</h4>
            <p className="text-xs text-gray-500">Choose the default price type for new bills.</p>
          </div>

          <div className="flex bg-white rounded-xl p-1 shadow-sm border border-gray-200">
            <button
              onClick={() => store.updateSettings({ defaultBillingMode: 'MRP' })}
              className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${defaultBillingMode === 'MRP'
                ? 'bg-red-500 text-white shadow-sm'
                : 'text-gray-500 hover:text-dark'
                }`}
            >
              MRP
            </button>
            <button
              onClick={() => store.updateSettings({ defaultBillingMode: 'DP' })}
              className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${defaultBillingMode === 'DP'
                ? 'bg-[#5abc8b] text-white shadow-sm'
                : 'text-gray-500 hover:text-dark'
                }`}
            >
              DP
            </button>
          </div>
        </div>

        {/* WhatsApp Notifications Toggle */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-4 bg-green-50 rounded-2xl border border-green-100 mt-4">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0">
              <MessageCircle size={20} className="text-[#5abc8b]" />
            </div>
            <div>
              <h4 className="font-bold text-dark text-sm mb-1">WhatsApp Notifications</h4>
              <p className="text-xs text-gray-500">Send WhatsApp messages for bill generation, updates, and product handovers.</p>
            </div>
          </div>

          <button
            onClick={() => {
              const newValue = !whatsappEnabled;
              setWhatsappEnabled(newValue);
              store.updateSettings({ whatsappEnabled: newValue });
            }}
            className={`relative inline-flex h-8 w-14 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 ${whatsappEnabled ? 'bg-[#5abc8b]' : 'bg-gray-300'
              }`}
          >
            <span
              className={`pointer-events-none inline-block h-7 w-7 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${whatsappEnabled ? 'translate-x-6' : 'translate-x-0'
                }`}
            />
          </button>
        </div>
      </div>

      {/* Database Management Section */}
      <div className="bg-white rounded-3xl p-5 md:p-8 shadow-sm mb-6">
        <h3 className="text-lg font-bold text-dark mb-4 flex items-center gap-2">
          <Database size={20} /> Database Management
        </h3>

        <div className="space-y-3">
          {(Object.keys(WIPE_CONFIG) as Array<keyof typeof WIPE_CONFIG>).map((key) => {
            const config = WIPE_CONFIG[key];
            return (
              <div key={key} className="p-4 bg-red-50/60 rounded-2xl border border-red-100 flex flex-col md:flex-row md:items-center justify-between gap-3">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-xl bg-white flex items-center justify-center flex-shrink-0 shadow-sm">
                    {config.icon}
                  </div>
                  <div>
                    <h4 className="font-bold text-dark text-sm">{config.title}</h4>
                    <p className="text-xs text-gray-500">{config.description}</p>
                  </div>
                </div>
                <button
                  onClick={() => setWipeTarget(key)}
                  className="px-5 py-2.5 bg-white text-red-600 border border-red-200 rounded-xl font-bold text-sm hover:bg-red-600 hover:text-white transition-all shadow-sm flex items-center justify-center gap-2 whitespace-nowrap"
                >
                  <Trash2 size={16} /> {config.title}
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {/* App Info & Logout */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        <div className="bg-white rounded-3xl p-8 shadow-sm">
          <h3 className="text-lg font-bold text-dark mb-4">App Info</h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-500 mb-1">App Name</label>
              <p className="font-bold text-dark text-sm">Instabill</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-500 mb-1">Version</label>
              <p className="font-bold text-dark text-sm">v1.1.0</p>
            </div>
            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-500 mb-1">Status</label>
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-green-500"></span>
                <p className="font-bold text-dark text-sm">System Active</p>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-3xl p-8 shadow-sm flex flex-col justify-center items-center text-center">
          <div className="w-16 h-16 bg-red-50 rounded-2xl flex items-center justify-center text-red-500 mb-4">
            <Shield size={32} />
          </div>
          <h3 className="text-lg font-bold text-dark mb-2">Account Security</h3>
          <p className="text-sm text-gray-500 mb-6 flex-1">
            Sign out of your account to keep your data safe and secure.
          </p>
          <button
            onClick={onLogout}
            className="w-full py-4 bg-red-50 text-red-600 rounded-2xl font-bold hover:bg-red-100 transition-all flex items-center justify-center gap-2 border border-red-100"
          >
            <LogOut size={20} />
            Logout Account
          </button>
        </div>
      </div>
    </div>
  );
};

export default Settings;