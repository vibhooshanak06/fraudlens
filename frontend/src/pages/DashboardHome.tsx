import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getDashboardStats, getRecentPapers, DashboardStats, PaperMeta } from '../api';
import { colors, radius } from '../styles/tokens';

const riskColor = { low: colors.status.low, medium: colors.status.medium, high: colors.status.high };
const riskBg = { low: colors.status.lowBg, medium: colors.status.mediumBg, high: colors.status.highBg };

function timeAgo(dateStr: string) {
    const diff = Date.now() - new Date(dateStr).getTime();
    const m = Math.floor(diff / 60000);
    if (m < 1) return 'Just now';
    if (m < 60) return `${m}m ago`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}h ago`;
    return `${Math.floor(h / 24)}d ago`;
}

function greeting() {
    const h = new Date().getHours();
    if (h < 12) return 'Good morning';
    if (h < 17) return 'Good afternoon';
    return 'Good evening';
}

export default function DashboardHome() {
    const { user } = useAuth();
    const navigate = useNavigate();
    const [stats, setStats] = useState<DashboardStats | null>(null);
    const [papers, setPapers] = useState<PaperMeta[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        Promise.all([getDashboardStats(), getRecentPapers()])
            .then(([s, p]) => { setStats(s); setPapers(p.papers); })
            .catch(console.error)
            .finally(() => setLoading(false));
    }, []);

    const statCards = stats ? [
        {
            label: 'Total Analyses', value: String(stats.total_analyses), delta: 'All time', color: colors.brand.primary,
            icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" stroke="currentColor" strokeWidth="1.8" /><polyline points="14 2 14 8 20 8" stroke="currentColor" strokeWidth="1.8" /></svg>,
        },
        {
            label: 'High Risk Papers', value: String(stats.high_risk_count), delta: stats.total_analyses ? `${((stats.high_risk_count / stats.total_analyses) * 100).toFixed(1)}% of total` : '—', color: colors.status.high,
            icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /><line x1="12" y1="9" x2="12" y2="13" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /><circle cx="12" cy="17" r="1" fill="currentColor" /></svg>,
        },
        {
            label: 'Avg. Plagiarism Score', value: `${stats.avg_plagiarism ?? 0}%`, delta: 'Across all papers', color: colors.status.medium,
            icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><circle cx="11" cy="11" r="8" stroke="currentColor" strokeWidth="1.8" /><path d="M21 21l-4.35-4.35" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /></svg>,
        },
        {
            label: 'Papers Cleared', value: String(stats.cleared_count), delta: stats.total_analyses ? `${((stats.cleared_count / stats.total_analyses) * 100).toFixed(1)}% clean` : '—', color: colors.status.low,
            icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><polyline points="20 6 9 17 4 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>,
        },
    ] : [];

    return (
        <div style={s.page}>

            {/* Header */}
            <div style={s.header}>
                <div>
                    <h1 style={s.title}>{greeting()}, <span style={{ color: colors.brand.primary }}>{user?.name?.split(' ')[0]}</span></h1>
                    <p style={s.subtitle}>Here's an overview of your research integrity analyses.</p>
                </div>
                <button style={s.newBtn} onClick={() => navigate('/upload')}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                        <path d="M12 5v14M5 12h14" stroke="white" strokeWidth="2.5" strokeLinecap="round" />
                    </svg>
                    New Analysis
                </button>
            </div>

            {/* Stat cards */}
            <div style={s.statsGrid}>
                {loading
                    ? [1, 2, 3, 4].map(i => <div key={i} style={{ ...s.statCard, ...s.skeleton }} />)
                    : statCards.map(stat => (
                        <div key={stat.label} style={s.statCard}>
                            <div style={s.statTop}>
                                <div style={s.statLabel}>{stat.label}</div>
                                <div style={{ ...s.statIconBox, background: `${stat.color}18`, color: stat.color }}>{stat.icon}</div>
                            </div>
                            <div style={{ ...s.statValue, color: stat.color }}>{stat.value}</div>
                            <div style={s.statDelta}>{stat.delta}</div>
                        </div>
                    ))
                }
            </div>

            {/* Recent uploads */}
            <div style={s.section}>
                <div style={s.sectionHeader}>
                    <h2 style={s.sectionTitle}>Recent Uploads</h2>
                    <button style={s.viewAllBtn} onClick={() => navigate('/papers')}>
                        View all
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none"><path d="M9 18l6-6-6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
                    </button>
                </div>
                <div style={s.table}>
                    <div style={s.tableHeader}>
                        <div style={{ ...s.th, flex: 3 }}>Paper</div>
                        <div style={{ ...s.th, flex: 1 }}>Risk</div>
                        <div style={{ ...s.th, flex: 1 }}>Plagiarism</div>
                        <div style={{ ...s.th, flex: 1 }}>Status</div>
                        <div style={{ ...s.th, flex: 1 }}>Uploaded</div>
                        <div style={{ ...s.th, flex: 0.5 }}></div>
                    </div>

                    {loading && [1, 2, 3, 4, 5].map(i => (
                        <div key={i} style={{ ...s.tableRow, height: 52 }}>
                            <div style={{ ...s.skeletonRow, flex: 1 }} />
                        </div>
                    ))}

                    {!loading && papers.length === 0 && (
                        <div style={s.emptyRow}>
                            <svg width="36" height="36" viewBox="0 0 24 24" fill="none">
                                <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" stroke={colors.text.muted} strokeWidth="1.5" />
                                <polyline points="14 2 14 8 20 8" stroke={colors.text.muted} strokeWidth="1.5" />
                                <line x1="16" y1="13" x2="8" y2="13" stroke={colors.text.muted} strokeWidth="1.5" strokeLinecap="round" />
                                <line x1="16" y1="17" x2="8" y2="17" stroke={colors.text.muted} strokeWidth="1.5" strokeLinecap="round" />
                            </svg>
                            <div style={s.emptyText}>No papers yet.</div>
                            <button style={s.emptyBtn} onClick={() => navigate('/upload')}>Upload your first paper</button>
                        </div>
                    )}

                    {!loading && papers.map((p, i) => {
                        const pct = p.plagiarism_score !== null ? Math.round(p.plagiarism_score * 100) : null;
                        return (
                            <div key={p.uuid} style={{ ...s.tableRow, ...(i % 2 !== 0 ? s.tableRowAlt : {}) }}>
                                <div style={{ ...s.td, flex: 3 }}>
                                    <div style={s.paperIcon}>
                                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
                                            <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" stroke={colors.brand.primary} strokeWidth="1.8" />
                                            <polyline points="14 2 14 8 20 8" stroke={colors.brand.primary} strokeWidth="1.8" />
                                        </svg>
                                    </div>
                                    <span style={s.paperTitle}>{p.filename.replace(/^\d+-/, '')}</span>
                                </div>
                                <div style={{ ...s.td, flex: 1 }}>
                                    {p.risk_level
                                        ? <span style={{ ...s.badge, background: riskBg[p.risk_level], color: riskColor[p.risk_level] }}>{p.risk_level.toUpperCase()}</span>
                                        : <span style={s.dash}>—</span>}
                                </div>
                                <div style={{ ...s.td, flex: 1 }}>
                                    {pct !== null ? (
                                        <div style={s.scoreCell}>
                                            <div style={s.miniBar}>
                                                <div style={{ ...s.miniBarFill, width: `${pct}%`, background: pct > 60 ? colors.status.high : pct > 30 ? colors.status.medium : colors.status.low }} />
                                            </div>
                                            <span style={{ fontSize: 13, color: colors.text.secondary }}>{pct}%</span>
                                        </div>
                                    ) : <span style={s.dash}>—</span>}
                                </div>
                                <div style={{ ...s.td, flex: 1 }}>
                                    <span style={{ ...s.statusDot, background: p.status === 'completed' ? colors.status.low : p.status === 'failed' ? colors.status.high : colors.status.medium }} />
                                    <span style={{ fontSize: 13, color: colors.text.secondary, textTransform: 'capitalize' }}>{p.status}</span>
                                </div>
                                <div style={{ ...s.td, flex: 1, color: colors.text.muted, fontSize: 13 }}>{timeAgo(p.uploaded_at)}</div>
                                <div style={{ ...s.td, flex: 0.5 }}>
                                    <button style={s.viewBtn} onClick={() => navigate(`/report/${p.uuid}`)}>View</button>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Quick actions */}
            <div style={s.section}>
                <h2 style={s.sectionTitle}>Quick Actions</h2>
                <div style={s.actionsGrid}>
                    {[
                        {
                            icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M17 8l-5-5-5 5M12 3v12" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>,
                            title: 'Upload Paper', desc: 'Analyze a new research paper for fraud indicators', action: () => navigate('/upload'), primary: true,
                        },
                        {
                            icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" stroke="currentColor" strokeWidth="1.8" /><polyline points="14 2 14 8 20 8" stroke="currentColor" strokeWidth="1.8" /><line x1="16" y1="13" x2="8" y2="13" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /><line x1="16" y1="17" x2="8" y2="17" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /></svg>,
                            title: 'My Papers', desc: 'Browse and manage all your analyzed research papers', action: () => navigate('/papers'), primary: false,
                        },
                        {
                            icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>,
                            title: 'AI Assistant', desc: 'Chat with the AI about any of your analyzed papers', action: () => papers.length > 0 ? navigate(`/report/${papers[0].uuid}`) : navigate('/upload'), primary: false,
                        },
                    ].map(a => (
                        <div key={a.title} style={{ ...s.actionCard, ...(a.primary ? s.actionCardPrimary : {}) }} onClick={a.action}>
                            <div style={{ ...s.actionIcon, color: a.primary ? colors.brand.primary : colors.text.muted }}>{a.icon}</div>
                            <div style={s.actionTitle}>{a.title}</div>
                            <div style={s.actionDesc}>{a.desc}</div>
                            <div style={{ ...s.actionArrow, color: a.primary ? colors.brand.primary : colors.text.muted }}>→</div>
                        </div>
                    ))}
                </div>
            </div>

        </div>
    );
}

const s: Record<string, React.CSSProperties> = {
    page: { padding: '32px 36px', maxWidth: 1200, width: '100%' },
    header: { display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 32 },
    title: { fontSize: 26, fontWeight: 800, color: colors.text.primary, letterSpacing: '-0.5px', marginBottom: 6 },
    subtitle: { fontSize: 14, color: colors.text.secondary },
    newBtn: { display: 'flex', alignItems: 'center', gap: 8, background: colors.brand.gradient, border: 'none', borderRadius: radius.md, color: '#fff', padding: '10px 18px', fontSize: 14, fontWeight: 600, cursor: 'pointer' },
    statsGrid: { display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 32 },
    statCard: { background: colors.bg.surface, border: `1px solid ${colors.bg.border}`, borderRadius: radius.lg, padding: '20px 22px' },
    skeleton: { height: 110, animation: 'pulse 1.5s ease-in-out infinite' },
    statTop: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 },
    statLabel: { fontSize: 13, color: colors.text.secondary, fontWeight: 500 },
    statIconBox: { width: 36, height: 36, borderRadius: radius.md, display: 'flex', alignItems: 'center', justifyContent: 'center' },
    statValue: { fontSize: 30, fontWeight: 800, letterSpacing: '-1px', marginBottom: 4 },
    statDelta: { fontSize: 12, color: colors.text.muted },
    section: { marginBottom: 32 },
    sectionHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
    sectionTitle: { fontSize: 17, fontWeight: 700, color: colors.text.primary, letterSpacing: '-0.3px', marginBottom: 16 },
    viewAllBtn: { display: 'flex', alignItems: 'center', gap: 4, background: 'none', border: 'none', color: colors.brand.primary, fontSize: 13, cursor: 'pointer', fontWeight: 500, marginBottom: 16 },
    table: { background: colors.bg.surface, border: `1px solid ${colors.bg.border}`, borderRadius: radius.lg, overflow: 'hidden' },
    tableHeader: { display: 'flex', padding: '12px 20px', borderBottom: `1px solid ${colors.bg.border}`, background: colors.bg.elevated },
    th: { fontSize: 11, fontWeight: 700, color: colors.text.muted, textTransform: 'uppercase', letterSpacing: 0.8 },
    tableRow: { display: 'flex', alignItems: 'center', padding: '14px 20px', borderBottom: `1px solid ${colors.bg.border}` },
    tableRowAlt: { background: 'rgba(255,255,255,0.01)' },
    td: { display: 'flex', alignItems: 'center', gap: 8 },
    paperIcon: { width: 28, height: 28, background: colors.brand.primaryGlow, borderRadius: radius.sm, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
    paperTitle: { fontSize: 13, color: colors.text.primary, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
    badge: { fontSize: 11, fontWeight: 700, padding: '3px 8px', borderRadius: radius.full, letterSpacing: 0.5 },
    dash: { color: colors.text.muted, fontSize: 13 },
    scoreCell: { display: 'flex', alignItems: 'center', gap: 8 },
    miniBar: { width: 60, height: 5, background: colors.bg.border, borderRadius: 3, overflow: 'hidden' },
    miniBarFill: { height: '100%', borderRadius: 3 },
    statusDot: { width: 7, height: 7, borderRadius: '50%', flexShrink: 0 },
    viewBtn: { background: colors.bg.elevated, border: `1px solid ${colors.bg.border}`, borderRadius: radius.sm, color: colors.text.secondary, padding: '4px 10px', fontSize: 12, cursor: 'pointer', fontWeight: 500 },
    skeletonRow: { height: 16, background: colors.bg.elevated, borderRadius: 4, animation: 'pulse 1.5s ease-in-out infinite' },
    emptyRow: { display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '48px 24px', gap: 12 },
    emptyText: { fontSize: 15, color: colors.text.muted },
    emptyBtn: { background: colors.brand.gradient, border: 'none', borderRadius: radius.md, color: '#fff', padding: '10px 20px', fontSize: 14, fontWeight: 600, cursor: 'pointer' },
    actionsGrid: { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 },
    actionCard: { background: colors.bg.surface, border: `1px solid ${colors.bg.border}`, borderRadius: radius.lg, padding: '24px', cursor: 'pointer' },
    actionCardPrimary: { border: `1px solid ${colors.brand.primary}30`, background: colors.brand.primaryGlow },
    actionIcon: { display: 'flex', alignItems: 'center', marginBottom: 14 },
    actionTitle: { fontSize: 15, fontWeight: 700, color: colors.text.primary, marginBottom: 6 },
    actionDesc: { fontSize: 13, color: colors.text.secondary, lineHeight: 1.6, marginBottom: 16 },
    actionArrow: { fontSize: 18, fontWeight: 700 },
};
