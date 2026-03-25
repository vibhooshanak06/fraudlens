import React from 'react';
import { FraudReport } from '../api';
import { colors, radius } from '../styles/tokens';

interface Props { report: FraudReport; }

const riskConfig = {
    low: { color: colors.status.low, bg: colors.status.lowBg, border: `${colors.status.low}30`, label: 'Low Risk', icon: '✓' },
    medium: { color: colors.status.medium, bg: colors.status.mediumBg, border: `${colors.status.medium}30`, label: 'Medium Risk', icon: '!' },
    high: { color: colors.status.high, bg: colors.status.highBg, border: `${colors.status.high}30`, label: 'High Risk', icon: '✕' },
};

const issueTypeConfig: Record<string, { label: string; color: string }> = {
    plagiarism: { label: 'Plagiarism', color: colors.status.high },
    repeated_sentence: { label: 'Repeated Sentence', color: colors.status.medium },
    overused_keyword: { label: 'Overused Keyword', color: '#a78bfa' },
    citation_format: { label: 'Citation Format', color: colors.brand.primary },
    citation_inconsistency: { label: 'Citation Inconsistency', color: colors.brand.primary },
    unusual_structure: { label: 'Unusual Structure', color: colors.text.secondary },
};

export default function FraudReportPanel({ report }: Props) {
    const pct = Math.round(report.plagiarism_score * 100);
    const cfg = riskConfig[report.risk_level];

    return (
        <div style={s.container}>
            {/* Score header */}
            <div style={s.scoreCard}>
                <div style={s.scoreLeft}>
                    <div style={s.scoreLabel}>Plagiarism Score</div>
                    <div style={{ ...s.scoreValue, color: cfg.color }}>{pct}%</div>
                    <div style={s.scoreTrack}>
                        <div style={{ ...s.scoreFill, width: `${pct}%`, background: cfg.color }} />
                        <div style={{ ...s.scoreMarker, left: '30%' }} title="Low/Medium threshold" />
                        <div style={{ ...s.scoreMarker, left: '60%' }} title="Medium/High threshold" />
                    </div>
                    <div style={s.scoreScale}>
                        <span>0%</span><span style={{ color: colors.status.low }}>Low</span>
                        <span style={{ color: colors.status.medium }}>Medium</span>
                        <span style={{ color: colors.status.high }}>High</span><span>100%</span>
                    </div>
                </div>
                <div style={{ ...s.riskBadge, background: cfg.bg, border: `1px solid ${cfg.border}`, color: cfg.color }}>
                    <div style={{ ...s.riskIcon, background: cfg.color }}>{cfg.icon}</div>
                    <div>
                        <div style={s.riskLabel}>{cfg.label}</div>
                        <div style={s.riskSub}>{report.issues.length} issue{report.issues.length !== 1 ? 's' : ''} detected</div>
                    </div>
                </div>
            </div>

            {/* Issues */}
            <div style={s.section}>
                <div style={s.sectionHeader}>
                    <div style={s.sectionTitle}>Detected Issues</div>
                    <div style={s.issueCount}>{report.issues.length}</div>
                </div>

                {report.issues.length === 0 ? (
                    <div style={s.cleanState}>
                        <div style={s.cleanIcon}>✓</div>
                        <div style={s.cleanTitle}>No issues detected</div>
                        <div style={s.cleanSub}>This paper passed all fraud detection checks.</div>
                    </div>
                ) : (
                    <div style={s.issueList}>
                        {report.issues.map((issue, i) => {
                            const typeCfg = issueTypeConfig[issue.type] ?? { label: issue.type, color: colors.text.muted };
                            return (
                                <div key={i} style={s.issueCard}>
                                    <div style={s.issueHeader}>
                                        <span style={{ ...s.issueTypeBadge, background: `${typeCfg.color}15`, color: typeCfg.color, border: `1px solid ${typeCfg.color}25` }}>
                                            {typeCfg.label}
                                        </span>
                                    </div>
                                    <div style={s.issueDesc}>{issue.description}</div>
                                    {issue.excerpt && (
                                        <div style={s.issueExcerpt}>
                                            <div style={s.excerptBar} />
                                            <div style={s.excerptText}>"{issue.excerpt}"</div>
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            {report.errors && report.errors.length > 0 && (
                <div style={s.warningBox}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0 }}>
                        <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" stroke={colors.status.medium} strokeWidth="1.8" />
                        <line x1="12" y1="9" x2="12" y2="13" stroke={colors.status.medium} strokeWidth="1.8" strokeLinecap="round" />
                        <circle cx="12" cy="17" r="1" fill={colors.status.medium} />
                    </svg>
                    <span>Partial results — some modules failed: {report.errors.map(e => e.module).join(', ')}</span>
                </div>
            )}
        </div>
    );
}

const s: Record<string, React.CSSProperties> = {
    container: {},
    scoreCard: {
        display: 'flex', gap: 24, alignItems: 'stretch',
        background: colors.bg.surface, border: `1px solid ${colors.bg.border}`,
        borderRadius: radius.xl, padding: '24px', marginBottom: 20,
    },
    scoreLeft: { flex: 1 },
    scoreLabel: { fontSize: 12, fontWeight: 600, color: colors.text.muted, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 },
    scoreValue: { fontSize: 52, fontWeight: 800, letterSpacing: '-2px', lineHeight: 1, marginBottom: 16 },
    scoreTrack: { position: 'relative', background: colors.bg.border, borderRadius: 6, height: 10, marginBottom: 8, overflow: 'visible' },
    scoreFill: { height: '100%', borderRadius: 6, transition: 'width 0.8s ease' },
    scoreMarker: { position: 'absolute', top: -3, width: 2, height: 16, background: colors.bg.base, borderRadius: 1 },
    scoreScale: { display: 'flex', justifyContent: 'space-between', fontSize: 11, color: colors.text.muted },
    riskBadge: {
        display: 'flex', alignItems: 'center', gap: 14,
        borderRadius: radius.lg, padding: '20px 24px', minWidth: 180,
    },
    riskIcon: {
        width: 36, height: 36, borderRadius: '50%', display: 'flex',
        alignItems: 'center', justifyContent: 'center', fontSize: 16,
        fontWeight: 700, color: '#fff', flexShrink: 0,
    },
    riskLabel: { fontSize: 16, fontWeight: 700, color: colors.text.primary },
    riskSub: { fontSize: 12, color: colors.text.secondary, marginTop: 2 },
    section: {
        background: colors.bg.surface, border: `1px solid ${colors.bg.border}`,
        borderRadius: radius.xl, padding: '20px 24px',
    },
    sectionHeader: { display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 },
    sectionTitle: { fontSize: 15, fontWeight: 700, color: colors.text.primary },
    issueCount: {
        background: colors.bg.elevated, border: `1px solid ${colors.bg.border}`,
        borderRadius: radius.full, padding: '2px 10px', fontSize: 12,
        fontWeight: 700, color: colors.text.secondary,
    },
    cleanState: { textAlign: 'center', padding: '32px 16px' },
    cleanIcon: {
        width: 48, height: 48, borderRadius: '50%', background: colors.status.lowBg,
        color: colors.status.low, fontSize: 22, fontWeight: 700,
        display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px',
    },
    cleanTitle: { fontSize: 15, fontWeight: 600, color: colors.text.primary, marginBottom: 4 },
    cleanSub: { fontSize: 13, color: colors.text.muted },
    issueList: { display: 'flex', flexDirection: 'column', gap: 12 },
    issueCard: {
        background: colors.bg.elevated, border: `1px solid ${colors.bg.border}`,
        borderRadius: radius.lg, padding: '14px 16px',
    },
    issueHeader: { marginBottom: 8 },
    issueTypeBadge: { fontSize: 11, fontWeight: 700, padding: '3px 8px', borderRadius: radius.full, letterSpacing: 0.3 },
    issueDesc: { fontSize: 13, color: colors.text.secondary, lineHeight: 1.6, marginBottom: 8 },
    issueExcerpt: { display: 'flex', gap: 10, alignItems: 'flex-start' },
    excerptBar: { width: 3, borderRadius: 2, background: colors.status.high, flexShrink: 0, alignSelf: 'stretch', minHeight: 20 },
    excerptText: { fontSize: 12, color: colors.text.muted, fontStyle: 'italic', lineHeight: 1.6 },
    warningBox: {
        display: 'flex', alignItems: 'center', gap: 10, marginTop: 16,
        background: colors.status.mediumBg, border: `1px solid ${colors.status.medium}30`,
        borderRadius: radius.md, padding: '10px 14px', fontSize: 13, color: colors.status.medium,
    },
};
