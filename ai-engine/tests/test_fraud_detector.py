"""
Feature: fraudlens
Property 4: Fraud Report Structural Invariant — Validates: Requirements 2.5
Property 5: Risk Level Threshold Assignment — Validates: Requirements 2.6
Property 17: Partial Result on Task Failure — Validates: Requirements 7.3
"""
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

import asyncio
import pytest
from unittest.mock import patch
from hypothesis import given, settings
import hypothesis.strategies as st
from modules.fraud_detector import analyze


def run(coro):
    return asyncio.get_event_loop().run_until_complete(coro)


# Property 4: Fraud Report Structural Invariant
@given(text=st.text(min_size=1))
@settings(max_examples=100)
def test_fraud_report_structural_invariant(text):
    report = run(analyze(text))
    assert "plagiarism_score" in report, "Missing plagiarism_score"
    assert "risk_level" in report, "Missing risk_level"
    assert "issues" in report, "Missing issues"
    assert isinstance(report["plagiarism_score"], float)
    assert report["risk_level"] in ("low", "medium", "high")
    assert isinstance(report["issues"], list)


# Property 5: Risk Level Threshold Assignment
@given(score=st.floats(min_value=0.0, max_value=1.0, allow_nan=False))
@settings(max_examples=100)
def test_risk_level_threshold_assignment(score):
    from modules.fraud_detector import _compute_risk_level
    level = _compute_risk_level(score, [])
    if score < 0.3:
        assert level == "low", f"score={score} should be low, got {level}"
    elif score <= 0.6:
        assert level == "medium", f"score={score} should be medium, got {level}"
    else:
        assert level == "high", f"score={score} should be high, got {level}"


# Property 17: Partial Result on Task Failure
@pytest.mark.asyncio
async def test_partial_result_on_plagiarism_failure():
    """When plagiarism module fails, other results + errors field must be present."""
    with patch("modules.fraud_detector._run_plagiarism", side_effect=RuntimeError("plagiarism failed")):
        report = await analyze("Some paper text about research methodology.")
    assert "errors" in report
    assert any(e["module"] == "plagiarism" for e in report["errors"])
    assert "issues" in report
    assert "risk_level" in report


@pytest.mark.asyncio
async def test_partial_result_on_pattern_failure():
    """When pattern module fails, other results + errors field must be present."""
    with patch("modules.fraud_detector._run_patterns", side_effect=RuntimeError("pattern failed")):
        report = await analyze("Some paper text about research methodology.")
    assert "errors" in report
    assert any(e["module"] == "pattern_detector" for e in report["errors"])
    assert "plagiarism_score" in report
    assert "risk_level" in report


@pytest.mark.asyncio
async def test_partial_result_on_citation_failure():
    """When citation module fails, other results + errors field must be present."""
    with patch("modules.fraud_detector._run_citations", side_effect=RuntimeError("citation failed")):
        report = await analyze("Some paper text about research methodology.")
    assert "errors" in report
    assert any(e["module"] == "citation_checker" for e in report["errors"])
    assert "plagiarism_score" in report
    assert "risk_level" in report
