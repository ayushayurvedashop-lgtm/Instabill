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
    ];

    return (
        <div className="admin-dashboard">
            <div className="admin-page-header">
                <h1>Dashboard Overview</h1>
                <p>Welcome back. Here's your daily summary.</p>
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
                                    <th>Registered</th>
                                </tr>
                            </thead>
                            <tbody>
                                {recentShops.map(shop => {
                                    const plan = shop.planId || 'basic';
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
