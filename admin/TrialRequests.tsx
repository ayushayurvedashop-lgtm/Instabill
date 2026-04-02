import React, { useState, useMemo } from 'react';
import { db } from '../firebaseConfig';
import { doc, updateDoc } from 'firebase/firestore';
import { ShopProfile } from '../types';

interface Props {
    shops: ShopProfile[];
    setShops: React.Dispatch<React.SetStateAction<ShopProfile[]>>;
    loading: boolean;
}

const getInitials = (name: string) => name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);

const TrialRequests: React.FC<Props> = ({ shops, setShops, loading }) => {
    const [searchQuery, setSearchQuery] = useState('');
    const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);

    const pendingRequests = useMemo(() => {
        return shops.filter(s => s.trialStatus === 'pending' && (
            !searchQuery || 
            s.shopName.toLowerCase().includes(searchQuery.toLowerCase()) || 
            s.phone.includes(searchQuery)
        ));
    }, [shops, searchQuery]);

    const handleApprove = async (shop: ShopProfile) => {
        setActionLoadingId(shop.id);
        try {
            const now = new Date();
            const newEnd = new Date(now);
            newEnd.setDate(newEnd.getDate() + 7);

            const updates: Partial<ShopProfile> = {
                subscriptionEnd: newEnd.toISOString(),
                subscriptionStart: now.toISOString(),
                currentPeriodEnd: newEnd.toISOString(),
                subscriptionStatus: 'trial',
                trialStatus: 'approved',
                trialApprovedNotified: false,
                planId: 'basic',
            };

            await updateDoc(doc(db, 'shops', shop.id), updates);
            setShops(prev => prev.map(s => s.id === shop.id ? { ...s, ...updates } : s));
        } catch (err) {
            console.error('Failed to approve trial', err);
            alert('Failed to approve trial.');
        }
        setActionLoadingId(null);
    };

    const handleReject = async (shop: ShopProfile) => {
        if (!window.confirm(`Are you sure you want to reject the trial request for ${shop.shopName}?`)) return;
        
        setActionLoadingId(shop.id);
        try {
            const updates: Partial<ShopProfile> = {
                trialStatus: 'rejected',
            };
            await updateDoc(doc(db, 'shops', shop.id), updates);
            setShops(prev => prev.map(s => s.id === shop.id ? { ...s, ...updates } : s));
        } catch (err) {
            console.error('Failed to reject trial', err);
            alert('Failed to reject trial.');
        }
        setActionLoadingId(null);
    };

    if (loading) {
        return (
            <div className="admin-dashboard bg-white" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '400px' }}>
                <div style={{ width: '40px', height: '40px', border: '3px solid #E5E7EB', borderTopColor: '#21776A', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
            </div>
        );
    }

    return (
        <div className="admin-dashboard">
            <div className="admin-page-header">
                <div>
                    <h1>Free Trial Requests</h1>
                    <p>Review and verify new shop registrations requesting a free trial</p>
                </div>
            </div>

            <div className="admin-card">
                <div className="admin-card__header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '20px 24px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div style={{ position: 'relative' }}>
                            <svg style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#9CA3AF' }} width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
                                <circle cx="11" cy="11" r="8" />
                                <line x1="21" y1="21" x2="16.65" y2="16.65" />
                            </svg>
                            <input
                                type="text"
                                placeholder="Search by name or phone..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                style={{ padding: '8px 12px 8px 36px', border: '1px solid #E5E7EB', borderRadius: '8px', fontSize: '14px', width: '260px', outline: 'none', fontFamily: 'inherit' }}
                            />
                        </div>
                    </div>
                    <div style={{ fontSize: '14px', fontWeight: 600, color: '#6B7280' }}>
                        {pendingRequests.length} Pending {pendingRequests.length === 1 ? 'Request' : 'Requests'}
                    </div>
                </div>

                <div className="admin-card__body">
                    {pendingRequests.length === 0 ? (
                        <div style={{ textAlign: 'center', padding: '60px 20px' }}>
                            <div style={{ width: '64px', height: '64px', background: '#F3F4F6', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px', color: '#9CA3AF' }}>
                                <svg width="28" height="28" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
                                    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                                    <polyline points="22 4 12 14.01 9 11.01" />
                                </svg>
                            </div>
                            <h3 style={{ fontSize: '18px', fontWeight: 800, color: '#111617', margin: '0 0 8px' }}>No Pending Requests</h3>
                            <p style={{ fontSize: '14px', color: '#6B7280', margin: 0 }}>You have cleared all the free trial requests.</p>
                        </div>
                    ) : (
                        <div style={{ overflowX: 'auto' }}>
                            <table className="admin-table">
                                <thead>
                                    <tr>
                                        <th>Shop Details</th>
                                        <th>Phone Number</th>
                                        <th>Registered On</th>
                                        <th style={{ textAlign: 'right' }}>Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {pendingRequests.map(shop => (
                                        <tr key={shop.id}>
                                            <td>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                                    <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: '#FEFCE8', color: '#A16207', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '14px', fontWeight: 800 }}>
                                                        {getInitials(shop.shopName)}
                                                    </div>
                                                    <div>
                                                        <div style={{ fontWeight: 700, color: '#111617', fontSize: '14px' }}>{shop.shopName}</div>
                                                        <div style={{ fontSize: '12px', color: '#6B7280', marginTop: '2px' }}>ID: {shop.id.slice(0, 8).toUpperCase()}</div>
                                                    </div>
                                                </div>
                                            </td>
                                            <td style={{ fontWeight: 600, color: '#4B5563', fontSize: '14px' }}>{shop.phone}</td>
                                            <td style={{ color: '#6B7280', fontSize: '14px', fontWeight: 500 }}>
                                                {new Date(shop.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                                            </td>
                                            <td style={{ textAlign: 'right' }}>
                                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '8px' }}>
                                                    <button
                                                        onClick={() => handleReject(shop)}
                                                        disabled={actionLoadingId === shop.id}
                                                        style={{ padding: '8px 16px', borderRadius: '8px', border: '1px solid #E5E7EB', background: 'white', color: '#EF4444', fontSize: '13px', fontWeight: 700, cursor: 'pointer', opacity: actionLoadingId === shop.id ? 0.7 : 1, transition: 'all 0.2s' }}
                                                    >
                                                        Reject
                                                    </button>
                                                    <button
                                                        onClick={() => handleApprove(shop)}
                                                        disabled={actionLoadingId === shop.id}
                                                        style={{ padding: '8px 16px', borderRadius: '8px', border: 'none', background: '#EAB308', color: 'white', fontSize: '13px', fontWeight: 700, cursor: 'pointer', opacity: actionLoadingId === shop.id ? 0.7 : 1, display: 'flex', alignItems: 'center', gap: '6px', transition: 'all 0.2s' }}
                                                    >
                                                        {actionLoadingId === shop.id ? 'Processing...' : (
                                                            <>
                                                                <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12" /></svg>
                                                                Approve Trial
                                                            </>
                                                        )}
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default TrialRequests;
