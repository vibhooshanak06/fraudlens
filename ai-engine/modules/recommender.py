"""Recommender — OpenRouter embeddings + cosine similarity."""
import numpy as np
from sklearn.metrics.pairwise import cosine_similarity
from modules.llm import embed_texts

_CORPUS = [
    {"title": "Attention Is All You Need", "authors": ["Vaswani et al."],
     "abstract": "We propose the Transformer, a model architecture based solely on attention mechanisms, dispensing with recurrence and convolutions entirely."},
    {"title": "BERT: Pre-training of Deep Bidirectional Transformers", "authors": ["Devlin et al."],
     "abstract": "We introduce BERT, a new language representation model designed to pre-train deep bidirectional representations from unlabeled text."},
    {"title": "Deep Residual Learning for Image Recognition", "authors": ["He et al."],
     "abstract": "We present a residual learning framework to ease the training of networks that are substantially deeper than those used previously."},
    {"title": "Generative Adversarial Networks", "authors": ["Goodfellow et al."],
     "abstract": "We propose a new framework for estimating generative models via an adversarial process in which two models are trained simultaneously."},
    {"title": "Dropout: Preventing Neural Network Overfitting", "authors": ["Srivastava et al."],
     "abstract": "We describe dropout, a technique for preventing overfitting in neural networks by randomly dropping units during training."},
    {"title": "Adam: A Method for Stochastic Optimization", "authors": ["Kingma and Ba"],
     "abstract": "We introduce Adam, an algorithm for first-order gradient-based optimization of stochastic objective functions."},
    {"title": "Fraud Detection in Academic Papers Using NLP", "authors": ["Smith et al."],
     "abstract": "This paper presents an NLP-based approach to detecting plagiarism and fraudulent patterns in academic research papers using machine learning."},
    {"title": "A Survey of Text Mining Techniques", "authors": ["Jones et al."],
     "abstract": "We survey text mining techniques including clustering, classification, and information extraction from unstructured text data."},
    {"title": "Plagiarism Detection Using Machine Learning", "authors": ["Kumar et al."],
     "abstract": "This work proposes a machine learning framework for detecting plagiarism in academic documents using TF-IDF and cosine similarity measures."},
    {"title": "Natural Language Processing with Transformers", "authors": ["Wolf et al."],
     "abstract": "A comprehensive overview of transformer-based models for NLP tasks including classification, generation, and question answering."},
    {"title": "Academic Integrity in the Age of AI", "authors": ["Brown et al."],
     "abstract": "This paper examines the challenges of maintaining academic integrity as AI-generated content becomes increasingly sophisticated and widespread."},
    {"title": "Citation Analysis and Research Impact", "authors": ["Garfield et al."],
     "abstract": "We analyze citation patterns in academic literature to measure research impact and identify influential works across disciplines."},
]


def recommend(query: str, top_k: int = 10) -> list[dict]:
    corpus_texts = [f"{p['title']} {p['abstract']}" for p in _CORPUS]
    all_texts = [query] + corpus_texts
    all_embeddings = embed_texts(all_texts)
    embeddings = np.array(all_embeddings, dtype="float32")

    query_emb = embeddings[0:1]
    corpus_emb = embeddings[1:]
    sims = cosine_similarity(query_emb, corpus_emb)[0]

    top_indices = sorted(range(len(sims)), key=lambda i: sims[i], reverse=True)[:top_k]
    return [
        {
            "title": _CORPUS[i]["title"],
            "authors": _CORPUS[i]["authors"],
            "abstract_snippet": _CORPUS[i]["abstract"][:200],
            "similarity_score": float(max(0.0, min(1.0, sims[i]))),
        }
        for i in top_indices
    ]
