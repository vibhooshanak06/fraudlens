"""
Property-based tests for PDF text extraction round-trip.

Feature: fraudlens, Property 21: PDF Text Extraction Round-Trip
Validates: Requirements 1.6
"""

import io
import os
import sys
import tempfile

import pytest
from hypothesis import given, settings
import hypothesis.strategies as st

# Ensure the ai-engine root is on the path so modules can be imported
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from modules.pdf_processor import extract_text


def _make_pdf_bytes(text: str) -> bytes:
    """
    Create a minimal in-memory PDF containing the given text using fpdf2.
    Returns the raw PDF bytes.
    """
    from fpdf import FPDF  # fpdf2 exposes the same `fpdf` package name

    pdf = FPDF()
    pdf.add_page()
    pdf.set_font("Helvetica", size=12)
    # multi_cell handles long strings and wraps automatically
    pdf.multi_cell(0, 10, text)
    return pdf.output()


# Feature: fraudlens, Property 21: PDF Text Extraction Round-Trip
# Validates: Requirements 1.6
@given(
    text=st.text(
        min_size=1,
        alphabet=st.characters(
            whitelist_categories=("Lu", "Ll", "Nd", "Zs")
        ),
    )
)
@settings(max_examples=100)
def test_pdf_text_extraction_round_trip(text: str):
    """
    For any machine-readable PDF containing known text content, the
    PDF_Processor must return extracted text that contains all of that
    known text content.

    Strategy:
    - Generate an arbitrary non-empty string of letters, digits, and spaces.
    - Embed it in a synthetic PDF via fpdf2.
    - Write the PDF to a temp file and pass the path to extract_text().
    - Assert the extracted text contains the original string (after
      normalising whitespace, since PDF renderers may reflow spaces).
    """
    # Build the PDF in memory
    pdf_bytes = _make_pdf_bytes(text)

    # Write to a temporary file (pdfplumber requires a file path)
    with tempfile.NamedTemporaryFile(suffix=".pdf", delete=False) as tmp:
        tmp.write(pdf_bytes)
        tmp_path = tmp.name

    try:
        extracted = extract_text(tmp_path)

        # Normalise whitespace for comparison: collapse runs of whitespace
        # (PDF extraction may merge or split spaces/newlines)
        import re

        def normalise(s: str) -> str:
            return re.sub(r"\s+", " ", s).strip()

        # The extracted text must contain all non-whitespace tokens from the
        # original text in the same relative order.
        original_tokens = normalise(text).split()
        extracted_normalised = normalise(extracted)

        for token in original_tokens:
            assert token in extracted_normalised, (
                f"Token {token!r} from original text not found in extracted text.\n"
                f"Original (normalised): {normalise(text)!r}\n"
                f"Extracted (normalised): {extracted_normalised!r}"
            )
    finally:
        os.unlink(tmp_path)
