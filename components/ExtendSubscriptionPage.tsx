import React, { useState, useEffect } from 'react';
import { db, functions } from '../firebaseConfig';
import { doc, getDoc, updateDoc, collection, addDoc } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { ShopProfile, PlanConfig, SubscriptionTransaction } from '../types';
import { Plus, Crown, ArrowLeft, Zap, Settings, Check, ChevronDown, ChevronUp } from 'lucide-react';

declare global {
  interface Window {
    Razorpay: any;
  }
}

interface ExtendSubscriptionPageProps {
  shopProfile: ShopProfile;
  onExtended: (updatedProfile: ShopProfile) => void;
  onBack: () => void;
}

const DEFAULT_PRICES: PlanConfig = {
  basicPrice: 499,
  proPrice: 3999,
  enterpriseMonthlyPrice: 399,
  extendBasicPrice: 399,
  extendProPrice: 2999,
  extendCustomMonthlyPrice: 349,
};

const ExtendSubscriptionPage: React.FC<ExtendSubscriptionPageProps> = ({ shopProfile, onExtended, onBack }) => {
  const [prices, setPrices] = useState<PlanConfig>(DEFAULT_PRICES);
  const [loading, setLoading] = useState(true);
  const [customMonths, setCustomMonths] = useState(2);
  const [subscribing, setSubscribing] = useState<string | null>(null);

  useEffect(() => {
    loadPrices();
  }, []);

  const loadPrices = async () => {
    try {
      const snap = await getDoc(doc(db, 'config', 'plans'));
      if (snap.exists()) {
        const data = snap.data() as PlanConfig;
        setPrices({
          ...DEFAULT_PRICES,
          ...data,
        });
      }
    } catch (err) {
      console.error('Failed to load extension prices', err);
    }
    setLoading(false);
  };

  const planName = shopProfile.planId
    ? shopProfile.planId.charAt(0).toUpperCase() + shopProfile.planId.slice(1) + ' Plan'
    : 'Current Plan';

  const daysRemaining = shopProfile.subscriptionEnd
    ? Math.max(0, Math.ceil((new Date(shopProfile.subscriptionEnd).getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
    : 0;

  const handleExtend = async (extensionType: string, durationMonths: number, amount: number) => {
    setSubscribing(extensionType);
    try {
      const createOrderObj = httpsCallable(functions, 'createRazorpayOrder');
      const result = await createOrderObj({
        planId: extensionType,
        enterpriseMonths: durationMonths,
        amount: amount,
        isExtension: true,
      });
      const data = result.data as any;

      if (!data.orderId) {
        throw new Error('Failed to generate order ID');
      }

      const options = {
        key: data.keyId,
        amount: data.amount,
        currency: data.currency,
        name: 'Instabill',
        description: `Extend Subscription (+${durationMonths} month${durationMonths > 1 ? 's' : ''})`,
        image: '/Logo-Icon.png',
        order_id: data.orderId,
        handler: async function (response: any) {
          try {
            // Calculate new end date by extending from current end (or now if expired)
            const currentEnd = shopProfile.subscriptionEnd
              ? new Date(shopProfile.subscriptionEnd)
              : new Date();
            const baseDate = currentEnd > new Date() ? currentEnd : new Date();
            const newEnd = new Date(baseDate);
            newEnd.setMonth(newEnd.getMonth() + durationMonths);

            const updates: Partial<ShopProfile> = {
              subscriptionStatus: 'active',
              subscriptionEnd: newEnd.toISOString(),
              currentPeriodEnd: newEnd.toISOString(),
            };

            await updateDoc(doc(db, 'shops', shopProfile.id), updates);

            // Save transaction record
            try {
              const txData: Omit<SubscriptionTransaction, 'id'> = {
                shopId: shopProfile.id,
                type: 'extension',
                planId: shopProfile.planId || 'basic',
                amount: amount,
                durationMonths,
                date: new Date().toISOString(),
                razorpayOrderId: data.orderId,
                razorpayPaymentId: response.razorpay_payment_id,
                periodStart: baseDate.toISOString(),
                periodEnd: newEnd.toISOString(),
              };
              await addDoc(collection(db, 'shops', shopProfile.id, 'subscriptionTransactions'), txData);
            } catch (txErr) {
              console.error('Failed to save transaction record', txErr);
            }

            onExtended({
              ...shopProfile,
              ...updates,
            } as ShopProfile);

            alert(`Subscription extended! Your plan is now active until ${newEnd.toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}.`);
          } catch (err) {
            console.error('Failed to update subscription post-payment', err);
            alert('Payment was successful but error updating profile. Please contact support.');
          }
          setSubscribing(null);
        },
        prefill: {
          name: shopProfile.shopName,
          contact: shopProfile.phone,
        },
        theme: {
          color: '#00747B',
        },
        modal: {
          ondismiss: function () {
            setSubscribing(null);
          },
        },
      };

      const rzp = new window.Razorpay(options);

      rzp.on('payment.failed', function (response: any) {
        console.error('Payment failed:', response.error);
        alert(`Payment Failed: ${response.error.description || 'Please try again.'}`);
        setSubscribing(null);
      });

      rzp.open();
    } catch (err: any) {
      console.error('Failed to initiate extension', err);
      alert(`Extension failed: ${err.message || 'Please try again.'}`);
      setSubscribing(null);
    }
  };

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f8faf7' }}>
        <div style={{
          width: '48px', height: '48px', border: '4px solid #00747B', borderTopColor: 'transparent',
          borderRadius: '50%', animation: 'spin 1s linear infinite',
        }} />
      </div>
    );
  }

  const customTotal = customMonths * (prices.extendCustomMonthlyPrice || 349);

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #f0f7ee 0%, #e8f4e6 30%, #f5f9f4 100%)',
      padding: '40px 20px',
      fontFamily: "'Inter', -apple-system, sans-serif",
    }}>
      {/* Back Button */}
      <button
        onClick={onBack}
        style={{
          position: 'absolute', top: '20px', left: '20px',
          display: 'flex', alignItems: 'center', gap: '8px',
          padding: '8px 16px', background: 'white', color: '#02575c',
          border: '1px solid #E5E7EB', borderRadius: '12px',
          fontSize: '14px', fontWeight: 600, cursor: 'pointer',
          boxShadow: '0 2px 8px rgba(0,0,0,0.02)', transition: 'all 0.2s', zIndex: 50,
        }}
        onMouseOver={(e) => { e.currentTarget.style.background = '#F3F5F2'; e.currentTarget.style.transform = 'translateY(-1px)'; }}
        onMouseOut={(e) => { e.currentTarget.style.background = 'white'; e.currentTarget.style.transform = 'translateY(0)'; }}
      >
        <ArrowLeft size={16} />
        Back
      </button>

      {/* Header */}
      <div style={{ textAlign: 'center', marginBottom: '48px', maxWidth: '600px', margin: '0 auto 48px' }}>
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: '8px',
          padding: '6px 16px', borderRadius: '24px',
          background: 'rgba(33, 119, 106, 0.1)',
          color: '#00747B', fontSize: '13px', fontWeight: 700,
          marginBottom: '16px', letterSpacing: '0.5px',
        }}>
          <Plus size={14} />
          EXTEND SUBSCRIPTION
        </div>
        <h1 style={{
          fontSize: '32px', fontWeight: 800, color: '#02575c',
          margin: '0 0 12px', lineHeight: 1.2,
        }}>
          Extend Your {planName}
        </h1>
        <p style={{ fontSize: '16px', color: '#6B7280', margin: 0, lineHeight: 1.6 }}>
          Add more time to your current subscription. You have <strong style={{ color: '#00747B' }}>{daysRemaining} days</strong> remaining.
        </p>
      </div>

      {/* Extension Cards */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
        gap: '24px',
        maxWidth: '960px',
        margin: '0 auto',
      }}>
        {/* Basic Extension */}
        <div style={{
          background: 'white', borderRadius: '20px', padding: '32px 28px',
          border: '1px solid #E5E7EB', boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
          display: 'flex', flexDirection: 'column', position: 'relative',
          transition: 'all 0.3s ease',
        }}>
          <div style={{
            width: '48px', height: '48px', borderRadius: '14px',
            background: '#EEF9FF', display: 'flex', alignItems: 'center', justifyContent: 'center',
            marginBottom: '20px',
          }}>
            <Zap size={24} color="#3B82F6" />
          </div>
          <h3 style={{ fontSize: '20px', fontWeight: 800, color: '#02575c', margin: '0 0 4px' }}>Basic Extension</h3>
          <p style={{ fontSize: '13px', color: '#9CA3AF', margin: '0 0 20px' }}>Add 1 month to your plan</p>
          <div style={{ marginBottom: '24px' }}>
            <span style={{ fontSize: '36px', fontWeight: 900, color: '#02575c' }}>₹{(prices.extendBasicPrice || 399).toLocaleString('en-IN')}</span>
            <span style={{ fontSize: '14px', color: '#9CA3AF', fontWeight: 500, marginLeft: '4px' }}>/+1 month</span>
          </div>
          <div style={{ flex: 1, marginBottom: '24px' }}>
            {['+30 Days Extension', 'No Plan Change', 'All Features Retained', 'Instant Activation'].map(f => (
              <div key={f} style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
                <div style={{ width: '20px', height: '20px', borderRadius: '50%', background: '#EEF9FF', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <Check size={12} color="#3B82F6" strokeWidth={3} />
                </div>
                <span style={{ fontSize: '13px', color: '#4B5563', fontWeight: 500 }}>{f}</span>
              </div>
            ))}
          </div>
          <button
            onClick={() => handleExtend('extend-basic', 1, prices.extendBasicPrice || 399)}
            disabled={subscribing !== null}
            style={{
              width: '100%', padding: '14px',
              background: subscribing === 'extend-basic' ? '#93C5FD' : '#3B82F6',
              color: 'white', border: 'none', borderRadius: '12px',
              fontSize: '14px', fontWeight: 700,
              cursor: subscribing !== null ? 'not-allowed' : 'pointer',
              transition: 'all 0.2s', fontFamily: 'inherit',
              opacity: subscribing !== null && subscribing !== 'extend-basic' ? 0.5 : 1,
            }}
          >
            {subscribing === 'extend-basic' ? 'Processing...' : 'Extend +1 Month'}
          </button>
        </div>

        {/* Pro Extension */}
        <div style={{
          background: 'linear-gradient(135deg, #00747B 0%, #1a5f54 100%)',
          borderRadius: '20px', padding: '32px 28px',
          border: 'none', boxShadow: '0 8px 32px rgba(33, 119, 106, 0.25)',
          display: 'flex', flexDirection: 'column', position: 'relative',
          transform: 'scale(1.02)',
        }}>
          <div style={{
            position: 'absolute', top: '-12px', left: '50%', transform: 'translateX(-50%)',
            background: '#88DE7D', color: '#02575c', padding: '4px 16px', borderRadius: '12px',
            fontSize: '11px', fontWeight: 800, letterSpacing: '0.5px',
          }}>BEST VALUE</div>
          <div style={{
            width: '48px', height: '48px', borderRadius: '14px',
            background: 'rgba(255,255,255,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center',
            marginBottom: '20px',
          }}>
            <Crown size={24} color="#88DE7D" />
          </div>
          <h3 style={{ fontSize: '20px', fontWeight: 800, color: 'white', margin: '0 0 4px' }}>Pro Extension</h3>
          <p style={{ fontSize: '13px', color: 'rgba(255,255,255,0.6)', margin: '0 0 20px' }}>Add 12 months to your plan</p>
          <div style={{ marginBottom: '24px' }}>
            <span style={{ fontSize: '36px', fontWeight: 900, color: 'white' }}>₹{(prices.extendProPrice || 2999).toLocaleString('en-IN')}</span>
            <span style={{ fontSize: '14px', color: 'rgba(255,255,255,0.5)', fontWeight: 500, marginLeft: '4px' }}>/+12 months</span>
          </div>
          <div style={{ flex: 1, marginBottom: '24px' }}>
            {['+365 Days Extension', 'No Plan Change', 'All Features Retained', 'Instant Activation', 'Best Per-Month Value'].map(f => (
              <div key={f} style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
                <div style={{ width: '20px', height: '20px', borderRadius: '50%', background: 'rgba(136,222,125,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <Check size={12} color="#88DE7D" strokeWidth={3} />
                </div>
                <span style={{ fontSize: '13px', color: 'rgba(255,255,255,0.9)', fontWeight: 500 }}>{f}</span>
              </div>
            ))}
          </div>
          <button
            onClick={() => handleExtend('extend-pro', 12, prices.extendProPrice || 2999)}
            disabled={subscribing !== null}
            style={{
              width: '100%', padding: '14px',
              background: subscribing === 'extend-pro' ? 'rgba(136,222,125,0.5)' : '#88DE7D',
              color: '#02575c', border: 'none', borderRadius: '12px',
              fontSize: '14px', fontWeight: 800,
              cursor: subscribing !== null ? 'not-allowed' : 'pointer',
              transition: 'all 0.2s', fontFamily: 'inherit',
              opacity: subscribing !== null && subscribing !== 'extend-pro' ? 0.5 : 1,
            }}
          >
            {subscribing === 'extend-pro' ? 'Processing...' : 'Extend +12 Months'}
          </button>
        </div>

        {/* Custom Extension */}
        <div style={{
          background: 'white', borderRadius: '20px', padding: '32px 28px',
          border: '1px solid #E5E7EB', boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
          display: 'flex', flexDirection: 'column', position: 'relative',
          transition: 'all 0.3s ease',
        }}>
          <div style={{
            width: '48px', height: '48px', borderRadius: '14px',
            background: '#F3E8FF', display: 'flex', alignItems: 'center', justifyContent: 'center',
            marginBottom: '20px',
          }}>
            <Settings size={24} color="#7C3AED" />
          </div>
          <h3 style={{ fontSize: '20px', fontWeight: 800, color: '#02575c', margin: '0 0 4px' }}>Custom Extension</h3>
          <p style={{ fontSize: '13px', color: '#9CA3AF', margin: '0 0 20px' }}>Choose how many months to add</p>

          {/* Price */}
          <div style={{ marginBottom: '16px' }}>
            <span style={{ fontSize: '36px', fontWeight: 900, color: '#02575c' }}>₹{customTotal.toLocaleString('en-IN')}</span>
            <span style={{ fontSize: '14px', color: '#9CA3AF', fontWeight: 500, marginLeft: '4px' }}>
              / +{customMonths} month{customMonths > 1 ? 's' : ''}
            </span>
          </div>

          {/* Month Selector */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: '12px',
            padding: '12px 16px', background: '#F9FAFB', borderRadius: '12px',
            marginBottom: '16px',
          }}>
            <span style={{ fontSize: '13px', fontWeight: 600, color: '#6B7280', whiteSpace: 'nowrap' }}>Duration:</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1 }}>
              <button
                onClick={() => setCustomMonths(m => Math.max(2, m - 1))}
                style={{
                  width: '32px', height: '32px', borderRadius: '8px',
                  background: 'white', border: '1px solid #E5E7EB',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  cursor: 'pointer', transition: 'all 0.15s',
                }}
              >
                <ChevronDown size={16} color="#6B7280" />
              </button>
              <input
                type="number"
                min={2}
                max={36}
                value={customMonths}
                onChange={(e) => {
                  const v = parseInt(e.target.value);
                  if (v >= 2 && v <= 36) setCustomMonths(v);
                }}
                style={{
                  width: '48px', textAlign: 'center',
                  border: '1px solid #E5E7EB', borderRadius: '8px',
                  padding: '6px', fontSize: '16px', fontWeight: 800,
                  fontFamily: 'inherit', color: '#02575c', outline: 'none',
                }}
              />
              <button
                onClick={() => setCustomMonths(m => Math.min(36, m + 1))}
                style={{
                  width: '32px', height: '32px', borderRadius: '8px',
                  background: 'white', border: '1px solid #E5E7EB',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  cursor: 'pointer', transition: 'all 0.15s',
                }}
              >
                <ChevronUp size={16} color="#6B7280" />
              </button>
              <span style={{ fontSize: '13px', color: '#9CA3AF', fontWeight: 500 }}>months</span>
            </div>
          </div>

          {/* Per month breakdown */}
          <p style={{ fontSize: '12px', color: '#9CA3AF', margin: '0 0 16px', textAlign: 'center' }}>
            ₹{(prices.extendCustomMonthlyPrice || 349).toLocaleString('en-IN')} × {customMonths} months = ₹{customTotal.toLocaleString('en-IN')}
          </p>

          <div style={{ flex: 1, marginBottom: '24px' }}>
            {['Custom Duration Extension', 'No Plan Change', 'All Features Retained', 'Instant Activation'].map(f => (
              <div key={f} style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
                <div style={{ width: '20px', height: '20px', borderRadius: '50%', background: '#F3E8FF', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <Check size={12} color="#7C3AED" strokeWidth={3} />
                </div>
                <span style={{ fontSize: '13px', color: '#4B5563', fontWeight: 500 }}>{f}</span>
              </div>
            ))}
          </div>
          <button
            onClick={() => handleExtend('extend-custom', customMonths, customTotal)}
            disabled={subscribing !== null}
            style={{
              width: '100%', padding: '14px',
              background: subscribing === 'extend-custom' ? '#C4B5FD' : '#7C3AED',
              color: 'white', border: 'none', borderRadius: '12px',
              fontSize: '14px', fontWeight: 700,
              cursor: subscribing !== null ? 'not-allowed' : 'pointer',
              transition: 'all 0.2s', fontFamily: 'inherit',
              opacity: subscribing !== null && subscribing !== 'extend-custom' ? 0.5 : 1,
            }}
          >
            {subscribing === 'extend-custom' ? 'Processing...' : `Extend +${customMonths} Months`}
          </button>
        </div>
      </div>

      {/* Footer */}
      <p style={{
        textAlign: 'center', marginTop: '40px', fontSize: '13px',
        color: '#9CA3AF', fontWeight: 500,
      }}>
        Secure Payments Powered by Razorpay.
      </p>
    </div>
  );
};

export default ExtendSubscriptionPage;
