from dotenv import load_dotenv
load_dotenv()

import asyncio
import os
from collections import Counter
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from motor.motor_asyncio import AsyncIOMotorClient

from modules.pdf_processor import extract_text, UnreadablePDFError
from modules.fraud_detector import analyze as fraud_analyze
from modules.embedder import build_index
from modules.summarizer import generate_summary
from modules.chatbot import answer as chatbot_answer
from modules.recommender import recommend as do_recommend
from modules.citation_checker import get_citation_graph
from modules.downloader import download_pdf

app = FastAPI(title="FraudLens AI Engine")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

_mongo_client = None
_db = None

STOPWORDS = {
    "the", "a", "an", "is", "are", "was", "were", "in", "on", "at", "to", "of",
    "and", "or", "but", "for", "with", "by", "this", "that", "it", "as", "be",
    "been", "being", "have", "has", "had", "do", "does", "did", "will", "would",
    "could", "should", "may", "might", "shall", "can", "from", "into", "through",
    "during", "before", "after", "above", "below", "between", "each", "few",
    "more", "most", "other", "some", "such", "than", "then", "there", "these",
    "they", "those", "too", "very", "just", "also", "about", "which", "when",
    "where", "who", "how", "all", "both",
}


def get_db():
    global _mongo_client, _db
    if _mongo_client is None:
        uri = os.getenv("MONGO_URI", "mongodb://localhost:27017/fraudlens")
        _mongo_client = AsyncIOMotorClient(uri, serverSelectionTimeoutMS=5000)
        _db = _mongo_client["fraudlens"]
    return _db


def reset_mongo():
    global _mongo_client, _db
    if _mongo_client:
        _mongo_client.close()
    _mongo_client = None
    _db = None


# ---------------------------------------------------------------------------
# Request / response models
# ---------------------------------------------------------------------------

class ProcessRequest(BaseModel):
    uuid: str
    pdf_url: str


class ReprocessRequest(BaseModel):
    uuid: str


class CitationRequest(BaseModel):
    uuid: str
    pdf_url: str


class ChatRequest(BaseModel):
    uuid: str
    question: str


class RecommendRequest(BaseModel):
    query: str


# ---------------------------------------------------------------------------
# Health
# ---------------------------------------------------------------------------

@app.get("/health")
async def health():
    return {"status": "ok"}


# ---------------------------------------------------------------------------
# POST /process  — download PDF, run full pipeline, update MongoDB
# ---------------------------------------------------------------------------

@app.post("/process")
async def process(req: ProcessRequest):
    # Step 1: Download PDF from public URL to a temporary local file
    temp_pdf = download_pdf(req.pdf_url)

    try:
        text = extract_text(temp_pdf)
    except UnreadablePDFError as e:
        raise HTTPException(status_code=422, detail=str(e))
    except (ValueError, FileNotFoundError) as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"PDF extraction failed: {e}")
    finally:
        if os.path.exists(temp_pdf):
            os.remove(temp_pdf)

    # Step 2: Run fraud detection, embedding, and summarisation concurrently
    loop = asyncio.get_running_loop()

    results = await asyncio.gather(
        fraud_analyze(text),
        loop.run_in_executor(None, build_index, req.uuid, text),
        loop.run_in_executor(None, generate_summary, text),
        return_exceptions=True,
    )

    fraud_report = results[0] if not isinstance(results[0], Exception) else {
        "plagiarism_score": 0.0,
        "risk_level": "low",
        "issues": [],
        "errors": [{"module": "fraud_detector", "error": str(results[0])}],
    }

    summary = results[2] if not isinstance(results[2], Exception) else {
        "title": "Unknown",
        "main_contributions": "Not available",
        "methodology": "Not available",
        "conclusions": "Not available",
    }

    if isinstance(results[1], Exception):
        print(f"Embedding failed for {req.uuid}: {results[1]}")

    # Extract keywords
    words = text.lower().split()
    content_words = [
        w.strip(".,;:()[]\"'")
        for w in words
        if w.strip(".,;:()[]\"'") not in STOPWORDS
        and len(w.strip(".,;:()[]\"'")) > 3
    ]
    keywords = [w for w, _ in Counter(content_words).most_common(10)]

    # Step 3: Persist to MongoDB (retry once on connection failure)
    for attempt in range(2):
        try:
            db = get_db()
            await db["papers"].update_one(
                {"uuid": req.uuid},
                {
                    "$set": {
                        "status": "completed",
                        "extracted_text": text[:50000],
                        "fraud_report": fraud_report,
                        "summary": summary,
                        "keywords": keywords,
                    }
                },
                upsert=True,
            )
            break
        except Exception as e:
            print(f"MongoDB update failed for {req.uuid} (attempt {attempt + 1}): {e}")
            reset_mongo()

    return {
        "uuid": req.uuid,
        "status": "completed",
        "fraud_report": fraud_report,
        "summary": summary,
        "keywords": keywords,
        "extracted_text": text[:50000],
    }


# ---------------------------------------------------------------------------
# POST /reprocess-summary  — re-run summarisation from stored MongoDB text
# ---------------------------------------------------------------------------

@app.post("/reprocess-summary")
async def reprocess_summary(req: ReprocessRequest):
    """Re-run summarisation for an already-processed paper using stored text."""
    text = None

    for attempt in range(2):
        try:
            db = get_db()
            doc = await db["papers"].find_one({"uuid": req.uuid})
            if doc and doc.get("extracted_text"):
                text = doc["extracted_text"]
            break
        except Exception as e:
            print(f"MongoDB read failed for {req.uuid} (attempt {attempt + 1}): {e}")
            reset_mongo()

    if not text:
        raise HTTPException(status_code=404, detail="No extracted text found for this paper")

    loop = asyncio.get_running_loop()
    summary = await loop.run_in_executor(None, generate_summary, text)

    for attempt in range(2):
        try:
            db = get_db()
            await db["papers"].update_one(
                {"uuid": req.uuid},
                {"$set": {"summary": summary, "extracted_text": text[:50000]}},
            )
            break
        except Exception as e:
            print(f"MongoDB write failed for {req.uuid} (attempt {attempt + 1}): {e}")
            reset_mongo()

    return {"uuid": req.uuid, "summary": summary}


# ---------------------------------------------------------------------------
# POST /chat
# ---------------------------------------------------------------------------

@app.post("/chat")
async def chat(req: ChatRequest):
    try:
        loop = asyncio.get_running_loop()
        result = await loop.run_in_executor(None, chatbot_answer, req.uuid, req.question)
        return result
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except RuntimeError as e:
        msg = str(e) or repr(e) or "LLM unavailable — all models rate-limited"
        print(f"[Chat] RuntimeError: {msg}")
        raise HTTPException(status_code=503, detail=msg)
    except Exception as e:
        import traceback
        tb = traceback.format_exc()
        msg = str(e) or repr(e) or "Unknown chatbot error"
        print(f"[Chat] Unexpected error: {tb}")
        raise HTTPException(status_code=503, detail=f"Chatbot error: {msg}")


# ---------------------------------------------------------------------------
# POST /recommend
# ---------------------------------------------------------------------------

@app.post("/recommend")
async def recommend(req: RecommendRequest):
    try:
        loop = asyncio.get_running_loop()
        results = await loop.run_in_executor(None, do_recommend, req.query)
        return {"results": results}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Recommendation failed: {e}")


# ---------------------------------------------------------------------------
# POST /citation-graph
# Downloads the full PDF from Supabase, extracts complete (untruncated) text,
# and builds the citation graph. Falls back to stored MongoDB text only if
# the download or extraction fails.
# ---------------------------------------------------------------------------

@app.post("/citation-graph")
async def citation_graph(req: CitationRequest):
    text = None

    # Primary: download PDF and extract full text (references section is at the
    # end and is almost always truncated in the stored 50 000-char MongoDB copy)
    temp_pdf = None
    try:
        temp_pdf = download_pdf(req.pdf_url)
        text = extract_text(temp_pdf)
        print(f"[citation-graph] Extracted {len(text)} chars from PDF for {req.uuid}")
    except Exception as e:
        print(f"[citation-graph] PDF extraction failed for {req.uuid}, falling back to MongoDB: {e}")
    finally:
        if temp_pdf and os.path.exists(temp_pdf):
            os.remove(temp_pdf)

    # Fallback: use stored extracted_text from MongoDB
    if not text:
        for _ in range(2):
            try:
                db = get_db()
                doc = await db["papers"].find_one({"uuid": req.uuid})
                if doc and doc.get("extracted_text"):
                    text = doc["extracted_text"]
                    print(f"[citation-graph] Using stored text ({len(text)} chars) for {req.uuid}")
                break
            except Exception:
                reset_mongo()

    if not text:
        return {
            "uuid": req.uuid,
            "graph": {
                "nodes": [],
                "edges": [],
                "rings": [],
                "stats": {"total_references": 0, "co_citation_pairs": 0, "ring_count": 0},
            },
        }

    loop = asyncio.get_running_loop()
    graph = await loop.run_in_executor(None, get_citation_graph, text)
    print(f"[citation-graph] {req.uuid}: {graph['stats']}")
    return {"uuid": req.uuid, "graph": graph}


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=False)
