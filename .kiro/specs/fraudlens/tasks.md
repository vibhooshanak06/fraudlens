# Implementation Plan: FraudLens

## Overview

Full-stack implementation of FraudLens across three services: React frontend, Node.js/Express backend, and Python FastAPI AI engine, all backed by MongoDB. Tasks are ordered to build each service incrementally and wire them together at the end.

## Tasks

- [x] 1. Project scaffolding and configuration
  - [x] 1.1 Create monorepo directory structure with `frontend/`, `backend/`, `ai-engine/` folders
  - [x] 1.2 Configure environment variables for all services

- [x] 2. MongoDB data models and connection
  - [x] 2.1 Implement MongoDB connection module in the backend (`backend/src/db.js`)
  - [x] 2.2 Define `papers` Mongoose schema and model
  - [x] 2.3 Define `recommendations_corpus` Mongoose schema and model
  - [x] 2.4 Write property test for paper data round-trip

- [x] 3. Backend: file upload endpoint
  - [x] 3.1 Implement `POST /upload` route with multer middleware
  - [x] 3.2 Write property test for non-PDF upload rejection
  - [x] 3.3 Write property test for UUID uniqueness

- [x] 4. Backend: global error handling and validation middleware
  - [x] 4.1 Add global JSON parse error handler
  - [x] 4.2 Add global unhandled error handler
  - [x] 4.3 Write property test for malformed JSON rejection
rite property test for internal error response safety

- [x] 5. Backend: remaining API endpoints
  - [x] 5.1 Implement `POST /analyze` route
  - [x] 5.2 Implement `POST /chat` route
  - [x] 5.3 Implement `POST /recommend` route
  - [x] 5.4 Implement `GET /paper/:uuid` route
  - [x] 5.5 Write property test for short query rejection
  - [x] 5.6 Write property test for missing UUID returns 404
  - [x] 5.7 Write property test for payload pass-through invariant

- [x] 6. Checkpoint — Backend

F processing module
  - [x] 7.1 Implement `PDF_Processor` in `ai-engine/modules/pdf_processor.py`
  - [x] 7.2 Write property test for PDF text extraction round-trip

- [x] 8. AI Engine: fraud detection modules
  - [x] 8.1 Implement `Plagiarism_Module` in `ai-engine/modules/plagiarism.py`
  - [x] 8.2 Write property test for plagiarism score bounds
  - [x] 8.3 Implement `Pattern_Module` in `ai-engine/modules/pattern_detector.py`
  - [x] 8.4 Write property test for pattern detection threshold invariant
  - [x] 8.5 Implement `Citation_Module` in `ai-engine/modules/citation_checker.py`
  - [x] 8.6 Write property test for citation inconsistency detection
  - [x] 8.7 Implement `Fraud_Detector` in `ai-engine/modules/fraud_detector.py`
  - [x] 8.8 Write property test for fraud report structural invariant
  - [x] 8.9 Write property test for risk level threshold assignment
  - [x] 8.10 Write property test for partial result on task failure

- [x] 9. AI Engine: embedding and chunking
  - [x] 9.1 Implement `Embedder` in `ai-engine/modules/embedder.py`
  - [x] 9.2 Write property test for chunk size invariant

- [x] 10. AI Engine: chatbot (RAG pipeline)
  - [x] 10.1 Implement `Chatbot` in `ai-engine/modules/chatbot.py`
  - [x] 10.2 Write property test for retrieval count invariant
  - [x] 10.3 Write property test for chatbot response structure

- [x] 11. AI Engine: summarizer
  - [x] 11.1 Implement `Summarizer` in `ai-engine/modules/summarizer.py`
  - [x] 11.2 Write property test for summary structural invariant

- [x] 12. AI Engine: recommendation engine
  - [x] 12.1 Implement `Recommender` in `ai-engine/modules/recommender.py`
  - [x] 12.2 Write property test for recommendation result structure
  - [x] 12.3 Write property test for recommendation similarity score bounds

- [x] 13. AI Engine: parallel processing orchestrator and FastAPI routes
  - [x] 13.1 Implement `POST /process` FastAPI endpoint in `ai-engine/main.py`
  - [x] 13.2 Implement `POST /chat` FastAPI endpoint
  - [x] 13.3 Implement `POST /recommend` FastAPI endpoint

- [x] 14. Checkpoint — AI Engine

- [x] 15. Frontend: project setup and routing
  - [x] 15.1 Set up React Router with routes
  - [x] 15.2 Create API client module (`frontend/src/api.ts`)

- [x] 16. Frontend: Upload page
  - [x] 16.1 Implement `UploadPage` component

- [x] 17. Frontend: Analysis Report page
  - [x] 17.1 Implement `FraudReportPanel` component
  - [x] 17.2 Write property test for issue rendering completeness
  - [x] 17.3 Implement `SummaryPanel` component

- [x] 18. Frontend: Chatbot UI
  - [x] 18.1 Implement `ChatPanel` component
  - [x] 18.2 Write property test for chat history ordering

- [x] 19. Frontend: Recommendations page
  - [x] 19.1 Implement `RecommendPanel` component

- [x] 20. Frontend: Dashboard and tabbed layout
  - [x] 20.1 Implement `Dashboard` component with tabbed navigation

- [x] 21. Integration wiring
  - [x] 21.1 Wire backend `POST /upload` to trigger AI Engine `POST /process` after file storage
  - [x] 21.2 Wire backend `POST /analyze` to return stored report from MongoDB
  - [x] 21.3 Verify end-to-end flow with integration test

- [x] 22. Final checkpoint — Full system
