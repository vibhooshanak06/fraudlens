import React, { useEffect, useState } from 'react';
import { getCitationGraph, CitationGraph, CitationNode, CitationEdge } from '../api';
import { colors, radius } from '../styles/tokens';

interface Props { uuid: string; }

function useForceLayout(nodes: CitationNode[], edges: CitationEdge[], width: number, height: number) {
    const [positions, setPositions] = useState<Record<string, { x: number; y: number }>>({});

    useEffect(() => {
        if (!nodes.length) return;
        const pos: Record<string, { x: number; y: number; vx: number; vy: number }> = {};
        nodes.forEach((n, i) => {
            const angle = (2 * Math.PI * i) / nodes.length;
            const r = Math.min(width, height) * 0.35;
            pos[n.id] = { x: width / 2 + r * Math.cos(angle), y: height / 2 + r * Math.sin(angle), vx: 0, vy: 0 };
        });
        const k = Math.sqrt((width * height) / Math.max(nodes.length, 1));
        for (let iter = 0; iter < 150; iter++) {
            for (let i = 0; i < nodes.length; i++) {
                for (let j = i + 1; j < nodes.length; j++) {
                    const a = pos[nodes[i].id], b = pos[nodes[j].id];
                    const dx = a.x - b.x, dy = a.y - b.y;
                    const dist = Math.max(Math.sqrt(dx * dx + dy * dy), 1);
                    const force = (k * k) / dist * 0.1;
                    a.vx += (dx / dist) * force; a.vy += (dy / dist) * force;
                    b.vx -= (dx / dist) * force; b.vy -= (dy / dist) * force;
                }
            }
            edges.forEach(e => {
                const a = pos[e.source], b = pos[e.target];
                if (!a || !b) return;
                const dx = b.x - a.x, dy = b.y - a.y;
                const dist = Math.max(Math.sqrt(dx * dx + dy * dy), 1);
                const force = (dist * dist) / k * (e.weight || 1) * 0.05;
                a.vx += (dx / dist) * force; a.vy += (dy / dist) * force;
                b.vx -= (dx / dist) * force; b.vy -= (dy / dist) * force;
            });
            nodes.forEach(n => {
                const p = pos[n.id];
                p.x = Math.max(36, Math.min(width - 36, p.x + p.vx));
                p.y = Math.max(36, Math.min(height - 36, p.y + p.vy));
                p.vx *= 0.7; p.vy *= 0.7;
            });
        }
        const result: Record<string, { x: number; y: number }> = {};
        nodes.forEach(n => { result[n.id] = { x: pos[n.id].x, y: pos[n.id].y }; });
        setPositions(result);
    }, [nodes.map(n => n.id).join(','), edges.length, width, height]);

    return positions;
}

export default function CitationGraphPanel({ uuid }: Props) {
    const [graph, setGraph] = useState<CitationGraph | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [hovered, setHovered] = useState<string | null>(null);
    const [selected, setSelected] = useState<string | null>(null);

    const W = 520, H = 460;
    const positions = useForceLayout(graph?.nodes ?? [], graph?.edges ?? [], W, H);

    useEffect(() => {
        getCitationGraph(uuid)
            .then(g => setGraph(g))
            .catch(e => {
                const msg = e?.response?.data?.detail || e?.response?.data?.error || 'Failed to load citation graph';
                setError(msg);
            })
            .finally(() => setLoading(false));
    }, [uuid]);

    if (loading) return (
        <div style={s.center}>
            <div style={s.spinner} />
            <div style={s.loadingText}>Building citation graph…</div>
        </div>
    );

    if (error) return (
        <div style={s.center}>
            <svg width="36" height="36" viewBox="0 0 24 24" fill="none">
                <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" stroke={colors.status.high} strokeWidth="1.8" strokeLinecap="round" />
                <line x1="12" y1="9" x2="12" y2="13" stroke={colors.status.high} strokeWidth="1.8" strokeLinecap="round" />
                <circle cx="12" cy="17" r="1" fill={colors.status.high} />
            </svg>
            <div style={{ fontSize: 14, color: colors.text.secondary, marginTop: 10, maxWidth: 400, textAlign: 'center' }}>{error}</div>
        </div>
    );

    if (!graph || graph.nodes.length === 0) return (
        <div style={s.center}>
            <svg width="44" height="44" viewBox="0 0 24 24" fill="none">
                <circle cx="5" cy="12" r="2" stroke={colors.text.muted} strokeWidth="1.5" />
                <circle cx="19" cy="5" r="2" stroke={colors.text.muted} strokeWidth="1.5" />
                <circle cx="19" cy="19" r="2" stroke={colors.text.muted} strokeWidth="1.5" />
                <line x1="7" y1="11" x2="17" y2="6" stroke={colors.text.muted} strokeWidth="1.5" strokeLinecap="round" />
                <line x1="7" y1="13" x2="17" y2="18" stroke={colors.text.muted} strokeWidth="1.5" strokeLinecap="round" />
            </svg>
            <div style={{ fontSize: 14, color: colors.text.muted, marginTop: 10 }}>No citation references found in this paper.</div>
        </div>
    );

    const ringMemberSet = new Set(graph.rings.flatMap(r => r.members));
    const selectedNode = graph.nodes.find(n => n.id === selected);
    const connectedEdges = selected ? graph.edges.filter(e => e.source === selected || e.target === selected) : [];
    const connectedIds = new Set(connectedEdges.flatMap(e => [e.source, e.target]));
    const connectedNodes = graph.nodes.filter(n => n.id !== selected && connectedIds.has(n.id));

    return (
        <div style={s.layout}>
            {/* Left: graph */}
            <div style={s.graphCol}>
                {/* Stats row */}
                <div style={s.statsRow}>
                    {[
                        { label: 'References', value: graph.stats.total_references, color: colors.brand.primary },
                        { label: 'Co-citations', value: graph.stats.co_citation_pairs, color: colors.status.info },
                        { label: 'Rings', value: graph.stats.ring_count, color: graph.stats.ring_count > 0 ? colors.status.high : colors.status.low },
                    ].map(s2 => (
                        <div key={s2.label} style={s.statChip}>
                            <span style={{ ...s.statVal, color: s2.color }}>{s2.value}</span>
                            <span style={s.statLabel}>{s2.label}</span>
                        </div>
                    ))}
                    <div style={s.legendRow}>
                        <span style={{ ...s.dot, background: colors.brand.primary }} />
                        <span style={s.legendText}>Normal</span>
                        <span style={{ ...s.dot, background: colors.status.high, marginLeft: 10 }} />
                        <span style={s.legendText}>Ring member</span>
                    </div>
                </div>

                {/* Ring alert */}
                {graph.rings.length > 0 && (
                    <div style={s.ringAlert}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0, marginTop: 1 }}>
                            <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" stroke={colors.status.high} strokeWidth="1.8" strokeLinecap="round" />
                            <line x1="12" y1="9" x2="12" y2="13" stroke={colors.status.high} strokeWidth="1.8" strokeLinecap="round" />
                            <circle cx="12" cy="17" r="1" fill={colors.status.high} />
                        </svg>
                        <div>
                            <div style={s.ringAlertTitle}>{graph.rings.length} citation ring{graph.rings.length > 1 ? 's' : ''} detected</div>
                            {graph.rings.map((ring, i) => (
                                <div key={i} style={s.ringAlertDesc}>{ring.description}</div>
                            ))}
                        </div>
                    </div>
                )}

                {/* SVG graph */}
                <div style={s.svgWrap}>
                    <svg width={W} height={H} style={{ display: 'block' }}>
                        {graph.edges.map((e, i) => {
                            const a = positions[e.source], b = positions[e.target];
                            if (!a || !b) return null;
                            const isHighlighted = selected ? (e.source === selected || e.target === selected) : false;
                            const opacity = selected ? (isHighlighted ? 1 : 0.08) : 0.35;
                            return (
                                <line key={i} x1={a.x} y1={a.y} x2={b.x} y2={b.y}
                                    stroke={isHighlighted ? colors.brand.primary : colors.bg.borderLight}
                                    strokeWidth={Math.min(e.weight, 4)}
                                    opacity={opacity}
                                />
                            );
                        })}
                        {graph.nodes.map(n => {
                            const p = positions[n.id];
                            if (!p) return null;
                            const isRing = ringMemberSet.has(n.id);
                            const isSelected = n.id === selected;
                            const isConnected = connectedIds.has(n.id);
                            const dimmed = selected && !isSelected && !isConnected;
                            const nodeColor = isRing ? colors.status.high : colors.brand.primary;
                            const r = isSelected ? 11 : isRing ? 9 : 7;
                            return (
                                <g key={n.id} style={{ cursor: 'pointer' }}
                                    onClick={() => setSelected(selected === n.id ? null : n.id)}
                                    onMouseEnter={() => setHovered(n.id)}
                                    onMouseLeave={() => setHovered(null)}
                                    opacity={dimmed ? 0.15 : 1}
                                >
                                    {isSelected && <circle cx={p.x} cy={p.y} r={r + 7} fill={`${nodeColor}18`} />}
                                    <circle cx={p.x} cy={p.y} r={r}
                                        fill={isSelected ? nodeColor : `${nodeColor}25`}
                                        stroke={nodeColor} strokeWidth={isSelected ? 2.5 : 1.5}
                                    />
                                    {(hovered === n.id || isSelected) && (
                                        <text x={p.x} y={p.y - r - 6} textAnchor="middle"
                                            fontSize="10" fill={colors.text.primary}
                                            style={{ pointerEvents: 'none', userSelect: 'none' }}
                                        >
                                            [{n.id}]
                                        </text>
                                    )}
                                </g>
                            );
                        })}
                    </svg>
                </div>
                <div style={s.hint}>Click a node to explore its connections</div>
            </div>

            {/* Right: info sidebar */}
            <div style={s.sidebar}>

                {/* Selected node detail */}
                {selectedNode ? (
                    <div style={s.sideSection}>
                        <div style={s.sideSectionTitle}>
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
                                <circle cx="12" cy="12" r="10" stroke={colors.brand.primary} strokeWidth="1.8" />
                                <line x1="12" y1="8" x2="12" y2="16" stroke={colors.brand.primary} strokeWidth="1.8" strokeLinecap="round" />
                            </svg>
                            Reference [{selectedNode.id}]
                            {ringMemberSet.has(selectedNode.id) && (
                                <span style={s.ringBadge}>Ring</span>
                            )}
                        </div>
                        <div style={s.refFull}>{selectedNode.label}</div>
                        {connectedEdges.length > 0 ? (
                            <>
                                <div style={s.connLabel}>{connectedEdges.length} co-citation{connectedEdges.length !== 1 ? 's' : ''} with:</div>
                                {connectedNodes.map(cn => (
                                    <div key={cn.id} style={s.connItem}>
                                        <span style={{ ...s.connDot, background: ringMemberSet.has(cn.id) ? colors.status.high : colors.brand.primary }} />
                                        <span style={s.connId}>[{cn.id}]</span>
                                        <span style={s.connLabel2}>{cn.label.slice(0, 50)}{cn.label.length > 50 ? '…' : ''}</span>
                                    </div>
                                ))}
                            </>
                        ) : (
                            <div style={s.noConn}>No inline co-citations found for this reference.</div>
                        )}
                        <button style={s.clearBtn} onClick={() => setSelected(null)}>Clear selection</button>
                    </div>
                ) : (
                    <div style={s.sideSection}>
                        <div style={s.sideSectionTitle}>
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
                                <circle cx="12" cy="12" r="10" stroke={colors.brand.primary} strokeWidth="1.8" />
                                <line x1="12" y1="8" x2="12" y2="16" stroke={colors.brand.primary} strokeWidth="1.8" strokeLinecap="round" />
                            </svg>
                            How to read this graph
                        </div>
                        <div style={s.explainItem}>
                            <span style={{ ...s.dot, background: colors.brand.primary, flexShrink: 0 }} />
                            <span style={s.explainText}>Each node is a reference from the paper's bibliography.</span>
                        </div>
                        <div style={s.explainItem}>
                            <span style={s.edgeLine} />
                            <span style={s.explainText}>Edges connect references cited together in the same sentence (co-citations). Thicker = cited together more often.</span>
                        </div>
                        <div style={s.explainItem}>
                            <span style={{ ...s.dot, background: colors.status.high, flexShrink: 0 }} />
                            <span style={s.explainText}>Red nodes are part of a citation ring — a group of papers that heavily cite each other, a known fraud signal.</span>
                        </div>
                        {graph.edges.length === 0 && (
                            <div style={s.noEdgeNote}>
                                <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
                                    <circle cx="12" cy="12" r="10" stroke={colors.status.medium} strokeWidth="1.8" />
                                    <line x1="12" y1="8" x2="12" y2="12" stroke={colors.status.medium} strokeWidth="1.8" strokeLinecap="round" />
                                    <circle cx="12" cy="16" r="1" fill={colors.status.medium} />
                                </svg>
                                This paper lists references but has no inline citation markers (e.g. [1], [2]) in the body text, so no co-citation edges can be drawn.
                            </div>
                        )}
                    </div>
                )}

                {/* Reference list */}
                <div style={s.sideSection}>
                    <div style={s.sideSectionTitle}>
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
                            <path d="M4 19.5A2.5 2.5 0 016.5 17H20" stroke={colors.brand.primary} strokeWidth="1.8" strokeLinecap="round" />
                            <path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z" stroke={colors.brand.primary} strokeWidth="1.8" strokeLinecap="round" />
                        </svg>
                        All References ({graph.nodes.length})
                    </div>
                    <div style={s.refList}>
                        {graph.nodes.map(n => (
                            <div key={n.id}
                                style={{ ...s.refItem, ...(selected === n.id ? s.refItemSelected : {}), ...(ringMemberSet.has(n.id) ? s.refItemRing : {}) }}
                                onClick={() => setSelected(selected === n.id ? null : n.id)}
                            >
                                <span style={{ ...s.refNum, color: ringMemberSet.has(n.id) ? colors.status.high : colors.brand.primary }}>
                                    [{n.id}]
                                </span>
                                <span style={s.refSnippet}>{n.label}</span>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Ring details */}
                {graph.rings.length > 0 && (
                    <div style={s.sideSection}>
                        <div style={s.sideSectionTitle}>
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
                                <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" stroke={colors.status.high} strokeWidth="1.8" strokeLinecap="round" />
                                <line x1="12" y1="9" x2="12" y2="13" stroke={colors.status.high} strokeWidth="1.8" strokeLinecap="round" />
                                <circle cx="12" cy="17" r="1" fill={colors.status.high} />
                            </svg>
                            Citation Rings Detected
                        </div>
                        {graph.rings.map((ring, i) => (
                            <div key={i} style={s.ringCard}>
                                <div style={s.ringCardTitle}>Ring {i + 1} — {ring.size} members</div>
                                <div style={s.ringCardDesc}>{ring.description}</div>
                                <div style={s.ringMembers}>
                                    {ring.members.map(m => (
                                        <span key={m} style={s.ringMemberChip} onClick={() => setSelected(m)}>[{m}]</span>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}

const s: Record<string, React.CSSProperties> = {
    layout: { display: 'grid', gridTemplateColumns: '1fr 300px', gap: 20, alignItems: 'start' },
    graphCol: { display: 'flex', flexDirection: 'column', gap: 12 },
    statsRow: { display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' },
    statChip: { display: 'flex', alignItems: 'center', gap: 8, background: colors.bg.surface, border: `1px solid ${colors.bg.border}`, borderRadius: radius.md, padding: '7px 14px' },
    statVal: { fontSize: 20, fontWeight: 800, letterSpacing: '-0.5px' },
    statLabel: { fontSize: 12, color: colors.text.muted },
    legendRow: { display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, color: colors.text.muted, marginLeft: 'auto' },
    legendText: { fontSize: 12, color: colors.text.muted },
    dot: { width: 9, height: 9, borderRadius: '50%', display: 'inline-block' },
    ringAlert: { display: 'flex', gap: 10, alignItems: 'flex-start', background: 'rgba(239,68,68,0.06)', border: `1px solid rgba(239,68,68,0.2)`, borderRadius: radius.lg, padding: '12px 16px' },
    ringAlertTitle: { fontSize: 13, fontWeight: 700, color: colors.status.high, marginBottom: 3 },
    ringAlertDesc: { fontSize: 12, color: colors.text.secondary },
    svgWrap: { background: colors.bg.surface, border: `1px solid ${colors.bg.border}`, borderRadius: radius.xl, overflow: 'hidden' },
    center: { display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '64px 24px', gap: 12 },
    spinner: { width: 32, height: 32, border: `3px solid ${colors.bg.border}`, borderTopColor: colors.brand.primary, borderRadius: '50%', animation: 'spin 0.8s linear infinite' },
    loadingText: { fontSize: 14, color: colors.text.muted },
    hint: { fontSize: 12, color: colors.text.muted, textAlign: 'center' },

    // Sidebar
    sidebar: { display: 'flex', flexDirection: 'column', gap: 12 },
    sideSection: { background: colors.bg.surface, border: `1px solid ${colors.bg.border}`, borderRadius: radius.lg, padding: '14px 16px' },
    sideSectionTitle: { display: 'flex', alignItems: 'center', gap: 7, fontSize: 12, fontWeight: 700, color: colors.text.secondary, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 12 },
    ringBadge: { fontSize: 10, fontWeight: 700, color: colors.status.high, background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: radius.full, padding: '1px 7px', marginLeft: 4 },
    refFull: { fontSize: 13, color: colors.text.primary, lineHeight: 1.6, marginBottom: 10 },
    connLabel: { fontSize: 11, color: colors.text.muted, fontWeight: 600, marginBottom: 6 },
    connItem: { display: 'flex', alignItems: 'flex-start', gap: 6, marginBottom: 5 },
    connDot: { width: 7, height: 7, borderRadius: '50%', flexShrink: 0, marginTop: 4 },
    connId: { fontSize: 11, fontWeight: 700, color: colors.brand.primary, flexShrink: 0 },
    connLabel2: { fontSize: 11, color: colors.text.muted, lineHeight: 1.5 },
    noConn: { fontSize: 12, color: colors.text.muted, fontStyle: 'italic', lineHeight: 1.6 },
    clearBtn: { marginTop: 10, background: 'none', border: `1px solid ${colors.bg.border}`, borderRadius: radius.sm, color: colors.text.muted, fontSize: 11, padding: '4px 10px', cursor: 'pointer' },
    explainItem: { display: 'flex', alignItems: 'flex-start', gap: 8, marginBottom: 10 },
    explainText: { fontSize: 12, color: colors.text.secondary, lineHeight: 1.6 },
    edgeLine: { width: 18, height: 2, background: colors.bg.borderLight, borderRadius: 1, flexShrink: 0, marginTop: 7 },
    noEdgeNote: { display: 'flex', gap: 8, alignItems: 'flex-start', background: 'rgba(245,158,11,0.06)', border: `1px solid rgba(245,158,11,0.2)`, borderRadius: radius.md, padding: '10px 12px', fontSize: 12, color: colors.text.secondary, lineHeight: 1.6, marginTop: 4 },
    refList: { display: 'flex', flexDirection: 'column', gap: 4, maxHeight: 280, overflowY: 'auto' },
    refItem: { display: 'flex', gap: 8, alignItems: 'flex-start', padding: '6px 8px', borderRadius: radius.sm, cursor: 'pointer', transition: 'background 0.1s' },
    refItemSelected: { background: colors.brand.primaryGlow, border: `1px solid ${colors.brand.primary}30` },
    refItemRing: { borderLeft: `2px solid ${colors.status.high}` },
    refNum: { fontSize: 11, fontWeight: 700, flexShrink: 0, marginTop: 1 },
    refSnippet: { fontSize: 11, color: colors.text.muted, lineHeight: 1.5 },
    ringCard: { background: colors.bg.elevated, border: `1px solid rgba(239,68,68,0.2)`, borderRadius: radius.md, padding: '10px 12px', marginBottom: 8 },
    ringCardTitle: { fontSize: 12, fontWeight: 700, color: colors.status.high, marginBottom: 4 },
    ringCardDesc: { fontSize: 11, color: colors.text.secondary, lineHeight: 1.5, marginBottom: 8 },
    ringMembers: { display: 'flex', flexWrap: 'wrap', gap: 5 },
    ringMemberChip: { fontSize: 11, fontWeight: 700, color: colors.status.high, background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: radius.full, padding: '2px 8px', cursor: 'pointer' },
};
