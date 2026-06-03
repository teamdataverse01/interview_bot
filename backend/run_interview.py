"""CLI driver to run a full mock interview (M2 deliverable — multi-turn engine, no UI yet).

Interactive:
    python run_interview.py --persona strava --type DPIA --level Director --difficulty Senior

Auto (LLM plays the candidate, for smoke-testing the whole flow end-to-end):
    python run_interview.py --persona tiktok --type "Incident response" --auto
"""

from __future__ import annotations

import argparse
import sys
import time

from app.evaluation import build_report, evaluate_answer
from app.interviewer import next_turn
from app.llm import chat
from app.schemas import SCORE_DIMENSIONS, AnswerEvaluation, SessionConfig
from app.state_manager import InterviewSession


def _simulated_candidate(session: InterviewSession, question: str) -> str:
    """Use the LLM to play a strong privacy-leader candidate (for --auto testing)."""
    sys_prompt = (
        f"You are a strong candidate interviewing for {session.config.role} ({session.config.level}). "
        "Answer the interviewer's question concisely (4-6 sentences), in first person, with concrete, "
        "realistic privacy/compliance detail. Do not ask questions back unless invited."
    )
    msgs = [{"role": "system", "content": sys_prompt}]
    for t in session.state.transcript[-6:]:
        role = "user" if t.sender == "interviewer" else "assistant"
        msgs.append({"role": role, "content": t.content})
    msgs.append({"role": "user", "content": question})
    return chat(msgs, max_tokens=320, temperature=0.7)


def _print_scorecard(ev: AnswerEvaluation) -> None:
    line = "  ".join(f"{SCORE_DIMENSIONS[k][:12]}:{ev.scores.get(k,0)}" for k in SCORE_DIMENSIONS)
    missed_p = [k for k, hit in ev.principles.items() if not hit]
    print("  ┌─ EVALUATION ─────────────────────────────────────────────")
    print(f"  │ confidence: {ev.confidence_score}/100   (avg dim {ev.avg_score}/10)")
    print(f"  │ {line}")
    if missed_p:
        print(f"  │ principles missed: {', '.join(missed_p)}")
    if ev.missed_concepts:
        print(f"  │ missed concepts: {', '.join(ev.missed_concepts[:4])}")
    if ev.stronger_answer:
        print(f"  │ stronger answer: {ev.stronger_answer[:240]}...")
    print("  └──────────────────────────────────────────────────────────")


def run(config: SessionConfig, auto: bool, max_turns: int = 14, delay: float = 0.0) -> None:
    session = InterviewSession(config)
    evaluations: list[AnswerEvaluation] = []
    print("=" * 78)
    print(f"  {session.persona.company} mock interview | {config.role} ({config.level}) | "
          f"{config.interview_type} | {config.difficulty} | mode={config.mode}")
    print("=" * 78)

    for _ in range(max_turns):
        turn = next_turn(session)
        session.record_interviewer(turn)
        print(f"\n[{session.stage_label} | {turn.lens}]")
        print(f"INTERVIEWER: {turn.question}")

        if session.state.finished or turn.action == "close":
            print("\n--- interview complete ---")
            break

        if auto:
            answer = _simulated_candidate(session, turn.question)
            print(f"\nCANDIDATE: {answer}")
        else:
            try:
                answer = input("\nYOUR ANSWER > ").strip()
            except (EOFError, KeyboardInterrupt):
                print("\n(ended)")
                break
            if answer.lower() in {"quit", "exit"}:
                break
        session.record_candidate(answer)

        # Evaluate every answer; show inline only in Coached mode (PRD §6).
        ev = evaluate_answer(session.persona, config, turn.question, answer)
        evaluations.append(ev)
        if config.mode == "Coached":
            _print_scorecard(ev)

        # Auto-mode throttle: spread calls so the free-tier token-per-minute limit isn't blown.
        if auto and delay:
            time.sleep(delay)

    # End-of-session report (always).
    report = build_report(evaluations, config)
    print("\n" + "=" * 78)
    print("  SESSION REPORT")
    print("=" * 78)
    print(f"  {report.summary}")
    print(f"  dimension averages: " + ", ".join(f"{SCORE_DIMENSIONS[k]}={v}" for k, v in report.dimension_averages.items()))
    print(f"  principle hit-rate: " + ", ".join(f"{k}={v}" for k, v in report.principle_hit_rate.items()))


def main() -> int:
    ap = argparse.ArgumentParser(description="Run a mock interview.")
    ap.add_argument("--persona", default="tiktok", help="netflix | tiktok | strava | generic")
    ap.add_argument("--role", default="Data Privacy Program Manager")
    ap.add_argument("--industry", default="Social Media")
    ap.add_argument("--level", default="Director")
    ap.add_argument("--scale", default="Multi-project")
    ap.add_argument("--type", dest="interview_type", default="Incident response")
    ap.add_argument("--difficulty", default="Senior")
    ap.add_argument("--mode", default="Coached")
    ap.add_argument("--auto", action="store_true", help="LLM plays the candidate (smoke test)")
    ap.add_argument("--max-turns", type=int, default=14)
    ap.add_argument("--delay", type=float, default=0.0, help="seconds to pause between turns in --auto (free-tier throttle)")
    args = ap.parse_args()

    config = SessionConfig(
        role=args.role, industry=args.industry, level=args.level, scale=args.scale,
        persona_key=args.persona, interview_type=args.interview_type,
        difficulty=args.difficulty, mode=args.mode,
    )
    run(config, auto=args.auto, max_turns=args.max_turns, delay=args.delay)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
