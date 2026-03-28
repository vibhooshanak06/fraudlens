import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { updateProfile, updatePassword } from '../api';
import { colors, radius } from '../styles/tokens';

export default function ProfilePage() {
    const { user, token, login } = useAuth();

    // Profile form
    const [name, setName] = useState(user?.name ?? '');
    const [profileSaving, setProfileSaving] = useState(false);
    const [profileMsg, setProfileMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

    // Password form
    const [currentPw, setCurrentPw] = useState('');
    const [newPw, setNewPw] = useState('');
    const [confirmPw, setConfirmPw] = useState('');
    const [pwSaving, setPwSaving] = useState(false);
    const [pwMsg, setPwMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

    async function handleProfileSave(e: React.FormEvent) {
        e.preventDefault();
        if (!name.trim()) return;
        setProfileSaving(true);
        setProfileMsg(null);
        try {
            await updateProfile(name.trim());
            // Update localStorage so sidebar reflects new name
            const stored = localStorage.getItem('fl_user');
            if (stored) {
                const u = JSON.parse(stored);
                u.name = name.trim();
                u.avatar = name.trim().split(' ').map((w: string) => w[0] || '').join('').toUpperCase().slice(0, 2);
                localStorage.setItem('fl_user', JSON.stringify(u));
            }
            setProfileMsg({ type: 'success', text: 'Profile updated successfully.' });
        } catch (err: any) {
            setProfileMsg({ type: 'error', text: err?.response?.data?.error || 'Failed to update profile.' });
        } finally {
            setProfileSaving(false);
        }
    }

    async function handlePasswordSave(e: React.FormEvent) {
        e.preventDefault();
        if (newPw !== confirmPw) { setPwMsg({ type: 'error', text: 'New passwords do not match.' }); return; }
        if (newPw.length < 8) { setPwMsg({ type: 'error', text: 'Password must be at least 8 characters.' }); return; }
        setPwSaving(true);
        setPwMsg(null);
        try {
            await updatePassword(currentPw, newPw);
            setCurrentPw(''); setNewPw(''); setConfirmPw('');
            setPwMsg({ type: 'success', text: 'Password changed successfully.' });
        } catch (err: any) {
            setPwMsg({ type: 'error', text: err?.response?.data?.error || 'Failed to change password.' });
        } finally {
            setPwSaving(false);
        }
    }

    const avatarText = name.trim().split(' ').map(w => w[0] || '').join('').toUpperCase().slice(0, 2) || '??';

    return (
        <div style={s.page}>
            <div style={s.header}>
                <h1 style={s.title}>Profile Settings</h1>
                <p style={s.subtitle}>Manage your account information and security.</p>
            </div>

            <div style={s.layout}>
                {/* Left column */}
                <div style={s.col}>

                    {/* Avatar + account info card */}
                    <div style={s.card}>
                        <div style={s.cardTitle}>Account</div>
                        <div style={s.avatarRow}>
                            <div style={s.avatarLarge}>{avatarText}</div>
                            <div>
                                <div style={s.avatarName}>{name || user?.name}</div>
                                <div style={s.avatarEmail}>{user?.email}</div>
                                <div style={s.planChip}>
                                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none">
                                        <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" fill={colors.brand.primary} />
                                    </svg>
                                    {user?.plan === 'pro' ? 'Pro Plan' : 'Free Plan'}
                                </div>
                            </div>
                        </div>

                        <div style={s.infoGrid}>
                            {[
                                { label: 'Role', value: user?.role === 'admin' ? 'Administrator' : 'Researcher' },
                                { label: 'Member since', value: 'Active account' },
                            ].map(item => (
                                <div key={item.label} style={s.infoItem}>
                                    <div style={s.infoLabel}>{item.label}</div>
                                    <div style={s.infoValue}>{item.value}</div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Update name */}
                    <div style={s.card}>
                        <div style={s.cardTitle}>Display Name</div>
                        <form onSubmit={handleProfileSave}>
                            <div style={s.field}>
                                <label style={s.label}>Full name</label>
                                <input
                                    style={s.input}
                                    value={name}
                                    onChange={e => setName(e.target.value)}
                                    placeholder="Your full name"
                                    required
                                />
                            </div>
                            {profileMsg && (
                                <div style={{ ...s.msg, background: profileMsg.type === 'success' ? 'rgba(16,185,129,0.08)' : 'rgba(239,68,68,0.08)', borderColor: profileMsg.type === 'success' ? 'rgba(16,185,129,0.25)' : 'rgba(239,68,68,0.25)', color: profileMsg.type === 'success' ? colors.status.low : colors.status.high }}>
                                    {profileMsg.type === 'success'
                                        ? <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><polyline points="20 6 9 17 4 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
                                        : <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="1.8" /><line x1="12" y1="8" x2="12" y2="12" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /></svg>
                                    }
                                    {profileMsg.text}
                                </div>
                            )}
                            <button style={{ ...s.saveBtn, opacity: profileSaving ? 0.7 : 1 }} type="submit" disabled={profileSaving}>
                                {profileSaving ? 'Saving…' : 'Save Changes'}
                            </button>
                        </form>
                    </div>
                </div>

                {/* Right column */}
                <div style={s.col}>
                    {/* Change password */}
                    <div style={s.card}>
                        <div style={s.cardTitle}>Change Password</div>
                        <form onSubmit={handlePasswordSave}>
                            <div style={s.field}>
                                <label style={s.label}>Current password</label>
                                <input style={s.input} type="password" value={currentPw} onChange={e => setCurrentPw(e.target.value)} placeholder="••••••••" required autoComplete="current-password" />
                            </div>
                            <div style={s.field}>
                                <label style={s.label}>New password</label>
                                <input style={s.input} type="password" value={newPw} onChange={e => setNewPw(e.target.value)} placeholder="Min. 8 characters" required autoComplete="new-password" />
                            </div>
                            <div style={s.field}>
                                <label style={s.label}>Confirm new password</label>
                                <input style={s.input} type="password" value={confirmPw} onChange={e => setConfirmPw(e.target.value)} placeholder="Repeat new password" required autoComplete="new-password" />
                            </div>
                            {pwMsg && (
                                <div style={{ ...s.msg, background: pwMsg.type === 'success' ? 'rgba(16,185,129,0.08)' : 'rgba(239,68,68,0.08)', borderColor: pwMsg.type === 'success' ? 'rgba(16,185,129,0.25)' : 'rgba(239,68,68,0.25)', color: pwMsg.type === 'success' ? colors.status.low : colors.status.high }}>
                                    {pwMsg.type === 'success'
                                        ? <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><polyline points="20 6 9 17 4 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
                                        : <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="1.8" /><line x1="12" y1="8" x2="12" y2="12" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /></svg>
                                    }
                                    {pwMsg.text}
                                </div>
                            )}
                            <button style={{ ...s.saveBtn, opacity: pwSaving ? 0.7 : 1 }} type="submit" disabled={pwSaving}>
                                {pwSaving ? 'Updating…' : 'Update Password'}
                            </button>
                        </form>
                    </div>

                    {/* Security info */}
                    <div style={s.card}>
                        <div style={s.cardTitle}>Security</div>
                        <div style={s.securityItem}>
                            <div style={s.securityIcon}>
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                                    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" stroke={colors.status.low} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                                </svg>
                            </div>
                            <div>
                                <div style={s.securityLabel}>Session-based authentication</div>
                                <div style={s.securityDesc}>Your session is secured with JWT tokens and server-side session validation.</div>
                            </div>
                        </div>
                        <div style={s.securityItem}>
                            <div style={s.securityIcon}>
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                                    <rect x="3" y="11" width="18" height="11" rx="2" stroke={colors.brand.primary} strokeWidth="1.8" />
                                    <path d="M7 11V7a5 5 0 0110 0v4" stroke={colors.brand.primary} strokeWidth="1.8" strokeLinecap="round" />
                                </svg>
                            </div>
                            <div>
                                <div style={s.securityLabel}>Password hashing</div>
                                <div style={s.securityDesc}>Passwords are hashed with bcrypt (cost factor 12) and never stored in plain text.</div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

const s: Record<string, React.CSSProperties> = {
    page: { padding: '32px 36px', maxWidth: 900, width: '100%' },
    header: { marginBottom: 32 },
    title: { fontSize: 26, fontWeight: 800, color: colors.text.primary, letterSpacing: '-0.5px', marginBottom: 6 },
    subtitle: { fontSize: 14, color: colors.text.secondary },
    layout: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, alignItems: 'start' },
    col: { display: 'flex', flexDirection: 'column', gap: 16 },
    card: { background: colors.bg.surface, border: `1px solid ${colors.bg.border}`, borderRadius: radius.lg, padding: '22px 24px' },
    cardTitle: { fontSize: 14, fontWeight: 700, color: colors.text.primary, marginBottom: 18, letterSpacing: '-0.2px' },
    avatarRow: { display: 'flex', alignItems: 'center', gap: 16, marginBottom: 20 },
    avatarLarge: {
        width: 56, height: 56, borderRadius: '50%', background: colors.brand.gradient,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 18, fontWeight: 700, color: '#fff', flexShrink: 0,
    },
    avatarName: { fontSize: 16, fontWeight: 700, color: colors.text.primary, marginBottom: 3 },
    avatarEmail: { fontSize: 13, color: colors.text.muted, marginBottom: 8 },
    planChip: { display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11, fontWeight: 600, color: colors.brand.primary, background: colors.brand.primaryGlow, borderRadius: radius.full, padding: '3px 10px' },
    infoGrid: { display: 'flex', flexDirection: 'column', gap: 10, borderTop: `1px solid ${colors.bg.border}`, paddingTop: 16 },
    infoItem: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
    infoLabel: { fontSize: 12, color: colors.text.muted },
    infoValue: { fontSize: 13, color: colors.text.secondary, fontWeight: 500 },
    field: { display: 'flex', flexDirection: 'column', marginBottom: 14 },
    label: { fontSize: 12, fontWeight: 500, color: colors.text.secondary, marginBottom: 7 },
    input: { background: colors.bg.elevated, border: `1px solid ${colors.bg.border}`, borderRadius: radius.md, color: colors.text.primary, padding: '10px 13px', fontSize: 14, outline: 'none', fontFamily: 'inherit' },
    msg: { display: 'flex', alignItems: 'center', gap: 8, border: '1px solid', borderRadius: radius.md, padding: '10px 14px', fontSize: 13, marginBottom: 14 },
    saveBtn: { width: '100%', background: colors.brand.gradient, border: 'none', borderRadius: radius.md, color: '#fff', padding: '11px', fontSize: 14, fontWeight: 600, cursor: 'pointer', marginTop: 4 },
    securityItem: { display: 'flex', gap: 12, alignItems: 'flex-start', marginBottom: 16 },
    securityIcon: { width: 32, height: 32, borderRadius: radius.sm, background: colors.bg.elevated, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
    securityLabel: { fontSize: 13, fontWeight: 600, color: colors.text.primary, marginBottom: 3 },
    securityDesc: { fontSize: 12, color: colors.text.muted, lineHeight: 1.6 },
};
