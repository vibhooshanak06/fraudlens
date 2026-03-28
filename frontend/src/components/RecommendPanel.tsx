import React, { useEffect, useState } from 'react';
import { getRecommendations, Recommendation } from '../api';
import { colors, radius } from '../styles/tokens';

interface Props { keywords?: string[]; }

export default function RecommendPanel({ keywords }: Props) {
    const [results, setResults] = useState<Recommendation[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [query, setQuery] = useState('');
    const [searched, setSearched] = useState(false);

    useEffect(() => {
        if (keywords && keywords.length > 0) {
            const q = keywords.slice(0, 5).join(' ');
            setQuery(q);
            fetchRecs(q);
        }
    }, [keywords?.join(',')]);

    async function fetchRecs(q: string) {
        if (!q || q.trim().length < 3) return;
        setLoading(true);
        setError(null);
        setSearched(true);
        try {
            const res = await getRecommendations(q.trim());
            setResults(res.results || []);
        } catch (err: any) {
            setError(err?.response?.status === 400 ? 'Query too short — enter at least 3 characters.' : 'Failed to fetch recommendations.');
        } finally {
            setLoading(false);
        }
    }

    function handleSearch(e: React.FormEvent) { e.preventDefault(); fetchRecs(query); }

    return (
        <div style={s.container}>
            {/* Search bar */}
            <div style={s.searchCard}>
                <div style={s.searchHeader}>
                    <div style={s.searchIcon}>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                            <circle cx="11" cy="11" r="8" stroke={colors.brand.primary} strokeWidth="1.8" />
                            <path d="M21 21l-4.35-4.35" stroke={colors.brand.primary} strokeWidth="1.8" strokeLinecap="round" />
                        </svg>
                    </div>
                    <div>
                        <div style={s.searchTitle}>Related Papers</div>
                        <div style={s.searchSub}>Discover semantically similar research</div>
                    </div>
                </div>
                <form onSubmit={handleSearch} style={s.searchForm}>
                    <input
                        style={s.searchInput}
                        value={query}
                        onChange={e => setQuery(e.target.value)}
                        placeholder="Enter topic, keywords, or research area…"
                    />
                    <button style={s.searchBtn} type="submit" disabled={loading}>
                        {loading ? (
                            <div style={s.btnSpinner} />
                        ) : (
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                                <circle cx="11" cy="11" r="8" stroke="white" strokeWidth="2" />
                                <path d="M21 21l-4.35-4.35" stroke="white" strokeWidth="2" strokeLinecap="round" />
                            </svg>
                        )}
                        {loading ? 'Searching…' : 'Search'}
                    </button>
                </form>
                {keywords && keywords.length > 0 && (
                    <div style={s.keywordRow}>
                        <span style={s.keywordLabel}>Paper keywords:</span>
                        {keywords.slice(0, 8).map(k => (
                            <button key={k} style={s.keywordChip} onClick={() => { setQuery(k); fetchRecs(k); }}>{k}</button>
                        ))}
                    </div>
                )}
            </div>

            {error && (
                <div style={s.errorBox}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0 }}>
                        <circle cx="12" cy="12" r="10" stroke="#ef4444" strokeWidth="1.8" />
                        <line x1="12" y1="8" x2="12" y2="12" stroke="#ef4444" strokeWidth="1.8" strokeLinecap="round" />
                    </svg>
                    {error}
                </div>
            )}

            {!loading && !searched && (
                <div style={s.emptyState}>
                    <div style={s.emptyIcon}>
                        <svg width="40" height="40" viewBox="0 0 24 24" fill="none">
                            <path d="M4 19.5A2.5 2.5 0 016.5 17H20" stroke={colors.text.muted} strokeWidth="1.5" strokeLinecap="round" />
                            <path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z" stroke={colors.text.muted} strokeWidth="1.5" strokeLinecap="round" />
                        </svg>
                    </div>
                    <div style={s.emptyTitle}>Find related research</div>
                    <div style={s.emptyDesc}>Enter a topic or keyword above to discover semantically similar papers from our corpus.</div>
                </div>
            )}

            {loading && (
                <div style={s.loadingState}>
                    {[1, 2, 3].map(i => <div key={i} style={s.skeleton} />)}
                </div>
            )}

            {!loading && results.length > 0 && (
                <div style={s.results}>
                    <div style={s.resultsHeader}>
                        <span style={s.resultsCount}>{results.length} papers found</span>
                        <span style={s.resultsSub}>Ranked by semantic similarity</span>
                    </div>
                    {results.map((r, i) => (
                        <div key={i} style={s.paperCard}>
                            <div style={s.paperRank}>#{i + 1}</div>
                            <div style={s.paperBody}>
                                <div style={s.paperTitle}>{r.title}</div>
                                <div style={s.paperAuthors}>{r.authors.join(', ')}</div>
                                <div style={s.paperAbstract}>{r.abstract_snippet}</div>
                                <div style={s.paperFooter}>
                                    <div style={s.simScore}>
                                        <div style={s.simBar}>
                                            <div style={{ ...s.simFill, width: `${Math.round(r.similarity_score * 100)}%` }} />
                                        </div>
                                        <span style={s.simPct}>{Math.round(r.similarity_score * 100)}% match</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {!loading && searched && results.length === 0 && !error && (
                <div style={s.emptyState}>
                    <div style={s.emptyIcon}>
                        <svg width="40" height="40" viewBox="0 0 24 24" fill="none">
                            <circle cx="11" cy="11" r="8" stroke={colors.text.muted} strokeWidth="1.5" />
                            <path d="M21 21l-4.35-4.35" stroke={colors.text.muted} strokeWidth="1.5" strokeLinecap="round" />
                            <line x1="8" y1="11" x2="14" y2="11" stroke={colors.text.muted} strokeWidth="1.5" strokeLinecap="round" />
                        </svg>
                    </div>
                    <div style={s.emptyTitle}>No results found</div>
                    <div style={s.emptyDesc}>Try different keywords or a broader search term.</div>
                </div>
            )}
        </div>
    );
}

const s: Record<string, React.CSSProperties> = {
    container: { display: 'flex', flexDirection: 'column', gap: 20 },
    searchCard: {
        background: colors.bg.surface, border: `1px solid ${colors.bg.border}`,
        borderRadius: radius.xl, padding: '20px 24px',
    },
    searchHeader: { display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 },
    searchIcon: { width: 36, height: 36, background: colors.brand.primaryGlow, borderRadius: radius.md, display: 'flex', alignItems: 'center', justifyContent: 'center' },
    searchTitle: { fontSize: 15, fontWeight: 700, color: colors.text.primary },
    searchSub: { fontSize: 12, color: colors.text.muted, marginTop: 1 },
    searchForm: { display: 'flex', gap: 10, marginBottom: 14 },
    searchInput: {
        flex: 1, background: colors.bg.elevated, border: `1px solid ${colors.bg.border}`,
        borderRadius: radius.md, color: colors.text.primary, padding: '11px 14px',
        fontSize: 14, outline: 'none', fontFamily: 'inherit',
    },
    searchBtn: {
        display: 'flex', alignItems: 'center', gap: 8,
        background: colors.brand.gradient, border: 'none', borderRadius: radius.md,
        color: '#fff', padding: '11px 20px', fontSize: 14, fontWeight: 600, cursor: 'pointer',
        whiteSpace: 'nowrap',
    },
    btnSpinner: { width: 14, height: 14, border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 0.7s linear infinite' },
    keywordRow: { display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 6 },
    keywordLabel: { fontSize: 11, color: colors.text.muted, fontWeight: 600 },
    keywordChip: {
        background: colors.bg.elevated, border: `1px solid ${colors.bg.border}`,
        borderRadius: radius.full, color: colors.text.secondary, padding: '3px 10px',
        fontSize: 12, cursor: 'pointer',
    },
    errorBox: {
        display: 'flex', alignItems: 'center', gap: 10,
        background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)',
        borderRadius: radius.md, padding: '12px 16px', fontSize: 13, color: '#fca5a5',
    },
    emptyState: { textAlign: 'center', padding: '48px 24px' },
    emptyIcon: { display: 'flex', justifyContent: 'center', marginBottom: 12 },
    emptyTitle: { fontSize: 16, fontWeight: 600, color: colors.text.primary, marginBottom: 6 },
    emptyDesc: { fontSize: 13, color: colors.text.muted, maxWidth: 360, margin: '0 auto' },
    loadingState: { display: 'flex', flexDirection: 'column', gap: 12 },
    skeleton: { background: colors.bg.surface, border: `1px solid ${colors.bg.border}`, borderRadius: radius.lg, height: 100, animation: 'pulse 1.5s ease-in-out infinite' },
    results: {},
    resultsHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
    resultsCount: { fontSize: 14, fontWeight: 700, color: colors.text.primary },
    resultsSub: { fontSize: 12, color: colors.text.muted },
    paperCard: {
        display: 'flex', gap: 16, background: colors.bg.surface,
        border: `1px solid ${colors.bg.border}`, borderRadius: radius.lg,
        padding: '18px 20px', marginBottom: 12, transition: 'border-color 0.2s',
    },
    paperRank: {
        width: 28, height: 28, background: colors.bg.elevated, borderRadius: radius.sm,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 12, fontWeight: 700, color: colors.text.muted, flexShrink: 0,
    },
    paperBody: { flex: 1, minWidth: 0 },
    paperTitle: { fontSize: 15, fontWeight: 700, color: colors.text.primary, marginBottom: 4, lineHeight: 1.4 },
    paperAuthors: { fontSize: 12, color: colors.brand.primary, marginBottom: 8, fontWeight: 500 },
    paperAbstract: { fontSize: 13, color: colors.text.secondary, lineHeight: 1.6, marginBottom: 12 },
    paperFooter: { display: 'flex', alignItems: 'center', justifyContent: 'space-between' },
    simScore: { display: 'flex', alignItems: 'center', gap: 10 },
    simBar: { width: 80, height: 5, background: colors.bg.border, borderRadius: 3, overflow: 'hidden' },
    simFill: { height: '100%', background: colors.status.low, borderRadius: 3 },
    simPct: { fontSize: 12, color: colors.status.low, fontWeight: 600 },
};
