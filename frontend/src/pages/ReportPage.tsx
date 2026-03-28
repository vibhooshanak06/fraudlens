import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getPaper, reprocessPaper, exportReportPdf, PaperRecord } from '../api';
import FraudReportPanel from '../components/FraudReportPanel';
import SummaryPanel from '../components/SummaryPanel';
import ChatPanel from '../components/ChatPanel';
import RecommendPanel from '../components/RecommendPanel';
import CitationGraphPanel from '../components/CitationGraphPanel';
import { colors, radius } from '../styles/tokens';

type Tab = 'report' | 'citations' | 'chat' | 'recommendations';

export default function Dashboard() {
    const { uuid } = useParams<{ uuid: string }>();
    const navigate = useNavigate();
    const [paper, setPaper] = useState<PaperRecord | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [tab, setTab] = useState<Tab>('report');
    const [retrying, setRetrying] = useState(false);
    const [exporting, setExporting] = useState(false);

    // Single interval ref — only one poll loop ever runs
    const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

    const stopPolling = useCallback(() => {
        if (intervalRef.current) {
            clearInterval(intervalRef.current);
            intervalRef.current = null;
        }
    }, []);

    const startPolling = useCallback((currentUuid: string) => {
        stopPolling(); // clear any existing before starting
        intervalRef.current = setInterval(async () => {
            try {
                const data = await getPaper(currentUuid);
                setPaper(data);
                if (data.status !== 'processing') stopPolling();
            } catch { /* ignore poll errors */ }
        }, 3000);
    }, [stopPolling]);

    // Cleanup on unmount
    useEffect(() => () => stopPolling(), [stopPolling]);

    const loadPaper = useCallback(async (currentUuid: string) => {
        setLoading(true);
        setError(null);
        try {
            const data = await getPaper(currentUuid);
            setPaper(data);
            if (data.status === 'processing') {
                startPolling(currentUuid);
            } else {
                stopPolling();
            }
        } catch (err: any) {
            setError(err?.response?.status === 404 ? 'Paper not found.' : 'Failed to load analysis.');
        } finally {
            setLoading(false);
        }
    }, [startPolling, stopPolling]);

    useEffect(() => {
        if (!uuid) { navigate('/upload'); return; }
        loadPaper(uuid);
    }, [uuid]); // eslint-disable-line react-hooks/exhaustive-deps

    async function handleRetry() {
        if (!uuid || retrying) return;
        setRetrying(true);
        setError(null);
        try {
            await reprocessPaper(uuid);
            await loadPaper(uuid);
        } catch {
            setError('Failed to start reprocessing.');
        } finally {
            setRetrying(false);
        }
    }

    async function handleExport() {
        if (!uuid || exporting) return;
        setExporting(true);
        try {
            await exportReportPdf(uuid);
        } catch {
            // silently fail — browser will show nothing
        } finally {
            setExporting(false);
        }
    }

    const tabs: { id: Tab; label: string; icon: React.ReactNode }[] = [
        {
            id: 'report', label: 'Fraud Report', icon: (
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
                    <rect x="3" y="3" width="18" height="18" rx="2" stroke="currentColor" strokeWidth="1.8" />
                    <path d="M8 17v-4M12 17v-7M16 17v-2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                </svg>
            )
        },
        {
            id: 'citations', label: 'Citation Graph', icon: (
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
                    <circle cx="5" cy="12" r="2" stroke="currentColor" strokeWidth="1.8" />
                    <circle cx="19" cy="5" r="2" stroke="currentColor" strokeWidth="1.8" />
                    <circle cx="19" cy="19" r="2" stroke="currentColor" strokeWidth="1.8" />
                    <line x1="7" y1="11" x2="17" y2="6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                    <line x1="7" y1="13" x2="17" y2="18" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
            )
        },
        {
            id: 'chat', label: 'AI Assistant', icon: (
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
                    <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
            )
        },
        {
            id: 'recommendations', label: 'Related Papers', icon: (
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
                    <path d="M4 19.5A2.5 2.5 0 016.5 17H20" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                    <path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                </svg>
            )
        },
    ];

    const riskColor = paper?.fraud_report?.risk_level
        ? { low: colors.status.low, medium: colors.status.medium, high: colors.status.high }[paper.fraud_report.risk_level]
        : colors.text.muted;

    const needsRetry = paper?.status === 'failed' || (paper?.status === 'completed' && !paper?.fraud_report);

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
                        <button style={s.exportBtn} onClick={handleExport} disabled={exporting}>
                            {exporting ? (
                                <div style={s.exportSpinner} />
                            ) : (
                                <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
                                    <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                                </svg>
                            )}
                            {exporting ? 'Exporting…' : 'Export PDF'}
                        </button>
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
            {!loading && error && (
                <div style={s.errorState}>
                    <div style={s.errorIcon}>
                        <svg width="40" height="40" viewBox="0 0 24 24" fill="none">
                            <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" stroke={colors.status.high} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                            <line x1="12" y1="9" x2="12" y2="13" stroke={colors.status.high} strokeWidth="1.8" strokeLinecap="round" />
                            <circle cx="12" cy="17" r="1" fill={colors.status.high} />
                        </svg>
                    </div>
                    <div style={s.errorText}>{error}</div>
                    <button style={s.actionBtn} onClick={() => uuid && loadPaper(uuid)}>Retry</button>
                </div>
            )}

            {!loading && paper && (
                <>
                    {/* Processing banner */}
                    {paper.status === 'processing' && (
                        <div style={s.processingBanner}>
                            <div style={s.processingDot} />
                            <div>
                                <div style={s.processingTitle}>Analysis in progress</div>
                                <div style={s.processingSub}>Results will appear automatically in 30–60 seconds.</div>
                            </div>
                        </div>
                    )}

                    {/* Failed / incomplete banner */}
                    {needsRetry && (
                        <div style={s.failedBanner}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 28, height: 28, flexShrink: 0 }}>
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                                    <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" stroke={colors.status.high} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                                    <line x1="12" y1="9" x2="12" y2="13" stroke={colors.status.high} strokeWidth="1.8" strokeLinecap="round" />
                                    <circle cx="12" cy="17" r="1" fill={colors.status.high} />
                                </svg>
                            </div>
                            <div style={{ flex: 1 }}>
                                <div style={s.failedTitle}>
                                    {paper.status === 'failed' ? 'Analysis failed' : 'Analysis data incomplete'}
                                </div>
                                <div style={s.failedSub}>
                                    {paper.status === 'failed'
                                        ? 'The AI engine was unavailable when this paper was processed.'
                                        : 'The database was unavailable during processing. Reprocess to recover the report.'}
                                </div>
                            </div>
                            <button style={s.actionBtn} onClick={handleRetry} disabled={retrying}>
                                {retrying ? 'Retrying…' : 'Retry Analysis'}
                            </button>
                        </div>
                    )}

                    {/* Tabs */}
                    <div style={s.tabBar}>
                        {tabs.map(t => (
                            <button
                                key={t.id}
                                style={{ ...s.tabBtn, ...(tab === t.id ? s.tabBtnActive : {}) }}
                                onClick={() => setTab(t.id)}
                            >
                                {t.icon}
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
                                        : <EmptyState
                                            icon={<svg width="36" height="36" viewBox="0 0 24 24" fill="none"><rect x="3" y="3" width="18" height="18" rx="2" stroke={colors.text.muted} strokeWidth="1.5" /><path d="M8 17v-4M12 17v-7M16 17v-2" stroke={colors.text.muted} strokeWidth="1.5" strokeLinecap="round" /></svg>}
                                            title={paper.status === 'completed' ? 'Report data missing' : 'Report not ready'}
                                            desc={paper.status === 'completed' ? 'Click Retry Analysis above to regenerate.' : 'The fraud analysis is still processing. Please wait.'}
                                        />
                                    }
                                </div>
                                <div style={s.reportSide}>
                                    {paper.summary
                                        ? <SummaryPanel summary={paper.summary} keywords={paper.keywords} />
                                        : <EmptyState
                                            icon={<svg width="36" height="36" viewBox="0 0 24 24" fill="none"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" stroke={colors.text.muted} strokeWidth="1.5" /><polyline points="14 2 14 8 20 8" stroke={colors.text.muted} strokeWidth="1.5" /><line x1="16" y1="13" x2="8" y2="13" stroke={colors.text.muted} strokeWidth="1.5" strokeLinecap="round" /><line x1="16" y1="17" x2="8" y2="17" stroke={colors.text.muted} strokeWidth="1.5" strokeLinecap="round" /></svg>}
                                            title={paper.status === 'completed' ? 'Summary data missing' : 'Summary pending'}
                                            desc={paper.status === 'completed' ? 'Click Retry Analysis to regenerate.' : 'Summary will appear once analysis completes.'}
                                        />
                                    }
                                </div>
                            </div>
                        )}
                        {tab === 'citations' && (
                            <div style={s.citationsLayout}>
                                <CitationGraphPanel uuid={uuid!} />
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

function EmptyState({ icon, title, desc }: { icon: React.ReactNode; title: string; desc: string }) {
    return (
        <div style={{ textAlign: 'center', padding: '48px 24px', color: colors.text.muted }}>
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 12 }}>{icon}</div>
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
    errorIcon: { display: 'flex', alignItems: 'center', justifyContent: 'center' },
    errorText: { fontSize: 15, color: colors.text.secondary },
    actionBtn: {
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
    failedBanner: {
        display: 'flex', alignItems: 'center', gap: 14,
        margin: '16px 28px 0', background: 'rgba(239,68,68,0.06)',
        border: '1px solid rgba(239,68,68,0.2)', borderRadius: radius.lg, padding: '14px 18px',
    },
    failedTitle: { fontSize: 14, fontWeight: 600, color: colors.status.high, marginBottom: 2 },
    failedSub: { fontSize: 13, color: colors.text.secondary },
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
    citationsLayout: { width: '100%' },
    recsLayout: { maxWidth: 900 },
    exportBtn: {
        display: 'flex', alignItems: 'center', gap: 6,
        background: colors.bg.elevated, border: `1px solid ${colors.bg.border}`,
        borderRadius: radius.md, color: colors.text.secondary, padding: '6px 12px',
        fontSize: 12, fontWeight: 600, cursor: 'pointer',
    },
    exportSpinner: {
        width: 12, height: 12, border: `2px solid ${colors.bg.border}`,
        borderTopColor: colors.brand.primary, borderRadius: '50%',
        animation: 'spin 0.7s linear infinite',
    },
};
