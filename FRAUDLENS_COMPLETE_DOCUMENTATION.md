# FraudLens — Complete Project Documentation
> **Purpose:** This document teaches you every single line of FraudLens from first principles to production-level, so you can explain it confidently in any interview.

---

## TABLE OF CONTENTS

1. [Project Overview](#1-project-overview)
2. [Architecture](#2-architecture)
3. [Folder Structure](#3-folder-structure)
4. [Frontend](#4-frontend)
5. [Backend](#5-backend)
6. [Database — MySQL](#6-database--mysql)
7. [Database — MongoDB](#7-database--mongodb)
8. [Storage — Supabase](#8-storage--supabase)
9. [AI Engine](#9-ai-engine)
10. [PDF Processing](#10-pdf-processing)
11. [Embeddings & FAISS](#11-embeddings--faiss)
12. [Security](#12-security)



13. [Deployment](#13-deployment)
14. [Complete Tech Stack](#14-complete-tech-stack)
15. [Complete Execution Flow](#15-complete-execution-flow)
16. [Interview Preparation](#16-interview-preparation)
17. [Code Review & Issues](#17-code-review--issues)
18. [Visual Diagrams](#18-visual-diagrams)
19. [Resume Explanation](#19-resume-explanation)
20. [Master Notes & Revision Guide](#20-master-notes--revision-guide)

---


---

# 1. PROJECT OVERVIEW

## What is FraudLens?

FraudLens is a **Research Paper Integrity Analysis Platform**. It lets a researcher upload a PDF of an academic paper and receive back a full fraud/plagiarism analysis report within 30–60 seconds.

Think of it as TurnitIn + Grammarly + an AI chatbot, all in one — but purpose-built for detecting academic fraud patterns.

## What Problem Does It Solve?

Academic fraud is a growing problem:
- Researchers submit plagiarised content verbatim or paraphrased.
- Citation manipulation: groups of researchers cite each other artificially to inflate impact scores ("citation rings").
- Structurally weak papers with copy-pasted boilerplate.
- Mixed citation styles indicating patchwork writing.

No free, open tool gave researchers an instant, automated fraud report + chatbot + recommendations. FraudLens fills that gap.

## Who Are the Users?

- **University researchers** checking their own papers before submission.
- **Journal reviewers** doing a quick pre-screening.
- **PhD students** verifying their thesis sections.
- **Academic integrity officers** auditing papers at scale.

## Real-World Use Case

> A Masters student at a university is about to submit a paper. She uploads the PDF to FraudLens. In 45 seconds she gets back:
> - Plagiarism score: 34% (Medium Risk)
> - 2 issues: one repeated sentence, one inconsistent citation style
> - An AI summary confirming the paper's contributions
> - A citation graph showing no rings
> - 10 related papers she could cite to strengthen her literature review
> - A chatbot she can ask "What did my methodology section say?"

## Why This Architecture Was Chosen

The project is split into **3 independent services** for very good reasons:

| Concern | Solution | Reason |
|---|---|---|
| AI/ML is CPU/RAM heavy | Separate Python FastAPI service | Don't bloat the Node.js backend with ML libraries |
| Node.js excels at I/O and auth | Node.js Express backend | Fast, non-blocking, ideal for REST APIs |
| React is best for complex UIs | React + Vite frontend | Component-based, fast hot reload, TypeScript safety |
| PDF files shouldn't live on app servers | Supabase Storage | Ephemeral file systems on Render/Railway — files would vanish on restart |
| Structured queries need RDBMS | MySQL | User auth, paper metadata, filtering, sorting, aggregation |
| Flexible AI output needs document store | MongoDB | Fraud reports, summaries vary per paper; no fixed schema |

## High-Level Workflow

```
User → Login → Upload PDF → Backend saves to Supabase → triggers AI Engine
                                                              ↓
                                              AI downloads PDF from Supabase
                                              Runs: plagiarism + patterns + citations + summary + embeddings
                                              Writes results to MongoDB
                                              Updates MySQL status
                                              ↓
Frontend polls every 3s → Paper ready → Renders full report
User can: Chat with AI about paper | Explore citation graph | Get related papers | Export PDF report
```

---


---

# 2. ARCHITECTURE

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          Browser (React + TypeScript)                        │
│              Vite · React Router v6 · Recharts · Axios                       │
│              https://fraudlens-pi.vercel.app                                 │
│              Hosted on: Vercel                                                │
└──────────────────────────────┬──────────────────────────────────────────────┘
                               │ REST API calls with JWT Bearer token
                               │ (HTTPS)
                               ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                     Backend (Node.js / Express)                              │
│              https://fraudlens-0b7u.onrender.com                             │
│              Hosted on: Render                                               │
│                                                                             │
│  Routes: /auth /upload /analyze /paper /dashboard /chat                     │
│          /recommend /citation /export /reprocess /profile /stats            │
│                                                                             │
│  ┌──────────────────┐   ┌───────────────────┐   ┌──────────────────────┐   │
│  │  MySQL (Railway)  │   │  MongoDB (Atlas)   │   │  Supabase Storage    │   │
│  │  users, sessions  │   │  papers collection │   │  PDF files (public)  │   │
│  │  papers metadata  │   │  fraud_report,     │   │  bucket: papers      │   │
│  │  dashboard_stats  │   │  summary, keywords │   │                      │   │
│  └──────────────────┘   └───────────────────┘   └──────────────────────┘   │
└──────────────────────────────┬──────────────────────────────────────────────┘
                               │ POST /process { uuid, pdf_url }
                               │ fire-and-forget (no await)
                               ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                     AI Engine (Python / FastAPI)                             │
│              https://fraudlens-production-3c1f.up.railway.app                │
│              Hosted on: Railway                                              │
│                                                                             │
│  POST /process           → full pipeline (PDF → report)                     │
│  POST /chat              → RAG Q&A over FAISS index                         │
│  POST /recommend         → cosine similarity on corpus                      │
│  POST /citation-graph    → co-citation ring detection                       │
│  POST /reprocess-summary → re-run LLM summary from stored text              │
│  GET  /health                                                                │
│                                                                             │
│  ┌──────────────────┐  ┌──────────────┐  ┌───────────────────────────────┐ │
│  │  FAISS indexes   │  │  MongoDB     │  │  OpenRouter LLM API           │ │
│  │  .index          │  │  (motor      │  │  + sentence-transformers      │ │
│  │  .chunks         │  │  async       │  │  all-MiniLM-L6-v2 (384-dim)  │ │
│  │  .dim            │  │  driver)     │  │  local, no API call needed    │ │
│  └──────────────────┘  └──────────────┘  └───────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Data Stores at a Glance

| Store | What Lives Here | Why |
|---|---|---|
| MySQL (Railway) | users, sessions, papers metadata, dashboard_stats | Relational, indexed, supports COUNT/AVG/SUM queries |
| MongoDB (Atlas) | fraud_report, summary, keywords, extracted_text | Variable schema per paper; no need for fixed columns |
| Supabase Storage | PDF binary files | Persistent file storage; public URL accessible by AI engine without credentials |
| FAISS (disk on Railway) | Vector embeddings per paper (.index/.chunks/.dim) | Nearest-neighbour search for RAG chatbot |

---


---

# 3. FOLDER STRUCTURE

```
fraudlens/                          ← Root monorepo
├── .env                            ← Root env (only OPENROUTER_API_KEY)
├── .env.example                    ← Template showing required vars
├── .gitignore                      ← Ignores: .env, node_modules, __pycache__, uploads, faiss_indexes, dist
├── README.md                       ← Full project documentation
│
├── frontend/                       ← React 18 + TypeScript + Vite app
│   ├── .env                        ← VITE_API_URL=https://fraudlens-0b7u.onrender.com
│   ├── index.html                  ← Root HTML, mounts <div id="root">
│   ├── package.json                ← Dependencies: react, axios, react-router-dom, recharts
│   ├── vite.config.ts              ← Vite config: React plugin, port 3000, test config
│   ├── tsconfig.json               ← TypeScript strict config
│   ├── vercel.json                 ← SPA rewrite: all routes → /index.html
│   └── src/
│       ├── main.tsx                ← Entry point: mounts <App> into #root
│       ├── App.tsx                 ← Router setup + PrivateRoute/PublicRoute guards
│       ├── api.ts                  ← All API calls (Axios) + TypeScript interfaces
│       ├── vite-env.d.ts           ← Vite env type declarations
│       ├── test-setup.ts           ← Testing Library setup
│       ├── styles/
│       │   └── tokens.ts           ← Design system: colors + border-radius constants
│       ├── context/
│       │   └── AuthContext.tsx     ← React Context: user, token, login, signup, logout
│       ├── components/
│       │   ├── AppShell.tsx        ← Sidebar layout + navigation
│       │   ├── FraudReportPanel.tsx← Plagiarism score + issues display
│       │   ├── SummaryPanel.tsx    ← AI summary + keywords
│       │   ├── ChatPanel.tsx       ← RAG chatbot UI
│       │   ├── CitationGraphPanel.tsx ← SVG force-directed citation graph
│       │   └── RecommendPanel.tsx  ← Related papers search + results
│       └── pages/
│           ├── LoginPage.tsx       ← Email/password login form
│           ├── SignupPage.tsx      ← Registration form
│           ├── DashboardHome.tsx   ← Stats cards + recent papers
│           ├── UploadPage.tsx      ← Drag-and-drop PDF upload
│           ├── ReportPage.tsx      ← Full analysis report with tabs
│           ├── PapersPage.tsx      ← Paginated paper history
│           └── ProfilePage.tsx     ← Name + password update
│
├── backend/                        ← Node.js 18 + Express API
│   ├── .env                        ← All backend secrets
│   ├── package.json                ← Dependencies: express, mysql2, mongoose, bcryptjs, jwt, multer, etc.
│   ├── scripts/
│   │   └── init-mysql.js           ← One-time DB schema creation script
│   ├── uploads/                    ← Temporary PDF storage (files deleted immediately after Supabase upload)
│   └── src/
│       ├── index.js                ← Express app setup + middleware + route mounting
│       ├── db.js                   ← MongoDB connection (mongoose)
│       ├── mysql.js                ← MySQL connection pool (mysql2/promise)
│       ├── middleware/
│       │   └── auth.js             ← requireAuth: JWT verify + session DB check
│       ├── models/
│       │   └── Paper.js            ← Mongoose schema for MongoDB papers collection
│       └── routes/
│           ├── auth.js             ← /signup /login /logout /me
│           ├── upload.js           ← /upload (multer → Supabase → MySQL → AI Engine)
│           ├── analyze.js          ← /analyze (poll endpoint: MySQL status check)
│           ├── paper.js            ← /paper/:uuid (MySQL + MongoDB merged)
│           ├── dashboard.js        ← /dashboard/stats /recent /papers
│           ├── chat.js             ← /chat (proxy to AI engine)
│           ├── recommend.js        ← /recommend (proxy to AI engine)
│           ├── citation.js         ← /citation/:uuid/graph (proxy to AI engine)
│           ├── export.js           ← /export/:uuid/pdf (PDFKit report generation)
│           ├── reprocess.js        ← /reprocess/:uuid (retry failed analysis)
│           ├── profile.js          ← /profile (name update + password change)
│           └── stats.js            ← /stats/platform (public platform-wide stats)
│
└── ai-engine/                      ← Python 3.11 + FastAPI
    ├── .env                        ← MONGO_URI, OPENROUTER_API_KEY, FAISS_STORE_PATH
    ├── requirements.txt            ← fastapi, uvicorn, pdfplumber, scikit-learn, faiss-cpu, sentence-transformers, motor, etc.
    ├── main.py                     ← FastAPI app: all routes + MongoDB connection
    ├── faiss_indexes/              ← FAISS index files per paper (uuid.index, uuid.chunks, uuid.dim)
    └── modules/
        ├── __init__.py             ← Empty package marker
        ├── llm.py                  ← OpenRouter API client + sentence-transformers embedder
        ├── pdf_processor.py        ← pdfplumber text extraction (2-column aware)
        ├── downloader.py           ← HTTP PDF downloader to temp file
        ├── fraud_detector.py       ← Orchestrator: runs plagiarism + patterns + citations concurrently
        ├── plagiarism.py           ← TF-IDF cosine similarity plagiarism score
        ├── pattern_detector.py     ← Repeated sentences, overused keywords, structure check
        ├── citation_checker.py     ← Mixed citation styles + citation graph + ring detection
        ├── embedder.py             ← Text chunking + FAISS index build/search
        ├── summarizer.py           ← LLM summary with text fallback
        ├── chatbot.py              ← RAG: FAISS search + LLM answer
        └── recommender.py          ← Cosine similarity against 12-paper corpus
```

---


---

# 4. FRONTEND

## Overview

The frontend is a **React 18 Single-Page Application (SPA)** written in **TypeScript**, bundled with **Vite**, and hosted on **Vercel**.

- It has NO server-side rendering.
- All routing is client-side via React Router v6.
- All styles are **inline CSS-in-JS** (style objects), using a shared `tokens.ts` design system.
- State is managed via React `useState` and `useEffect` (no Redux).
- Auth state is global via React Context.
- API calls use **Axios** with an interceptor that auto-attaches the JWT.

---

## `frontend/src/main.tsx` — Entry Point

```typescript
import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";

ReactDOM.createRoot(document.getElementById("root")!).render(
    <React.StrictMode>
        <App />
    </React.StrictMode>
);
```

**What it does:**
- `document.getElementById("root")` — finds the `<div id="root">` in `index.html`.
- `ReactDOM.createRoot` — React 18's new concurrent rendering API (replaces `ReactDOM.render`).
- `React.StrictMode` — In development, renders components twice to catch side-effects. Has no production effect.
- Mounts the entire React tree starting from `<App />`.

**Why React 18's `createRoot`?** It unlocks concurrent features like `useTransition`, `Suspense` streaming, and automatic batching of state updates.

---

## `frontend/src/App.tsx` — Router + Auth Guards

This is the routing brain. It wraps everything in `AuthProvider` and defines all routes.

### Key Concepts

**`AuthProvider`** — wraps the entire app so any component can access `user` and auth methods via `useAuth()`.

**`BrowserRouter`** — enables HTML5 History API routing (`/dashboard` instead of `/#/dashboard`).

**`PrivateRoute`** — a Higher-Order Component (HOC) pattern:
```typescript
function PrivateRoute({ children }) {
    const { user, loading } = useAuth();
    if (loading) return <LoadingScreen />;
    if (!user) return <Navigate to="/login" replace />;
    return <AppShell>{children}</AppShell>;
}
```
- If auth state is still loading (checking localStorage), show a spinner.
- If no user, redirect to `/login`.
- If authenticated, wrap children in `<AppShell>` (the sidebar layout).

**`PublicRoute`** — inverse: redirects logged-in users away from `/login` and `/signup` to `/dashboard`.

### CSS Animations

```typescript
@keyframes spin { to { transform: rotate(360deg); } }
@keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }
@keyframes bounce { 0%, 80%, 100% { transform: scale(0); } 40% { transform: scale(1); } }
```
These are globally injected via a `<style>` tag. They power spinners, skeleton loaders, and typing dots.

### Route Table

| Path | Component | Guard |
|---|---|---|
| `/login` | LoginPage | PublicRoute |
| `/signup` | SignupPage | PublicRoute |
| `/dashboard` | DashboardHome | PrivateRoute |
| `/upload` | UploadPage | PrivateRoute |
| `/report/:uuid` | ReportPage | PrivateRoute |
| `/papers` | PapersPage | PrivateRoute |
| `/profile` | ProfilePage | PrivateRoute |
| `*` | Navigate to `/dashboard` | — |

---


---

## `frontend/src/context/AuthContext.tsx` — Global Auth State

### What is React Context?

Context is React's built-in state sharing mechanism. Without it, you'd pass `user` and `login` as props through every component (`prop drilling`). Context lets any component subscribe directly.

```typescript
const AuthContext = createContext<AuthContextType | null>(null);
```

### AuthProvider

Wraps the app and provides state + methods:
- `user` — the logged-in user object (`id, name, email, avatar, role, plan`)
- `token` — the raw JWT string
- `loading` — `true` while reading from localStorage on first render
- `login(email, password)` — POST to `/auth/login`, store token + user
- `signup(name, email, password)` — POST to `/auth/signup`
- `logout()` — POST to `/auth/logout` (deletes DB session), clears localStorage

### Persistence

```typescript
useEffect(() => {
    const storedToken = localStorage.getItem('fl_token');
    const storedUser = localStorage.getItem('fl_user');
    if (storedToken && storedUser) {
        setToken(storedToken);
        setUser(JSON.parse(storedUser));
    }
    setLoading(false);
}, []);
```

On first render, reads from `localStorage`. This is how the user stays logged in after refreshing the browser. The JWT expiry is 7 days.

**Security note:** Storing JWT in `localStorage` is the standard approach for SPAs but is vulnerable to XSS. An HttpOnly cookie would be more secure but requires backend CORS changes.

### `useAuth()` hook

```typescript
export function useAuth() {
    const ctx = useContext(AuthContext);
    if (!ctx) throw new Error('useAuth must be used within AuthProvider');
    return ctx;
}
```

Any component calls `const { user, login, logout } = useAuth()`.

---

## `frontend/src/api.ts` — API Layer

This is the **single source of truth** for all backend communication.

### Axios Instance

```typescript
const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000';
const api = axios.create({ baseURL: BASE_URL });
```

**`import.meta.env`** is Vite's way of accessing environment variables. Only variables prefixed with `VITE_` are exposed to the browser.

### Request Interceptor

```typescript
api.interceptors.request.use(config => {
    const token = localStorage.getItem('fl_token');
    if (token) config.headers.Authorization = `Bearer ${token}`;
    return config;
});
```

**Interceptors** run before every request. This one automatically attaches the JWT as a Bearer token header. You never have to manually add `Authorization` headers in individual API calls.

### Key Functions

| Function | Method | URL | What it returns |
|---|---|---|---|
| `loginApi` | POST | `/auth/login` | `{ token, user }` |
| `signupApi` | POST | `/auth/signup` | `{ token, user }` |
| `getPlatformStats` | GET | `/stats/platform` | `PlatformStats` |
| `getDashboardStats` | GET | `/dashboard/stats` | `DashboardStats` |
| `getRecentPapers` | GET | `/dashboard/recent` | `{ papers }` |
| `getAllPapers` | GET | `/dashboard/papers` | `{ papers, total, page }` |
| `uploadPaper` | POST | `/upload` | `{ uuid, status }` |
| `getPaper` | GET | `/paper/:uuid` | `PaperRecord` |
| `sendChat` | POST | `/chat` | `{ answer, sources }` |
| `getRecommendations` | POST | `/recommend` | `{ results }` |
| `reprocessPaper` | POST | `/reprocess/:uuid` | `{ uuid, status }` |
| `exportReportPdf` | GET | `/export/:uuid/pdf` | Downloads blob as file |
| `getCitationGraph` | GET | `/citation/:uuid/graph` | `CitationGraph` |
| `updateProfile` | PUT | `/profile` | `{ name, avatar }` |
| `updatePassword` | PUT | `/profile/password` | void |

### TypeScript Interfaces

All response shapes are typed. This means TypeScript will catch API shape mismatches at compile time:
- `User` — id, name, email, avatar, role, plan
- `PaperMeta` — uuid, filename, status, risk_level, plagiarism_score, etc.
- `FraudReport` — plagiarism_score, risk_level, issues[]
- `Summary` — title, main_contributions, methodology, conclusions
- `PaperRecord` — extends PaperMeta + fraud_report + summary + keywords
- `CitationGraph` — nodes[], edges[], rings[], stats

---


---

## `frontend/src/styles/tokens.ts` — Design System

This file defines the entire visual language of FraudLens in a centralized place.

```typescript
export const colors = {
    bg: {
        base: '#060b18',      // Darkest background (page bg)
        surface: '#0d1526',   // Cards, panels
        elevated: '#111d35',  // Inputs, secondary elements
        card: '#162040',      // Dropdown menus
        border: '#1e2d4a',    // Dividers and borders
        borderLight: '#243558', // Lighter borders
    },
    brand: {
        primary: '#4f8ef7',   // Blue — buttons, links, active states
        gradient: 'linear-gradient(135deg, #4f8ef7 0%, #7c3aed 100%)', // Blue → Purple
        primaryGlow: 'rgba(79,142,247,0.15)', // Subtle blue tint for backgrounds
    },
    text: {
        primary: '#f0f4ff',   // Near-white for headings
        secondary: '#8fa3c8', // Body text
        muted: '#4a6080',     // Labels, hints, disabled
    },
    status: {
        low: '#10b981',       // Green — low risk, success
        medium: '#f59e0b',    // Amber — medium risk, warning
        high: '#ef4444',      // Red — high risk, error
    }
};

export const radius = {
    sm: '6px', md: '10px', lg: '14px', xl: '20px', full: '9999px'
};
```

**Why use a tokens file?** Consistency. If you want to change the brand blue, you change it in one place. Every component imports from here.

---

## `frontend/src/components/AppShell.tsx` — Layout

The persistent sidebar layout that wraps all authenticated pages.

**Structure:**
```
<div style={shell}> = display:flex, height:100vh, overflow:hidden
    <aside style={sidebar}> = 240px wide, dark background
        Logo
        Nav links (Dashboard, New Analysis, My Papers)
        Bottom: user card with dropdown (Profile, Sign out)
    </aside>
    <main style={main}> = flex:1, overflow:auto
        {children} ← actual page content goes here
    </main>
</div>
```

**Active route detection:**
```typescript
const activeId = navItems.find(n => location.pathname.startsWith(n.path))?.id ?? 'dashboard';
```
Uses `useLocation()` from React Router to get the current path, then finds which nav item matches.

**User dropdown** uses a local `showUserMenu` state toggle, not a library. Clicking the user card shows a menu with "Profile settings" and "Sign out".

---

## Pages — Deep Dive

### `LoginPage.tsx`

**State:**
- `email`, `password` — controlled inputs
- `loading` — disables button during request
- `error` — displays error message box
- `platformStats` — loads real platform stats (papers analyzed, accuracy, speed) to display on the left panel

**Flow:**
1. On mount, `getPlatformStats()` fetches `/stats/platform` (no auth needed) and populates the left-panel numbers.
2. User fills email + password.
3. `handleSubmit` calls `login(email, password)` from `AuthContext`.
4. On success, `navigate('/dashboard')`.
5. On error, shows the error box.

**Two-panel layout:** Left = branding + features + live stats. Right = login form. This is a common SaaS pattern.

---

### `UploadPage.tsx`

**State:**
- `dragging` — CSS border color change while file is being dragged over
- `uploading` — shows progress bar
- `progress` — 0–100 number for progress bar width
- `selectedFile` — file object before upload starts
- `error` — validation or upload error

**Drag and Drop:**
```typescript
onDragOver={e => { e.preventDefault(); setDragging(true); }}
onDragLeave={() => setDragging(false)}
onDrop={onDrop}
```
`e.preventDefault()` is required — without it the browser would navigate to the dropped file.

**File validation** happens client-side:
```typescript
if (!file.name.toLowerCase().endsWith('.pdf') || file.type !== 'application/pdf')
if (file.size > 20 * 1024 * 1024)
```
Checks both MIME type and extension to prevent non-PDF files.

**Retry logic:**
```typescript
while (attempts < 3) {
    try {
        const res = await uploadPaper(selectedFile, setProgress);
        navigate(`/report/${res.uuid}`);
        return;
    } catch (err) {
        attempts++;
        ...
    }
}
```
Automatically retries upload up to 3 times for network errors.

**Upload progress:**
Axios `onUploadProgress` callback updates the progress bar:
```typescript
onUploadProgress: e => { if (onProgress && e.total) onProgress(Math.round((e.loaded / e.total) * 100)); }
```

After upload, immediately navigates to `/report/:uuid` while AI processing happens in background.

---


---

### `ReportPage.tsx`

This is the most complex page. It handles live polling, tab switching, and rendering multiple panels.

**State:**
- `paper` — the full `PaperRecord` object
- `loading` — initial load spinner
- `error` — fetch error message
- `tab` — which panel is visible: `'report' | 'citations' | 'chat' | 'recommendations'`
- `retrying` — prevents double-click on retry
- `exporting` — shows spinner while downloading PDF

**Polling Logic:**
```typescript
const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

const startPolling = useCallback((uuid) => {
    stopPolling(); // clear any existing before starting
    intervalRef.current = setInterval(async () => {
        const data = await getPaper(uuid);
        setPaper(data);
        if (data.status !== 'processing') stopPolling();
    }, 3000);
}, [stopPolling]);
```

**Why `useRef` for the interval?** `setInterval` returns an ID. Storing it in state would cause re-renders. `useRef` gives a mutable container that survives re-renders without triggering them.

**Why `useCallback`?** `startPolling` and `stopPolling` are used as dependencies in `useEffect`. Without `useCallback`, they'd be recreated on every render, causing infinite loops in `useEffect`.

**Cleanup:**
```typescript
useEffect(() => () => stopPolling(), [stopPolling]);
```
This cleanup function runs when the component unmounts, preventing memory leaks.

**Tab System:**
```typescript
const tabs = [
    { id: 'report', label: 'Fraud Report', icon: ... },
    { id: 'citations', label: 'Citation Graph', icon: ... },
    { id: 'chat', label: 'AI Assistant', icon: ... },
    { id: 'recommendations', label: 'Related Papers', icon: ... },
];
```
Each tab shows a different child component. The active tab has a bottom border indicator (CSS `position: absolute`).

**Export PDF:**
```typescript
async function handleExport() {
    const res = await api.get(`/export/${uuid}/pdf`, { responseType: 'blob' });
    const url = URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `fraudlens-report-${uuid.slice(0,8)}.pdf`;
    a.click();
    URL.revokeObjectURL(url);
}
```
Creates a temporary browser URL for the blob, programmatically clicks a hidden `<a>` tag to trigger download, then releases the memory.

---

### `DashboardHome.tsx`

**State:**
- `stats` — DashboardStats (total_analyses, high_risk_count, cleared_count, avg_plagiarism)
- `papers` — last 5 papers

**Parallel data loading:**
```typescript
Promise.all([getDashboardStats(), getRecentPapers()])
    .then(([s, p]) => { setStats(s); setPapers(p.papers); })
```
`Promise.all` fires both requests simultaneously and waits for both. Faster than sequential awaits.

**Stat cards** are generated from an array, not hardcoded:
```typescript
const statCards = stats ? [
    { label: 'Total Analyses', value: stats.total_analyses, ... },
    ...
] : [];
```
This is data-driven rendering — easy to add/remove cards.

**Skeleton loaders** while loading:
```typescript
{loading ? [1,2,3,4].map(i => <div key={i} style={{...s.statCard, ...s.skeleton}} />) : statCards.map(...)}
```
Shows empty animated boxes with `animation: 'pulse 1.5s ease-in-out infinite'` while waiting for data. Better UX than a blank screen.

**`timeAgo` utility:**
```typescript
function timeAgo(dateStr) {
    const diff = Date.now() - new Date(dateStr).getTime();
    const m = Math.floor(diff / 60000);
    if (m < 1) return 'Just now';
    if (m < 60) return `${m}m ago`;
    ...
}
```
Converts an ISO timestamp to a human-readable relative string. Used across multiple pages.

---

### `ChatPanel.tsx`

**State:**
- `messages` — array of `{ role: 'user' | 'assistant', text, sources? }`
- `input` — controlled textarea value
- `loading` — shows typing animation

**Auto-scroll:**
```typescript
const bottomRef = useRef<HTMLDivElement>(null);
useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);
```
Every time `messages` array changes, scrolls the invisible `<div ref={bottomRef}>` at the bottom into view.

**Enter to send:**
```typescript
onKeyDown={e => {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSend();
    }
}}
```
Enter sends, Shift+Enter adds a new line (standard chat UX).

**Sources display:**
Each AI response includes FAISS `sources` — the text chunks that informed the answer. These are displayed below the message bubble with section IDs like `§1`, `§2`.

**Suggestion chips** appear when the chat is empty. Clicking one auto-sends that question.

---

### `CitationGraphPanel.tsx`

This is the most technically interesting component. It implements a **force-directed graph layout** using pure JavaScript — no D3.js library.

**`useForceLayout` custom hook:**
```typescript
function useForceLayout(nodes, edges, width, height) {
    const [positions, setPositions] = useState({});

    useEffect(() => {
        // Initialize: place nodes in a circle
        // Run 150 iterations of Fruchterman-Reingold algorithm:
        //   Repulsion: nodes push each other away (O(n²))
        //   Attraction: edges pull connected nodes together
        //   Damping: velocities decay each iteration
        // Final positions stored in state
    }, [nodes, edges, width, height]);

    return positions;
}
```

**Force-directed graphs** model nodes as charged particles and edges as springs. After many iterations, the layout stabilizes naturally — connected nodes cluster together.

**SVG rendering:**
```typescript
<svg width={520} height={460}>
    {/* Edges first (behind nodes) */}
    {graph.edges.map(e => <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} strokeWidth={e.weight} />)}
    
    {/* Nodes on top */}
    {graph.nodes.map(n => (
        <circle cx={p.x} cy={p.y} r={isRing ? 9 : 7}
            fill={isRing ? colors.status.high : colors.brand.primary} />
    ))}
</svg>
```
- Red nodes = citation ring members (fraud signal)
- Thicker edges = cited together more frequently
- Click a node = highlights its connections, shows reference detail in sidebar

---


---

# 5. BACKEND

## Overview

The backend is a **Node.js 18 + Express** REST API. It:
- Authenticates users (JWT + DB session)
- Accepts PDF uploads (Multer → Supabase)
- Stores metadata in MySQL
- Stores analysis data in MongoDB
- Proxies requests to the AI engine
- Generates PDF export reports (PDFKit)

**Why Node.js?** Non-blocking I/O model is perfect for an API server that mostly waits on database queries and external HTTP calls (AI engine, Supabase).

---

## `backend/src/index.js` — Express App Entry

```javascript
require('dotenv').config();
const express = require('express');
const cors = require('cors');
```

**`dotenv`** — loads `.env` file into `process.env` before anything else runs.

**Middleware stack (in order):**
1. `cors({ origin: '*' })` — allows requests from any origin (Vercel frontend).
2. `express.json()` — parses JSON request bodies.
3. `express.urlencoded({ extended: true })` — parses form bodies.

**Startup sequence:**
```javascript
pool.query('SELECT 1')
    .then(() => {
        console.log('MySQL connected');
        connectMongo(); // non-blocking
        app.listen(PORT, ...);
    })
    .catch(err => {
        console.error('MySQL connection failed');
        process.exit(1);
    });
```
Tests MySQL connection first. If MySQL is down, the server exits rather than starting in a broken state. MongoDB is non-fatal — the app continues if MongoDB is unavailable.

**Two error handlers:**
```javascript
// JSON parse errors (malformed request body)
app.use((err, req, res, next) => {
    if (err.type === 'entity.parse.failed')
        return res.status(400).json({ error: 'Invalid JSON in request body' });
    next(err);
});

// Global catch-all error handler
app.use((err, req, res, _next) => {
    console.error(err.stack?.split('\n')[0]);
    res.status(500).json({ error: 'Internal server error' });
});
```

---

## `backend/src/mysql.js` — MySQL Connection Pool

```javascript
const pool = mysql.createPool({
    host, port, user, password, database,
    waitForConnections: true,
    connectionLimit: 10,  // max 10 simultaneous connections
    queueLimit: 0,        // unlimited queuing
    timezone: '+00:00',   // all dates stored as UTC
});
```

**Connection Pool** — instead of creating a new DB connection per request (slow), a pool maintains a set of open connections and hands them out. `connectionLimit: 10` means max 10 concurrent DB operations.

**`mysql2/promise`** — the promise-based variant of mysql2. Allows `await pool.query(...)` instead of callbacks.

**Parameterized queries:**
```javascript
pool.query('SELECT * FROM users WHERE email = ?', [email])
```
The `?` placeholder is replaced by the driver with proper escaping. This prevents **SQL injection**.

---

## `backend/src/db.js` — MongoDB Connection

```javascript
async function connectMongo() {
    const uri = process.env.MONGO_URI;
    try {
        await mongoose.connect(uri);
        console.log('MongoDB connected');
    } catch (err) {
        console.error('MongoDB connection error:', err.message);
        // Non-fatal — MySQL is primary
    }
}
```

MongoDB is treated as **secondary** storage. If it fails to connect, the backend still starts. MySQL handles critical auth and metadata.

**`mongoose`** is an ODM (Object Document Mapper) that adds schemas and validation to MongoDB.

---

## `backend/src/middleware/auth.js` — JWT Authentication

This is one of the most important files in the project.

```javascript
async function requireAuth(req, res, next) {
    // 1. Extract token from "Authorization: Bearer <token>" header
    const header = req.headers.authorization;
    if (!header || !header.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Authentication required' });
    }
    const token = header.slice(7);

    // 2. Verify JWT signature + expiry
    const payload = jwt.verify(token, JWT_SECRET);

    // 3. Check session still exists in DB (enables logout revocation)
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    const [rows] = await pool.query(
        'SELECT s.id FROM sessions s WHERE s.token_hash = ? AND s.expires_at > NOW() AND s.user_id = ?',
        [tokenHash, payload.id]
    );
    if (rows.length === 0) {
        return res.status(401).json({ error: 'Session expired or invalid' });
    }

    // 4. Attach user to request object
    req.user = payload;
    next();
}
```

**Why hash the token?** Never store raw secrets. The SHA-256 hash is stored, so even if the DB is compromised, attackers can't use the hashes directly (JWTs have entropy; hashing them prevents direct use of the hash as a token).

**Why DB session check?** A pure JWT is stateless — once issued, it's valid until expiry. Storing sessions in a `sessions` table allows immediate logout: deleting the row invalidates the token even before it expires.

**`next()`** — calls the next middleware or route handler. If not called, the request hangs.

---


---

## Backend Routes — Deep Dive

### `POST /auth/signup`

**Request flow:**
```
Request → router.post('/signup') → validate name/email/password
    → query MySQL: SELECT id FROM users WHERE email = ? (check duplicate)
    → bcrypt.hash(password, 12)
    → INSERT INTO users (name, email, password, avatar, role, plan)
    → INSERT IGNORE INTO dashboard_stats (user_id)
    → jwt.sign(payload, JWT_SECRET, { expiresIn: '7d' })
    → INSERT INTO sessions (user_id, token_hash, expires_at)
    → Response: { token, user }
```

**`bcrypt.hash(password, 12)`** — hashes the password with 12 salt rounds. Salt rounds = how many times the hash is computed. 12 is the modern recommendation (takes ~300ms, making brute-force impractical).

**`makeAvatar(name)`:**
```javascript
function makeAvatar(name) {
    return name.split(' ').map(w => w[0] || '').join('').toUpperCase().slice(0, 2) || '??';
}
```
"John Doe" → "JD". "Alice" → "AL" (no, actually first two chars of first word). This creates initials-based avatars.

---

### `POST /auth/login`

```
Request → validate email/password
    → SELECT * FROM users WHERE email = ?
    → bcrypt.compare(password, user.password)
    → jwt.sign(payload)
    → createSession(userId, token)
    → Response: { token, user }
```

**`bcrypt.compare`** — compares plaintext password against stored hash. bcrypt embeds the salt in the hash, so it extracts the salt and re-hashes to compare.

**Same error message for wrong email and wrong password:** `'Invalid email or password'`. This is intentional — it prevents user enumeration attacks (an attacker can't tell if an email exists or not).

---

### `POST /upload`

This is the most complex route.

```
Request (multipart/form-data, file=PDF)
    → requireAuth middleware
    → multer.single('file') middleware:
        - validates PDF MIME type (returns INVALID_TYPE error if not PDF)
        - validates file size ≤ 20MB (returns LIMIT_FILE_SIZE error)
        - saves to uploads/ with timestamped filename
    → uploadToSupabase(localPath, uuid):
        - reads file buffer
        - supabase.storage.from('papers').upload(uuid + '.pdf', buffer)
        - supabase.storage.from('papers').getPublicUrl(uuid + '.pdf')
        - returns publicUrl
    → fs.unlink(localPath) — delete temporary file
    → INSERT INTO papers (uuid, user_id, filename, file_path=publicUrl, status='processing', expires_at)
    → triggerAIEngine(uuid, pdfUrl, userId, filename) — NO AWAIT (fire-and-forget)
    → Response: { uuid, status: 'processing' }
```

**Why fire-and-forget?** The AI analysis takes 30–60 seconds. If we `await`, the HTTP request would time out. Instead, we return immediately with `{ uuid, status: 'processing' }` and the frontend polls `/paper/:uuid` until `status === 'completed'`.

**`triggerAIEngine` function:**
```javascript
async function triggerAIEngine(uuid, pdfUrl, userId, originalName) {
    try {
        const response = await axios.post(`${aiEngineUrl}/process`,
            { uuid, pdf_url: pdfUrl },
            { timeout: 120000 }  // 2 minute timeout
        );
        // On success: UPDATE papers SET status='completed'...
        // UPDATE MongoDB with fraud_report, summary, keywords
    } catch (err) {
        // On failure: UPDATE papers SET status='failed'
    }
}
```

**`timeout: 120000`** — 2 minute timeout for the AI engine. If the AI takes longer, the paper is marked failed and the user can retry.

**Multer error handler:**
```javascript
router.use((err, _req, res, _next) => {
    if (err.code === 'LIMIT_FILE_SIZE') return res.status(413).json({...});
    if (err.code === 'INVALID_TYPE') return res.status(400).json({...});
});
```
Route-level error handlers (4 parameters) catch Multer-specific errors.

---

### `POST /analyze`

This is the poll endpoint. The frontend calls this every 3 seconds.

```javascript
const [[meta]] = await pool.query(
    'SELECT uuid, status FROM papers WHERE uuid = ? AND user_id = ?',
    [uuid, req.user.id]
);
if (meta.status === 'processing') return res.status(202).json({ status: 'processing' });
if (meta.status === 'failed') return res.status(500).json({ error: 'Analysis failed' });

// Completed: fetch MongoDB data
const mongoPaper = await Paper.findOne({ uuid }).lean();
return res.json({ uuid, fraud_report, summary });
```

**HTTP 202 Accepted** — standard HTTP code meaning "request received but not yet complete". The frontend knows to keep polling.

**Why not use WebSockets?** WebSockets would be better for real-time but add complexity. Polling every 3 seconds is simpler and works well enough here.

---

### `GET /paper/:uuid`

```javascript
// 1. Ownership check in MySQL
const [[meta]] = await pool.query(
    'SELECT uuid, filename, status, ... FROM papers WHERE uuid = ? AND user_id = ?',
    [uuid, userId]
);
if (!meta) return res.status(404).json({ error: 'Paper not found' });

// 2. Fetch analysis from MongoDB
const mongoPaper = await Paper.findOne({ uuid }).lean();

// 3. Merge and return
return res.json({ ...meta, ...analysisData });
```

**`AND user_id = ?`** — critical security check. Without this, any authenticated user could access any paper by guessing a UUID. This ensures ownership.

**`.lean()`** — returns a plain JavaScript object instead of a Mongoose document. Faster, uses less memory, easier to spread with `...`.

---

### `GET /export/:uuid/pdf`

Generates a 2-page PDF report using **PDFKit** (a Node.js PDF generation library).

**Page 1:** Dark-themed fraud analysis
- Header bar with FraudLens logo + date
- Paper filename info block
- 3 metric cards: Plagiarism %, Issues count, Risk Level
- Score bar with threshold markers (30% = medium, 60% = high)
- Up to 5 detected issues with type badges

**Page 2:** AI Summary
- Title, Main Contributions, Methodology, Conclusions (from LLM)
- Keyword pills
- Legal disclaimer

**Key PDFKit techniques:**
- `bufferPages: true` — buffers all pages so you can add footers retroactively
- `doc.pipe(res)` — streams PDF directly to HTTP response without writing to disk
- `doc.addPage()` — creates page 2
- `addFooters(doc)` — iterates all pages to add page numbers

**Color palette** in export.js mirrors the frontend's dark theme using `#07111f`, `#4f8ef7`, etc.

---

### `GET /citation/:uuid/graph`

```javascript
// Fetch Supabase URL from MySQL
const [[paper]] = await pool.query(
    'SELECT uuid, file_path, status FROM papers WHERE uuid = ? AND user_id = ?',
    [uuid, userId]
);

// Forward to AI engine with full PDF URL
const response = await axios.post(`${aiEngineUrl}/citation-graph`,
    { uuid, pdf_url: paper.file_path },
    { timeout: 60000 }
);
return res.json(response.data);
```

**Why re-download the PDF for citation graph?** The MongoDB stored text is capped at 50,000 characters. Most papers have reference lists at the very end — these are often cut off. The citation graph needs the full text.

---


---

# 6. DATABASE — MySQL

## Why MySQL?

MySQL is a **relational database** — data has a fixed schema, and tables are linked by foreign keys. It's ideal for:
- Data that needs to be filtered, sorted, and aggregated (`WHERE`, `ORDER BY`, `COUNT`, `AVG`)
- Data with strict relationships (a paper belongs to a user; a session belongs to a user)
- Enforcing constraints (unique emails, foreign key integrity)

## Tables

### `users`

```sql
CREATE TABLE users (
    id           INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    name         VARCHAR(120) NOT NULL,
    email        VARCHAR(191) NOT NULL UNIQUE,
    password     VARCHAR(255) NOT NULL,        -- bcrypt hash
    role         ENUM('researcher','admin') DEFAULT 'researcher',
    plan         ENUM('free','pro') DEFAULT 'free',
    avatar       VARCHAR(10) NOT NULL DEFAULT '',  -- e.g. "JD" initials
    created_at   DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at   DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_email (email)
) ENGINE=InnoDB;
```

**Column explanations:**
- `id INT UNSIGNED AUTO_INCREMENT` — auto-incrementing integer primary key. `UNSIGNED` means no negatives, doubling the positive range.
- `email VARCHAR(191) UNIQUE` — 191 chars (not 255) because MySQL's default utf8mb4 charset with indexes has a 767-byte key limit. 191 × 4 bytes = 764 bytes.
- `password VARCHAR(255)` — bcrypt hash is always 60 chars, but 255 is a safe buffer.
- `ENUM` — restricts values to a defined set. Prevents invalid values.
- `INDEX idx_email` — creates a B-tree index for fast email lookups during login.
- `ENGINE=InnoDB` — supports transactions, foreign keys, row-level locking.

---

### `sessions`

```sql
CREATE TABLE sessions (
    id          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    user_id     INT UNSIGNED NOT NULL,
    token_hash  VARCHAR(255) NOT NULL UNIQUE,   -- SHA-256 of JWT
    expires_at  DATETIME NOT NULL,
    created_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_token (token_hash),
    INDEX idx_user (user_id)
);
```

**Purpose:** Enables JWT revocation (logout before expiry).

**`ON DELETE CASCADE`** — when a user is deleted, all their sessions are automatically deleted too. No orphaned rows.

**`INDEX idx_token`** — every `requireAuth` call queries `WHERE token_hash = ?`. Without an index, this would be a full table scan. With an index, it's O(log n).

**Why SHA-256 the JWT?** If the sessions table is leaked, raw JWTs would allow impersonation. A SHA-256 hash cannot be reversed to get the JWT. (Note: JWTs have enough entropy that rainbow tables are infeasible, but hashing is still best practice.)

---

### `papers`

```sql
CREATE TABLE papers (
    id               INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    uuid             VARCHAR(36) NOT NULL UNIQUE,  -- UUIDv4 like "3f2504e0-..."
    user_id          INT UNSIGNED NOT NULL,
    filename         VARCHAR(255) NOT NULL,
    file_path        VARCHAR(500) NOT NULL,         -- Supabase public URL
    status           ENUM('processing','completed','failed') DEFAULT 'processing',
    risk_level       ENUM('low','medium','high') NULL,
    plagiarism_score DECIMAL(5,4) NULL,             -- 0.0000 to 1.0000
    issue_count      INT UNSIGNED DEFAULT 0,
    uploaded_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
    expires_at       DATETIME NOT NULL,             -- 24h TTL
    completed_at     DATETIME NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_uuid (uuid),
    INDEX idx_user_status (user_id, status),
    INDEX idx_uploaded (uploaded_at)
);
```

**Column explanations:**
- `uuid VARCHAR(36)` — UUIDv4 format: `xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx`. 36 chars including hyphens. Used as the external identifier (never expose numeric `id` externally).
- `file_path VARCHAR(500)` — Supabase public URLs can be long.
- `DECIMAL(5,4)` — 5 total digits, 4 after decimal. Range: 0.0000–1.0000. Stores plagiarism scores like 0.3412 exactly (floats lose precision).
- `expires_at` — 24 hours after upload. A background job (not yet implemented) could clean up old papers.
- **Composite index `idx_user_status`** — optimizes `WHERE user_id = ? ORDER BY uploaded_at DESC` queries (dashboard list).

---

### `dashboard_stats`

```sql
CREATE TABLE dashboard_stats (
    id              INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    user_id         INT UNSIGNED NOT NULL UNIQUE,
    total_analyses  INT UNSIGNED DEFAULT 0,
    high_risk_count INT UNSIGNED DEFAULT 0,
    avg_plagiarism  DECIMAL(5,4) DEFAULT 0,
    cleared_count   INT UNSIGNED DEFAULT 0,
    updated_at      DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
```

**Note:** The current code does NOT use this cached table for the dashboard stats query. It calculates live from the `papers` table using `COUNT`, `SUM`, `AVG`. This table exists for future optimization (caching computed aggregates).

The live query:
```sql
SELECT
    COUNT(*) AS total_analyses,
    SUM(CASE WHEN risk_level = 'high' THEN 1 ELSE 0 END) AS high_risk_count,
    SUM(CASE WHEN risk_level IN ('low','medium') AND status='completed' THEN 1 ELSE 0 END) AS cleared_count,
    ROUND(AVG(CASE WHEN plagiarism_score IS NOT NULL THEN plagiarism_score END) * 100, 1) AS avg_plagiarism
FROM papers WHERE user_id = ?
```

**`CASE WHEN ... THEN 1 ELSE 0 END` inside `SUM`** — conditional counting. This is a classic SQL pattern to get multiple counts in a single query pass.

**`AVG(CASE WHEN ... IS NOT NULL THEN ... END)`** — NULL values are excluded from AVG automatically in SQL. The CASE makes this explicit.

---

## ER Diagram

```
users (1) ─────── (*) papers
  id ──────────────── user_id (FK)

users (1) ─────── (*) sessions
  id ──────────────── user_id (FK)

users (1) ─────── (1) dashboard_stats
  id ──────────────── user_id (FK, UNIQUE)

papers.uuid ←──────── MongoDB papers.uuid (logical join, not FK)
```

---


---

# 7. DATABASE — MongoDB

## Why MongoDB?

MongoDB stores **documents** (JSON-like objects) in **collections**. Each document can have different fields. This is perfect for the AI analysis output because:
- Different papers have different numbers of issues (0 to many)
- The `extracted_text` can be up to 50,000 chars — a VARCHAR would be wasteful, TEXT is ugly in MySQL
- Future additions (new AI modules) don't require `ALTER TABLE`

## `backend/src/models/Paper.js` — Mongoose Schema

```javascript
const paperSchema = new mongoose.Schema({
    uuid: { type: String, required: true, unique: true, index: true },
    filename: { type: String, required: true },
    file_path: { type: String, required: true },
    status: { type: String, enum: ['processing','completed','failed'], default: 'processing' },
    uploaded_at: { type: Date, default: Date.now },
    expires_at: { type: Date, required: true },  // TTL — auto-expiry
    extracted_text: { type: String, default: '' },
    summary: summarySchema,
    fraud_report: fraudReportSchema,
    keywords: [String],
});
```

**Schema validation** catches data errors before they reach the DB:
- `required: true` — throws error if field missing
- `enum` — restricts to allowed values
- `unique: true` — creates a MongoDB unique index on `uuid`

**Nested schemas** (`fraudReportSchema`, `issueSchema`, `summarySchema`) — MongoDB allows nested documents. This maps naturally to the Python AI engine's output.

## MongoDB Collection: `papers`

```json
{
    "_id": ObjectId("..."),        // MongoDB auto-generated ID
    "uuid": "3f2504e0-...",        // matches MySQL papers.uuid
    "filename": "research.pdf",
    "file_path": "https://gvsoznczlbrmzfbbkbgs.supabase.co/...",
    "status": "completed",
    "uploaded_at": ISODate("..."),
    "expires_at": ISODate("..."),  // 24h after upload
    "extracted_text": "Abstract: This paper presents...",  // up to 50,000 chars
    "fraud_report": {
        "plagiarism_score": 0.342,
        "risk_level": "medium",
        "issues": [
            {
                "type": "repeated_sentence",
                "description": "Sentence repeated 3 times: ...",
                "excerpt": "The results show that..."
            }
        ]
    },
    "summary": {
        "title": "Deep Learning for Fraud Detection",
        "main_contributions": "We propose...",
        "methodology": "We used a BERT-based model...",
        "conclusions": "Our system achieves 94% accuracy..."
    },
    "keywords": ["deep", "learning", "fraud", "detection", "neural", ...]
}
```

## How MySQL and MongoDB Join

When a user requests `GET /paper/:uuid`:
```javascript
// 1. MySQL: ownership check + structured metadata
const [[meta]] = await pool.query(
    'SELECT uuid, filename, status, risk_level, plagiarism_score, issue_count, uploaded_at, completed_at FROM papers WHERE uuid = ? AND user_id = ?',
    [uuid, userId]
);

// 2. MongoDB: AI analysis data
const mongoPaper = await Paper.findOne({ uuid }).lean();

// 3. Merge: MySQL fields + MongoDB fields → single response
return res.json({ ...meta, ...analysisData });
```

The `uuid` is the **join key** between the two databases. This is called a **polyglot persistence** pattern.

---

## `POST /reprocess-summary` in AI Engine

```python
doc = await db["papers"].find_one({"uuid": req.uuid})
text = doc["extracted_text"]
summary = await loop.run_in_executor(None, generate_summary, text)
await db["papers"].update_one(
    {"uuid": req.uuid},
    {"$set": {"summary": summary}}
)
```

**`$set`** — MongoDB update operator. Only updates the specified fields, leaving others unchanged. Without `$set`, the entire document would be replaced.

**`run_in_executor`** — runs synchronous code (`generate_summary` makes blocking HTTP calls) in a thread pool without blocking the async event loop.

---

# 8. STORAGE — SUPABASE

## What is Supabase?

Supabase is an open-source Firebase alternative. It provides a PostgreSQL database, real-time subscriptions, authentication, and **object storage**. FraudLens only uses the **Storage** feature.

## Why Supabase Instead of Local Disk?

Render (backend hosting) and Railway (AI engine) have **ephemeral file systems**. Any file written to disk disappears on the next deployment or restart. Supabase provides persistent cloud storage.

## Storage Flow

```
User uploads PDF to POST /upload
        ↓
Multer saves temporarily to uploads/ on Render disk
        ↓
backend reads file buffer: fs.readFileSync(localPath)
        ↓
supabase.storage.from('papers').upload(uuid + '.pdf', buffer, {
    contentType: 'application/pdf',
    upsert: false  // fail if already exists (prevents overwrite)
})
        ↓
supabase.storage.from('papers').getPublicUrl(uuid + '.pdf')
returns: { data: { publicUrl: 'https://gvsoznczlbrmzfbbkbgs.supabase.co/storage/v1/object/public/papers/uuid.pdf' } }
        ↓
Store publicUrl in MySQL papers.file_path
Delete temporary local file: fs.unlink(localPath)
        ↓
Send { uuid, pdf_url: publicUrl } to AI engine
        ↓
AI engine: requests.get(pdf_url) — downloads directly, no Supabase credentials needed
```

## Security Considerations

- **Service Role Key** (`SUPABASE_SERVICE_ROLE_KEY`) — bypasses Row Level Security. **Never expose in frontend code.** Only used server-side.
- **Public bucket** — the `papers` bucket is public, meaning anyone with the URL can download the PDF. A private bucket would require signed URLs, adding complexity.
- **UUID filenames** — `uuid.pdf` (e.g., `3f2504e0-4f53-4587-8d7f-9c1b2d3e4f5a.pdf`). Impossible to guess, so practically private even in a public bucket.

---


---

# 9. AI ENGINE

## Overview

The AI engine is a **FastAPI** application written in Python 3.11. It runs independently on Railway. It:
1. Downloads the PDF from Supabase
2. Extracts text from the PDF
3. Runs 4 concurrent tasks: fraud detection, embedding, summarization, keyword extraction
4. Saves results to MongoDB
5. Serves a RAG chatbot, paper recommender, and citation graph

FastAPI was chosen over Flask because:
- Native async/await support
- Auto-generates OpenAPI/Swagger docs
- Pydantic models for automatic request validation
- Better performance for concurrent I/O

---

## `ai-engine/main.py` — FastAPI App

### Startup

```python
from dotenv import load_dotenv
load_dotenv()  # Must be FIRST — loads .env before any other imports use os.getenv
```

**CORS middleware:**
```python
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],    # allow all origins
    allow_methods=["*"],
    allow_headers=["*"],
)
```
Allows the Node.js backend to call this FastAPI service from any origin.

### MongoDB Connection (Lazy)

```python
_mongo_client = None
_db = None

def get_db():
    global _mongo_client, _db
    if _mongo_client is None:
        _mongo_client = AsyncIOMotorClient(uri, serverSelectionTimeoutMS=5000)
        _db = _mongo_client["fraudlens"]
    return _db
```

**Lazy initialization** — the MongoDB client is created only on first use, not at startup. This means the server starts even if MongoDB is temporarily unavailable.

**`motor`** (AsyncIOMotorClient) — the async MongoDB driver for Python. Works with FastAPI's asyncio event loop.

**`reset_mongo`** — closes and recreates the connection on error. Handles connection drops.

### Pydantic Request Models

```python
class ProcessRequest(BaseModel):
    uuid: str
    pdf_url: str
```

FastAPI auto-validates: if the request body is missing `uuid`, it returns a 422 error automatically.

### Stopwords

```python
STOPWORDS = {"the", "a", "an", "is", "are", ...}
```

Used for keyword extraction. After counting all words, words in this set are excluded, leaving only meaningful "content words".

---

## `POST /process` — Full Analysis Pipeline

This is the most complex endpoint.

```python
@app.post("/process")
async def process(req: ProcessRequest):
    # Step 1: Download PDF
    temp_pdf = download_pdf(req.pdf_url)
    
    try:
        text = extract_text(temp_pdf)
    except UnreadablePDFError as e:
        raise HTTPException(status_code=422, detail=str(e))
    finally:
        os.remove(temp_pdf)  # Always clean up, even if extraction fails
    
    # Step 2: Run 3 tasks concurrently
    loop = asyncio.get_running_loop()
    results = await asyncio.gather(
        fraud_analyze(text),                               # async
        loop.run_in_executor(None, build_index, uuid, text),  # sync in thread
        loop.run_in_executor(None, generate_summary, text),   # sync in thread
        return_exceptions=True,  # don't raise; return exceptions as values
    )
    
    # Step 3: Extract keywords
    words = text.lower().split()
    content_words = [w.strip('.,;:()[]"\'') for w in words
                     if w.strip(...) not in STOPWORDS and len(w.strip(...)) > 3]
    keywords = [w for w, _ in Counter(content_words).most_common(10)]
    
    # Step 4: Save to MongoDB (retry once)
    for attempt in range(2):
        try:
            await db["papers"].update_one(
                {"uuid": req.uuid},
                {"$set": { "status": "completed", "extracted_text": text[:50000], ... }},
                upsert=True,  # create document if it doesn't exist
            )
            break
        except Exception:
            reset_mongo()  # reconnect and retry
```

**`asyncio.gather` with `return_exceptions=True`** — this is crucial. Normally, if one task in `gather` raises an exception, all tasks are cancelled. With `return_exceptions=True`, exceptions are returned as values instead. The code then checks `isinstance(results[0], Exception)` and uses fallback values for failed tasks.

**`run_in_executor`** — `build_index` and `generate_summary` are synchronous (blocking). Running them directly in `async def` would block the event loop, preventing other requests from being served. `run_in_executor` runs them in a thread pool, keeping the event loop free.

**`text[:50000]`** — 50,000 character cap on stored text. Keeps MongoDB documents reasonable in size. The full text is used for all processing; only the stored version is capped.

**`upsert=True`** — if a document with this `uuid` already exists, update it. If not, create it. This handles retry scenarios.

---

## `ai-engine/modules/downloader.py`

```python
def download_pdf(pdf_url: str) -> str:
    response = requests.get(pdf_url, timeout=60, stream=True)
    response.raise_for_status()  # raises HTTPError for 4xx/5xx
    
    content_type = response.headers.get("Content-Type", "")
    if "pdf" not in content_type and not pdf_url.lower().endswith(".pdf"):
        raise ValueError(f"URL does not point to a PDF...")
    
    fd, temp_path = tempfile.mkstemp(suffix=".pdf")
    with os.fdopen(fd, "wb") as f:
        for chunk in response.iter_content(chunk_size=8192):
            if chunk:
                f.write(chunk)
    return temp_path
```

**`stream=True`** — doesn't load the entire file into memory first. Downloads in chunks of 8192 bytes (8 KB). Essential for large PDFs.

**`tempfile.mkstemp`** — creates a uniquely-named temporary file. Returns a file descriptor `fd` and path. Safer than `open('temp.pdf', 'wb')` which could have race conditions in concurrent scenarios.

**`os.fdopen(fd, "wb")`** — converts the raw file descriptor to a Python file object.

**Caller deletes temp file** — documented contract. The caller is responsible for `os.remove(temp_path)`.

---


---

# 10. PDF PROCESSING

## `ai-engine/modules/pdf_processor.py`

### `extract_text(pdf_path)`

Uses **pdfplumber** to extract text. The key challenge is academic papers often have **two-column layouts**. A naive extraction would interleave text from both columns.

```python
def _extract_page_text(page) -> str:
    words = page.extract_words(keep_blank_chars=False, use_text_flow=False)
    page_width = page.width
    mid = page_width / 2

    left_words = [w for w in words if w["x1"] <= mid + 20]
    right_words = [w for w in words if w["x0"] >= mid - 20]

    is_two_col = len(left_words) > 10 and len(right_words) > 10
```

**Column detection:** If both halves of the page have significant word counts, it's a two-column layout.

```python
    if is_two_col:
        # Sort left column top-to-bottom, then right column
        left_col = sorted([w for w in words if w["x0"] < mid],
                          key=lambda w: (round(w["top"] / 5), w["x0"]))
        right_col = sorted([w for w in words if w["x0"] >= mid],
                           key=lambda w: (round(w["top"] / 5), w["x0"]))
        ordered_words = left_col + right_col
```

**`round(w["top"] / 5) * 5`** — snaps y-coordinates to a 5-point grid. Words on the same line may have slightly different `top` values (e.g., 103.1 vs 103.4). Snapping groups them together correctly.

**Line reconstruction:**
```python
    for w in ordered_words:
        top = round(w["top"] / 5) * 5
        if prev_top is not None and abs(top - prev_top) > 3:
            lines.append(" ".join(current_line))
            current_line = [w["text"]]
        else:
            current_line.append(w["text"])
        prev_top = top
```

Groups words into lines: when the y-position jumps by more than 3 points, it's a new line.

**`UnreadablePDFError`** — custom exception raised when pdfplumber extracts an empty string. This happens with scanned PDFs (images with no text layer). These cannot be processed without OCR (not implemented).

### pdfplumber vs PyPDF2 vs PyMuPDF

| Library | Pros | Cons |
|---|---|---|
| pdfplumber | Word bounding boxes, table extraction, accurate layout | Slower |
| PyPDF2 | Fast, simple | Poor with complex layouts, often wrong order |
| PyMuPDF | Fastest, best quality | AGPL license (commercial use restricted) |

pdfplumber was chosen for its layout awareness (bounding boxes enable column detection).

---

# 11. EMBEDDINGS & FAISS

## What Are Embeddings?

An **embedding** converts text into a vector of numbers (a point in high-dimensional space). The key property: **semantically similar text produces similar vectors**.

For example:
- "The model achieves high accuracy" → [0.21, -0.45, 0.88, ...]
- "Our system performs well on benchmarks" → [0.19, -0.42, 0.91, ...] (similar!)
- "The weather is sunny today" → [-0.72, 0.33, -0.14, ...] (different)

FraudLens uses **`sentence-transformers/all-MiniLM-L6-v2`**:
- Produces **384-dimensional** vectors
- Runs locally (no API calls)
- Compact (80MB model) and fast

## `ai-engine/modules/embedder.py`

### Text Chunking

```python
def chunk_text(text: str) -> list[str]:
    splitter = RecursiveCharacterTextSplitter(
        chunk_size=512,     # each chunk is ~512 characters
        chunk_overlap=50,   # 50-char overlap between consecutive chunks
        length_function=len
    )
    return splitter.split_text(text)
```

**Why chunk?** Embedding models have context length limits. Also, if someone asks about the conclusion, you want to retrieve the conclusion chunk, not the entire paper.

**`RecursiveCharacterTextSplitter`** (from LangChain) splits by paragraph breaks (`\n\n`), then sentences, then characters — trying to keep semantic units together.

**`chunk_overlap=50`** — prevents information loss at chunk boundaries. If a key sentence spans the boundary, the overlap ensures it appears in at least one chunk.

### Building the FAISS Index

```python
def build_index(uuid: str, text: str) -> list[str]:
    chunks = chunk_text(text)
    
    # Generate embeddings for all chunks
    embeddings_list = embed_texts(chunks)
    embeddings = np.array(embeddings_list, dtype="float32")
    dim = embeddings.shape[1]  # 384
    
    # Create FAISS index
    index = faiss.IndexFlatL2(dim)
    index.add(embeddings)
    
    # Persist to disk
    faiss.write_index(index, f"{FAISS_STORE_PATH}/{uuid}.index")
    pickle.dump(chunks, open(f"{FAISS_STORE_PATH}/{uuid}.chunks", "wb"))
    open(f"{FAISS_STORE_PATH}/{uuid}.dim", "w").write(str(dim))
    
    return chunks
```

## FAISS — Facebook AI Similarity Search

**FAISS** is a library for efficient nearest-neighbour search in high-dimensional spaces.

**`IndexFlatL2`** — the simplest FAISS index type:
- **Flat** = no compression, exact search (not approximate)
- **L2** = Euclidean distance metric
- Brute-force comparison: compares query vector against every stored vector

**Why not `IndexIVFFlat` or `IndexHNSW`?** Those are faster for millions of vectors but require training or graph construction. For hundreds of chunks per paper, `IndexFlatL2` is fast enough and simpler.

**Three files per paper:**
- `uuid.index` — the FAISS binary index (raw vectors)
- `uuid.chunks` — pickled list of chunk text strings (so we can return the actual text)
- `uuid.dim` — stored dimension (for mismatch detection)

### Similarity Search

```python
def search(uuid: str, query: str, top_k: int = 5) -> list[dict]:
    index, chunks = load_index(uuid)
    
    query_emb = embed_texts([query])
    query_embedding = np.array(query_emb, dtype="float32")
    
    # Rebuild if dimension changed (model switch)
    if query_embedding.shape[1] != index.d:
        # Rebuild index with new dimensions...
        pass
    
    k = min(top_k, index.ntotal)
    _, indices = index.search(query_embedding, k)
    
    return [
        {"chunk_id": int(idx), "excerpt": chunks[idx][:300]}
        for idx in indices[0]
        if 0 <= idx < len(chunks)
    ]
```

**`index.search(query_embedding, k)`** returns:
- Distances array (L2 distances, not cosine similarity)
- Indices array (which chunks are closest)

**Why L2 distance, not cosine similarity?** `all-MiniLM-L6-v2` is trained with `normalize_embeddings=True`. When vectors are normalized (length = 1), L2 distance is equivalent to cosine similarity. The ranking is the same.

## `ai-engine/modules/llm.py` — LLM + Embedder

### Local Embeddings

```python
_st_model = None

def _get_st_model():
    global _st_model
    if _st_model is None:
        from sentence_transformers import SentenceTransformer
        _st_model = SentenceTransformer('all-MiniLM-L6-v2')
    return _st_model

def embed_texts(texts: list[str]) -> list[list[float]]:
    model = _get_st_model()
    embeddings = model.encode(texts, normalize_embeddings=True)
    return embeddings.tolist()
```

**Lazy loading** — the model is downloaded and loaded only on first call. Loading takes ~2 seconds. The global `_st_model` caches it so subsequent calls are instant.

**`normalize_embeddings=True`** — returns unit-norm vectors. This makes cosine similarity equivalent to dot product (faster computation).

### OpenRouter LLM Client

```python
MODEL = os.getenv("OPENROUTER_MODEL", "liquid/lfm-2.5-1.2b-instruct:free")
FALLBACK_MODELS = [
    "liquid/lfm-2.5-1.2b-thinking:free",
    "google/gemma-3-4b-it:free",
    "meta-llama/llama-3.2-3b-instruct:free",
    "mistralai/mistral-small-3.1-24b-instruct:free",
    "meta-llama/llama-3.3-70b-instruct:free",
    "nousresearch/hermes-3-llama-3.1-405b:free",
]
```

**OpenRouter** aggregates many LLM providers. The `:free` suffix means these models are free tier — no cost.

**Fallback cascade:**
```python
def chat_completion(messages, max_tokens=800, temperature=0.2):
    models = [MODEL] + FALLBACK_MODELS
    for model in models:
        try:
            return _call_model(model, messages, max_tokens, temperature)
        except urllib.error.HTTPError as e:
            if e.code in (404, 429, 503, 500):
                continue  # try next model
            raise
    raise RuntimeError("All configured LLM models are unavailable")
```

**HTTP 429 Too Many Requests** — free tier rate limit hit. Move to next model.
**HTTP 404 Not Found** — model removed. Move to next model.
**HTTP 503 Service Unavailable** — provider down. Move to next model.

**`urllib.request`** instead of `requests`? Plain stdlib is used here to avoid an extra dependency. It's more verbose but works.

**`temperature=0.2`** — lower temperature = more deterministic, factual responses. Higher temperature = more creative but potentially hallucinated. For academic paper analysis, 0.2 is appropriate.

---

