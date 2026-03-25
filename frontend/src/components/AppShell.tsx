import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { colors, radius } from '../styles/tokens';

interface NavItem {
    id: string;
    label: string;
    path: string;
    icon: React.ReactNode;
}

const navItems: NavItem[] = [
    {
        id: 'dashboard',
        label: 'Dashboard',
        path: '/dashboard',
        icon: (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                <rect x="3" y="3" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.8" />
                <rect x="14" y="3" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.8" />
                <rect x="3" y="14" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.8" />
                <rect x="14" y="14" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.8" />
            </svg>
        ),
    },
    {
        id: 'upload',
        label: 'New Analysis',
        path: '/upload',
        icon: (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M17 8l-5-5-5 5M12 3v12" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
        ),
    },
    {
        id: 'history',
        label: 'My Papers',
        path: '/papers',
        icon: (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                <polyline points="14 2 14 8 20 8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                <line x1="16" y1="13" x2="8" y2="13" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                <line x1="16" y1="17" x2="8" y2="17" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
            </svg>
        ),
    },
];

interface Props {
    children: React.ReactNode;
}

export default function AppShell({ children }: Props) {
    const { user, logout } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();
    const [showUserMenu, setShowUserMenu] = useState(false);

    const activeId = navItems.find(n => location.pathname.startsWith(n.path))?.id ?? 'dashboard';

    return (
        <div style={s.shell}>
            {/* Sidebar */}
            <aside style={s.sidebar}>
                {/* Logo */}
                <div style={s.sidebarLogo}>
                    <div style={s.logoIcon}>
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                            <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                    </div>
                    <span style={s.logoText}>FraudLens</span>
                </div>

                {/* Nav */}
                <nav style={s.nav}>
                    <div style={s.navSection}>
                        <div style={s.navSectionLabel}>Main</div>
                        {navItems.map(item => {
                            const active = activeId === item.id;
                            return (
                                <button
                                    key={item.id}
                                    style={{ ...s.navItem, ...(active ? s.navItemActive : {}) }}
                                    onClick={() => navigate(item.path)}
                                >
                                    <span style={{ ...s.navIcon, color: active ? colors.brand.primary : colors.text.muted }}>
                                        {item.icon}
                                    </span>
                                    <span style={{ ...s.navLabel, color: active ? colors.text.primary : colors.text.secondary }}>
                                        {item.label}
                                    </span>
                                    {active && <div style={s.navActiveDot} />}
                                </button>
                            );
                        })}
                    </div>
                </nav>

                {/* Bottom: user */}
                <div style={s.sidebarBottom}>
                    <div style={s.planBadge}>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
                            <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" fill={colors.brand.primary} />
                        </svg>
                        {user?.plan === 'pro' ? 'Pro Plan' : 'Free Plan'}
                    </div>

                    <div style={s.userCard} onClick={() => setShowUserMenu(v => !v)}>
                        <div style={s.avatar}>{user?.avatar}</div>
                        <div style={s.userInfo}>
                            <div style={s.userName}>{user?.name}</div>
                            <div style={s.userEmail}>{user?.email}</div>
                        </div>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" style={{ color: colors.text.muted, flexShrink: 0 }}>
                            <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                    </div>

                    {showUserMenu && (
                        <div style={s.userMenu}>
                            <button style={s.userMenuItem} onClick={() => { setShowUserMenu(false); }}>
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /><circle cx="12" cy="7" r="4" stroke="currentColor" strokeWidth="1.8" /></svg>
                                Profile settings
                            </button>
                            <div style={s.userMenuDivider} />
                            <button style={{ ...s.userMenuItem, color: '#ef4444' }} onClick={() => { logout().then(() => navigate('/login')); }}>
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
                                Sign out
                            </button>
                        </div>
                    )}
                </div>
            </aside>

            {/* Main content */}
            <main style={s.main}>
                {children}
            </main>
        </div>
    );
}

const s: Record<string, React.CSSProperties> = {
    shell: { display: 'flex', height: '100vh', overflow: 'hidden', background: colors.bg.base },
    sidebar: {
        width: 240, flexShrink: 0, background: colors.bg.surface,
        borderRight: `1px solid ${colors.bg.border}`,
        display: 'flex', flexDirection: 'column', overflow: 'hidden',
    },
    sidebarLogo: {
        display: 'flex', alignItems: 'center', gap: 10,
        padding: '24px 20px 20px', borderBottom: `1px solid ${colors.bg.border}`,
    },
    logoIcon: {
        width: 34, height: 34, borderRadius: radius.md,
        background: colors.brand.gradient, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
    },
    logoText: { fontSize: 17, fontWeight: 700, color: colors.text.primary, letterSpacing: '-0.3px' },
    nav: { flex: 1, padding: '16px 12px', overflowY: 'auto' },
    navSection: { marginBottom: 24 },
    navSectionLabel: { fontSize: 10, fontWeight: 700, color: colors.text.muted, textTransform: 'uppercase', letterSpacing: 1.2, padding: '0 8px', marginBottom: 8 },
    navItem: {
        display: 'flex', alignItems: 'center', gap: 10, width: '100%',
        padding: '9px 10px', borderRadius: radius.md, border: 'none',
        background: 'transparent', cursor: 'pointer', position: 'relative',
        transition: 'background 0.15s',
    },
    navItemActive: { background: colors.brand.primaryGlow },
    navIcon: { display: 'flex', flexShrink: 0 },
    navLabel: { fontSize: 14, fontWeight: 500 },
    navActiveDot: {
        width: 6, height: 6, borderRadius: '50%', background: colors.brand.primary,
        marginLeft: 'auto', flexShrink: 0,
    },
    sidebarBottom: { padding: '12px', borderTop: `1px solid ${colors.bg.border}`, position: 'relative' },
    planBadge: {
        display: 'flex', alignItems: 'center', gap: 6,
        fontSize: 11, fontWeight: 600, color: colors.brand.primary,
        background: colors.brand.primaryGlow, borderRadius: radius.full,
        padding: '4px 10px', marginBottom: 10, width: 'fit-content',
    },
    userCard: {
        display: 'flex', alignItems: 'center', gap: 10,
        padding: '10px', borderRadius: radius.md, cursor: 'pointer',
        background: colors.bg.elevated, border: `1px solid ${colors.bg.border}`,
    },
    avatar: {
        width: 32, height: 32, borderRadius: '50%', background: colors.brand.gradient,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 12, fontWeight: 700, color: '#fff', flexShrink: 0,
    },
    userInfo: { flex: 1, minWidth: 0 },
    userName: { fontSize: 13, fontWeight: 600, color: colors.text.primary, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
    userEmail: { fontSize: 11, color: colors.text.muted, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
    userMenu: {
        position: 'absolute', bottom: '100%', left: 12, right: 12,
        background: colors.bg.card, border: `1px solid ${colors.bg.border}`,
        borderRadius: radius.lg, padding: '6px', boxShadow: colors.shadow.elevated,
        marginBottom: 4,
    },
    userMenuItem: {
        display: 'flex', alignItems: 'center', gap: 10, width: '100%',
        padding: '9px 12px', borderRadius: radius.md, border: 'none',
        background: 'transparent', cursor: 'pointer', fontSize: 13,
        color: colors.text.secondary,
    },
    userMenuDivider: { height: 1, background: colors.bg.border, margin: '4px 0' },
    main: { flex: 1, overflow: 'auto', display: 'flex', flexDirection: 'column' },
};
