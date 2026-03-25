"""
Feature: fraudlens, Property 7: Chunk Size Invariant
Validates: Requirements 4.1
"""
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from hypothesis import given, settings
import hypothesis.strategies as st
from modules.embedder import chunk_text

# Approximate token count: 1 token ≈ 4 chars
MAX_TOKENS = 512
OVERLAP_TOKENS = 50
CHARS_PER_TOKEN = 4


@given(text=st.text(min_size=100))
@settings(max_examples=100)
def test_chunk_size_invariant(text):
    """Every chunk must be <= 512 tokens (approx chars/4)."""
    chunks = chunk_text(text)
    if not chunks:
        return
    for i, chunk in enumerate(chunks):
        approx_tokens = len(chunk) / CHARS_PER_TOKEN
        assert approx_tokens <= MAX_TOKENS + 10, (  # +10 tolerance for splitter rounding
            f"Chunk {i} has ~{approx_tokens:.0f} tokens (>{MAX_TOKENS}): {chunk[:80]!r}"
        )


@given(text=st.text(min_size=300))
@settings(max_examples=50)
def test_consecutive_chunks_overlap(text):
    """Consecutive chunks should share content (overlap exists)."""
    chunks = chunk_text(text)
    if len(chunks) < 2:
        return
    # Check that consecutive chunks share at least some characters
    for i in range(len(chunks) - 1):
        c1, c2 = chunks[i], chunks[i + 1]
        # The end of c1 and start of c2 should share overlap
        # We verify overlap exists by checking c2 starts within c1's tail
        tail = c1[-OVERLAP_TOKENS * CHARS_PER_TOKEN:]
        head = c2[:OVERLAP_TOKENS * CHARS_PER_TOKEN:]
        # At least some characters should be shared
        shared = set(tail.split()) & set(head.split())
        # Only assert if both chunks are long enough to have meaningful overlap
        if len(c1) > 100 and len(c2) > 100:
            assert len(shared) > 0 or len(tail) == 0, (
                f"No overlap between chunk {i} and {i+1}"
            )
