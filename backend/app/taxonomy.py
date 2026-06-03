"""Configuration taxonomy — the exact lists Elizabeth defined in `Interview transcript.docx`.

This is the single source of truth for what a user can pick when composing an interview
(PRD §3). It is served to the frontend via `GET /config` and used to filter RAG retrieval.

Keep these lists verbatim to her document. If she adds a category, add it here only.
"""

from __future__ import annotations

# --- Subsystem A: Configuration Taxonomy (PRD §3) ---------------------------------

INDUSTRIES: list[str] = [
    "FinTech",
    "Financial Institutions",
    "Academic Institutions",
    "Tech Companies",
    "FAANG",
    "Automobile / Transportation",
    "Government",
    "Entertainment",
    "Social Media",
    "Consulting",
    "AdTech",
]

ROLES: list[str] = [
    "Data Privacy Compliance Manager",
    "Data Governance",
    "Risk Analyst",
    "Data Privacy Program Manager",
    "Data Privacy Engineer",
    "Privacy Legal Counsel",
    "Data Protection Officer (DPO)",
]

LEVELS: list[str] = ["IC", "Manager", "Director", "VP"]

SCALES: list[str] = ["Multi-project", "One project", "Company capacity"]

# Interview types split into Technical and Behavioral families (her two lists).
TECHNICAL_TYPES: list[str] = [
    "DSAR",
    "DPIA",
    "RoPA",
    "Incident response",
    "Consent management",
    "Retention / deletion",
    "Vendor risk",
    "Policy lifecycle",
    "Privacy engineering",
    "Data flows",
    "Cookies / tracking",
    "AI governance",
    "Automation",
]

BEHAVIORAL_TYPES: list[str] = [
    "Conflict resolution",
    "Stakeholder management",
    "Prioritization",
    "Program building / management",
    "Leadership",
    "Risk management",
    "Executive communication",
    "Security / Engineering alignment",
    "Business alignment",
    "Change management",
]

INTERVIEW_TYPES: list[str] = TECHNICAL_TYPES + BEHAVIORAL_TYPES

DIFFICULTIES: list[str] = [
    "Foundational",
    "Intermediate",
    "Senior",
    "Executive (FAANG bar)",
]

RUN_MODES: list[str] = ["Coached", "Real"]  # PRD §6


# --- Keyword classifiers (used by the ingestion pipeline to auto-tag transcript chunks) ---
# Maps a taxonomy interview-type to the lowercase keywords that signal it in transcript text.
TYPE_KEYWORDS: dict[str, list[str]] = {
    "DSAR": ["dsar", "data subject access", "data subject rights", "download your information", "access request"],
    "DPIA": ["dpia", "data protection impact", "pia", "privacy impact"],
    "RoPA": ["ropa", "record of processing", "records of processing"],
    "Incident response": ["incident", "breach", "exposure", "data exposed", "data leak"],
    "Consent management": ["consent", "opt-in", "opt out", "cookie consent"],
    "Retention / deletion": ["retention", "deletion", "purge", "data lifecycle", "stale records"],
    "Vendor risk": ["vendor", "third-party", "third party", "supplier", "external vendor"],
    "Policy lifecycle": ["policy", "standard", "baseline standards", "policies"],
    "Privacy engineering": ["privacy-by-design", "privacy by design", "sdlc", "engineering review", "ci/cd"],
    "Data flows": ["data flow", "data lineage", "lineage", "data map", "data pipeline"],
    "Cookies / tracking": ["cookie", "tracking", "pixel", "tag"],
    "AI governance": ["ai governance", "ai compliance", "ai feature", "model", "automation models"],
    "Automation": ["automat", "automated", "triage script", "self-service", "pipeline"],
    "Conflict resolution": ["disagree", "disagreement", "conflict", "pushback", "wrong in this"],
    "Stakeholder management": ["stakeholder", "cross-functional", "xfn", "decision maker", "buy-in"],
    "Prioritization": ["prioritiz", "priorit", "okr", "roadmap", "p0", "quarterly goals"],
    "Program building / management": ["program", "build out", "scale a privacy", "framework"],
    "Leadership": ["leader", "leadership", "manage", "morale", "coaching", "career"],
    "Risk management": ["risk register", "risk assessment", "risk score", "risk-based", "risk matrix"],
    "Executive communication": ["executive", "cto", "ceo", "translate", "translation", "leadership audience"],
    "Security / Engineering alignment": ["security", "engineering", "engineers", "infrastructure"],
    "Business alignment": ["business goals", "business value", "business driver", "operational effectiveness"],
    "Change management": ["culture shift", "change management", "change trigger", "reorg", "pivot", "migration"],
}

# Operational vs Programmatic lens signals (PRD §4.3).
OPERATIONAL_KEYWORDS = [
    "workflow", "triage", "intake", "queue", "day-to-day", "execution", "script",
    "ticket", "sla", "template", "manual", "hands-on", "operational",
]
PROGRAMMATIC_KEYWORDS = [
    "roadmap", "risk register", "steering committee", "multi-quarter", "governance",
    "strategy", "policy", "framework", "okr", "programmatic", "macro", "enterprise",
]

# Company -> persona key + industry (used to tag transcript origin).
COMPANY_INDUSTRY: dict[str, str] = {
    "TikTok": "Social Media",
    "Netflix": "Entertainment",
    "Strava": "Tech Companies",
    "Meta": "Social Media",
}


def config_payload() -> dict:
    """The full taxonomy returned by `GET /config` to drive the frontend pickers."""
    return {
        "industries": INDUSTRIES,
        "roles": ROLES,
        "levels": LEVELS,
        "scales": SCALES,
        "interview_types": {
            "technical": TECHNICAL_TYPES,
            "behavioral": BEHAVIORAL_TYPES,
        },
        "difficulties": DIFFICULTIES,
        "modes": RUN_MODES,
    }
