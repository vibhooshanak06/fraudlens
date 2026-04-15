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
MODEL = os.getenv("OPENROUTER_MODEL", "liquid/lfm-2.5-1.2b-instruct:free")
FALLBACK_MODELS = [
    "liquid/lfm-2.5-1.2b-thinking:free",
    "google/gemma-3-4b-it:free",
    "meta-llama/llama-3.2-3b-instruct:free",
    "mistralai/mistral-small-3.1-24b-instruct:free",
    "meta-llama/llama-3.3-70b-instruct:free",
    "nousresearch/hermes-3-llama-3.1-405b:free",
]


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
    Call OpenRouter chat completion. Tries models in order, skipping on 404/429/503.
    """
    models = [MODEL] + FALLBACK_MODELS
    last_err = None
    for model in models:
        try:
            return _call_model(model, messages, max_tokens, temperature)
        except urllib.error.HTTPError as e:
            body = e.read().decode("utf-8", errors="ignore")
            last_err = RuntimeError(f"OpenRouter HTTP {e.code} ({model}): {body[:200]}")
            if e.code in (404, 429, 503, 500):
                print(f"[LLM] {model} unavailable ({e.code}), trying next...")
                continue
            raise last_err
        except Exception as e:
            last_err = RuntimeError(f"OpenRouter request failed ({model}): {e}")
            print(f"[LLM] {model} failed: {e}, trying next...")
            continue
    raise last_err or RuntimeError("All configured LLM models are unavailable")


_st_model = None

def _get_st_model():
    global _st_model
    if _st_model is None:
        from sentence_transformers import SentenceTransformer
        _st_model = SentenceTransformer('all-MiniLM-L6-v2')
    return _st_model


def embed_texts(texts: list[str]) -> list[list[float]]:
    """Embed texts using sentence-transformers (local, no API needed)."""
    model = _get_st_model()
    embeddings = model.encode(texts, normalize_embeddings=True)
    return embeddings.tolist()
