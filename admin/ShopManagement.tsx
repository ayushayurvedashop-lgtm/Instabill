import React, { useState, useEffect, useMemo } from 'react';
import { db, auth } from '../firebaseConfig';
import { collection, getDocs, doc, updateDoc, setDoc, deleteDoc } from 'firebase/firestore';
import { createUserWithEmailAndPassword, deleteUser as deleteAuthUser } from 'firebase/auth';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { ShopProfile } from '../types';

const SHOP_COLORS = [
    { bg: '#e6f4ef', text: '#1a6b54' },
    { bg: '#fff3e0', text: '#e65100' },
    { bg: '#e3f2fd', text: '#1565c0' },
    { bg: '#fce4ec', text: '#c62828' },
    { bg: '#f3e5f5', text: '#7b1fa2' },
    { bg: '#e8f5e9', text: '#2e7d32' },
    { bg: '#fff8e1', text: '#f57f17' },
    { bg: '#e0f7fa', text: '#00838f' },
];

const getShopColor = (id: string) => {
    const hash = id.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0);
    return SHOP_COLORS[hash % SHOP_COLORS.length];
};

const getInitials = (name: string) => {
    return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
};

const ITEMS_PER_PAGE = 10;

interface Props {
    shops: ShopProfile[];
    setShops: React.Dispatch<React.SetStateAction<ShopProfile[]>>;
    loading: boolean;
}

const ShopManagement: React.FC<Props> = ({ shops, setShops, loading }) => {
    const [searchQuery, setSearchQuery] = useState('');
    const [planFilter, setPlanFilter] = useState<string>('all');
    const [statusFilter, setStatusFilter] = useState<string>('all');
    const [currentPage, setCurrentPage] = useState(1);

    // Add Shop Modal
    const [showAddModal, setShowAddModal] = useState(false);
    const [addForm, setAddForm] = useState({
        shopName: '', address: '', phone: '', password: '', plan: 'basic'
    });
    const [addLoading, setAddLoading] = useState(false);
    const [addError, setAddError] = useState('');

    // Shop Detail Panel
    const [selectedShop, setSelectedShop] = useState<ShopProfile | null>(null);
    const [editForm, setEditForm] = useState({ shopName: '', address: '', phone: '', planId: '', subscriptionStatus: '', subscriptionStart: '', subscriptionEnd: '', planDurationMonths: 1 });
    const [editLoading, setEditLoading] = useState(false);
    const [editSuccess, setEditSuccess] = useState('');

    // Delete confirmation
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [deleteLoading, setDeleteLoading] = useState(false);

    // Password reset
    const [newPassword, setNewPassword] = useState('');
    const [passwordLoading, setPasswordLoading] = useState(false);
    const [passwordMsg, setPasswordMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

    // Filtered & paginated shops
    const filteredShops = useMemo(() => {
        return shops.filter(shop => {
            const q = searchQuery.toLowerCase();
            const matchesSearch = !q ||
                shop.shopName.toLowerCase().includes(q) ||
                shop.phone.includes(q) ||
                shop.id.toLowerCase().includes(q);

            const matchesPlan = planFilter === 'all' || shop.planId === planFilter;
            const matchesStatus = statusFilter === 'all' || shop.subscriptionStatus === statusFilter;

            return matchesSearch && matchesPlan && matchesStatus;
        });
    }, [shops, searchQuery, planFilter, statusFilter]);

    const totalPages = Math.max(1, Math.ceil(filteredShops.length / ITEMS_PER_PAGE));
    const paginatedShops = filteredShops.slice(
        (currentPage - 1) * ITEMS_PER_PAGE,
        currentPage * ITEMS_PER_PAGE
    );

    useEffect(() => {
        setCurrentPage(1);
    }, [searchQuery, planFilter, statusFilter]);

    // Open detail panel
    const openShopDetail = (shop: ShopProfile) => {
        setSelectedShop(shop);
        setEditForm({
            shopName: shop.shopName,
            address: shop.address || '',
            phone: shop.phone,
            planId: shop.planId || 'basic',
            subscriptionStatus: shop.subscriptionStatus,
            subscriptionStart: shop.subscriptionStart ? shop.subscriptionStart.split('T')[0] : '',
            subscriptionEnd: shop.subscriptionEnd ? shop.subscriptionEnd.split('T')[0] : '',
            planDurationMonths: shop.planDurationMonths || 1,
        });
        setEditSuccess('');
    };

    // Save edited shop info
    const handleSaveShop = async () => {
        if (!selectedShop) return;
        setEditLoading(true);
        setEditSuccess('');
        try {
            const updates: Partial<ShopProfile> = {
                shopName: editForm.shopName,
                address: editForm.address,
                phone: editForm.phone,
                planId: editForm.planId,
                subscriptionStatus: editForm.subscriptionStatus as any,
                subscriptionStart: editForm.subscriptionStart ? new Date(editForm.subscriptionStart).toISOString() : undefined,
                subscriptionEnd: editForm.subscriptionEnd ? new Date(editForm.subscriptionEnd).toISOString() : undefined,
                planDurationMonths: editForm.planDurationMonths,
            };
            await updateDoc(doc(db, 'shops', selectedShop.id), updates);
            const updatedShop = { ...selectedShop, ...updates };
            setShops(prev => prev.map(s => s.id === selectedShop.id ? updatedShop : s));
            setSelectedShop(updatedShop as ShopProfile);
            setEditSuccess('Changes saved successfully!');
            setTimeout(() => setEditSuccess(''), 3000);
        } catch (err) {
            console.error('Failed to update shop', err);
        }
        setEditLoading(false);
    };

    // Quick extend subscription
    const handleExtendSubscription = async (months: number) => {
        if (!selectedShop) return;
        setEditLoading(true);
        try {
            const currentEnd = selectedShop.subscriptionEnd ? new Date(selectedShop.subscriptionEnd) : new Date();
            // If expired, extend from now
            const baseDate = currentEnd > new Date() ? currentEnd : new Date();
            const newEnd = new Date(baseDate);
            newEnd.setMonth(newEnd.getMonth() + months);

            const updates: Partial<ShopProfile> = {
                subscriptionEnd: newEnd.toISOString(),
                currentPeriodEnd: newEnd.toISOString(),
                subscriptionStatus: 'active',
            };

            // If no start date, set it to now
            if (!selectedShop.subscriptionStart) {
                updates.subscriptionStart = new Date().toISOString();
            }

            await updateDoc(doc(db, 'shops', selectedShop.id), updates);
            const updatedShop = { ...selectedShop, ...updates };
            setShops(prev => prev.map(s => s.id === selectedShop.id ? updatedShop : s));
            setSelectedShop(updatedShop as ShopProfile);
            // Update edit form dates
            setEditForm(f => ({
                ...f,
                subscriptionEnd: newEnd.toISOString().split('T')[0],
                subscriptionStatus: 'active',
                subscriptionStart: updates.subscriptionStart ? updates.subscriptionStart.split('T')[0] : f.subscriptionStart,
            }));
            setEditSuccess(`Extended by ${months} month${months > 1 ? 's' : ''}!`);
            setTimeout(() => setEditSuccess(''), 3000);
        } catch (err) {
            console.error('Failed to extend subscription', err);
        }
        setEditLoading(false);
    };

    // Approve Free Trial
    const handleApproveTrial = async () => {
        if (!selectedShop) return;
        setEditLoading(true);
        try {
            const now = new Date();
            const newEnd = new Date(now);
            newEnd.setDate(newEnd.getDate() + 7); // Give 7 days trial

            const updates: Partial<ShopProfile> = {
                subscriptionEnd: newEnd.toISOString(),
                subscriptionStart: now.toISOString(),
                currentPeriodEnd: newEnd.toISOString(),
                subscriptionStatus: 'trial',
                trialStatus: 'approved',
                trialApprovedNotified: false,
                planId: 'basic',
            };

            await updateDoc(doc(db, 'shops', selectedShop.id), updates);
            const updatedShop = { ...selectedShop, ...updates };
            setShops(prev => prev.map(s => s.id === selectedShop.id ? updatedShop : s));
            setSelectedShop(updatedShop as ShopProfile);
            setEditForm(f => ({
                ...f,
                subscriptionEnd: newEnd.toISOString().split('T')[0],
                subscriptionStatus: 'trial',
                subscriptionStart: updates.subscriptionStart ? updates.subscriptionStart.split('T')[0] : f.subscriptionStart,
            }));
            setEditSuccess('Free Trial Approved for 7 Days!');
            setTimeout(() => setEditSuccess(''), 3000);
        } catch (err) {
            console.error('Failed to approve trial', err);
        }
        setEditLoading(false);
    };

    // Delete shop
    const handleDeleteShop = async () => {
        if (!selectedShop) return;
        setDeleteLoading(true);
        try {
            // Delete Firestore docs
            await deleteDoc(doc(db, 'shops', selectedShop.id));
            await deleteDoc(doc(db, 'user_shops', selectedShop.ownerUid));

            setShops(prev => prev.filter(s => s.id !== selectedShop.id));
            setSelectedShop(null);
            setShowDeleteConfirm(false);
        } catch (err) {
            console.error('Failed to delete shop', err);
        }
        setDeleteLoading(false);
    };

    // Add new shop
    const handleAddShop = async (e: React.FormEvent) => {
        e.preventDefault();
        setAddLoading(true);
        setAddError('');

        try {
            const email = `${addForm.phone}@veda.shop`;
            const cred = await createUserWithEmailAndPassword(auth, email, addForm.password);
            const shopId = cred.user.uid;

            const shopProfile: ShopProfile = {
                id: shopId,
                shopName: addForm.shopName,
                address: addForm.address,
                phone: addForm.phone,
                ownerUid: cred.user.uid,
                createdAt: new Date().toISOString(),
                subscriptionStatus: 'active',
                planId: addForm.plan,
            };

            await setDoc(doc(db, 'shops', shopId), shopProfile);
            await setDoc(doc(db, 'user_shops', cred.user.uid), {
                shopId,
                phone: addForm.phone,
                role: 'shop_admin',
            });

            setShops(prev => [...prev, shopProfile]);
            setShowAddModal(false);
            setAddForm({ shopName: '', address: '', phone: '', password: '', plan: 'basic' });
        } catch (err: any) {
            setAddError(err.code === 'auth/email-already-in-use'
                ? 'Phone number already registered.'
                : err.message || 'Failed to create shop.'
            );
        }
        setAddLoading(false);
    };

    const handleExportCSV = () => {
        const headers = ['Shop Name', 'Shop ID', 'Phone', 'Plan', 'Status', 'Created At'];
        const rows = filteredShops.map(s => [
            s.shopName, s.id, s.phone, s.planId || 'basic', s.subscriptionStatus, s.createdAt
        ]);
        const csv = [headers, ...rows].map(r => r.join(',')).join('\n');
        const blob = new Blob([csv], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `shops_${new Date().toISOString().split('T')[0]}.csv`;
        a.click();
        URL.revokeObjectURL(url);
    };

    const getPageNumbers = () => {
        const pages: (number | '...')[] = [];
        if (totalPages <= 7) {
            for (let i = 1; i <= totalPages; i++) pages.push(i);
        } else {
            pages.push(1);
            if (currentPage > 3) pages.push('...');
            for (let i = Math.max(2, currentPage - 1); i <= Math.min(totalPages - 1, currentPage + 1); i++) {
                pages.push(i);
            }
            if (currentPage < totalPages - 2) pages.push('...');
            pages.push(totalPages);
        }
        return pages;
    };

    return (
        <div className="admin-shop-mgmt">
            {/* Header */}
            <div className="admin-header">
                <div>
                    <h1 className="admin-header__title">Shop Owner Management</h1>
                    <p className="admin-header__subtitle">Manage subscriptions, billing cycles, and shop details</p>
                </div>
                <button className="admin-header__add-btn" onClick={() => setShowAddModal(true)}>
                    <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" viewBox="0 0 24 24">
                        <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
                    </svg>
                    Add New Shop
                </button>
            </div>

            {/* Filters */}
            <div className="admin-filters">
                <div className="admin-filters__search">
                    <div className="admin-filters__search-icon">
                        <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" viewBox="0 0 24 24">
                            <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
                        </svg>
                    </div>
                    <input
                        className="admin-filters__search-input"
                        placeholder="Search by name, phone, or ID..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                    />
                </div>

                <select className="admin-filters__select" value={planFilter} onChange={(e) => setPlanFilter(e.target.value)}>
                    <option value="all">Plan: All</option>
                    <option value="basic">Basic</option>
                    <option value="pro">Pro</option>
                    <option value="enterprise">Enterprise</option>
                </select>

                <select className="admin-filters__select" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
                    <option value="all">Status: All</option>
                    <option value="active">Active</option>
                    <option value="trial">Trial</option>
                    <option value="expired">Expired</option>
                    <option value="suspended">Suspended</option>
                </select>

                <button className="admin-filters__export-btn" onClick={handleExportCSV}>
                    <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" viewBox="0 0 24 24">
                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" />
                    </svg>
                    Export
                </button>
            </div>

            {/* Content Area */}
            <div className="admin-shop-mgmt__content">
                {/* Table */}
                <div className={`admin-table-wrapper ${selectedShop ? 'admin-table-wrapper--with-panel' : ''}`}>
                    <div className="admin-table">
                        {loading ? (
                            <div className="admin-spinner">
                                <div className="admin-spinner__circle" />
                            </div>
                        ) : paginatedShops.length === 0 ? (
                            <div className="admin-empty">
                                <div className="admin-empty__icon">
                                    <svg width="48" height="48" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
                                        <rect x="2" y="7" width="20" height="14" rx="2" ry="2" />
                                        <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
                                    </svg>
                                </div>
                                <p className="admin-empty__title">No shops found</p>
                                <p className="admin-empty__desc">Try adjusting your search or filters</p>
                            </div>
                        ) : (
                            <>
                                <table>
                                    <thead>
                                        <tr>
                                            <th>Shop Details</th>
                                            <th>Phone</th>
                                            <th>Plan</th>
                                            <th>Status</th>
                                            <th>Created</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {paginatedShops.map((shop) => {
                                            const color = getShopColor(shop.id);
                                            const plan = shop.planId || 'basic';
                                            const planLabel = plan.charAt(0).toUpperCase() + plan.slice(1);
                                            const statusLabel = shop.subscriptionStatus.charAt(0).toUpperCase() + shop.subscriptionStatus.slice(1);

                                            return (
                                                <tr
                                                    key={shop.id}
                                                    className={`admin-shop-row ${selectedShop?.id === shop.id ? 'admin-shop-row--selected' : ''}`}
                                                    onClick={() => openShopDetail(shop)}
                                                >
                                                    <td>
                                                        <div className="shop-cell">
                                                            <div
                                                                className="shop-cell__icon"
                                                                style={{ background: color.bg, color: color.text }}
                                                            >
                                                                {getInitials(shop.shopName)}
                                                            </div>
                                                            <div className="shop-cell__info">
                                                                <span className="shop-cell__name">{shop.shopName}</span>
                                                                <span className="shop-cell__id">#{shop.id.slice(0, 8).toUpperCase()}</span>
                                                            </div>
                                                        </div>
                                                    </td>
                                                    <td style={{ fontSize: '13px', color: '#475569' }}>{shop.phone}</td>
                                                    <td>
                                                        <span className={`plan-badge plan-badge--${plan}`}>{planLabel}</span>
                                                    </td>
                                                    <td>
                                                        <span className={`status-badge status-badge--${shop.subscriptionStatus}`}>
                                                            <span className="status-badge__dot" />
                                                            {statusLabel}
                                                        </span>
                                                        {shop.trialStatus === 'pending' && (
                                                            <span style={{ display: 'inline-block', marginLeft: '6px', fontSize: '10px', background: '#FEF08A', color: '#854D0E', padding: '2px 6px', borderRadius: '10px', fontWeight: 700 }}>
                                                                Trial Req
                                                            </span>
                                                        )}
                                                    </td>
                                                    <td style={{ fontSize: '13px', color: '#64748b' }}>
                                                        {new Date(shop.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>

                                {/* Pagination */}
                                <div className="admin-pagination">
                                    <span className="admin-pagination__info">
                                        Showing {(currentPage - 1) * ITEMS_PER_PAGE + 1} to{' '}
                                        {Math.min(currentPage * ITEMS_PER_PAGE, filteredShops.length)} of{' '}
                                        {filteredShops.length}
                                    </span>
                                    <div className="admin-pagination__controls">
                                        <button className="admin-pagination__btn" disabled={currentPage === 1} onClick={() => setCurrentPage(p => p - 1)}>
                                            <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" viewBox="0 0 24 24">
                                                <polyline points="15 18 9 12 15 6" />
                                            </svg>
                                        </button>
                                        {getPageNumbers().map((page, i) =>
                                            page === '...' ? (
                                                <span key={`e${i}`} className="admin-pagination__ellipsis">…</span>
                                            ) : (
                                                <button
                                                    key={page}
                                                    className={`admin-pagination__btn ${page === currentPage ? 'admin-pagination__btn--active' : ''}`}
                                                    onClick={() => setCurrentPage(page as number)}
                                                >
                                                    {page}
                                                </button>
                                            )
                                        )}
                                        <button className="admin-pagination__btn" disabled={currentPage === totalPages} onClick={() => setCurrentPage(p => p + 1)}>
                                            <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" viewBox="0 0 24 24">
                                                <polyline points="9 18 15 12 9 6" />
                                            </svg>
                                        </button>
                                    </div>
                                </div>
                            </>
                        )}
                    </div>
                </div>

                {/* Shop Detail Panel */}
                {selectedShop && (
                    <div className="admin-detail-panel">
                        <div className="admin-detail-panel__header">
                            <h2>Shop Details</h2>
                            <button className="admin-detail-panel__close" onClick={() => setSelectedShop(null)}>
                                <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" viewBox="0 0 24 24">
                                    <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                                </svg>
                            </button>
                        </div>

                        <div className="admin-detail-panel__body">
                            {/* Shop avatar + name */}
                            <div className="admin-detail-panel__profile">
                                <div className="admin-detail-panel__avatar" style={{ background: getShopColor(selectedShop.id).bg, color: getShopColor(selectedShop.id).text }}>
                                    {getInitials(selectedShop.shopName)}
                                </div>
                                <div>
                                    <p className="admin-detail-panel__shop-name">{selectedShop.shopName}</p>
                                    <p className="admin-detail-panel__shop-id">ID: #{selectedShop.id.slice(0, 12).toUpperCase()}</p>
                                </div>
                            </div>

                            {/* Pending Trial Banner */}
                            {selectedShop.trialStatus === 'pending' && (
                                <div style={{
                                    padding: '16px', borderRadius: '12px', background: '#FEFCE8',
                                    border: '1px solid #FEF08A', marginBottom: '24px', display: 'flex',
                                    flexDirection: 'column', gap: '12px'
                                }}>
                                    <div>
                                        <h4 style={{ fontSize: '14px', fontWeight: 700, color: '#854D0E', margin: '0 0 4px' }}>Free Trial Request</h4>
                                        <p style={{ fontSize: '13px', color: '#A16207', margin: 0, lineHeight: 1.4 }}>
                                            This shop has requested a free trial. Please verify the shop details and approve to grant 7-days of full access.
                                        </p>
                                    </div>
                                    <button 
                                        onClick={handleApproveTrial} 
                                        disabled={editLoading}
                                        style={{
                                            background: '#EAB308', color: 'white', border: 'none', padding: '10px',
                                            borderRadius: '8px', fontSize: '13px', fontWeight: 700, cursor: 'pointer',
                                            opacity: editLoading ? 0.7 : 1
                                        }}
                                    >
                                        Approve Free Trial
                                    </button>
                                </div>
                            )}

                            {/* Subscription Overview Card */}
                            {(() => {
                                const subEnd = selectedShop.subscriptionEnd ? new Date(selectedShop.subscriptionEnd) : null;
                                const subStart = selectedShop.subscriptionStart ? new Date(selectedShop.subscriptionStart) : null;
                                const nowMs = Date.now();
                                const daysLeft = subEnd ? Math.ceil((subEnd.getTime() - nowMs) / (1000 * 60 * 60 * 24)) : 0;
                                const totalDays = subStart && subEnd ? Math.ceil((subEnd.getTime() - subStart.getTime()) / (1000 * 60 * 60 * 24)) : 0;
                                const pct = totalDays > 0 ? Math.max(0, Math.min(100, Math.round((Math.max(0, daysLeft) / totalDays) * 100))) : 0;
                                const plan = (selectedShop.planId || 'basic');
                                const planLabel = plan.charAt(0).toUpperCase() + plan.slice(1);
                                const isActive = (selectedShop.subscriptionStatus === 'active' || selectedShop.subscriptionStatus === 'trial') && daysLeft > 0;

                                return (
                                    <div style={{
                                        padding: '16px', borderRadius: '12px',
                                        background: isActive ? 'var(--status-active-bg)' : 'var(--status-expired-bg)',
                                        border: `1px solid ${isActive ? '#bbf7d0' : '#fecaca'}`,
                                    }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                                            <div>
                                                <span style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: isActive ? 'var(--status-active-text)' : 'var(--status-expired-text)' }}>
                                                    {planLabel} Plan
                                                </span>
                                            </div>
                                            <span style={{
                                                padding: '3px 10px', borderRadius: '20px', fontSize: '11px', fontWeight: 700,
                                                background: isActive ? '#dcfce7' : '#fee2e2',
                                                color: isActive ? '#166534' : '#991b1b',
                                            }}>
                                                {isActive ? 'Active' : daysLeft <= 0 ? 'Expired' : selectedShop.subscriptionStatus}
                                            </span>
                                        </div>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', fontWeight: 600, color: 'var(--admin-text-secondary)', marginBottom: '6px' }}>
                                            <span>{daysLeft > 0 ? `${daysLeft} days left` : 'Expired'}</span>
                                            <span>{pct}%</span>
                                        </div>
                                        <div style={{ height: '6px', background: '#e5e7eb', borderRadius: '100px', overflow: 'hidden' }}>
                                            <div style={{
                                                height: '100%', borderRadius: '100px',
                                                width: `${pct}%`,
                                                background: isActive ? 'var(--admin-primary)' : 'var(--status-expired)',
                                                transition: 'width 0.5s ease',
                                            }} />
                                        </div>
                                    </div>
                                );
                            })()}

                            {/* Quick Extend */}
                            <div className="admin-detail-panel__section">
                                <h3 className="admin-detail-panel__section-title">Quick Extend</h3>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '8px' }}>
                                    {[1, 3, 6, 12].map(m => (
                                        <button
                                            key={m}
                                            onClick={() => handleExtendSubscription(m)}
                                            disabled={editLoading}
                                            style={{
                                                padding: '10px 6px', border: '1px solid var(--admin-border)',
                                                borderRadius: '10px', background: 'var(--admin-surface)',
                                                cursor: editLoading ? 'not-allowed' : 'pointer',
                                                fontSize: '13px', fontWeight: 700, color: 'var(--admin-primary)',
                                                fontFamily: 'inherit', transition: 'all 0.15s ease',
                                                textAlign: 'center', lineHeight: 1.3,
                                            }}
                                            onMouseOver={e => { if (!editLoading) { e.currentTarget.style.background = 'var(--admin-primary-light)'; e.currentTarget.style.borderColor = 'var(--admin-primary)'; } }}
                                            onMouseOut={e => { e.currentTarget.style.background = 'var(--admin-surface)'; e.currentTarget.style.borderColor = 'var(--admin-border)'; }}
                                        >
                                            +{m}<br />
                                            <span style={{ fontSize: '10px', fontWeight: 500, color: 'var(--admin-text-muted)' }}>mo{m > 1 ? 's' : ''}</span>
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Editable fields */}
                            <div className="admin-detail-panel__section">
                                <h3 className="admin-detail-panel__section-title">General Information</h3>

                                <div className="admin-detail-panel__field">
                                    <label>Shop Name</label>
                                    <input
                                        value={editForm.shopName}
                                        onChange={e => setEditForm(f => ({ ...f, shopName: e.target.value }))}
                                    />
                                </div>
                                <div className="admin-detail-panel__field">
                                    <label>Address</label>
                                    <input
                                        value={editForm.address}
                                        onChange={e => setEditForm(f => ({ ...f, address: e.target.value }))}
                                    />
                                </div>
                                <div className="admin-detail-panel__field">
                                    <label>Phone</label>
                                    <input
                                        value={editForm.phone}
                                        onChange={e => setEditForm(f => ({ ...f, phone: e.target.value.replace(/\D/g, '') }))}
                                    />
                                </div>
                            </div>

                            <div className="admin-detail-panel__section">
                                <h3 className="admin-detail-panel__section-title">Subscription</h3>

                                <div className="admin-detail-panel__field">
                                    <label>Plan</label>
                                    <select
                                        value={editForm.planId}
                                        onChange={e => setEditForm(f => ({ ...f, planId: e.target.value }))}
                                    >
                                        <option value="basic">Basic</option>
                                        <option value="pro">Pro</option>
                                        <option value="enterprise">Enterprise</option>
                                    </select>
                                </div>

                                <div className="admin-detail-panel__field">
                                    <label>Status</label>
                                    <select
                                        value={editForm.subscriptionStatus}
                                        onChange={e => setEditForm(f => ({ ...f, subscriptionStatus: e.target.value }))}
                                    >
                                        <option value="active">Active</option>
                                        <option value="trial">Trial</option>
                                        <option value="expired">Expired</option>
                                        <option value="suspended">Suspended</option>
                                    </select>
                                </div>

                                <div className="admin-detail-panel__field">
                                    <label>Duration (months)</label>
                                    <input
                                        type="number"
                                        min={1}
                                        max={36}
                                        value={editForm.planDurationMonths}
                                        onChange={e => setEditForm(f => ({ ...f, planDurationMonths: parseInt(e.target.value) || 1 }))}
                                    />
                                </div>

                                <div className="admin-detail-panel__field">
                                    <label>Start Date</label>
                                    <input
                                        type="date"
                                        value={editForm.subscriptionStart}
                                        onChange={e => setEditForm(f => ({ ...f, subscriptionStart: e.target.value }))}
                                    />
                                </div>

                                <div className="admin-detail-panel__field">
                                    <label>End Date</label>
                                    <input
                                        type="date"
                                        value={editForm.subscriptionEnd}
                                        onChange={e => setEditForm(f => ({ ...f, subscriptionEnd: e.target.value }))}
                                    />
                                </div>
                            </div>

                            {/* Save */}
                            <button className="admin-detail-panel__save-btn" onClick={handleSaveShop} disabled={editLoading}>
                                {editLoading ? 'Saving...' : 'Save Changes'}
                            </button>
                            {editSuccess && <p className="admin-detail-panel__success">{editSuccess}</p>}

                            {/* Password Reset */}
                            <div className="admin-detail-panel__section">
                                <h3 className="admin-detail-panel__section-title">Reset Password</h3>
                                <div className="admin-detail-panel__field">
                                    <label>New Password</label>
                                    <input
                                        type="password"
                                        placeholder="Min 6 characters"
                                        value={newPassword}
                                        onChange={e => setNewPassword(e.target.value)}
                                        minLength={6}
                                    />
                                </div>
                                <button
                                    className="admin-detail-panel__save-btn"
                                    style={{ background: '#7c3aed' }}
                                    disabled={passwordLoading || newPassword.length < 6}
                                    onClick={async () => {
                                        if (!selectedShop || newPassword.length < 6) return;
                                        setPasswordLoading(true);
                                        setPasswordMsg(null);
                                        try {
                                            const functions = getFunctions();
                                            const resetFn = httpsCallable(functions, 'resetShopPassword');
                                            await resetFn({ uid: selectedShop.ownerUid, newPassword });
                                            setPasswordMsg({ type: 'success', text: 'Password updated successfully!' });
                                            setNewPassword('');
                                        } catch (err: any) {
                                            setPasswordMsg({ type: 'error', text: err.message || 'Failed to reset password' });
                                        }
                                        setPasswordLoading(false);
                                        setTimeout(() => setPasswordMsg(null), 4000);
                                    }}
                                >
                                    {passwordLoading ? 'Resetting...' : 'Reset Password'}
                                </button>
                                {passwordMsg && (
                                    <p style={{
                                        fontSize: '13px',
                                        fontWeight: 600,
                                        textAlign: 'center',
                                        padding: '6px',
                                        borderRadius: '6px',
                                        background: passwordMsg.type === 'success' ? '#f0fdf4' : '#fef2f2',
                                        color: passwordMsg.type === 'success' ? '#16a34a' : '#dc2626',
                                    }}>
                                        {passwordMsg.text}
                                    </p>
                                )}
                            </div>

                            {/* Danger Zone */}
                            <div className="admin-detail-panel__section admin-detail-panel__danger-zone">
                                <h3 className="admin-detail-panel__section-title" style={{ color: '#dc2626' }}>Danger Zone</h3>
                                <button
                                    className="admin-detail-panel__delete-btn"
                                    onClick={() => setShowDeleteConfirm(true)}
                                >
                                    <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" viewBox="0 0 24 24">
                                        <polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                                    </svg>
                                    Delete This Shop
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* Add Shop Modal */}
            {showAddModal && (
                <div className="admin-modal-overlay" onClick={() => setShowAddModal(false)}>
                    <div className="admin-modal" onClick={(e) => e.stopPropagation()}>
                        <div className="admin-modal__header">
                            <h2 className="admin-modal__title">Add New Shop</h2>
                            <button className="admin-modal__close" onClick={() => setShowAddModal(false)}>
                                <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" viewBox="0 0 24 24">
                                    <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                                </svg>
                            </button>
                        </div>
                        <form onSubmit={handleAddShop}>
                            <div className="admin-modal__body">
                                <div className="admin-modal__field">
                                    <label className="admin-modal__label">Shop Name</label>
                                    <input className="admin-modal__input" value={addForm.shopName} onChange={(e) => setAddForm(f => ({ ...f, shopName: e.target.value }))} placeholder="Ayurveda Shop" required />
                                </div>
                                <div className="admin-modal__field">
                                    <label className="admin-modal__label">Address</label>
                                    <input className="admin-modal__input" value={addForm.address} onChange={(e) => setAddForm(f => ({ ...f, address: e.target.value }))} placeholder="123 Main St, City" required />
                                </div>
                                <div className="admin-modal__field">
                                    <label className="admin-modal__label">Phone Number</label>
                                    <input className="admin-modal__input" value={addForm.phone} onChange={(e) => setAddForm(f => ({ ...f, phone: e.target.value.replace(/\D/g, '') }))} placeholder="9876543210" required />
                                </div>
                                <div className="admin-modal__field">
                                    <label className="admin-modal__label">Password</label>
                                    <input className="admin-modal__input" type="password" value={addForm.password} onChange={(e) => setAddForm(f => ({ ...f, password: e.target.value }))} placeholder="Minimum 6 characters" required minLength={6} />
                                </div>
                                <div className="admin-modal__field">
                                    <label className="admin-modal__label">Subscription Plan</label>
                                    <select className="admin-modal__select" value={addForm.plan} onChange={(e) => setAddForm(f => ({ ...f, plan: e.target.value }))}>
                                        <option value="basic">Basic</option>
                                        <option value="pro">Pro</option>
                                        <option value="enterprise">Enterprise</option>
                                    </select>
                                </div>
                                {addError && <div className="admin-login__error">{addError}</div>}
                            </div>
                            <div className="admin-modal__footer">
                                <button type="button" className="admin-modal__cancel" onClick={() => setShowAddModal(false)}>Cancel</button>
                                <button type="submit" className="admin-modal__submit" disabled={addLoading}>
                                    {addLoading ? 'Creating...' : 'Create Shop'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Delete Confirmation Modal */}
            {showDeleteConfirm && selectedShop && (
                <div className="admin-modal-overlay" onClick={() => setShowDeleteConfirm(false)}>
                    <div className="admin-modal admin-modal--sm" onClick={e => e.stopPropagation()}>
                        <div className="admin-modal__header">
                            <h2 className="admin-modal__title" style={{ color: '#dc2626' }}>Delete Shop</h2>
                        </div>
                        <div className="admin-modal__body">
                            <p style={{ fontSize: '14px', color: '#475569', lineHeight: 1.6 }}>
                                Are you sure you want to delete <strong>{selectedShop.shopName}</strong>? This will remove all shop data from Firestore. This action cannot be undone.
                            </p>
                        </div>
                        <div className="admin-modal__footer">
                            <button className="admin-modal__cancel" onClick={() => setShowDeleteConfirm(false)}>Cancel</button>
                            <button
                                className="admin-modal__submit"
                                style={{ background: '#dc2626' }}
                                onClick={handleDeleteShop}
                                disabled={deleteLoading}
                            >
                                {deleteLoading ? 'Deleting...' : 'Delete Permanently'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ShopManagement;
