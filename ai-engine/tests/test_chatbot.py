"""
Feature: fraudlens
Property 8: Retrieval Count Invariant — Validates: Requirements 4.2
Property 9: Chatbot Response Structure — Validates: Requirements 4.3, 4.4
"""
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

import pickle
import tempfile
import numpy as np
import faiss
from unittest.mock import patch, MagicMock
from hypothesis import given, settings, assume
import hypothesis.strategies as st
from modules.embedder import _get_model, FAISS_STORE_PATH


def _build_test_index(uuid: str, n: int, tmpdir: str):
    """Build a FAISS index with n entries in tmpdir."""
    model = _get_model()
    chunks = [f"This is test chunk number {i} about research methodology." for i in range(n)]
    if n == 0:
        # Empty index
        dim = 384  # all-MiniLM-L6-v2 dimension
        index = faiss.IndexFlatL2(dim)
        chunks = []
    else:
        embeddings = model.encode(chunks, convert_to_numpy=True).astype("float32")
        dim = embeddings.shape[1]
        index = faiss.IndexFlatL2(dim)
        index.add(embeddings)

    faiss.write_index(index, os.path.join(tmpdir, f"{uuid}.index"))
    with open(os.path.join(tmpdir, f"{uuid}.chunks"), "wb") as f:
        pickle.dump(chunks, f)


# Property 8: Retrieval Count Invariant
@given(n=st.integers(min_value=0, max_value=20))
@settings(max_examples=50)
def test_retrieval_count_invariant(n):
    """Retrieved chunk count must equal min(5, N)."""
    import modules.embedder as emb_mod
    uuid = f"test-retrieval-{n}"

    with tempfile.TemporaryDirectory() as tmpdir:
        original_path = emb_mod.FAISS_STORE_PATH
        emb_mod.FAISS_STORE_PATH = tmpdir
        try:
            _build_test_index(uuid, n, tmpdir)
            results = emb_mod.search(uuid, "research methodology", top_k=5)
            expected = min(5, n)
            assert len(results) == expected, (
                f"n={n}: expected {expected} results, got {len(results)}"
            )
        finally:
            emb_mod.FAISS_STORE_PATH = original_path


# Property 9: Chatbot Response Structure
@given(question=st.text(min_size=1, max_size=100, alphabet=st.characters(whitelist_categories=("Lu", "Ll", "Zs"))))
@settings(max_examples=30)
def test_chatbot_response_structure(question):
    """Response must have non-empty answer and sources array with chunk_id + excerpt."""
    assume(question.strip())
    import modules.embedder as emb_mod
    uuid = "test-chatbot-structure"

    with tempfile.TemporaryDirectory() as tmpdir:
        original_path = emb_mod.FAISS_STORE_PATH
        emb_mod.FAISS_STORE_PATH = tmpdir
        try:
            _build_test_index(uuid, 5, tmpdir)

            mock_response = MagicMock()
            mock_response.content = "This paper discusses machine learning methods for fraud detection."

            mock_llm = MagicMock()
            mock_llm.invoke.return_value = mock_response

            with patch("modules.chatbot._get_llm", return_value=mock_llm):
                from modules.chatbot import answer
                result = answer(uuid, question.strip() or "What is this paper about?")

            assert "answer" in result, "Missing 'answer' field"
            assert "sources" in result, "Missing 'sources' field"
            assert isinstance(result["answer"], str) and len(result["answer"]) > 0
            assert isinstance(result["sources"], list)
            for src in result["sources"]:
                assert "chunk_id" in src
                assert "excerpt" in src
        finally:
            emb_mod.FAISS_STORE_PATH = original_path
