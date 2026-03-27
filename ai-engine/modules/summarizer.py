"""Summarizer — LLM-first with a robust text-based fallback."""
import re
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
        raw = chat_completion(messages, max_tokens=600, temperature=0.1)
        current_key = None
        buffer = []

        def flush(key, buf):
            if key and buf:
                v = " ".join(buf).strip()
                if v and v.lower() not in ("unknown", "n/a", "not available", "none", "<paper title>") and len(v) > 5:
                    result[key] = v

        for line in raw.split("\n"):
            s = line.strip()
            sl = s.lower()
            if sl.startswith("title:"):
                flush(current_key, buffer); current_key = "title"; buffer = [s.split(":", 1)[1].strip()]
            elif sl.startswith("main contributions:"):
                flush(current_key, buffer); current_key = "main_contributions"; buffer = [s.split(":", 1)[1].strip()]
            elif sl.startswith("methodology:"):
                flush(current_key, buffer); current_key = "methodology"; buffer = [s.split(":", 1)[1].strip()]
            elif sl.startswith("conclusions:"):
                flush(current_key, buffer); current_key = "conclusions"; buffer = [s.split(":", 1)[1].strip()]
            elif current_key and s:
                buffer.append(s)
        flush(current_key, buffer)

        filled = sum(1 for k in ("main_contributions", "methodology", "conclusions") if result[k] != "Not available")
        if filled >= 2:
            return result
    except Exception as e:
        print(f"[Summarizer] LLM failed: {e}")

    return _text_fallback(text, result)


# ---------------------------------------------------------------------------
# Patterns shared across helpers
# ---------------------------------------------------------------------------
_SECTION_NUM = re.compile(r'^(\d+\.?\d*|[IVXivx]+\.?)\s+\S')
_INSTITUTION = re.compile(r'\b(university|institute|college|department|school|technology|sciences|coimbatore|bangalore|chennai|mumbai|delhi|hyderabad|pune)\b', re.I)
_DEGREE = re.compile(r'\b(m\.?sc|b\.?sc|ph\.?d|m\.?tech|b\.?tech|mba|bca|mca)\b', re.I)
_AUTHOR = re.compile(r'^[A-Z][a-z]+\.?\s+[A-Z][a-z]*(,\s*[A-Z][a-z]+\.?\s+[A-Z][a-z]*)*$')


def _is_heading(line: str) -> bool:
    if len(line) > 80:
        return False
    if _SECTION_NUM.match(line):
        return True
    if line.isupper() and 3 < len(line) < 60:
        return True
    return False


def _heading_has(line: str, keywords) -> bool:
    ll = line.lower()
    return any(k in ll for k in keywords)


def _section_text(lines, idx, max_chars=600) -> str:
    out, total = [], 0
    for line in lines[idx + 1:]:
        if _is_heading(line) and total > 80:
            break
        out.append(line)
        total += len(line)
        if total >= max_chars:
            break
    return re.sub(r'\s+', ' ', " ".join(out)).strip()[:max_chars]


def _text_fallback(text: str, base: dict) -> dict:
    lines = [l.strip() for l in text.split("\n") if l.strip()]
    result = dict(base)

    # ── Title ──────────────────────────────────────────────────────────────
    _SKIP = ("http", "doi", "©", "arxiv", "journal", "volume", "issue",
             "page", "submitted", "received", "abstract", "introduction",
             "references", "keywords", "index terms")

    def _is_title_candidate(line: str) -> bool:
        ll = line.lower()
        return (15 < len(line) < 200
                and not any(ll.startswith(p) for p in _SKIP)
                and not re.match(r'^\d', line)
                and not _AUTHOR.match(line)
                and not _INSTITUTION.search(line)
                and not _DEGREE.search(line)
                and (line[0].isupper() or sum(1 for c in line if c.isupper()) >= 1))

    # Try joining consecutive short lines at the top (handles split titles in two-column PDFs)
    title_candidate = None
    for i, line in enumerate(lines[:15]):
        if not _is_title_candidate(line):
            continue
        # Try extending with the next line if it's also short and title-like
        combined = line
        for j in range(i + 1, min(i + 4, len(lines))):
            next_line = lines[j]
            nl = next_line.lower()
            # Stop if next line looks like author/institution/heading
            if (_AUTHOR.match(next_line) or _INSTITUTION.search(next_line)
                    or _DEGREE.search(next_line) or _is_heading(next_line)
                    or any(nl.startswith(p) for p in _SKIP)
                    or len(next_line) > 60):
                break
            # Only join if next line is a continuation (short, no punctuation end, not author-like)
            if (len(next_line) < 40 and not combined.endswith(('.', '?', '!'))
                    and not re.match(r'^[A-Z][a-z]+\s+[A-Z]', next_line)):  # stop at "Firstname X" pattern
                combined = combined + " " + next_line
            else:
                break
        title_candidate = re.sub(r'\s+', ' ', combined).strip().rstrip(":")
        break

    if title_candidate:
        result["title"] = title_candidate

    # Fallback title from "This paper presents/proposes …"
    if result["title"] == "Unknown":
        m = re.search(r'[Tt]his paper (?:presents|proposes|introduces|describes) (?:a |an )?([^.]{10,120})', text)
        if m:
            result["title"] = m.group(1).strip().rstrip(".,").capitalize()

    # ── Find section indices ───────────────────────────────────────────────
    abstract_idx = method_idx = conclusion_idx = -1

    for i, line in enumerate(lines):
        if abstract_idx == -1 and _heading_has(line, ["abstract"]) and len(line) < 60:
            abstract_idx = i
        if method_idx == -1 and _is_heading(line) and _heading_has(
            line, ["method", "implementation", "approach", "dataset",
                   "experiment", "system design", "architecture", "survey design",
                   "proposed", "framework"]
        ):
            method_idx = i
        if _is_heading(line) and _heading_has(
            line, ["conclusion", "concluding", "summary and conclusion", "discussion and conclusion"]
        ):
            conclusion_idx = i  # keep last occurrence

    # ── Main contributions (from abstract) ────────────────────────────────
    if abstract_idx != -1:
        s = _section_text(lines, abstract_idx, 600)
        if len(s) > 50:
            result["main_contributions"] = s

    if result["main_contributions"] == "Not available":
        # Grab first paragraph longer than 150 chars
        for line in lines[:80]:
            if len(line) > 150:
                result["main_contributions"] = line[:600]
                break

    # ── Methodology ───────────────────────────────────────────────────────
    if method_idx != -1:
        s = _section_text(lines, method_idx, 600)
        if len(s) > 50:
            result["methodology"] = s

    # ── Conclusions ───────────────────────────────────────────────────────
    if conclusion_idx != -1:
        s = _section_text(lines, conclusion_idx, 600)
        if len(s) > 50:
            result["conclusions"] = s

    # Last-resort: scan tail of document for conclusion-like sentences
    if result["conclusions"] == "Not available":
        words = text.split()
        tail = " ".join(words[int(len(words) * 0.65):])
        for sent in re.split(r'(?<=[.!?])\s+', tail):
            if len(sent) > 80 and any(kw in sent.lower() for kw in
                ["conclude", "in summary", "this paper", "proposed system",
                 "demonstrates", "results show", "achieves", "future work"]):
                result["conclusions"] = sent[:500]
                break

    # Absolute last resort: last long line
    if result["conclusions"] == "Not available":
        for line in reversed(lines):
            if len(line) > 100 and not _is_heading(line):
                result["conclusions"] = line[:500]
                break

    return result
