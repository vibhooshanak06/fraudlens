"""
PDF_Processor module for FraudLens AI Engine.

Extracts full text content from PDF files using pdfplumber.
"""

import pdfplumber


class UnreadablePDFError(Exception):
    """Raised when a PDF contains no extractable text (e.g., image-only/scanned PDF)."""
    pass


def extract_text(pdf_path: str) -> str:
    """
    Extract full text from a PDF file.

    Opens the PDF at the given path using pdfplumber, extracts text from all
    pages, joins them with newlines, and strips surrounding whitespace.

    Args:
        pdf_path: Absolute or relative path to the PDF file.

    Returns:
        The extracted text as a single string.

    Raises:
        ValueError: If the file does not exist at the given path.
        UnreadablePDFError: If the PDF contains no extractable text
            (e.g., scanned image-only PDF).
    """
    try:
        with pdfplumber.open(pdf_path) as pdf:
            pages_text = [page.extract_text() or "" for page in pdf.pages]
            text = "\n".join(pages_text).strip()
    except FileNotFoundError:
        raise ValueError(f"PDF file not found at path: {pdf_path}")

    if not text:
        raise UnreadablePDFError("PDF contains no extractable text")

    return text
