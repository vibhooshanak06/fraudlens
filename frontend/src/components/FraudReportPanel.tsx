import React, { useState } from 'react';
import { FraudReport } from '../api';
import { colors, radius } from '../styles/tokens';

interface Props { report: FraudReport; }

const riskConfig = {
    low: { color: colors.status.low, bg: colors.status.lowBg, border: `${colors.status.low}30`, label: 'Low Risk', icon: '✓' },
    medium: { color: colors.status.medium, bg: colors.status.mediumBg, border: `${colors.status.medium}30`, label: 'Medium Risk', icon: '!' },
    high: { color: colors.status.high, bg: colors.status.highBg, border: `${colors.status.high}30`, label: 'High Risk', icon: '✕' },
};

const issueTypeConfig: Record<string, { label: string; color: string; module: string }> = {
    plagiarism: { label: 'Plagiarism', color: colors.status.high, module: 'Plagiarism' },
    repeated_sentence: { label: 'Repeated Sentence', color: colors.status.medium, module: 'Pattern' },
    overused_keyword: { label: 'Overused Keyword', color: '#a78bfa', module: 'Pattern' },
    unusual_structure: { label: 'Unusual Structure', color: colors.text.secondary, module: 'Pattern' },
    citation_format: { label: 'Citation Format', color: colors.brand.primary, module: 'Citation' },
    citation_inconsistency: { label: 'Citation Inconsistency', color: colors.brand.primary, module: 'Citation' },
};

const moduleInfo = [
    { key: 'Plagiarism', label: 'Plagiarism Detection', icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><circle cx="11" cy="11" r="8" stroke="currentColor" strokeWidth="1.8" /><path d="M21 21l-4.35-4.35" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /></svg> },
    { key: 'Pattern', label: 'Pattern Analysis', icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg> },
    { key: 'Citation', label: 'Citation Check', icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /><path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /></svg> },
];

export default function FraudReportPanel({ report }: Props) {
    const [expandedIssue, setExpandedIssue] = useState<number | null>(null);
    const pct = Math.round(report.plagiarism_score * 100);
    const cfg = riskConfig[report.risk_level];

    // Group issues by module
    const issuesByModule: Record<string, number> = { Plagiarism: 0, Pattern: 0, Citation: 0 };
    report.issues.forEach(issue => {
        const mod = issueTypeConfig[issue.type]?.module ?? 'Pattern';
        issuesByModule[mod] = (issuesByModule[mod] || 0) + 1;
    });

    // Issue type breakdown
    const typeCounts: Record<string, number> = {};
    report.issues.forEach(issue => {
        typeCounts[issue.type] = (typeCounts[issue.type] || 0) + 1;
    });

    const totalModuleIssues = Object.values(issuesByModule).reduce((a, b) => a + b, 0);

    return (
        <div style={s.container}>

            {/* ── Score + Risk header ── */}
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
                        <span>0%</span>
                        <span style={{ color: colors.status.low }}>Low (&lt;30%)</span>
                        <span style={{ color: colors.status.medium }}>Medium (30–60%)</span>
                        <span style={{ color: colors.status.high }}>High (&gt;60%)</span>
                        <span>100%</span>
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

            {/* ── Module breakdown ── */}
            <div style={s.moduleGrid}>
                {moduleInfo.map(mod => {
                    const count = issuesByModule[mod.key] || 0;
                    const hasIssues = count > 0;
                    const failed = report.errors?.some(e => e.module.toLowerCase().includes(mod.key.toLowerCase()));
                    return (
                        <div key={mod.key} style={{ ...s.moduleCard, borderColor: hasIssues ? `${colors.status.medium}40` : `${colors.status.low}30` }}>
                            <div style={{ ...s.moduleIcon, color: hasIssues ? colors.status.medium : colors.status.low, background: hasIssues ? colors.status.mediumBg : colors.status.lowBg }}>
                                {mod.icon}
                            </div>
                            <div style={s.moduleLabel}>{mod.label}</div>
                            {failed ? (
                                <div style={s.moduleStatus}>
                                    <span style={{ color: colors.status.high, fontSize: 11 }}>Failed</span>
                                </div>
                            ) : (
                                <div style={s.moduleStatus}>
                                    <span style={{ ...s.moduleBadge, background: hasIssues ? colors.status.mediumBg : colors.status.lowBg, color: hasIssues ? colors.status.medium : colors.status.low }}>
                                        {count === 0 ? 'Clean' : `${count} issue${count > 1 ? 's' : ''}`}
                                    </span>
                                </div>
                            )}
                            {/* Mini bar showing proportion */}
                            <div style={s.moduleMiniBar}>
                                <div style={{ ...s.moduleMiniBarFill, width: totalModuleIssues > 0 ? `${(count / totalModuleIssues) * 100}%` : '0%', background: hasIssues ? colors.status.medium : colors.status.low }} />
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* ── Issue type distribution ── */}
            {Object.keys(typeCounts).length > 0 && (
                <div style={s.section}>
                    <div style={s.sectionHeader}>
                        <div style={s.sectionTitle}>Issue Distribution</div>
                    </div>
                    <div style={s.distGrid}>
                        {Object.entries(typeCounts).map(([type, count]) => {
                            const cfg2 = issueTypeConfig[type] ?? { label: type, color: colors.text.muted, module: '' };
                            const pct2 = Math.round((count / report.issues.length) * 100);
                            return (
                                <div key={type} style={s.distItem}>
                                    <div style={s.distTop}>
                                        <span style={{ ...s.distBadge, background: `${cfg2.color}15`, color: cfg2.color, border: `1px solid ${cfg2.color}25` }}>{cfg2.label}</span>
                                        <span style={s.distCount}>{count}</span>
                                    </div>
                                    <div style={s.distBar}>
                                        <div style={{ ...s.distBarFill, width: `${pct2}%`, background: cfg2.color }} />
                                    </div>
                                    <div style={s.distPct}>{pct2}% of issues</div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* ── Detected issues ── */}
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
                            const typeCfg = issueTypeConfig[issue.type] ?? { label: issue.type, color: colors.text.muted, module: '' };
                            const isExpanded = expandedIssue === i;
                            return (
                                <div key={i} style={{ ...s.issueCard, borderLeft: `3px solid ${typeCfg.color}` }}
                                    onClick={() => setExpandedIssue(isExpanded ? null : i)}>
                                    <div style={s.issueHeader}>
                                        <span style={{ ...s.issueTypeBadge, background: `${typeCfg.color}15`, color: typeCfg.color, border: `1px solid ${typeCfg.color}25` }}>
                                            {typeCfg.label}
                                        </span>
                                        {typeCfg.module && (
                                            <span style={s.issueModule}>{typeCfg.module} module</span>
                                        )}
                                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" style={{ marginLeft: 'auto', color: colors.text.muted, transform: isExpanded ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s', flexShrink: 0 }}>
                                            <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                                        </svg>
                                    </div>
                                    <div style={s.issueDesc}>{issue.description}</div>
                                    {isExpanded && issue.excerpt && (
                                        <div style={s.issueExcerpt}>
                                            <div style={{ ...s.excerptBar, background: typeCfg.color }} />
                                            <div style={s.excerptText}>"{issue.excerpt}"</div>
                                        </div>
                                    )}
                                    {!isExpanded && issue.excerpt && (
                                        <div style={s.issueExpandHint}>Click to see excerpt</div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* ── Integrity score summary ── */}
            <div style={s.integrityCard}>
                <div style={s.integrityTitle}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" stroke={cfg.color} strokeWidth="1.8" strokeLinecap="round" />
                    </svg>
                    Integrity Assessment
                </div>
                <div style={s.integrityGrid}>
                    {[
                        { label: 'Plagiarism Score', value: `${pct}%`, color: cfg.color },
                        { label: 'Issues Found', value: String(report.issues.length), color: report.issues.length > 0 ? colors.status.medium : colors.status.low },
                        { label: 'Modules Passed', value: `${3 - (report.errors?.length ?? 0)}/3`, color: colors.status.low },
                        { label: 'Overall Risk', value: cfg.label, color: cfg.color },
                    ].map(item => (
                        <div key={item.label} style={s.integrityItem}>
                            <div style={s.integrityLabel}>{item.label}</div>
                            <div style={{ ...s.integrityValue, color: item.color }}>{item.value}</div>
                        </div>
                    ))}
                </div>
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
    container: { display: 'flex', flexDirection: 'column', gap: 16 },
    scoreCard: { display: 'flex', gap: 24, alignItems: 'stretch', background: colors.bg.surface, border: `1px solid ${colors.bg.border}`, borderRadius: radius.xl, padding: '24px' },
    scoreLeft: { flex: 1 },
    scoreLabel: { fontSize: 12, fontWeight: 600, color: colors.text.muted, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 },
    scoreValue: { fontSize: 52, fontWeight: 800, letterSpacing: '-2px', lineHeight: 1, marginBottom: 16 },
    scoreTrack: { position: 'relative', background: colors.bg.border, borderRadius: 6, height: 10, marginBottom: 8, overflow: 'visible' },
    scoreFill: { height: '100%', borderRadius: 6, transition: 'width 0.8s ease' },
    scoreMarker: { position: 'absolute', top: -3, width: 2, height: 16, background: colors.bg.base, borderRadius: 1 },
    scoreScale: { display: 'flex', justifyContent: 'space-between', fontSize: 11, color: colors.text.muted },
    riskBadge: { display: 'flex', alignItems: 'center', gap: 14, borderRadius: radius.lg, padding: '20px 24px', minWidth: 180 },
    riskIcon: { width: 36, height: 36, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, fontWeight: 700, color: '#fff', flexShrink: 0 },
    riskLabel: { fontSize: 16, fontWeight: 700, color: colors.text.primary },
    riskSub: { fontSize: 12, color: colors.text.secondary, marginTop: 2 },

    moduleGrid: { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 },
    moduleCard: { background: colors.bg.surface, border: `1px solid`, borderRadius: radius.lg, padding: '14px 16px' },
    moduleIcon: { width: 30, height: 30, borderRadius: radius.sm, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 10 },
    moduleLabel: { fontSize: 12, fontWeight: 600, color: colors.text.secondary, marginBottom: 6 },
    moduleStatus: { marginBottom: 8 },
    moduleBadge: { fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: radius.full },
    moduleMiniBar: { height: 3, background: colors.bg.border, borderRadius: 2, overflow: 'hidden' },
    moduleMiniBarFill: { height: '100%', borderRadius: 2, transition: 'width 0.6s ease' },

    section: { background: colors.bg.surface, border: `1px solid ${colors.bg.border}`, borderRadius: radius.xl, padding: '20px 24px' },
    sectionHeader: { display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 },
    sectionTitle: { fontSize: 15, fontWeight: 700, color: colors.text.primary },
    issueCount: { background: colors.bg.elevated, border: `1px solid ${colors.bg.border}`, borderRadius: radius.full, padding: '2px 10px', fontSize: 12, fontWeight: 700, color: colors.text.secondary },

    distGrid: { display: 'flex', flexDirection: 'column', gap: 10 },
    distItem: {},
    distTop: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 },
    distBadge: { fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: radius.full },
    distCount: { fontSize: 13, fontWeight: 700, color: colors.text.secondary },
    distBar: { height: 5, background: colors.bg.border, borderRadius: 3, overflow: 'hidden', marginBottom: 3 },
    distBarFill: { height: '100%', borderRadius: 3, transition: 'width 0.6s ease' },
    distPct: { fontSize: 11, color: colors.text.muted },

    cleanState: { textAlign: 'center', padding: '32px 16px' },
    cleanIcon: { width: 48, height: 48, borderRadius: '50%', background: colors.status.lowBg, color: colors.status.low, fontSize: 22, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px' },
    cleanTitle: { fontSize: 15, fontWeight: 600, color: colors.text.primary, marginBottom: 4 },
    cleanSub: { fontSize: 13, color: colors.text.muted },
    issueList: { display: 'flex', flexDirection: 'column', gap: 10 },
    issueCard: { background: colors.bg.elevated, border: `1px solid ${colors.bg.border}`, borderRadius: radius.lg, padding: '14px 16px', cursor: 'pointer' },
    issueHeader: { display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 },
    issueTypeBadge: { fontSize: 11, fontWeight: 700, padding: '3px 8px', borderRadius: radius.full, letterSpacing: 0.3 },
    issueModule: { fontSize: 11, color: colors.text.muted },
    issueDesc: { fontSize: 13, color: colors.text.secondary, lineHeight: 1.6 },
    issueExcerpt: { display: 'flex', gap: 10, alignItems: 'flex-start', marginTop: 10 },
    excerptBar: { width: 3, borderRadius: 2, flexShrink: 0, alignSelf: 'stretch', minHeight: 20 },
    excerptText: { fontSize: 12, color: colors.text.muted, fontStyle: 'italic', lineHeight: 1.6 },
    issueExpandHint: { fontSize: 11, color: colors.text.muted, marginTop: 6 },

    integrityCard: { background: colors.bg.surface, border: `1px solid ${colors.bg.border}`, borderRadius: radius.xl, padding: '20px 24px' },
    integrityTitle: { display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, fontWeight: 700, color: colors.text.primary, marginBottom: 16 },
    integrityGrid: { display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 },
    integrityItem: { textAlign: 'center' },
    integrityLabel: { fontSize: 11, color: colors.text.muted, marginBottom: 6 },
    integrityValue: { fontSize: 18, fontWeight: 800, letterSpacing: '-0.5px' },

    warningBox: { display: 'flex', alignItems: 'center', gap: 10, background: colors.status.mediumBg, border: `1px solid ${colors.status.medium}30`, borderRadius: radius.md, padding: '10px 14px', fontSize: 13, color: colors.status.medium },
};
