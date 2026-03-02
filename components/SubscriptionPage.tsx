import React, { useState, useEffect } from 'react';
import { db } from '../firebaseConfig';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { ShopProfile, PlanConfig } from '../types';
import { Crown, Zap, Building2, Check, ChevronDown, ChevronUp } from 'lucide-react';

interface SubscriptionPageProps {
    shopProfile: ShopProfile;
    onSubscribed: (updatedProfile: ShopProfile) => void;
}

const DEFAULT_PRICES: PlanConfig = {
    basicPrice: 499,
    proPrice: 3999,
    enterpriseMonthlyPrice: 399,
};

const SubscriptionPage: React.FC<SubscriptionPageProps> = ({ shopProfile, onSubscribed }) => {
    const [prices, setPrices] = useState<PlanConfig>(DEFAULT_PRICES);
    const [loading, setLoading] = useState(true);
    const [enterpriseMonths, setEnterpriseMonths] = useState(3);
    const [subscribing, setSubscribing] = useState<string | null>(null);

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
        } catch (err) {
            console.error('Failed to subscribe', err);
            alert('Subscription failed. Please try again.');
        }
        setSubscribing(null);
    };

    // Check if already has active subscription
    const isActive = shopProfile.subscriptionStatus === 'active' &&
        shopProfile.subscriptionEnd &&
        new Date(shopProfile.subscriptionEnd) > new Date();

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
                        : 'Select a plan to unlock all features of your shop dashboard'
                    }
                </p>
            </div>

            {/* Plan Cards */}
            <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
                gap: '24px',
                maxWidth: '960px',
                margin: '0 auto',
            }}>
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
                        {['1 month duration', 'Full billing system', 'Customer management', 'Product catalog'].map(f => (
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
                        {subscribing === 'basic' ? 'Processing...' : shopProfile.planId === 'basic' && isActive ? 'Active' : 'Get Basic'}
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
                        {['12 months duration', 'All Basic features', 'SP Management', 'Payment tracking', 'WhatsApp notifications', 'Priority support'].map(f => (
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
                        {subscribing === 'pro' ? 'Processing...' : shopProfile.planId === 'pro' && isActive ? 'Active' : 'Get Pro'}
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
                                onClick={() => setEnterpriseMonths(m => Math.max(1, m - 1))}
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
                                min={1}
                                max={36}
                                value={enterpriseMonths}
                                onChange={(e) => {
                                    const v = parseInt(e.target.value);
                                    if (v >= 1 && v <= 36) setEnterpriseMonths(v);
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
                        {['Custom duration', 'All Pro features', 'Bulk pricing', 'Dedicated support'].map(f => (
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
                        {subscribing === 'enterprise' ? 'Processing...' : shopProfile.planId === 'enterprise' && isActive ? 'Active' : 'Get Enterprise'}
                    </button>
                </div>
            </div>

            {/* Footer */}
            <p style={{
                textAlign: 'center', marginTop: '40px', fontSize: '13px',
                color: '#9CA3AF', fontWeight: 500,
            }}>
                Payment integration coming soon. Plans activate instantly for now.
            </p>
        </div>
    );
};

export default SubscriptionPage;
