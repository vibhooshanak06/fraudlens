"""
Fraud_Detector for FraudLens AI Engine.

Orchestrates all three detection modules concurrently and produces a Fraud_Report.
"""

import asyncio
from modules.plagiarism import compute_plagiarism_score
from modules.pattern_detector import detect_patterns
from modules.citation_checker import check_citations


def _compute_risk_level(plagiarism_score: float, issues: list) -> str:
    """Assign risk level based on plagiarism score and issue severity."""
    critical_types = {"repeated_sentence", "citation_inconsistency"}
    has_critical = any(i.get("type") in critical_types for i in issues)

    if plagiarism_score > 0.6 or (plagiarism_score > 0.3 and has_critical):
        return "high"
    elif plagiarism_score >= 0.3 or has_critical:
        return "medium"
    return "low"


async def _run_plagiarism(text: str) -> dict:
    loop = asyncio.get_event_loop()
    score = await loop.run_in_executor(None, compute_plagiarism_score, text)
    return {"plagiarism_score": score}


async def _run_patterns(text: str) -> dict:
    loop = asyncio.get_event_loop()
    issues = await loop.run_in_executor(None, detect_patterns, text)
    return {"issues": issues}


async def _run_citations(text: str) -> dict:
    loop = asyncio.get_event_loop()
    issues = await loop.run_in_executor(None, check_citations, text)
    return {"issues": issues}


async def analyze(text: str) -> dict:
    """
    Run all fraud detection modules concurrently and produce a Fraud_Report.

    Args:
        text: Extracted text from the research paper.

    Returns:
        A dict with: plagiarism_score (float), risk_level (str),
        issues (list), and optionally errors (list) on partial failure.
    """
    tasks = [
        _run_plagiarism(text),
        _run_patterns(text),
        _run_citations(text),
    ]

    results = await asyncio.gather(*tasks, return_exceptions=True)

    plagiarism_score = 0.0
    all_issues = []
    errors = []

    # Result 0: plagiarism
    if isinstance(results[0], Exception):
        errors.append({"module": "plagiarism", "error": str(results[0])})
    else:
        plagiarism_score = results[0].get("plagiarism_score", 0.0)

    # Result 1: patterns
    if isinstance(results[1], Exception):
        errors.append({"module": "pattern_detector", "error": str(results[1])})
    else:
        all_issues.extend(results[1].get("issues", []))

    # Result 2: citations
    if isinstance(results[2], Exception):
        errors.append({"module": "citation_checker", "error": str(results[2])})
    else:
        all_issues.extend(results[2].get("issues", []))

    risk_level = _compute_risk_level(plagiarism_score, all_issues)

    report = {
        "plagiarism_score": plagiarism_score,
        "risk_level": risk_level,
        "issues": all_issues,
    }
    if errors:
        report["errors"] = errors

    return report
