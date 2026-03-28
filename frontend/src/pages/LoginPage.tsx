import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { colors, radius } from '../styles/tokens';

export default function LoginPage() {
    const { login } = useAuth();
    const navigate = useNavigate();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        setError('');
        setLoading(true);
        try {
            await login(email, password);
            navigate('/dashboard');
        } catch (err: any) {
            setError(err?.response?.data?.error || err.message || 'Login failed');
        } finally {
            setLoading(false);
        }
    }

    return (
        <div style={s.page}>
            {/* Left panel */}
            <div style={s.left}>
                <div style={s.leftInner}>
                    <div style={s.logo}>
                        <div style={s.logoIcon}>
                            <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
                                <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                        </div>
                        <span style={s.logoText}>FraudLens</span>
                    </div>
                    <h2 style={s.leftTitle}>AI-Powered Research<br />Integrity Platform</h2>
                    <p style={s.leftSub}>Detect plagiarism, analyze citations, and verify research authenticity with state-of-the-art AI.</p>
                    <div style={s.features}>
                        {[
                            { icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><circle cx="11" cy="11" r="8" stroke={colors.brand.primary} strokeWidth="1.8" /><path d="M21 21l-4.35-4.35" stroke={colors.brand.primary} strokeWidth="1.8" strokeLinecap="round" /></svg>, text: 'Deep plagiarism detection with TF-IDF analysis' },
                            { icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" stroke={colors.brand.primary} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>, text: 'RAG-based chatbot for paper Q&A' },
                            { icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><rect x="3" y="3" width="18" height="18" rx="2" stroke={colors.brand.primary} strokeWidth="1.8" /><path d="M8 17v-4M12 17v-7M16 17v-2" stroke={colors.brand.primary} strokeWidth="1.8" strokeLinecap="round" /></svg>, text: 'Visual fraud risk scoring & reporting' },
                            { icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M4 19.5A2.5 2.5 0 016.5 17H20" stroke={colors.brand.primary} strokeWidth="1.8" strokeLinecap="round" /><path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z" stroke={colors.brand.primary} strokeWidth="1.8" strokeLinecap="round" /></svg>, text: 'Smart paper recommendations' },
                        ].map(f => (
                            <div key={f.text} style={s.featureItem}>
                                <span style={s.featureIcon}>{f.icon}</span>
                                <span style={s.featureText}>{f.text}</span>
                            </div>
                        ))}
                    </div>
                    <div style={s.stats}>
                        {[['10K+', 'Papers Analyzed'], ['99.2%', 'Accuracy Rate'], ['<60s', 'Analysis Time']].map(([val, label]) => (
                            <div key={label} style={s.stat}>
                                <div style={s.statVal}>{val}</div>
                                <div style={s.statLabel}>{label}</div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Right panel */}
            <div style={s.right}>
                <div style={s.form}>
                    <div style={s.formHeader}>
                        <h1 style={s.formTitle}>Welcome back</h1>
                        <p style={s.formSub}>Sign in to your FraudLens account</p>
                    </div>

                    {error && (
                        <div style={s.errorBox}>
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0 }}>
                                <circle cx="12" cy="12" r="10" stroke="#ef4444" strokeWidth="2" />
                                <line x1="12" y1="8" x2="12" y2="12" stroke="#ef4444" strokeWidth="2" strokeLinecap="round" />
                                <circle cx="12" cy="16" r="1" fill="#ef4444" />
                            </svg>
                            {error}
                        </div>
                    )}

                    <form onSubmit={handleSubmit} style={s.formBody}>
                        <div style={s.field}>
                            <label style={s.label}>Email address</label>
                            <input
                                style={s.input}
                                type="email"
                                value={email}
                                onChange={e => setEmail(e.target.value)}
                                placeholder="you@example.com"
                                required
                                autoComplete="email"
                            />
                        </div>
                        <div style={s.field}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                                <label style={s.label}>Password</label>
                                <a href="#" style={s.forgotLink}>Forgot password?</a>
                            </div>
                            <input
                                style={s.input}
                                type="password"
                                value={password}
                                onChange={e => setPassword(e.target.value)}
                                placeholder="••••••••"
                                required
                                autoComplete="current-password"
                            />
                        </div>
                        <button style={{ ...s.submitBtn, opacity: loading ? 0.7 : 1 }} type="submit" disabled={loading}>
                            {loading ? (
                                <span style={s.btnInner}>
                                    <span style={s.spinner} />
                                    Signing in…
                                </span>
                            ) : 'Sign in'}
                        </button>
                    </form>

                    <div style={s.divider}><span style={s.dividerText}>or continue with demo</span></div>

                    <button style={s.demoBtn} onClick={() => { setEmail('demo@fraudlens.ai'); setPassword('demo1234'); }}>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" style={{ marginRight: 8 }}>
                            <path d="M12 2L2 7l10 5 10-5-10-5z" stroke={colors.brand.primary} strokeWidth="2" strokeLinecap="round" />
                        </svg>
                        Use demo credentials
                    </button>

                    <p style={s.switchText}>
                        Don't have an account?{' '}
                        <Link to="/signup" style={s.switchLink}>Create one free</Link>
                    </p>
                </div>
            </div>
        </div>
    );
}

const s: Record<string, React.CSSProperties> = {
    page: { display: 'flex', minHeight: '100vh', background: colors.bg.base },
    left: {
        flex: '0 0 480px', background: `linear-gradient(160deg, #0d1a3a 0%, #0a1228 100%)`,
        borderRight: `1px solid ${colors.bg.border}`, display: 'flex', alignItems: 'center',
        padding: '60px 48px', position: 'relative', overflow: 'hidden',
    },
    leftInner: { position: 'relative', zIndex: 1 },
    logo: { display: 'flex', alignItems: 'center', gap: 12, marginBottom: 48 },
    logoIcon: {
        width: 40, height: 40, borderRadius: radius.md,
        background: colors.brand.gradient, display: 'flex', alignItems: 'center', justifyContent: 'center',
    },
    logoText: { fontSize: 20, fontWeight: 700, color: colors.text.primary, letterSpacing: '-0.3px' },
    leftTitle: { fontSize: 32, fontWeight: 800, color: colors.text.primary, lineHeight: 1.25, marginBottom: 16, letterSpacing: '-0.5px' },
    leftSub: { fontSize: 15, color: colors.text.secondary, lineHeight: 1.7, marginBottom: 40 },
    features: { display: 'flex', flexDirection: 'column', gap: 16, marginBottom: 48 },
    featureItem: { display: 'flex', alignItems: 'center', gap: 14 },
    featureIcon: { width: 36, height: 36, background: colors.bg.elevated, borderRadius: radius.md, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 } as any,
    featureText: { fontSize: 14, color: colors.text.secondary },
    stats: { display: 'flex', gap: 32 },
    stat: { textAlign: 'center' as const },
    statVal: { fontSize: 24, fontWeight: 800, color: colors.brand.primary, letterSpacing: '-0.5px' },
    statLabel: { fontSize: 12, color: colors.text.muted, marginTop: 2 },
    right: { flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px 24px' },
    form: { width: '100%', maxWidth: 420 },
    formHeader: { marginBottom: 32 },
    formTitle: { fontSize: 28, fontWeight: 800, color: colors.text.primary, letterSpacing: '-0.5px', marginBottom: 8 },
    formSub: { fontSize: 15, color: colors.text.secondary },
    errorBox: {
        display: 'flex', alignItems: 'center', gap: 10,
        background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)',
        borderRadius: radius.md, padding: '12px 16px', marginBottom: 20,
        fontSize: 14, color: '#fca5a5',
    },
    formBody: { display: 'flex', flexDirection: 'column', gap: 20 },
    field: { display: 'flex', flexDirection: 'column' },
    label: { fontSize: 13, fontWeight: 500, color: colors.text.secondary, marginBottom: 8 },
    input: {
        background: colors.bg.elevated, border: `1px solid ${colors.bg.border}`,
        borderRadius: radius.md, color: colors.text.primary, padding: '12px 14px',
        fontSize: 14, outline: 'none', transition: 'border-color 0.2s',
        fontFamily: 'inherit',
    },
    forgotLink: { fontSize: 13, color: colors.brand.primary, textDecoration: 'none' },
    submitBtn: {
        background: colors.brand.gradient, border: 'none', borderRadius: radius.md,
        color: '#fff', padding: '13px', fontSize: 15, fontWeight: 600,
        cursor: 'pointer', marginTop: 4, transition: 'opacity 0.2s',
    },
    btnInner: { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10 },
    spinner: {
        width: 16, height: 16, border: '2px solid rgba(255,255,255,0.3)',
        borderTopColor: '#fff', borderRadius: '50%',
        animation: 'spin 0.7s linear infinite',
    },
    divider: { display: 'flex', alignItems: 'center', margin: '24px 0', gap: 12 },
    dividerText: {
        fontSize: 12, color: colors.text.muted, whiteSpace: 'nowrap',
        padding: '0 12px', background: colors.bg.base,
        position: 'relative',
    },
    demoBtn: {
        width: '100%', background: colors.bg.elevated, border: `1px solid ${colors.bg.border}`,
        borderRadius: radius.md, color: colors.text.secondary, padding: '12px',
        fontSize: 14, fontWeight: 500, cursor: 'pointer', display: 'flex',
        alignItems: 'center', justifyContent: 'center',
    },
    switchText: { textAlign: 'center' as const, fontSize: 14, color: colors.text.muted, marginTop: 24 },
    switchLink: { color: colors.brand.primary, textDecoration: 'none', fontWeight: 500 },
};
