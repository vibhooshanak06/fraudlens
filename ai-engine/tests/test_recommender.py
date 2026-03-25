"""
Feature: fraudlens
Property 12: Recommendation Result Structure — Validates: Requirements 5.2, 5.4
Property 23: Recommendation Similarity Score Bounds — Validates: Requirements 5.1
"""
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from hypothesis import given, settings
import hypothesis.strategies as st
from modules.recommender import recommend


@given(query=st.text(min_size=3, max_size=100, alphabet=st.characters(whitelist_categories=("Lu", "Ll", "Zs", "Nd"))))
@settings(max_examples=50)
def test_recommendation_result_structure(query):
    """Each result must have required fields and count <= 10."""
    results = recommend(query.strip() or "machine learning")
    assert len(results) <= 10, f"Got {len(results)} results, expected <= 10"
    for r in results:
        assert "title" in r and isinstance(r["title"], str)
        assert "authors" in r and isinstance(r["authors"], list)
        assert "abstract_snippet" in r and isinstance(r["abstract_snippet"], str)
        assert "similarity_score" in r and isinstance(r["similarity_score"], float)


@given(query=st.text(min_size=3, max_size=100, alphabet=st.characters(whitelist_categories=("Lu", "Ll", "Zs", "Nd"))))
@settings(max_examples=50)
def test_recommendation_similarity_score_bounds(query):
    """Every similarity_score must be in [0.0, 1.0]."""
    results = recommend(query.strip() or "deep learning")
    for r in results:
        score = r["similarity_score"]
        assert 0.0 <= score <= 1.0, f"similarity_score {score} out of [0,1] for query {query!r}"
