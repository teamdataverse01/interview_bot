"""Persistence layer: sessions, messages, evaluations, credits (PRD §9, §10).

Keeps SQL in one place so the API handlers stay thin.
"""

from __future__ import annotations

import json
import secrets
import string
from typing import Any

from app.db import query, query_one
from app.schemas import AnswerEvaluation, SessionReport

# Unambiguous alphabet (no O/0/I/1) for human-friendly demo codes.
_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"


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


# --- demo codes (single-use gate) ------------------------------------------------
def _new_code() -> str:
    return "DV-" + "".join(secrets.choice(_CODE_ALPHABET) for _ in range(6))


def generate_demo_codes(n: int, note: str = "") -> list[str]:
    """Generate and persist `n` fresh single-use demo codes; return them."""
    codes: list[str] = []
    while len(codes) < n:
        code = _new_code()
        row = query_one(
            "insert into public.demo_codes (code, note) values (%s, %s) "
            "on conflict (code) do nothing returning code",
            (code, note),
        )
        if row:
            codes.append(code)
    return codes


def ensure_demo_user(user_id: str) -> None:
    """Create the demo profile with ZERO credits (the one session is created by redeem)."""
    query("insert into public.profiles (id, email) values (%s, 'demo') on conflict (id) do nothing", (user_id,))
    query(
        "insert into public.credits (user_id, balance) values (%s, 0) "
        "on conflict (user_id) do update set balance = 0",
        (user_id,),
    )


def get_demo_code(code: str) -> dict | None:
    return query_one(
        "select code, kind, used_at from public.demo_codes where code = %s", (code,)
    )


def create_master_code(code: str, note: str = "boss master code") -> None:
    """A reusable admin code that unlocks the dashboard with plenty of credits."""
    query(
        "insert into public.demo_codes (code, note, kind) values (%s, %s, 'master') "
        "on conflict (code) do update set kind = 'master'",
        (code, note),
    )


def ensure_master_user(user_id: str) -> None:
    """Admin demo identity with a big credit balance, topped up on every redeem (reusable)."""
    query(
        "insert into public.profiles (id, email, is_admin) values (%s, 'boss', true) "
        "on conflict (id) do update set is_admin = true",
        (user_id,),
    )
    query(
        "insert into public.credits (user_id, balance) values (%s, 9999) "
        "on conflict (user_id) do update set balance = 9999",
        (user_id,),
    )


def claim_demo_code(code: str) -> bool:
    """Atomically mark a code used. Returns False if it's invalid or already used."""
    row = query_one(
        "update public.demo_codes set used_at = now() "
        "where code = %s and used_at is null returning code",
        (code,),
    )
    return row is not None


def attach_demo_session(code: str, session_id: str) -> None:
    query("update public.demo_codes set session_id = %s where code = %s", (session_id, code))


def release_demo_code(code: str) -> None:
    """Roll back a claim if session creation failed after claiming."""
    query("update public.demo_codes set used_at = null where code = %s", (code,))


def admin_list_demo_codes() -> list[dict]:
    return query(
        "select code, note, session_id, used_at, created_at "
        "from public.demo_codes order by created_at desc limit 500"
    )


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


def _scalar(sql: str, params: tuple = ()) -> Any:
    row = query_one(sql, params)
    if not row:
        return None
    return next(iter(row.values()))


def admin_metrics() -> dict:
    """Aggregate platform metrics for the admin dashboard (computable from current data)."""
    dims = [
        "clarity", "structure", "privacy_terminology", "confidence",
        "risk_reasoning", "regulatory_understanding", "business_alignment", "org_context",
    ]
    dim_avg_sql = ", ".join(
        f"round(avg(nullif(scores->>'{d}','')::numeric),1) as {d}" for d in dims
    )
    dimension_averages = query_one(
        f"select {dim_avg_sql} from public.evaluations"
    ) or {}

    return {
        # --- Platform overview ---
        "total_users": _scalar("select count(*) from public.profiles"),
        "signups_today": _scalar("select count(*) from public.profiles where created_at::date = now()::date"),
        "signups_week": _scalar("select count(*) from public.profiles where created_at > now() - interval '7 days'"),
        "active_today": _scalar(
            "select count(distinct user_id) from public.sessions where started_at::date = now()::date"
        ),
        "active_week": _scalar(
            "select count(distinct user_id) from public.sessions where started_at > now() - interval '7 days'"
        ),
        "total_interviews": _scalar("select count(*) from public.sessions"),
        "interviews_completed": _scalar("select count(*) from public.sessions where status = 'completed'"),
        "interviews_active": _scalar("select count(*) from public.sessions where status = 'active'"),
        "answers_evaluated": _scalar("select count(*) from public.evaluations"),
        "avg_questions_per_interview": _scalar(
            "select round(avg(q),1) from ("
            "  select count(*) as q from public.messages where sender='interviewer' and kind != 'clarify' "
            "  group by session_id) t"
        ),
        # --- Performance ---
        "avg_readiness": _scalar(
            "select round(avg((report->>'overall_confidence')::numeric)) "
            "from public.sessions where report is not null"
        ),
        "dimension_averages": {k: (float(v) if v is not None else None) for k, v in dimension_averages.items()},
        "recommendations": query(
            "select coalesce(report->>'recommendation','(in progress)') as label, count(*) as n "
            "from public.sessions where status='completed' group by label order by n desc"
        ),
        # --- Content analytics ---
        "by_type": query(
            "select config->>'interview_type' as label, count(*) as n "
            "from public.sessions group by label order by n desc limit 10"
        ),
        "by_interviewer": query(
            "select config->>'persona_key' as label, count(*) as n "
            "from public.sessions group by label order by n desc limit 10"
        ),
        "by_difficulty": query(
            "select config->>'difficulty' as label, count(*) as n "
            "from public.sessions group by label order by n desc limit 10"
        ),
        # --- Activity feed (recent) ---
        "activity": query(
            "select s.status, s.started_at, s.config->>'interview_type' as type, "
            "  s.config->>'persona_key' as persona, coalesce(p.email,'user') as email "
            "from public.sessions s left join public.profiles p on p.id = s.user_id "
            "order by s.started_at desc limit 12"
        ),
    }


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
