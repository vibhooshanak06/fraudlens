"""Recommender — OpenRouter embeddings + cosine similarity."""
import numpy as np
from sklearn.metrics.pairwise import cosine_similarity
from modules.llm import embed_texts

_CORPUS = [
    {
        "title": "Attention Is All You Need",
        "authors": ["Vaswani et al."],
        "abstract": "We propose the Transformer, a novel model architecture based solely on attention mechanisms, dispensing with recurrence and convolutions entirely. The model achieves superior quality on machine translation tasks while being more parallelizable and requiring significantly less time to train. On the WMT 2014 English-to-German translation task, the Transformer outperforms all previously reported models including ensembles, establishing a new state-of-the-art BLEU score. The architecture introduces multi-head self-attention and positional encodings, enabling the model to capture long-range dependencies more effectively than RNN-based approaches.",
    },
    {
        "title": "BERT: Pre-training of Deep Bidirectional Transformers for Language Understanding",
        "authors": ["Devlin et al."],
        "abstract": "We introduce BERT (Bidirectional Encoder Representations from Transformers), a new language representation model designed to pre-train deep bidirectional representations from unlabeled text by jointly conditioning on both left and right context in all layers. BERT can be fine-tuned with just one additional output layer to create state-of-the-art models for a wide range of NLP tasks, including question answering, language inference, and named entity recognition, without substantial task-specific architecture modifications. BERT advances the state of the art on eleven NLP benchmarks.",
    },
    {
        "title": "Deep Residual Learning for Image Recognition",
        "authors": ["He et al."],
        "abstract": "We present a residual learning framework to ease the training of networks that are substantially deeper than those used previously. We explicitly reformulate the layers as learning residual functions with reference to the layer inputs, instead of learning unreferenced functions. We provide comprehensive empirical evidence showing that these residual networks are easier to optimize and can gain accuracy from considerably increased depth. On the ImageNet dataset, residual nets with a depth of up to 152 layers achieve 3.57% top-5 error on the ImageNet test set, winning first place in the ILSVRC 2015 classification competition.",
    },
    {
        "title": "Generative Adversarial Networks",
        "authors": ["Goodfellow et al."],
        "abstract": "We propose a new framework for estimating generative models via an adversarial process in which two models are trained simultaneously: a generative model G that captures the data distribution, and a discriminative model D that estimates the probability that a sample came from the training data rather than G. The training procedure for G is to maximize the probability of D making a mistake. This framework corresponds to a minimax two-player game. In the space of arbitrary functions G and D, a unique solution exists, with G recovering the training data distribution and D equal to 1/2 everywhere. GANs have since become foundational in image synthesis, data augmentation, and unsupervised representation learning.",
    },
    {
        "title": "Dropout: A Simple Way to Prevent Neural Networks from Overfitting",
        "authors": ["Srivastava et al."],
        "abstract": "We describe dropout, a technique for preventing overfitting in large neural networks by randomly dropping units (along with their connections) from the neural network during training. This prevents units from co-adapting too much. During training, dropout samples from an exponential number of different thinned networks. At test time, it is easy to approximate the effect of averaging the predictions of all these thinned networks by simply using a single unthinned network with smaller weights. Dropout has been shown to significantly reduce overfitting and gives major improvements over other regularization methods on a wide variety of classification tasks.",
    },
    {
        "title": "Adam: A Method for Stochastic Optimization",
        "authors": ["Kingma and Ba"],
        "abstract": "We introduce Adam, an algorithm for first-order gradient-based optimization of stochastic objective functions, based on adaptive estimates of lower-order moments. The method is straightforward to implement, is computationally efficient, has little memory requirements, is invariant to diagonal rescaling of the gradients, and is well suited for problems that are large in terms of data or parameters. Adam combines the advantages of AdaGrad and RMSProp, and empirically demonstrates good performance on a wide range of machine learning problems including logistic regression, neural networks, and deep learning architectures.",
    },
    {
        "title": "Fraud Detection in Academic Papers Using NLP",
        "authors": ["Smith et al."],
        "abstract": "This paper presents a comprehensive NLP-based approach to detecting plagiarism and fraudulent patterns in academic research papers using machine learning. We propose a multi-stage pipeline that combines TF-IDF vectorization, semantic embeddings, and citation graph analysis to identify suspicious content. Our system detects paraphrased plagiarism, citation manipulation, and data fabrication indicators with high precision. Experiments on a curated dataset of 5,000 academic papers demonstrate that our approach achieves 91% accuracy in fraud classification, outperforming existing rule-based systems by a significant margin.",
    },
    {
        "title": "A Survey of Text Mining Techniques for Academic Document Analysis",
        "authors": ["Jones et al."],
        "abstract": "We survey text mining techniques including clustering, classification, information extraction, and summarization applied to unstructured academic text data. This comprehensive review covers traditional bag-of-words approaches, latent semantic analysis, topic modeling with LDA, and modern transformer-based methods. We discuss applications in academic search engines, recommendation systems, and automated review assistance. The survey also addresses challenges specific to scientific text such as domain-specific terminology, citation parsing, and multi-document summarization, providing a roadmap for future research directions in scholarly document understanding.",
    },
    {
        "title": "Plagiarism Detection Using Machine Learning and Semantic Similarity",
        "authors": ["Kumar et al."],
        "abstract": "This work proposes a machine learning framework for detecting plagiarism in academic documents using TF-IDF, cosine similarity, and deep semantic embeddings. We address both verbatim copying and paraphrase-based plagiarism, which is significantly harder to detect. Our approach leverages sentence-level BERT embeddings to capture semantic equivalence beyond surface-level text matching. We evaluate on the PAN plagiarism corpus and a novel dataset of 2,000 student submissions, achieving state-of-the-art performance. The system also provides interpretable evidence by highlighting suspicious passages and their likely source documents.",
    },
    {
        "title": "Natural Language Processing with Transformers: Building Language Applications",
        "authors": ["Wolf et al."],
        "abstract": "A comprehensive overview of transformer-based models for NLP tasks including text classification, named entity recognition, question answering, summarization, and generation. This work covers the full landscape from foundational models like BERT and GPT to instruction-tuned large language models. We discuss fine-tuning strategies, prompt engineering, and efficient inference techniques such as quantization and distillation. Practical implementation guidance using the Hugging Face ecosystem is provided, along with benchmarks across GLUE, SuperGLUE, and domain-specific evaluation sets, making this a definitive reference for practitioners building real-world NLP applications.",
    },
    {
        "title": "Academic Integrity in the Age of AI: Challenges and Solutions",
        "authors": ["Brown et al."],
        "abstract": "This paper examines the growing challenges of maintaining academic integrity as AI-generated content becomes increasingly sophisticated and widespread. We analyze the limitations of current AI-detection tools and propose a multi-modal framework combining stylometric analysis, behavioral signals, and semantic consistency checks. Our study surveys 200 institutions and finds that 67% lack adequate policies for AI-assisted writing. We propose a tiered detection approach and discuss the ethical implications of AI use in education, arguing for transparent disclosure policies rather than outright prohibition, supported by empirical evidence from student performance studies.",
    },
    {
        "title": "Citation Analysis and Research Impact Measurement",
        "authors": ["Garfield et al."],
        "abstract": "We analyze citation patterns in academic literature to measure research impact and identify influential works across disciplines. This study introduces refined bibliometric indicators that account for self-citation bias, citation velocity, and cross-disciplinary influence. We examine citation ring patterns — groups of papers that disproportionately cite each other — as a potential indicator of academic misconduct. Using a dataset of 10 million papers from Web of Science, we demonstrate that citation-based metrics combined with semantic similarity scores provide a more robust measure of genuine research impact than raw citation counts alone.",
    },
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
            "abstract_snippet": _CORPUS[i]["abstract"],
            "similarity_score": float(max(0.0, min(1.0, sims[i]))),
        }
        for i in top_indices
    ]
