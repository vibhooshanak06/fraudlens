"""Backfill summaries by re-extracting full text from PDF files."""
from dotenv import load_dotenv
load_dotenv()

from modules.summarizer import generate_summary
from modules.pdf_processor import extract_text
from pymongo import MongoClient

FILE_PATHS = {
    "bc14a128-14dd-418e-a819-2aea7f81e691": r"C:\Users\vibho\OneDrive\Desktop\fraudlens\backend\uploads\1774539034676-paper-1.pdf",
    "82e2089d-7e0f-4813-8e81-3b27c44e31c9": r"C:\Users\vibho\OneDrive\Desktop\fraudlens\backend\uploads\1774539312149-paper-1.pdf",
    "478462c3-3ed1-4dd3-a916-1ecf93ab3ced": r"C:\Users\vibho\OneDrive\Desktop\fraudlens\backend\uploads\1774540501478-paper-2.pdf",
}

c = MongoClient('mongodb://localhost:27017', serverSelectionTimeoutMS=3000)
db = c['fraudlens']

for uuid, file_path in FILE_PATHS.items():
    import os
    if not os.path.exists(file_path):
        print(f'SKIP {uuid}: file not found')
        continue

    print(f'\nProcessing {uuid}...')
    try:
        full_text = extract_text(file_path)
        print(f'  Extracted {len(full_text)} chars')

        summary = generate_summary(full_text)
        db['papers'].update_one(
            {'uuid': uuid},
            {'$set': {'summary': summary, 'extracted_text': full_text[:15000]}},
            upsert=False
        )
        print(f'  title:         {summary["title"][:80]}')
        print(f'  contributions: {summary["main_contributions"][:80]}')
        print(f'  methodology:   {summary["methodology"][:80]}')
        print(f'  conclusions:   {summary["conclusions"][:80]}')
    except Exception as e:
        print(f'  ERROR: {e}')

print('\nAll done.')
