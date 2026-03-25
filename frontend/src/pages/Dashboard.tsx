import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getPaper, PaperRecord } from '../api';
import FraudReportPanel from '../components/FraudReportPanel';
import SummaryPanel from '../components/SummaryPanel';
import ChatPanel from '../components/ChatPanel';
import RecommendPanel from '../components/RecommendPanel';
import { colors, radius } from '../styles/tokens';

type Tab = 'report' | 'chat' | 'recommendations';

export default function Dashboard() {
    const { uuid } = useParams<{ uuid: string }>();
    const navigate = useNavigate();
    const [paper, setPaper] = useState<PaperRecord | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [tab, setTab] = useState<Tab>('report');
    const [polling, setPolling] = useState(false);

    useEffect(() => {
        if (!uuid) { navigate('/upload'); return; }
        loadPaper();
    }, [uuid]);

    async function loadPaper() {
        setLoading(true);
        setError(null);
        try {
            const data = await getPaper(uuid!);
            setPaper(data);
            if (data.status === 'processing') setPolling(true);
        } catch (err: any) {
            setError(err?.response?.status === 404 ? 'Paper not found.' : 'Failed to load analysis.');
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => {
        if (!polling || !uuid) return;
        const interval = setInterval(async () => {
            try {
                const data = await getPaper(uuid);
                setPaper(data);
                if (data.status !== 'processing') { setPolling(false); clearInterval(interval); }
            } catch { /* ignore */ }
        }, 3000);
        return () => clearInterval(interval);
    }, [polling, uuid]);

    const tabs: { id: Tab; label: string; icon: string }[] = [
        { id: 'report', label: 'Fraud Report', icon: '📊' },
        { id: 'chat', label: 'AI Assistant', icon: '💬' },
        { id: 'recommendations', label: 'Related Papers', icon: '📚' },
    ];

    const riskColor = paper?.fraud_report?.risk_level
        ? { low: colors.status.low, medium: colors.status.medium, high: colors.status.high }[paper.fraud_report.risk_level]
        : colors.text.muted;

    return (
        <div style={s.page}>
            {/* Top bar */}
            <div style={s.topBar}>
                <button style={s.backBtn} onClick={() => navigate('/upload')}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                        <path d="M19 12H5M12 19l-7-7 7-7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                    New Analysis
                </button>

                {paper && (
                    <div style={s.paperMeta}>
                        <div style={s.paperMetaIcon}>
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                                <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" stroke={colors.brand.primary} strokeWidth="1.8" />
                                <polyline points="14 2 14 8 20 8" stroke={colors.brand.primary} strokeWidth="1.8" />
                            </svg>
                        </div>
                        <div>
                            <div style={s.paperName}>{paper.filename}</div>
                            <div style={s.paperDate}>Uploaded {new Date(paper.uploaded_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</div>
                        </div>
                    </div>
                )}

                {paper?.fraud_report && (
                    <div style={s.riskSummary}>
                        <div style={{ ...s.riskBadge, background: `${riskColor}18`, color: riskColor, border: `1px solid ${riskColor}30` }}>
                            {paper.fraud_report.risk_level.toUpperCase()} RISK
                        </div>
                        <div style={s.scoreChip}>
                            {Math.round(paper.fraud_report.plagiarism_score * 100)}% plagiarism
                        </div>
                    </div>
                )}
            </div>

            {/* Loading */}
            {loading && (
                <div style={s.loadingState}>
                    <div style={s.loadingSpinner} />
                    <div style={s.loadingText}>Loading analysis…</div>
                </div>
            )}

            {/* Error */}
            {error && (
                <div style={s.errorState}>
                    <div style={s.errorIcon}>⚠️</div>
                    <div style={s.errorText}>{error}</div>
                    <button style={s.retryBtn} onClick={loadPaper}>Retry</button>
                </div>
            )}

            {/* Processing banner */}
            {paper?.status === 'processing' && (
                <div style={s.processingBanner}>
                    <div style={s.processingDot} />
                    <div>
                        <div style={s.processingTitle}>Analysis in progress</div>
                        <div style={s.processingSub}>AI is processing your paper. Results will appear automatically in 30–60 seconds.</div>
                    </div>
                </div>
            )}

            {paper && !loading && (
                <>
                    {/* Tabs */}
                    <div style={s.tabBar}>
                        {tabs.map(t => (
                            <button
                                key={t.id}
                                style={{ ...s.tabBtn, ...(tab === t.id ? s.tabBtnActive : {}) }}
                                onClick={() => setTab(t.id)}
                            >
                                <span>{t.icon}</span>
                                <span>{t.label}</span>
                                {tab === t.id && <div style={s.tabIndicator} />}
                            </button>
                        ))}
                    </div>

                    {/* Content */}
                    <div style={s.content}>
                        {tab === 'report' && (
                            <div style={s.reportLayout}>
                                <div style={s.reportMain}>
                                    {paper.fraud_report
                                        ? <FraudReportPanel report={paper.fraud_report} />
                                        : <EmptyState icon="📊" title="Report not ready" desc="The fraud analysis is still processing. Please wait." />
                                    }
                                </div>
                                <div style={s.reportSide}>
                                    {paper.summary
                                        ? <SummaryPanel summary={paper.summary} />
                                        : <EmptyState icon="📝" title="Summary pending" desc="Summary will appear once analysis completes." />
                                    }
                                </div>
                            </div>
                        )}
                        {tab === 'chat' && (
                            <div style={s.chatLayout}>
                                <ChatPanel uuid={uuid!} />
                            </div>
                        )}
                        {tab === 'recommendations' && (
                            <div style={s.recsLayout}>
                                <RecommendPanel keywords={paper.keywords} />
                            </div>
                        )}
                    </div>
                </>
            )}
        </div>
    );
}

function EmptyState({ icon, title, desc }: { icon: string; title: string; desc: string }) {
    return (
        <div style={{ textAlign: 'center', padding: '48px 24px', color: colors.text.muted }}>
            <div style={{ fontSize: 36, marginBottom: 12 }}>{icon}</div>
            <div style={{ fontSize: 15, fontWeight: 600, color: colors.text.secondary, marginBottom: 6 }}>{title}</div>
            <div style={{ fontSize: 13 }}>{desc}</div>
        </div>
    );
}

const s: Record<string, React.CSSProperties> = {
    page: { display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' },
    topBar: {
        display: 'flex', alignItems: 'center', gap: 20, padding: '16px 28px',
        borderBottom: `1px solid ${colors.bg.border}`, background: colors.bg.surface, flexShrink: 0,
    },
    backBtn: {
        display: 'flex', alignItems: 'center', gap: 6,
        background: colors.bg.elevated, border: `1px solid ${colors.bg.border}`,
        borderRadius: radius.md, color: colors.text.secondary, padding: '7px 14px',
        fontSize: 13, cursor: 'pointer', fontWeight: 500, flexShrink: 0,
    },
    paperMeta: { display: 'flex', alignItems: 'center', gap: 10, flex: 1, minWidth: 0 },
    paperMetaIcon: {
        width: 32, height: 32, background: colors.brand.primaryGlow, borderRadius: radius.sm,
        display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
    },
    paperName: { fontSize: 14, fontWeight: 600, color: colors.text.primary, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
    paperDate: { fontSize: 12, color: colors.text.muted, marginTop: 1 },
    riskSummary: { display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 },
    riskBadge: { fontSize: 11, fontWeight: 700, padding: '4px 10px', borderRadius: radius.full, letterSpacing: 0.5 },
    scoreChip: { fontSize: 12, color: colors.text.secondary, background: colors.bg.elevated, border: `1px solid ${colors.bg.border}`, padding: '4px 10px', borderRadius: radius.full },
    loadingState: { flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16 },
    loadingSpinner: {
        width: 36, height: 36, border: `3px solid ${colors.bg.border}`,
        borderTopColor: colors.brand.primary, borderRadius: '50%',
        animation: 'spin 0.8s linear infinite',
    },
    loadingText: { fontSize: 14, color: colors.text.muted },
    errorState: { flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12 },
    errorIcon: { fontSize: 40 },
    errorText: { fontSize: 15, color: colors.text.secondary },
    retryBtn: {
        background: colors.brand.gradient, border: 'none', borderRadius: radius.md,
        color: '#fff', padding: '9px 20px', fontSize: 14, cursor: 'pointer', fontWeight: 600,
    },
    processingBanner: {
        display: 'flex', alignItems: 'center', gap: 14,
        margin: '16px 28px 0', background: 'rgba(245,158,11,0.06)',
        border: '1px solid rgba(245,158,11,0.2)', borderRadius: radius.lg, padding: '14px 18px',
    },
    processingDot: {
        width: 10, height: 10, borderRadius: '50%', background: colors.status.medium,
        flexShrink: 0, animation: 'pulse 1.5s ease-in-out infinite',
    },
    processingTitle: { fontSize: 14, fontWeight: 600, color: colors.status.medium, marginBottom: 2 },
    processingSub: { fontSize: 13, color: colors.text.secondary },
    tabBar: {
        display: 'flex', gap: 2, padding: '0 28px',
        borderBottom: `1px solid ${colors.bg.border}`, background: colors.bg.surface, flexShrink: 0,
    },
    tabBtn: {
        display: 'flex', alignItems: 'center', gap: 8,
        padding: '14px 18px', border: 'none', background: 'transparent',
        color: colors.text.muted, fontSize: 14, fontWeight: 500, cursor: 'pointer',
        position: 'relative', transition: 'color 0.15s',
    },
    tabBtnActive: { color: colors.text.primary },
    tabIndicator: {
        position: 'absolute', bottom: 0, left: 0, right: 0, height: 2,
        background: colors.brand.gradient, borderRadius: '2px 2px 0 0',
    },
    content: { flex: 1, overflow: 'auto', padding: '24px 28px' },
    reportLayout: { display: 'grid', gridTemplateColumns: '1fr 360px', gap: 24, alignItems: 'start' },
    reportMain: {},
    reportSide: {},
    chatLayout: { maxWidth: 800, height: 'calc(100vh - 220px)' },
    recsLayout: { maxWidth: 900 },
};
