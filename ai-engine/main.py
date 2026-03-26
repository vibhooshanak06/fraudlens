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

app = FastAPI(title="FraudLens AI Engine")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

_mongo_client = None
_db = None

STOPWORDS = {"the","a","an","is","are","was","were","in","on","at","to","of","and","or","but","for","with","by","this","that","it","as","be","been","being","have","has","had","do","does","did","will","would","could","should","may","might","shall","can","from","into","through","during","before","after","above","below","between","each","few","more","most","other","some","such","than","then","there","these","they","those","too","very","just","also","about","which","when","where","who","how","all","both","each","few","more","most","other","some","such"}


def get_db():
    global _mongo_client, _db
    # Recreate client if not initialized or if previous connection failed
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


class ProcessRequest(BaseModel):
    uuid: str
    pdf_path: str


class ChatRequest(BaseModel):
    uuid: str
    question: str


class RecommendRequest(BaseModel):
    query: str


@app.get("/health")
async def health():
    return {"status": "ok"}


@app.post("/process")
async def process(req: ProcessRequest):
    # Step 1: Extract text
    try:
        text = extract_text(req.pdf_path)
    except UnreadablePDFError as e:
        raise HTTPException(status_code=422, detail=str(e))
    except (ValueError, FileNotFoundError) as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"PDF extraction failed: {e}")

    # Step 2: Run fraud detection, embedding, and summarization concurrently
    loop = asyncio.get_running_loop()

    fraud_task = fraud_analyze(text)
    embed_task = loop.run_in_executor(None, build_index, req.uuid, text)
    summary_task = loop.run_in_executor(None, generate_summary, text)

    results = await asyncio.gather(fraud_task, embed_task, summary_task, return_exceptions=True)

    fraud_report = results[0] if not isinstance(results[0], Exception) else {
        "plagiarism_score": 0.0, "risk_level": "low", "issues": [],
        "errors": [{"module": "fraud_detector", "error": str(results[0])}]
    }
    # results[1] is chunks list — not stored directly
    summary = results[2] if not isinstance(results[2], Exception) else {
        "title": "Unknown", "main_contributions": "Not available",
        "methodology": "Not available", "conclusions": "Not available"
    }

    if isinstance(results[1], Exception):
        print(f"Embedding failed for {req.uuid}: {results[1]}")

    # Extract keywords
    words = text.lower().split()
    content_words = [w.strip(".,;:()[]\"'") for w in words if w.strip(".,;:()[]\"'") not in STOPWORDS and len(w.strip(".,;:()[]\"'")) > 3]
    keywords = [w for w, _ in Counter(content_words).most_common(10)]

    # Step 3: Update MongoDB (retry once on connection failure)
    for attempt in range(2):
        try:
            db = get_db()
            await db["papers"].update_one(
                {"uuid": req.uuid},
                {"$set": {
                    "status": "completed",
                    "extracted_text": text[:15000],
                    "fraud_report": fraud_report,
                    "summary": summary,
                    "keywords": keywords,
                }},
                upsert=True
            )
            break  # success
        except Exception as e:
            print(f"MongoDB update failed for {req.uuid} (attempt {attempt+1}): {e}")
            reset_mongo()  # force reconnect on next attempt

    return {
        "uuid": req.uuid,
        "status": "completed",
        "fraud_report": fraud_report,
        "summary": summary,
    }


@app.post("/chat")
async def chat(req: ChatRequest):
    try:
        loop = asyncio.get_running_loop()
        result = await loop.run_in_executor(None, chatbot_answer, req.uuid, req.question)
        return result
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except RuntimeError as e:
        raise HTTPException(status_code=503, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=503, detail=f"Chatbot unavailable: {e}")


@app.post("/recommend")
async def recommend(req: RecommendRequest):
    try:
        loop = asyncio.get_running_loop()
        results = await loop.run_in_executor(None, do_recommend, req.query)
        return {"results": results}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Recommendation failed: {e}")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=False)
