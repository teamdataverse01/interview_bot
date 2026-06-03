# Implementation PRD — Dataverse AI Interview Coach (V1)

> **This is an implementation spec, not a vision doc.** It tells us exactly what to build for V1.
> It supersedes the generic PRD (preserved in `prd_v0_generic_backup.md`) and is rewritten to
> follow **Elizabeth's structured refinement** in `Interview transcript.docx`.
>
> **Product Owner:** Elizabeth (Dataverse) · **Technical Lead:** Mubarak
> **Hosting:** Railway (backend) + Vercel (frontend) · **AI:** Provider-agnostic gateway,
> **free models now → paid later** via one config switch.

---

## 0. The one-paragraph reframe (read this first)

This is **not** a generic interview chatbot with "General / Behavioral / HR" modes. Per Elizabeth's
document, we are building a **domain-specific privacy-career interview simulator** — "the operating
system for privacy career readiness." Its moat is **not** the LLM; it is (a) the **real interview
transcripts** (Netflix / TikTok / Strava) as a knowledge base, and (b) the **evaluation framework**
that grades answers the way a FAANG-scale hiring manager would. Build those two things first.

**Architectural rule (from Elizabeth):** *Do not build "chatbot first." Build the Interview State
Manager and the Evaluation Engine first.* The conversation layer is the cheap part.

---

## 1. The three things that make this "her product"

Everything below traces back to a rule in her document. The product is "done right" only if these
three subsystems exist:

| Subsystem | What it is | Source in her doc |
|---|---|---|
| **A. Configuration Taxonomy** | User picks Industry → Role → Level → Scale → Interview Type → Difficulty before the interview starts | "Have a FAANG Segment; Let's have per industry… categories users can choose from" |
| **B. Persona + State Engine** | The AI *becomes* a company-specific interviewer (Netflix/TikTok/Strava DNA), asks one question at a time, probes like a "tennis match," switches Operational↔Programmatic lens | "Read the Room," "Conciseness & Interviewer Cues," "Operational vs Programmatic" |
| **C. Evaluation Engine** | Grades each answer on 8 criteria + her 6 Elite Principles, returns score + stronger answer + missed concepts + STAR optimization + confidence | "Metrics used to Evaluate," "The Elite Interview Blueprint," "What does our AI Simulator provide in return?" |

---

## 2. Knowledge Architecture (her 7 layers)

She is explicit: **do not dump everything as one course script.** Segment knowledge so the simulator
knows *when to interview, when to teach, when to evaluate, when to coach.* V1 implements layers 1, 5,
and 7 (the rest are Phase 2 hooks, but the schema reserves space for them now).

| # | Layer | Role in product | V1? | Source folder |
|---|---|---|---|---|
| 1 | Interview transcripts | **Simulation** — how interviewers probe, real follow-ups, strong vs weak answers | ✅ V1 | `knowledge/01-interview-questions` |
| 2 | Course scripts | **Teaching** — explain concepts, coach weak areas | Phase 2 | `knowledge/02-course-concepts` |
| 3 | Assignments | **Practice** — assess applied competence | Phase 2 | `knowledge/03-assignments` |
| 4 | Projects | **Portfolio** — connect learning to job readiness | Phase 2 | `knowledge/04-projects` |
| 5 | Mock-interview feedback | **Evaluator** — critique like a hiring manager | ✅ V1 (seed set) | `knowledge/05-mock-feedback` |
| 6 | Job descriptions | **Market** — tailor to role/seniority | Phase 2 | `knowledge/06-job-descriptions` |
| 7 | Regulatory reference | **Grounding** — GDPR, NDPA/NDPR, CCPA, NIST AI RMF | ✅ V1 (lightweight) | `knowledge/07-regulatory-reference` |

**Ingestion contract.** Every chunk stored in the vector DB carries this metadata so retrieval can be
filtered by the user's configuration:

```jsonc
{
  "doc_id": "netflix-director-01",
  "layer": "interview-transcript",      // one of the 7 layers
  "company": "Netflix",                  // or null/"generic"
  "industry": "Entertainment",
  "role_level": "Director",              // IC | Manager | Director | VP
  "interview_type": ["Behavioral", "Change Management", "Leadership"],
  "competencies": ["change-management", "stakeholder-mgmt", "prioritization"],
  "answer_quality": "strong",            // strong | good | fair | weak | n/a
  "lens": "programmatic",                // operational | programmatic | mixed
  "anonymized": true,
  "text": "…chunk…"
}
```

**Legal/ethical ingestion rules (hard requirements, from her doc).** Before any transcript becomes a
chunk: remove personal data, remove company-confidential info, **anonymize names, strip identifiers**,
and **do not reproduce company-specific questions verbatim** — extract *patterns, themes,
competencies, structures, reasoning models* instead. We store distilled Q/A breakdowns (the structured
sections she already wrote in `Interview transcript.docx` lines 5140+), **not** raw transcript text.

---

## 3. Subsystem A — Configuration Taxonomy

The user composes an interview by selecting from these exact lists (her lines 5347–5408). Stored as a
single source-of-truth config (`backend/app/taxonomy.py`) and served to the frontend via `GET /config`.

**Industry**
`FinTech` · `Financial Institutions` · `Academic Institutions` · `Tech Companies` · `FAANG` ·
`Automobile / Transportation` · `Government` · `Entertainment` · `Social Media` · `Consulting` · `AdTech`

**Role**
`Data Privacy Compliance Manager` · `Data Governance` · `Risk Analyst` · `Data Privacy Program Manager` ·
`Data Privacy Engineer` · `Privacy Legal Counsel` · `Data Protection Officer (DPO)`

**Level** `IC` · `Manager` · `Director` · `VP`

**Scale / Size** `Multi-project` · `One project` · `Company capacity`

**Interview Type — Technical**
`DSAR` · `DPIA` · `RoPA` · `Incident response` · `Consent management` · `Retention / deletion` ·
`Vendor risk` · `Policy lifecycle` · `Privacy engineering` · `Data flows` · `Cookies / tracking` ·
`AI governance` · `Automation`

**Interview Type — Behavioral**
`Conflict resolution` · `Stakeholder management` · `Prioritization` · `Program building / management` ·
`Leadership` · `Risk management` · `Executive communication` · `Security / Engineering alignment` ·
`Business alignment` · `Change management` (incl. *change triggers* and *evaluating change impact*)

**Difficulty** `Foundational` · `Intermediate` · `Senior` · `Executive (FAANG bar)` — see §7.

> **Behavior:** the selected config is injected into both the interviewer prompt (so questions match
> role/level/type) and the retrieval filter (so RAG pulls matching transcript chunks).

---

## 4. Subsystem B — Persona + Interview State Engine

### 4.1 Company-culture personas ("Read the Room")

The interviewer must embody the target company's DNA. V1 ships three real personas distilled from the
transcripts, plus a generic fallback. Each persona is a config object (`backend/app/personas.py`):

| Persona | Cultural DNA (drives tone + what it rewards) | Signature pressure |
|---|---|---|
| **Netflix** | "Freedom & Responsibility," **Informed Captain / Informed Leader**, context-not-control, high autonomy | Probes for independent judgment in ambiguity; dislikes process-for-process's-sake |
| **TikTok / ByteDance** | **Hyper-lean velocity**, decentralized global hubs, "drop the big-tech crown," precise instruction pipelines | Real-time technical simulation; demands specificity; tests ego/humility |
| **Strava** | **"Trust & Safety is the business core,"** storytelling for user trust, psychological safety | Tests making compliance accessible to non-legal staff; reverse-storytelling |
| **Generic FAANG** | Efficiency + scale + automation default | Falls back to the 6 Elite Principles |

A persona defines: `system_voice`, `values[]`, `rewards[]`, `penalizes[]`, `signature_followups[]`,
and `culture_cues[]`. The interviewer prompt is assembled from **persona + config + retrieved
transcript exemplars.**

### 4.2 The Interview State Manager (build this FIRST)

Every session is a state machine, not free chat. Stages (adapted to the privacy domain):

1. **Stage 1 — Introduction / Calibration** — "Tell me about your background," establish level & scope.
2. **Stage 2 — Experience & Programs** — real work, programs built, scale, automation.
3. **Stage 3 — Technical / Scenario Deep-Dive** — driven by the selected Interview Type (DSAR, DPIA,
   incident response, etc.); includes **real-time simulation** prompts at higher difficulty.
4. **Stage 4 — Behavioral & Leadership** — conflict, stakeholder mgmt, change management, prioritization.
5. **Stage 5 — Reverse Interview & Close** — "Any questions for me?" (persona answers in-character),
   then session wrap.

State tracked per session (her "Session Memory"): asked questions, covered competencies, user
strengths, user weaknesses, current stage, current lens, follow-up depth, difficulty. The manager
decides: **stay & probe deeper**, **switch lens**, or **advance stage** — and never repeats a question.

### 4.3 Interviewer behavior rules (encoded in the system prompt)

These are non-negotiable behaviors taken directly from her "Golden Rules":

- **One question at a time.** "A tennis match, not a monologue." Give the candidate the floor.
- **Listen for the pivot.** If the answer is strong and complete → advance. If shallow → probe
  ("tell me more about the technical side of that"). If the candidate rambles → cut and redirect.
- **Operational vs. Programmatic lens.** Decide which lens the question targets and judge the answer
  on that lens. *Operational* = the "how" (workflows, triage scripts, intake templates, queues).
  *Programmatic* = the "big picture" (risk registers, multi-quarter roadmaps, steering committees,
  policy-to-law alignment). Higher difficulty deliberately switches lenses mid-thread.
- **Read the room.** Frame questions through the team's immediate reality (post-reorg? new product
  line? new jurisdiction?), the corporate culture (persona), and the **360° Compliance Compass**
  (Business wants velocity · Customers want trust/UX · Leadership wants defensibility/metrics).
- **Follow-up library.** Each persona + interview type has signature follow-ups (e.g. TikTok's
  "override the risk matrix via adaptive multipliers"; Strava's "streamline a broken DPIA pipeline").

---

## 5. Subsystem C — Evaluation Engine (the "secret sauce")

Runs after the candidate answers (per-answer inline scoring) **and** at session end (summary report).

### 5.1 The 8 core scoring dimensions (her "Metrics used to Evaluate")

Each scored **0–10** with a one-line justification:

1. **Clarity** 2. **Structure** (STAR / framework) 3. **Privacy terminology** (correct domain language)
4. **Confidence** 5. **Risk-based reasoning** 6. **Regulatory understanding** 7. **Business alignment**
8. **Org-context awareness** (did they read the state of the org?)

### 5.2 The 6 Elite Principles (her "Interview Blueprint" — the FAANG bar multiplier)

The answer is additionally checked against these. At `Executive (FAANG bar)` difficulty these become
hard gates; below it they are coaching notes.

1. **Enterprise-Scale (Efficiency over Budget)** — rewards efficiency/automation/scale; *penalizes*
   "I saved budget / cut pennies." Big orgs have money; they buy scale.
2. **Technological (Proactive Automation)** — rewards automated architectures; *penalizes* "hire more
   people / check more spreadsheets" (toil).
3. **Cognitive (Thought process + cross-pollination)** — rewards numbered, ground-up reasoning and
   outside-industry analogies (e.g. borrowing PCI-DSS rigor for a grey-area GDPR problem).
4. **Chaos (Ambiguity & nimble pivots)** — rewards crisis narratives, risk-acceptance waivers, pilot
   sandboxes, mid-cycle re-prioritization.
5. **Collaboration (Cross-functional diplomacy)** — rewards mapping decision-makers and synthesizing
   Legal/Eng/Product/Comms into one roadmap.
6. **Operational (Compliance as a business enabler)** — rewards reframing privacy as velocity/trust/cost
   advantage; *penalizes* "it's a legal mandate / checklist."

### 5.3 What the simulator returns ("AI provides in return")

Per answer **and** in the end-of-session report:

- **Scorecard** — the 8 dimensions + an overall **Confidence Score** (0–100).
- **Suggested stronger answer** — a rewritten model answer in the persona's preferred frame.
- **Missed concepts** — domain points/regulations/frameworks the candidate should have hit.
- **STAR optimization** — how to restructure into Situation-Task-Action-Result.
- **Principle flags** — which of the 6 Elite Principles were hit / missed.

**Output is strict JSON** (schema in `backend/app/schemas.py`) so the frontend renders it
deterministically and we can store it for session history.

---

## 6. Interview Flow (her Step 1–5)

```
Step 1  User selects: Role · Industry · Level · Scale · Company/Persona · Interview Type · Difficulty
Step 2  AI interviewer opens in-character (Stage 1) — e.g. "Tell me about your experience handling
        privacy incidents."
Step 3  User responds (V1: text. Voice/Video = Phase 3).
Step 4  Evaluation Engine scores the answer (8 dims + 6 principles) — silently logged; optionally
        surfaced inline depending on mode (see §7 "Coached vs Real").
Step 5  AI gives feedback / stronger answer / missed concepts / STAR / confidence — and either probes,
        switches lens, or advances stage.
        → loop Step 2–5 until State Manager reaches Stage 5 close.
End     Full session report + session saved to history.
```

**Two run modes:**
- **Coached mode** — feedback shown inline after every answer (teaching).
- **Real mode** — interviewer stays in character the whole time; full report only at the end (realism).

---

## 7. Difficulty & Pressure Simulation

Difficulty scales four levers: question depth, **lens-switching frequency**, follow-up aggressiveness,
and how strictly the 6 Elite Principles gate the score.

- **Foundational** — definitions, single-lens, supportive.
- **Intermediate** — scenario-based, occasional follow-up.
- **Senior** — multi-part scenarios, lens switching, principles as strong signals.
- **Executive (FAANG bar)** — principles are hard gates; expects automation + scale + defensibility.

**Phase 3 "premium" pressure layer (not V1, but schema-reserved):** interruptions, follow-up pressure,
time constraints, multi-panel, "hostile interviewer." (Her Phase 3.)

---

## 8. AI Provider Strategy — free now, paid later

Single abstraction (`backend/app/llm.py`) behind an interface: `chat()`, `embed()`. Selected by env
vars so switching providers/models is a **config change, not a code change.**

```
LLM_PROVIDER=openrouter            # openrouter | openai | anthropic | (future)
LLM_MODEL=deepseek/deepseek-chat:free   # free tier now; swap to paid model later
LLM_API_KEY=...
EMBED_PROVIDER=fastembed           # local/free embeddings (BAAI/bge-small-en) — no per-call cost
EMBED_MODEL=BAAI/bge-small-en-v1.5
```

- **V1 (free):** OpenRouter free chat models (e.g. DeepSeek/Qwen free tiers) + **local embeddings**
  via `fastembed`/sentence-transformers so the RAG layer costs nothing to index or query.
- **Later (paid):** flip `LLM_PROVIDER`/`LLM_MODEL` to Claude/GPT/paid DeepSeek; flip `EMBED_PROVIDER`
  to a hosted embedding model. No other code changes.
- All prompts are written model-agnostically and request **strict JSON** output for the evaluator.

---

## 9. Data Model (Supabase Postgres + pgvector)

```
users        : id, email, created_at, is_admin
credits      : user_id, balance
sessions     : id, user_id, config(jsonb: role/industry/level/scale/persona/type/difficulty/mode),
               stage, status, started_at, ended_at
messages     : id, session_id, sender(interviewer|candidate), stage, lens, content, created_at
evaluations  : id, message_id, session_id, scores(jsonb: 8 dims), principles(jsonb: 6 flags),
               confidence(int), stronger_answer(text), missed_concepts(jsonb), star_notes(text)
documents    : id, layer, company, industry, role_level, interview_type(jsonb), competencies(jsonb),
               answer_quality, lens, anonymized(bool), title, source
doc_chunks   : id, document_id, content, embedding(vector), metadata(jsonb)
```

Credits: 1 session = 1 credit; deduct on start; admin can adjust (unchanged from original PRD §8).

---

## 10. API Surface (FastAPI)

```
GET  /config                      → taxonomy + personas + difficulties (drives the frontend pickers)
POST /sessions                    → create session from config; deduct credit; return opening question
POST /sessions/{id}/answer        → submit answer; returns next interviewer turn (+ inline eval if Coached)
GET  /sessions/{id}               → transcript + per-answer evaluations
POST /sessions/{id}/end           → finalize; returns full session report
GET  /sessions                    → list user's past sessions (history)
-- admin --
POST /admin/documents             → upload + ingest a knowledge doc (runs anonymization + chunking)
GET  /admin/users · /admin/sessions · POST /admin/credits
```

Auth: Supabase Auth (signup / login / logout / reset) — unchanged from original §1.

---

## 11. Tech Stack & Railway Deployment

- **Frontend:** Next.js + Tailwind → **Vercel**.
- **Backend:** FastAPI (Python) → **Railway**. `Procfile`/`railway.toml` runs
  `uvicorn app.main:app --host 0.0.0.0 --port $PORT`. Dependencies in `requirements.txt`.
  `Dockerfile` optional but recommended for reproducible builds incl. the embedding model.
- **DB + Vector:** Supabase Postgres + `pgvector`.
- **RAG:** LlamaIndex (or a thin custom retriever) over `doc_chunks`, filtered by session config.
- **Config:** all secrets via Railway env vars (see §8). `.env.example` committed; `.env` git-ignored.

**Railway specifics to honor:** bind to `$PORT`; keep the image small (prefer a small/quantized
embedding model or compute embeddings at ingest only); add `/health` for Railway healthchecks.

---

## 12. Build Milestones (engine-first, per her architectural rule)

- **M1 — Knowledge engine.** Parse the structured Q/A breakdowns from `Interview transcript.docx`
  (lines 5140+) into the layer-tagged schema (§2); anonymize; embed; load into pgvector. Build the
  retriever with config filtering. *Deliverable: query the KB and get relevant, tagged exemplars.*
- **M2 — State Manager + Personas.** Implement the 5-stage machine, session memory, lens logic, and
  the 3 personas + generic. *Deliverable: a coherent multi-turn interview over the API (no UI).*
- **M3 — Evaluation Engine.** 8 dimensions + 6 principles + JSON outputs + confidence score.
  *Deliverable: every answer returns a valid scorecard + stronger answer.*
- **M4 — Frontend + Auth + Credits + History.** Config pickers, chat UI, inline/end-of-session report,
  Supabase auth, credit deduction, session history.
- **M5 — Admin + Deploy.** Admin upload/ingest + user/credit management; deploy backend to Railway,
  frontend to Vercel; end-to-end test with a real client.

---

## 13. Definition of Done (V1)

- [ ] User picks **Industry · Role · Level · Scale · Company persona · Interview Type · Difficulty**.
- [ ] Interviewer **embodies the company persona**, asks **one question at a time**, **probes like a
      tennis match**, switches **Operational↔Programmatic** lens, and **never repeats** a question.
- [ ] RAG retrieves **anonymized** transcript knowledge **filtered by the user's config**.
- [ ] Every answer is scored on the **8 dimensions + 6 Elite Principles**, returning **scorecard +
      stronger answer + missed concepts + STAR optimization + confidence score**.
- [ ] Sessions saved to **history**; **credits** deducted; **admin** can ingest docs + adjust credits.
- [ ] Free-tier AI works end-to-end; switching to a paid model is a **single env-var change**.
- [ ] Deployed: backend on **Railway**, frontend on **Vercel**, usable by a real Dataverse client.

---

## 14. Traceability — every feature maps to her document

| Her rule (in `Interview transcript.docx`) | Where it lives in this build |
|---|---|
| "Have a FAANG segment; per-industry categories users choose from" | §3 Configuration Taxonomy |
| Industry / Role / Level / Scale / Interview Type lists | §3 (verbatim lists) |
| "Read the Room: team reality, culture, 360° compliance compass" | §4.1 personas + §4.3 behavior |
| Netflix / TikTok / Strava cultural DNA | §4.1 persona objects |
| "Tennis match, not a monologue; listen for the pivot" | §4.3 behavior rules |
| "Operational vs Programmatic lens" | §4.3 lens logic + state memory |
| "Metrics used to evaluate" (8 metrics) | §5.1 scoring dimensions |
| "The Elite Interview Blueprint" (6 principles) | §5.2 Elite Principles |
| "What does our AI Simulator provide in return?" | §5.3 outputs |
| Step 1–5 example flow | §6 Interview Flow |
| "Different levels of difficulty" + Phase 3 pressure | §7 |
| "Build the Knowledge Engine first; RAG + prompt engineering, no custom LLM" | §8, §12 (M1 first) |
| 7 knowledge layers; "don't dump one big script" | §2 Knowledge Architecture |
| "Handle recordings carefully — anonymize, strip identifiers, no verbatim" | §2 ingestion rules |
| "Don't build a chatbot; build the operating system for privacy readiness" | §0 reframe, §12 engine-first |

---

*Open question for Elizabeth before M1: confirm the three personas (Netflix/TikTok/Strava) are the
right V1 set, and whether "Coached vs Real" mode (§6) matches how she runs live mock sessions.*
