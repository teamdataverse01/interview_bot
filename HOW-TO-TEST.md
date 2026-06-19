# How to Test — click-by-click walkthrough

Follow these in the browser. Each step says **what to do**, **what to type**, and **what you should
see**. Tick the box when it works. ~10 minutes total.

> Two ways to get in:
> - **Demo mode ON** (students): open the site → you land on the **code screen**. Use the boss code
>   **`DV-BOSS-UQ9J`** to reach the dashboard (admin + 9999 credits).
> - **Demo mode OFF** (team dev): the site opens straight on the **dashboard**.

---

## 1. Start an interview
- [ ] On the **dashboard**, set: **Company = General**, **Difficulty = Beginner**, **Interview type = DSAR**, **Mode = Practice**.
- [ ] Click **Start interview**.
- ✅ You should land in the chat with **one** interviewer question, and a **“Round 1 · Q1/4”** chip at the top.
- ✅ Because it's **Beginner**, the question should be plain-language and explain any acronym (e.g. “a DSAR — Data Subject Access Request…”). It should NOT be a dense multi-part scenario.

## 2. Answer a question
- [ ] In the answer box, paste:
  > *"A DSAR is when someone asks for the personal data a company holds about them. I'd verify who they are, search our systems for their data, and send it to them within the legal deadline (30 days under GDPR)."*
- [ ] Click **Send**.
- ✅ Your answer appears, then a **Feedback** card shows: an **Interview Readiness** score, the 8 bars, the 6 principle chips, a **“What gets this closer to 100”** line, and a **💪 Stronger answer** you can expand.
- ✅ The next interviewer question appears below.

## 3. Clarification button (must NOT be scored)
- [ ] Click **🤔 Ask a clarifying question (not scored)**.
- [ ] Type: *"Can you explain what you mean by that?"* → send it.
- ✅ The interviewer replies with a short **Clarification** (rephrases / gives an example), and it says it's fine to ask.
- ✅ **No score/feedback card appears** for the clarification, and the **Q count does not move** (still the same question). This is the key check — asking is free.

## 4. Retry button (re-try a question)
- [ ] Under any answer's feedback card, click **🔁 Try this question again**.
- [ ] Paste a stronger answer, e.g.:
  > *"I run DSARs as a tiered workflow: automated identity verification at intake, a system-wide data search, redaction of third-party data, then response within the 30-day SLA — with an audit log for defensibility."*
- [ ] Click **Score my retry**.
- ✅ A **new score** appears with the change vs your first try, e.g. **New score: 82/100 (+30)**, plus a tip.
- ✅ This does **not** advance the interview — it's just practice.

## 5. Rounds (4 questions → summary)
- [ ] Keep answering until you finish **Q4** of the round (short answers are fine).
- ✅ After the 4th answer you get a **“🎉 Round 1 complete!”** panel with a round score ring, a summary, and buttons: **Continue interview →** and **switch topic**.
- [ ] Click **Continue interview →** (or pick a new topic and continue).
- ✅ A fresh question appears and the chip shows **Round 2**.

## 6. Voice (read the question + answer by speaking)  *(Chrome/Edge best)*
- [ ] Click **🔈 Voice** in the header.
- ✅ The interviewer's current question is **read aloud**. (Toggle shows **🔊 Voice on**.)
- [ ] Click the **🎤** mic button → allow the mic → speak an answer → click 🎤 again.
- ✅ It shows **“Transcribing…”**, then your spoken words drop into the answer box (editable). Click **Send**.

## 7. Score presentation & gap analysis
- [ ] Finish the interview (or click through to the end).
- ✅ The top shows a big **readiness ring** (score out of 100) — the focal point.
- ✅ The report lists **Strengths**, **Focus areas**, and a **🎯 “to close the gap to 100”** line.

## 8. Company vs General (no Netflix bias)
- [ ] Start a new interview with **Company = General**.
- ✅ Questions and the **Stronger answer** stay company-neutral (no “here at Netflix/we…”).
- [ ] Start another with **Company = Netflix**.
- ✅ Now it's explicitly in Netflix's voice (Freedom & Responsibility, etc.).

## 9. Answer Bank (import questions → model answers)
- [ ] From the dashboard, click **📚 Answer Bank**.
- [ ] Paste a couple of questions (one per line), e.g.
  > *How would you handle a DSAR backlog?*
  > *Walk me through running a DPIA for a new AI feature.*
- [ ] Submit.
- ✅ You get a strong **model answer** per question, with key points and the principles it demonstrates.

## 10. Demo codes (the abuse-resistant gate)
*(Only meaningful when demo mode is ON.)*
- [ ] Open the site in a **fresh incognito window** → you should see the **code screen** (no dashboard).
- [ ] Enter a **student code** from `studentscodes.md` (e.g. `DV-GL7ZLS`).
- ✅ It drops you straight into **one** interview.
- [ ] Finish or leave, then open incognito again and **re-enter the same student code**.
- ✅ You should be blocked: **“This access code has already been used.”**
- [ ] Enter the **boss code `DV-BOSS-UQ9J`**.
- ✅ It opens the **dashboard** with lots of credits (reusable — works every time).

## 11. Look & feel
- ✅ Colors are **Dataverse purple**, the background is warm with a faint human-imagery layer, and content sits on clean white cards.

---

### If something's off
- Code screen doesn't show in demo mode → the frontend service may not have finished its latest build; redeploy it.
- A score/answer says “LLM unavailable” → a free-tier model hit its limit; it auto-fails-over, just retry.
- Mic/voice button missing → you're on a browser without speech support (use Chrome or Edge).
