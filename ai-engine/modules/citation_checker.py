"""
Citation_Module for FraudLens AI Engine.

Detects inconsistent citation styles and extracts a citation graph
to identify potential citation rings.
"""

import re
from collections import defaultdict


# Regex patterns for common citation styles
_PATTERNS = {
    "APA": re.compile(r'\b([A-Z][a-z]+(?:\s+(?:et al\.?|&\s+[A-Z][a-z]+))?),\s+(\d{4})\b'),
    "IEEE": re.compile(r'\[(\d+)\]'),
    "MLA": re.compile(r'\(([A-Z][a-z]+)(?:\s+(\d+))?\)'),
}

# Extract reference list entries
# Format 1: [1] Author...  or  1. Author...
_REF_NUMBERED = re.compile(
    r'^\s*\[?(\d+)\]?\.?\s+([A-Z].{10,150}?)(?=\n\s*\[?\d+\]?\.?\s+[A-Z]|\Z)',
    re.MULTILINE | re.DOTALL
)
_REF_AUTHOR = re.compile(
    r'([A-Z][a-z]+(?:,\s+[A-Z]\.?)+(?:\s+(?:et al\.?|and\s+[A-Z][a-z]+))?)\s*[\.\(]\s*(\d{4})',
    re.MULTILINE
)


def _extract_references(text: str) -> list[dict]:
    """
    Extract references from the paper text.
    Returns list of {id, title_snippet, authors} dicts.
    """
    refs = []

    # Try to find a references/bibliography section heading
    ref_section_match = re.search(
        r'(?:^|\n)\s*(?:REFERENCE[S]?|Bibliography|Works Cited)\s*\n([\s\S]{50,})',
        text, re.IGNORECASE
    )
    ref_text = ref_section_match.group(1) if ref_section_match else text[-5000:]

    # Pattern 1: numbered refs — [1] or 1. at start of line
    numbered = re.findall(
        r'(?:^|\n)\s*\[?(\d+)\]?\.?\s+([A-Z][^\n]{10,200})',
        ref_text
    )
    for num, snippet in numbered:
        refs.append({'id': num, 'snippet': snippet.strip()[:120]})

    # Pattern 2: author-year if no numbered refs found
    if not refs:
        seen = set()
        for m in _REF_AUTHOR.finditer(ref_text):
            key = f"{m.group(1)}_{m.group(2)}"
            if key not in seen:
                seen.add(key)
                refs.append({'id': key, 'snippet': f"{m.group(1)} ({m.group(2)})"})

    return refs[:60]


def _build_citation_graph(text: str, refs: list[dict]) -> dict:
    """
    Build a citation graph: nodes = references, edges = co-citations
    (two refs cited together in the same sentence).
    Also detect citation rings (strongly connected components of size >= 3).
    """
    nodes = [{'id': r['id'], 'label': r['snippet'][:60]} for r in refs]
    edges = []
    edge_set = set()

    # Find sentences that contain multiple citation markers
    sentences = re.split(r'(?<=[.!?])\s+', text)
    ref_ids = {r['id'] for r in refs}

    for sentence in sentences:
        cited_in_sentence = []
        # Check numbered citations [1], [2,3], [1-4], [1, 2]
        for m in re.finditer(r'\[(\d+(?:\s*[,\-]\s*\d+)*)\]', sentence):
            parts = re.split(r'[,\-]', m.group(1))
            for p in parts:
                p = p.strip()
                if p in ref_ids:
                    cited_in_sentence.append(p)

        # Check author-year citations
        for m in _REF_AUTHOR.finditer(sentence):
            key = f"{m.group(1)}_{m.group(2)}"
            if key in ref_ids:
                cited_in_sentence.append(key)

        # Create edges between co-cited references
        cited_in_sentence = list(set(cited_in_sentence))
        for i in range(len(cited_in_sentence)):
            for j in range(i + 1, len(cited_in_sentence)):
                a, b = cited_in_sentence[i], cited_in_sentence[j]
                edge_key = tuple(sorted([a, b]))
                if edge_key not in edge_set:
                    edge_set.add(edge_key)
                    edges.append({'source': a, 'target': b, 'weight': 1})
                else:
                    # Increment weight for repeated co-citation
                    for e in edges:
                        if tuple(sorted([e['source'], e['target']])) == edge_key:
                            e['weight'] += 1
                            break

    # Detect citation rings: nodes with high co-citation frequency (weight >= 3)
    # forming a cycle — simplified: find cliques of size >= 3 with weight >= 2
    rings = _detect_rings(nodes, edges)

    return {
        'nodes': nodes,
        'edges': edges,
        'rings': rings,
        'stats': {
            'total_references': len(nodes),
            'co_citation_pairs': len(edges),
            'ring_count': len(rings),
        }
    }


def _detect_rings(nodes: list, edges: list) -> list:
    """
    Detect citation rings: groups of 3+ references that heavily
    co-cite each other (potential self-citation rings or citation cartels).
    """
    # Build adjacency with weights
    adj = defaultdict(dict)
    for e in edges:
        adj[e['source']][e['target']] = e['weight']
        adj[e['target']][e['source']] = e['weight']

    # Find nodes with degree >= 2 and high co-citation weight
    high_weight_edges = [e for e in edges if e['weight'] >= 2]
    if not high_weight_edges:
        return []

    # Find connected components among high-weight edges
    node_set = set()
    for e in high_weight_edges:
        node_set.add(e['source'])
        node_set.add(e['target'])

    visited = set()
    components = []

    def dfs(node, component):
        visited.add(node)
        component.append(node)
        for e in high_weight_edges:
            neighbor = None
            if e['source'] == node and e['target'] not in visited:
                neighbor = e['target']
            elif e['target'] == node and e['source'] not in visited:
                neighbor = e['source']
            if neighbor:
                dfs(neighbor, component)

    for node in node_set:
        if node not in visited:
            component = []
            dfs(node, component)
            if len(component) >= 3:
                components.append(component)

    rings = []
    for comp in components:
        rings.append({
            'members': comp,
            'size': len(comp),
            'description': f"Citation ring detected: {len(comp)} references heavily co-cited together"
        })

    return rings


def check_citations(text: str) -> list:
    """
    Check for inconsistent citation styles in the given text.
    Returns issues list for the fraud report.
    """
    if not text or not text.strip():
        return []

    detected = {}
    for style, pattern in _PATTERNS.items():
        matches = pattern.findall(text)
        if matches:
            detected[style] = matches

    if len(detected) < 2:
        return []

    styles_found = list(detected.keys())
    examples = {}
    for style in styles_found:
        m = detected[style][0]
        examples[style] = m if isinstance(m, str) else m[0]
    excerpt = " | ".join(f"{s}: {examples[s]}" for s in styles_found)

    return [{
        "type": "citation_inconsistency",
        "description": (
            f"Mixed citation styles detected: {', '.join(styles_found)}. "
            "A single document should use one consistent citation format."
        ),
        "excerpt": excerpt[:200],
    }]


def get_citation_graph(text: str) -> dict:
    """
    Public entry point: extract references and build citation graph.
    Returns graph data suitable for frontend visualization.
    """
    if not text or not text.strip():
        return {'nodes': [], 'edges': [], 'rings': [], 'stats': {'total_references': 0, 'co_citation_pairs': 0, 'ring_count': 0}}

    refs = _extract_references(text)
    if not refs:
        return {'nodes': [], 'edges': [], 'rings': [], 'stats': {'total_references': 0, 'co_citation_pairs': 0, 'ring_count': 0}}

    return _build_citation_graph(text, refs)
