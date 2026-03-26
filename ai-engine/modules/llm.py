"""
LLM client using OpenRouter API (free models).
Drop-in replacement for OpenAI client.
"""
import os
import json
import urllib.request
import urllib.error

OPENROUTER_API_KEY = os.getenv("OPENROUTER_API_KEY", "")
OPENROUTER_BASE = "https://openrouter.ai/api/v1"
# Free models on OpenRouter — primary + fallback
MODEL = os.getenv("OPENROUTER_MODEL", "mistralai/mistral-small-3.1-24b-instruct:free")
FALLBACK_MODEL = "meta-llama/llama-3.2-3b-instruct:free"
FALLBACK_MODEL_2 = "nousresearch/hermes-3-llama-3.1-405b:free"
EMBED_MODEL = "text-embedding-3-small"  # still use OpenAI for embeddings via OpenRouter


def _call_model(model: str, messages: list[dict], max_tokens: int, temperature: float) -> str:
    """Make a single OpenRouter chat completion call with the given model."""
    payload = json.dumps({
        "model": model,
        "messages": messages,
        "max_tokens": max_tokens,
        "temperature": temperature,
    }).encode("utf-8")

    req = urllib.request.Request(
        f"{OPENROUTER_BASE}/chat/completions",
        data=payload,
        headers={
            "Authorization": f"Bearer {OPENROUTER_API_KEY}",
            "Content-Type": "application/json",
            "HTTP-Referer": "https://fraudlens.ai",
            "X-Title": "FraudLens",
        },
        method="POST",
    )

    with urllib.request.urlopen(req, timeout=60) as resp:
        data = json.loads(resp.read().decode("utf-8"))
        return data["choices"][0]["message"]["content"]


def chat_completion(messages: list[dict], max_tokens: int = 800, temperature: float = 0.2) -> str:
    """
    Call OpenRouter chat completion. Tries models in order, skipping on 404/429.
    """
    models = [MODEL, FALLBACK_MODEL, FALLBACK_MODEL_2]
    last_err = None
    for model in models:
        try:
            return _call_model(model, messages, max_tokens, temperature)
        except urllib.error.HTTPError as e:
            body = e.read().decode("utf-8", errors="ignore")
            last_err = RuntimeError(f"OpenRouter HTTP {e.code} ({model}): {body[:200]}")
            if e.code in (404, 429, 503):
                continue  # try next model
            raise last_err
        except Exception as e:
            last_err = RuntimeError(f"OpenRouter request failed ({model}): {e}")
            continue
    raise last_err or RuntimeError("All configured LLM models are unavailable")


def embed_texts(texts: list[str]) -> list[list[float]]:
    """
    Get embeddings via OpenRouter (proxies OpenAI embeddings).
    Falls back to TF-IDF-based pseudo-embeddings if unavailable.
    """
    payload = json.dumps({
        "model": "openai/text-embedding-3-small",
        "input": texts,
    }).encode("utf-8")

    req = urllib.request.Request(
        f"{OPENROUTER_BASE}/embeddings",
        data=payload,
        headers={
            "Authorization": f"Bearer {OPENROUTER_API_KEY}",
            "Content-Type": "application/json",
            "HTTP-Referer": "https://fraudlens.ai",
            "X-Title": "FraudLens",
        },
        method="POST",
    )

    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            data = json.loads(resp.read().decode("utf-8"))
            return [item["embedding"] for item in data["data"]]
    except Exception as e:
        # Fallback: use sklearn TF-IDF to produce pseudo-embeddings
        return _tfidf_embeddings(texts)


def _tfidf_embeddings(texts: list[str]) -> list[list[float]]:
    """Fallback: TF-IDF sparse vectors padded to 512 dims."""
    from sklearn.feature_extraction.text import TfidfVectorizer
    import numpy as np
    vec = TfidfVectorizer(max_features=512)
    try:
        matrix = vec.fit_transform(texts).toarray().astype(float)
        # Normalize
        norms = np.linalg.norm(matrix, axis=1, keepdims=True)
        norms[norms == 0] = 1
        matrix = matrix / norms
        return matrix.tolist()
    except Exception:
        dim = 512
        return [[0.0] * dim for _ in texts]
