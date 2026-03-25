# Requirements Document

## Introduction

FraudLens is a full-stack AI-powered system for detecting fraud and analyzing research papers. Users upload a PDF, receive a detailed fraud detection report (plagiarism score, risk level, flagged issues), interact with the paper via a RAG-based chatbot, and discover related papers through a recommendation engine. The system is composed of a React frontend, a Node.js/Express backend, and a Python FastAPI AI engine backed by MongoDB.

---

## Glossary

- **System**: The FraudLens application as a whole
- **Frontend**: The React.js web application served to the user
- **Backend**: The Node.js/Express API server
- **AI_Engine**: The Python FastAPI service responsible for all AI/ML processing
- **PDF_Processor**: The component within AI_Engine that extracts text from uploaded PDFs using pdfplumber
- **Fraud_Detector**: The AI_Engine module that runs plagiarism detection, suspicious pattern detection, and citation checks
- **Plagiarism_Module**: The TF-IDF + cosine similarity component within Fraud_Detector
- **Pattern_Module**: The component that detects repeated sentences, overused keywords, and unusual structure
- **Citation_Module**: The component that extracts and validates reference format consistency
- **Chatbot**: The RAG-based Q&A component powered by LangChain, FAISS, and an LLM
- **Recommender**: The component that returns related papers using Sentence-BERT embeddings and cosine similarity
- **Dashboard**: The Frontend UI that displays upload, analysis report, chatbot, and recommendations
- **Fraud_Report**: The structured output containing plagiarism_score, risk_level, and issues list
- **Embedding_Store**: The FAISS vector index built from chunked paper text

---

## Requirements

### Requirement 1: PDF Upload

**User Story:** As a researcher, I want to upload a research paper PDF, so that the system can analyze it for fraud and enable Q&A.

#### Acceptance Criteria

1. THE Frontend SHALL provide a file input that accepts only PDF files.
2. WHEN a user submits a PDF, THE Backend SHALL receive the file via `POST /upload` and store it temporarily for processing.
3. IF the uploaded file is not a valid PDF, THEN THE Backend SHALL return an error response with HTTP status 400 and a descriptive message.
4. IF the uploaded file exceeds 20 MB, THEN THE Backend SHALL reject the upload and return an error response with HTTP status 413.
5. WHEN a PDF is successfully received, THE Backend SHALL forward it to the AI_Engine for text extraction.
6. WHEN the AI_Engine receives a PDF, THE PDF_Processor SHALL extract the full text content using pdfplumber.
7. IF pdfplumber cannot extract text from the PDF (e.g., scanned image-only PDF), THEN THE PDF_Processor SHALL return an error indicating the file is not machine-readable.

---

### Requirement 2: Fraud Detection

**User Story:** As a researcher, I want to receive a fraud detection report on my uploaded paper, so that I can identify potential integrity issues.

#### Acceptance Criteria

1. WHEN text is extracted from a PDF, THE Fraud_Detector SHALL run all three detection modules (Plagiarism_Module, Pattern_Module, Citation_Module) concurrently using async parallel processing.
2. THE Plagiarism_Module SHALL compute a plagiarism_score between 0.0 and 1.0 using TF-IDF vectorization and cosine similarity against a reference corpus.
3. THE Pattern_Module SHALL detect repeated sentences (appearing 3 or more times), overused keywords (frequency exceeding 5% of total word count), and unusual structural patterns.
4. THE Citation_Module SHALL extract all references from the paper and flag citations that do not conform to a consistent format (e.g., mixed APA/MLA/IEEE styles within the same document).
5. WHEN all modules complete, THE Fraud_Detector SHALL produce a Fraud_Report containing: plagiarism_score (float 0–1), risk_level (one of: "low", "medium", "high"), and an issues list describing each detected problem.
6. THE Fraud_Detector SHALL assign risk_level "low" when plagiarism_score is below 0.3 and no critical pattern or citation issues are found, "medium" when plagiarism_score is between 0.3 and 0.6 or moderate issues are found, and "high" when plagiarism_score exceeds 0.6 or critical issues are found.
7. WHEN the Fraud_Report is ready, THE Backend SHALL store it in MongoDB associated with the uploaded paper's identifier.
8. WHEN the Frontend requests the report via `POST /analyze`, THE Backend SHALL return the Fraud_Report as a JSON response.

---

### Requirement 3: Fraud Report Visualization

**User Story:** As a researcher, I want to see a visual representation of the fraud analysis results, so that I can quickly understand the severity and nature of detected issues.

#### Acceptance Criteria

1. WHEN a Fraud_Report is received, THE Dashboard SHALL display the plagiarism_score as a percentage gauge or progress bar.
2. THE Dashboard SHALL render the risk_level with a distinct color indicator: green for "low", amber for "medium", and red for "high".
3. THE Dashboard SHALL list each item in the issues list with the issue type, description, and the relevant text excerpt.
4. WHERE suspicious text is identified in the issues list, THE Dashboard SHALL highlight the corresponding passage within a rendered view of the paper text.
5. THE Dashboard SHALL display a paper summary generated by the AI_Engine alongside the fraud report.

---

### Requirement 4: Chatbot (RAG-based Q&A)

**User Story:** As a researcher, I want to ask questions about the uploaded paper, so that I can quickly understand its content without reading it in full.

#### Acceptance Criteria

1. WHEN a PDF is successfully processed, THE AI_Engine SHALL chunk the extracted text into segments of no more than 512 tokens with a 50-token overlap, generate embeddings for each chunk, and store them in an Embedding_Store (FAISS index).
2. WHEN a user submits a question via `POST /chat`, THE Chatbot SHALL retrieve the top-5 most semantically relevant chunks from the Embedding_Store using cosine similarity.
3. WHEN relevant chunks are retrieved, THE Chatbot SHALL construct a prompt combining the retrieved context and the user's question, then query the configured LLM to generate an answer.
4. THE Chatbot SHALL return the LLM-generated answer along with the source chunk references to the Frontend within 15 seconds.
5. IF the LLM or Embedding_Store is unavailable, THEN THE Chatbot SHALL return an error response with HTTP status 503 and a descriptive message.
6. THE Chatbot SHALL support a "summarize this paper" request that produces a structured summary including: title, main contributions, methodology, and conclusions.
7. THE Frontend SHALL maintain and display a scrollable chat history for the current session, preserving the order of questions and answers.
8. WHEN a user starts a new upload session, THE Frontend SHALL clear the previous chat history.

---

### Requirement 5: Paper Recommendation

**User Story:** As a researcher, I want to receive recommendations for related research papers, so that I can explore relevant literature efficiently.

#### Acceptance Criteria

1. WHEN a user submits a topic or keyword query via `POST /recommend`, THE Recommender SHALL encode the query using Sentence-BERT and compute cosine similarity against a pre-indexed corpus of paper embeddings.
2. THE Recommender SHALL return the top-10 most similar papers, each including: title, authors, abstract snippet, and similarity score.
3. IF the query string is empty or fewer than 3 characters, THEN THE Backend SHALL return an error response with HTTP status 400.
4. THE Dashboard SHALL display recommendation results as a list of paper cards, each showing title, authors, abstract snippet, and similarity score.
5. WHEN the user uploads a paper, THE Recommender SHALL automatically generate recommendations based on the paper's extracted keywords without requiring a manual query.

---

### Requirement 6: Backend API

**User Story:** As a developer, I want a well-defined REST API, so that the Frontend and AI_Engine can communicate reliably.

#### Acceptance Criteria

1. THE Backend SHALL expose the following endpoints: `POST /upload`, `POST /analyze`, `POST /chat`, `POST /recommend`.
2. WHEN any API endpoint receives a request with a malformed JSON body, THE Backend SHALL return HTTP status 400 with a descriptive error message.
3. WHEN any API endpoint encounters an unhandled internal error, THE Backend SHALL return HTTP status 500 and log the error details server-side without exposing stack traces to the client.
4. THE Backend SHALL forward AI processing requests to the AI_Engine and relay responses back to the Frontend without modifying the payload structure.
5. THE Backend SHALL store paper metadata and Fraud_Reports in MongoDB, associating each record with a unique paper identifier (UUID).

---

### Requirement 7: Parallel Processing

**User Story:** As a user, I want analysis results to be returned as fast as possible, so that I don't wait unnecessarily for the report.

#### Acceptance Criteria

1. WHEN the AI_Engine processes a paper, THE AI_Engine SHALL execute fraud detection, NLP analysis, and embedding generation concurrently using Python async tasks or multiprocessing.
2. THE AI_Engine SHALL complete the full analysis pipeline (fraud detection + embedding generation) for a paper of up to 50 pages within 60 seconds under normal load.
3. IF any parallel task fails, THEN THE AI_Engine SHALL return a partial result containing the outputs of completed tasks and an error description for the failed task.

---

### Requirement 8: Paper Summary Auto-Generation

**User Story:** As a researcher, I want an automatic summary of the uploaded paper, so that I can quickly grasp its key points without reading it fully.

#### Acceptance Criteria

1. WHEN a paper is successfully processed, THE AI_Engine SHALL automatically generate a structured summary containing: title, main contributions, methodology, and conclusions.
2. THE AI_Engine SHALL generate the summary using the configured LLM with the extracted paper text as input.
3. THE Backend SHALL store the generated summary in MongoDB associated with the paper's identifier.
4. THE Dashboard SHALL display the auto-generated summary on the Analysis Report page.

---

### Requirement 9: Data Persistence and Session Management

**User Story:** As a user, I want my analysis results to persist, so that I can revisit them without re-uploading the paper.

#### Acceptance Criteria

1. THE Backend SHALL assign a unique UUID to each uploaded paper and return it to the Frontend upon successful upload.
2. WHEN the Frontend provides a valid paper UUID, THE Backend SHALL retrieve and return the associated Fraud_Report, summary, and metadata from MongoDB.
3. IF a requested paper UUID does not exist in MongoDB, THEN THE Backend SHALL return HTTP status 404.
4. THE Backend SHALL store uploaded PDF files in a designated temporary storage location and retain them for a minimum of 24 hours after upload.
