import React, { useState, useEffect } from 'react';
import { db } from '../firebaseConfig';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { PlanConfig } from '../types';

const DEFAULT_PRICES: PlanConfig = {
    basicPrice: 499,
    proPrice: 3999,
    enterpriseMonthlyPrice: 399,
};

const PlanPricing: React.FC = () => {
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
                    <h1 className="admin-header__title">Plan Pricing</h1>
                    <p className="admin-header__subtitle">Set subscription prices for all plans</p>
                </div>
            </div>

            <div style={{ padding: '0 48px 32px' }}>
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
