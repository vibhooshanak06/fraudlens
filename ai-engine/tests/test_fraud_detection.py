"""
Property-based tests for FraudLens fraud detection modules.

Covers:
  Property 1  – Plagiarism Score Bounds          (Req 2.2)
  Property 2  – Pattern Detection Threshold      (Req 2.3)
  Property 3  – Citation Inconsistency Detection (Req 2.4)
  Property 4  – Fraud Report Structural Invariant(Req 2.5)
  Property 5  – Risk Level Threshold Assignment  (Req 2.6)
  Property 17 – Partial Result on Task Failure   (Req 7.3)
"""

import asyncio
import os
import sys
from unittest.mock import patch

import pytest
from hypothesis import given, settings
import hypothesis.strategies as st

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from modules.plagiarism import compute_plagiarism_score
from modules.pattern_detector import detect_patterns
from modules.citation_checker import check_citations
from modules.fraud_detector import analyze, _compute_risk_level


# ---------------------------------------------------------------------------
# Property 1: Plagiarism Score Bounds
# Feature: fraudlens, Property 1: Plagiarism Score Bounds
# Validates: Requirements 2.2
# ---------------------------------------------------------------------------

@given(text=st.text(min_size=1))
@settings(max_examples=100)
def test_plagiarism_score_bounds(text):
    # Feature: fraudlens, Property 1: Plagiarism Score Bounds
    score = compute_plagiarism_score(text)
    assert 0.0 <= score <= 1.0


# ---------------------------------------------------------------------------
# Property 2: Pattern Detection Threshold Invariant
# Feature: fraudlens, Property 2: Pattern Detection Threshold Invariant
# Validates: Requirements 2.3
# ---------------------------------------------------------------------------

# Strategy: a non-empty sentence that contains only printable ASCII so it
# survives the sentence-splitter unchanged.
_safe_sentence = st.text(
    alphabet=st.characters(whitelist_categories=("Lu", "Ll", "Nd"), whitelist_characters=" "),
    min_size=5,
    max_size=60,
).filter(lambda s: s.strip() and "." not in s and "!" not in s and "?" not in s)


@given(sentence=_safe_sentence)
@settings(max_examples=100)
def test_repeated_sentence_flagged(sentence):
    # Feature: fraudlens, Property 2: Pattern Detection Threshold Invariant
    # A sentence repeated >= 3 times must appear in flagged issues.
    text = (sentence + ". ") * 3
    issues = detect_patterns(text)
    repeated = [i for i in issues if i.get("type") == "repeated_sentence"]
    assert len(repeated) >= 1, (
        f"Expected repeated_sentence issue for sentence repeated 3 times, "
        f"got issues: {issues}"
    )


# Strategy: a single keyword (no spaces, no stopword) that will dominate
# word count when repeated enough times.
_safe_keyword = st.from_regex(r"[a-z]{4,10}", fullmatch=True).filter(
    lambda w: w not in {
        "the", "and", "for", "with", "that", "this", "from", "have",
        "been", "were", "they", "their", "what", "when", "will",
    }
)


@given(keyword=_safe_keyword)
@settings(max_examples=100)
def test_overused_keyword_flagged(keyword):
    # Feature: fraudlens, Property 2: Pattern Detection Threshold Invariant
    # A keyword exceeding 5% of total word count must be flagged.
    # Build a text where the keyword makes up ~50% of words (well above 5%).
    filler = "alpha beta gamma delta epsilon "
    text = (keyword + " ") * 10 + filler * 2
    issues = detect_patterns(text)
    overused = [i for i in issues if i.get("type") == "overused_keyword"]
    assert len(overused) >= 1, (
        f"Expected overused_keyword issue for keyword '{keyword}' at high frequency, "
        f"got issues: {issues}"
    )


# ---------------------------------------------------------------------------
# Property 3: Citation Inconsistency Detection
# Feature: fraudlens, Property 3: Citation Inconsistency Detection
# Validates: Requirements 2.4
# ---------------------------------------------------------------------------

# APA-style: "Smith, 2020"
_apa_citation = st.builds(
    lambda name, year: f"{name}, {year}",
    name=st.from_regex(r"[A-Z][a-z]{3,10}", fullmatch=True),
    year=st.integers(min_value=1990, max_value=2024).map(str),
)

# IEEE-style: "[1]", "[42]"
_ieee_citation = st.integers(min_value=1, max_value=99).map(lambda n: f"[{n}]")


@given(
    apa=st.lists(_apa_citation, min_size=1, max_size=3),
    ieee=st.lists(_ieee_citation, min_size=1, max_size=3),
    filler=st.text(
        alphabet=st.characters(whitelist_categories=("Ll",), whitelist_characters=" "),
        min_size=10,
        max_size=80,
    ),
)
@settings(max_examples=100)
def test_citation_inconsistency_detected(apa, ieee, filler):
    # Feature: fraudlens, Property 3: Citation Inconsistency Detection
    # A document mixing APA and IEEE citations must have at least one
    # citation_inconsistency issue flagged.
    apa_part = " ".join(apa)
    ieee_part = " ".join(ieee)
    text = f"{filler} {apa_part} {filler} {ieee_part}"
    issues = check_citations(text)
    assert len(issues) >= 1, (
        f"Expected citation_inconsistency issue for mixed APA/IEEE text, "
        f"got no issues. Text: {text!r}"
    )


# ---------------------------------------------------------------------------
# Property 4: Fraud Report Structural Invariant
# Feature: fraudlens, Property 4: Fraud Report Structural Invariant
# Validates: Requirements 2.5
# ---------------------------------------------------------------------------

@given(text=st.text(min_size=1))
@settings(max_examples=100)
def test_fraud_report_structural_invariant(text):
    # Feature: fraudlens, Property 4: Fraud Report Structural Invariant
    report = asyncio.run(analyze(text))
    assert "plagiarism_score" in report
    assert "risk_level" in report
    assert "issues" in report
    assert isinstance(report["issues"], list)


# ---------------------------------------------------------------------------
# Property 5: Risk Level Threshold Assignment
# Feature: fraudlens, Property 5: Risk Level Threshold Assignment
# Validates: Requirements 2.6
# ---------------------------------------------------------------------------

@given(score=st.floats(min_value=0.0, max_value=1.0, allow_nan=False))
@settings(max_examples=100)
def test_risk_level_threshold(score):
    # Feature: fraudlens, Property 5: Risk Level Threshold Assignment
    # Test _compute_risk_level directly with no issues (no overriding factors).
    level = _compute_risk_level(score, [])
    if score < 0.3:
        assert level == "low", f"score={score} expected 'low', got '{level}'"
    elif score <= 0.6:
        assert level == "medium", f"score={score} expected 'medium', got '{level}'"
    else:
        assert level == "high", f"score={score} expected 'high', got '{level}'"


# ---------------------------------------------------------------------------
# Property 17: Partial Result on Task Failure
# Feature: fraudlens, Property 17: Partial Result on Task Failure
# Validates: Requirements 7.3
# ---------------------------------------------------------------------------

_MODULE_NAMES = ["plagiarism", "pattern", "citation"]

_PATCH_TARGETS = {
    "plagiarism": "modules.fraud_detector._run_plagiarism",
    "pattern":    "modules.fraud_detector._run_patterns",
    "citation":   "modules.fraud_detector._run_citations",
}


async def _raise(_text):
    raise RuntimeError("simulated module failure")


@given(failing_module=st.sampled_from(_MODULE_NAMES))
@settings(max_examples=100)
def test_partial_result_on_task_failure(failing_module):
    # Feature: fraudlens, Property 17: Partial Result on Task Failure
    # When exactly one module raises an exception the report must still
    # contain the other two modules' results and an 'errors' field.
    target = _PATCH_TARGETS[failing_module]

    with patch(target, side_effect=_raise):
        report = asyncio.run(analyze("Some research paper text for analysis."))

    # errors field must exist and describe the failed module
    assert "errors" in report, "Expected 'errors' field when a module fails"
    assert isinstance(report["errors"], list)
    assert len(report["errors"]) >= 1

    failed_module_names = {e["module"] for e in report["errors"]}

    if failing_module == "plagiarism":
        # pattern and citation results should be present
        assert "issues" in report, "Expected 'issues' from pattern/citation modules"
        assert "plagiarism" in failed_module_names
    elif failing_module == "pattern":
        # plagiarism result should be present
        assert "plagiarism_score" in report
        assert "pattern_detector" in failed_module_names
    else:  # citation
        # plagiarism result should be present
        assert "plagiarism_score" in report
        assert "citation_checker" in failed_module_names
