"""
LLM client using OpenRouter API (free models).
Drop-in replacement for OpenAI client.
"""
import os
import re
import json
import urllib.request
import urllib.error

OPENROUTER_API_KEY = os.getenv("OPENROUTER_API_KEY", "")
OPENROUTER_BASE = "https://openrouter.ai/api/v1"
# Free models on OpenRouter — primary + fallback
MODEL = os.getenv("OPENROUTER_MODEL", "liquid/lfm-2.5-2.6b:free")
FALLBACK_MODELS = [
    "nvidia/nemotron-3.5-lightning:free",
    "thinkingmachines/inkling-small:free",
]


def _strip_thinking(text: str) -> str:
    """Remove internal reasoning/thinking blocks that some models leak into output.

    Handles all known patterns:
      - <think>...</think>  or  <thinking>...</thinking>
      - "Here's a thinking process:" / "Here's my thinking:" preambles followed
        by numbered steps, ending when the actual answer begins
      - **Answer:** / **Response:** / **Final Answer:** section markers
    """
    # 1. XML-style think blocks
    text = re.sub(r"<think>.*?</think>", "", text, flags=re.DOTALL | re.IGNORECASE)
    text = re.sub(r"<thinking>.*?</thinking>", "", text, flags=re.DOTALL | re.IGNORECASE)

    # 2. "Here's a thinking process:" style preambles — strip everything up to
    #    the first blank line that follows a numbered-list block, or up to a
    #    recognisable answer marker.
    thinking_header = re.search(
        r"(?:here'?s?\s+(?:a\s+)?(?:my\s+)?thinking(?:\s+process)?[\s:]+)",
        text, flags=re.IGNORECASE
    )
    if thinking_header:
        after = text[thinking_header.start():]
        # Look for the actual answer after the reasoning block.
        # Gemma ends its thinking with a double newline before the real answer.
        # We find the last numbered item block and take what comes after.
        end_of_reasoning = re.search(
            r"\n\n(?!\s*\d+[\.\)])",  # blank line NOT followed by another numbered item
            after
        )
        if end_of_reasoning:
            text = after[end_of_reasoning.end():]
        else:
            # Fallback: drop everything before the preamble header
            text = text[:thinking_header.start()]

    # 3. Explicit answer section markers
    for marker in ("**Answer:**", "**Response:**", "**Final Answer:**",
                   "Answer:", "Response:"):
        lower = text.lower()
        needle = marker.lower()
        if lower.startswith(needle) or f"\n{needle}" in lower:
            idx = lower.find(needle)
            text = text[idx + len(marker):]
            break

    return text.strip()


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
        raw = data["choices"][0]["message"]["content"]
        return _strip_thinking(raw)


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
