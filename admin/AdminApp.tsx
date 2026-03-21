import React, { useState, useEffect } from 'react';
import { auth, db } from '../firebaseConfig';
import { signInWithEmailAndPassword, onAuthStateChanged, signOut, User } from 'firebase/auth';
import { collection, getDocs } from 'firebase/firestore';
import { checkIsSuperAdmin } from '../services/authService';
import { ShopProfile } from '../types';
import ShopManagement from './ShopManagement';
import TrialRequests from './TrialRequests';
import PlanPricing from './PlanPricing';
import AdminDashboard from './AdminDashboard';
import AdminLandingPageManager from './AdminLandingPageManager';
import DefaultCatalogManager from './DefaultCatalogManager';

type AdminView = 'dashboard' | 'shops' | 'trial_requests' | 'subscriptions' | 'catalog' | 'settings' | 'landing_page';

const NAV_ITEMS: { id: AdminView; label: string; icon: React.ReactNode }[] = [
    {
        id: 'dashboard',
        label: 'Dashboard',
        icon: (
            <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
                <rect x="3" y="3" width="7" height="7" />
                <rect x="14" y="3" width="7" height="7" />
                <rect x="14" y="14" width="7" height="7" />
                <rect x="3" y="14" width="7" height="7" />
            </svg>
        ),
    },
    {
        id: 'shops',
        label: 'Shop Owners',
        icon: (
            <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
                <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                <polyline points="9 22 9 12 15 12 15 22" />
            </svg>
        ),
    },
    {
        id: 'trial_requests',
        label: 'Trial Requests',
        icon: (
            <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
                <line x1="16" y1="13" x2="8" y2="13" />
                <line x1="16" y1="17" x2="8" y2="17" />
                <polyline points="10 9 9 9 8 9" />
            </svg>
        ),
    },
    {
        id: 'subscriptions',
        label: 'Subscriptions',
        icon: (
            <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
                <rect x="1" y="4" width="22" height="16" rx="2" ry="2" />
                <line x1="1" y1="10" x2="23" y2="10" />
            </svg>
        ),
    },
    {
        id: 'catalog',
        label: 'Stock Catalog',
        icon: (
            <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
                <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" />
                <line x1="3" y1="6" x2="21" y2="6" />
                <path d="M16 10a4 4 0 0 1-8 0" />
            </svg>
        ),
    },
    {
        id: 'settings',
        label: 'Settings',
        icon: (
            <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
                <circle cx="12" cy="12" r="3" />
                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
            </svg>
        ),
    },
    {
        id: 'landing_page',
        label: 'Landing Page',
        icon: (
            <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
                <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
                <line x1="8" y1="21" x2="16" y2="21" />
                <line x1="12" y1="17" x2="12" y2="21" />
            </svg>
        ),
    },
];

const AdminApp: React.FC = () => {
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);
    const [loginPhone, setLoginPhone] = useState('');
    const [loginPassword, setLoginPassword] = useState('');
    const [loginError, setLoginError] = useState('');
    const [loginLoading, setLoginLoading] = useState(false);
    const [activeView, setActiveView] = useState<AdminView>('dashboard');
    const [shops, setShops] = useState<ShopProfile[]>([]);
    const [shopsLoading, setShopsLoading] = useState(true);

    useEffect(() => {
        const unsub = onAuthStateChanged(auth, (u) => {
            if (u && checkIsSuperAdmin(u.email)) {
                setUser(u);
            } else {
                setUser(null);
            }
            setLoading(false);
        });
        return () => unsub();
    }, []);

    // Load shops once authenticated
    useEffect(() => {
        if (!user) return;
        loadShops();
    }, [user]);

    const loadShops = async () => {
        setShopsLoading(true);
        try {
            const snapshot = await getDocs(collection(db, 'shops'));
            const data = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            })) as ShopProfile[];
            setShops(data);
        } catch (err) {
            console.error('Failed to load shops', err);
        }
        setShopsLoading(false);
    };

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoginLoading(true);
        setLoginError('');

        const emailsToTry: string[] = [];
        if (loginPhone.includes('@')) {
            emailsToTry.push(loginPhone);
        } else {
            emailsToTry.push(`${loginPhone}@veda.admin`);
            emailsToTry.push(`${loginPhone}@veda.shop`);
        }

        let lastError: any = null;
        for (const email of emailsToTry) {
            try {
                const cred = await signInWithEmailAndPassword(auth, email, loginPassword);
                if (!checkIsSuperAdmin(cred.user.email)) {
                    await signOut(auth);
                    setLoginError('Access denied. Super admin only.');
                    setLoginLoading(false);
                    return;
                }
                setUser(cred.user);
                return;
            } catch (err: any) {
                lastError = err;
            }
        }

        setLoginError(
            lastError?.code === 'auth/invalid-credential'
                ? 'Invalid credentials. Try your phone number or email with your password.'
                : 'Login failed. Try again.'
        );
        setLoginLoading(false);
    };

    const handleLogout = async () => {
        await signOut(auth);
        setUser(null);
    };

    if (loading) {
        return (
            <div className="admin-spinner" style={{ minHeight: '100vh' }}>
                <div className="admin-spinner__circle" />
            </div>
        );
    }

    if (!user) {
        return (
            <div className="admin-login">
                <div className="admin-login__card">
                    <div className="admin-login__header">
                        <div className="admin-login__icon">
                            <svg width="28" height="28" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
                                <rect x="2" y="7" width="20" height="14" rx="2" ry="2" />
                                <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
                            </svg>
                        </div>
                        <h1 className="admin-login__title">Instabill Admin</h1>
                        <p className="admin-login__desc">Super admin access only</p>
                    </div>
                    <form className="admin-login__form" onSubmit={handleLogin}>
                        <div className="admin-login__field">
                            <label className="admin-login__label">Phone Number or Email</label>
                            <input
                                className="admin-login__input"
                                type="text"
                                placeholder="9876543210 or email@example.com"
                                value={loginPhone}
                                onChange={(e) => setLoginPhone(e.target.value)}
                            />
                        </div>
                        <div className="admin-login__field">
                            <label className="admin-login__label">Password</label>
                            <input
                                className="admin-login__input"
                                type="password"
                                placeholder="••••••••"
                                value={loginPassword}
                                onChange={(e) => setLoginPassword(e.target.value)}
                            />
                        </div>
                        <button
                            className="admin-login__submit"
                            type="submit"
                            disabled={loginLoading || !loginPhone || !loginPassword}
                        >
                            {loginLoading ? 'Logging in...' : 'Login to Admin'}
                        </button>
                        {loginError && <div className="admin-login__error">{loginError}</div>}
                    </form>
                </div>
            </div>
        );
    }

    // Authenticated — sidebar layout
    const renderContent = () => {
        switch (activeView) {
            case 'dashboard':
                return <AdminDashboard shops={shops} />;
            case 'shops':
                return <ShopManagement shops={shops} setShops={setShops} loading={shopsLoading} />;
            case 'trial_requests':
                return <TrialRequests shops={shops} setShops={setShops} loading={shopsLoading} />;
            case 'subscriptions':
                return <PlanPricing shops={shops} />;
            case 'landing_page':
                return <AdminLandingPageManager />;
            case 'catalog':
                return <DefaultCatalogManager />;
            case 'settings': {
                const activeCount = shops.filter(s => s.subscriptionStatus === 'active').length;
                const totalCount = shops.length;
                return (
                    <div className="admin-dashboard">
                        <div className="admin-page-header">
                            <h1>Settings</h1>
                            <p>Admin configuration and system information</p>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '20px' }}>
                            {/* Admin Account */}
                            <div className="admin-card">
                                <div className="admin-card__header"><h2>Admin Account</h2></div>
                                <div className="admin-card__body" style={{ padding: '24px' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '20px' }}>
                                        <div style={{ width: '56px', height: '56px', borderRadius: '14px', background: 'var(--admin-primary)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '22px', fontWeight: 800, flexShrink: 0 }}>IA</div>
                                        <div>
                                            <p style={{ fontWeight: 800, fontSize: '16px', color: 'var(--admin-text)' }}>Super Admin</p>
                                            <p style={{ fontSize: '13px', color: 'var(--admin-text-muted)', marginTop: '2px' }}>{user?.email || 'admin@instabill.app'}</p>
                                        </div>
                                    </div>
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                                        <div style={{ padding: '14px', background: 'var(--admin-bg)', borderRadius: '10px' }}>
                                            <p style={{ fontSize: '11px', fontWeight: 700, color: 'var(--admin-text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Total Shops</p>
                                            <p style={{ fontSize: '24px', fontWeight: 900, color: 'var(--admin-text)', marginTop: '4px' }}>{totalCount}</p>
                                        </div>
                                        <div style={{ padding: '14px', background: 'var(--status-active-bg)', borderRadius: '10px' }}>
                                            <p style={{ fontSize: '11px', fontWeight: 700, color: 'var(--admin-text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Active</p>
                                            <p style={{ fontSize: '24px', fontWeight: 900, color: 'var(--status-active-text)', marginTop: '4px' }}>{activeCount}</p>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* App Information */}
                            <div className="admin-card">
                                <div className="admin-card__header"><h2>App Information</h2></div>
                                <div className="admin-card__body" style={{ padding: '24px' }}>
                                    {[
                                        { label: 'App Name', value: 'Instabill' },
                                        { label: 'Version', value: 'v1.1.0' },
                                        { label: 'Platform', value: 'Web (PWA)' },
                                        { label: 'Payment Gateway', value: 'Razorpay' },
                                        { label: 'Database', value: 'Firebase Firestore' },
                                        { label: 'Auth', value: 'Firebase Auth' },
                                    ].map((item, i) => (
                                        <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: i < 5 ? '1px solid var(--admin-border-light)' : 'none' }}>
                                            <span style={{ fontSize: '13px', fontWeight: 500, color: 'var(--admin-text-secondary)' }}>{item.label}</span>
                                            <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--admin-text)' }}>{item.value}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                );
            }
            default:
                return null;
        }
    };

    return (
        <div className="admin-layout">
            {/* Sidebar */}
            <aside className="admin-sidebar">
                <div className="admin-sidebar__brand">
                    <div className="admin-sidebar__brand-icon">
                        <svg width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
                            <rect x="2" y="7" width="20" height="14" rx="2" ry="2" />
                            <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
                        </svg>
                    </div>
                    <div>
                        <div className="admin-sidebar__brand-name">Instabill Admin</div>
                        <div className="admin-sidebar__brand-role">Super Admin</div>
                    </div>
                </div>

                <nav className="admin-sidebar__nav">
                    {NAV_ITEMS.map(item => {
                        const pendingCount = item.id === 'trial_requests' ? shops.filter(s => s.trialStatus === 'pending').length : 0;
                        return (
                            <button
                                key={item.id}
                                className={`admin-sidebar__nav-item ${activeView === item.id ? 'admin-sidebar__nav-item--active' : ''}`}
                                onClick={() => setActiveView(item.id)}
                            >
                                <span className="admin-sidebar__nav-icon">{item.icon}</span>
                                <span>{item.label}</span>
                                {item.id === 'trial_requests' && pendingCount > 0 && (
                                    <span style={{ marginLeft: 'auto', background: '#EF4444', color: 'white', fontSize: '11px', fontWeight: 800, padding: '2px 8px', borderRadius: '10px' }}>
                                        {pendingCount}
                                    </span>
                                )}
                            </button>
                        );
                    })}
                </nav>

                <div className="admin-sidebar__footer">
                    <button className="admin-sidebar__logout" onClick={handleLogout}>
                        <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
                            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                            <polyline points="16 17 21 12 16 7" />
                            <line x1="21" y1="12" x2="9" y2="12" />
                        </svg>
                        <span>Sign Out</span>
                    </button>
                </div>
            </aside>

            {/* Main Content */}
            <main className="admin-main">
                {renderContent()}
            </main>
        </div>
    );
};

export default AdminApp;
