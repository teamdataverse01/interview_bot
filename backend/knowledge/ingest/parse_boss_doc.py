"""M1 — Knowledge Engine parser (PRD §2, §12 milestone M1).

Parses the *structured* interview breakdowns Elizabeth authored in `Interview transcript.docx`
(extracted to `boss_doc.txt`, structured region ~line 5089+) into layer-tagged, anonymized,
config-filterable knowledge chunks.

Each emitted chunk follows the ingestion contract in PRD §2 and is the portable artifact the
later pgvector ingestion (M4) consumes. Run:

    python -m knowledge.ingest.parse_boss_doc \
        --src ../boss_doc.txt \
        --out knowledge/knowledge_base.jsonl

Pure standard-library (no ML deps) so it runs anywhere, including Python 3.14.
"""

from __future__ import annotations

import argparse
import json
import re
import sys
from dataclasses import asdict, dataclass, field
from pathlib import Path

# Allow running both as a module (-m) and as a script.
sys.path.insert(0, str(Path(__file__).resolve().parents[2]))

from app.taxonomy import (  # noqa: E402
    COMPANY_INDUSTRY,
    OPERATIONAL_KEYWORDS,
    PROGRAMMATIC_KEYWORDS,
    TYPE_KEYWORDS,
)
from knowledge.ingest.anonymize import anonymize  # noqa: E402

# Markers (the document uses emoji headers consistently).
PROFILE_ANCHORS = ("📋 Interview Profile", "👥 Panel Profile")
Q_PREFIX = "❓"
CANDIDATE_Q_MARKERS = ("Candidate Question",)
CANDIDATE_ANSWER = "Candidate Answer:"
INTERVIEWER_ANSWER = "Interviewer Answer:"
REVERSE_MARKER = "🔄"
# Section-ish lines that terminate an answer body without starting a new Q.
SECTION_BREAKS = ("🔄", "📑", "🏢", "🧭", "👥", "🏁", "🕒", "📋", "Interview Framework", "Metrics for good")

LEVEL_PATTERNS = [
    (re.compile(r"\bVP\b|Vice President", re.I), "VP"),
    (re.compile(r"\bDirector\b", re.I), "Director"),
    (re.compile(r"\bManager\b|hiring manager|\bHM\b", re.I), "Manager"),
]


@dataclass
class KnowledgeChunk:
    doc_id: str
    layer: str  # interview-transcript | reverse-interview | culture-context
    company: str | None
    industry: str | None
    role_level: str
    speaker: str  # candidate | interviewer
    interview_type: list[str]
    competencies: list[str]
    answer_quality: str  # strong | good | fair | weak | n/a
    lens: str  # operational | programmatic | mixed
    anonymized: bool
    question: str
    text: str  # the answer body (anonymized)
    source_block: str


def _read_lines(src: Path) -> list[str]:
    return src.read_text(encoding="utf-8", errors="ignore").splitlines()


def _find_blocks(lines: list[str]) -> list[tuple[str, int, int]]:
    """Return (title, start_idx, end_idx) for each interview block.

    A block is anchored on a Profile/Panel header line; its title is the nearest short
    non-prose line above it. The block runs until the next anchor (or EOF).
    """
    anchors = [i for i, ln in enumerate(lines) if ln.lstrip().startswith(PROFILE_ANCHORS)]
    blocks: list[tuple[str, int, int]] = []
    for n, a in enumerate(anchors):
        # Title = scan up to 4 lines up for a short, title-like line.
        title = "Unknown"
        for j in range(a - 1, max(a - 5, -1), -1):
            cand = lines[j].strip()
            if not cand:
                continue
            # Skip descriptive sentences (they are long / start with 'Here'/'This').
            if len(cand) <= 60 and not cand[:1].islower() and not cand.startswith(("Here", "This", "The interviewer")):
                title = cand
                break
            if cand.startswith(("Here", "This")):
                continue
        start = a
        end = anchors[n + 1] - 4 if n + 1 < len(anchors) else len(lines)
        blocks.append((title, start, end))
    return blocks


def _detect_company(title: str, body: str) -> str | None:
    hay = f"{title}\n{body[:400]}".lower()
    for company in ("TikTok", "Netflix", "Strava", "Meta"):
        if company.lower() in hay or company.lower().replace(" ", "") in title.lower().replace(" ", ""):
            return company
    return None


def _detect_level(title: str, profile: str) -> str:
    hay = f"{title}\n{profile}"
    for pat, level in LEVEL_PATTERNS:
        if pat.search(hay):
            return level
    return "Director"  # these are all leadership interviews


def _classify_types(text: str) -> list[str]:
    low = text.lower()
    hits = [t for t, kws in TYPE_KEYWORDS.items() if any(k in low for k in kws)]
    return hits or ["Behavioral"]


def _detect_lens(text: str) -> str:
    low = text.lower()
    op = sum(low.count(k) for k in OPERATIONAL_KEYWORDS)
    pr = sum(low.count(k) for k in PROGRAMMATIC_KEYWORDS)
    if op and pr:
        return "mixed"
    if pr > op:
        return "programmatic"
    if op > pr:
        return "operational"
    return "mixed"


def _slug(text: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", text.lower()).strip("-")[:40] or "block"


def _is_q_header(line: str) -> bool:
    return line.lstrip().startswith(Q_PREFIX)


def _is_break(line: str) -> bool:
    s = line.lstrip()
    return any(s.startswith(b) for b in SECTION_BREAKS)


def _parse_block(title: str, lines: list[str], start: int, end: int) -> list[KnowledgeChunk]:
    block_lines = lines[start:end]
    profile = "\n".join(block_lines[:6])
    company = _detect_company(title, "\n".join(block_lines[:40]))
    industry = COMPANY_INDUSTRY.get(company or "", None)
    level = _detect_level(title, profile)
    chunks: list[KnowledgeChunk] = []

    i = 0
    n = len(block_lines)
    q_index = 0
    while i < n:
        line = block_lines[i]
        if _is_q_header(line):
            header = line.lstrip()[len(Q_PREFIX):].strip()
            is_reverse = any(m.lower() in header.lower() for m in CANDIDATE_Q_MARKERS)
            # Collect everything until next Q header.
            j = i + 1
            body_lines: list[str] = []
            while j < n and not _is_q_header(block_lines[j]):
                body_lines.append(block_lines[j])
                j += 1
            body = "\n".join(body_lines)

            # Question text: the "Interviewer:"/"Candidate:" line, else the header title.
            q_text = header.split(":", 1)[-1].strip() if ":" in header else header
            m = re.search(r"^(?:Interviewer|Candidate)\s*:\s*(.+)", body, re.M)
            if m:
                q_text = m.group(1).strip()

            # Answer body: text after the answer marker, until a section break.
            marker = INTERVIEWER_ANSWER if is_reverse else CANDIDATE_ANSWER
            ans = _extract_answer(body, marker)
            if not ans:
                # Fall back to the other marker if present.
                ans = _extract_answer(body, INTERVIEWER_ANSWER if not is_reverse else CANDIDATE_ANSWER)
            if not ans or len(ans.strip()) < 25:
                i = j
                continue

            speaker = "interviewer" if is_reverse else "candidate"
            layer = "reverse-interview" if is_reverse else "interview-transcript"
            quality = "n/a" if is_reverse else "strong"  # candidate answers are curated exemplars
            full = f"{q_text}\n{ans}"
            chunk = KnowledgeChunk(
                doc_id=f"{_slug(title)}-q{q_index:02d}",
                layer=layer,
                company=company,
                industry=industry,
                role_level=level,
                speaker=speaker,
                interview_type=_classify_types(full),
                competencies=_competencies(full),
                answer_quality=quality,
                lens=_detect_lens(ans),
                anonymized=True,
                question=anonymize(q_text),
                text=anonymize(ans.strip()),
                source_block=title,
            )
            chunks.append(chunk)
            q_index += 1
            i = j
        else:
            i += 1
    return chunks


def _extract_answer(body: str, marker: str) -> str:
    idx = body.find(marker)
    if idx == -1:
        return ""
    rest = body[idx + len(marker):]
    out_lines: list[str] = []
    for ln in rest.splitlines():
        if _is_break(ln):
            break
        out_lines.append(ln)
    return "\n".join(out_lines).strip()


# Competency vocabulary derived from her frameworks (short, stable tags).
COMPETENCY_KEYWORDS: dict[str, list[str]] = {
    "change-management": ["culture shift", "change", "reorg", "migration", "pivot"],
    "stakeholder-mgmt": ["stakeholder", "cross-functional", "buy-in", "alignment"],
    "prioritization": ["prioritiz", "okr", "roadmap", "p0", "quarter"],
    "risk-reasoning": ["risk register", "risk assessment", "risk score", "risk-based", "defensibility"],
    "automation-scale": ["automat", "scale", "efficiency", "grc", "pipeline"],
    "regulatory": ["gdpr", "ccpa", "ndpa", "ftc", "regulator", "audit"],
    "exec-communication": ["executive", "cto", "ceo", "translate", "translation"],
    "ambiguity": ["ambiguous", "vague", "unmoored", "chaos", "unclear"],
    "leadership-coaching": ["morale", "coaching", "career", "mentor", "1-on-1"],
    "incident-response": ["incident", "breach", "exposure", "access control"],
}


def _competencies(text: str) -> list[str]:
    low = text.lower()
    return [c for c, kws in COMPETENCY_KEYWORDS.items() if any(k in low for k in kws)]


def parse(src: Path) -> list[KnowledgeChunk]:
    lines = _read_lines(src)
    chunks: list[KnowledgeChunk] = []
    for title, start, end in _find_blocks(lines):
        chunks.extend(_parse_block(title, lines, start, end))
    return chunks


def main() -> int:
    ap = argparse.ArgumentParser(description="Parse Elizabeth's structured interview doc into tagged knowledge chunks.")
    ap.add_argument("--src", default="../boss_doc.txt", help="Path to the extracted boss_doc.txt")
    ap.add_argument("--out", default="knowledge/knowledge_base.jsonl", help="Output JSONL path")
    args = ap.parse_args()

    src = Path(args.src).resolve()
    if not src.exists():
        print(f"ERROR: source not found: {src}", file=sys.stderr)
        return 2

    chunks = parse(src)
    out = Path(args.out).resolve()
    out.parent.mkdir(parents=True, exist_ok=True)
    with out.open("w", encoding="utf-8") as f:
        for c in chunks:
            f.write(json.dumps(asdict(c), ensure_ascii=False) + "\n")

    # Console summary so the run is verifiable at a glance.
    by_company: dict[str, int] = {}
    by_layer: dict[str, int] = {}
    for c in chunks:
        by_company[c.company or "generic"] = by_company.get(c.company or "generic", 0) + 1
        by_layer[c.layer] = by_layer.get(c.layer, 0) + 1
    print(f"Parsed {len(chunks)} knowledge chunks -> {out}")
    print(f"  by company: {by_company}")
    print(f"  by layer:   {by_layer}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
