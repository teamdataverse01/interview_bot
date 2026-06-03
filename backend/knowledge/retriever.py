"""RAG retriever over the parsed knowledge base (PRD §11 RAG, M1 deliverable).

Loads `knowledge_base.jsonl` and returns transcript exemplars **filtered by the user's session
config** (company/level/interview-type/lens) and ranked by relevance to a query.

Two embedding backends, selected by `EMBED_PROVIDER`:

  * "tfidf"     — pure-Python TF-IDF cosine. Zero dependencies, works today (the V1 default so the
                  engine is testable without ML wheels or API keys).
  * "fastembed" — local BAAI/bge-small embeddings (free, no API cost). Better semantic recall.
                  Enable once `fastembed` is installed: `EMBED_PROVIDER=fastembed`.

The metadata-filter-then-rank design is identical for both backends and ports directly to the
pgvector query in M4 (filter on metadata columns, order by embedding distance).
"""

from __future__ import annotations

import json
import math
import os
import re
from collections import Counter
from dataclasses import dataclass
from pathlib import Path

_TOKEN_RE = re.compile(r"[a-z0-9]+")
_DEFAULT_KB = Path(__file__).resolve().parent / "knowledge_base.jsonl"


def _tokenize(text: str) -> list[str]:
    return _TOKEN_RE.findall(text.lower())


@dataclass
class Exemplar:
    doc_id: str
    company: str | None
    role_level: str
    speaker: str
    interview_type: list[str]
    competencies: list[str]
    lens: str
    question: str
    text: str
    score: float


class KnowledgeBase:
    """In-memory KB with metadata filtering + relevance ranking."""

    def __init__(self, jsonl_path: Path | str = _DEFAULT_KB, embed_provider: str | None = None):
        self.path = Path(jsonl_path)
        self.embed_provider = (embed_provider or os.getenv("EMBED_PROVIDER", "tfidf")).lower()
        self.rows: list[dict] = []
        self._idf: dict[str, float] = {}
        self._doc_vecs: list[dict[str, float]] = []
        self._fastembed_model = None
        self._embeddings = None  # numpy array when using fastembed
        self._load()

    # --- loading / indexing ---------------------------------------------------------
    def _load(self) -> None:
        if not self.path.exists():
            raise FileNotFoundError(
                f"Knowledge base not found: {self.path}. Run the parser first:\n"
                f"  python -m knowledge.ingest.parse_boss_doc"
            )
        self.rows = [json.loads(line) for line in self.path.read_text(encoding="utf-8").splitlines() if line.strip()]
        if self.embed_provider == "fastembed":
            self._build_fastembed()
        else:
            self._build_tfidf()

    def _doc_text(self, row: dict) -> str:
        return f"{row.get('question','')} {row.get('text','')}"

    def _build_tfidf(self) -> None:
        n = len(self.rows)
        df: Counter[str] = Counter()
        tokenized: list[list[str]] = []
        for row in self.rows:
            toks = _tokenize(self._doc_text(row))
            tokenized.append(toks)
            for t in set(toks):
                df[t] += 1
        self._idf = {t: math.log((1 + n) / (1 + c)) + 1.0 for t, c in df.items()}
        self._doc_vecs = [self._tfidf_vec(toks) for toks in tokenized]

    def _tfidf_vec(self, tokens: list[str]) -> dict[str, float]:
        tf = Counter(tokens)
        total = len(tokens) or 1
        vec = {t: (c / total) * self._idf.get(t, 0.0) for t, c in tf.items()}
        norm = math.sqrt(sum(v * v for v in vec.values())) or 1.0
        return {t: v / norm for t, v in vec.items()}

    def _build_fastembed(self) -> None:  # pragma: no cover - optional dependency path
        from fastembed import TextEmbedding  # type: ignore
        import numpy as np

        model_name = os.getenv("EMBED_MODEL", "BAAI/bge-small-en-v1.5")
        self._fastembed_model = TextEmbedding(model_name=model_name)
        texts = [self._doc_text(r) for r in self.rows]
        self._embeddings = np.array(list(self._fastembed_model.embed(texts)), dtype="float32")
        norms = np.linalg.norm(self._embeddings, axis=1, keepdims=True)
        self._embeddings = self._embeddings / np.clip(norms, 1e-8, None)

    # --- query ----------------------------------------------------------------------
    def _passes_filters(self, row: dict, *, company, role_level, interview_type, lens, speaker) -> bool:
        if company and (row.get("company") or "").lower() != company.lower():
            return False
        if role_level and row.get("role_level") != role_level:
            return False
        if speaker and row.get("speaker") != speaker:
            return False
        if lens and lens != "mixed" and row.get("lens") not in (lens, "mixed"):
            return False
        if interview_type:
            wanted = {interview_type} if isinstance(interview_type, str) else set(interview_type)
            if not wanted & set(row.get("interview_type", [])):
                return False
        return True

    def _score(self, query: str, idx: int) -> float:
        if self.embed_provider == "fastembed":  # pragma: no cover
            import numpy as np
            q = np.array(list(self._fastembed_model.embed([query]))[0], dtype="float32")
            q = q / (np.linalg.norm(q) or 1.0)
            return float(self._embeddings[idx] @ q)
        qv = self._tfidf_vec(_tokenize(query))
        dv = self._doc_vecs[idx]
        # cosine over sparse dicts (both already L2-normalized)
        small, large = (qv, dv) if len(qv) < len(dv) else (dv, qv)
        return sum(w * large.get(t, 0.0) for t, w in small.items())

    def search(
        self,
        query: str,
        *,
        company: str | None = None,
        role_level: str | None = None,
        interview_type=None,
        lens: str | None = None,
        speaker: str | None = None,
        top_k: int = 5,
    ) -> list[Exemplar]:
        """Return the top_k exemplars matching the filters, ranked by relevance to `query`."""
        candidates = [
            i
            for i, row in enumerate(self.rows)
            if self._passes_filters(
                row, company=company, role_level=role_level,
                interview_type=interview_type, lens=lens, speaker=speaker,
            )
        ]
        scored = sorted(((self._score(query, i), i) for i in candidates), reverse=True)
        out: list[Exemplar] = []
        for score, i in scored[:top_k]:
            r = self.rows[i]
            out.append(
                Exemplar(
                    doc_id=r["doc_id"], company=r.get("company"), role_level=r["role_level"],
                    speaker=r["speaker"], interview_type=r.get("interview_type", []),
                    competencies=r.get("competencies", []), lens=r.get("lens", "mixed"),
                    question=r["question"], text=r["text"], score=round(score, 4),
                )
            )
        return out


if __name__ == "__main__":
    # Smoke test / demo: query the KB from the command line.
    import argparse

    ap = argparse.ArgumentParser(description="Query the interview knowledge base.")
    ap.add_argument("query", nargs="?", default="how do you streamline a broken DPIA process")
    ap.add_argument("--company", default=None)
    ap.add_argument("--level", default=None)
    ap.add_argument("--type", default=None)
    ap.add_argument("-k", type=int, default=3)
    args = ap.parse_args()

    kb = KnowledgeBase()
    print(f"KB loaded: {len(kb.rows)} chunks | embedder={kb.embed_provider}\n")
    results = kb.search(args.query, company=args.company, role_level=args.level, interview_type=args.type, top_k=args.k)
    for r in results:
        print(f"[{r.score}] {r.doc_id} ({r.company}/{r.role_level}, {r.lens}) types={r.interview_type}")
        print(f"   Q: {r.question[:120]}")
        print(f"   A: {r.text[:200].replace(chr(10),' ')}\n")
