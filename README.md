# FraudLens

AI-powered research paper fraud detection and analysis platform.

## Services

| Service | Port | Stack |
|---|---|---|
| Frontend | 3000 | React + Vite + TypeScript |
| Backend | 4000 | Node.js + Express |
| AI Engine | 8000 | Python + FastAPI |
| MongoDB | 27017 | MongoDB 7 |

## Quick Start (Docker)

```bash
# Copy and fill in your environment variables
cp .env.example .env

# Build and start all services
docker compose up --build
```

Open http://localhost:3000 in your browser.

## Local Development

### Prerequisites
- Node.js 20+
- Python 3.11+
- MongoDB running locally or via Docker

### Backend

```bash
cd backend
npm install
cp .env.example .env   # set MONGO_URI, AI_ENGINE_URL, PORT
npm run dev
```

### AI Engine

```bash
cd ai-engine
python -m venv .venv
source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env   # set MONGO_URI, OPENAI_API_KEY, FAISS_STORE_PATH
uvicorn main:app --reload
```

### Frontend

```bash
cd frontend
npm install
cp .env.example .env   # set VITE_API_URL
npm run dev
```

## Running Tests

```bash
# Backend
cd backend && npm test

# AI Engine
cd ai-engine && pytest

# Frontend
cd frontend && npm test
```

## Environment Variables

| Variable | Service | Description |
|---|---|---|
| `MONGO_URI` | backend, ai-engine | MongoDB connection string |
| `AI_ENGINE_URL` | backend | Base URL of the AI Engine |
| `PORT` | backend | HTTP port (default 4000) |
| `OPENAI_API_KEY` | ai-engine | OpenAI API key for LLM calls |
| `FAISS_STORE_PATH` | ai-engine | Directory for persisted FAISS indexes |
| `VITE_API_URL` | frontend | Backend base URL |
