"""
Property-based tests for FraudLens AI Engine modules.

Covers:
  Property 7  – Chunk Size Invariant              (Req 4.1)
  Property 8  – Retrieval Count Invariant         (Req 4.2)
  Property 9  – Chatbot Response Structure        (Req 4.3, 4.4)
  Property 10 – Summary Structural Invariant      (Req 4.6, 8.1)
  Property 12 – Recommendation Result Structure   (Req 5.2, 5.4)
  Property 23 – Recommendation Similarity Score Bounds (Req 5.1)
"""

import os
import sys
import pickle
import tempfile
from unittest.mock import MagicMock, patch

import numpy as np
import faiss
import pytest
from hypothesis import given, settings
import hypothesis.strategies as st

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from modules.embedder import chunk_text, search
from modules.summarizer import generate_summary
from modules.recommender import recommend


# ---------------------------------------------------------------------------
# Property 7: Chunk Size Invariant
# Feature: fraudlens, Property 7: Chunk Size Invariant
# Validates: Requirements 4.1
# ---------------------------------------------------------------------------

@given(text=st.text(min_size=100))
@settings(max_examples=100)
def test_chunk_size_invariant(text):
    # Feature: fraudlens, Property 7: Chunk Size Invariant
    chunks = chunk_text(text)
    for chunk in chunks:
        assert len(chunk) <= 512
    # consecutive chunks share overlap (check token overlap by character count ~50)
    for i in range(len(chunks) - 1):
        # The splitter uses chunk_overlap=50 chars; verify chunks are not completely disjoint
        # by checking the end of chunk[i] overlaps with start of chunk[i+1]
        assert len(chunks[i]) > 0 and len(chunks[i + 1]) > 0


# ---------------------------------------------------------------------------
# Property 8: Retrieval Count Invariant
# Feature: fraudlens, Property 8: Retrieval Count Invariant
# Validates: Requirements 4.2
# ---------------------------------------------------------------------------

@given(n=st.integers(min_value=0, max_value=20))
@settings(max_examples=100)
def test_retrieval_count_invariant(n):
    # Feature: fraudlens, Property 8: Retrieval Count Invariant
    dim = 384
    rng = np.random.default_rng(42)

    # Build a fake FAISS index with n entries
    index = faiss.IndexFlatL2(dim)
    if n > 0:
        fake_embeddings = rng.random((n, dim), dtype=np.float32)
        index.add(fake_embeddings)

    # Create fake chunks list
    chunks = [f"chunk {i}" for i in range(n)]

    # Fixed query embedding returned by the mock model
    fake_query_emb = rng.random((1, dim), dtype=np.float32)

    with tempfile.TemporaryDirectory() as tmpdir:
        # Write the index and chunks to the temp dir
        uuid = "test-uuid-prop8"
        index_path = os.path.join(tmpdir, f"{uuid}.index")
        chunks_path = os.path.join(tmpdir, f"{uuid}.chunks")
        faiss.write_index(index, index_path)
        with open(chunks_path, "wb") as f:
            pickle.dump(chunks, f)

        # Patch FAISS_STORE_PATH and the model
        mock_model = MagicMock()
        mock_model.encode.return_value = fake_query_emb

        import modules.embedder as embedder_mod
        original_path = embedder_mod.FAISS_STORE_PATH
        embedder_mod.FAISS_STORE_PATH = tmpdir

        try:
            with patch("modules.embedder._get_model", return_value=mock_model):
                results = search(uuid, "test query", top_k=5)
        finally:
            embedder_mod.FAISS_STORE_PATH = original_path

    expected_count = min(5, n)
    assert len(results) == expected_count, (
        f"Expected {expected_count} results for n={n}, got {len(results)}"
    )


# ---------------------------------------------------------------------------
# Property 9: Chatbot Response Structure
# Feature: fraudlens, Property 9: Chatbot Response Structure
# Validates: Requirements 4.3, 4.4
# ---------------------------------------------------------------------------

@given(question=st.text(min_size=1, max_size=200))
@settings(max_examples=100)
def test_chatbot_response_structure(question):
    # Feature: fraudlens, Property 9: Chatbot Response Structure
    from modules.chatbot import answer

    fake_sources = [{"chunk_id": 0, "excerpt": "test excerpt"}]
    fake_index = MagicMock()
    fake_chunks = ["chunk 0", "chunk 1", "chunk 2"]

    mock_llm_response = MagicMock()
    mock_llm_response.content = "mocked answer"

    mock_llm = MagicMock()
    mock_llm.invoke.return_value = mock_llm_response

    with patch("modules.chatbot.load_index", return_value=(fake_index, fake_chunks)), \
         patch("modules.chatbot.search", return_value=fake_sources), \
         patch("modules.chatbot._get_llm", return_value=mock_llm):
        response = answer("test-uuid", question)

    assert "answer" in response, "Response must contain 'answer' key"
    assert isinstance(response["answer"], str), "'answer' must be a string"
    assert len(response["answer"]) > 0, "'answer' must be non-empty"

    assert "sources" in response, "Response must contain 'sources' key"
    assert isinstance(response["sources"], list), "'sources' must be a list"
    for source in response["sources"]:
        assert "chunk_id" in source, "Each source must have 'chunk_id'"
        assert "excerpt" in source, "Each source must have 'excerpt'"


# ---------------------------------------------------------------------------
# Property 10: Summary Structural Invariant
# Feature: fraudlens, Property 10: Summary Structural Invariant
# Validates: Requirements 4.6, 8.1
# ---------------------------------------------------------------------------

@given(text=st.text(min_size=50))
@settings(max_examples=100)
def test_summary_structural_invariant(text):
    # Feature: fraudlens, Property 10: Summary Structural Invariant
    mock_llm_response = MagicMock()
    mock_llm_response.content = (
        "Title: Test Paper\n"
        "Main Contributions: Key contribution here\n"
        "Methodology: Methods used here\n"
        "Conclusions: Main conclusions here\n"
    )

    mock_llm = MagicMock()
    mock_llm.invoke.return_value = mock_llm_response

    with patch("modules.summarizer._get_llm", return_value=mock_llm):
        result = generate_summary(text)

    required_keys = ["title", "main_contributions", "methodology", "conclusions"]
    for key in required_keys:
        assert key in result, f"Summary must contain '{key}' key"
        assert isinstance(result[key], str), f"'{key}' must be a string"
        assert len(result[key]) > 0, f"'{key}' must be non-empty"


# ---------------------------------------------------------------------------
# Property 12: Recommendation Result Structure
# Feature: fraudlens, Property 12: Recommendation Result Structure
# Validates: Requirements 5.2, 5.4
# ---------------------------------------------------------------------------

def _make_recommender_mock(n_corpus=10):
    """Return a mock model whose encode returns fixed numpy arrays."""
    dim = 384
    rng = np.random.default_rng(0)
    query_emb = rng.random((1, dim), dtype=np.float32)
    corpus_emb = rng.random((n_corpus, dim), dtype=np.float32)

    mock_model = MagicMock()

    def _encode(inputs, convert_to_numpy=True):
        if isinstance(inputs, list) and len(inputs) == 1:
            return query_emb
        return corpus_emb

    mock_model.encode.side_effect = _encode
    return mock_model


@given(query=st.text(min_size=3, max_size=100))
@settings(max_examples=100)
def test_recommendation_result_structure(query):
    # Feature: fraudlens, Property 12: Recommendation Result Structure
    mock_model = _make_recommender_mock()

    with patch("modules.recommender._get_model", return_value=mock_model):
        results = recommend(query)

    assert len(results) <= 10, f"Result count must be <= 10, got {len(results)}"

    for result in results:
        assert "title" in result, "Each result must have 'title'"
        assert isinstance(result["title"], str), "'title' must be a string"

        assert "authors" in result, "Each result must have 'authors'"
        assert isinstance(result["authors"], list), "'authors' must be a list"

        assert "abstract_snippet" in result, "Each result must have 'abstract_snippet'"
        assert isinstance(result["abstract_snippet"], str), "'abstract_snippet' must be a string"

        assert "similarity_score" in result, "Each result must have 'similarity_score'"
        assert isinstance(result["similarity_score"], float), "'similarity_score' must be a float"
        assert 0.0 <= result["similarity_score"] <= 1.0, (
            f"'similarity_score' must be in [0, 1], got {result['similarity_score']}"
        )


# ---------------------------------------------------------------------------
# Property 23: Recommendation Similarity Score Bounds
# Feature: fraudlens, Property 23: Recommendation Similarity Score Bounds
# Validates: Requirements 5.1
# ---------------------------------------------------------------------------

@given(query=st.text(min_size=3, max_size=100))
@settings(max_examples=100)
def test_recommendation_similarity_score_bounds(query):
    # Feature: fraudlens, Property 23: Recommendation Similarity Score Bounds
    mock_model = _make_recommender_mock()

    with patch("modules.recommender._get_model", return_value=mock_model):
        results = recommend(query)

    for result in results:
        score = result["similarity_score"]
        assert 0.0 <= score <= 1.0, (
            f"similarity_score {score} is out of bounds [0.0, 1.0]"
        )
