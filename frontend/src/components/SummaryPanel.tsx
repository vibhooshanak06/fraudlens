import React from 'react';
import { Summary } from '../api';
import { colors, radius } from '../styles/tokens';

interface Props { summary: Summary; }

const fields = [
    {
        key: 'title' as const, label: 'Title', color: colors.brand.primary,
        icon: <svg width="13" height="13" viewBox="0 0 24 24" fill="none"><line x1="4" y1="6" x2="20" y2="6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /><line x1="4" y1="12" x2="14" y2="12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
    },
    {
        key: 'main_contributions' as const, label: 'Main Contributions', color: '#a78bfa',
        icon: <svg width="13" height="13" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="1.8" /><line x1="12" y1="8" x2="12" y2="16" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /><line x1="8" y1="12" x2="16" y2="12" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /></svg>
    },
    {
        key: 'methodology' as const, label: 'Methodology', color: colors.status.info,
        icon: <svg width="13" height="13" viewBox="0 0 24 24" fill="none"><path d="M9 3H5a2 2 0 00-2 2v4m6-6h10a2 2 0 012 2v4M9 3v18m0 0h10a2 2 0 002-2V9M9 21H5a2 2 0 01-2-2V9m0 0h18" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
    },
    {
        key: 'conclusions' as const, label: 'Conclusions', color: colors.status.low,
        icon: <svg width="13" height="13" viewBox="0 0 24 24" fill="none"><polyline points="20 6 9 17 4 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
    },
];

export default function SummaryPanel({ summary }: Props) {
    return (
        <div style={s.container}>
            <div style={s.header}>
                <div style={s.headerIcon}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                        <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" stroke={colors.brand.primary} strokeWidth="1.8" />
                        <polyline points="14 2 14 8 20 8" stroke={colors.brand.primary} strokeWidth="1.8" />
                        <line x1="16" y1="13" x2="8" y2="13" stroke={colors.brand.primary} strokeWidth="1.8" strokeLinecap="round" />
                        <line x1="16" y1="17" x2="8" y2="17" stroke={colors.brand.primary} strokeWidth="1.8" strokeLinecap="round" />
                    </svg>
                </div>
                <div style={s.headerTitle}>AI Summary</div>
                <div style={s.aiBadge}>AI Generated</div>
            </div>

            <div style={s.fields}>
                {fields.map(f => (
                    <div key={f.key} style={s.field}>
                        <div style={{ ...s.fieldLabel, color: f.color }}>
                            <span>{f.icon}</span>
                            <span>{f.label}</span>
                        </div>
                        <div style={s.fieldValue}>{summary[f.key] || 'Not available'}</div>
                    </div>
                ))}
            </div>
        </div>
    );
}

const s: Record<string, React.CSSProperties> = {
    container: {
        background: colors.bg.surface, border: `1px solid ${colors.bg.border}`,
        borderRadius: radius.xl, overflow: 'hidden',
    },
    header: {
        display: 'flex', alignItems: 'center', gap: 10,
        padding: '16px 20px', borderBottom: `1px solid ${colors.bg.border}`,
        background: colors.bg.elevated,
    },
    headerIcon: {
        width: 30, height: 30, background: colors.brand.primaryGlow, borderRadius: radius.sm,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
    },
    headerTitle: { fontSize: 14, fontWeight: 700, color: colors.text.primary, flex: 1 },
    aiBadge: {
        fontSize: 10, fontWeight: 700, color: '#a78bfa', background: 'rgba(167,139,250,0.1)',
        border: '1px solid rgba(167,139,250,0.2)', borderRadius: radius.full,
        padding: '3px 8px', letterSpacing: 0.5,
    },
    fields: { padding: '4px 0' },
    field: { padding: '14px 20px', borderBottom: `1px solid ${colors.bg.border}` },
    fieldLabel: { display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 6 },
    fieldValue: { fontSize: 13, color: colors.text.secondary, lineHeight: 1.7 },
};
