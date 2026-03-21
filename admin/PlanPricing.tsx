import React, { useState, useEffect } from 'react';
import { db } from '../firebaseConfig';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { PlanConfig, ShopProfile } from '../types';

const DEFAULT_PRICES: PlanConfig = {
    basicPrice: 499,
    proPrice: 3999,
    enterpriseMonthlyPrice: 399,
    extendBasicPrice: 399,
    extendProPrice: 2999,
    extendCustomMonthlyPrice: 349,
};

interface Props {
    shops: ShopProfile[];
}

const PlanPricing: React.FC<Props> = ({ shops }) => {
    const [prices, setPrices] = useState<PlanConfig>(DEFAULT_PRICES);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [saved, setSaved] = useState(false);

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

    const handleSave = async () => {
        setSaving(true);
        setSaved(false);
        try {
            await setDoc(doc(db, 'config', 'plans'), prices);
            setSaved(true);
            setTimeout(() => setSaved(false), 3000);
        } catch (err) {
            console.error('Failed to save plan prices', err);
            alert('Failed to save. Check console.');
        }
        setSaving(false);
    };

    // Subscription stats
    const planCounts = { basic: 0, pro: 0, enterprise: 0 };
    const activePlanCounts = { basic: 0, pro: 0, enterprise: 0 };
    shops.forEach(s => {
        const plan = (s.planId || 'basic') as keyof typeof planCounts;
        if (plan in planCounts) {
            planCounts[plan]++;
            if (s.subscriptionStatus === 'active') activePlanCounts[plan]++;
        }
    });

    if (loading) {
        return (
            <div className="admin-spinner">
                <div className="admin-spinner__circle" />
            </div>
        );
    }

    return (
        <>
            <div className="admin-header">
                <div>
                    <h1 className="admin-header__title">Subscriptions & Pricing</h1>
                    <p className="admin-header__subtitle">Manage plan prices and view subscription distribution</p>
                </div>
            </div>

            <div style={{ padding: '0 48px 32px' }}>
                {/* Subscription Stats */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px', marginBottom: '24px' }}>
                    {[
                        { plan: 'Basic', total: planCounts.basic, active: activePlanCounts.basic, color: 'var(--plan-basic)', bg: 'var(--plan-basic-bg)' },
                        { plan: 'Pro', total: planCounts.pro, active: activePlanCounts.pro, color: 'var(--plan-pro)', bg: 'var(--plan-pro-bg)' },
                        { plan: 'Enterprise', total: planCounts.enterprise, active: activePlanCounts.enterprise, color: 'var(--plan-enterprise)', bg: 'var(--plan-enterprise-bg)' },
                    ].map(item => (
                        <div key={item.plan} style={{
                            background: 'white', borderRadius: '14px', padding: '20px',
                            border: '1px solid var(--admin-border)', transition: 'all 0.15s ease',
                        }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
                                <div style={{
                                    width: '10px', height: '10px', borderRadius: '4px', background: item.color,
                                }} />
                                <span style={{ fontSize: '14px', fontWeight: 700, color: 'var(--admin-text)' }}>
                                    {item.plan}
                                </span>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
                                <span style={{ fontSize: '28px', fontWeight: 900, color: 'var(--admin-text)', letterSpacing: '-0.02em' }}>
                                    {item.total}
                                </span>
                                <span style={{ fontSize: '13px', fontWeight: 500, color: 'var(--admin-text-muted)' }}>
                                    total
                                </span>
                            </div>
                            <span style={{
                                fontSize: '12px', fontWeight: 700, color: 'var(--status-active-text)',
                                background: 'var(--status-active-bg)', padding: '2px 8px', borderRadius: '20px',
                                display: 'inline-block', marginTop: '8px',
                            }}>
                                {item.active} active
                            </span>
                        </div>
                    ))}
                </div>

                {/* Plan Pricing Editor */}
                <div style={{
                    background: 'white',
                    borderRadius: '16px',
                    border: '1px solid var(--admin-border)',
                    overflow: 'hidden',
                }}>
                    {/* Basic Plan */}
                    <div style={{ padding: '24px', borderBottom: '1px solid var(--admin-border-light)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            <div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '4px' }}>
                                    <span className="plan-badge plan-badge--basic">Basic</span>
                                    <span style={{ fontSize: '13px', color: 'var(--admin-text-muted)', fontWeight: 500 }}>1 Month</span>
                                </div>
                                <p style={{ fontSize: '13px', color: 'var(--admin-text-secondary)' }}>
                                    Entry-level plan for small shops. Valid for 1 month.
                                </p>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <span style={{ fontSize: '20px', fontWeight: 800, color: 'var(--admin-text-muted)' }}>₹</span>
                                <input
                                    type="number"
                                    value={prices.basicPrice}
                                    onChange={(e) => setPrices(p => ({ ...p, basicPrice: Number(e.target.value) }))}
                                    style={{
                                        width: '120px',
                                        padding: '10px 16px',
                                        border: '1px solid var(--admin-border)',
                                        borderRadius: '8px',
                                        fontSize: '18px',
                                        fontWeight: 700,
                                        fontFamily: 'inherit',
                                        color: 'var(--admin-text)',
                                        outline: 'none',
                                        textAlign: 'right',
                                    }}
                                />
                            </div>
                        </div>
                    </div>

                    {/* Pro Plan */}
                    <div style={{ padding: '24px', borderBottom: '1px solid var(--admin-border-light)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            <div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '4px' }}>
                                    <span className="plan-badge plan-badge--pro">Pro</span>
                                    <span style={{ fontSize: '13px', color: 'var(--admin-text-muted)', fontWeight: 500 }}>12 Months</span>
                                </div>
                                <p style={{ fontSize: '13px', color: 'var(--admin-text-secondary)' }}>
                                    Best value for growing shops. Valid for 1 year.
                                </p>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <span style={{ fontSize: '20px', fontWeight: 800, color: 'var(--admin-text-muted)' }}>₹</span>
                                <input
                                    type="number"
                                    value={prices.proPrice}
                                    onChange={(e) => setPrices(p => ({ ...p, proPrice: Number(e.target.value) }))}
                                    style={{
                                        width: '120px',
                                        padding: '10px 16px',
                                        border: '1px solid var(--admin-border)',
                                        borderRadius: '8px',
                                        fontSize: '18px',
                                        fontWeight: 700,
                                        fontFamily: 'inherit',
                                        color: 'var(--admin-text)',
                                        outline: 'none',
                                        textAlign: 'right',
                                    }}
                                />
                            </div>
                        </div>
                    </div>

                    {/* Enterprise Plan */}
                    <div style={{ padding: '24px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            <div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '4px' }}>
                                    <span className="plan-badge plan-badge--enterprise">Enterprise</span>
                                    <span style={{ fontSize: '13px', color: 'var(--admin-text-muted)', fontWeight: 500 }}>Custom Duration</span>
                                </div>
                                <p style={{ fontSize: '13px', color: 'var(--admin-text-secondary)' }}>
                                    Per-month pricing. Shop owner chooses how many months.
                                </p>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <span style={{ fontSize: '20px', fontWeight: 800, color: 'var(--admin-text-muted)' }}>₹</span>
                                <input
                                    type="number"
                                    value={prices.enterpriseMonthlyPrice}
                                    onChange={(e) => setPrices(p => ({ ...p, enterpriseMonthlyPrice: Number(e.target.value) }))}
                                    style={{
                                        width: '120px',
                                        padding: '10px 16px',
                                        border: '1px solid var(--admin-border)',
                                        borderRadius: '8px',
                                        fontSize: '18px',
                                        fontWeight: 700,
                                        fontFamily: 'inherit',
                                        color: 'var(--admin-text)',
                                        outline: 'none',
                                        textAlign: 'right',
                                    }}
                                />
                                <span style={{ fontSize: '14px', fontWeight: 600, color: 'var(--admin-text-muted)' }}>/mo</span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Extension Pricing Editor */}
                <div style={{
                    background: 'white',
                    borderRadius: '16px',
                    border: '1px solid var(--admin-border)',
                    overflow: 'hidden',
                    marginTop: '24px',
                }}>
                    <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--admin-border-light)', background: 'var(--admin-bg)' }}>
                        <h3 style={{ fontSize: '16px', fontWeight: 800, color: 'var(--admin-text)', margin: 0 }}>Extension Pricing</h3>
                        <p style={{ fontSize: '13px', color: 'var(--admin-text-muted)', margin: '4px 0 0' }}>Prices shown when existing subscribers extend their plan</p>
                    </div>

                    {/* Basic Extension */}
                    <div style={{ padding: '24px', borderBottom: '1px solid var(--admin-border-light)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            <div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '4px' }}>
                                    <span className="plan-badge plan-badge--basic">Basic Ext.</span>
                                    <span style={{ fontSize: '13px', color: 'var(--admin-text-muted)', fontWeight: 500 }}>+1 Month</span>
                                </div>
                                <p style={{ fontSize: '13px', color: 'var(--admin-text-secondary)' }}>
                                    Extends current subscription by 1 month.
                                </p>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <span style={{ fontSize: '20px', fontWeight: 800, color: 'var(--admin-text-muted)' }}>₹</span>
                                <input
                                    type="number"
                                    value={prices.extendBasicPrice || 399}
                                    onChange={(e) => setPrices(p => ({ ...p, extendBasicPrice: Number(e.target.value) }))}
                                    style={{
                                        width: '120px', padding: '10px 16px',
                                        border: '1px solid var(--admin-border)', borderRadius: '8px',
                                        fontSize: '18px', fontWeight: 700, fontFamily: 'inherit',
                                        color: 'var(--admin-text)', outline: 'none', textAlign: 'right',
                                    }}
                                />
                            </div>
                        </div>
                    </div>

                    {/* Pro Extension */}
                    <div style={{ padding: '24px', borderBottom: '1px solid var(--admin-border-light)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            <div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '4px' }}>
                                    <span className="plan-badge plan-badge--pro">Pro Ext.</span>
                                    <span style={{ fontSize: '13px', color: 'var(--admin-text-muted)', fontWeight: 500 }}>+12 Months</span>
                                </div>
                                <p style={{ fontSize: '13px', color: 'var(--admin-text-secondary)' }}>
                                    Extends current subscription by 12 months.
                                </p>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <span style={{ fontSize: '20px', fontWeight: 800, color: 'var(--admin-text-muted)' }}>₹</span>
                                <input
                                    type="number"
                                    value={prices.extendProPrice || 2999}
                                    onChange={(e) => setPrices(p => ({ ...p, extendProPrice: Number(e.target.value) }))}
                                    style={{
                                        width: '120px', padding: '10px 16px',
                                        border: '1px solid var(--admin-border)', borderRadius: '8px',
                                        fontSize: '18px', fontWeight: 700, fontFamily: 'inherit',
                                        color: 'var(--admin-text)', outline: 'none', textAlign: 'right',
                                    }}
                                />
                            </div>
                        </div>
                    </div>

                    {/* Custom Extension */}
                    <div style={{ padding: '24px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            <div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '4px' }}>
                                    <span className="plan-badge plan-badge--enterprise">Custom Ext.</span>
                                    <span style={{ fontSize: '13px', color: 'var(--admin-text-muted)', fontWeight: 500 }}>Per Month</span>
                                </div>
                                <p style={{ fontSize: '13px', color: 'var(--admin-text-secondary)' }}>
                                    Per-month extension pricing. User chooses months.
                                </p>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <span style={{ fontSize: '20px', fontWeight: 800, color: 'var(--admin-text-muted)' }}>₹</span>
                                <input
                                    type="number"
                                    value={prices.extendCustomMonthlyPrice || 349}
                                    onChange={(e) => setPrices(p => ({ ...p, extendCustomMonthlyPrice: Number(e.target.value) }))}
                                    style={{
                                        width: '120px', padding: '10px 16px',
                                        border: '1px solid var(--admin-border)', borderRadius: '8px',
                                        fontSize: '18px', fontWeight: 700, fontFamily: 'inherit',
                                        color: 'var(--admin-text)', outline: 'none', textAlign: 'right',
                                    }}
                                />
                                <span style={{ fontSize: '14px', fontWeight: 600, color: 'var(--admin-text-muted)' }}>/mo</span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Save Button */}
                <div style={{ marginTop: '24px', display: 'flex', alignItems: 'center', gap: '16px' }}>
                    <button
                        className="admin-header__add-btn"
                        onClick={handleSave}
                        disabled={saving}
                        style={{ opacity: saving ? 0.6 : 1 }}
                    >
                        {saving ? 'Saving...' : 'Save Prices'}
                    </button>
                    {saved && (
                        <span style={{ fontSize: '14px', fontWeight: 600, color: 'var(--status-active-text)' }}>
                            ✅ Prices saved successfully
                        </span>
                    )}
                </div>
            </div>
        </>
    );
};

export default PlanPricing;
