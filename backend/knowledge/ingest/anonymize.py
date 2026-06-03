"""Anonymization for transcript ingestion (PRD §2 — a hard requirement from Elizabeth).

Her rule: "Remove personal data, anonymize names, strip identifiers, avoid reproducing
proprietary interview questions verbatim." We therefore:

  * Replace personal first-names of panelists/candidates with neutral role descriptors.
  * Keep COMPANY names (Netflix/TikTok/Strava/Meta) — they are required for the culture
    personas and are not personal data. This tradeoff is intentional and documented.
  * We store the distilled Q/A *breakdowns* (not raw verbatim transcript), which already
    abstracts the proprietary wording into patterns/competencies.

If Elizabeth later wants company names scrubbed too, add them to `COMPANY_NAMES` below and
flip `SCRUB_COMPANIES = True`.
"""

from __future__ import annotations

import re

# Personal names that appear in the transcripts -> neutral descriptor.
NAME_REPLACEMENTS: dict[str, str] = {
    "Ted": "the candidate",
    "Scott": "a senior direct report",
    "Shani": "a peer leader",
    "Elizabeth": "the coach",
}

# Company names are KEPT by default (needed for personas). Listed so scrubbing is one flag away.
COMPANY_NAMES = ["Netflix", "TikTok", "ByteDance", "Strava", "Meta", "Disney", "Deloitte", "Google", "Pinterest", "Apple", "Epic", "IBM"]
SCRUB_COMPANIES = False

# Obvious direct identifiers to strip regardless.
EMAIL_RE = re.compile(r"\b[\w.+-]+@[\w-]+\.[\w.-]+\b")
PHONE_RE = re.compile(r"\b(?:\+?\d{1,3}[-.\s]?)?(?:\(?\d{3}\)?[-.\s]?)\d{3}[-.\s]?\d{4}\b")

# Private-use-area glyphs (U+E000-U+F8FF + supplementary PUA) and the replacement char
# U+FFFD are artifacts of the doc's emoji / ASCII diagrams. Control chars stripped too.
_PUA_RE = re.compile("[-�\U000f0000-\U000ffffd]")
_CTRL_RE = re.compile(r"[\x00-\x08\x0b\x0c\x0e-\x1f]")

# Smart punctuation -> ASCII for terminal/DB friendliness.
_SMART = {
    "’": "'", "‘": "'", "“": '"', "”": '"',
    "–": "-", "—": "-", "…": "...", " ": " ",
}


def clean_text(text: str) -> str:
    """Strip private-use/control glyphs and normalize smart punctuation + whitespace."""
    if not text:
        return text
    text = _PUA_RE.sub("", text)
    text = _CTRL_RE.sub("", text)
    for bad, good in _SMART.items():
        text = text.replace(bad, good)
    return text


def anonymize(text: str) -> str:
    """Return an anonymized copy of `text` safe to embed into the knowledge base."""
    if not text:
        return text

    text = clean_text(text)

    # Strip direct identifiers first.
    text = EMAIL_RE.sub("[email]", text)
    text = PHONE_RE.sub("[phone]", text)

    # Replace personal names on word boundaries (case-sensitive on the capitalized form
    # to avoid mangling common words).
    for name, repl in NAME_REPLACEMENTS.items():
        text = re.sub(rf"\b{re.escape(name)}\b", repl, text)

    if SCRUB_COMPANIES:
        for company in COMPANY_NAMES:
            text = re.sub(rf"\b{re.escape(company)}\b", "[company]", text)

    return text
