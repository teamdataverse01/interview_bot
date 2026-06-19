"""Shared data models for the interview engine (PRD §4, §9).

Plain dataclasses (not Pydantic) so the engine stays import-light and testable offline; the
FastAPI layer (M4) will wrap these with Pydantic request/response models at the edge.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from enum import IntEnum


class Stage(IntEnum):
    """The 5 interview stages (PRD §4.2). Ordered so progression is just `stage + 1`."""

    INTRODUCTION = 1       # Background & calibration
    EXPERIENCE = 2         # Programs built, scale, automation
    TECHNICAL = 3          # Scenario deep-dive driven by the selected interview type
    BEHAVIORAL = 4         # Conflict, stakeholder mgmt, change management, prioritization
    REVERSE_AND_CLOSE = 5  # Candidate asks; persona answers in-character; wrap


STAGE_META: dict[Stage, dict] = {
    Stage.INTRODUCTION: {
        "name": "Introduction & Calibration",
        "goal": "Open warmly in-character; get the candidate's background and calibrate level/scope.",
        "seed": "Tell me about your background and the privacy programs you've owned.",
    },
    Stage.EXPERIENCE: {
        "name": "Experience & Programs",
        "goal": "Probe real programs, scale, automation, and measurable business impact.",
        "seed": "Walk me through a privacy program you built and the impact it had.",
    },
    Stage.TECHNICAL: {
        "name": "Technical / Scenario Deep-Dive",
        "goal": "Drill into the selected interview type with a concrete scenario; switch lens to test depth.",
        "seed": "Let's go deep on a scenario.",
    },
    Stage.BEHAVIORAL: {
        "name": "Behavioral & Leadership",
        "goal": "Test conflict, stakeholder diplomacy, change management, and prioritization under ambiguity.",
        "seed": "Tell me about a time you drove change against real resistance.",
    },
    Stage.REVERSE_AND_CLOSE: {
        "name": "Reverse Interview & Close",
        "goal": "Invite the candidate's questions and answer them in-character, then close the loop.",
        "seed": "What questions do you have for me?",
    },
}


@dataclass
class SessionConfig:
    """The user's interview composition (Subsystem A, PRD §3)."""

    role: str = "Data Privacy Program Manager"
    industry: str = "Social Media"
    level: str = "Director"               # IC | Manager | Director | VP
    scale: str = "Multi-project"
    persona_key: str = "generic"          # generic (company-neutral) | netflix | tiktok | strava
    interview_type: str = "Incident response"
    difficulty: str = "Senior"            # Foundational | Intermediate | Senior | Executive (FAANG bar)
    mode: str = "Practice"                # Practice (inline feedback) | Realistic (feedback at end)

    @property
    def company_mode(self) -> bool:
        """True only when the user explicitly picked a specific company (not 'generic')."""
        return (self.persona_key or "generic").lower() != "generic"

    @property
    def inline_feedback(self) -> bool:
        """Show feedback after every answer? (Practice mode). Accepts legacy 'Coached'."""
        return (self.mode or "").lower() in ("practice", "coached")

    @classmethod
    def from_dict(cls, d: dict) -> "SessionConfig":
        """Build from a stored/posted dict, ignoring unknown keys."""
        fields = {f for f in cls.__dataclass_fields__}
        return cls(**{k: v for k, v in (d or {}).items() if k in fields})

    def to_dict(self) -> dict:
        return {
            "role": self.role, "industry": self.industry, "level": self.level,
            "scale": self.scale, "persona_key": self.persona_key,
            "interview_type": self.interview_type, "difficulty": self.difficulty, "mode": self.mode,
        }


# Round-based pacing (Temi feedback §3A): pause every ROUND_SIZE real questions for a round
# summary + continue/switch-topic choice.
ROUND_SIZE = 4


# How many question "slots" each stage gets, scaled by difficulty (more = longer, harder).
DIFFICULTY_SLOTS: dict[str, dict[Stage, int]] = {
    "Beginner":     {Stage.INTRODUCTION: 1, Stage.EXPERIENCE: 1, Stage.TECHNICAL: 2, Stage.BEHAVIORAL: 1, Stage.REVERSE_AND_CLOSE: 1},
    "Intermediate": {Stage.INTRODUCTION: 1, Stage.EXPERIENCE: 2, Stage.TECHNICAL: 2, Stage.BEHAVIORAL: 2, Stage.REVERSE_AND_CLOSE: 1},
    "Senior":       {Stage.INTRODUCTION: 1, Stage.EXPERIENCE: 2, Stage.TECHNICAL: 3, Stage.BEHAVIORAL: 3, Stage.REVERSE_AND_CLOSE: 2},
    "Executive (FAANG bar)": {Stage.INTRODUCTION: 1, Stage.EXPERIENCE: 2, Stage.TECHNICAL: 4, Stage.BEHAVIORAL: 3, Stage.REVERSE_AND_CLOSE: 2},
}

# How the interviewer should pitch questions at each difficulty (Temi §3 — Beginner was too hard).
# Injected into the interviewer + evaluator prompts so the level genuinely changes the experience.
DIFFICULTY_GUIDANCE: dict[str, str] = {
    "Beginner": (
        "DIFFICULTY = BEGINNER. The candidate is NEW to privacy. Ask plain-language, single-concept "
        "questions about fundamentals (what a term means, why it matters, a basic 'what would you do'). "
        "ALWAYS expand an acronym the first time you use it, e.g. 'a DSAR (Data Subject Access Request)'. "
        "NO multi-part scenarios, NO obscure edge cases, NO heavy jargon, NO 'at scale / automation / "
        "cross-functional' expectations. One short, approachable question at a time. Be warm and encouraging."
    ),
    "Intermediate": (
        "DIFFICULTY = INTERMEDIATE. Working knowledge. Single-threaded scenario questions are fine. "
        "Light jargon is OK but briefly clarify any niche term. Expect a clear process, not deep edge cases."
    ),
    "Senior": (
        "DIFFICULTY = SENIOR. Experienced practitioner. Multi-part scenarios, lens switching, and probing "
        "follow-ups are expected. Push for depth, trade-offs, and measurable impact."
    ),
    "Executive (FAANG bar)": (
        "DIFFICULTY = EXECUTIVE (FAANG bar). Demanding. Ambiguous, high-stakes scenarios; expect automation, "
        "scale, defensibility, and cross-functional strategy. Probe hard and do not accept surface answers."
    ),
}


def difficulty_guidance(difficulty: str) -> str:
    return DIFFICULTY_GUIDANCE.get(difficulty, DIFFICULTY_GUIDANCE["Senior"])


@dataclass
class Turn:
    """One utterance in the interview transcript."""

    sender: str       # interviewer | candidate
    content: str
    stage: int
    lens: str = "mixed"


@dataclass
class InterviewerTurn:
    """Structured output the interviewer model returns each turn (parsed from JSON)."""

    question: str
    action: str = "probe"          # probe | advance | switch_lens | close
    lens: str = "mixed"            # operational | programmatic | mixed
    competency: str = ""           # competency this question targets (for memory)
    rationale: str = ""            # internal note (not shown to candidate)


# --- Evaluation Engine (Subsystem C, PRD §5) -------------------------------------

# The 8 core scoring dimensions (her "Metrics used to Evaluate"), key -> label.
SCORE_DIMENSIONS: dict[str, str] = {
    "clarity": "Clarity",
    "structure": "Structure (STAR / framework)",
    "privacy_terminology": "Privacy terminology",
    "confidence": "Confidence",
    "risk_reasoning": "Risk-based reasoning",
    "regulatory_understanding": "Regulatory understanding",
    "business_alignment": "Business alignment",
    "org_context": "Org-context awareness",
}

# The 6 Elite Principles (her "Interview Blueprint"), key -> (label, what it rewards).
ELITE_PRINCIPLES: dict[str, tuple[str, str]] = {
    "enterprise_scale": ("Enterprise-Scale (Efficiency over Budget)", "efficiency/automation/scale; NOT budget-saving"),
    "automation": ("Technological (Proactive Automation)", "automated architectures; NOT manual toil/headcount"),
    "cognitive": ("Cognitive (Thought process + cross-pollination)", "numbered ground-up reasoning + outside-industry analogies"),
    "chaos": ("Chaos (Ambiguity & nimble pivots)", "crisis narratives, risk-acceptance waivers, pilots, re-prioritization"),
    "collaboration": ("Collaboration (Cross-functional diplomacy)", "mapping decision-makers; synthesizing Legal/Eng/Product into one roadmap"),
    "operational_enabler": ("Operational (Compliance as a business enabler)", "compliance reframed as velocity/trust/cost; NOT a checklist"),
}


@dataclass
class AnswerEvaluation:
    """Per-answer scorecard returned by the Evaluation Engine (PRD §5.3)."""

    scores: dict[str, int] = field(default_factory=dict)          # dimension -> 0..10
    rationale: dict[str, str] = field(default_factory=dict)       # dimension -> one-line why
    principles: dict[str, bool] = field(default_factory=dict)     # principle -> hit?
    principle_notes: str = ""
    confidence_score: int = 0                                     # overall 0..100
    stronger_answer: str = ""
    missed_concepts: list[str] = field(default_factory=list)
    star_notes: str = ""
    to_improve: str = ""                                           # gap analysis: what gets this to 100

    @property
    def avg_score(self) -> float:
        vals = list(self.scores.values())
        return round(sum(vals) / len(vals), 1) if vals else 0.0


@dataclass
class SessionReport:
    """End-of-session aggregate report."""

    overall_confidence: int = 0
    dimension_averages: dict[str, float] = field(default_factory=dict)
    principle_hit_rate: dict[str, float] = field(default_factory=dict)
    strengths: list[str] = field(default_factory=list)
    weaknesses: list[str] = field(default_factory=list)
    answers_evaluated: int = 0
    summary: str = ""
    next_focus: str = ""                    # gap analysis: the path toward a higher score
