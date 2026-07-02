import os
import tempfile
import requests


def download_pdf(pdf_url: str) -> str:
    """Download a PDF from a public URL to a temporary file.

    Returns the path to the temporary file. The caller is responsible
    for deleting the file after use.

    Raises:
        ValueError: If the URL is empty or the response is not a PDF.
        requests.HTTPError: If the server returns a non-2xx status code.
        requests.Timeout: If the download exceeds the timeout.
        OSError: If the temporary file cannot be written.
    """
    if not pdf_url:
        raise ValueError("pdf_url must not be empty")

    try:
        response = requests.get(pdf_url, timeout=60, stream=True)
        response.raise_for_status()
    except requests.HTTPError as e:
        raise requests.HTTPError(
            f"Failed to download PDF (HTTP {response.status_code}): {pdf_url}"
        ) from e
    except requests.Timeout:
        raise requests.Timeout(f"Download timed out after 60 s: {pdf_url}")
    except requests.RequestException as e:
        raise requests.RequestException(f"Network error downloading PDF: {e}") from e

    content_type = response.headers.get("Content-Type", "")
    if "pdf" not in content_type and not pdf_url.lower().endswith(".pdf"):
        raise ValueError(
            f"URL does not point to a PDF (Content-Type: {content_type}): {pdf_url}"
        )

    fd, temp_path = tempfile.mkstemp(suffix=".pdf")
    try:
        with os.fdopen(fd, "wb") as f:
            for chunk in response.iter_content(chunk_size=8192):
                if chunk:
                    f.write(chunk)
    except OSError:
        # Clean up the temp file if writing fails
        if os.path.exists(temp_path):
            os.remove(temp_path)
        raise

    return temp_path
