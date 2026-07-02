import os
import tempfile
import requests

def download_pdf(pdf_url: str) -> str:
    response = requests.get(pdf_url, timeout=60)
    response.raise_for_status()

    fd, temp_path = tempfile.mkstemp(suffix=".pdf")

    with os.fdopen(fd, "wb") as f:
        f.write(response.content)

    return temp_path