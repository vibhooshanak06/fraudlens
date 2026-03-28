import axios from 'axios';

const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000';

// Axios instance that auto-attaches JWT from localStorage
const api = axios.create({ baseURL: BASE_URL });

api.interceptors.request.use(config => {
    const token = localStorage.getItem('fl_token');
    if (token) config.headers.Authorization = `Bearer ${token}`;
    return config;
});

// Auth
export async function loginApi(email: string, password: string) {
    const res = await api.post('/auth/login', { email, password });
    return res.data as { token: string; user: User };
}

export async function signupApi(name: string, email: string, password: string) {
    const res = await api.post('/auth/signup', { name, email, password });
    return res.data as { token: string; user: User };
}

// Dashboard
export async function getDashboardStats(): Promise<DashboardStats> {
    const res = await api.get('/dashboard/stats');
    return res.data;
}

export async function getRecentPapers(): Promise<{ papers: PaperMeta[] }> {
    const res = await api.get('/dashboard/recent');
    return res.data;
}

export async function getAllPapers(page = 1, limit = 10): Promise<{ papers: PaperMeta[]; total: number; page: number }> {
    const res = await api.get(`/dashboard/papers?page=${page}&limit=${limit}`);
    return res.data;
}

// Papers
export async function uploadPaper(file: File, onProgress?: (pct: number) => void): Promise<{ uuid: string; status: string }> {
    const form = new FormData();
    form.append('file', file);
    const res = await api.post('/upload', form, {
        headers: { 'Content-Type': 'multipart/form-data' },
        onUploadProgress: e => { if (onProgress && e.total) onProgress(Math.round((e.loaded / e.total) * 100)); },
    });
    return res.data;
}

export async function getPaper(uuid: string): Promise<PaperRecord> {
    const res = await api.get(`/paper/${uuid}`);
    return res.data;
}

export async function analyzePaper(uuid: string) {
    const res = await api.post('/analyze', { uuid });
    return res.data;
}

export async function sendChat(uuid: string, question: string): Promise<{ answer: string; sources: Source[] }> {
    const res = await api.post('/chat', { uuid, question });
    return res.data;
}

export async function getRecommendations(query: string): Promise<{ results: Recommendation[] }> {
    const res = await api.post('/recommend', { query });
    return res.data;
}

export async function reprocessPaper(uuid: string): Promise<{ uuid: string; status: string; message: string }> {
    const res = await api.post(`/reprocess/${uuid}`);
    return res.data;
}

export function getExportPdfUrl(uuid: string): string {
    const token = localStorage.getItem('fl_token');
    return `${BASE_URL}/export/${uuid}/pdf?token=${token}`;
}

export async function updateProfile(name: string): Promise<{ name: string; avatar: string }> {
    const res = await api.put('/profile', { name });
    return res.data;
}

export async function updatePassword(current_password: string, new_password: string): Promise<void> {
    await api.put('/profile/password', { current_password, new_password });
}

export async function exportReportPdf(uuid: string): Promise<void> {
    const res = await api.get(`/export/${uuid}/pdf`, { responseType: 'blob' });
    const url = URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `fraudlens-report-${uuid.slice(0, 8)}.pdf`;
    a.click();
    URL.revokeObjectURL(url);
}

export async function getCitationGraph(uuid: string): Promise<CitationGraph> {
    const res = await api.get(`/citation/${uuid}/graph`);
    return res.data.graph;
}

// Types
export interface User {
    id: number;
    name: string;
    email: string;
    avatar: string;
    role: 'researcher' | 'admin';
    plan: 'free' | 'pro';
}

export interface DashboardStats {
    total_analyses: number;
    high_risk_count: number;
    cleared_count: number;
    avg_plagiarism: number;
}

export interface PaperMeta {
    uuid: string;
    filename: string;
    status: 'processing' | 'completed' | 'failed';
    risk_level: 'low' | 'medium' | 'high' | null;
    plagiarism_score: number | null;
    issue_count: number;
    uploaded_at: string;
    completed_at: string | null;
}

export interface Issue {
    type: string;
    description: string;
    excerpt: string;
}

export interface FraudReport {
    plagiarism_score: number;
    risk_level: 'low' | 'medium' | 'high';
    issues: Issue[];
    errors?: { module: string; error: string }[];
}

export interface Summary {
    title: string;
    main_contributions: string;
    methodology: string;
    conclusions: string;
}

export interface Source {
    chunk_id: number;
    excerpt: string;
}

export interface Recommendation {
    title: string;
    authors: string[];
    abstract_snippet: string;
    similarity_score: number;
}

export interface PaperRecord extends PaperMeta {
    fraud_report?: FraudReport;
    summary?: Summary;
    keywords?: string[];
}

export interface CitationNode {
    id: string;
    label: string;
}

export interface CitationEdge {
    source: string;
    target: string;
    weight: number;
}

export interface CitationRing {
    members: string[];
    size: number;
    description: string;
}

export interface CitationGraph {
    nodes: CitationNode[];
    edges: CitationEdge[];
    rings: CitationRing[];
    stats: {
        total_references: number;
        co_citation_pairs: number;
        ring_count: number;
    };
}
