"""
Citation_Module for FraudLens AI Engine.

Detects inconsistent citation styles within a research paper.
"""

import re


# Regex patterns for common citation styles
_PATTERNS = {
    "APA": re.compile(r'\b[A-Z][a-z]+(?:\s+(?:et al\.?|&\s+[A-Z][a-z]+))?,\s+\d{4}\b'),
    "IEEE": re.compile(r'\[\d+\]'),
    "MLA": re.compile(r'\([A-Z][a-z]+(?:\s+\d+)?\)'),
}


def check_citations(text: str) -> list:
    """
    Check for inconsistent citation styles in the given text.

    Detects APA, IEEE, and MLA citation patterns. If two or more distinct
    styles are found in the same document, flags it as inconsistent.

    Args:
        text: The full text of the research paper.

    Returns:
        A list of issue dicts with keys: type, description, excerpt.
        Empty list if citations are consistent or absent.
    """
    if not text or not text.strip():
        return []

    detected = {}
    for style, pattern in _PATTERNS.items():
        matches = pattern.findall(text)
        if matches:
            detected[style] = matches

    if len(detected) < 2:
        return []

    styles_found = list(detected.keys())
    examples = {style: detected[style][0] for style in styles_found}
    excerpt = " | ".join(f"{s}: {examples[s]}" for s in styles_found)

    return [{
        "type": "citation_inconsistency",
        "description": (
            f"Mixed citation styles detected: {', '.join(styles_found)}. "
            "A single document should use one consistent citation format."
        ),
        "excerpt": excerpt[:200],
    }]
