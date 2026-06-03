"""FastAPI application (PRD §10) — wires the interview engine to persistence + auth.

Run locally:  uvicorn app.main:app --reload
Railway:      uvicorn app.main:app --host 0.0.0.0 --port $PORT  (see railway.toml)
"""

from __future__ import annotations

from dataclasses import asdict

from fastapi import Depends, FastAPI, Header, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from app import repository as repo
from app.auth import User, resolve_user
from app.config import settings
from app.db import ping
from app.evaluation import build_report, evaluate_answer
from app.llm import LLMError
from app.interviewer import next_turn
from app.personas import get_persona, personas_payload
from app.schemas import InterviewerTurn, STAGE_META, SessionConfig, Stage
from app.state_manager import InterviewSession, rehydrate_session
from app.taxonomy import config_payload

app = FastAPI(title="Dataverse AI Interview Coach", version="1.0")

_origins = [o.strip() for o in settings.cors_origins.split(",") if o.strip()] or ["*"]
app.add_middleware(
    CORSMiddleware,
    allow_origins=_origins,  # set CORS_ORIGINS to the frontend URL in production
    allow_methods=["*"],
    allow_headers=["*"],
)


# --- auth dependency -------------------------------------------------------------
def current_user(authorization: str | None = Header(default=None)) -> User:
    user = resolve_user(authorization)
    if not user:
        raise HTTPException(status_code=401, detail="Missing or invalid Authorization bearer token.")
    return user


def admin_user(user: User = Depends(current_user)) -> User:
    if not user.is_admin:
        raise HTTPException(status_code=403, detail="Admin only.")
    return user


# --- request models --------------------------------------------------------------
class StartSessionBody(BaseModel):
    role: str = "Data Privacy Program Manager"
    industry: str = "Social Media"
    level: str = "Director"
    scale: str = "Multi-project"
    persona_key: str = "tiktok"
    interview_type: str = "Incident response"
    difficulty: str = "Senior"
    mode: str = "Coached"


class AnswerBody(BaseModel):
    answer: str


class CreditBody(BaseModel):
    user_id: str
    delta: int


def _fallback_turn(engine: InterviewSession) -> dict:
    stage = engine.state.stage
    meta = STAGE_META[stage]
    if stage == Stage.REVERSE_AND_CLOSE:
        if engine.stage_is_exhausted():
            return {"stage": int(stage), "stage_label": engine.stage_label, "lens": engine.state.lens, "question": "Thank you. That is all from me today.", "action": "close", "finished": True}
        return {"stage": int(stage), "stage_label": engine.stage_label, "lens": engine.state.lens, "question": meta["seed"], "action": "probe", "finished": False}

    if engine.can_advance():
        engine.advance_stage()
        next_meta = STAGE_META[engine.state.stage]
        return {
            "stage": int(engine.state.stage),
            "stage_label": engine.stage_label,
            "lens": engine.state.lens,
            "question": next_meta["seed"],
            "action": "advance",
            "finished": False,
        }

    return {
        "stage": int(stage),
        "stage_label": engine.stage_label,
        "lens": engine.state.lens,
        "question": meta["seed"],
        "action": "probe",
        "finished": False,
    }


# --- meta ------------------------------------------------------------------------
@app.get("/health")
def health() -> dict:
    return {"status": "ok", "db": ping(), "llm_provider": settings.llm_provider}


@app.get("/config")
def get_config() -> dict:
    return {**config_payload(), "personas": personas_payload()}


@app.get("/me")
def me(user: User = Depends(current_user)) -> dict:
    return {"id": user.id, "email": user.email, "is_admin": user.is_admin, "credits": repo.get_balance(user.id)}


# --- interview flow --------------------------------------------------------------
@app.post("/sessions")
def start_session(body: StartSessionBody, user: User = Depends(current_user)) -> dict:
    if not repo.try_deduct_credit(user.id):
        raise HTTPException(status_code=402, detail="No credits remaining.")

    config = SessionConfig.from_dict(body.model_dump())
    session_id = repo.create_session(user.id, config.to_dict())

    engine = InterviewSession(config)
    turn = next_turn(engine)
    engine.record_interviewer(turn)
    repo.add_message(session_id, "interviewer", int(engine.state.stage), turn.lens, turn.question)
    repo.update_stage(session_id, int(engine.state.stage))

    return {
        "session_id": session_id,
        "stage": int(engine.state.stage),
        "stage_label": engine.stage_label,
        "lens": turn.lens,
        "question": turn.question,
        "mode": config.mode,
        "credits": repo.get_balance(user.id),
    }


@app.post("/sessions/{session_id}/answer")
def answer(session_id: str, body: AnswerBody, user: User = Depends(current_user)) -> dict:
    row = repo.get_session(session_id, user.id)
    if not row:
        raise HTTPException(status_code=404, detail="Session not found.")
    if row["status"] != "active":
        raise HTTPException(status_code=409, detail="Session is not active.")

    config = SessionConfig.from_dict(row["config"])
    persona = get_persona(config.persona_key)
    messages = repo.get_messages(session_id)
    last_question = next((m["content"] for m in reversed(messages) if m["sender"] == "interviewer"), "")

    engine = rehydrate_session(config, int(row["stage"]), messages)

    # Record + persist the candidate's answer.
    engine.record_candidate(body.answer)
    cand_msg_id = repo.add_message(session_id, "candidate", int(engine.state.stage), engine.state.lens, body.answer)

    # Evaluate it (always stored; surfaced inline only in Coached mode).
    try:
        ev = evaluate_answer(persona, config, last_question, body.answer)
    except LLMError:
        ev = None
    if ev is not None:
        repo.add_evaluation(cand_msg_id, session_id, ev)

    # Generate the next interviewer turn.
    try:
        turn = next_turn(engine)
        engine.record_interviewer(turn)
    except LLMError:
        fallback = _fallback_turn(engine)
        turn = InterviewerTurn(
            question=fallback["question"],
            action=fallback["action"],
            lens=fallback["lens"],
            competency="fallback",
            rationale="LLM unavailable; using deterministic fallback turn.",
        )
        if fallback["action"] == "advance" and engine.state.stage < Stage.REVERSE_AND_CLOSE:
            repo.update_stage(session_id, int(engine.state.stage))
        repo.add_message(session_id, "interviewer", int(engine.state.stage), fallback["lens"], fallback["question"])
    else:
        repo.add_message(session_id, "interviewer", int(engine.state.stage), turn.lens, turn.question)
        repo.update_stage(session_id, int(engine.state.stage))

    finished = engine.state.finished or turn.action == "close"
    report = None
    if finished:
        evals = repo.evaluations_as_objects(session_id)
        report = asdict(build_report(evals, config))
        repo.finish_session(session_id, report)

    resp = {
        "stage": int(engine.state.stage),
        "stage_label": engine.stage_label,
        "lens": turn.lens,
        "question": turn.question,
        "action": turn.action,
        "finished": finished,
    }
    if config.mode == "Coached" and ev is not None:
        resp["evaluation"] = asdict(ev)
    if report:
        resp["report"] = report
    return resp


@app.post("/sessions/{session_id}/end")
def end_session(session_id: str, user: User = Depends(current_user)) -> dict:
    row = repo.get_session(session_id, user.id)
    if not row:
        raise HTTPException(status_code=404, detail="Session not found.")
    config = SessionConfig.from_dict(row["config"])
    evals = repo.evaluations_as_objects(session_id)
    report = asdict(build_report(evals, config))
    if row["status"] == "active":
        repo.finish_session(session_id, report)
    return {"session_id": session_id, "report": report}


@app.get("/sessions/{session_id}")
def get_session_detail(session_id: str, user: User = Depends(current_user)) -> dict:
    row = repo.get_session(session_id, user.id)
    if not row:
        raise HTTPException(status_code=404, detail="Session not found.")
    return {
        "session": {
            "id": str(row["id"]), "config": row["config"], "stage": row["stage"],
            "status": row["status"], "report": row.get("report"),
        },
        "messages": [
            {"sender": m["sender"], "stage": m["stage"], "lens": m["lens"], "content": m["content"]}
            for m in repo.get_messages(session_id)
        ],
        "evaluations": repo.get_evaluations(session_id),
    }


@app.get("/sessions")
def list_my_sessions(user: User = Depends(current_user)) -> dict:
    return {"sessions": repo.list_sessions(user.id)}


# --- admin (PRD §9) --------------------------------------------------------------
@app.get("/admin/users")
def admin_users(_: User = Depends(admin_user)) -> dict:
    return {"users": repo.admin_list_users()}


@app.get("/admin/sessions")
def admin_sessions(_: User = Depends(admin_user)) -> dict:
    return {"sessions": repo.admin_list_sessions()}


@app.post("/admin/credits")
def admin_credits(body: CreditBody, _: User = Depends(admin_user)) -> dict:
    balance = repo.adjust_credits(body.user_id, body.delta)
    return {"user_id": body.user_id, "balance": balance}
