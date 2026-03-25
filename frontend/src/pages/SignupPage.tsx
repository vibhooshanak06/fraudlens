import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { colors, radius } from '../styles/tokens';

export default function SignupPage() {
    const { signup } = useAuth();
    const navigate = useNavigate();
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        if (password.length < 8) { setError('Password must be at least 8 characters'); return; }
        setError('');
        setLoading(true);
        try {
            await signup(name, email, password);
            navigate('/dashboard');
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    }

    return (
        <div style={s.page}>
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
                    <h2 style={s.leftTitle}>Start detecting fraud<br />in research papers</h2>
                    <p style={s.leftSub}>Join thousands of researchers and institutions using FraudLens to ensure academic integrity.</p>
                    <div style={s.planCard}>
                        <div style={s.planBadge}>Free Plan Includes</div>
                        {['5 paper analyses per month', 'Plagiarism detection', 'Citation checking', 'AI-powered chatbot', 'Paper recommendations'].map(f => (
                            <div key={f} style={s.planFeature}>
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                                    <path d="M20 6L9 17l-5-5" stroke={colors.status.low} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                                </svg>
                                <span>{f}</span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            <div style={s.right}>
                <div style={s.form}>
                    <div style={s.formHeader}>
                        <h1 style={s.formTitle}>Create your account</h1>
                        <p style={s.formSub}>Free forever. No credit card required.</p>
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
                            <label style={s.label}>Full name</label>
                            <input style={s.input} type="text" value={name} onChange={e => setName(e.target.value)} placeholder="Alex Johnson" required />
                        </div>
                        <div style={s.field}>
                            <label style={s.label}>Email address</label>
                            <input style={s.input} type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@university.edu" required />
                        </div>
                        <div style={s.field}>
                            <label style={s.label}>Password</label>
                            <input style={s.input} type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Min. 8 characters" required />
                        </div>
                        <button style={{ ...s.submitBtn, opacity: loading ? 0.7 : 1 }} type="submit" disabled={loading}>
                            {loading ? 'Creating account…' : 'Create free account'}
                        </button>
                    </form>

                    <p style={s.terms}>
                        By signing up, you agree to our{' '}
                        <a href="#" style={s.link}>Terms of Service</a> and{' '}
                        <a href="#" style={s.link}>Privacy Policy</a>.
                    </p>

                    <p style={s.switchText}>
                        Already have an account?{' '}
                        <Link to="/login" style={s.switchLink}>Sign in</Link>
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
        padding: '60px 48px',
    },
    leftInner: {},
    logo: { display: 'flex', alignItems: 'center', gap: 12, marginBottom: 48 },
    logoIcon: {
        width: 40, height: 40, borderRadius: radius.md,
        background: colors.brand.gradient, display: 'flex', alignItems: 'center', justifyContent: 'center',
    },
    logoText: { fontSize: 20, fontWeight: 700, color: colors.text.primary, letterSpacing: '-0.3px' },
    leftTitle: { fontSize: 32, fontWeight: 800, color: colors.text.primary, lineHeight: 1.25, marginBottom: 16, letterSpacing: '-0.5px' },
    leftSub: { fontSize: 15, color: colors.text.secondary, lineHeight: 1.7, marginBottom: 40 },
    planCard: {
        background: colors.bg.elevated, border: `1px solid ${colors.bg.border}`,
        borderRadius: radius.lg, padding: '24px',
    },
    planBadge: {
        fontSize: 11, fontWeight: 700, color: colors.brand.primary, textTransform: 'uppercase' as const,
        letterSpacing: 1, marginBottom: 16,
    },
    planFeature: { display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12, fontSize: 14, color: colors.text.secondary },
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
        fontSize: 14, outline: 'none', fontFamily: 'inherit',
    },
    submitBtn: {
        background: colors.brand.gradient, border: 'none', borderRadius: radius.md,
        color: '#fff', padding: '13px', fontSize: 15, fontWeight: 600,
        cursor: 'pointer', marginTop: 4,
    },
    terms: { fontSize: 12, color: colors.text.muted, textAlign: 'center' as const, marginTop: 20, lineHeight: 1.6 },
    link: { color: colors.brand.primary, textDecoration: 'none' },
    switchText: { textAlign: 'center' as const, fontSize: 14, color: colors.text.muted, marginTop: 16 },
    switchLink: { color: colors.brand.primary, textDecoration: 'none', fontWeight: 500 },
};
