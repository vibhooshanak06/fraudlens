# FraudLens

A research paper integrity analysis platform. Upload a PDF, get back a fraud report, plagiarism score, AI-generated summary, citation graph, keyword extraction, and a RAG-based chatbot that answers questions about the paper.

---

## Table of Contents

- [Architecture Overview](#architecture-overview)
- [Services](#services)
- [Why Two Databases](#why-two-databases)
- [Database Design](#database-design)
- [AI Engine — Modules](#ai-engine--modules)
- [API Reference](#api-reference)
- [Frontend Pages](#frontend-pages)
- [Data Flow](#data-flow)
- [Running the Project](#running-the-project)
- [Environment Variables](#environment-variables)

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                        Browser (React)                          │
│           Vite · TypeScript · React Router · Recharts           │
│                      http://localhost:3000                       │
└────────────────────────────┬────────────────────────────────────┘
                             │ REST (JWT in Authorization header)
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Backend (Node.js / Express)                   │
│                       http://localhost:4000                      │
│                                                                  │
│  /auth   /upload   /analyze   /paper   /dashboard   /export     │
│  /chat   /recommend   /citation   /reprocess   /profile  /stats │
│                                                                  │
│    ┌──────────────┐              ┌──────────────────────┐       │
│    │    MySQL      │              │       MongoDB         │       │
│    │  (metadata)   │              │  (analysis payload)  │       │
│    └──────────────┘              └──────────────────────┘       │
└────────────────────────────┬────────────────────────────────────┘
                             │ HTTP POST (axios, fire-and-forget)
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                   AI Engine (FastAPI / Python)                   │
│                       http://localhost:8000                      │
│                                                                  │
│  POST /process          — full pipeline (PDF → report)          │
│  POST /chat             — RAG Q&A                               │
│  POST /recommend        — similar paper recommendations         │
│  POST /citation-graph   — citation ring detection               │
│  POST /reprocess-summary — re-run summarization only            │
│  GET  /health                                                    │
│                                                                  │
│  ┌──────────────┐  ┌──────────┐  ┌──────────────────────────┐  │
│  │ FAISS indexes│  │ MongoDB  │  │  OpenRouter LLM API       │  │
│  │ (disk .index │  │  (motor) │  │  + sentence-transformers  │  │
│  │  .chunks .dim│  │          │  │  (all-MiniLM-L6-v2)       │  │
│  └──────────────┘  └──────────┘  └──────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

---

## Services

| Service    | Stack                                    | Port |
|------------|------------------------------------------|------|
| Frontend   | React 18, TypeScript, Vite, React Router | 3000 |
| Backend    | Node.js, Express, mysql2, mongoose       | 4000 |
| AI Engine  | Python 3.11, FastAPI, uvicorn            | 8000 |

---

## Why Two Databases

The project uses **MySQL** and **MongoDB** together, each doing what it's suited for.

### MySQL — structured relational data

Stores everything that is known at upload time and needs to be queried, filtered, sorted, and aggregated:

- User accounts, password hashes, sessions
- Paper records: `uuid`, `filename`, `status`, `risk_level`, `plagiarism_score`, `issue_count`, `uploaded_at`, `completed_at`
- Dashboard aggregates: `total_analyses`, `high_risk_count`, `cleared_count`, `avg_plagiarism`

These fields are used in `WHERE`, `ORDER BY`, `COUNT`, `AVG`, `SUM` queries. Relational integrity (foreign keys between `users` → `papers` → `dashboard_stats`) matters here.

### MongoDB — variable, document-shaped analysis output

Stores everything produced by the AI engine after analysis:

- `extracted_text` — up to 50,000 characters of raw PDF text
- `fraud_report` — nested object: `{ plagiarism_score, risk_level, issues: [ {type, description, excerpt} ] }`
- `summary` — nested object: `{ title, main_contributions, methodology, conclusions }`
- `keywords` — array of strings

This data has no fixed schema. The `fraud_report.issues` array can be empty or contain many items of varying types. The `summary` fields can be missing or contain long free-text. Storing this in MySQL would require multiple tables and many nullable columns or JSON columns — MongoDB stores it naturally as a document keyed by `uuid`.

### How they join at query time

When the backend serves `GET /paper/:uuid`, it queries MySQL first (ownership check + metadata) then fetches the matching MongoDB document by `uuid` and merges both into a single response object.

```
MySQL  →  uuid, filename, status, risk_level, plagiarism_score, issue_count, uploaded_at
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
  file_path        VARCHAR(512) NOT NULL,
  status           ENUM('processing','completed','failed') DEFAULT 'processing',
  risk_level       ENUM('low','medium','high') DEFAULT NULL,
  plagiarism_score DECIMAL(4,3) DEFAULT NULL,  -- 0.000 to 1.000
  issue_count      INT          DEFAULT NULL,
  uploaded_at      TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
  completed_at     TIMESTAMP    DEFAULT NULL,
  expires_at       TIMESTAMP    NOT NULL       -- 24h TTL set on upload
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
papers collection — one document per uploaded paper

{
  uuid:           String (unique index, matches MySQL papers.uuid),
  filename:       String,
  file_path:      String,
  status:         "processing" | "completed" | "failed",
  uploaded_at:    Date,
  expires_at:     Date  (TTL — document auto-expires after 24h),
  extracted_text: String (up to 50,000 chars of PDF text),

  fraud_report: {
    plagiarism_score: Number (0.0 – 1.0),
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

### `fraud_detector.py`
Orchestrator. Runs three sub-modules **concurrently** with `asyncio.gather`:
1. `plagiarism.py` — TF-IDF + cosine similarity against a built-in reference corpus. Returns a score in `[0.0, 1.0]`.
2. `pattern_detector.py` — detects repeated sentences (≥3 occurrences), overused keywords (>5% of word count), unusual document structure (<3 headings).
3. `citation_checker.py` — detects mixed citation styles (APA, IEEE, MLA patterns in the same document).

Risk level is computed from the plagiarism score and issue types:
- `> 0.6` plagiarism, or `> 0.3` + critical issue → **high**
- `≥ 0.3` plagiarism, or has critical issue → **medium**
- otherwise → **low**

### `embedder.py`
Splits text into 512-char chunks with 50-char overlap (LangChain `RecursiveCharacterTextSplitter`), embeds with `sentence-transformers/all-MiniLM-L6-v2` (384-dim), stores a FAISS `IndexFlatL2` to disk. Also handles dimension mismatch by rebuilding the index.

### `summarizer.py`
Calls OpenRouter LLM (primary: `liquid/lfm-2.5-1.2b-instruct:free`, with 6 fallback free models) to produce: `title`, `main_contributions`, `methodology`, `conclusions`. If the LLM fails or returns garbage, falls back to a regex/heuristic text extractor that finds the abstract, method section, and conclusion section by heading matching.

### `chatbot.py`
RAG pipeline: runs FAISS nearest-neighbour search (top-5 chunks) on the question embedding, then sends the retrieved context + question to the LLM. Falls back to returning the top chunk as plain text if the LLM is unavailable.

### `citation_checker.py`
Two functions:
- `check_citations` — detects mixed citation styles, returns issues for the fraud report.
- `get_citation_graph` — extracts reference list entries (numbered `[1]` or author-year), builds co-citation edges (two refs cited together in the same sentence), detects citation rings (connected components of size ≥3 with co-citation weight ≥2). Used by the frontend for graph visualisation.

### `recommender.py`
Embeds the user's query and a hard-coded corpus of 12 academic papers (titles + abstracts) with `all-MiniLM-L6-v2`, computes cosine similarity, returns top-k matches. The corpus covers transformer models, fraud detection, plagiarism detection, NLP surveys, and citation analysis.

### `llm.py`
OpenRouter API client (plain `urllib`, no SDK). Tries models in sequence on 404/429/503. Also exposes `embed_texts()` using `sentence-transformers` locally (no API call needed for embeddings).

---

## API Reference

### Auth — `/auth`

| Method | Path          | Auth | Description |
|--------|---------------|------|-------------|
| POST   | `/auth/signup`  | No  | Register. Returns JWT + user object. |
| POST   | `/auth/login`   | No  | Login. Returns JWT + user object. |
| POST   | `/auth/logout`  | No  | Deletes session row by token hash. |
| GET    | `/auth/me`      | No  | Validates JWT, returns user from MySQL. |

### Upload — `/upload`

| Method | Path      | Auth | Description |
|--------|-----------|------|-------------|
| POST   | `/upload` | Yes  | Accepts `multipart/form-data` with `file` (PDF, max 20 MB). Saves to `uploads/`, inserts MySQL row, fires `POST /process` to AI engine as fire-and-forget. Returns `{ uuid, status: "processing" }`. |

### Analyze — `/analyze`

| Method | Path       | Auth | Description |
|--------|------------|------|-------------|
| POST   | `/analyze` | Yes  | Poll endpoint. Returns `202` if still processing, `500` if failed, or `fraud_report + summary` from MongoDB if completed. |

### Paper — `/paper`

| Method | Path           | Auth | Description |
|--------|----------------|------|-------------|
| GET    | `/paper/:uuid` | Yes  | Returns merged MySQL metadata + MongoDB analysis (fraud_report, summary, keywords, extracted_text). |

### Dashboard — `/dashboard`

| Method | Path                   | Auth | Description |
|--------|------------------------|------|-------------|
| GET    | `/dashboard/stats`     | Yes  | Aggregated counts from `papers` table: total, high-risk, cleared, avg plagiarism. |
| GET    | `/dashboard/recent`    | Yes  | Last 5 papers for the user. |
| GET    | `/dashboard/papers`    | Yes  | All papers, paginated (`?page=&limit=`). |

### Chat — `/chat`

| Method | Path    | Auth | Description |
|--------|---------|------|-------------|
| POST   | `/chat` | Yes  | Body: `{ uuid, question }`. Proxied to AI engine `/chat`. Returns `{ answer, sources }`. |

### Recommend — `/recommend`

| Method | Path         | Auth | Description |
|--------|--------------|------|-------------|
| POST   | `/recommend` | Yes  | Body: `{ query }`. Proxied to AI engine `/recommend`. Returns `{ results: [...] }`. |

### Citation — `/citation`

| Method | Path               | Auth | Description |
|--------|--------------------|------|-------------|
| POST   | `/citation/:uuid`  | Yes  | Proxied to AI engine `/citation-graph`. Returns nodes, edges, rings, stats. |

### Export — `/export`

| Method | Path               | Auth | Description |
|--------|--------------------|------|-------------|
| GET    | `/export/:uuid/pdf`| Yes  | Generates a 2-page PDF report (pdfkit). Streams `application/pdf` as attachment. |

### Reprocess — `/reprocess`

| Method | Path               | Auth | Description |
|--------|--------------------|------|-------------|
| POST   | `/reprocess/:uuid` | Yes  | Re-triggers AI engine `/reprocess-summary` for an existing paper. |

### Profile — `/profile`

| Method | Path               | Auth | Description |
|--------|--------------------|------|-------------|
| PUT    | `/profile`         | Yes  | Update display name. Regenerates avatar initials. |
| PUT    | `/profile/password`| Yes  | Change password. Validates current password with bcrypt. |

### Stats — `/stats`

| Method | Path     | Auth | Description |
|--------|----------|------|-------------|
| GET    | `/stats` | Yes  | Returns per-user paper counts broken down by risk level and status. |

---

## Frontend Pages

| Route              | Page              | Description |
|--------------------|-------------------|-------------|
| `/login`           | `LoginPage`       | Email/password login form. Redirects to dashboard on success. |
| `/signup`          | `SignupPage`      | Registration form with name, email, password. |
| `/dashboard`       | `DashboardHome`   | Stats cards (total, high-risk, cleared, avg plagiarism), recent papers list. |
| `/upload`          | `UploadPage`      | Drag-and-drop or click PDF upload. Polls `/analyze` until complete, then navigates to report. |
| `/report/:uuid`    | `ReportPage`      | Full analysis: fraud report, plagiarism score, issues list, AI summary, keywords, citation graph, chatbot, recommendations, PDF export button. |
| `/papers`          | `PapersPage`      | Paginated list of all uploaded papers with status and risk badges. |
| `/profile`         | `ProfilePage`     | Update display name and password. |

All routes behind `/dashboard`, `/upload`, `/report`, `/papers`, `/profile` require authentication (`AuthContext` → JWT in `localStorage`). Unauthenticated requests redirect to `/login`.

---

## Data Flow

```
User uploads PDF
      │
      ▼
POST /upload  (Backend)
  ├─ multer saves file to uploads/
  ├─ INSERT into MySQL papers (status='processing')
  └─ fire-and-forget → POST /process (AI Engine)
                              │
                    ┌─────────┴──────────┐
                    │  asyncio.gather    │
           ┌────────┴──┐  ┌──────────┐  ┌───────────┐
           │plagiarism │  │ patterns │  │summarizer │
           │ TF-IDF    │  │ regex    │  │ LLM call  │
           └────────┬──┘  └────┬─────┘  └─────┬─────┘
                    └─────┬────┘               │
                          ▼                    │
                  fraud_report                 summary
                          │                   │
                    embedder runs separately (executor)
                    FAISS index saved to disk
                          │
                    MongoDB upsert (uuid key)
                    MySQL UPDATE (status='completed',
                                  risk_level, plagiarism_score,
                                  issue_count, completed_at)
                          │
                          ▼
Frontend polls GET /analyze/:uuid
  └─ returns 202 while processing, full report when done

User opens /report/:uuid
  └─ GET /paper/:uuid
       ├─ MySQL: metadata row
       └─ MongoDB: fraud_report, summary, keywords, extracted_text
            └─ merged response → ReportPage renders all sections

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

## Running the Project

### Prerequisites

- Node.js ≥ 18
- Python 3.11
- MySQL (database: `fraudlens`)
- MongoDB (local or Atlas)

### Start all three services

**AI Engine** (port 8000):
```bash
cd ai-engine
pip install -r requirements.txt
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

**Backend** (port 4000):
```bash
cd backend
npm install
npm run dev
```

**Frontend** (port 3000):
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
MYSQL_HOST=localhost
MYSQL_USER=root
MYSQL_PASSWORD=
MYSQL_DB=fraudlens
MONGO_URI=mongodb://localhost:27017/fraudlens
JWT_SECRET=your_jwt_secret
JWT_EXPIRES_IN=7d
AI_ENGINE_URL=http://localhost:8000
```

### `ai-engine/.env`

```
MONGO_URI=mongodb://localhost:27017/fraudlens
OPENROUTER_API_KEY=your_openrouter_key
OPENROUTER_MODEL=liquid/lfm-2.5-1.2b-instruct:free
FAISS_STORE_PATH=./faiss_indexes
```

`OPENROUTER_API_KEY` is required for LLM summarization and chatbot. Free models are used by default. If no key is set, the LLM will fail and the text-based fallback summarizer will be used instead.
