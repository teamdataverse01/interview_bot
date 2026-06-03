"""The AI interviewer (PRD §4.1, §4.3).

Assembles the interviewer system prompt from: persona DNA + the user's session config +
the state manager's phase directive + RAG exemplars pulled from the real transcripts, then
asks the LLM for the next turn as strict JSON.

This module is where Elizabeth's behavior rules ("tennis match," one question at a time,
operational/programmatic lens, read the room) are encoded into the model's instructions.
"""

from __future__ import annotations

import json

from app.llm import LLMError, chat_json
from app.personas import Persona
from app.schemas import InterviewerTurn, SessionConfig, Stage
from app.state_manager import InterviewSession
from knowledge.retriever import KnowledgeBase

# One shared KB instance (loaded once).
_KB: KnowledgeBase | None = None


def _kb() -> KnowledgeBase:
    global _KB
    if _KB is None:
        _KB = KnowledgeBase()
    return _KB


# The non-negotiable behavior rules (PRD §4.3), shared by every persona.
_BEHAVIOR_RULES = """\
INTERVIEWER BEHAVIOR RULES (follow strictly):
- Ask EXACTLY ONE question per turn. An interview is a tennis match, not a monologue. Then stop.
- Stay in character for the company culture at all times. Be realistic, not robotic or chatty.
- Listen for the pivot: if the last answer was strong and complete, move on; if it was shallow or
  evasive, probe the specific weak point. Do not accept vague answers.
- Use the right lens. OPERATIONAL = the "how" (workflows, triage, intake, queues, scripts, SLAs).
  PROGRAMMATIC = the "big picture" (risk registers, multi-quarter roadmaps, steering committees,
  policy-to-law alignment). Judge the answer on the lens you are testing.
- Read the room: frame questions around this team's likely reality and the 360 compliance compass
  (Business wants velocity, Customers want trust/UX, Leadership wants defensibility).
- NEVER repeat a question already asked (a list of asked questions is provided). No multi-part
  question dumps. Keep each question tight and answerable.
"""

_OUTPUT_CONTRACT = """\
Return ONLY a JSON object with these keys:
{
  "question": "the exact words you say to the candidate this turn (one question, in character)",
  "action": "probe | advance | switch_lens | close",
  "lens": "operational | programmatic | mixed",
  "competency": "short tag for what this question tests, e.g. 'risk-reasoning'",
  "rationale": "one short internal note on why you asked this (not shown to the candidate)"
}
"""


def _persona_block(p: Persona) -> str:
    return (
        f"You ARE a {p.company} interviewer.\n"
        f"Voice: {p.system_voice}\n"
        f"Cultural values you embody: {', '.join(p.values)}.\n"
        f"You REWARD answers that show: {', '.join(p.rewards)}.\n"
        f"You are ALLERGIC to: {', '.join(p.penalizes)}.\n"
        f"Culture cues to surface: {', '.join(p.culture_cues)}."
    )


def _config_block(c: SessionConfig) -> str:
    return (
        f"Candidate is interviewing for: {c.role} ({c.level}) in {c.industry}, scope: {c.scale}.\n"
        f"Interview type focus: {c.interview_type}. Difficulty: {c.difficulty}."
    )


def _exemplar_block(session: InterviewSession, query: str) -> str:
    """Retrieve real transcript exemplars to ground the question style (RAG)."""
    kb = _kb()
    company = session.persona.company if session.persona.key != "generic" else None
    # Pull interviewer-style questions first; fall back to candidate exemplars for substance.
    hits = kb.search(
        query,
        company=company,
        interview_type=session.config.interview_type,
        top_k=3,
    )
    if not hits:
        hits = kb.search(query, interview_type=session.config.interview_type, top_k=3)
    if not hits:
        return "No transcript exemplars matched; rely on the persona and rules."
    lines = []
    for h in hits:
        lines.append(f"- ({h.company}/{h.lens}) Q: {h.question[:200]}")
    return (
        "Real interview exemplars from this company/topic (use them to calibrate the STYLE and "
        "DEPTH of your question — do NOT copy verbatim):\n" + "\n".join(lines)
    )


def build_system_prompt(session: InterviewSession, query: str) -> str:
    p = session.persona
    return "\n\n".join(
        [
            _persona_block(p),
            _config_block(session.config),
            _BEHAVIOR_RULES,
            _exemplar_block(session, query),
            _OUTPUT_CONTRACT,
        ]
    )


def _directive_with_memory(session: InterviewSession) -> str:
    directive = session.phase_directive()
    asked = session.state.asked_questions
    if asked:
        recent = "\n".join(f"  - {q[:120]}" for q in asked[-6:])
        directive += f"\n\nQuestions ALREADY asked (never repeat these):\n{recent}"
    directive += f"\n\nCurrent default lens: {session.state.lens}."
    return directive


def next_turn(session: InterviewSession) -> InterviewerTurn:
    """Generate the interviewer's next turn from current state."""
    # Query for RAG grounding = last candidate answer, else the stage goal/seed.
    last_candidate = next(
        (t.content for t in reversed(session.state.transcript) if t.sender == "candidate"),
        None,
    )
    from app.schemas import STAGE_META

    query = last_candidate or STAGE_META[session.state.stage]["seed"]

    system = build_system_prompt(session, query)
    messages = [{"role": "system", "content": system}]
    messages += session.history_for_prompt()
    messages.append({"role": "user", "content": _directive_with_memory(session)})

    try:
        data = chat_json(messages, max_tokens=500, temperature=0.7)
    except LLMError:
        raise

    turn = InterviewerTurn(
        question=str(data.get("question", "")).strip(),
        action=str(data.get("action", "probe")).strip().lower(),
        lens=str(data.get("lens", session.state.lens)).strip().lower(),
        competency=str(data.get("competency", "")).strip(),
        rationale=str(data.get("rationale", "")).strip(),
    )

    # Enforce deterministic stage control: honor 'advance' only when the manager allows it,
    # and force advancement when a stage is exhausted (the model cannot stall or skip).
    if session.state.transcript:  # not the opening turn
        if session.state.stage == Stage.REVERSE_AND_CLOSE and session.stage_is_exhausted():
            turn.action = "close"  # final stage out of slots -> always close cleanly
        elif turn.action == "advance" and session.can_advance():
            session.advance_stage()
        elif session.can_advance():
            # Model tried to stay but the stage is out of slots -> advance anyway.
            session.advance_stage()
            turn.action = "advance"
    return turn
