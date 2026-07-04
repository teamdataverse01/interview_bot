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
    beginner = config.difficulty == "Beginner"
    if executive:
        gating = (
            "This is an EXECUTIVE (FAANG-bar) interview. The 6 Elite Principles are HARD GATES: for "
            "each principle the answer misses, lower the confidence_score substantially. A great-sounding "
            "answer that ignores automation/scale or treats compliance as a checklist CANNOT score high."
        )
    elif beginner:
        gating = (
            "This is a BEGINNER interview. Grade ENCOURAGINGLY and against a beginner bar: reward correct "
            "fundamentals, clear thinking, and good communication. Do NOT penalize for missing automation, "
            "scale, or cross-pollination — those are advanced. The 6 Elite Principles are BONUS only, never "
            "required. A clear, correct, basic answer should score well (70-90). Keep feedback supportive."
        )
    else:
        gating = "Principles here are coaching signals: note misses but they do not hard-cap the score."

    if config.company_mode:
        framing = (
            f"You are a {persona.company} hiring manager AND a strict interview evaluator for Dataverse.\n"
            f"This {persona.company} interviewer specifically REWARDS: {', '.join(persona.rewards)}.\n"
            f"This interviewer is ALLERGIC to: {', '.join(persona.penalizes)}."
        )
        stronger_hint = "a rewritten, stronger version (3-4 sentences) in this company's preferred frame"
    else:
        # Company-neutral evaluation (default) — feedback must be transferable (Temi §1A).
        framing = (
            "You are a seasoned, COMPANY-NEUTRAL privacy hiring manager and strict evaluator for "
            "Dataverse. Keep ALL feedback broadly applicable and transferable across organizations. "
            "Do NOT frame the stronger answer around any specific employer. You may note when a concept "
            "is company-specific (e.g., 'radical candor is a Netflix value') only as a brief aside.\n"
            f"Generally REWARD: {', '.join(persona.rewards)}.\n"
            f"Generally PENALIZE: {', '.join(persona.penalizes)}."
        )
        stronger_hint = "a rewritten, stronger version (3-4 sentences), company-neutral and broadly transferable"

    return f"""\
{framing}
Grade this single candidate answer the way an elite privacy hiring manager would.

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
  "stronger_answer": "{stronger_hint}",
  "missed_concepts": ["up to 4 specific frameworks/regulations/points the answer should have hit"],
  "star_notes": "1-2 sentences: how to restructure this into Situation-Task-Action-Result",
  "to_improve": "ONE specific, concrete change that would move THIS answer closest to 100"
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
        to_improve=str(data.get("to_improve", "")),
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


def build_report(
    evaluations: list[AnswerEvaluation], config: SessionConfig, final: bool = False
) -> SessionReport:
    """Aggregate per-answer evaluations into the end-of-session report (PRD §5.3).

    When `final` is True, also generate the recruiter-style hiring debrief (Temi round-4 §2).
    """
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

    # Gap analysis — the concrete path toward a higher score (Temi §5).
    gap = 100 - report.overall_confidence
    if gap <= 10:
        report.next_focus = "You're at a strong, hire-ready level. Polish delivery and keep answers tight."
    else:
        levers = list(report.weaknesses)
        if weakest_principles:
            levers.append(weakest_principles[0].split(" (")[0].lower())
        report.next_focus = (
            f"To close the {gap}-point gap to 100: strengthen "
            f"{', '.join(levers[:3]) or 'depth and specificity'}. "
            "Lead with measurable business impact, quantified risk reasoning, and an automation/scale angle."
        )

    if final:
        try:
            _attach_hiring_debrief(report, evaluations, config)
        except LLMError:
            # Fallback so the report still renders without the LLM narrative.
            report.recommendation = _recommendation_band(report.overall_confidence)
            report.did_well = report.strengths[:3]
            report.held_back = report.weaknesses[:3]
    return report


def _recommendation_band(overall: int) -> str:
    if overall >= 80:
        return "Strong Hire"
    if overall >= 60:
        return "Hire"
    if overall >= 40:
        return "Hire with Reservations"
    return "No Hire"


def _attach_hiring_debrief(report: SessionReport, evaluations: list[AnswerEvaluation], config: SessionConfig) -> None:
    """Generate a recruiter-style debrief and attach it to the report (Temi round-4 §2)."""
    overall = report.overall_confidence
    band = _recommendation_band(overall)
    missed = sorted({m for e in evaluations for m in e.missed_concepts})[:8]
    strong = ", ".join(report.strengths) or "clear communication"
    weak = ", ".join(report.weaknesses) or "depth and specificity"

    system = (
        "You are an experienced hiring manager writing your post-interview debrief for a privacy/"
        "compliance candidate. Write like a recruiter's real hiring notes — direct, human, specific. "
        "Do NOT use numeric scores anywhere in your output.\n"
        f"Internal signal (do not mention numbers): overall readiness ~{overall}/100, so your "
        f"recommendation MUST be '{band}'. Only ever use 'No Hire' when readiness is below 40.\n"
        f"Observed strengths: {strong}. Observed weaknesses: {weak}. "
        f"Missed/likely-missed points: {', '.join(missed) or 'n/a'}.\n"
        "Return ONLY this JSON:\n"
        "{\n"
        f'  "recommendation": "{band}",\n'
        '  "debrief_intro": "1-2 warm, personal sentences addressed to the candidate, as if debriefing them",\n'
        '  "did_well": ["3-4 specific strengths they demonstrated"],\n'
        '  "held_back": ["3-4 specific things that reduced hiring confidence, e.g. answers lacked structure, '
        'didn\'t quantify impact, too generic, missed leadership examples, weak stakeholder communication"],\n'
        '  "how_to_improve": ["3-4 practical, actionable coaching tips"],\n'
        '  "absolute_hire": "2-3 sentences: exactly what would elevate them to an absolute, no-doubt hire"\n'
        "}"
    )
    data = chat_json(
        [
            {"role": "system", "content": system},
            {"role": "user", "content": f"Interview: {config.interview_type} · {config.role} ({config.level})."},
        ],
        max_tokens=900,
        temperature=0.5,
    )
    rec = str(data.get("recommendation", band)).strip()
    # Enforce the rule: No Hire only below 40.
    if overall >= 40 and rec.lower().startswith("no hire"):
        rec = "Hire with Reservations"
    report.recommendation = rec or band
    report.debrief_intro = str(data.get("debrief_intro", ""))
    report.did_well = [str(x) for x in (data.get("did_well") or [])][:5]
    report.held_back = [str(x) for x in (data.get("held_back") or [])][:5]
    report.how_to_improve = [str(x) for x in (data.get("how_to_improve") or [])][:5]
    report.absolute_hire = str(data.get("absolute_hire", ""))


def model_answer(config: SessionConfig, question: str) -> dict:
    """Answer Bank (Temi follow-up): generate a strong model answer to an imported question.

    Returns {answer, key_points[], principles_demonstrated[], coaching_note}. Company-neutral
    unless the user is in an explicit company mode.
    """
    persona = _persona_for(config)
    company_clause = (
        f"Frame the answer for a {persona.company} interview."
        if config.company_mode
        else "Keep the answer company-neutral and broadly transferable across organizations."
    )
    system = (
        "You are an elite privacy-career interview coach for Dataverse. Given an interview question, "
        "write a model answer a top candidate would give. " + company_clause + " Ground it in real "
        "privacy practice (DSAR/DPIA/RoPA, GDPR/CCPA, risk registers, automation, cross-functional "
        "diplomacy) and the STAR structure where it fits.\n"
        f"{_gold_block(config)}"
        "Return ONLY this JSON:\n"
        "{\n"
        '  "answer": "a strong, structured model answer (5-8 sentences)",\n'
        '  "key_points": ["3-5 bullet points the answer hits"],\n'
        '  "principles_demonstrated": ["which of: efficiency-over-budget, automation, cross-pollination, '
        'ambiguity/pivots, collaboration, compliance-as-enabler"],\n'
        '  "coaching_note": "1 sentence on how to deliver it well"\n'
        "}"
    )
    messages = [
        {"role": "system", "content": system},
        {"role": "user", "content": f"INTERVIEW QUESTION:\n{question}"},
    ]
    data = chat_json(messages, max_tokens=900, temperature=0.4)
    return {
        "question": question,
        "answer": str(data.get("answer", "")),
        "key_points": [str(x) for x in (data.get("key_points") or [])][:6],
        "principles_demonstrated": [str(x) for x in (data.get("principles_demonstrated") or [])][:6],
        "coaching_note": str(data.get("coaching_note", "")),
    }


def _persona_for(config: SessionConfig) -> Persona:
    from app.personas import get_persona

    return get_persona(config.persona_key)
