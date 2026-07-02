# FraudLens

A research paper integrity analysis platform. Upload a PDF, get back a fraud report, plagiarism score, AI-generated summary, citation graph, keyword extraction, and a RAG-based chatbot that answers questions about the paper.

## Live Demo

| Service    | URL |
|------------|-----|
| Frontend   | https://fraudlens-pi.vercel.app/login |
| Backend    | https://fraudlens-0b7u.onrender.com |
| AI Engine  | https://fraudlens-production-3c1f.up.railway.app |

---

## Table of Contents

- [Architecture Overview](#architecture-overview)
- [Services](#services)
- [Storage — Supabase](#storage--supabase)
- [Why Two Databases](#why-two-databases)
- [Database Design](#database-design)
- [AI Engine — Modules](#ai-engine--modules)
- [API Reference](#api-reference)
- [Frontend Pages](#frontend-pages)
- [Data Flow](#data-flow)
- [Deployment](#deployment)
- [Running Locally](#running-locally)
- [Environment Variables](#environment-variables)

---

## Architecture Overview

```
┌──────────────────────────────────────────────────────────────────┐
│                        Browser (React)                           │
│            Vite · TypeScript · React Router · Recharts           │
│              https://fraudlens-pi.vercel.app                     │
└─────────────────────────┬────────────────────────────────────────┘
                          │ REST (JWT in Authorization header)
                          ▼
┌──────────────────────────────────────────────────────────────────┐
│                   Backend (Node.js / Express)                    │
│              https://fraudlens-0b7u.onrender.com                 │
│                                                                  │
│  /auth   /upload   /analyze   /paper   /dashboard   /export     │
│  /chat   /recommend   /citation   /reprocess   /profile  /stats │
│                                                                  │
│    ┌─────────────────┐   ┌──────────────────┐                   │
│    │  MySQL (Railway) │   │  MongoDB (Atlas)  │                  │
│    │   (metadata)     │   │ (analysis payload)│                  │
│    └─────────────────┘   └──────────────────┘                   │
│                                                                  │
│    ┌─────────────────────────────────┐                          │
│    │   Supabase Storage              │                          │
│    │   PDF files (public bucket)     │                          │
│    └─────────────────────────────────┘                          │
└─────────────────────────┬────────────────────────────────────────┘
                          │ HTTP POST { uuid, pdf_url } (fire-and-forget)
                          ▼
┌──────────────────────────────────────────────────────────────────┐
│                  AI Engine (FastAPI / Python)                    │
│        https://fraudlens-production-3c1f.up.railway.app          │
│                                                                  │
│  POST /process           — full pipeline (PDF → report)         │
│  POST /chat              — RAG Q&A                              │
│  POST /recommend         — similar paper recommendations        │
│  POST /citation-graph    — citation ring detection              │
│  POST /reprocess-summary — re-run summarization only            │
│  GET  /health                                                    │
│                                                                  │
│  ┌─────────────────┐  ┌──────────┐  ┌────────────────────────┐ │
│  │  FAISS indexes  │  │ MongoDB  │  │  OpenRouter LLM API    │ │
│  │  (disk: .index  │  │  (motor) │  │  + sentence-transformers│ │
│  │   .chunks .dim) │  │          │  │  (all-MiniLM-L6-v2)    │ │
│  └─────────────────┘  └──────────┘  └────────────────────────┘ │
└──────────────────────────────────────────────────────────────────┘
```

---

## Services

| Service    | Stack                                    | Hosting  | URL | Local Port |
|------------|------------------------------------------|----------|-----|------------|
| Frontend   | React 18, TypeScript, Vite, React Router | Vercel   | https://fraudlens-pi.vercel.app | 3000 |
| Backend    | Node.js, Express, mysql2, mongoose       | Render   | https://fraudlens-0b7u.onrender.com | 4000 |
| AI Engine  | Python 3.11, FastAPI, uvicorn            | Railway  | https://fraudlens-production-3c1f.up.railway.app | 8000 |

---

## Storage — Supabase

PDFs are stored in **Supabase Storage** (not on disk, not Cloudinary).

### How it works

1. User uploads PDF to the backend via `POST /upload`.
2. Backend saves the file temporarily to disk with multer.
3. Backend uploads the file buffer to a Supabase Storage bucket using the service role key. The storage key is `<uuid>.pdf`.
4. Supabase returns a **public URL** (`https://<project>.supabase.co/storage/v1/object/public/<bucket>/<uuid>.pdf`).
5. Backend stores that public URL in MySQL `papers.file_path`.
6. Temporary local file is deleted immediately.
7. Backend sends `{ uuid, pdf_url }` to the AI engine. The AI engine downloads the PDF directly from Supabase using that URL — no file transfer between backend and AI engine, no shared disk.

### Supabase bucket setup

1. Create a project at [supabase.com](https://supabase.com).
2. Go to **Storage → New bucket**. Name it `papers` (or whatever you set in `SUPABASE_BUCKET`).
3. Set the bucket to **Public** (so the AI engine can download without authentication).
4. Copy your **Project URL** and **service_role** key from **Settings → API**.

---

## Why Two Databases

The project uses **MySQL** and **MongoDB** together, each doing what it's suited for.

### MySQL — structured relational data

Stores everything known at upload time that needs to be queried, filtered, sorted, and aggregated:

- User accounts, password hashes, sessions
- Paper records: `uuid`, `filename`, `file_path` (Supabase URL), `status`, `risk_level`, `plagiarism_score`, `issue_count`, `uploaded_at`, `completed_at`
- Dashboard aggregates: `total_analyses`, `high_risk_count`, `cleared_count`, `avg_plagiarism`

These fields appear in `WHERE`, `ORDER BY`, `COUNT`, `AVG`, and `SUM` queries. Foreign key integrity between `users → papers → dashboard_stats` matters here.

### MongoDB — variable, document-shaped analysis output

Stores everything produced by the AI engine after analysis:

- `extracted_text` — up to 50,000 characters of raw PDF text
- `fraud_report` — `{ plagiarism_score, risk_level, issues: [{type, description, excerpt}] }`
- `summary` — `{ title, main_contributions, methodology, conclusions }`
- `keywords` — array of strings

This data has no fixed schema. Storing it in MySQL would require multiple tables, nullable columns, or JSON columns. MongoDB stores it naturally as a document keyed by `uuid`.

### How they join at query time

When the backend serves `GET /paper/:uuid`, it queries MySQL first (ownership check + metadata), then fetches the matching MongoDB document by `uuid` and merges both into a single response.

```
MySQL   →  uuid, filename, status, risk_level, plagiarism_score, issue_count, uploaded_at
MongoDB →  fraud_report, summary, keywords, extracted_text
                         ↓ merged
             Single JSON response to frontend
```

---

## Database Design

### MySQL Tables

```sql
-- Users
CREATE TABLE users (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  name          VARCHAR(100)  NOT NULL,
  email         VARCHAR(255)  NOT NULL UNIQUE,
  password      VARCHAR(255)  NOT NULL,        -- bcrypt hash (rounds=12)
  avatar        VARCHAR(10),                   -- 2-char initials
  role          ENUM('researcher') DEFAULT 'researcher',
  plan          ENUM('free')       DEFAULT 'free',
  created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Sessions (JWT revocation)
CREATE TABLE sessions (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  user_id     INT NOT NULL REFERENCES users(id),
  token_hash  VARCHAR(64) NOT NULL,            -- SHA-256 of JWT
  expires_at  DATETIME   NOT NULL,
  created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Papers
CREATE TABLE papers (
  id               INT AUTO_INCREMENT PRIMARY KEY,
  uuid             VARCHAR(36)  NOT NULL UNIQUE,
  user_id          INT          NOT NULL REFERENCES users(id),
  filename         VARCHAR(255) NOT NULL,
  file_path        VARCHAR(512) NOT NULL,       -- Supabase public URL
  status           ENUM('processing','completed','failed') DEFAULT 'processing',
  risk_level       ENUM('low','medium','high') DEFAULT NULL,
  plagiarism_score DECIMAL(4,3) DEFAULT NULL,   -- 0.000 to 1.000
  issue_count      INT          DEFAULT NULL,
  uploaded_at      TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
  completed_at     TIMESTAMP    DEFAULT NULL,
  expires_at       TIMESTAMP    NOT NULL        -- 24h TTL set on upload
);

-- Dashboard stats cache
CREATE TABLE dashboard_stats (
  user_id          INT PRIMARY KEY REFERENCES users(id),
  total_analyses   INT           DEFAULT 0,
  high_risk_count  INT           DEFAULT 0,
  cleared_count    INT           DEFAULT 0,
  avg_plagiarism   DECIMAL(5,2)  DEFAULT 0.00,
  updated_at       TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);
```

### MongoDB Collection: `papers`

```
{
  uuid:           String  (unique index, matches MySQL papers.uuid),
  filename:       String,
  file_path:      String  (Supabase public URL),
  status:         "processing" | "completed" | "failed",
  uploaded_at:    Date,
  expires_at:     Date    (TTL — document auto-expires after 24h),
  extracted_text: String  (up to 50,000 chars of PDF text),

  fraud_report: {
    plagiarism_score: Number  (0.0 – 1.0),
    risk_level:       "low" | "medium" | "high",
    issues: [
      {
        type:        String,   // "repeated_sentence" | "overused_keyword" |
                               // "unusual_structure" | "citation_inconsistency"
        description: String,
        excerpt:     String
      }
    ]
  },

  summary: {
    title:              String,
    main_contributions: String,
    methodology:        String,
    conclusions:        String
  },

  keywords: [String]   // top-10 content words by frequency
}
```

### FAISS Index Files (disk, per paper)

Stored in `ai-engine/faiss_indexes/` as three files per paper:

```
<uuid>.index   — FAISS IndexFlatL2 (384-dim vectors)
<uuid>.chunks  — pickled list of text chunks (512-char, 50-char overlap)
<uuid>.dim     — single integer: embedding dimension
```

Used by the chatbot and recommender for nearest-neighbour search.

---

## AI Engine — Modules

### `pdf_processor.py`
Extracts text from a PDF using `pdfplumber`. Raises `UnreadablePDFError` if no text is extractable.

### `downloader.py`
Downloads a PDF from a public URL (Supabase) to a temporary file on disk. Streams the response in 8 KB chunks. Validates `Content-Type`. Raises descriptive exceptions for HTTP errors, timeouts, and write failures. Caller is responsible for deleting the temp file.

### `fraud_detector.py`
Orchestrator. Runs three sub-modules **concurrently** with `asyncio.gather`:
1. `plagiarism.py` — TF-IDF + cosine similarity against a built-in reference corpus. Returns a score in `[0.0, 1.0]`.
2. `pattern_detector.py` — detects repeated sentences (≥3 occurrences), overused keywords (>5% of word count), unusual document structure (<3 headings).
3. `citation_checker.py` — detects mixed citation styles (APA, IEEE, MLA patterns in the same document).

Risk level:
- `> 0.6` plagiarism, or `> 0.3` + critical issue → **high**
- `≥ 0.3` plagiarism, or has critical issue → **medium**
- otherwise → **low**

### `embedder.py`
Splits text into 512-char chunks with 50-char overlap (LangChain `RecursiveCharacterTextSplitter`), embeds with `sentence-transformers/all-MiniLM-L6-v2` (384-dim), stores a FAISS `IndexFlatL2` to disk. Rebuilds the index if a dimension mismatch is detected.

### `summarizer.py`
Calls OpenRouter LLM (primary: `liquid/lfm-2.5-1.2b-instruct:free`, with 6 fallback free models) to produce: `title`, `main_contributions`, `methodology`, `conclusions`. Falls back to a regex/heuristic extractor that finds the abstract, method section, and conclusion section by heading matching if the LLM fails.

### `chatbot.py`
RAG pipeline: FAISS nearest-neighbour search (top-5 chunks by cosine distance) on the question embedding, then LLM call with retrieved context. Falls back to returning the top chunk as plain text if the LLM is unavailable.

### `citation_checker.py`
Two functions:
- `check_citations` — detects mixed citation styles, returns issues for the fraud report.
- `get_citation_graph` — extracts reference list entries (numbered `[1]` or author-year), builds co-citation edges (two refs cited together in the same sentence), detects citation rings (connected components of size ≥3 with co-citation weight ≥2).

**Important:** the citation graph is built from the **full PDF text** downloaded fresh from Supabase, not from the stored MongoDB text (which is capped at 50,000 chars and often misses the references section).

### `recommender.py`
Embeds the user query and a hard-coded corpus of 12 academic papers with `all-MiniLM-L6-v2`, computes cosine similarity, returns top-k matches.

### `llm.py`
OpenRouter API client (plain `urllib`). Tries models in sequence on 404/429/503. Also exposes `embed_texts()` using `sentence-transformers` locally (no API call for embeddings).

---

## API Reference

### Auth — `/auth`

| Method | Path             | Auth | Description |
|--------|------------------|------|-------------|
| POST   | `/auth/signup`   | No   | Register. Returns JWT + user object. |
| POST   | `/auth/login`    | No   | Login. Returns JWT + user object. |
| POST   | `/auth/logout`   | No   | Deletes session row by token hash. |
| GET    | `/auth/me`       | No   | Validates JWT, returns user from MySQL. |

### Upload — `/upload`

| Method | Path      | Auth | Description |
|--------|-----------|------|-------------|
| POST   | `/upload` | Yes  | Accepts `multipart/form-data` with `file` (PDF ≤ 20 MB). Uploads PDF to Supabase Storage, stores public URL in MySQL, fires `POST /process` to AI engine with `{ uuid, pdf_url }` as fire-and-forget. Returns `{ uuid, status: "processing" }`. |

### Analyze — `/analyze`

| Method | Path       | Auth | Description |
|--------|------------|------|-------------|
| POST   | `/analyze` | Yes  | Poll endpoint. Returns `202` while processing, `500` if failed, or full report from MongoDB if completed. |

### Paper — `/paper`

| Method | Path            | Auth | Description |
|--------|-----------------|------|-------------|
| GET    | `/paper/:uuid`  | Yes  | Returns merged MySQL metadata + MongoDB analysis. |

### Dashboard — `/dashboard`

| Method | Path                  | Auth | Description |
|--------|-----------------------|------|-------------|
| GET    | `/dashboard/stats`    | Yes  | Aggregated counts: total, high-risk, cleared, avg plagiarism. |
| GET    | `/dashboard/recent`   | Yes  | Last 5 papers for the user. |
| GET    | `/dashboard/papers`   | Yes  | All papers, paginated (`?page=&limit=`). |

### Chat — `/chat`

| Method | Path    | Auth | Description |
|--------|---------|------|-------------|
| POST   | `/chat` | Yes  | Body: `{ uuid, question }`. Proxied to AI engine `/chat`. Returns `{ answer, sources }`. |

### Recommend — `/recommend`

| Method | Path         | Auth | Description |
|--------|--------------|------|-------------|
| POST   | `/recommend` | Yes  | Body: `{ query }`. Proxied to AI engine `/recommend`. Returns `{ results: [...] }`. |

### Citation — `/citation`

| Method | Path                    | Auth | Description |
|--------|-------------------------|------|-------------|
| GET    | `/citation/:uuid/graph` | Yes  | Sends `{ uuid, pdf_url }` to AI engine `/citation-graph`. Returns `{ nodes, edges, rings, stats }`. |

### Export — `/export`

| Method | Path                | Auth | Description |
|--------|---------------------|------|-------------|
| GET    | `/export/:uuid/pdf` | Yes  | Generates a 2-page PDF report with pdfkit. Streams `application/pdf`. |

### Reprocess — `/reprocess`

| Method | Path               | Auth | Description |
|--------|--------------------|------|-------------|
| POST   | `/reprocess/:uuid` | Yes  | Re-triggers AI engine `/reprocess-summary` using stored MongoDB text. |

### Profile — `/profile`

| Method | Path                | Auth | Description |
|--------|---------------------|------|-------------|
| PUT    | `/profile`          | Yes  | Update display name. Regenerates avatar initials. |
| PUT    | `/profile/password` | Yes  | Change password. Validates current password with bcrypt. |

### Stats — `/stats`

| Method | Path     | Auth | Description |
|--------|----------|------|-------------|
| GET    | `/stats` | Yes  | Per-user paper counts broken down by risk level and status. |

---

## Frontend Pages

| Route           | Page          | Description |
|-----------------|---------------|-------------|
| `/login`        | `LoginPage`   | Email/password login. Redirects to dashboard on success. |
| `/signup`       | `SignupPage`  | Registration with name, email, password. |
| `/dashboard`    | `DashboardHome` | Stats cards, recent papers list. |
| `/upload`       | `UploadPage`  | Drag-and-drop PDF upload. Polls `/analyze` until complete, then navigates to report. |
| `/report/:uuid` | `ReportPage`  | Fraud report, plagiarism score, issues, AI summary, keywords, citation graph, chatbot, recommendations, PDF export. |
| `/papers`       | `PapersPage`  | Paginated list of all papers with status and risk badges. |
| `/profile`      | `ProfilePage` | Update display name and password. |

All routes except `/login` and `/signup` require authentication (JWT stored in `localStorage`). Unauthenticated requests redirect to `/login`.

---

## Data Flow

```
User uploads PDF
      │
      ▼
POST /upload  (Backend — Render)
  ├─ multer saves PDF temporarily to disk
  ├─ upload buffer → Supabase Storage bucket
  ├─ receive public URL from Supabase
  ├─ delete temporary local file
  ├─ INSERT into MySQL papers (file_path = Supabase URL, status='processing')
  └─ fire-and-forget → POST /process (AI Engine — Railway)
       body: { uuid, pdf_url }
                         │
           AI Engine downloads PDF from Supabase URL
                         │
              ┌──────────┴──────────┐
              │   asyncio.gather    │
     ┌────────┴──┐  ┌──────────┐  ┌───────────┐  ┌──────────┐
     │plagiarism │  │ patterns │  │summarizer │  │ embedder │
     │ TF-IDF    │  │  regex   │  │ LLM call  │  │  FAISS   │
     └────────┬──┘  └────┬─────┘  └─────┬─────┘  └────┬─────┘
              └──────┬───┘               │              │
                     ▼                   │         FAISS index
               fraud_report           summary     saved to disk
                     │                   │
               MongoDB upsert (uuid key)
               MySQL UPDATE (status='completed',
                             risk_level, plagiarism_score,
                             issue_count, completed_at)
                         │
                         ▼
Frontend polls GET /analyze/:uuid
  └─ 202 while processing, full report when done

User opens /report/:uuid
  └─ GET /paper/:uuid
       ├─ MySQL: metadata row
       └─ MongoDB: fraud_report, summary, keywords, extracted_text
            └─ merged → ReportPage renders all sections

User opens citation graph
  └─ GET /citation/:uuid/graph
       ├─ MySQL: file_path (Supabase URL)
       └─ AI Engine downloads full PDF again from Supabase URL
            └─ extract_text() with no truncation
            └─ get_citation_graph() on complete text
            └─ returns nodes, edges, rings, stats

User asks chatbot question
  └─ POST /chat → AI Engine /chat
       ├─ FAISS search (top-5 chunks by cosine distance)
       └─ LLM call with retrieved context → answer

User exports PDF
  └─ GET /export/:uuid/pdf
       ├─ MySQL: metadata
       ├─ MongoDB: fraud_report, summary, keywords
       └─ pdfkit: 2-page PDF streamed to browser
```

---

## Deployment

| Service    | Platform | URL | Notes |
|------------|----------|-----|-------|
| Frontend   | Vercel   | https://fraudlens-pi.vercel.app | `vercel.json` rewrites all routes to `/index.html` for client-side routing. Set `VITE_API_URL` env var to the Render backend URL. |
| Backend    | Render   | https://fraudlens-0b7u.onrender.com | Set all env vars listed below. The `uploads/` directory is ephemeral — files are deleted immediately after Supabase upload so this is fine. |
| AI Engine  | Railway  | https://fraudlens-production-3c1f.up.railway.app | Set `MONGO_URI` and `OPENROUTER_API_KEY`. No Supabase credentials needed — downloads PDFs via public URL. |
| MySQL      | Railway  | — | Provisioned as a Railway MySQL service. |
| MongoDB    | Atlas    | — | Free tier M0 cluster. |
| Storage    | Supabase | — | Free tier. One public bucket named `papers`. |

---

## Running Locally

### Prerequisites

- Node.js ≥ 18
- Python 3.11
- MySQL running locally (database: `fraudlens`)
- MongoDB running locally or Atlas URI

### 1. AI Engine

```bash
cd ai-engine
pip install -r requirements.txt
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

### 2. Backend

```bash
cd backend
npm install
npm run dev
```

### 3. Frontend

```bash
cd frontend
npm install
npm run dev
```

---

## Environment Variables

### `backend/.env`

```
PORT=4000

# MySQL
MYSQL_HOST=localhost
MYSQL_PORT=3306
MYSQL_USER=root
MYSQL_PASSWORD=
MYSQL_DB=fraudlens

# MongoDB Atlas
MONGO_URI=mongodb://localhost:27017/fraudlens

# AI Engine
AI_ENGINE_URL=http://localhost:8000

# JWT
JWT_SECRET=your_jwt_secret_here
JWT_EXPIRES_IN=7d

# Supabase Storage
SUPABASE_URL=https://<project-ref>.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<your-service-role-key>
SUPABASE_BUCKET=papers
```

`SUPABASE_SERVICE_ROLE_KEY` is the **service_role** secret from Supabase **Settings → API**. Never expose this key on the frontend.

### `ai-engine/.env`

```
MONGO_URI=mongodb://localhost:27017/fraudlens
OPENROUTER_API_KEY=your_openrouter_key
OPENROUTER_MODEL=liquid/lfm-2.5-1.2b-instruct:free
FAISS_STORE_PATH=./faiss_indexes
```

The AI engine has **no Supabase credentials**. It downloads PDFs directly from the public Supabase URL passed in the request body — no authentication required.

`OPENROUTER_API_KEY` is required for LLM summarization and chatbot. Free models are used by default. If no key is set, the LLM will fail and the heuristic fallback summarizer will run instead.
