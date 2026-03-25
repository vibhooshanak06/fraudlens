import React, { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { uploadPaper } from '../api';
import { colors, radius } from '../styles/tokens';

export default function UploadPage() {
    const [dragging, setDragging] = useState(false);
    const [progress, setProgress] = useState(0);
    const [uploading, setUploading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const inputRef = useRef<HTMLInputElement>(null);
    const navigate = useNavigate();

    async function handleFile(file: File) {
        if (!file.name.toLowerCase().endsWith('.pdf') || file.type !== 'application/pdf') {
            setError('Only PDF files are accepted. Please select a valid PDF document.');
            return;
        }
        if (file.size > 20 * 1024 * 1024) {
            setError('File exceeds the 20 MB limit. Please upload a smaller document.');
            return;
        }
        setSelectedFile(file);
        setError(null);
    }

    async function startUpload() {
        if (!selectedFile) return;
        setError(null);
        setUploading(true);
        setProgress(0);
        sessionStorage.removeItem('fraudlens_uuid');
        sessionStorage.removeItem('fraudlens_chat');

        let attempts = 0;
        while (attempts < 3) {
            try {
                const res = await uploadPaper(selectedFile, setProgress);
                sessionStorage.setItem('fraudlens_uuid', res.uuid);
                navigate(`/report/${res.uuid}`);
                return;
            } catch (err: any) {
                attempts++;
                const status = err?.response?.status;
                if (status === 400) { setError('Invalid file. Please upload a valid PDF document.'); break; }
                if (status === 413) { setError('File too large. Maximum allowed size is 20 MB.'); break; }
                if (attempts >= 3) setError('Upload failed after 3 attempts. Please check your connection and try again.');
            }
        }
        setUploading(false);
    }

    function onDrop(e: React.DragEvent) {
        e.preventDefault();
        setDragging(false);
        const file = e.dataTransfer.files[0];
        if (file) handleFile(file);
    }

    const fileSizeMB = selectedFile ? (selectedFile.size / 1024 / 1024).toFixed(2) : null;

    return (
        <div style={s.page}>
            <div style={s.header}>
                <h1 style={s.title}>New Analysis</h1>
                <p style={s.subtitle}>Upload a research paper PDF to begin fraud detection and analysis.</p>
            </div>

            <div style={s.layout}>
                {/* Upload area */}
                <div style={s.uploadCard}>
                    <div style={s.cardHeader}>
                        <div style={s.cardIcon}>
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                                <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M17 8l-5-5-5 5M12 3v12" stroke={colors.brand.primary} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                        </div>
                        <div>
                            <div style={s.cardTitle}>Upload Document</div>
                            <div style={s.cardSub}>PDF format · Max 20 MB</div>
                        </div>
                    </div>

                    {error && (
                        <div style={s.errorBox}>
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0 }}>
                                <circle cx="12" cy="12" r="10" stroke="#ef4444" strokeWidth="2" />
                                <line x1="12" y1="8" x2="12" y2="12" stroke="#ef4444" strokeWidth="2" strokeLinecap="round" />
                                <circle cx="12" cy="16" r="1" fill="#ef4444" />
                            </svg>
                            {error}
                        </div>
                    )}

                    {!uploading && !selectedFile && (
                        <div
                            style={{ ...s.dropzone, ...(dragging ? s.dropzoneActive : {}) }}
                            onDragOver={e => { e.preventDefault(); setDragging(true); }}
                            onDragLeave={() => setDragging(false)}
                            onDrop={onDrop}
                            onClick={() => inputRef.current?.click()}
                        >
                            <input ref={inputRef} type="file" accept=".pdf,application/pdf" style={{ display: 'none' }}
                                onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />
                            <div style={s.dropzoneIcon}>
                                <svg width="32" height="32" viewBox="0 0 24 24" fill="none">
                                    <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" stroke={dragging ? colors.brand.primary : colors.text.muted} strokeWidth="1.5" />
                                    <polyline points="14 2 14 8 20 8" stroke={dragging ? colors.brand.primary : colors.text.muted} strokeWidth="1.5" />
                                    <line x1="12" y1="18" x2="12" y2="12" stroke={dragging ? colors.brand.primary : colors.text.muted} strokeWidth="1.5" strokeLinecap="round" />
                                    <polyline points="9 15 12 12 15 15" stroke={dragging ? colors.brand.primary : colors.text.muted} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                                </svg>
                            </div>
                            <div style={s.dropTitle}>{dragging ? 'Drop your PDF here' : 'Drag & drop your PDF'}</div>
                            <div style={s.dropSub}>or <span style={{ color: colors.brand.primary, fontWeight: 500 }}>browse files</span> from your computer</div>
                            <div style={s.dropHint}>Supports: PDF · Max size: 20 MB</div>
                        </div>
                    )}

                    {selectedFile && !uploading && (
                        <div style={s.filePreview}>
                            <div style={s.fileIcon}>
                                <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                                    <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" stroke={colors.brand.primary} strokeWidth="1.8" />
                                    <polyline points="14 2 14 8 20 8" stroke={colors.brand.primary} strokeWidth="1.8" />
                                </svg>
                            </div>
                            <div style={s.fileInfo}>
                                <div style={s.fileName}>{selectedFile.name}</div>
                                <div style={s.fileMeta}>{fileSizeMB} MB · PDF Document</div>
                            </div>
                            <button style={s.removeBtn} onClick={() => setSelectedFile(null)}>
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                                    <line x1="18" y1="6" x2="6" y2="18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                                    <line x1="6" y1="6" x2="18" y2="18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                                </svg>
                            </button>
                        </div>
                    )}

                    {uploading && (
                        <div style={s.uploadProgress}>
                            <div style={s.progressHeader}>
                                <span style={s.progressLabel}>Uploading & processing…</span>
                                <span style={s.progressPct}>{progress}%</span>
                            </div>
                            <div style={s.progressTrack}>
                                <div style={{ ...s.progressFill, width: `${progress}%` }} />
                            </div>
                            <div style={s.progressSub}>AI analysis will begin automatically after upload</div>
                        </div>
                    )}

                    {selectedFile && !uploading && (
                        <button style={s.analyzeBtn} onClick={startUpload}>
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                                <circle cx="11" cy="11" r="8" stroke="white" strokeWidth="2" />
                                <path d="M21 21l-4.35-4.35" stroke="white" strokeWidth="2" strokeLinecap="round" />
                            </svg>
                            Start Analysis
                        </button>
                    )}
                </div>

                {/* Info panel */}
                <div style={s.infoPanel}>
                    <div style={s.infoCard}>
                        <div style={s.infoTitle}>What we analyze</div>
                        {[
                            { icon: '🔍', title: 'Plagiarism Detection', desc: 'TF-IDF cosine similarity against reference corpus' },
                            { icon: '🔄', title: 'Pattern Analysis', desc: 'Repeated sentences, overused keywords, structural anomalies' },
                            { icon: '📎', title: 'Citation Checking', desc: 'Mixed citation styles and format inconsistencies' },
                            { icon: '🤖', title: 'AI Summary', desc: 'Structured summary with contributions & methodology' },
                            { icon: '💬', title: 'Interactive Q&A', desc: 'RAG-based chatbot for paper-specific questions' },
                            { icon: '📚', title: 'Related Papers', desc: 'Semantic similarity recommendations' },
                        ].map(item => (
                            <div key={item.title} style={s.infoItem}>
                                <span style={s.infoItemIcon}>{item.icon}</span>
                                <div>
                                    <div style={s.infoItemTitle}>{item.title}</div>
                                    <div style={s.infoItemDesc}>{item.desc}</div>
                                </div>
                            </div>
                        ))}
                    </div>

                    <div style={s.timeCard}>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                            <circle cx="12" cy="12" r="10" stroke={colors.brand.primary} strokeWidth="1.8" />
                            <polyline points="12 6 12 12 16 14" stroke={colors.brand.primary} strokeWidth="1.8" strokeLinecap="round" />
                        </svg>
                        <div>
                            <div style={s.timeTitle}>Typical analysis time</div>
                            <div style={s.timeSub}>30–60 seconds for a standard research paper</div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

const s: Record<string, React.CSSProperties> = {
    page: { padding: '32px 36px', maxWidth: 1100, width: '100%' },
    header: { marginBottom: 32 },
    title: { fontSize: 26, fontWeight: 800, color: colors.text.primary, letterSpacing: '-0.5px', marginBottom: 6 },
    subtitle: { fontSize: 14, color: colors.text.secondary },
    layout: { display: 'grid', gridTemplateColumns: '1fr 340px', gap: 24, alignItems: 'start' },
    uploadCard: {
        background: colors.bg.surface, border: `1px solid ${colors.bg.border}`,
        borderRadius: radius.xl, padding: '28px',
    },
    cardHeader: { display: 'flex', alignItems: 'center', gap: 14, marginBottom: 24 },
    cardIcon: {
        width: 44, height: 44, background: colors.brand.primaryGlow, borderRadius: radius.md,
        display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
    },
    cardTitle: { fontSize: 17, fontWeight: 700, color: colors.text.primary },
    cardSub: { fontSize: 13, color: colors.text.muted, marginTop: 2 },
    errorBox: {
        display: 'flex', alignItems: 'center', gap: 10,
        background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)',
        borderRadius: radius.md, padding: '12px 16px', marginBottom: 20,
        fontSize: 14, color: '#fca5a5',
    },
    dropzone: {
        border: `2px dashed ${colors.bg.borderLight}`, borderRadius: radius.lg,
        padding: '52px 32px', textAlign: 'center', cursor: 'pointer',
        transition: 'all 0.2s', background: colors.bg.elevated,
    },
    dropzoneActive: { border: `2px dashed ${colors.brand.primary}`, background: colors.brand.primaryGlow },
    dropzoneIcon: { marginBottom: 16, display: 'flex', justifyContent: 'center' },
    dropTitle: { fontSize: 16, fontWeight: 600, color: colors.text.primary, marginBottom: 8 },
    dropSub: { fontSize: 14, color: colors.text.secondary, marginBottom: 16 },
    dropHint: { fontSize: 12, color: colors.text.muted, background: colors.bg.card, display: 'inline-block', padding: '4px 12px', borderRadius: radius.full },
    filePreview: {
        display: 'flex', alignItems: 'center', gap: 14,
        background: colors.bg.elevated, border: `1px solid ${colors.bg.border}`,
        borderRadius: radius.lg, padding: '16px 20px', marginBottom: 20,
    },
    fileIcon: {
        width: 44, height: 44, background: colors.brand.primaryGlow, borderRadius: radius.md,
        display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
    },
    fileInfo: { flex: 1, minWidth: 0 },
    fileName: { fontSize: 14, fontWeight: 600, color: colors.text.primary, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
    fileMeta: { fontSize: 12, color: colors.text.muted, marginTop: 3 },
    removeBtn: {
        background: 'none', border: 'none', color: colors.text.muted,
        cursor: 'pointer', padding: 6, borderRadius: radius.sm,
    },
    uploadProgress: { padding: '8px 0 20px' },
    progressHeader: { display: 'flex', justifyContent: 'space-between', marginBottom: 10 },
    progressLabel: { fontSize: 14, color: colors.text.secondary, fontWeight: 500 },
    progressPct: { fontSize: 14, color: colors.brand.primary, fontWeight: 700 },
    progressTrack: { background: colors.bg.border, borderRadius: 4, height: 8, overflow: 'hidden', marginBottom: 10 },
    progressFill: { background: colors.brand.gradient, height: '100%', borderRadius: 4, transition: 'width 0.3s' },
    progressSub: { fontSize: 12, color: colors.text.muted },
    analyzeBtn: {
        width: '100%', background: colors.brand.gradient, border: 'none',
        borderRadius: radius.md, color: '#fff', padding: '14px',
        fontSize: 15, fontWeight: 600, cursor: 'pointer',
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
    },
    infoPanel: { display: 'flex', flexDirection: 'column', gap: 16 },
    infoCard: {
        background: colors.bg.surface, border: `1px solid ${colors.bg.border}`,
        borderRadius: radius.xl, padding: '24px',
    },
    infoTitle: { fontSize: 13, fontWeight: 700, color: colors.text.muted, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 20 },
    infoItem: { display: 'flex', gap: 12, marginBottom: 18 },
    infoItemIcon: { fontSize: 18, flexShrink: 0, marginTop: 1 },
    infoItemTitle: { fontSize: 13, fontWeight: 600, color: colors.text.primary, marginBottom: 2 },
    infoItemDesc: { fontSize: 12, color: colors.text.muted, lineHeight: 1.5 },
    timeCard: {
        display: 'flex', gap: 12, alignItems: 'flex-start',
        background: colors.brand.primaryGlow, border: `1px solid ${colors.brand.primary}30`,
        borderRadius: radius.lg, padding: '16px 18px',
    },
    timeTitle: { fontSize: 13, fontWeight: 600, color: colors.text.primary, marginBottom: 3 },
    timeSub: { fontSize: 12, color: colors.text.secondary },
};
