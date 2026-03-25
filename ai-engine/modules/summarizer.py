"""Summarizer — uses OpenRouter LLM."""
import os
from modules.llm import chat_completion


def generate_summary(text: str) -> dict:
    truncated = text[:5000] if len(text) > 5000 else text
    messages = [
        {
            "role": "system",
            "content": "You are an expert academic paper analyst. Respond ONLY with the four labeled lines requested, nothing else.",
        },
        {
            "role": "user",
            "content": (
                "Analyze this research paper and respond with EXACTLY these four lines:\n"
                "Title: <paper title>\n"
                "Main Contributions: <key contributions in 1-2 sentences>\n"
                "Methodology: <methods used in 1-2 sentences>\n"
                "Conclusions: <main conclusions in 1-2 sentences>\n\n"
                f"Paper text:\n{truncated}"
            ),
        },
    ]

    result = {
        "title": "Unknown",
        "main_contributions": "Not available",
        "methodology": "Not available",
        "conclusions": "Not available",
    }

    try:
        raw = chat_completion(messages, max_tokens=400, temperature=0.1)
        for line in raw.split("\n"):
            s = line.strip()
            if s.lower().startswith("title:"):
                v = s.split(":", 1)[1].strip()
                if v: result["title"] = v
            elif s.lower().startswith("main contributions:"):
                v = s.split(":", 1)[1].strip()
                if v: result["main_contributions"] = v
            elif s.lower().startswith("methodology:"):
                v = s.split(":", 1)[1].strip()
                if v: result["methodology"] = v
            elif s.lower().startswith("conclusions:"):
                v = s.split(":", 1)[1].strip()
                if v: result["conclusions"] = v
    except Exception as e:
        print(f"Summarizer error: {e}")

    return result
