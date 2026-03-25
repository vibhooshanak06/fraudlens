"""
Feature: fraudlens, Property 10: Summary Structural Invariant
Validates: Requirements 4.6, 8.1
"""
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from unittest.mock import patch, MagicMock
from hypothesis import given, settings
import hypothesis.strategies as st
from modules.summarizer import generate_summary


def _mock_llm_response(text: str):
    """Return a mock LLM that produces a valid structured summary."""
    mock_response = MagicMock()
    mock_response.content = (
        "Title: A Study on Research Methods\n"
        "Main Contributions: This paper contributes novel methods for analysis.\n"
        "Methodology: We used quantitative analysis and statistical modeling.\n"
        "Conclusions: The results demonstrate significant improvements.\n"
    )
    mock_llm = MagicMock()
    mock_llm.invoke.return_value = mock_response
    return mock_llm


@given(text=st.text(min_size=50))
@settings(max_examples=100)
def test_summary_structural_invariant(text):
    """Summary must always contain all four non-empty string fields."""
    with patch("modules.summarizer._get_llm", return_value=_mock_llm_response(text)):
        summary = generate_summary(text)

    required_fields = ["title", "main_contributions", "methodology", "conclusions"]
    for field in required_fields:
        assert field in summary, f"Missing field: {field}"
        assert isinstance(summary[field], str), f"Field {field} is not a string"
        assert len(summary[field]) > 0, f"Field {field} is empty"
