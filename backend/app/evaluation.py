"""Evaluation Engine — Elizabeth's "secret sauce" (PRD §5).

Scores each candidate answer on:
  * the 8 core dimensions (her "Metrics used to Evaluate"), each 0-10, and
  * the 6 Elite Principles (her "Interview Blueprint"), hit/miss,
then returns the full feedback package: confidence score (0-100), a rewritten stronger answer,
missed concepts, and STAR optimization notes.

Difficulty gating (PRD §5.2): at "Executive (FAANG bar)" the 6 principles are hard gates — a
missed principle caps the confidence score; below that they are coaching notes.

Grounded with RAG: we pull "strong" candidate exemplars for the same interview type so the model
calibrates against the real bar, not a generic rubric.
"""

from __future__ import annotations

from app.llm import LLMError, chat_json
from app.personas import Persona
from app.schemas import (
    ELITE_PRINCIPLES,
    SCORE_DIMENSIONS,
    AnswerEvaluation,
    SessionConfig,
    SessionReport,
)
from knowledge.retriever import KnowledgeBase

_KB: KnowledgeBase | None = None


def _kb() -> KnowledgeBase:
    global _KB
    if _KB is None:
        _KB = KnowledgeBase()
    return _KB


def _dimensions_block() -> str:
    return "\n".join(f"  - {key}: {label}" for key, label in SCORE_DIMENSIONS.items())


def _principles_block() -> str:
    return "\n".join(f"  - {key}: {label} — rewards {desc}" for key, (label, desc) in ELITE_PRINCIPLES.items())


def _gold_block(config: SessionConfig) -> str:
    """Retrieve strong exemplars for this interview type to anchor the bar."""
    hits = _kb().search(
        config.interview_type,
        interview_type=config.interview_type,
        speaker="candidate",
        top_k=2,
    )
    if not hits:
        return ""
    snippets = "\n".join(f"  - {h.text[:280]}" for h in hits)
    return (
        "GOLD-STANDARD reference (how strong privacy leaders answered this topic — use to "
        f"calibrate the bar, do not require identical content):\n{snippets}\n"
    )


def _eval_system_prompt(persona: Persona, config: SessionConfig) -> str:
    executive = config.difficulty == "Executive (FAANG bar)"
    gating = (
        "This is an EXECUTIVE (FAANG-bar) interview. The 6 Elite Principles are HARD GATES: for "
        "each principle the answer misses, lower the confidence_score substantially. A great-sounding "
        "answer that ignores automation/scale or treats compliance as a checklist CANNOT score high."
        if executive
        else "Principles here are coaching signals: note misses but they do not hard-cap the score."
    )
    return f"""\
You are a {persona.company} hiring manager AND a strict interview evaluator for Dataverse.
You grade a single candidate answer the way an elite, FAANG-scale privacy hiring manager would.

This {persona.company} interviewer specifically REWARDS: {', '.join(persona.rewards)}.
This interviewer is ALLERGIC to: {', '.join(persona.penalizes)}.

Score these 8 DIMENSIONS, each an integer 0-10:
{_dimensions_block()}

Check these 6 ELITE PRINCIPLES (true = clearly demonstrated, false = missing/weak):
{_principles_block()}

{gating}

{_gold_block(config)}
Return ONLY this JSON object:
{{
  "scores": {{ "clarity": int, "structure": int, "privacy_terminology": int, "confidence": int,
              "risk_reasoning": int, "regulatory_understanding": int, "business_alignment": int,
              "org_context": int }},
  "rationale": {{ "<dimension>": "one short reason for that score" }},
  "principles": {{ "enterprise_scale": bool, "automation": bool, "cognitive": bool,
                  "chaos": bool, "collaboration": bool, "operational_enabler": bool }},
  "principle_notes": "1-2 lines: which principles were missed and why it matters",
  "confidence_score": int,   // 0-100 overall interview readiness for THIS answer
  "stronger_answer": "a rewritten, stronger version (3-4 sentences) in this company's preferred frame",
  "missed_concepts": ["up to 4 specific frameworks/regulations/points the answer should have hit"],
  "star_notes": "1-2 sentences: how to restructure this into Situation-Task-Action-Result"
}}
Be honest and exacting. Do not inflate scores. Keep every string field concise so the JSON is complete."""


def _coerce_eval(data: dict) -> AnswerEvaluation:
    scores = {k: int(data.get("scores", {}).get(k, 0) or 0) for k in SCORE_DIMENSIONS}
    principles = {k: bool(data.get("principles", {}).get(k, False)) for k in ELITE_PRINCIPLES}
    missed = data.get("missed_concepts") or []
    if isinstance(missed, str):
        missed = [missed]
    return AnswerEvaluation(
        scores=scores,
        rationale={k: str(v) for k, v in (data.get("rationale") or {}).items()},
        principles=principles,
        principle_notes=str(data.get("principle_notes", "")),
        confidence_score=int(data.get("confidence_score", 0) or 0),
        stronger_answer=str(data.get("stronger_answer", "")),
        missed_concepts=[str(m) for m in missed][:8],
        star_notes=str(data.get("star_notes", "")),
    )


def evaluate_answer(
    persona: Persona, config: SessionConfig, question: str, answer: str
) -> AnswerEvaluation:
    """Score one candidate answer and return the full feedback package."""
    if not answer or len(answer.strip()) < 5:
        return AnswerEvaluation(confidence_score=0, star_notes="No substantive answer to evaluate.")
    messages = [
        {"role": "system", "content": _eval_system_prompt(persona, config)},
        {"role": "user", "content": f"INTERVIEW QUESTION:\n{question}\n\nCANDIDATE ANSWER:\n{answer}"},
    ]
    data = chat_json(messages, max_tokens=1300, temperature=0.2)
    return _coerce_eval(data)


def build_report(evaluations: list[AnswerEvaluation], config: SessionConfig) -> SessionReport:
    """Aggregate per-answer evaluations into the end-of-session report (PRD §5.3)."""
    report = SessionReport(answers_evaluated=len(evaluations))
    if not evaluations:
        return report

    # Dimension averages.
    for dim in SCORE_DIMENSIONS:
        vals = [e.scores.get(dim, 0) for e in evaluations if e.scores]
        report.dimension_averages[dim] = round(sum(vals) / len(vals), 1) if vals else 0.0

    # Principle hit rate.
    for prin in ELITE_PRINCIPLES:
        hits = [1 for e in evaluations if e.principles.get(prin)]
        report.principle_hit_rate[prin] = round(len(hits) / len(evaluations), 2)

    # Overall confidence = mean of per-answer confidence scores.
    confs = [e.confidence_score for e in evaluations]
    report.overall_confidence = round(sum(confs) / len(confs))

    # Strengths / weaknesses from dimension averages.
    ranked = sorted(report.dimension_averages.items(), key=lambda kv: kv[1], reverse=True)
    report.strengths = [SCORE_DIMENSIONS[k] for k, v in ranked[:3] if v >= 7]
    report.weaknesses = [SCORE_DIMENSIONS[k] for k, v in ranked[::-1][:3] if v < 7]

    weakest_principles = [ELITE_PRINCIPLES[k][0] for k, v in report.principle_hit_rate.items() if v < 0.5]
    report.summary = (
        f"Overall readiness {report.overall_confidence}/100 across {len(evaluations)} answers. "
        f"Strongest: {', '.join(report.strengths) or 'n/a'}. "
        f"Focus areas: {', '.join(report.weaknesses) or 'n/a'}. "
        + (f"Elite principles to develop: {', '.join(weakest_principles)}." if weakest_principles else
           "Solid coverage of the elite principles.")
    )
    return report
