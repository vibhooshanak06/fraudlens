"""
Pattern_Module for FraudLens AI Engine.

Detects suspicious patterns in text: repeated sentences, overused keywords,
and unusual document structure.
"""

import re
import string
from collections import Counter

# Common stopwords to exclude from keyword frequency analysis
_STOPWORDS = {
    "the", "a", "an", "is", "are", "was", "were",
    "in", "on", "at", "to", "of", "and", "or", "but",
    "for", "with", "by",
}


def _split_sentences(text: str) -> list:
    """Split text into sentences using period and newline delimiters."""
    # Split on period followed by whitespace/newline, or on newlines
    raw = re.split(r'(?<=[.!?])\s+|\n+', text)
    sentences = [s.strip() for s in raw if s.strip()]
    return sentences


def _tokenize_words(text: str) -> list:
    """Lowercase and strip punctuation, return list of word tokens."""
    text_lower = text.lower()
    # Remove punctuation
    translator = str.maketrans("", "", string.punctuation)
    cleaned = text_lower.translate(translator)
    words = [w for w in cleaned.split() if w]
    return words


def _count_headings(text: str) -> int:
    """
    Count lines that look like headings: start with a capital letter,
    are short (<= 60 chars), and are not empty.
    """
    lines = text.split("\n")
    heading_count = 0
    for line in lines:
        stripped = line.strip()
        if stripped and stripped[0].isupper() and len(stripped) <= 60:
            heading_count += 1
    return heading_count


def detect_patterns(text: str) -> list:
    """
    Detect suspicious patterns in the given text.

    Checks for:
    - Repeated sentences (appearing >= 3 times)
    - Overused keywords (frequency > 5% of total word count, excluding stopwords)
    - Unusual structure (fewer than 3 distinct heading-like lines)

    Args:
        text: The input text to analyze.

    Returns:
        A list of issue dicts, each with keys:
            "type" (str), "description" (str), "excerpt" (str)
    """
    issues = []

    if not text or not text.strip():
        return issues

    # --- Repeated sentences ---
    sentences = _split_sentences(text)
    sentence_counts = Counter(sentences)
    for sentence, count in sentence_counts.items():
        if count >= 3:
            issues.append({
                "type": "repeated_sentence",
                "description": f'Sentence repeated {count} times: "{sentence[:80]}..."' if len(sentence) > 80 else f'Sentence repeated {count} times: "{sentence}"',
                "excerpt": sentence[:200],
            })

    # --- Overused keywords ---
    words = _tokenize_words(text)
    total_words = len(words)
    if total_words > 0:
        content_words = [w for w in words if w not in _STOPWORDS]
        word_counts = Counter(content_words)
        for word, count in word_counts.items():
            frequency = count / total_words
            if frequency > 0.05:
                issues.append({
                    "type": "overused_keyword",
                    "description": f'Keyword "{word}" appears {count} times ({frequency:.1%} of total word count)',
                    "excerpt": word,
                })

    # --- Unusual structure ---
    heading_count = _count_headings(text)
    if heading_count < 3:
        issues.append({
            "type": "unusual_structure",
            "description": f"Document has fewer than 3 distinct sections (found {heading_count} potential heading(s)). This may indicate an unusual or incomplete structure.",
            "excerpt": text[:100].strip(),
        })

    return issues
