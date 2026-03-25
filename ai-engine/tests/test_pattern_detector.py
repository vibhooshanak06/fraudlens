"""
Feature: fraudlens, Property 2: Pattern Detection Threshold Invariant
Validates: Requirements 2.3
"""
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from hypothesis import given, settings, assume
import hypothesis.strategies as st
from modules.pattern_detector import detect_patterns


@given(
    sentence=st.text(min_size=10, max_size=80, alphabet=st.characters(whitelist_categories=("Lu", "Ll", "Zs"))),
    repeat=st.integers(min_value=3, max_value=6),
)
@settings(max_examples=100)
def test_repeated_sentence_flagged(sentence, repeat):
    """Any sentence appearing >= 3 times must be flagged."""
    assume(sentence.strip())
    text = (sentence.strip() + ". ") * repeat
    issues = detect_patterns(text)
    types = [i["type"] for i in issues]
    assert "repeated_sentence" in types, (
        f"Expected repeated_sentence in issues for sentence repeated {repeat}x.\n"
        f"Issues: {issues}"
    )


@given(
    keyword=st.text(min_size=4, max_size=10, alphabet=st.characters(whitelist_categories=("Ll",))),
    filler=st.integers(min_value=5, max_value=15),
)
@settings(max_examples=100)
def test_overused_keyword_flagged(keyword, filler):
    """A keyword exceeding 5% of total word count must be flagged."""
    assume(keyword.strip() and keyword not in {
        "the", "and", "for", "with", "that", "this", "are", "was", "were"
    })
    # Build text: keyword appears filler+1 times, total words = filler*2
    # keyword frequency = (filler+1) / (filler*2 + filler+1) — ensure > 5%
    # Simple approach: 10 keywords + 10 other words → 50% frequency
    other_words = " ".join(["word"] * filler)
    text = " ".join([keyword] * (filler + 1)) + " " + other_words
    issues = detect_patterns(text)
    types = [i["type"] for i in issues]
    assert "overused_keyword" in types, (
        f"Expected overused_keyword for '{keyword}' in issues.\nIssues: {issues}"
    )
