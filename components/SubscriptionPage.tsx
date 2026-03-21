import React, { useState, useEffect } from 'react';
import { db, functions } from '../firebaseConfig';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { ShopProfile, PlanConfig } from '../types';
import { Crown, Zap, Building2, Check, ChevronDown, ChevronUp, LogOut } from 'lucide-react';

declare global {
  interface Window {
    Razorpay: any;
  }
}

interface SubscriptionPageProps {
    shopProfile: ShopProfile;
    onSubscribed: (updatedProfile: ShopProfile) => void;
    onLogout: () => void;
}

const DEFAULT_PRICES: PlanConfig = {
    basicPrice: 499,
    proPrice: 3999,
    enterpriseMonthlyPrice: 399,
    extendBasicPrice: 399,
    extendProPrice: 2999,
    extendCustomMonthlyPrice: 349,
};

const SubscriptionPage: React.FC<SubscriptionPageProps> = ({ shopProfile, onSubscribed, onLogout }) => {
    const [prices, setPrices] = useState<PlanConfig>(DEFAULT_PRICES);
    const [loading, setLoading] = useState(true);
    const [enterpriseMonths, setEnterpriseMonths] = useState(2);
    const [subscribing, setSubscribing] = useState<string | null>(null);
    const [showTrialModal, setShowTrialModal] = useState(false);
    const [trialForm, setTrialForm] = useState({ name: shopProfile.shopName, phone: shopProfile.phone });

    useEffect(() => {
        loadPrices();
    }, []);

    const loadPrices = async () => {
        try {
            const snap = await getDoc(doc(db, 'config', 'plans'));
            if (snap.exists()) {
                setPrices(snap.data() as PlanConfig);
            }
        } catch (err) {
            console.error('Failed to load plan prices', err);
        }
        setLoading(false);
    };

    const handleSubscribe = async (planId: string, durationMonths: number) => {
        setSubscribing(planId);
        try {
            // 1. Get the order details from our secure Cloud Function
            const createOrderObj = httpsCallable(functions, 'createRazorpayOrder');
            const result = await createOrderObj({ planId, enterpriseMonths: durationMonths });
            const data = result.data as any;

            if (!data.orderId) {
                throw new Error("Failed to generate order ID");
            }

            // 2. Initialize Razorpay Checkout
            const options = {
                key: data.keyId, // The public key from the backend
                amount: data.amount,
                currency: data.currency,
                name: "Instabill",
                description: `${planId.toUpperCase()} Plan Subscription`,
                image: "/Logo-Icon.png",
                order_id: data.orderId,
                handler: async function (response: any) {
                    try {
                        const now = new Date();
                        const end = new Date(now);
                        end.setMonth(end.getMonth() + durationMonths);

                        const updates: Partial<ShopProfile> = {
                            planId,
                            subscriptionStatus: 'active',
                            subscriptionStart: now.toISOString(),
                            subscriptionEnd: end.toISOString(),
                            currentPeriodEnd: end.toISOString(),
                            planDurationMonths: durationMonths,
                        };

                        await updateDoc(doc(db, 'shops', shopProfile.id), updates);

                        onSubscribed({
                            ...shopProfile,
                            ...updates,
                        } as ShopProfile);
                        
                        alert('Payment Successful! Your subscription is now active.');
                    } catch (err) {
                        console.error('Failed to update subscription post-payment', err);
                        alert('Payment was successful but error updating profile. Please contact support.');
                    }
                    setSubscribing(null);
                },
                prefill: {
                    name: shopProfile.shopName,
                    contact: shopProfile.phone
                },
                theme: {
                    color: "#21776A"
                },
                modal: {
                    ondismiss: function() {
                        setSubscribing(null);
                    }
                }
            };

            const rzp = new window.Razorpay(options);
            
            rzp.on('payment.failed', function (response: any) {
                console.error("Payment failed:", response.error);
                alert(`Payment Failed: ${response.error.description || 'Please try again.'}`);
                setSubscribing(null);
            });

            rzp.open();
            
        } catch (err: any) {
            console.error('Failed to initiate subscription', err);
            alert(`Subscription initiation failed: ${err.message || 'Please try again.'}`);
            setSubscribing(null);
        }
    };

    const handleRequestTrial = async (e: React.FormEvent) => {
        e.preventDefault();
        setSubscribing('trial');
        try {
            await updateDoc(doc(db, 'shops', shopProfile.id), {
                trialStatus: 'pending',
            });
            onSubscribed({ ...shopProfile, trialStatus: 'pending' });
            setShowTrialModal(false);
            alert("Free trial request submitted successfully! Admin will verify and activate your trial.");
        } catch (err) {
            console.error('Failed to request trial', err);
            alert("Failed to submit trial request. Please try again.");
        }
        setSubscribing(null);
    };

    // Check if already has active subscription
    const isActive = (shopProfile.subscriptionStatus === 'active' || shopProfile.subscriptionStatus === 'trial') &&
        shopProfile.subscriptionEnd &&
        (typeof shopProfile.subscriptionEnd === 'string' 
            ? new Date(shopProfile.subscriptionEnd) > new Date()
            : (shopProfile.subscriptionEnd as any).toDate ? (shopProfile.subscriptionEnd as any).toDate() > new Date() : false);

    if (loading) {
        return (
            <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f8faf7' }}>
                <div className="w-12 h-12 border-4 border-[#21776A] border-t-transparent rounded-full animate-spin" />
            </div>
        );
    }

    const enterpriseTotal = enterpriseMonths * prices.enterpriseMonthlyPrice;

    return (
        <div style={{
            minHeight: '100vh',
            background: 'linear-gradient(135deg, #f0f7ee 0%, #e8f4e6 30%, #f5f9f4 100%)',
            padding: '40px 20px',
            fontFamily: "'Inter', -apple-system, sans-serif",
        }}>
            {/* Logout Button */}
            <button
                onClick={onLogout}
                style={{
                    position: 'absolute',
                    top: '20px',
                    right: '20px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    padding: '8px 16px',
                    background: 'white',
                    color: '#EF4444',
                    border: '1px solid #FEE2E2',
                    borderRadius: '12px',
                    fontSize: '14px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.02)',
                    transition: 'all 0.2s',
                    zIndex: 50,
                }}
                onMouseOver={(e) => {
                    e.currentTarget.style.background = '#FEF2F2';
                    e.currentTarget.style.transform = 'translateY(-1px)';
                }}
                onMouseOut={(e) => {
                    e.currentTarget.style.background = 'white';
                    e.currentTarget.style.transform = 'translateY(0)';
                }}
            >
                <LogOut size={16} />
                Logout
            </button>

            {/* Header */}
            <div style={{ textAlign: 'center', marginBottom: '48px', maxWidth: '600px', margin: '0 auto 48px' }}>
                <div style={{
                    display: 'inline-flex', alignItems: 'center', gap: '8px',
                    padding: '6px 16px', borderRadius: '24px',
                    background: 'rgba(33, 119, 106, 0.1)',
                    color: '#21776A', fontSize: '13px', fontWeight: 700,
                    marginBottom: '16px', letterSpacing: '0.5px',
                }}>
                    <Crown size={14} />
                    {isActive ? 'MANAGE YOUR PLAN' : 'CHOOSE YOUR PLAN'}
                </div>
                <h1 style={{
                    fontSize: '32px', fontWeight: 800, color: '#111617',
                    margin: '0 0 12px', lineHeight: 1.2,
                }}>
                    {isActive ? 'Your Subscription' : 'Start Your Journey'}
                </h1>
                <p style={{ fontSize: '16px', color: '#6B7280', margin: 0, lineHeight: 1.6 }}>
                    {isActive
                        ? `Your ${shopProfile.planId} plan is active until ${new Date(shopProfile.subscriptionEnd!).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}`
                        : (shopProfile.trialStatus === 'pending' ? 'Your Free Trial request is pending verification. Please wait for admin approval.' : 'Select a plan to unlock all features of your shop dashboard')
                    }
                </p>
            </div>

            {/* Plan Cards */}
            <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
                gap: '24px',
                maxWidth: '1200px',
                margin: '0 auto',
            }}>
                {/* Free Trial Card */}
                {(!shopProfile.trialStatus || shopProfile.trialStatus === 'none') && !isActive && (
                    <div style={{
                        background: 'linear-gradient(135deg, #FF9A9E 0%, #FECFEF 100%)',
                        borderRadius: '20px',
                        padding: '32px 28px',
                        border: 'none',
                        boxShadow: '0 4px 15px rgba(255, 154, 158, 0.3)',
                        display: 'flex',
                        flexDirection: 'column',
                        position: 'relative',
                        transition: 'all 0.3s ease',
                    }}>
                        <div style={{
                            position: 'absolute', top: '-12px', left: '50%', transform: 'translateX(-50%)',
                            background: '#FF416C', color: 'white', padding: '4px 16px', borderRadius: '12px',
                            fontSize: '11px', fontWeight: 800, letterSpacing: '0.5px', whiteSpace: 'nowrap'
                        }}>NEW SHOP</div>
                        <div style={{
                            width: '48px', height: '48px', borderRadius: '14px',
                            background: 'rgba(255,255,255,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                            marginBottom: '20px',
                        }}>
                            <Zap size={24} color="#FF416C" />
                        </div>
                        <h3 style={{ fontSize: '20px', fontWeight: 800, color: '#111617', margin: '0 0 4px' }}>Free Trial</h3>
                        <p style={{ fontSize: '13px', color: '#111617', opacity: 0.8, margin: '0 0 20px' }}>Request test access</p>
                        <div style={{ marginBottom: '24px' }}>
                            <span style={{ fontSize: '36px', fontWeight: 900, color: '#111617' }}>Free</span>
                        </div>
                        <div style={{ flex: 1, marginBottom: '24px' }}>
                            {['7 days duration', 'All Features', 'All Products Catalog', 'Pending Product Manager', 'SP Management', 'Customer Data Manager', 'Payment Tracking', 'Daily Revenue Stats'].map(f => (
                                <div key={f} style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
                                    <div style={{ width: '20px', height: '20px', borderRadius: '50%', background: 'rgba(255,255,255,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                        <Check size={12} color="#FF416C" strokeWidth={3} />
                                    </div>
                                    <span style={{ fontSize: '13px', color: '#111617', fontWeight: 600 }}>{f}</span>
                                </div>
                            ))}
                        </div>
                        <button
                            onClick={() => setShowTrialModal(true)}
                            disabled={subscribing !== null}
                            style={{
                                width: '100%', padding: '14px',
                                background: '#FF416C',
                                color: 'white',
                                border: 'none', borderRadius: '12px',
                                fontSize: '14px', fontWeight: 700,
                                cursor: 'pointer',
                                transition: 'all 0.2s',
                                fontFamily: 'inherit',
                            }}
                        >
                            Request For Free Trial
                        </button>
                    </div>
                )}

                {/* Basic Plan */}
                <div style={{
                    background: 'white',
                    borderRadius: '20px',
                    padding: '32px 28px',
                    border: shopProfile.planId === 'basic' && isActive ? '2px solid #21776A' : '1px solid #E5E7EB',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
                    display: 'flex',
                    flexDirection: 'column',
                    position: 'relative',
                    transition: 'all 0.3s ease',
                }}>
                    {shopProfile.planId === 'basic' && isActive && (
                        <div style={{
                            position: 'absolute', top: '-12px', left: '50%', transform: 'translateX(-50%)',
                            background: '#21776A', color: 'white', padding: '4px 16px', borderRadius: '12px',
                            fontSize: '11px', fontWeight: 700, letterSpacing: '0.5px',
                        }}>CURRENT PLAN</div>
                    )}
                    <div style={{
                        width: '48px', height: '48px', borderRadius: '14px',
                        background: '#EEF9FF', display: 'flex', alignItems: 'center', justifyContent: 'center',
                        marginBottom: '20px',
                    }}>
                        <Zap size={24} color="#3B82F6" />
                    </div>
                    <h3 style={{ fontSize: '20px', fontWeight: 800, color: '#111617', margin: '0 0 4px' }}>Basic</h3>
                    <p style={{ fontSize: '13px', color: '#9CA3AF', margin: '0 0 20px' }}>Perfect to get started</p>
                    <div style={{ marginBottom: '24px' }}>
                        <span style={{ fontSize: '36px', fontWeight: 900, color: '#111617' }}>₹{prices.basicPrice.toLocaleString('en-IN')}</span>
                        <span style={{ fontSize: '14px', color: '#9CA3AF', fontWeight: 500, marginLeft: '4px' }}>/month</span>
                    </div>
                    <div style={{ flex: 1, marginBottom: '24px' }}>
                        {['1-Month Duration', 'All Features', 'All Products Catalog', 'Pending Product Manager', 'SP Management', 'Customer Data Manager', 'Payment Tracking', 'Daily Revenue Stats', 'Unlimited Bills Generation', 'WhatsApp Notifications', 'Customer Support'].map(f => (
                            <div key={f} style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
                                <div style={{ width: '20px', height: '20px', borderRadius: '50%', background: '#EEF9FF', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                    <Check size={12} color="#3B82F6" strokeWidth={3} />
                                </div>
                                <span style={{ fontSize: '13px', color: '#4B5563', fontWeight: 500 }}>{f}</span>
                            </div>
                        ))}
                    </div>
                    <button
                        onClick={() => handleSubscribe('basic', 1)}
                        disabled={subscribing !== null || (shopProfile.planId === 'basic' && isActive)}
                        style={{
                            width: '100%', padding: '14px',
                            background: shopProfile.planId === 'basic' && isActive ? '#E5E7EB' : '#3B82F6',
                            color: shopProfile.planId === 'basic' && isActive ? '#9CA3AF' : 'white',
                            border: 'none', borderRadius: '12px',
                            fontSize: '14px', fontWeight: 700,
                            cursor: shopProfile.planId === 'basic' && isActive ? 'default' : 'pointer',
                            transition: 'all 0.2s',
                            fontFamily: 'inherit',
                        }}
                    >
                        {shopProfile.planId === 'basic' && isActive ? 'Active' : (subscribing === 'basic' ? 'Processing...' : 'Get Basic')}
                    </button>
                </div>

                {/* Pro Plan */}
                <div style={{
                    background: 'linear-gradient(135deg, #21776A 0%, #1a5f54 100%)',
                    borderRadius: '20px',
                    padding: '32px 28px',
                    border: 'none',
                    boxShadow: '0 8px 32px rgba(33, 119, 106, 0.25)',
                    display: 'flex',
                    flexDirection: 'column',
                    position: 'relative',
                    transform: 'scale(1.02)',
                }}>
                    <div style={{
                        position: 'absolute', top: '-12px', left: '50%', transform: 'translateX(-50%)',
                        background: '#88DE7D', color: '#111617', padding: '4px 16px', borderRadius: '12px',
                        fontSize: '11px', fontWeight: 800, letterSpacing: '0.5px',
                    }}>
                        {shopProfile.planId === 'pro' && isActive ? 'CURRENT PLAN' : 'BEST VALUE'}
                    </div>
                    <div style={{
                        width: '48px', height: '48px', borderRadius: '14px',
                        background: 'rgba(255,255,255,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                        marginBottom: '20px',
                    }}>
                        <Crown size={24} color="#88DE7D" />
                    </div>
                    <h3 style={{ fontSize: '20px', fontWeight: 800, color: 'white', margin: '0 0 4px' }}>Pro</h3>
                    <p style={{ fontSize: '13px', color: 'rgba(255,255,255,0.6)', margin: '0 0 20px' }}>Best for growing shops</p>
                    <div style={{ marginBottom: '24px' }}>
                        <span style={{ fontSize: '36px', fontWeight: 900, color: 'white' }}>₹{prices.proPrice.toLocaleString('en-IN')}</span>
                        <span style={{ fontSize: '14px', color: 'rgba(255,255,255,0.5)', fontWeight: 500, marginLeft: '4px' }}>/year</span>
                    </div>
                    <div style={{ flex: 1, marginBottom: '24px' }}>
                        {['12-Month Duration', 'All Features', 'All Products Catalog', 'Pending Product Manager', 'SP Management', 'Customer Data Manager', 'Payment Tracking', 'Daily Revenue Stats', 'Unlimited Bills Generation', 'WhatsApp Notifications', 'Priority Support'].map(f => (
                            <div key={f} style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
                                <div style={{ width: '20px', height: '20px', borderRadius: '50%', background: 'rgba(136,222,125,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                    <Check size={12} color="#88DE7D" strokeWidth={3} />
                                </div>
                                <span style={{ fontSize: '13px', color: 'rgba(255,255,255,0.9)', fontWeight: 500 }}>{f}</span>
                            </div>
                        ))}
                    </div>
                    <button
                        onClick={() => handleSubscribe('pro', 12)}
                        disabled={subscribing !== null || (shopProfile.planId === 'pro' && isActive)}
                        style={{
                            width: '100%', padding: '14px',
                            background: shopProfile.planId === 'pro' && isActive ? 'rgba(255,255,255,0.2)' : '#88DE7D',
                            color: shopProfile.planId === 'pro' && isActive ? 'rgba(255,255,255,0.5)' : '#111617',
                            border: 'none', borderRadius: '12px',
                            fontSize: '14px', fontWeight: 800,
                            cursor: shopProfile.planId === 'pro' && isActive ? 'default' : 'pointer',
                            transition: 'all 0.2s',
                            fontFamily: 'inherit',
                        }}
                    >
                        {shopProfile.planId === 'pro' && isActive ? 'Active' : (subscribing === 'pro' ? 'Processing...' : 'Get Pro')}
                    </button>
                </div>

                {/* Enterprise Plan */}
                <div style={{
                    background: 'white',
                    borderRadius: '20px',
                    padding: '32px 28px',
                    border: shopProfile.planId === 'enterprise' && isActive ? '2px solid #7C3AED' : '1px solid #E5E7EB',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
                    display: 'flex',
                    flexDirection: 'column',
                    position: 'relative',
                    transition: 'all 0.3s ease',
                }}>
                    {shopProfile.planId === 'enterprise' && isActive && (
                        <div style={{
                            position: 'absolute', top: '-12px', left: '50%', transform: 'translateX(-50%)',
                            background: '#7C3AED', color: 'white', padding: '4px 16px', borderRadius: '12px',
                            fontSize: '11px', fontWeight: 700, letterSpacing: '0.5px',
                        }}>CURRENT PLAN</div>
                    )}
                    <div style={{
                        width: '48px', height: '48px', borderRadius: '14px',
                        background: '#F3E8FF', display: 'flex', alignItems: 'center', justifyContent: 'center',
                        marginBottom: '20px',
                    }}>
                        <Building2 size={24} color="#7C3AED" />
                    </div>
                    <h3 style={{ fontSize: '20px', fontWeight: 800, color: '#111617', margin: '0 0 4px' }}>Enterprise</h3>
                    <p style={{ fontSize: '13px', color: '#9CA3AF', margin: '0 0 20px' }}>Flexible custom duration</p>

                    {/* Price */}
                    <div style={{ marginBottom: '16px' }}>
                        <span style={{ fontSize: '36px', fontWeight: 900, color: '#111617' }}>₹{enterpriseTotal.toLocaleString('en-IN')}</span>
                        <span style={{ fontSize: '14px', color: '#9CA3AF', fontWeight: 500, marginLeft: '4px' }}>
                            / {enterpriseMonths} month{enterpriseMonths > 1 ? 's' : ''}
                        </span>
                    </div>

                    {/* Month Selector */}
                    <div style={{
                        display: 'flex', alignItems: 'center', gap: '12px',
                        padding: '12px 16px', background: '#F9FAFB', borderRadius: '12px',
                        marginBottom: '24px',
                    }}>
                        <span style={{ fontSize: '13px', fontWeight: 600, color: '#6B7280', whiteSpace: 'nowrap' }}>Duration:</span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1 }}>
                            <button
                                onClick={() => setEnterpriseMonths(m => Math.max(2, m - 1))}
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
                                value={enterpriseMonths}
                                onChange={(e) => {
                                    const v = parseInt(e.target.value);
                                    if (v >= 2 && v <= 36) setEnterpriseMonths(v);
                                }}
                                style={{
                                    width: '48px', textAlign: 'center',
                                    border: '1px solid #E5E7EB', borderRadius: '8px',
                                    padding: '6px', fontSize: '16px', fontWeight: 800,
                                    fontFamily: 'inherit', color: '#111617', outline: 'none',
                                }}
                            />
                            <button
                                onClick={() => setEnterpriseMonths(m => Math.min(36, m + 1))}
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
                        ₹{prices.enterpriseMonthlyPrice.toLocaleString('en-IN')} × {enterpriseMonths} months = ₹{enterpriseTotal.toLocaleString('en-IN')}
                    </p>

                    <div style={{ flex: 1, marginBottom: '24px' }}>
                        {['Custom Duration', 'All Features', 'All Products Catalog', 'Pending Product Manager', 'SP Management', 'Customer Data Manager', 'Payment Tracking', 'Daily Revenue Stats', 'Unlimited Bills Generation', 'WhatsApp Notifications', 'Customer Support'].map(f => (
                            <div key={f} style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
                                <div style={{ width: '20px', height: '20px', borderRadius: '50%', background: '#F3E8FF', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                    <Check size={12} color="#7C3AED" strokeWidth={3} />
                                </div>
                                <span style={{ fontSize: '13px', color: '#4B5563', fontWeight: 500 }}>{f}</span>
                            </div>
                        ))}
                    </div>
                    <button
                        onClick={() => handleSubscribe('enterprise', enterpriseMonths)}
                        disabled={subscribing !== null || (shopProfile.planId === 'enterprise' && isActive)}
                        style={{
                            width: '100%', padding: '14px',
                            background: shopProfile.planId === 'enterprise' && isActive ? '#E5E7EB' : '#7C3AED',
                            color: shopProfile.planId === 'enterprise' && isActive ? '#9CA3AF' : 'white',
                            border: 'none', borderRadius: '12px',
                            fontSize: '14px', fontWeight: 700,
                            cursor: shopProfile.planId === 'enterprise' && isActive ? 'default' : 'pointer',
                            transition: 'all 0.2s',
                            fontFamily: 'inherit',
                        }}
                    >
                        {shopProfile.planId === 'enterprise' && isActive ? 'Active' : (subscribing === 'enterprise' ? 'Processing...' : 'Get Enterprise')}
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

            {/* Trial Request Modal */}
            {showTrialModal && (
                <div style={{
                    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                    background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    zIndex: 1000, padding: '20px',
                }}>
                    <div style={{
                        background: 'white', borderRadius: '20px', width: '100%', maxWidth: '400px',
                        padding: '32px', boxShadow: '0 10px 40px rgba(0,0,0,0.2)',
                    }}>
                        <h2 style={{ fontSize: '24px', fontWeight: 800, margin: '0 0 16px', color: '#111617' }}>Request Free Trial</h2>
                        <p style={{ fontSize: '14px', color: '#6B7280', margin: '0 0 24px' }}>Verify your details to request an admin-approved free trial.</p>
                        
                        <form onSubmit={handleRequestTrial}>
                            <div style={{ marginBottom: '16px' }}>
                                <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#4B5563', marginBottom: '8px' }}>Shop Name</label>
                                <input 
                                    type="text" 
                                    value={trialForm.name} 
                                    onChange={e => setTrialForm({...trialForm, name: e.target.value})} 
                                    style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid #E5E7EB', fontSize: '14px', outline: 'none' }}
                                    required 
                                />
                            </div>
                            <div style={{ marginBottom: '24px' }}>
                                <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#4B5563', marginBottom: '8px' }}>Phone Number</label>
                                <input 
                                    type="text" 
                                    value={trialForm.phone} 
                                    onChange={e => setTrialForm({...trialForm, phone: e.target.value})} 
                                    style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid #E5E7EB', fontSize: '14px', outline: 'none' }}
                                    required 
                                />
                            </div>
                            
                            <div style={{ display: 'flex', gap: '12px' }}>
                                <button type="button" onClick={() => setShowTrialModal(false)} style={{
                                    flex: 1, padding: '12px', background: '#F3F4F6', color: '#4B5563',
                                    border: 'none', borderRadius: '8px', fontWeight: 600, cursor: 'pointer'
                                }}>Cancel</button>
                                <button type="submit" disabled={subscribing === 'trial'} style={{
                                    flex: 1, padding: '12px', background: '#FF416C', color: 'white',
                                    border: 'none', borderRadius: '8px', fontWeight: 600, cursor: 'pointer'
                                }}>
                                    {subscribing === 'trial' ? 'Submitting...' : 'Submit'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default SubscriptionPage;
