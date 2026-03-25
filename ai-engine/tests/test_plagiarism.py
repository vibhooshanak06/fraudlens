"""
Feature: fraudlens, Property 1: Plagiarism Score Bounds
Validates: Requirements 2.2
"""
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from hypothesis import given, settings
import hypothesis.strategies as st
from modules.plagiarism import compute_plagiarism_score


@given(text=st.text(min_size=1))
@settings(max_examples=100)
def test_plagiarism_score_bounds(text):
    score = compute_plagiarism_score(text)
    assert 0.0 <= score <= 1.0, f"Score {score} out of bounds for text: {text[:50]!r}"
