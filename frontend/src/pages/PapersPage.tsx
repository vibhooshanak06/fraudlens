import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { getAllPapers, PaperMeta } from '../api';
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

const PAGE_SIZE = 10;

export default function PapersPage() {
    const navigate = useNavigate();
    const [papers, setPapers] = useState<PaperMeta[]>([]);
    const [total, setTotal] = useState(0);
    const [page, setPage] = useState(1);
    const [loading, setLoading] = useState(true);

    const load = useCallback(async (p: number) => {
        setLoading(true);
        try {
            const res = await getAllPapers(p, PAGE_SIZE);
            setPapers(res.papers);
            setTotal(res.total);
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { load(page); }, [page, load]);

    const totalPages = Math.ceil(total / PAGE_SIZE);

    return (
        <div style={s.page}>
            <div style={s.header}>
                <div>
                    <h1 style={s.title}>My Papers</h1>
                    <p style={s.subtitle}>{total > 0 ? `${total} paper${total !== 1 ? 's' : ''} analyzed` : 'No papers yet'}</p>
                </div>
                <button style={s.newBtn} onClick={() => navigate('/upload')}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                        <path d="M12 5v14M5 12h14" stroke="white" strokeWidth="2.5" strokeLinecap="round" />
                    </svg>
                    New Analysis
                </button>
            </div>

            <div style={s.table}>
                <div style={s.tableHeader}>
                    <div style={{ ...s.th, flex: 3 }}>Paper</div>
                    <div style={{ ...s.th, flex: 1 }}>Risk Level</div>
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
                    <div style={s.emptyState}>
                        <svg width="44" height="44" viewBox="0 0 24 24" fill="none">
                            <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" stroke={colors.text.muted} strokeWidth="1.5" />
                            <polyline points="14 2 14 8 20 8" stroke={colors.text.muted} strokeWidth="1.5" />
                            <line x1="16" y1="13" x2="8" y2="13" stroke={colors.text.muted} strokeWidth="1.5" strokeLinecap="round" />
                            <line x1="16" y1="17" x2="8" y2="17" stroke={colors.text.muted} strokeWidth="1.5" strokeLinecap="round" />
                        </svg>
                        <div style={s.emptyText}>No papers analyzed yet.</div>
                        <button style={s.emptyBtn} onClick={() => navigate('/upload')}>Upload your first paper</button>
                    </div>
                )}

                {!loading && papers.map((p, i) => {
                    const pct = p.plagiarism_score !== null ? Math.round(p.plagiarism_score * 100) : null;
                    return (
                        <div key={p.uuid} style={{ ...s.tableRow, ...(i % 2 !== 0 ? s.tableRowAlt : {}) }}>
                            <div style={{ ...s.td, flex: 3 }}>
                                <div style={s.paperIcon}>
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
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

            {totalPages > 1 && (
                <div style={s.pagination}>
                    <button style={{ ...s.pageBtn, ...(page === 1 ? s.pageBtnDisabled : {}) }} onClick={() => setPage(p => p - 1)} disabled={page === 1}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M15 18l-6-6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
                        Prev
                    </button>
                    <span style={s.pageInfo}>Page {page} of {totalPages}</span>
                    <button style={{ ...s.pageBtn, ...(page === totalPages ? s.pageBtnDisabled : {}) }} onClick={() => setPage(p => p + 1)} disabled={page === totalPages}>
                        Next
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M9 18l6-6-6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
                    </button>
                </div>
            )}
        </div>
    );
}

const s: Record<string, React.CSSProperties> = {
    page: { padding: '32px 36px', maxWidth: 1200, width: '100%' },
    header: { display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 28 },
    title: { fontSize: 26, fontWeight: 800, color: colors.text.primary, letterSpacing: '-0.5px', marginBottom: 4 },
    subtitle: { fontSize: 14, color: colors.text.secondary },
    newBtn: { display: 'flex', alignItems: 'center', gap: 8, background: colors.brand.gradient, border: 'none', borderRadius: radius.md, color: '#fff', padding: '10px 18px', fontSize: 14, fontWeight: 600, cursor: 'pointer' },
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
    emptyState: { display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '64px 24px', gap: 14 },
    emptyText: { fontSize: 15, color: colors.text.muted },
    emptyBtn: { background: colors.brand.gradient, border: 'none', borderRadius: radius.md, color: '#fff', padding: '10px 20px', fontSize: 14, fontWeight: 600, cursor: 'pointer' },
    pagination: { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 16, marginTop: 24 },
    pageBtn: { display: 'flex', alignItems: 'center', gap: 6, background: colors.bg.surface, border: `1px solid ${colors.bg.border}`, borderRadius: radius.md, color: colors.text.secondary, padding: '8px 14px', fontSize: 13, fontWeight: 500, cursor: 'pointer' },
    pageBtnDisabled: { opacity: 0.4, cursor: 'not-allowed' },
    pageInfo: { fontSize: 13, color: colors.text.muted },
};
