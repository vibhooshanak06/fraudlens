"""
Embedder module — uses OpenRouter embeddings (with TF-IDF fallback).
No local model download required.
"""
import os
import pickle
import numpy as np
import faiss
from langchain.text_splitter import RecursiveCharacterTextSplitter
from modules.llm import embed_texts

FAISS_STORE_PATH = os.getenv("FAISS_STORE_PATH", "./faiss_indexes")
EMBED_DIM = 512  # TF-IDF fallback dim; OpenAI text-embedding-3-small = 1536


def chunk_text(text: str) -> list[str]:
    splitter = RecursiveCharacterTextSplitter(chunk_size=512, chunk_overlap=50, length_function=len)
    return splitter.split_text(text)


def build_index(uuid: str, text: str) -> list[str]:
    os.makedirs(FAISS_STORE_PATH, exist_ok=True)
    chunks = chunk_text(text)
    if not chunks:
        return []

    embeddings_list = embed_texts(chunks)
    embeddings = np.array(embeddings_list, dtype="float32")
    dim = embeddings.shape[1]

    index = faiss.IndexFlatL2(dim)
    index.add(embeddings)

    faiss.write_index(index, os.path.join(FAISS_STORE_PATH, f"{uuid}.index"))
    with open(os.path.join(FAISS_STORE_PATH, f"{uuid}.chunks"), "wb") as f:
        pickle.dump(chunks, f)
    # Store dim for later searches
    with open(os.path.join(FAISS_STORE_PATH, f"{uuid}.dim"), "w") as f:
        f.write(str(dim))

    return chunks


def load_index(uuid: str):
    index_path = os.path.join(FAISS_STORE_PATH, f"{uuid}.index")
    chunks_path = os.path.join(FAISS_STORE_PATH, f"{uuid}.chunks")
    if not os.path.exists(index_path) or not os.path.exists(chunks_path):
        return None, None
    index = faiss.read_index(index_path)
    with open(chunks_path, "rb") as f:
        chunks = pickle.load(f)
    return index, chunks


def search(uuid: str, query: str, top_k: int = 5) -> list[dict]:
    index, chunks = load_index(uuid)
    if index is None:
        return []
    embeddings_list = embed_texts([query])
    query_embedding = np.array(embeddings_list, dtype="float32")
    k = min(top_k, index.ntotal)
    if k == 0:
        return []
    _, indices = index.search(query_embedding, k)
    return [
        {"chunk_id": int(idx), "excerpt": chunks[idx][:300]}
        for idx in indices[0]
        if 0 <= idx < len(chunks)
    ]
