# Dataverse AI Interview Coach — Backend

Privacy-career interview simulator. This backend implements Elizabeth's rules from
`Interview transcript.docx` (see the implementation spec in `../prd.md`).

Build order is **engine-first** (PRD §12). **M1 (Knowledge Engine), M2 (State Manager +
Personas), and M3 (Evaluation Engine) are complete and live-verified.**

## Layout

```
backend/
  app/
    taxonomy.py        # §3  the exact Industry/Role/Level/Scale/Type/Difficulty lists + classifiers
    personas.py        # §4.1 Netflix / TikTok / Strava / Generic-FAANG interviewer DNA
    schemas.py         # §4,§5 Stage enum, SessionConfig, eval models, difficulty slots
    state_manager.py   # §4.2 5-stage machine, session memory, deterministic stage control
    interviewer.py     # §4.3 persona prompt assembly + RAG grounding + LLM turn generation
    evaluation.py      # §5  Evaluation Engine: 8 dims + 6 Elite Principles -> JSON scorecard + report
    config.py          # §8  env-driven settings + provider failover chain
    llm.py             # §8  provider-agnostic chat gateway + retry/backoff + auto failover
    db.py              # §9  psycopg connection helpers
    auth.py            # §10 verify Supabase access token (+ dev bypass)
    repository.py      # §9  sessions/messages/evaluations/credits persistence
    main.py            # §10 FastAPI app: /config /sessions /answer /end /me /admin/*
  db/
    schema.sql         # §9  tables + pgvector extension (idempotent)
    migrate.py         #     applies schema.sql to Supabase
  knowledge/
    ingest/
      parse_boss_doc.py   # M1  doc -> layer-tagged, anonymized knowledge chunks
      anonymize.py        # §2  strip names/identifiers/PUA glyphs (hard requirement)
    retriever.py          # RAG retriever: metadata filter + relevance rank (TF-IDF or fastembed)
    knowledge_base.jsonl  # generated artifact (132 chunks from the real transcripts)
  run_interview.py     # M2  CLI driver: run a full mock interview (--auto to self-test)
  requirements.txt · .env.example · railway.toml · Procfile
```

## M2 — run a mock interview

```bash
cd backend
# Interactive (you answer):
python run_interview.py --persona strava --type DPIA --level Director --difficulty Senior
# Auto (LLM plays the candidate, full end-to-end smoke test):
python run_interview.py --persona tiktok --type "Incident response" --difficulty Intermediate --auto
```

The state manager owns stage progression + memory (never repeats a question); the interviewer
model handles in-character phrasing, probing, and operational/programmatic lens switching.

## M1 — run it

No dependencies needed (standard library only).

```bash
cd backend

# 1) Build the knowledge base from Elizabeth's structured doc
python -m knowledge.ingest.parse_boss_doc --src ../boss_doc.txt --out knowledge/knowledge_base.jsonl

# 2) Query it (filtered, ranked exemplars) — the M1 deliverable
python -m knowledge.retriever "how do you streamline a broken DPIA process" --company Strava -k 2
python -m knowledge.retriever "prioritize a multifaceted data incident" --company TikTok -k 2
```

Each chunk is tagged per PRD §2 (`company`, `role_level`, `interview_type[]`, `competencies[]`,
`lens`, `answer_quality`, `speaker`) so retrieval can be filtered by the user's session config.

### Optional: semantic embeddings (free, local)

TF-IDF is the zero-dependency default. For semantic recall, install `fastembed` and set
`EMBED_PROVIDER=fastembed`. (Needs onnxruntime wheels — use Python 3.11–3.12 if 3.14 wheels are
unavailable.)

## M4 — run the API

```bash
cd backend
python -m db.migrate                 # apply schema to Supabase (needs DATABASE_URL pooler string)
uvicorn app.main:app --reload        # http://127.0.0.1:8000/docs
```

Local auth: send `Authorization: Bearer dev` (works when APP_ENV != production) to act as a dev
admin user. The frontend will send a real Supabase access token instead.

Key endpoints: `GET /config`, `POST /sessions`, `POST /sessions/{id}/answer`,
`POST /sessions/{id}/end`, `GET /sessions`, `GET /me`, `POST /admin/credits`.

## What's next

- **M5** — Next.js frontend (config pickers, chat UI, scorecards, history) on Vercel + admin doc ingest.

## Config / deployment

All secrets are env vars (`.env.example`). Switching from free to paid models is a one-line change
(`LLM_PROVIDER` / `LLM_MODEL`). Railway runs `uvicorn app.main:app --host 0.0.0.0 --port $PORT`
(see `railway.toml`); `/health` is the healthcheck (added with the app in M2/M4).
