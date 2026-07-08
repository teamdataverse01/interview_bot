# Dataverse AI Interview Coach — Metrics & Measurement Framework
### How we will judge the success of the platform

---

## 1. Our measurement philosophy

We don't track metrics for vanity. Every number answers one of four questions:

1. **Are people showing up?** (Growth & activation)
2. **Are they using it?** (Engagement)
3. **Is it actually making them better?** (Product value — our differentiator)
4. **Is it a sustainable business?** (Cost & monetization)

We organize metrics in three layers so we never drown in numbers:

- **North Star** — the single metric that best captures value delivered.
- **Category KPIs** — 1–2 headline numbers per area (what we review weekly).
- **Operational metrics** — the detail we drill into when a KPI moves.

---

## 2. The North Star Metric

> **Weekly Interviews Completed that produce an improvement in Interview Readiness.**

Why this one: it only goes up if people (a) come back, (b) finish interviews, and (c) actually get better. It fuses engagement + outcome into one honest number. Everything else is a supporting driver.

**Supporting "counter-metrics"** (guardrails so we don't game the North Star): completion rate, cost per interview, and user satisfaction.

---

## 3. The metric categories

Each metric below has: **what it means**, **why it matters**, **how we measure it**, and **status**
(🟢 Live in our admin dashboard today · 🟡 Ready to add · 🔵 Needs billing/telemetry at launch).

### 3.1 Platform & Growth
| Metric | What it means | Why it matters | Status |
|---|---|---|---|
| Total Users | All registered accounts | Top-of-funnel size | 🟢 |
| New Signups (today / week) | Accounts created in the period | Growth velocity | 🟢 |
| Active Users (today / week) | Distinct users who ran a session | Real usage, not just signups | 🟢 |
| Returning Users | Users active in >1 week | Early retention signal | 🟡 |
| DAU / WAU / MAU | Daily/Weekly/Monthly actives | Standard SaaS health | 🟡 |
| Activation Rate | % of signups who complete ≥1 interview | Are we delivering the "aha"? | 🟡 |

*How measured:* `profiles` (signups), `sessions` grouped by user + date (activity). Source: our Postgres.

### 3.2 Product Engagement — Interviews
| Metric | What it means | Why it matters | Status |
|---|---|---|---|
| Interviews Started | Sessions created | Intent to practice | 🟢 |
| Interviews Completed | Sessions finished with a report | Follow-through | 🟢 |
| Completion Rate | Completed ÷ Started | Friction / quality signal | 🟢 |
| Avg Questions per Interview | Mean interviewer questions/session | Depth of practice | 🟢 |
| Avg Session Length / Duration | Time spent per interview | Engagement depth | 🔵 |
| Interviews per User | Practice volume per person | Habit formation | 🟡 |

### 3.3 Interview Performance — *our core value*
This is where the product earns its keep. Every answer is scored by our evaluation engine.

**The 8 scoring dimensions (0–10 each):** Clarity · Structure (STAR) · Privacy terminology ·
Confidence · Risk-based reasoning · Regulatory understanding · Business alignment · Org-context.

**The overall outcome:** an **Interview Readiness** score (0–100) and a recruiter-style
**Hiring Recommendation**: *Strong Hire · Hire · Hire with Reservations · No Hire*.

| Metric | What it means | Why it matters | Status |
|---|---|---|---|
| Avg Interview Readiness | Mean readiness across interviews | Are users hire-ready? | 🟢 |
| Dimension Averages | Mean of each of the 8 scores | Where users are strong/weak | 🟢 |
| Hiring Recommendation Mix | Distribution of the 4 verdicts | Cohort quality at a glance | 🟢 |
| STAR Method Usage | % answers using STAR structure | Behavioral quality | 🟡 |
| Strong vs Weak Answers | Counts above/below threshold | Answer quality trend | 🟡 |
| Follow-up / Clarify Usage | How often users ask for help | Confidence & UX signal | 🟡 |

*How measured:* `evaluations` table (per-answer scores + principles) and the session `report` JSON.

### 3.4 Improvement & Learning Outcomes — *the retention engine*
| Metric | What it means | Why it matters | Status |
|---|---|---|---|
| Readiness Over Time | Week-1 vs Week-2 vs Week-3 score | Proof the product works | 🟡 |
| Improvement by Skill | Gains in Communication, Leadership, etc. | Personalized progress | 🟡 |
| Practice Streak (current / longest) | Consecutive active days | Habit + motivation | 🔵 |
| Interviews This Week / Month | Recent practice cadence | Engagement rhythm | 🟡 |

*Example we can already show:* Confidence — Week 1: 62% → Week 2: 71% → Week 3: 81%.

### 3.5 Content & Question Analytics
| Metric | What it means | Why it matters | Status |
|---|---|---|---|
| Interviews by Type | Volume per interview type (DSAR, DPIA…) | What users practice most | 🟢 |
| Interviews by Interviewer & Difficulty | Persona/difficulty distribution | Content demand | 🟢 |
| Hardest / Lowest-Scoring Areas | Topics with the weakest answers | Where to add coaching | 🟡 |
| Most-Asked / Skipped Questions | Question-level demand & drop-off | Improve the question bank | 🔵 |

### 3.6 Knowledge Base (RAG) Health
| Metric | What it means | Why it matters | Status |
|---|---|---|---|
| Documents Indexed / Chunks | Size of the knowledge base | Coverage of the corpus | 🟢 (132 chunks) |
| Retrieval Success Rate | % queries with a good match | Answer grounding quality | 🔵 |
| Most-Retrieved / Useful Docs | Which sources drive answers | Maintain the KB | 🔵 |

### 3.7 AI Usage & Cost — *matters as we scale*
| Metric | What it means | Why it matters | Status |
|---|---|---|---|
| Total AI Messages / Turns | Model calls & conversation turns | Load & engagement | 🔵 |
| Avg Response Time | Latency per AI reply | User experience | 🔵 |
| Tokens per Session | Input+output tokens | Cost driver | 🔵 |
| Cost per Interview | AI spend ÷ interviews | Unit economics | 🔵 |
| Cost Today / Week / Month | Total AI spend | Burn tracking | 🔵 |

*Note:* today we run on **free-tier models with automatic failover**, so cost ≈ $0. This dashboard becomes essential once we move to paid models/scale.

### 3.8 Monetization & Subscriptions *(post-launch)*
| Metric | What it means | Status |
|---|---|---|
| Free vs Paid Users, Conversion Rate | Funnel to revenue | 🔵 |
| Credits Purchased / Consumed / Remaining | Usage-based economy | 🔵 (credits already tracked) |
| MRR, Active Subscribers, Renewals, Churn | Revenue health | 🔵 |

### 3.9 Feedback & Satisfaction
| Metric | What it means | Status |
|---|---|---|
| Interview Rating (1–5) | Post-interview star rating | 🔵 |
| AI Helpfulness / Realism | Quality perception | 🔵 |
| NPS (Would Recommend) | Loyalty | 🔵 |
| Feature Requests | Roadmap input | 🔵 |

### 3.10 Operations — Live Activity Feed
A real-time admin stream ("09:40 – David completed a Behavioral Interview") so the dashboard feels
alive and we can spot issues instantly. **Status: 🟢 Live.**

---

## 4. What's already LIVE in the admin dashboard today

We are not starting from zero. The `/admin/metrics` dashboard already shows real data:

- Total users, active today/this week, new signups
- Interviews started / completed, avg questions per interview
- **Average Interview Readiness** and **per-dimension averages**
- **Hiring recommendation distribution**
- Breakdowns by interview type, interviewer, and difficulty
- Knowledge-base size (chunks indexed)
- A live **activity feed**

Everything is admin-gated and available to the two admin accounts.

---

## 5. Rollout plan

| Phase | Focus | Unlocks |
|---|---|---|
| **Phase 1 — Now (Live)** | Platform, engagement, performance, content, activity | Judge product value & usage today |
| **Phase 2 — Pre-launch** | Retention (DAU/WAU/MAU, streaks), improvement-over-time, STAR usage, question-level analytics, ratings/NPS | Prove learning outcomes & engagement quality |
| **Phase 3 — At/After launch** | AI token cost dashboard, subscriptions/MRR/churn, cost-per-interview | Unit economics & business health |

Phase 2 needs light event tracking; Phase 3 needs billing + AI-usage logging.

---

## 6. The launch scorecard — the 7 numbers we watch weekly

If we only look at seven things each week, these are the ones:

1. **North Star:** Weekly completed interviews with a readiness improvement
2. **Activation rate** (% of signups who finish ≥1 interview)
3. **Weekly Active Users (WAU)**
4. **Interview completion rate**
5. **Avg Interview Readiness** (and its trend)
6. **Week-over-week improvement** per returning user
7. **Cost per interview** (once on paid models)

Plus one qualitative pulse: **average interview rating / NPS**.

---

## 7. Why this framework wins

- It ties directly to our **differentiator**: we don't just simulate interviews, we **measurably make people more hireable** — and we can prove it with the readiness-over-time curve.
- It's **honest**: engagement and outcome are fused in the North Star, with guardrail counter-metrics.
- It's **staged**: we ship value now and layer in cost/revenue as we monetize.
- Most of it is **already instrumented** — the data lives in our database and the admin dashboard renders it today.

---

*Dataverse AI Interview Coach · Metrics Framework · prepared for leadership review.*
