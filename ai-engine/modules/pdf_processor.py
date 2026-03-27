"""
PDF_Processor — extracts clean, reading-order text from PDFs.
Uses word-level bounding boxes to correctly handle two-column academic layouts.
"""
import pdfplumber


class UnreadablePDFError(Exception):
    pass


def _extract_page_text(page) -> str:
    """
    Extract text in correct reading order using word bounding boxes.
    Detects single vs two-column layout per page and sorts accordingly.
    """
    words = page.extract_words(keep_blank_chars=False, use_text_flow=False)
    if not words:
        return page.extract_text() or ""

    page_width = page.width

    # Detect if page has two columns by checking word x-position distribution
    mid = page_width / 2
    left_words = [w for w in words if w["x1"] <= mid + 20]
    right_words = [w for w in words if w["x0"] >= mid - 20]

    # If both columns have substantial content, treat as two-column
    is_two_col = len(left_words) > 10 and len(right_words) > 10

    if is_two_col:
        # Sort left column top-to-bottom, then right column top-to-bottom
        left_col = sorted([w for w in words if w["x0"] < mid], key=lambda w: (round(w["top"] / 5), w["x0"]))
        right_col = sorted([w for w in words if w["x0"] >= mid], key=lambda w: (round(w["top"] / 5), w["x0"]))
        ordered_words = left_col + right_col
    else:
        # Single column: sort top-to-bottom, left-to-right
        ordered_words = sorted(words, key=lambda w: (round(w["top"] / 5), w["x0"]))

    # Reconstruct text with line breaks
    lines = []
    current_line = []
    prev_top = None

    for w in ordered_words:
        top = round(w["top"] / 5) * 5  # snap to 5pt grid
        if prev_top is not None and abs(top - prev_top) > 3:
            if current_line:
                lines.append(" ".join(current_line))
            current_line = [w["text"]]
        else:
            current_line.append(w["text"])
        prev_top = top

    if current_line:
        lines.append(" ".join(current_line))

    return "\n".join(lines)


def extract_text(pdf_path: str) -> str:
    try:
        with pdfplumber.open(pdf_path) as pdf:
            pages_text = [_extract_page_text(page) for page in pdf.pages]
            text = "\n".join(pages_text).strip()
    except FileNotFoundError:
        raise ValueError(f"PDF file not found: {pdf_path}")

    if not text:
        raise UnreadablePDFError("PDF contains no extractable text")

    return text
