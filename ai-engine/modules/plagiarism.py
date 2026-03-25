"""
Plagiarism_Module for FraudLens AI Engine.

Computes a plagiarism score using TF-IDF vectorization and cosine similarity
against a reference corpus.
"""

from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity

# Built-in reference corpus of generic academic sentences
_DEFAULT_CORPUS = [
    "The results of this study demonstrate a significant correlation between the variables examined.",
    "Previous research has shown that machine learning algorithms can effectively classify text data.",
    "This paper presents a novel approach to solving the optimization problem using gradient descent.",
    "The experimental setup consisted of a controlled environment with randomized participant assignment.",
    "Our findings suggest that the proposed method outperforms existing baseline approaches.",
    "The dataset used in this study was collected from publicly available sources and preprocessed accordingly.",
    "Statistical analysis was performed using standard methods including ANOVA and regression analysis.",
    "The literature review reveals a gap in current knowledge regarding the long-term effects of the intervention.",
    "Future work will focus on extending the model to handle multi-modal inputs and larger datasets.",
    "In conclusion, the proposed framework provides a scalable and efficient solution to the problem.",
]


def compute_plagiarism_score(text: str, corpus: list = None) -> float:
    """
    Compute a plagiarism score for the given text against a reference corpus.

    Uses TF-IDF vectorization and cosine similarity. Returns the maximum
    cosine similarity between the input text and any document in the corpus,
    clamped to [0.0, 1.0].

    Args:
        text: The input text to evaluate.
        corpus: Optional list of reference documents. If None or empty,
                a built-in default corpus is used.

    Returns:
        A float in [0.0, 1.0] representing the plagiarism score.
        Returns 0.0 for empty input text.
    """
    if not text or not text.strip():
        return 0.0

    reference_corpus = corpus if corpus else _DEFAULT_CORPUS

    # Filter out empty corpus entries
    reference_corpus = [doc for doc in reference_corpus if doc and doc.strip()]
    if not reference_corpus:
        return 0.0

    try:
        vectorizer = TfidfVectorizer()
        all_docs = [text] + reference_corpus
        tfidf_matrix = vectorizer.fit_transform(all_docs)

        # Input text is index 0; corpus documents are indices 1..N
        input_vector = tfidf_matrix[0:1]
        corpus_vectors = tfidf_matrix[1:]

        similarities = cosine_similarity(input_vector, corpus_vectors)[0]
        max_similarity = float(max(similarities))
    except Exception:
        return 0.0

    # Clamp to [0.0, 1.0]
    return max(0.0, min(1.0, max_similarity))
