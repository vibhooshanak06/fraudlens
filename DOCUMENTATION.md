# FraudLens — AI-Powered Research Paper Integrity Analyzer
### Complete Project Documentation

---

## 1. Project Name & Tagline

**FraudLens**
*"See Through the Research. Detect What Others Miss."*

Full title for academic submission:
> **FraudLens: An AI-Driven Multi-Modal Framework for Research Paper Fraud Detection, Semantic Analysis, and Integrity Verification**

---

## 2. Abstract

The exponential growth of academic publishing has intensified concerns around plagiarism, citation manipulation, and AI-generated content in research papers. Existing tools address these issues in isolation — a plagiarism checker here, a citation tool there — leaving a fragmented and incomplete picture of a paper's integrity.

**FraudLens** is a full-stack, AI-powered web application that provides end-to-end research paper integrity analysis through a unified platform. Users upload a PDF research paper; the system automatically extracts text, computes a plagiarism score using TF-IDF cosine similarity, detects suspicious structural and linguistic patterns, validates citation consistency, builds an interactive citation co-occurrence graph, generates a structured AI summary using a large language model (LLM) via OpenRouter, and enables natural language Q&A over the paper through a Retrieval-Augmented Generation (RAG) chatbot backed by FAISS vector search.

The system is built on a microservices architecture: a React/TypeScript frontend, a Node.js/Express REST API backend with MySQL and MongoDB persistence, and a Python FastAPI AI engine. All services are containerized with Docker Compose for reproducible deployment. Experimental results on uploaded academic papers demonstrate accurate fraud risk classification (low / medium / high), meaningful semantic similarity-based paper recommendations, and coherent LLM-generated summaries — all delivered within a clean, responsive dark-themed UI.

**Keywords:** Plagiarism Detection, TF-IDF, Cosine Similarity, FAISS, RAG, LLM, Citation Graph, Academic Integrity, FastAPI, React

---

## 3. System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        USER BROWSER                         │
│              React + TypeScript (Vite, port 3000)           │
└──────────────────────────┬──────────────────────────────────┘
                           │ REST API calls
┌──────────────────────────▼──────────────────────────────────┐
│              Node.js / Express Backend (port 4000)          │
│  Routes: /upload  /dashboard  /report  /export  /chat       │
│  Auth: JWT middleware                                        │
│  DBs:  MySQL (users, papers metadata)                       │
│        MongoDB (extracted text, fraud report, summary)      │
└──────────────────────────┬──────────────────────────────────┘
                           │ HTTP (internal)
┌──────────────────────────▼──────────────────────────────────┐
│              Python FastAPI AI Engine (port 8000)           │
│  /process  /chat  /recommend  /citation-graph               │
│  Modules:                                                    │
│    pdf_processor  →  pdfplumber / PyMuPDF                   │
│    fraud_detector →  plagiarism + pattern + citation        │
│    embedder       →  sentence-transformers + FAISS          │
│    summarizer     →  LLM via OpenRouter                     │
│    chatbot        →  RAG (FAISS search + LLM)               │
│    recommender    →  cosine similarity on corpus            │
│    citation_checker → regex + graph analysis                │
└─────────────────────────────────────────────────────────────┘
```

---

## 4. Features

| Feature | Description |
|---|---|
| PDF Upload & Processing | Drag-and-drop upload; text extracted via pdfplumber/PyMuPDF |
| Plagiarism Scoring | TF-IDF + cosine similarity against reference corpus |
| Pattern Detection | Repeated sentences, overused keywords, unusual structure |
| Citation Validation | Mixed citation style detection (APA / IEEE / MLA) |
| Citation Graph | Interactive node-edge graph of co-cited references |
| AI Summary | LLM-generated title, contributions, methodology, conclusions |
| RAG Chatbot | Ask any question about the paper; answers grounded in paper text |
| Related Papers | Semantic similarity recommendations from a curated corpus |
| PDF Export | Clean 2-page formatted integrity report download |
| Dashboard | Paper history, risk badges, status tracking |
| Authentication | JWT-based login/register with protected routes |

---

## 5. Algorithms Used

### 5.1 Plagiarism Detection — TF-IDF Cosine Similarity

**TF-IDF (Term Frequency–Inverse Document Frequency)** converts text into numerical vectors where each dimension represents a term's importance relative to the corpus.

```
TF(t, d)  = (count of term t in document d) / (total terms in d)
IDF(t)    = log( N / (1 + df(t)) )
TF-IDF(t, d) = TF(t, d) × IDF(t)
```

**Cosine Similarity** measures the angle between two TF-IDF vectors:

```
similarity(A, B) = (A · B) / (||A|| × ||B||)
```

Score is the maximum similarity between the input paper and any document in the reference corpus, clamped to [0.0, 1.0].

---

### 5.2 Semantic Embedding — Sentence Transformers (all-MiniLM-L6-v2)

Text chunks are encoded into 384-dimensional dense vectors using a pre-trained sentence transformer model. These embeddings capture semantic meaning beyond keyword overlap.

```
embedding = SentenceTransformer('all-MiniLM-L6-v2').encode(text)
# Output: float32 vector of shape (384,)
```

---

### 5.3 Vector Search — FAISS (Facebook AI Similarity Search)

Paper text is split into 512-token overlapping chunks and indexed in a FAISS `IndexFlatL2` (exact L2 nearest-neighbor search).

```
index = faiss.IndexFlatL2(384)
index.add(chunk_embeddings)          # build
_, indices = index.search(query_emb, k=5)  # retrieve top-k
```

Used by the RAG chatbot to retrieve the most relevant passages for a given question.

---

### 5.4 RAG (Retrieval-Augmented Generation)

Combines FAISS retrieval with an LLM to answer questions grounded in the paper:

```
1. Embed user question → query_vector
2. FAISS search → top-5 relevant chunks
3. Concatenate chunks as context
4. LLM prompt: system + context + question → answer
```

---

### 5.5 Citation Graph Analysis

References are extracted via regex patterns. Co-citation edges are built when two references appear in the same sentence. Citation rings (potential cartels) are detected as connected components of size ≥ 3 with edge weight ≥ 2.

---

### 5.6 Risk Level Classification

```
if plagiarism_score > 0.6 OR (score > 0.3 AND has_critical_issue):
    risk = "high"
elif plagiarism_score >= 0.3 OR has_critical_issue:
    risk = "medium"
else:
    risk = "low"
```

---

## 6. Pseudocode

### 6.1 Paper Processing Pipeline

```
FUNCTION process_paper(uuid, pdf_path):

  // Step 1: Extract text
  text = extract_text(pdf_path)
  IF text is empty OR unreadable:
    RAISE UnreadablePDFError

  // Step 2: Concurrent analysis
  PARALLEL:
    fraud_report  = fraud_analyze(text)
    chunk_index   = build_faiss_index(uuid, text)
    summary       = generate_llm_summary(text)

  // Step 3: Extract keywords
  words = tokenize(text)
  keywords = top_10_frequent_content_words(words, exclude=STOPWORDS)

  // Step 4: Persist results
  MongoDB.upsert(uuid, {
    status: "completed",
    extracted_text: text[:50000],
    fraud_report, summary, keywords
  })

  RETURN { uuid, fraud_report, summary, keywords }
```

---

### 6.2 Fraud Detection

```
FUNCTION fraud_analyze(text):

  PARALLEL:
    score  = compute_plagiarism_score(text)   // TF-IDF cosine sim
    issues = detect_patterns(text)            // repeated sentences, keywords
    issues += check_citations(text)           // mixed citation styles

  risk_level = classify_risk(score, issues)

  RETURN { plagiarism_score, risk_level, issues }
```

---

### 6.3 Plagiarism Score

```
FUNCTION compute_plagiarism_score(text, corpus):

  IF text is empty: RETURN 0.0

  all_docs = [text] + corpus
  tfidf_matrix = TfidfVectorizer().fit_transform(all_docs)

  input_vec  = tfidf_matrix[0]
  corpus_vecs = tfidf_matrix[1:]

  similarities = cosine_similarity(input_vec, corpus_vecs)
  RETURN clamp(max(similarities), 0.0, 1.0)
```

---

### 6.4 Pattern Detection

```
FUNCTION detect_patterns(text):
  issues = []

  // Repeated sentences
  sentences = split_sentences(text)
  FOR sentence, count IN Counter(sentences):
    IF count >= 3 AND len(sentence) >= 15:
      issues.append(repeated_sentence_issue)

  // Overused keywords
  words = tokenize(text)
  FOR word, count IN word_frequency(words):
    IF count / total_words > 0.05:
      issues.append(overused_keyword_issue)

  // Unusual structure
  headings = count_heading_lines(text)
  IF headings < 3:
    issues.append(unusual_structure_issue)

  RETURN issues
```

---

### 6.5 RAG Chatbot

```
FUNCTION answer(uuid, question):

  index, chunks = load_faiss_index(uuid)
  IF index is None: RAISE FileNotFoundError

  // Retrieve relevant context
  query_embedding = embed(question)
  top_indices = index.search(query_embedding, k=5)
  context = join([chunks[i] for i in top_indices])

  // Generate answer
  messages = [
    system: "Answer based ONLY on the provided context.",
    user:   context + "\n\nQuestion: " + question
  ]
  answer = LLM.chat_completion(messages)

  RETURN { answer, sources }
```

---

### 6.6 Semantic Recommender

```
FUNCTION recommend(query, top_k=10):

  corpus_texts = [title + abstract FOR paper IN CORPUS]
  all_texts    = [query] + corpus_texts

  embeddings = SentenceTransformer.encode(all_texts)
  query_emb  = embeddings[0]
  corpus_emb = embeddings[1:]

  similarities = cosine_similarity(query_emb, corpus_emb)
  top_indices  = argsort(similarities, descending=True)[:top_k]

  RETURN [CORPUS[i] + similarity_score FOR i IN top_indices]
```

---

## 7. Technology Stack

### Frontend
- React 18 + TypeScript
- Vite (build tool)
- React Router v6
- Custom CSS-in-JS design system (dark theme)

### Backend
- Node.js + Express
- MySQL — user accounts, paper metadata, status tracking
- MongoDB — full document store (extracted text, reports, summaries)
- JWT authentication
- Multer — PDF file upload handling
- PDFKit — PDF report generation

### AI Engine
- Python 3.11 + FastAPI
- pdfplumber / PyMuPDF — PDF text extraction
- scikit-learn — TF-IDF vectorization, cosine similarity
- sentence-transformers — semantic embeddings (all-MiniLM-L6-v2)
- FAISS — vector index for RAG search
- LangChain — text chunking (RecursiveCharacterTextSplitter)
- OpenRouter API — LLM access (liquid/lfm-2.5, Llama 3.3 70B, Gemma 3, etc.)
- Motor — async MongoDB driver

### Infrastructure
- Docker + Docker Compose
- Nginx (optional reverse proxy)

---

## 8. Module Descriptions

### `pdf_processor.py`
Extracts raw text from uploaded PDFs using pdfplumber with PyMuPDF as fallback. Raises `UnreadablePDFError` for scanned/image-only PDFs.

### `fraud_detector.py`
Orchestrates plagiarism, pattern, and citation modules concurrently using `asyncio.gather`. Computes final risk level from combined results.

### `plagiarism.py`
TF-IDF vectorizer + cosine similarity against a 10-document reference corpus of generic academic sentences. Returns a normalized score in [0, 1].

### `pattern_detector.py`
Detects: (1) sentences repeated ≥ 3 times with length ≥ 15 chars, (2) keywords exceeding 5% word frequency, (3) documents with fewer than 3 heading-like lines.

### `citation_checker.py`
Regex-based detection of APA, IEEE, and MLA citation styles. Flags mixed usage. Builds a co-citation graph and detects citation rings (connected components ≥ 3 with weight ≥ 2).

### `embedder.py`
Chunks paper text into 512-token overlapping segments, encodes with sentence-transformers, stores in FAISS IndexFlatL2. Supports dynamic dimension rebuilding on model change.

### `summarizer.py`
LLM-first: sends up to 12,000 chars to OpenRouter with a structured prompt requesting title, contributions, methodology, and conclusions (3–5 sentences each). Falls back to regex/heuristic section extraction if LLM fails.

### `chatbot.py`
RAG pipeline: FAISS top-5 retrieval → context assembly → LLM answer generation. Falls back to returning the top excerpt if LLM is unavailable.

### `recommender.py`
Encodes query and 12-paper corpus with sentence-transformers. Returns top-k papers ranked by cosine similarity with full abstracts.

### `llm.py`
OpenRouter API client with automatic model fallback chain: tries 7 free models in sequence on 404/429/503 errors. Also provides `embed_texts()` via sentence-transformers locally.

---

## 9. API Endpoints

### AI Engine (FastAPI — port 8000)

| Method | Endpoint | Description |
|---|---|---|
| GET | `/health` | Health check |
| POST | `/process` | Full paper analysis pipeline |
| POST | `/reprocess-summary` | Re-run summarization only |
| POST | `/chat` | RAG chatbot Q&A |
| POST | `/recommend` | Semantic paper recommendations |
| POST | `/citation-graph` | Build citation co-occurrence graph |

### Backend (Express — port 4000)

| Method | Endpoint | Description |
|---|---|---|
| POST | `/auth/register` | User registration |
| POST | `/auth/login` | JWT login |
| POST | `/upload` | Upload PDF, trigger AI processing |
| GET | `/dashboard` | List user's papers |
| GET | `/report/:uuid` | Full paper report |
| GET | `/export/:uuid/pdf` | Download PDF integrity report |
| POST | `/chat` | Proxy to AI chatbot |
| GET | `/citation/:uuid` | Citation graph data |
| POST | `/reprocess/:uuid` | Re-trigger analysis |

---

## 10. Data Flow

```
User uploads PDF
      │
      ▼
Backend saves file → MySQL (status: processing)
      │
      ▼
Backend calls AI Engine POST /process
      │
      ├── pdf_processor  → extract raw text
      │
      ├── [CONCURRENT] ──────────────────────────────────┐
      │   fraud_detector                                  │
      │     ├── plagiarism (TF-IDF cosine sim)           │
      │     ├── pattern_detector (regex + Counter)       │
      │     └── citation_checker (regex + graph)         │
      │                                                   │
      │   embedder (sentence-transformers + FAISS)        │
      │                                                   │
      │   summarizer (LLM via OpenRouter)                 │
      └───────────────────────────────────────────────────┘
      │
      ▼
MongoDB stores: fraud_report, summary, keywords, extracted_text
MySQL updates: status = completed, risk_level, plagiarism_score
      │
      ▼
Frontend polls → displays Report Page
  ├── Fraud Report tab   (risk badge, issues list)
  ├── Citation Graph tab (interactive node-edge graph)
  ├── AI Assistant tab   (RAG chatbot)
  └── Related Papers tab (semantic recommendations)
```

---

## 11. Risk Level Output

| Score Range | Conditions | Risk Level | Color |
|---|---|---|---|
| < 0.30 | No critical issues | Low | Green |
| ≥ 0.30 | OR has critical issue | Medium | Amber |
| > 0.60 | OR score > 0.30 + critical | High | Red |

**Critical issue types:** `repeated_sentence`, `citation_inconsistency`

---

## 12. Screenshots (Placeholder Descriptions)

> Replace each placeholder below with actual screenshots from the running application.

**Screen 1 — Upload Page**
Drag-and-drop PDF upload area with animated border, feature highlights (Fraud Report, AI Summary, RAG Chatbot, Related Papers), and a "Start Analysis" CTA button.

**Screen 2 — Dashboard**
Table of uploaded papers showing filename, upload date, risk badge (Low/Medium/High), plagiarism percentage, issue count, and action buttons (View Report, Export PDF).

**Screen 3 — Fraud Report Tab**
Risk summary box with plagiarism percentage and risk level side-by-side. Below: numbered list of detected issues with type label, description, and excerpt.

**Screen 4 — Citation Graph Tab**
Interactive force-directed graph. Nodes = references, edges = co-citations (thickness = weight). Highlighted clusters indicate potential citation rings.

**Screen 5 — AI Assistant Tab**
Chat interface with message bubbles. User question on the right, AI answer on the left with source excerpts shown below each response.

**Screen 6 — Related Papers Tab**
Search bar pre-filled with paper keywords. Results list showing title, authors, full abstract, similarity progress bar, and percentage match.

**Screen 7 — Exported PDF Report**
Clean 2-page PDF: header banner, paper info, fraud analysis box, issues list, AI summary fields — all aligned with consistent typography.

---

## 13. Sample Output

### Fraud Report (JSON)
```json
{
  "plagiarism_score": 0.1938,
  "risk_level": "medium",
  "issues": [
    {
      "type": "repeated_sentence",
      "description": "Sentence repeated 4 times: \"The proposed system achieves...\"",
      "excerpt": "The proposed system achieves high accuracy in energy prediction."
    },
    {
      "type": "citation_inconsistency",
      "description": "Mixed citation styles detected: APA, IEEE.",
      "excerpt": "APA: Smith, 2021 | IEEE: [3]"
    }
  ]
}
```

### AI Summary (JSON)
```json
{
  "title": "Smart Home Solar Prediction System Using Machine Learning",
  "main_contributions": "Introduces an integrated framework combining solar irradiance prediction with smart home device scheduling. The system leverages ensemble machine learning models to optimize energy consumption in real time. A novel feedback loop between prediction accuracy and scheduling decisions is proposed, reducing energy waste by up to 23%.",
  "methodology": "Utilizes Random Forest and LSTM networks trained on historical solar irradiance and household consumption data. Feature engineering includes time-of-day encoding, weather API integration, and appliance usage patterns. The model is evaluated on a 12-month dataset from 50 residential installations.",
  "conclusions": "The integrated approach demonstrates a 23% reduction in energy costs compared to baseline scheduling. The system generalizes well across residential and small commercial settings. Future work will explore federated learning to preserve user privacy while improving model accuracy across deployments."
}
```

### Chatbot Response
```
User:    What dataset was used in this paper?

FraudLens: Based on the paper, the dataset consists of 12 months of solar
           irradiance readings and household energy consumption logs collected
           from 50 residential installations across three climate zones.
           The data was preprocessed to remove outliers and normalized using
           min-max scaling before model training.

Sources: [Chunk 14 — Section 3.2 Dataset Description]
         [Chunk 17 — Section 3.3 Preprocessing]
```

---

## 14. Inference & Observations

1. **Plagiarism scoring is relative** — the score reflects similarity to a generic academic corpus, not a live internet search. A score of 0.19 (19%) indicates moderate overlap with common academic phrasing, which is expected and not necessarily fraudulent.

2. **Pattern detection noise** — short fragments from reference lists (bullet points, year tokens) can trigger false "repeated sentence" flags. The system filters tokens under 15 characters and pure numeric fragments to reduce this.

3. **LLM quality depends on model availability** — OpenRouter free-tier models are used with a 7-model fallback chain. Response quality varies; larger models (Llama 3.3 70B) produce richer summaries but may be rate-limited.

4. **RAG accuracy is bounded by chunk quality** — FAISS retrieval is only as good as the extracted text. Scanned PDFs or heavily formatted two-column layouts may produce fragmented chunks, reducing chatbot accuracy.

5. **Citation graph is structural, not semantic** — it detects co-citation patterns and mixed styles but does not verify whether cited papers actually exist or are correctly attributed.

6. **Risk classification is heuristic** — thresholds (0.30, 0.60) are empirically chosen. A "medium" risk paper may still be entirely legitimate; the report is a decision-support tool, not a verdict.

7. **Scalability** — FAISS indexes are stored per-paper on disk. For large deployments, these should be migrated to a vector database (Pinecone, Weaviate, or pgvector).

---

## 15. Setup & Running

```bash
# Clone and configure
cp .env.example .env
cp ai-engine/.env.example ai-engine/.env
cp backend/.env.example backend/.env

# Add your OpenRouter API key to ai-engine/.env
# OPENROUTER_API_KEY=sk-or-...

# Start all services
docker-compose up --build

# Access
# Frontend:   http://localhost:3000
# Backend:    http://localhost:4000
# AI Engine:  http://localhost:8000/docs
```

---

## 16. Future Enhancements

- Live internet plagiarism check via CrossRef / Semantic Scholar APIs
- OCR support for scanned PDFs (Tesseract integration)
- Multi-paper batch upload and comparison
- Federated learning for privacy-preserving model improvement
- Browser extension for inline paper checking
- Institutional dashboard with team-level analytics
- GPT-4 / Claude integration for higher-quality summaries

---

*FraudLens — Built with FastAPI, React, Node.js, FAISS, and OpenRouter LLMs.*
