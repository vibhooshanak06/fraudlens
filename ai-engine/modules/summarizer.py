"""Summarizer — uses OpenRouter LLM with text-based fallback."""
from modules.llm import chat_completion


def generate_summary(text: str) -> dict:
    truncated = text[:6000] if len(text) > 6000 else text

    result = {
        "title": "Unknown",
        "main_contributions": "Not available",
        "methodology": "Not available",
        "conclusions": "Not available",
    }

    messages = [
        {
            "role": "system",
            "content": (
                "You are an expert academic paper analyst. "
                "Respond ONLY with exactly these four labeled lines, no extra text:\n"
                "Title: <paper title>\n"
                "Main Contributions: <1-2 sentences>\n"
                "Methodology: <1-2 sentences>\n"
                "Conclusions: <1-2 sentences>"
            ),
        },
        {
            "role": "user",
            "content": f"Analyze this research paper:\n\n{truncated}",
        },
    ]

    try:
        raw = chat_completion(messages, max_tokens=500, temperature=0.1)
        for line in raw.split("\n"):
            s = line.strip()
            if s.lower().startswith("title:"):
                v = s.split(":", 1)[1].strip()
                if v and v.lower() not in ("unknown", "n/a", "<paper title>"):
                    result["title"] = v
            elif s.lower().startswith("main contributions:"):
                v = s.split(":", 1)[1].strip()
                if v and v.lower() not in ("not available", "n/a"):
                    result["main_contributions"] = v
            elif s.lower().startswith("methodology:"):
                v = s.split(":", 1)[1].strip()
                if v and v.lower() not in ("not available", "n/a"):
                    result["methodology"] = v
            elif s.lower().startswith("conclusions:"):
                v = s.split(":", 1)[1].strip()
                if v and v.lower() not in ("not available", "n/a"):
                    result["conclusions"] = v
        return result
    except Exception as e:
        print(f"Summarizer LLM failed: {e}")

    # Text-based fallback — extract from the paper directly
    return _text_fallback(text, result)


def _text_fallback(text: str, base: dict) -> dict:
    """Extract summary fields directly from text when LLM is unavailable."""
    lines = [l.strip() for l in text.split("\n") if l.strip()]
    result = dict(base)
    text_lower = text.lower()

    # --- Title: first substantial all-caps or title-case line ---
    skip_prefixes = ("http", "doi", "©", "working paper", "nber", "arxiv",
                     "journal", "volume", "issue", "page", "submitted", "received",
                     "abstract", "introduction", "references")
    for line in lines[:50]:
        if (20 < len(line) < 250
                and not any(line.lower().startswith(p) for p in skip_prefixes)
                and not line[0].isdigit()
                and not line.startswith("@")
                and sum(1 for c in line if c.isupper()) >= 3):
            result["title"] = line.rstrip(":")
            break

    # --- Helper: get text after a heading line ---
    def get_section_after(heading_line_idx: int, max_chars: int = 600) -> str:
        """Collect text from lines after a heading until next top-level heading or max_chars."""
        collected = []
        total = 0
        for line in lines[heading_line_idx + 1:]:
            # Stop at next TOP-LEVEL numbered section (single digit + space + word, not sub-sections like 2.1)
            is_top_heading = (
                len(line) < 50 and line and line[0].isdigit() and '.' not in line.split()[0]
                and len(line.split()) <= 4
            ) or (line.isupper() and 5 < len(line) < 40)
            if is_top_heading and total > 100:
                break
            collected.append(line)
            total += len(line)
            if total >= max_chars:
                break
        return " ".join(collected)[:max_chars].strip()

    # Find heading line indices
    abstract_idx = methodology_idx = conclusion_idx = -1
    for i, line in enumerate(lines):
        ll = line.lower().strip()
        # Abstract
        if abstract_idx == -1 and ll in ("abstract", "abstract:"):
            abstract_idx = i
        # Methodology / Data / Methods — match numbered sections or standalone headings
        if methodology_idx == -1:
            is_method_heading = (
                ll in ("data", "methods", "methodology", "data and methods",
                       "experimental setup", "approach", "dataset", "survey design",
                       "method", "research design") or
                (len(line) < 50 and any(
                    ll == f"{n} {kw}" or ll == f"{n}. {kw}" or ll == f"{n}.{kw}"
                    for n in range(1, 10)
                    for kw in ("data", "methods", "methodology", "dataset", "survey", "method")
                ))
            )
            if is_method_heading:
                methodology_idx = i
        # Conclusions
        if ll in ("conclusion", "conclusions", "concluding remarks",
                  "summary", "discussion and conclusion") or (
            len(line) < 50 and "conclusion" in ll and line[0].isdigit()
        ):
            conclusion_idx = i  # keep updating to get last occurrence

    if abstract_idx != -1:
        section = get_section_after(abstract_idx, 600)
        if len(section) > 50:
            result["main_contributions"] = section

    if methodology_idx != -1:
        section = get_section_after(methodology_idx, 500)
        if len(section) > 50:
            result["methodology"] = section

    if conclusion_idx != -1:
        section = get_section_after(conclusion_idx, 500)
        if len(section) > 50:
            result["conclusions"] = section

    return result
