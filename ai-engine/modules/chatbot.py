"""Chatbot — RAG Q&A using FAISS + OpenRouter LLM."""
from modules.embedder import search, load_index
from modules.llm import chat_completion


def answer(uuid: str, question: str) -> dict:
    index, chunks = load_index(uuid)
    if index is None:
        raise FileNotFoundError(f"No FAISS index for paper {uuid}. Processing may still be in progress.")

    sources = search(uuid, question, top_k=5)
    context = "\n\n---\n\n".join(s["excerpt"] for s in sources)

    messages = [
        {
            "role": "system",
            "content": (
                "You are an expert research paper analysis assistant. "
                "Answer the user's question based ONLY on the provided context from the paper. "
                "Be concise and accurate. If the context is insufficient, say so clearly."
            ),
        },
        {
            "role": "user",
            "content": f"Context from the paper:\n\n{context}\n\nQuestion: {question}",
        },
    ]

    try:
        answer_text = chat_completion(messages, max_tokens=600, temperature=0.2)
    except Exception as e:
        raise RuntimeError(f"LLM call failed: {e}")

    return {"answer": answer_text, "sources": sources}
