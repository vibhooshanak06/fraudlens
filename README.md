# FraudLens — AI-Powered Research Integrity Platform

FraudLens is a full-stack web application that analyzes academic research papers for fraud indicators including plagiarism, citation manipulation, structural anomalies, and AI-generated content patterns. It combines a React frontend, Node.js backend, and a Python AI engine to deliver end-to-end paper analysis with an interactive dashboard.

---

## Table of Contents

- [System Architecture](#system-architecture)
- [System Flow](#system-flow)
- [Tech Stack](#tech-stack)
- [Features](#features)
- [Project Structure](#project-structure)
- [Local Setup](#local-setup)
- [Environment Variables](#environment-variables)
- [API Reference](#api-reference)
- [AI Engine Modules](#ai-engine-modules)

---

## System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        Browser (React)                          │
│  Dashboard · Upload · Report · Papers · Citation Graph · Chat   │
└────────────────────────┬────────────────────────────────────────┘
                         │ HTTP (REST)
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│                   Backend (Node.js / Express)                   │
│                         Port 4000                               │
│                                                                 │
│  /auth   /upload   /paper   /analyze   /chat   /recommend       │
│  /dashboard   /export   /citation   /profile   /reprocess       │
│                                                                 │
│         ┌──────────────┐      ┌──────────────────┐             │
│         │    MySQL 8   │      │   MongoDB 7       │             │
│         │  (users,     │      │  (fraud reports,  │             │
│         │   sessions,  │      │   summaries,      │             │
│         │   papers     │      │   embeddings,     │             │
│         │   metadata)  │      │   extracted text) │             │
│         └──────────────┘      └──────────────────┘             │
└────────────────────────┬────────────────────────────────────────┘
                         │ HTTP (internal)
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│                   AI Engine (Python / FastAPI)                  │
│                         Port 8000                               │
│                                                                 │
│  /process   /chat   /recommend   /citation-graph                │
│  /reprocess-summary                                             │
│                                                                 │
│  ┌─────────────┐  ┌──────────────┐  ┌─────────────────────┐   │
│  │  Plagiarism │  │   Pattern    │  │  Citation Checker   │   │
│  │  (TF-IDF   │  │  Detector    │  │  + Graph Builder    │   │
│  │  cosine    │  │  (repeated   │  │  (ring detection)   │   │
│  │  similarity│  │  sentences,  │  └─────────────────────┘   │
│  └─────────────┘  │  keywords,  │                             │
│                   │  structure) │  ┌─────────────────────┐   │
│                   └──────────────┘  │  Summarizer (LLM)   │   │
│                                     │  + text fallback    │   │
│  ┌─────────────────────────────┐    └─────────────────────┘   │
│  │  Embedder (FAISS + sentence │                               │
│  │  transformers) + Chatbot    │                               │
│  │  (RAG via OpenRouter LLM)   │                               │
│  └─────────────────────────────┘                               │
└─────────────────────────────────────────────────────────────────┘
```

---

## System Flow

```
User uploads PDF
       │
       ▼
Backend saves file to /uploads
Backend inserts paper record in MySQL (status: processing)
Backend fires-and-forgets → POST /process to AI Engine
       │
       ▼
AI Engine (concurrent):
  ├── extract_text(pdf_path)          ← pdfplumber
  ├── fraud_analyze(text)             ← plagiarism + patterns + citations
  ├── build_index(uuid, text)         ← FAISS embeddings
  └── generate_summary(text)         ← LLM (OpenRouter) or text fallback
       │
       ▼
AI Engine stores results in MongoDB
Backend updates MySQL (status: completed, risk_level, plagiarism_score)
       │
       ▼
Frontend polls GET /paper/:uuid every 3s
When status = completed → renders:
  ├── Fraud Report tab
  │     ├── Plagiarism score + progress bar
  │     ├── Module breakdown (Plagiarism / Pattern / Citation)
  │     ├── Issue distribution chart
  │     ├── Expandable issue cards with excerpts
  │     └── Integrity assessment grid
  ├── Citation Graph tab
  │     ├── Force-directed SVG graph
  │     ├── Co-citation edge detection
  │     ├── Citation ring detection
  │     └── Reference sidebar with details
  ├── AI Assistant tab
  │     └── RAG chatbot (FAISS retrieval + LLM answer)
  └── Related Papers tab
        └── Semantic similarity recommendations (FAISS)

User can Export PDF → GET /export/:uuid/pdf → pdfkit generates report
```

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18, TypeScript, Vite, React Router v6 |
| Backend | Node.js, Express, JWT auth, bcryptjs, pdfkit |
| AI Engine | Python 3.11, FastAPI, uvicorn |
| Plagiarism | scikit-learn (TF-IDF + cosine similarity) |
| Embeddings | sentence-transformers, FAISS |
| LLM | OpenRouter API (via langchain-openai) |
| Primary DB | MySQL 8 (users, sessions, paper metadata) |
| Analysis DB | MongoDB 7 (fraud reports, summaries, text) |
| PDF parsing | pdfplumber |
| PDF export | pdfkit (Node.js) |
| Containerization | Docker, Docker Compose |

---

## Features

### Core Analysis
- **Plagiarism Detection** — TF-IDF vectorization with cosine similarity against a reference corpus. Returns a 0–100% score with Low / Medium / High risk classification.
- **Pattern Analysis** — Detects repeated sentences (≥3 occurrences), overused keywords (>5% word frequency), and unusual document structure (fewer than 3 distinct sections).
- **Citation Checking** — Identifies mixed citation styles (APA, IEEE, MLA) within a single document.
- **AI Summary** — LLM-generated structured summary (title, contributions, methodology, conclusions) with a robust text-based fallback.

### Citation Graph
- Extracts all references from the bibliography section.
- Builds a co-citation graph — edges connect references cited together in the same sentence.
- Detects citation rings — groups of 3+ references that heavily co-cite each other (a known academic fraud signal).
- Interactive force-directed SVG visualization with node click to explore connections.

### AI Assistant (RAG Chatbot)
- FAISS-indexed embeddings of the paper's extracted text.
- On each question, retrieves the most relevant chunks and passes them as context to the LLM.
- Answers are grounded in the paper's actual content.

### Related Papers
- Semantic similarity search across all indexed papers using FAISS.
- Returns ranked results with similarity scores.

### PDF Export
- Generates a formatted PDF report using pdfkit.
- Includes plagiarism score, risk level, all detected issues with excerpts, and the AI summary.

### Dashboard
- Stats cards: total analyses, high-risk count, average plagiarism score, papers cleared.
- Recent uploads table (last 5 papers).
- Quick action cards.

### My Papers
- Paginated list of all analyzed papers (10 per page, backend-driven).
- Sorted by most recent upload.

### Profile Settings
- Update display name.
- Change password (bcrypt re-hash).
- Security info panel.

### Authentication
- JWT-based auth with server-side session validation.
- Sessions stored in MySQL with SHA-256 token hashing.
- 7-day session expiry.

---

## Project Structure

```
fraudlens/
├── frontend/                  # React + TypeScript (Vite)
│   └── src/
│       ├── components/
│       │   ├── AppShell.tsx          # Sidebar navigation
│       │   ├── FraudReportPanel.tsx  # Main analysis display
│       │   ├── SummaryPanel.tsx      # AI summary + keywords
│       │   ├── CitationGraphPanel.tsx # Force-directed graph
│       │   ├── ChatPanel.tsx         # RAG chatbot UI
│       │   └── RecommendPanel.tsx    # Related papers
│       ├── pages/
│       │   ├── DashboardHome.tsx     # /dashboard
│       │   ├── ReportPage.tsx        # /report/:uuid
│       │   ├── PapersPage.tsx        # /papers
│       │   ├── UploadPage.tsx        # /upload
│       │   ├── ProfilePage.tsx       # /profile
│       │   ├── LoginPage.tsx         # /login
│       │   └── SignupPage.tsx        # /signup
│       ├── context/AuthContext.tsx
│       ├── api.ts                    # All API calls
│       └── styles/tokens.ts          # Design tokens
│
├── backend/                   # Node.js + Express
│   └── src/
│       ├── routes/
│       │   ├── auth.js        # signup, login, logout, /me
│       │   ├── upload.js      # PDF upload + AI trigger
│       │   ├── paper.js       # GET /paper/:uuid
│       │   ├── analyze.js     # GET analysis status
│       │   ├── chat.js        # Proxy to AI /chat
│       │   ├── recommend.js   # Proxy to AI /recommend
│       │   ├── reprocess.js   # Retry failed analysis
│       │   ├── dashboard.js   # Stats, recent, paginated papers
│       │   ├── export.js      # PDF report generation
│       │   ├── citation.js    # Proxy to AI /citation-graph
│       │   └── profile.js     # Update name, change password
│       ├── models/Paper.js    # Mongoose schema
│       ├── middleware/auth.js  # JWT + session validation
│       ├── mysql.js           # MySQL connection pool
│       └── db.js              # MongoDB connection
│
├── ai-engine/                 # Python + FastAPI
│   ├── main.py                # FastAPI app + all endpoints
│   └── modules/
│       ├── pdf_processor.py   # pdfplumber text extraction
│       ├── fraud_detector.py  # Orchestrates all 3 modules
│       ├── plagiarism.py      # TF-IDF cosine similarity
│       ├── pattern_detector.py # Repeated sentences, keywords
│       ├── citation_checker.py # Style check + graph builder
│       ├── embedder.py        # FAISS index builder
│       ├── chatbot.py         # RAG retrieval + LLM answer
│       ├── recommender.py     # Semantic similarity search
│       ├── summarizer.py      # LLM summary + text fallback
│       └── llm.py             # OpenRouter API wrapper
│
└── docker-compose.yml         # MySQL + MongoDB + all services
```

---

## Local Setup

### Prerequisites
- Node.js 18+
- Python 3.11
- MySQL 8 (running as a service)
- MongoDB (running as a service)

### 1. Start databases

```bash
# Windows (PowerShell as admin)
Start-Service MySQL80
Start-Service MongoDB
```

### 2. Initialize MySQL schema

```bash
cd backend
npm install
node scripts/init-mysql.js
```

### 3. Start AI Engine

```bash
cd ai-engine
pip install -r requirements.txt
python main.py
# Runs on http://localhost:8000
```

### 4. Start Backend

```bash
cd backend
npm run dev
# Runs on http://localhost:4000
```

### 5. Start Frontend

```bash
cd frontend
npm install
npm run dev
# Runs on http://localhost:5173
```

---

## Environment Variables

### `backend/.env`
```
PORT=4000
MYSQL_HOST=localhost
MYSQL_USER=root
MYSQL_PASSWORD=your_password
MYSQL_DB=fraudlens
MONGO_URI=mongodb://localhost:27017/fraudlens
AI_ENGINE_URL=http://localhost:8000
JWT_SECRET=your_jwt_secret
JWT_EXPIRES_IN=7d
```

### `ai-engine/.env`
```
MONGO_URI=mongodb://localhost:27017/fraudlens
OPENROUTER_API_KEY=your_openrouter_key
FAISS_STORE_PATH=./faiss_indexes
```

---

## API Reference

### Auth
| Method | Endpoint | Description |
|---|---|---|
| POST | `/auth/signup` | Register new user |
| POST | `/auth/login` | Login, returns JWT |
| POST | `/auth/logout` | Invalidate session |
| GET | `/auth/me` | Get current user |

### Papers
| Method | Endpoint | Description |
|---|---|---|
| POST | `/upload` | Upload PDF, triggers analysis |
| GET | `/paper/:uuid` | Get paper + analysis data |
| POST | `/reprocess/:uuid` | Retry failed analysis |

### Dashboard
| Method | Endpoint | Description |
|---|---|---|
| GET | `/dashboard/stats` | Aggregate stats for user |
| GET | `/dashboard/recent` | Last 5 papers |
| GET | `/dashboard/papers` | Paginated papers list |

### AI Features
| Method | Endpoint | Description |
|---|---|---|
| POST | `/chat` | RAG chatbot question |
| POST | `/recommend` | Semantic paper recommendations |
| GET | `/citation/:uuid/graph` | Citation graph + ring detection |
| GET | `/export/:uuid/pdf` | Download fraud report as PDF |

### Profile
| Method | Endpoint | Description |
|---|---|---|
| PUT | `/profile` | Update display name |
| PUT | `/profile/password` | Change password |

---

## AI Engine Modules

### Plagiarism (`plagiarism.py`)
Uses `TfidfVectorizer` from scikit-learn to compute cosine similarity between the paper and a reference corpus. Returns a score in [0.0, 1.0]. Thresholds: <0.30 = Low, 0.30–0.60 = Medium, >0.60 = High.

### Pattern Detector (`pattern_detector.py`)
- Repeated sentences: flags any sentence appearing 3+ times.
- Overused keywords: flags any non-stopword appearing in >5% of total word count.
- Unusual structure: flags documents with fewer than 3 heading-like lines.

### Citation Checker (`citation_checker.py`)
- Style detection: regex patterns for APA, IEEE, MLA. Flags mixed styles.
- Graph builder: extracts numbered/author-year references, builds co-citation edges from inline markers, detects rings via connected component analysis on high-weight edges.

### Summarizer (`summarizer.py`)
LLM-first: sends paper text to OpenRouter and parses structured output (Title, Main Contributions, Methodology, Conclusions). Falls back to a regex/heuristic text parser if the LLM fails or returns incomplete output.

### Embedder + Chatbot (`embedder.py`, `chatbot.py`)
Splits text into chunks, encodes with `sentence-transformers`, stores in a per-paper FAISS index. On chat queries, retrieves top-k chunks and passes them as context to the LLM for grounded answers.

### Recommender (`recommender.py`)
Searches across all FAISS indexes to find semantically similar papers. Returns ranked results with similarity scores.
