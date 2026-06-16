"""Persistence layer: sessions, messages, evaluations, credits (PRD §9, §10).

Keeps SQL in one place so the API handlers stay thin.
"""

from __future__ import annotations

import json
from typing import Any

from app.db import query, query_one
from app.schemas import AnswerEvaluation, SessionReport


# --- credits ---------------------------------------------------------------------
def get_balance(user_id: str) -> int:
    row = query_one("select balance from public.credits where user_id = %s", (user_id,))
    return int(row["balance"]) if row else 0


def adjust_credits(user_id: str, delta: int) -> int:
    row = query_one(
        "insert into public.credits (user_id, balance) values (%s, %s) "
        "on conflict (user_id) do update set balance = public.credits.balance + %s "
        "returning balance",
        (user_id, max(delta, 0), delta),
    )
    return int(row["balance"]) if row else 0


def try_deduct_credit(user_id: str) -> bool:
    """Atomically deduct one credit; return False if balance is insufficient."""
    row = query_one(
        "update public.credits set balance = balance - 1 "
        "where user_id = %s and balance > 0 returning balance",
        (user_id,),
    )
    return row is not None


# --- sessions --------------------------------------------------------------------
def create_session(user_id: str, config: dict) -> str:
    row = query_one(
        "insert into public.sessions (user_id, config, stage, status) "
        "values (%s, %s, 1, 'active') returning id",
        (user_id, json.dumps(config)),
    )
    return str(row["id"])


def get_session(session_id: str, user_id: str) -> dict | None:
    return query_one(
        "select * from public.sessions where id = %s and user_id = %s",
        (session_id, user_id),
    )


def update_stage(session_id: str, stage: int) -> None:
    query("update public.sessions set stage = %s where id = %s", (stage, session_id))


def update_config(session_id: str, config: dict) -> None:
    query("update public.sessions set config = %s where id = %s", (json.dumps(config), session_id))


def finish_session(session_id: str, report: dict) -> None:
    query(
        "update public.sessions set status = 'completed', ended_at = now(), report = %s where id = %s",
        (json.dumps(report), session_id),
    )


def list_sessions(user_id: str) -> list[dict]:
    return query(
        "select id, config, stage, status, started_at, ended_at, "
        "  (report->>'overall_confidence') as overall_confidence "
        "from public.sessions where user_id = %s order by started_at desc limit 50",
        (user_id,),
    )


# --- messages --------------------------------------------------------------------
def add_message(session_id: str, sender: str, stage: int, lens: str, content: str, kind: str = "turn") -> str:
    row = query_one(
        "insert into public.messages (session_id, sender, stage, lens, content, kind) "
        "values (%s, %s, %s, %s, %s, %s) returning id",
        (session_id, sender, stage, lens, content, kind),
    )
    return str(row["id"])


def get_messages(session_id: str) -> list[dict]:
    return query(
        "select id, sender, stage, lens, content, kind, created_at "
        "from public.messages where session_id = %s order by created_at",
        (session_id,),
    )


# --- evaluations -----------------------------------------------------------------
def add_evaluation(message_id: str, session_id: str, ev: AnswerEvaluation) -> None:
    query(
        "insert into public.evaluations "
        "(message_id, session_id, scores, principles, confidence, stronger_answer, missed_concepts, star_notes, to_improve) "
        "values (%s, %s, %s, %s, %s, %s, %s, %s, %s)",
        (
            message_id, session_id, json.dumps(ev.scores), json.dumps(ev.principles),
            ev.confidence_score, ev.stronger_answer, json.dumps(ev.missed_concepts), ev.star_notes,
            ev.to_improve,
        ),
    )


def get_evaluations(session_id: str) -> list[dict]:
    return query(
        "select message_id, scores, principles, confidence, stronger_answer, missed_concepts, star_notes, to_improve "
        "from public.evaluations where session_id = %s order by created_at",
        (session_id,),
    )


def evaluations_as_objects(session_id: str) -> list[AnswerEvaluation]:
    """Reconstruct AnswerEvaluation objects from stored rows (for the end report)."""
    out: list[AnswerEvaluation] = []
    for r in get_evaluations(session_id):
        out.append(
            AnswerEvaluation(
                scores=_as_dict(r["scores"]),
                principles=_as_dict(r["principles"]),
                confidence_score=int(r["confidence"] or 0),
                stronger_answer=r.get("stronger_answer") or "",
                missed_concepts=_as_list(r.get("missed_concepts")),
                star_notes=r.get("star_notes") or "",
                to_improve=r.get("to_improve") or "",
            )
        )
    return out


# --- admin -----------------------------------------------------------------------
def admin_list_users() -> list[dict]:
    return query(
        "select p.id, p.email, p.is_admin, p.created_at, coalesce(c.balance,0) as balance "
        "from public.profiles p left join public.credits c on c.user_id = p.id "
        "order by p.created_at desc limit 200"
    )


def admin_list_sessions() -> list[dict]:
    return query(
        "select id, user_id, config, stage, status, started_at, ended_at "
        "from public.sessions order by started_at desc limit 200"
    )


# --- helpers ---------------------------------------------------------------------
def _as_dict(v: Any) -> dict:
    if isinstance(v, dict):
        return v
    if isinstance(v, str):
        try:
            return json.loads(v)
        except json.JSONDecodeError:
            return {}
    return {}


def _as_list(v: Any) -> list:
    if isinstance(v, list):
        return v
    if isinstance(v, str):
        try:
            return json.loads(v)
        except json.JSONDecodeError:
            return []
    return []
