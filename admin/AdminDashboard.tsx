import React from 'react';
import { ShopProfile } from '../types';

interface Props {
    shops: ShopProfile[];
}

const AdminDashboard: React.FC<Props> = ({ shops }) => {
    const totalShops = shops.length;
    const activeShops = shops.filter(s => s.subscriptionStatus === 'active').length;
    const trialShops = shops.filter(s => s.subscriptionStatus === 'trial').length;
    const expiredShops = shops.filter(s => s.subscriptionStatus === 'expired' || s.subscriptionStatus === 'suspended').length;

    // Expiring soon (within 7 days)
    const now = Date.now();
    const expiringSoon = shops.filter(s => {
        if (s.subscriptionStatus !== 'active' || !s.subscriptionEnd) return false;
        const daysLeft = Math.ceil((new Date(s.subscriptionEnd).getTime() - now) / (1000 * 60 * 60 * 24));
        return daysLeft > 0 && daysLeft <= 7;
    }).length;

    // Plan distribution
    const planCounts = { basic: 0, pro: 0, enterprise: 0 };
    shops.forEach(s => {
        const plan = (s.planId || 'basic') as keyof typeof planCounts;
        if (plan in planCounts) planCounts[plan]++;
    });

    const recentShops = [...shops]
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
        .slice(0, 5);

    const stats = [
        {
            label: 'Total Shops',
            value: totalShops,
            icon: (
                <svg width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
                    <rect x="2" y="7" width="20" height="14" rx="2" ry="2" />
                    <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
                </svg>
            ),
            color: '#1a6b54',
            bg: '#e6f4ef',
        },
        {
            label: 'Active Subscriptions',
            value: activeShops,
            icon: (
                <svg width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
                    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                    <polyline points="22 4 12 14.01 9 11.01" />
                </svg>
            ),
            color: '#2e7d32',
            bg: '#e8f5e9',
        },
        {
            label: 'Trial Shops',
            value: trialShops,
            icon: (
                <svg width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
                    <circle cx="12" cy="12" r="10" />
                    <polyline points="12 6 12 12 16 14" />
                </svg>
            ),
            color: '#e65100',
            bg: '#fff3e0',
        },
        {
            label: 'Expired / Suspended',
            value: expiredShops,
            icon: (
                <svg width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
                    <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                    <line x1="12" y1="9" x2="12" y2="13" />
                    <line x1="12" y1="17" x2="12.01" y2="17" />
                </svg>
            ),
            color: '#c62828',
            bg: '#fce4ec',
        },
        {
            label: 'Expiring Soon',
            value: expiringSoon,
            icon: (
                <svg width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
                    <path d="M12 9v4l3 3" />
                    <circle cx="12" cy="12" r="10" />
                </svg>
            ),
            color: '#b45309',
            bg: '#fef3c7',
        },
    ];

    const getDaysRemaining = (endDate?: string) => {
        if (!endDate) return null;
        const days = Math.ceil((new Date(endDate).getTime() - now) / (1000 * 60 * 60 * 24));
        return days;
    };

    return (
        <div className="admin-dashboard">
            <div className="admin-page-header">
                <h1>Dashboard Overview</h1>
                <p>Welcome back. Here's your platform summary.</p>
            </div>

            {/* Stats Cards */}
            <div className="admin-stats-grid">
                {stats.map((s, i) => (
                    <div key={i} className="admin-stat-card">
                        <div className="admin-stat-card__icon" style={{ background: s.bg, color: s.color }}>
                            {s.icon}
                        </div>
                        <div className="admin-stat-card__info">
                            <span className="admin-stat-card__label">{s.label}</span>
                            <span className="admin-stat-card__value">{s.value}</span>
                        </div>
                    </div>
                ))}
            </div>

            {/* Plan Distribution */}
            {totalShops > 0 && (
                <div className="admin-card" style={{ marginBottom: '24px' }}>
                    <div className="admin-card__header">
                        <h2>Plan Distribution</h2>
                        <span style={{ fontSize: '13px', color: 'var(--admin-text-muted)', fontWeight: 500 }}>
                            {totalShops} total shops
                        </span>
                    </div>
                    <div className="admin-card__body" style={{ padding: '20px 24px' }}>
                        {/* Distribution bar */}
                        <div style={{ display: 'flex', borderRadius: '8px', overflow: 'hidden', height: '12px', marginBottom: '16px', background: 'var(--admin-border-light)' }}>
                            {planCounts.basic > 0 && (
                                <div style={{ width: `${(planCounts.basic / totalShops) * 100}%`, background: 'var(--plan-basic)', transition: 'width 0.5s ease' }} />
                            )}
                            {planCounts.pro > 0 && (
                                <div style={{ width: `${(planCounts.pro / totalShops) * 100}%`, background: 'var(--plan-pro)', transition: 'width 0.5s ease' }} />
                            )}
                            {planCounts.enterprise > 0 && (
                                <div style={{ width: `${(planCounts.enterprise / totalShops) * 100}%`, background: 'var(--plan-enterprise)', transition: 'width 0.5s ease' }} />
                            )}
                        </div>
                        {/* Legend */}
                        <div style={{ display: 'flex', gap: '24px', flexWrap: 'wrap' }}>
                            {[
                                { label: 'Basic', count: planCounts.basic, color: 'var(--plan-basic)', bg: 'var(--plan-basic-bg)' },
                                { label: 'Pro', count: planCounts.pro, color: 'var(--plan-pro)', bg: 'var(--plan-pro-bg)' },
                                { label: 'Enterprise', count: planCounts.enterprise, color: 'var(--plan-enterprise)', bg: 'var(--plan-enterprise-bg)' },
                            ].map(p => (
                                <div key={p.label} style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                    <div style={{ width: '10px', height: '10px', borderRadius: '3px', background: p.color }} />
                                    <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--admin-text-secondary)' }}>
                                        {p.label}
                                    </span>
                                    <span style={{
                                        padding: '2px 10px', borderRadius: '20px', fontSize: '12px', fontWeight: 700,
                                        background: p.bg, color: p.color,
                                    }}>
                                        {p.count}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {/* Recent Registrations */}
            <div className="admin-card">
                <div className="admin-card__header">
                    <h2>Recent Shop Registrations</h2>
                </div>
                <div className="admin-card__body">
                    {recentShops.length === 0 ? (
                        <p style={{ textAlign: 'center', color: '#94a3b8', padding: '24px' }}>No shops registered yet.</p>
                    ) : (
                        <table>
                            <thead>
                                <tr>
                                    <th>Shop Name</th>
                                    <th>Phone</th>
                                    <th>Plan</th>
                                    <th>Status</th>
                                    <th>Days Left</th>
                                    <th>Registered</th>
                                </tr>
                            </thead>
                            <tbody>
                                {recentShops.map(shop => {
                                    const plan = shop.planId || 'basic';
                                    const daysLeft = getDaysRemaining(shop.subscriptionEnd);
                                    return (
                                        <tr key={shop.id}>
                                            <td>
                                                <span style={{ fontWeight: 600, color: '#1e293b' }}>{shop.shopName}</span>
                                            </td>
                                            <td>{shop.phone}</td>
                                            <td>
                                                <span className={`plan-badge plan-badge--${plan}`}>
                                                    {plan.charAt(0).toUpperCase() + plan.slice(1)}
                                                </span>
                                            </td>
                                            <td>
                                                <span className={`status-badge status-badge--${shop.subscriptionStatus}`}>
                                                    <span className="status-badge__dot" />
                                                    {shop.subscriptionStatus.charAt(0).toUpperCase() + shop.subscriptionStatus.slice(1)}
                                                </span>
                                            </td>
                                            <td>
                                                {daysLeft !== null ? (
                                                    <span style={{
                                                        fontSize: '13px',
                                                        fontWeight: 700,
                                                        color: daysLeft <= 0 ? '#dc2626' : daysLeft <= 7 ? '#b45309' : daysLeft <= 30 ? '#d97706' : '#16a34a',
                                                    }}>
                                                        {daysLeft <= 0 ? 'Expired' : `${daysLeft}d`}
                                                    </span>
                                                ) : (
                                                    <span style={{ fontSize: '13px', color: '#94a3b8' }}>—</span>
                                                )}
                                            </td>
                                            <td style={{ color: '#64748b', fontSize: '13px' }}>
                                                {new Date(shop.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    )}
                </div>
            </div>
        </div>
    );
};

export default AdminDashboard;
