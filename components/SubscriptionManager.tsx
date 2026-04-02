import React, { useState, useEffect } from 'react';
import { db } from '../firebaseConfig';
import { collection, query, orderBy, getDocs } from 'firebase/firestore';
import { ShopProfile, SubscriptionTransaction } from '../types';
import { Crown, Plus, ArrowUpDown, FileText, ExternalLink, Calendar, RefreshCw, ArrowRightLeft, Zap, TrendingUp } from 'lucide-react';
import { generateSubscriptionInvoice } from './generateSubscriptionInvoice';

interface SubscriptionManagerProps {
  shopProfile: ShopProfile | null;
  setActiveView: (view: string) => void;
}

function getTransactionTypeLabel(type: string): string {
  switch (type) {
    case 'new_subscription': return 'New Subscription';
    case 'renewal': return 'Subscription Renewal';
    case 'extension': return 'Subscription Extension';
    case 'upgrade': return 'Plan Upgrade';
    default: return 'Subscription Payment';
  }
}

function getTransactionIcon(type: string) {
  switch (type) {
    case 'extension': return <Plus size={20} style={{ color: '#7C3AED' }} />;
    case 'upgrade': return <TrendingUp size={20} style={{ color: '#F59E0B' }} />;
    case 'renewal': return <RefreshCw size={20} style={{ color: '#3B82F6' }} />;
    default: return <Zap size={20} style={{ color: '#00747B' }} />;
  }
}

function getTransactionIconBg(type: string): string {
  switch (type) {
    case 'extension': return '#F3E8FF';
    case 'upgrade': return '#FEF3C7';
    case 'renewal': return '#EEF9FF';
    default: return '#F0FAF0';
  }
}

const SubscriptionManager: React.FC<SubscriptionManagerProps> = ({ shopProfile, setActiveView }) => {

  const [transactions, setTransactions] = useState<SubscriptionTransaction[]>([]);
  const [loadingTx, setLoadingTx] = useState(true);
  const [showAll, setShowAll] = useState(false);

  // Plan details
  const planName = shopProfile?.planId
    ? shopProfile.planId.charAt(0).toUpperCase() + shopProfile.planId.slice(1) + ' Plan'
    : 'No Plan';

  const isActive = (shopProfile?.subscriptionStatus === 'active' || shopProfile?.subscriptionStatus === 'trial') &&
    shopProfile?.subscriptionEnd &&
    (typeof shopProfile.subscriptionEnd === 'string' 
      ? new Date(shopProfile.subscriptionEnd) > new Date()
      : (shopProfile.subscriptionEnd as any).toDate ? (shopProfile.subscriptionEnd as any).toDate() > new Date() : false);

  // Days remaining calculation
  const totalDays = shopProfile?.subscriptionStart && shopProfile?.subscriptionEnd
    ? Math.ceil((new Date(shopProfile.subscriptionEnd).getTime() - new Date(shopProfile.subscriptionStart).getTime()) / (1000 * 60 * 60 * 24))
    : 0;

  const daysRemaining = shopProfile?.subscriptionEnd
    ? Math.max(0, Math.ceil((new Date(shopProfile.subscriptionEnd).getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
    : 0;

  const progressPercent = totalDays > 0 ? Math.round((daysRemaining / totalDays) * 100) : 0;

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return '—';
    try {
      return new Date(dateStr).toLocaleDateString('en-IN', {
        day: 'numeric', month: 'short', year: 'numeric'
      });
    } catch { return dateStr; }
  };

  // Load real transactions from Firestore
  useEffect(() => {
    if (!shopProfile?.id) {
      setLoadingTx(false);
      return;
    }
    
    const loadTransactions = async () => {
      try {
        const txRef = collection(db, 'shops', shopProfile.id, 'subscriptionTransactions');
        const q = query(txRef, orderBy('date', 'desc'));
        const snapshot = await getDocs(q);
        const txList: SubscriptionTransaction[] = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        } as SubscriptionTransaction));
        setTransactions(txList);
      } catch (err) {
        console.error('Failed to load transactions', err);
      }
      setLoadingTx(false);
    };

    loadTransactions();
  }, [shopProfile?.id]);

  const handleViewInvoice = (tx: SubscriptionTransaction) => {
    if (!shopProfile) return;
    generateSubscriptionInvoice(tx, shopProfile);
  };

  const displayedTransactions = showAll ? transactions : transactions.slice(0, 3);

  return (
    <div className="max-w-lg mx-auto h-full overflow-y-auto px-1 md:pr-2 custom-scrollbar pb-24 md:pb-8">

      {/* Current Plan Card */}
      <div
        style={{
          background: 'white',
          borderRadius: '20px',
          padding: '28px 24px',
          border: '1px solid #e8f5e3',
          boxShadow: '0 1px 4px rgba(0,0,0,0.03)',
          marginBottom: '16px',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
          <div>
            <p style={{
              fontSize: '11px', fontWeight: 700, color: '#00747B',
              letterSpacing: '1px', textTransform: 'uppercase', marginBottom: '6px',
            }}>CURRENT PLAN</p>
            <h2 style={{ fontSize: '28px', fontWeight: 800, color: '#02575c', margin: 0, lineHeight: 1.2 }}>
              {planName}
            </h2>
          </div>
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: '4px',
            padding: '5px 14px', borderRadius: '20px',
            background: isActive ? '#DAF4D7' : '#FEE2E2',
            color: isActive ? '#00747B' : '#DC2626',
            fontSize: '12px', fontWeight: 700,
          }}>
            {isActive ? 'Active' : 'Expired'}
          </span>
        </div>

        {/* Progress */}
        <div style={{ marginBottom: '8px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <span style={{ fontSize: '13px', color: '#6B7280', fontWeight: 500 }}>
              {daysRemaining} day{daysRemaining !== 1 ? 's' : ''} remaining
            </span>
            <span style={{ fontSize: '13px', color: '#6B7280', fontWeight: 600 }}>
              {progressPercent}%
            </span>
          </div>
          <div style={{
            height: '8px', background: '#E5E7EB', borderRadius: '100px', overflow: 'hidden',
          }}>
            <div style={{
              height: '100%',
              width: `${progressPercent}%`,
              background: 'linear-gradient(90deg, #00747B, #88DE7D)',
              borderRadius: '100px',
              transition: 'width 0.6s ease',
            }} />
          </div>
        </div>
      </div>

      {/* Date Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '16px' }}>
        <div style={{
          background: 'white', borderRadius: '16px', padding: '16px 18px',
          border: '1px solid #E5E7EB',
        }}>
          <p style={{
            fontSize: '10px', fontWeight: 700, color: '#9CA3AF',
            letterSpacing: '1px', textTransform: 'uppercase', marginBottom: '6px',
          }}>START DATE</p>
          <p style={{ fontSize: '15px', fontWeight: 700, color: '#02575c', margin: 0 }}>
            {formatDate(shopProfile?.subscriptionStart)}
          </p>
        </div>
        <div style={{
          background: 'white', borderRadius: '16px', padding: '16px 18px',
          border: '1px solid #E5E7EB',
        }}>
          <p style={{
            fontSize: '10px', fontWeight: 700, color: '#9CA3AF',
            letterSpacing: '1px', textTransform: 'uppercase', marginBottom: '6px',
          }}>NEXT RENEWAL</p>
          <p style={{ fontSize: '15px', fontWeight: 700, color: '#02575c', margin: 0 }}>
            {formatDate(shopProfile?.subscriptionEnd)}
          </p>
        </div>
      </div>

      {/* Action Buttons */}
      <button
        onClick={() => setActiveView('subscription-extend-page')}
        style={{
          width: '100%', padding: '16px',
          background: 'linear-gradient(135deg, #00747B 0%, #2a9d8f 100%)',
          color: 'white', border: 'none', borderRadius: '16px',
          fontSize: '15px', fontWeight: 700, cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px',
          boxShadow: '0 4px 16px rgba(33, 119, 106, 0.3)',
          transition: 'all 0.2s', marginBottom: '12px',
          fontFamily: 'inherit',
        }}
        onMouseOver={e => { e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.boxShadow = '0 6px 20px rgba(33, 119, 106, 0.4)'; }}
        onMouseOut={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 4px 16px rgba(33, 119, 106, 0.3)'; }}
      >
        <Plus size={18} strokeWidth={2.5} />
        Extend Subscription
      </button>

      <button
        onClick={() => setActiveView('subscription-extend')}
        style={{
          width: '100%', padding: '16px',
          background: 'white', color: '#02575c',
          border: '1.5px solid #E5E7EB', borderRadius: '16px',
          fontSize: '15px', fontWeight: 700, cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px',
          transition: 'all 0.2s', marginBottom: '32px',
          fontFamily: 'inherit',
        }}
        onMouseOver={e => { e.currentTarget.style.borderColor = '#00747B'; e.currentTarget.style.color = '#00747B'; }}
        onMouseOut={e => { e.currentTarget.style.borderColor = '#E5E7EB'; e.currentTarget.style.color = '#02575c'; }}
      >
        <ArrowUpDown size={18} strokeWidth={2.5} />
        Upgrade Plan
      </button>

      {/* Transaction History */}
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <h3 style={{ fontSize: '17px', fontWeight: 800, color: '#02575c', margin: 0 }}>
            Transaction History
          </h3>
          {transactions.length > 3 && (
            <button
              onClick={() => setShowAll(!showAll)}
              style={{
                background: 'none', border: 'none', color: '#00747B',
                fontSize: '13px', fontWeight: 600, cursor: 'pointer',
                fontFamily: 'inherit',
              }}
            >
              {showAll ? 'Show Less' : 'See All'}
            </button>
          )}
        </div>

        {loadingTx ? (
          <div style={{
            textAlign: 'center', padding: '32px 16px',
            background: 'white', borderRadius: '16px',
            border: '1px solid #E5E7EB',
          }}>
            <div style={{
              width: '32px', height: '32px', border: '3px solid #00747B', borderTopColor: 'transparent',
              borderRadius: '50%', animation: 'spin 1s linear infinite',
              margin: '0 auto 12px',
            }} />
            <p style={{ fontSize: '14px', color: '#9CA3AF', fontWeight: 500, margin: 0 }}>
              Loading transactions...
            </p>
          </div>
        ) : transactions.length === 0 ? (
          <div style={{
            textAlign: 'center', padding: '32px 16px',
            background: 'white', borderRadius: '16px',
            border: '1px solid #E5E7EB',
          }}>
            <Calendar size={32} style={{ color: '#D1D5DB', marginBottom: '12px' }} />
            <p style={{ fontSize: '14px', color: '#9CA3AF', fontWeight: 500, margin: 0 }}>
              No transactions yet
            </p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {displayedTransactions.map(tx => (
              <div key={tx.id} style={{
                display: 'flex', alignItems: 'center', gap: '14px',
                padding: '16px 18px', background: 'white', borderRadius: '16px',
                border: '1px solid #f0f0f0',
              }}>
                {/* Icon */}
                <div style={{
                  width: '44px', height: '44px', borderRadius: '12px',
                  background: getTransactionIconBg(tx.type), display: 'flex',
                  alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                }}>
                  {getTransactionIcon(tx.type)}
                </div>

                {/* Info */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{
                    fontSize: '14px', fontWeight: 700, color: '#02575c',
                    margin: '0 0 3px', lineHeight: 1.3,
                  }}>
                    {getTransactionTypeLabel(tx.type)}
                  </p>
                  <p style={{
                    fontSize: '12px', color: '#9CA3AF', fontWeight: 500, margin: '0 0 2px',
                  }}>
                    {formatDate(tx.date)}
                  </p>
                  <p style={{
                    fontSize: '11px', color: '#D1D5DB', fontWeight: 500, margin: 0,
                  }}>
                    {tx.planId ? `${tx.planId.charAt(0).toUpperCase() + tx.planId.slice(1)} Plan` : ''} · {tx.durationMonths} month{tx.durationMonths !== 1 ? 's' : ''}
                  </p>
                </div>

                {/* Amount + Invoice */}
                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                  <p style={{
                    fontSize: '15px', fontWeight: 800, color: '#02575c',
                    margin: '0 0 3px',
                  }}>
                    ₹{tx.amount.toLocaleString('en-IN')}.00
                  </p>
                  <button
                    onClick={() => handleViewInvoice(tx)}
                    style={{
                      background: 'none', border: 'none', padding: 0,
                      color: '#00747B', fontSize: '11px', fontWeight: 700,
                      cursor: 'pointer', letterSpacing: '0.3px',
                      display: 'flex', alignItems: 'center', gap: '3px',
                      fontFamily: 'inherit', marginLeft: 'auto',
                    }}
                  >
                    VIEW INVOICE
                    <ExternalLink size={10} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default SubscriptionManager;
