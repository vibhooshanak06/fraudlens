"""
Feature: fraudlens, Property 3: Citation Inconsistency Detection
Validates: Requirements 2.4
"""
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from hypothesis import given, settings
import hypothesis.strategies as st
from modules.citation_checker import check_citations

# APA-style: Author, Year
apa_citation = st.builds(
    lambda name, year: f"{name}, {year}",
    name=st.from_regex(r"[A-Z][a-z]{3,8}", fullmatch=True),
    year=st.integers(min_value=1990, max_value=2024).map(str),
)

# IEEE-style: [N]
ieee_citation = st.integers(min_value=1, max_value=50).map(lambda n: f"[{n}]")


@given(
    apa=st.lists(apa_citation, min_size=1, max_size=3),
    ieee=st.lists(ieee_citation, min_size=1, max_size=3),
    filler=st.text(min_size=20, max_size=100, alphabet=st.characters(whitelist_categories=("Ll", "Zs"))),
)
@settings(max_examples=100)
def test_mixed_citations_flagged(apa, ieee, filler):
    """Documents mixing APA and IEEE citations must have at least one inconsistency flagged."""
    text = filler + " " + " ".join(apa) + " " + " ".join(ieee)
    issues = check_citations(text)
    assert len(issues) >= 1, (
        f"Expected at least one citation inconsistency.\n"
        f"APA: {apa}, IEEE: {ieee}\nIssues: {issues}"
    )
