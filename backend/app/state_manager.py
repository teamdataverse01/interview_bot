"""Interview State Manager (PRD §4.2 — build this FIRST).

Owns the authoritative interview state so the conversation behaves like a real structured
interview, not free chat. The LLM phrases questions; the state manager decides *when* the
interview may advance a stage, what the current focus is, and remembers everything so the
interviewer never repeats itself ("Session Memory", PRD §7).

Division of responsibility:
  * State manager (deterministic)  -> stage progression, slot counting, memory, lens default.
  * Interviewer model (generative) -> phrasing, probing depth, in-character voice (interviewer.py).
"""

from __future__ import annotations

from dataclasses import dataclass, field

from app.personas import Persona, get_persona
from app.schemas import (
    DIFFICULTY_SLOTS,
    ROUND_PLAN,
    ROUND_SIZE,
    STAGE_META,
    InterviewerTurn,
    SessionConfig,
    Stage,
    Turn,
)


@dataclass
class InterviewState:
    config: SessionConfig
    stage: Stage = Stage.INTRODUCTION
    questions_in_stage: int = 0
    lens: str = "programmatic"
    transcript: list[Turn] = field(default_factory=list)
    asked_questions: list[str] = field(default_factory=list)
    covered_competencies: list[str] = field(default_factory=list)
    strengths: list[str] = field(default_factory=list)
    weaknesses: list[str] = field(default_factory=list)
    finished: bool = False


class InterviewSession:
    """Drives one interview from open to close."""

    def __init__(self, config: SessionConfig):
        self.config = config
        self.persona: Persona = get_persona(config.persona_key)
        self.slots = DIFFICULTY_SLOTS.get(config.difficulty, DIFFICULTY_SLOTS["Senior"])
        self.state = InterviewState(config=config)

    # --- progression rules ----------------------------------------------------------
    def _slots_for(self, stage: Stage) -> int:
        return self.slots.get(stage, 2)

    def stage_is_exhausted(self) -> bool:
        """True when the current stage has used all its question slots."""
        return self.state.questions_in_stage >= self._slots_for(self.state.stage)

    def can_advance(self) -> bool:
        return self.stage_is_exhausted() and self.state.stage < Stage.REVERSE_AND_CLOSE

    def advance_stage(self) -> None:
        if self.state.stage < Stage.REVERSE_AND_CLOSE:
            self.state.stage = Stage(self.state.stage + 1)
            self.state.questions_in_stage = 0
            # Default lens flips toward operational in the technical deep-dive.
            self.state.lens = "operational" if self.state.stage == Stage.TECHNICAL else "programmatic"

    # --- memory ---------------------------------------------------------------------
    def record_interviewer(self, turn: InterviewerTurn) -> None:
        self.state.transcript.append(
            Turn(sender="interviewer", content=turn.question, stage=int(self.state.stage), lens=turn.lens)
        )
        self.state.asked_questions.append(turn.question)
        comp = turn.competency.strip().lower().replace(" ", "-") if turn.competency else ""
        if comp and comp not in self.state.covered_competencies:
            self.state.covered_competencies.append(comp)
        self.state.questions_in_stage += 1
        self.state.lens = turn.lens or self.state.lens
        if turn.action == "close":
            self.state.finished = True

    def record_candidate(self, answer: str) -> None:
        self.state.transcript.append(
            Turn(sender="candidate", content=answer, stage=int(self.state.stage), lens=self.state.lens)
        )

    # --- directive for the interviewer model ---------------------------------------
    def phase_directive(self) -> str:
        """Instruction telling the interviewer what KIND of question to ask this turn.

        Each round follows a fixed plan (Temi round-4): intro → privacy → privacy → behavioral.
        """
        opening = not self.state.transcript
        topic = self.config.interview_type

        # Close backstop: once the final stage is exhausted, wrap up.
        if self.state.stage == Stage.REVERSE_AND_CLOSE and self.stage_is_exhausted() and not opening:
            return (
                "CLOSE the interview now: thank the candidate warmly in character and end. "
                "Set action='close'. Do not ask another question."
            )

        # Position of the NEXT question within its round, and the round number.
        asked = self.questions_asked
        pos = asked % ROUND_SIZE
        rnd = asked // ROUND_SIZE + 1
        slot = ROUND_PLAN[pos] if pos < len(ROUND_PLAN) else "privacy"

        if opening or (slot == "intro" and rnd == 1):
            return (
                "OPENING turn. Greet the candidate warmly in character, then ask the classic "
                "'Tell me about yourself and your background in data privacy.' One question only."
            )

        if slot == "intro":
            return (
                f"Start of ROUND {rnd}. Briefly re-orient, then ask a short warm-up/background question "
                f"that opens a NEW area of data privacy (e.g. a different domain than earlier). One question."
            )

        if slot == "privacy":
            return (
                f"Ask ONE data-privacy question in the area of '{topic}' (or a closely related privacy "
                f"area such as DSAR, DPIA, RoPA, consent, retention, incident response, or vendor risk). "
                f"Make it concrete and answerable. Probe for specifics. One question only."
            )

        # behavioral
        return (
            "Ask ONE behavioral question — pick from conflict resolution, stakeholder management, "
            "leadership, prioritization, or change management. Ask for a specific past example (STAR). "
            "One question only."
        )

    def _next_lens(self) -> str:
        return "operational" if self.state.stage == Stage.TECHNICAL else self.state.lens

    # --- rounds (Temi §3A) ----------------------------------------------------------
    @property
    def questions_asked(self) -> int:
        """Total real interview questions asked so far (excludes clarifications)."""
        return len(self.state.asked_questions)

    @property
    def current_round(self) -> int:
        return max(1, (self.questions_asked - 1) // ROUND_SIZE + 1)

    @property
    def question_in_round(self) -> int:
        """1-based index of the most recent question within its round (1..ROUND_SIZE)."""
        n = self.questions_asked
        return ((n - 1) % ROUND_SIZE) + 1 if n else 0

    def at_round_boundary(self) -> bool:
        """True right after a round's last (ROUND_SIZE-th) question has been answered."""
        return self.questions_asked > 0 and self.questions_asked % ROUND_SIZE == 0

    def switch_topic(self, new_type: str) -> None:
        """Begin a fresh technical round on a new interview type (Temi §3A switch-topic)."""
        self.config.interview_type = new_type
        self.state.config.interview_type = new_type
        if self.state.stage >= Stage.TECHNICAL:
            self.state.stage = Stage.TECHNICAL
            self.state.questions_in_stage = 0
            self.state.lens = "operational"

    # --- convenience ----------------------------------------------------------------
    def history_for_prompt(self, max_turns: int = 10) -> list[dict[str, str]]:
        """Recent transcript as chat messages (candidate=user, interviewer=assistant)."""
        msgs: list[dict[str, str]] = []
        for t in self.state.transcript[-max_turns:]:
            role = "assistant" if t.sender == "interviewer" else "user"
            msgs.append({"role": role, "content": t.content})
        return msgs

    @property
    def stage_label(self) -> str:
        return f"Stage {int(self.state.stage)} — {STAGE_META[self.state.stage]['name']}"


def rehydrate_session(config: SessionConfig, stage: int, messages: list[dict]) -> InterviewSession:
    """Rebuild an in-memory InterviewSession from persisted state (for the stateless API).

    `messages` are ordered dicts with keys: sender, stage, lens, content.
    """
    session = InterviewSession(config)
    session.state.stage = Stage(stage)
    for m in messages:
        sender = m["sender"]
        kind = m.get("kind") or "turn"
        session.state.transcript.append(
            Turn(sender=sender, content=m["content"], stage=int(m["stage"]), lens=m.get("lens") or "mixed")
        )
        # Only real interviewer questions count as "asked" (exclude clarifications).
        if sender == "interviewer" and kind != "clarify":
            session.state.asked_questions.append(m["content"])
    # questions_in_stage = real interviewer questions already asked in the current stage.
    session.state.questions_in_stage = sum(
        1 for m in messages
        if m["sender"] == "interviewer" and (m.get("kind") or "turn") != "clarify" and int(m["stage"]) == stage
    )
    # Carry the most recent interviewer (non-clarify) lens.
    for m in reversed(messages):
        if m["sender"] == "interviewer" and (m.get("kind") or "turn") != "clarify":
            session.state.lens = m.get("lens") or session.state.lens
            break
    return session
