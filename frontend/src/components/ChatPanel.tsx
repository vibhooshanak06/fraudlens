import React, { useState, useRef, useEffect } from 'react';
import { sendChat, Source } from '../api';
import { colors, radius } from '../styles/tokens';

interface Message { role: 'user' | 'assistant'; text: string; sources?: Source[]; }

interface Props { uuid: string; }

const suggestions = [
    'What is the main contribution of this paper?',
    'Summarize the methodology used',
    'What are the key findings?',
    'What limitations does this paper have?',
];

export default function ChatPanel({ uuid }: Props) {
    const [messages, setMessages] = useState<Message[]>([]);
    const [input, setInput] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const bottomRef = useRef<HTMLDivElement>(null);

    useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

    async function handleSend(text?: string) {
        const q = (text ?? input).trim();
        if (!q || loading) return;
        setInput('');
        setError(null);
        setMessages(prev => [...prev, { role: 'user', text: q }]);
        setLoading(true);
        try {
            const res = await sendChat(uuid, q);
            setMessages(prev => [...prev, { role: 'assistant', text: res.answer, sources: res.sources }]);
        } catch (err: any) {
            setError(err?.response?.data?.detail || err?.response?.data?.error || 'Failed to get a response. Please try again.');
        } finally {
            setLoading(false);
        }
    }

    return (
        <div style={s.container}>
            {/* Header */}
            <div style={s.header}>
                <div style={s.headerIcon}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                        <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" stroke={colors.brand.primary} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                </div>
                <div>
                    <div style={s.headerTitle}>AI Research Assistant</div>
                    <div style={s.headerSub}>Ask anything about this paper</div>
                </div>
                <div style={s.onlineDot} />
            </div>

            {/* Messages */}
            <div style={s.messages}>
                {messages.length === 0 && (
                    <div style={s.emptyState}>
                        <div style={s.emptyIcon}>
                            <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
                                <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" stroke={colors.text.muted} strokeWidth="1.5" />
                            </svg>
                        </div>
                        <div style={s.emptyTitle}>Start a conversation</div>
                        <div style={s.emptyDesc}>Ask questions about the paper's content, methodology, or findings.</div>
                        <div style={s.suggestions}>
                            {suggestions.map(s => (
                                <button key={s} style={suggStyle} onClick={() => handleSend(s)}>{s}</button>
                            ))}
                        </div>
                    </div>
                )}

                {messages.map((m, i) => (
                    <div key={i} style={m.role === 'user' ? s.userRow : s.aiRow}>
                        {m.role === 'assistant' && (
                            <div style={s.aiAvatar}>AI</div>
                        )}
                        <div style={m.role === 'user' ? s.userBubble : s.aiBubble}>
                            <div style={s.bubbleText}>{m.text}</div>
                            {m.sources && m.sources.length > 0 && (
                                <div style={s.sources}>
                                    <div style={s.sourcesLabel}>Sources</div>
                                    {m.sources.map((src, j) => (
                                        <div key={j} style={s.sourceItem}>
                                            <div style={s.sourceId}>§{src.chunk_id + 1}</div>
                                            <div style={s.sourceText}>{src.excerpt.slice(0, 140)}…</div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                        {m.role === 'user' && <div style={s.userAvatar}>You</div>}
                    </div>
                ))}

                {loading && (
                    <div style={s.aiRow}>
                        <div style={s.aiAvatar}>AI</div>
                        <div style={s.aiBubble}>
                            <div style={s.typing}>
                                <span style={s.dot} /><span style={{ ...s.dot, animationDelay: '0.2s' }} /><span style={{ ...s.dot, animationDelay: '0.4s' }} />
                            </div>
                        </div>
                    </div>
                )}

                {error && (
                    <div style={s.errorMsg}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0 }}>
                            <circle cx="12" cy="12" r="10" stroke="#ef4444" strokeWidth="1.8" />
                            <line x1="12" y1="8" x2="12" y2="12" stroke="#ef4444" strokeWidth="1.8" strokeLinecap="round" />
                            <circle cx="12" cy="16" r="1" fill="#ef4444" />
                        </svg>
                        {error}
                    </div>
                )}
                <div ref={bottomRef} />
            </div>

            {/* Input */}
            <div style={s.inputArea}>
                <div style={s.inputBox}>
                    <textarea
                        style={s.textarea}
                        value={input}
                        onChange={e => setInput(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
                        placeholder="Ask a question about this paper…"
                        rows={1}
                        disabled={loading}
                    />
                    <button
                        style={{ ...s.sendBtn, opacity: loading || !input.trim() ? 0.4 : 1 }}
                        onClick={() => handleSend()}
                        disabled={loading || !input.trim()}
                    >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                            <line x1="22" y1="2" x2="11" y2="13" stroke="white" strokeWidth="2" strokeLinecap="round" />
                            <polygon points="22 2 15 22 11 13 2 9 22 2" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                    </button>
                </div>
                <div style={s.inputHint}>Press Enter to send · Shift+Enter for new line</div>
            </div>
        </div>
    );
}

const suggStyle: React.CSSProperties = {
    background: colors.bg.elevated, border: `1px solid ${colors.bg.border}`,
    borderRadius: radius.full, color: colors.text.secondary, padding: '7px 14px',
    fontSize: 13, cursor: 'pointer', textAlign: 'left',
};

const s: Record<string, React.CSSProperties> = {
    container: {
        display: 'flex', flexDirection: 'column', height: '100%',
        background: colors.bg.surface, border: `1px solid ${colors.bg.border}`,
        borderRadius: radius.xl, overflow: 'hidden',
    },
    header: {
        display: 'flex', alignItems: 'center', gap: 12, padding: '16px 20px',
        borderBottom: `1px solid ${colors.bg.border}`, background: colors.bg.elevated, flexShrink: 0,
    },
    headerIcon: {
        width: 36, height: 36, background: colors.brand.primaryGlow, borderRadius: radius.md,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
    },
    headerTitle: { fontSize: 14, fontWeight: 700, color: colors.text.primary },
    headerSub: { fontSize: 12, color: colors.text.muted, marginTop: 1 },
    onlineDot: { width: 8, height: 8, borderRadius: '50%', background: colors.status.low, marginLeft: 'auto', boxShadow: `0 0 6px ${colors.status.low}` },
    messages: { flex: 1, overflowY: 'auto', padding: '20px', display: 'flex', flexDirection: 'column', gap: 16 },
    emptyState: { flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '32px 16px', textAlign: 'center' },
    emptyIcon: { width: 56, height: 56, background: colors.bg.elevated, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
    emptyTitle: { fontSize: 16, fontWeight: 600, color: colors.text.primary, marginBottom: 6 },
    emptyDesc: { fontSize: 13, color: colors.text.muted, marginBottom: 24, maxWidth: 320 },
    suggestions: { display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'center' },
    userRow: { display: 'flex', justifyContent: 'flex-end', alignItems: 'flex-end', gap: 10 },
    aiRow: { display: 'flex', justifyContent: 'flex-start', alignItems: 'flex-end', gap: 10 },
    userBubble: { background: colors.brand.gradient, borderRadius: '16px 16px 4px 16px', padding: '12px 16px', maxWidth: '75%' },
    aiBubble: { background: colors.bg.elevated, border: `1px solid ${colors.bg.border}`, borderRadius: '16px 16px 16px 4px', padding: '12px 16px', maxWidth: '80%' },
    bubbleText: { fontSize: 14, color: colors.text.primary, lineHeight: 1.65, whiteSpace: 'pre-wrap' },
    userAvatar: { width: 28, height: 28, borderRadius: '50%', background: colors.brand.gradient, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700, color: '#fff', flexShrink: 0 },
    aiAvatar: { width: 28, height: 28, borderRadius: '50%', background: colors.bg.card, border: `1px solid ${colors.bg.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700, color: colors.brand.primary, flexShrink: 0 },
    sources: { marginTop: 12, paddingTop: 12, borderTop: `1px solid ${colors.bg.border}` },
    sourcesLabel: { fontSize: 10, fontWeight: 700, color: colors.text.muted, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 },
    sourceItem: { display: 'flex', gap: 8, marginBottom: 6 },
    sourceId: { fontSize: 11, fontWeight: 700, color: colors.brand.primary, background: colors.brand.primaryGlow, borderRadius: radius.sm, padding: '2px 6px', flexShrink: 0 },
    sourceText: { fontSize: 12, color: colors.text.muted, lineHeight: 1.5 },
    typing: { display: 'flex', gap: 4, alignItems: 'center', padding: '4px 0' },
    dot: { width: 7, height: 7, borderRadius: '50%', background: colors.text.muted, animation: 'bounce 1.2s ease-in-out infinite' },
    errorMsg: { display: 'flex', alignItems: 'center', gap: 8, background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: radius.md, padding: '10px 14px', fontSize: 13, color: '#fca5a5' },
    inputArea: { padding: '16px 20px', borderTop: `1px solid ${colors.bg.border}`, background: colors.bg.elevated, flexShrink: 0 },
    inputBox: { display: 'flex', gap: 10, alignItems: 'flex-end' },
    textarea: {
        flex: 1, background: colors.bg.surface, border: `1px solid ${colors.bg.border}`,
        borderRadius: radius.lg, color: colors.text.primary, padding: '11px 14px',
        fontSize: 14, resize: 'none', outline: 'none', fontFamily: 'inherit', lineHeight: 1.5,
        maxHeight: 120, overflowY: 'auto',
    },
    sendBtn: {
        width: 40, height: 40, background: colors.brand.gradient, border: 'none',
        borderRadius: radius.md, cursor: 'pointer', display: 'flex',
        alignItems: 'center', justifyContent: 'center', flexShrink: 0,
    },
    inputHint: { fontSize: 11, color: colors.text.muted, marginTop: 8 },
};
